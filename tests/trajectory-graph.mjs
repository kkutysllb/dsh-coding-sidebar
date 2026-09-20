/**
 * Pure projection from the host's Trajectory target snapshot to this plugin's
 * trajectory GRAPH model: nodes (the ledger's records) plus edges (the links
 * the ledger already carries — `resultSeq`, `callId`, `subCalls`, turn/step
 * ownership).
 *
 * Why a separate module: the sidebar renders DSH's own trajectory ledger as a
 * graph, and the interesting part of that — which record fed which, which call
 * produced which result, where the agent loop turns around — is data
 * arithmetic, not rendering. Keeping it dependency-free (no React, no host
 * imports, no DOM) makes the projection unit-testable by plain `node`, the
 * same pattern as `deliveries.ts` / `openpath-intercept.ts` /
 * `file-icon-registry.ts`.
 *
 * Input contract: a STRUCTURAL mirror of `TrajectorySnapshot` (see
 * `@deepseek-ai/dsh-client-ui-trajectory`). Every field is optional and
 * defensively read, because the host snapshot is merge-extensible and a newer
 * host may widen it; an unknown record kind degrades to an `unknown` node
 * instead of throwing. The mirror is deliberately local rather than an
 * imported host type: the client bundle's purity gate forbids value imports of
 * host packages, and the repo restates host faces structurally everywhere
 * (see `src/context-types.ts`).
 *
 * Edge semantics (all derived, never invented):
 * - `prompt`   — the last not-yet-consumed input record (user / steering /
 *                context / system prompt / compaction checkpoint) that preceded
 *                the request feeds it.
 * - `result`   — `request.resultSeq` → the assistant record with that seq (or
 *                `replacementSeq` → the compaction record); a still-running
 *                request links to the live streaming record instead.
 * - `dispatch` — an assistant `tool-call` block → the tool record whose
 *                `callId` matches (a call whose result never landed links to
 *                the live call, or to a synthesized "waiting" node).
 * - `subcall`  — a tool record → each child call it dispatched (`subCalls`).
 * - `loop`     — a tool record → the next assistant request: the agent loop
 *                turning back to the model.
 */
/* ------------------------------------------------------------------ *
 * Small readers
 * ------------------------------------------------------------------ */
/** Live records get order keys above every durable seq. */
const LIVE_BASE = 1e9;
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
/** Read a token bucket from either the raw (`inputTokens`) or projected (`input`) shape. */
function tokenBuckets(usage) {
    const record = asRecord(usage);
    if (record === null)
        return undefined;
    const pick = (...keys) => {
        for (const key of keys) {
            const value = num(record[key]);
            if (value !== undefined)
                return value;
        }
        return undefined;
    };
    const buckets = {
        input: pick('input', 'inputTokens', 'promptTokens'),
        cacheRead: pick('cacheRead', 'cacheReadTokens'),
        cacheWrite: pick('cacheWrite', 'cacheWriteTokens'),
        output: pick('output', 'outputTokens', 'completionTokens'),
        reasoning: pick('reasoning', 'reasoningTokens'),
    };
    const empty = Object.values(buckets).every(value => value === undefined);
    return empty ? undefined : buckets;
}
/**
 * Extract the ordered attachment list of one record's content blocks.
 * Both vocabularies are covered: user/tool records key blocks by `type`
 * ('image' | 'file'), assistant records key them by `kind` ('image' forward
 * compatibility). Repeated references are preserved, malformed refs are
 * skipped — the inspector list stays a faithful, bounded projection.
 */
export function attachmentsOfContent(content) {
    if (content === undefined)
        return [];
    const out = [];
    for (const block of content) {
        const attachment = readAttachment(block.type, block.attachment);
        if (attachment !== undefined)
            out.push(attachment);
    }
    return out;
}
/** Extract the ordered attachment list of one assistant record's blocks. */
export function attachmentsOfBlocks(blocks) {
    if (blocks === undefined)
        return [];
    const out = [];
    for (const block of blocks) {
        if (block.kind !== 'image')
            continue;
        const attachment = readAttachment('image', block.attachment);
        if (attachment !== undefined)
            out.push(attachment);
    }
    return out;
}
/** Read one structural attachment ref; undefined when it cannot be trusted. */
function readAttachment(type, ref) {
    if (type !== 'image' && type !== 'file')
        return undefined;
    const record = asRecord(ref);
    if (record === null)
        return undefined;
    const attachmentId = typeof record.attachmentId === 'string' && record.attachmentId !== ''
        ? record.attachmentId
        : undefined;
    if (attachmentId === undefined)
        return undefined;
    return {
        kind: type,
        attachmentId,
        ...(typeof record.name === 'string' && record.name !== '' ? { name: record.name } : {}),
        ...(num(record.bytes) !== undefined ? { bytes: num(record.bytes) } : {}),
        ...(type === 'image'
            ? {
                ...(typeof record.mediaType === 'string' && record.mediaType !== '' ? { mediaType: record.mediaType } : {}),
                ...(num(record.width) !== undefined ? { width: num(record.width) } : {}),
                ...(num(record.height) !== undefined ? { height: num(record.height) } : {}),
                ...(record.offloaded === true ? { offloaded: true } : {}),
            }
            : {}),
    };
}
/** Collapse content blocks to one whitespace-normalized line. */
function contentText(content, limit) {
    if (content === undefined)
        return '';
    const parts = [];
    for (const block of content) {
        if (block.type === 'image' || block.type === 'file')
            continue; // attachments render as counts/thumbnails, not label noise
        if (typeof block.text === 'string' && block.text !== '')
            parts.push(block.text);
        else if (typeof block.name === 'string' && block.name !== '')
            parts.push(block.name);
        else if (typeof block.type === 'string' && block.type !== '')
            parts.push(`[${block.type}]`);
    }
    return squash(parts.join(' '), limit);
}
/** Collapse assistant blocks to one whitespace-normalized line (tool calls by name). */
function blocksText(blocks, limit) {
    if (blocks === undefined)
        return '';
    const parts = [];
    for (const block of blocks) {
        if (block.kind === 'image')
            continue; // attachment, not label text
        if (block.kind === 'tool-call')
            parts.push(block.name ?? 'tool');
        else if (typeof block.text === 'string' && block.text !== '')
            parts.push(block.text);
        else if (typeof block.kind === 'string' && block.kind !== '' && block.kind !== 'text')
            parts.push(`[${block.kind}]`);
    }
    return squash(parts.join(' '), limit);
}
/** One-line normalization: collapse whitespace and cut at `limit`. */
function squash(text, limit) {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > limit ? `${flat.slice(0, Math.max(0, limit - 1))}…` : flat;
}
/**
 * Raw multiline body of one assistant record (markdown-ready): text-bearing
 * blocks joined with blank lines, newlines preserved, capped hard. The chip
 * label stays a squashed single line; the inspector body renders markdown.
 */
function blocksRawText(blocks, limit) {
    if (blocks === undefined)
        return '';
    const parts = [];
    for (const block of blocks) {
        if (block.kind === 'image')
            continue; // attachments render as thumbnails
        if (typeof block.text === 'string' && block.text !== '')
            parts.push(block.text);
    }
    const joined = parts.join('\n\n');
    return joined.length > limit ? `${joined.slice(0, Math.max(0, limit - 1))}…` : joined;
}
function firstLine(text, limit) {
    return typeof text === 'string' ? squash(text, limit) : '';
}
/** The short tail a call id is displayed by. */
function callTail(callId) {
    return callId.length > 10 ? callId.slice(-6) : callId;
}
/** Extract every `tool-call` block of an assistant record. */
function toolCallBlocks(node) {
    const blocks = node.blocks;
    if (blocks === undefined)
        return [];
    const calls = [];
    for (const block of blocks) {
        if (block.kind !== 'tool-call')
            continue;
        calls.push({
            callId: typeof block.callId === 'string' ? block.callId : '',
            name: typeof block.name === 'string' ? block.name : 'tool',
            argsRaw: typeof block.argsRaw === 'string' ? block.argsRaw : '',
        });
    }
    return calls;
}
/* ------------------------------------------------------------------ *
 * Projection
 * ------------------------------------------------------------------ */
/** Lane and kind of one durable ledger record. */
function classifyEventNode(node) {
    switch (node.kind) {
        case 'user': return { kind: 'user', lane: 'input' };
        case 'steering': return { kind: 'steering', lane: 'input' };
        case 'context': return { kind: 'context', lane: 'input' };
        case 'command': return { kind: 'command', lane: 'input' };
        case 'assistant': return { kind: 'assistant', lane: 'model' };
        case 'tool-result': return { kind: 'tool', lane: 'tool' };
        case 'compaction': return { kind: 'compaction', lane: 'model' };
        case 'model-retry': return { kind: 'retry', lane: 'model' };
        case 'turn-error': return { kind: 'error', lane: 'model' };
        case 'turn-max-tokens': return { kind: 'max-tokens', lane: 'model' };
        default: return { kind: 'unknown', lane: 'model' };
    }
}
/** Chip label and inspector body of one durable ledger record. */
function describeEventNode(node, kind) {
    switch (kind) {
        case 'user':
        case 'steering': {
            const attachments = attachmentsOfContent(node.content);
            return {
                label: firstLine(contentText(node.content, 48), 48)
                    || firstLine(attachments[0]?.name, 48)
                    || (kind === 'user' ? 'user' : 'steering'),
                detail: contentText(node.content, 4000),
                ...(attachments.length === 0 ? {} : { attachments }),
            };
        }
        case 'context': {
            const label = node.provenance?.label ?? node.form ?? 'context';
            const attachments = attachmentsOfContent(node.content);
            return {
                label: firstLine(label, 40),
                badge: node.provenance?.role,
                detail: contentText(node.content, 4000),
                ...(attachments.length === 0 ? {} : { attachments }),
            };
        }
        case 'command':
            return {
                label: `/${node.name ?? 'command'}${node.args === null || node.args === undefined ? '' : ` ${node.args}`}`.trim(),
                badge: node.outcome?.kind,
                detail: node.outcome?.text ?? '',
            };
        case 'assistant': {
            const calls = toolCallBlocks(node);
            const attachments = attachmentsOfBlocks(node.blocks);
            const text = blocksText(node.blocks, 52);
            const label = text !== ''
                ? text
                : attachments[0]?.name !== undefined
                    ? firstLine(attachments[0].name, 52)
                    : calls.length > 0 ? `${calls.length} tool call` : 'assistant';
            return {
                label,
                badge: calls.length > 0 ? `${calls.length}×` : undefined,
                // The inspector renders markdown: keep the raw multiline body.
                detail: blocksRawText(node.blocks, 20000),
                ...(attachments.length === 0 ? {} : { attachments }),
            };
        }
        case 'tool': {
            const name = node.call?.name ?? node.callId ?? 'tool';
            const attachments = attachmentsOfContent(node.content);
            return {
                label: name,
                badge: node.isError === true ? 'error' : callTail(node.callId ?? ''),
                detail: [node.call?.argsRaw ?? '', contentText(node.content, 4000)].filter(part => part !== '').join('\n'),
                ...(attachments.length === 0 ? {} : { attachments }),
                toolDetail: {
                    name,
                    ...(typeof node.callId === 'string' && node.callId !== '' ? { callId: node.callId } : {}),
                    ...(node.call?.argsRaw !== undefined && node.call.argsRaw !== '' ? { argsRaw: node.call.argsRaw } : {}),
                    ...(node.isError === true ? { isError: true } : {}),
                    resultText: contentText(node.content, 8000),
                },
            };
        }
        case 'compaction': {
            const shadowed = num(node.shadowedItemCount);
            return {
                label: firstLine(node.summary, 44) || 'compaction',
                badge: shadowed === undefined ? undefined : `${shadowed}`,
                detail: node.summary ?? '',
            };
        }
        case 'retry':
            return { label: node.retryState ?? 'retry', badge: node.code, detail: node.message ?? '' };
        case 'error':
            return { label: firstLine(node.message, 44) || 'error', badge: node.code, detail: node.message ?? '' };
        case 'max-tokens':
            return { label: 'max tokens' };
        default:
            return { label: node.type ?? 'event', detail: '' };
    }
}
/** Status of one durable ledger record. */
function eventNodeStatus(node, kind) {
    switch (kind) {
        case 'tool': return node.isError === true ? 'error' : 'complete';
        case 'assistant': return node.interrupted === true ? 'interrupted' : 'complete';
        case 'error':
        case 'max-tokens': return 'error';
        case 'retry': return node.retryState === 'started' ? 'running' : 'idle';
        default: return 'idle';
    }
}
/**
 * Project one host trajectory snapshot into the graph model.
 * @param snapshot - host `TrajectorySnapshot` (structural mirror), or null.
 * @returns the graph; an absent/empty snapshot yields an empty graph.
 */
export function buildTrajectoryGraph(snapshot) {
    if (snapshot === null || snapshot === undefined)
        return emptyGraph();
    const pending = [];
    /** callId → owning assistant record (turn/step source for tool records). */
    const callOwner = new Map();
    /** Every node by its callId (settled results and live calls). */
    const callNodes = new Map();
    const requests = [];
    // 1. System prompts (the loaded prompt/catalog state).
    for (const prompt of snapshot.systemPrompts ?? []) {
        const seq = num(prompt.seq);
        if (seq === undefined)
            continue;
        pending.push({
            node: {
                id: `sys:${seq}`,
                kind: 'system',
                lane: 'input',
                status: 'idle',
                seq,
                time: num(prompt.time) ?? 0,
                turn: null,
                step: null,
                label: 'system prompt',
                live: false,
            },
            order: seq,
        });
    }
    // 2. Durable ledger records.
    for (const record of snapshot.eventNodes ?? []) {
        const seq = num(record.seq);
        if (seq === undefined)
            continue;
        const { kind, lane } = classifyEventNode(record);
        const described = describeEventNode(record, kind);
        const status = eventNodeStatus(record, kind);
        const usage = tokenBuckets(record.usage);
        const timing = record.timing;
        const completed = num(timing?.completedTime);
        const started = num(timing?.stepStartTime);
        const node = {
            id: `ev:${record.kind ?? 'unknown'}:${seq}`,
            kind,
            lane,
            status,
            seq,
            time: num(record.time) ?? 0,
            turn: num(record.turn) ?? null,
            step: num(record.step) ?? null,
            label: described.label,
            ...(described.badge === undefined ? {} : { badge: described.badge }),
            ...(described.detail === undefined || described.detail === '' ? {} : { detail: described.detail }),
            ...(described.attachments === undefined ? {} : { attachments: described.attachments }),
            ...(described.toolDetail === undefined ? {} : { toolDetail: described.toolDetail }),
            ...(usage === undefined ? {} : { tokens: usage }),
            ...(completed === undefined || started === undefined ? {} : { durationMs: Math.max(0, completed - started) }),
            live: false,
            ...(kind === 'user' ? { opensTurn: true } : {}),
        };
        pending.push({ node, order: seq });
        if (kind === 'tool' && typeof record.callId === 'string' && record.callId !== '') {
            callNodes.set(record.callId, node.id);
        }
        if (kind === 'assistant') {
            const owner = { turn: node.turn, step: node.step };
            for (const call of toolCallBlocks(record)) {
                if (call.callId !== '')
                    callOwner.set(call.callId, owner);
            }
        }
    }
    // 3. Provider requests (the agent-loop steps).
    for (const view of snapshot.requests ?? []) {
        const startSeq = num(view.startSeq);
        if (startSeq === undefined)
            continue;
        const compaction = view.purpose === 'compaction';
        const status = view.status === 'running' ? 'running' : view.status === 'error' ? 'error' : 'complete';
        const startedAt = num(view.startedAt) ?? 0;
        const completedAt = num(view.completedAt);
        const usage = tokenBuckets(view.usage);
        const retry = num(view.retry);
        const seq = num(view.startSeq) ?? startSeq;
        const node = {
            id: compaction ? `creq:${startSeq}` : `req:${startSeq}`,
            kind: compaction ? 'compact-request' : 'request',
            lane: 'model',
            status,
            seq,
            time: startedAt,
            turn: num(view.turn) ?? null,
            step: num(view.step) ?? (compaction ? 0 : null),
            label: compaction ? 'compaction request' : 'model request',
            badge: status === 'running' ? 'running'
                : retry === undefined ? undefined
                    : `retry ${retry}`,
            ...(view.error === undefined || view.error === '' ? {} : { detail: view.error }),
            ...(usage === undefined ? {} : { tokens: usage }),
            durationMs: completedAt === undefined ? null : Math.max(0, completedAt - startedAt),
            live: status === 'running',
        };
        pending.push({ node, order: startSeq });
        requests.push({ node, view });
    }
    // 4. Live records: the streaming assistant prefix and unsettled calls.
    const liveNodes = [];
    const partial = snapshot.partial;
    if (partial !== null && partial !== undefined) {
        const turn = num(partial.turn) ?? null;
        const step = num(partial.step) ?? null;
        liveNodes.push({
            id: `partial:${turn ?? '-'}:${step ?? '-'}`,
            kind: 'partial',
            lane: 'model',
            status: 'running',
            seq: LIVE_BASE,
            time: 0,
            turn,
            step,
            label: blocksText(partial.blocks, 52) || 'streaming',
            badge: 'live',
            live: true,
        });
    }
    /** Flatten a call tree into live nodes (children keep their parent link). */
    const walkCalls = (call, parentId, count) => {
        const callId = typeof call.callId === 'string' ? call.callId : '';
        const id = callId === '' ? `pending:${parentId ?? 'root'}:${count}` : `call:${callId}`;
        const turn = num(call.turn) ?? null;
        const step = num(call.step) ?? null;
        liveNodes.push({
            id,
            kind: 'running-call',
            lane: 'tool',
            status: 'running',
            seq: LIVE_BASE + 1000 + count,
            time: num(call.time) ?? 0,
            turn,
            step,
            label: call.name ?? 'tool',
            badge: 'live',
            ...(call.argsRaw === undefined || call.argsRaw === '' ? {} : { detail: call.argsRaw }),
            ...(call.argsRaw === undefined || call.argsRaw === ''
                ? {}
                : {
                    toolDetail: {
                        name: call.name ?? 'tool',
                        ...(callId === '' ? {} : { callId }),
                        argsRaw: call.argsRaw,
                    },
                }),
            live: true,
        });
        if (callId !== '')
            callNodes.set(callId, id);
        let next = count + 1;
        for (const child of call.subCalls ?? [])
            next = walkCalls(child, id, next);
        return next;
    };
    let liveCount = 0;
    for (const call of snapshot.runningCalls ?? []) {
        liveCount = walkCalls(call, null, liveCount);
    }
    for (const node of liveNodes)
        pending.push({ node, order: node.seq });
    // 5. Synthesize the calls whose result never landed (window cut, or the
    //    result is still pending while no live call was reported).
    for (const record of snapshot.eventNodes ?? []) {
        if (record.kind !== 'assistant')
            continue;
        const seq = num(record.seq);
        if (seq === undefined)
            continue;
        for (const call of toolCallBlocks(record)) {
            if (call.callId === '' || callNodes.has(call.callId))
                continue;
            const id = `waiting:${call.callId}`;
            callNodes.set(call.callId, id);
            const owner = callOwner.get(call.callId);
            const node = {
                id,
                kind: 'tool',
                lane: 'tool',
                status: 'idle',
                seq: seq + 0.5,
                time: num(record.time) ?? 0,
                turn: owner?.turn ?? null,
                step: owner?.step ?? null,
                label: call.name,
                badge: callTail(call.callId),
                ...(call.argsRaw === '' ? {} : { detail: call.argsRaw }),
                ...(call.argsRaw === '' ? {} : { toolDetail: { name: call.name, callId: call.callId, argsRaw: call.argsRaw } }),
                live: false,
            };
            pending.push({ node, order: seq + 0.5 });
        }
    }
    // 6. Ledger order.
    pending.sort((left, right) => left.order - right.order || left.node.id.localeCompare(right.node.id));
    const nodes = pending.map(entry => entry.node);
    const byId = new Map(nodes.map(node => [node.id, node]));
    // 7. Turn attribution: requests own their declared turn; a tool record
    //    inherits the turn of the assistant that issued it; input records
    //    belong to the request they fed.
    const assistantRequests = requests
        .filter(entry => entry.view.purpose !== 'compaction')
        .sort((left, right) => left.node.seq - right.node.seq);
    let lastTurn = null;
    let lastStep = null;
    for (const node of nodes) {
        if (node.kind === 'request' || node.kind === 'compact-request') {
            if (node.turn !== null)
                lastTurn = node.turn;
            lastStep = node.step;
            continue;
        }
        if (node.turn !== null && (node.kind === 'assistant' || node.kind === 'partial' || node.kind === 'error' || node.kind === 'max-tokens')) {
            lastTurn = node.turn;
            lastStep = node.step;
            continue;
        }
        if (node.kind === 'user' || node.kind === 'steering' || node.kind === 'context'
            || node.kind === 'command' || node.kind === 'system') {
            const feeder = assistantRequests.find(entry => entry.node.seq > node.seq);
            node.turn = feeder?.node.turn ?? lastTurn;
            node.step = feeder?.node.step ?? null;
            continue;
        }
        if (node.kind === 'compaction') {
            // A checkpoint belongs to the compaction request that committed it
            // (`replacementSeq`), so a standalone compaction stays outside every turn.
            const owner = requests.find(entry => entry.view.purpose === 'compaction'
                && num(entry.view.replacementSeq) === node.seq);
            node.turn = owner?.node.turn ?? null;
            node.step = owner?.node.step ?? null;
            continue;
        }
        // Tool records and turn-boundary markers: inherit the enclosing step.
        node.turn = node.turn ?? lastTurn;
        node.step = node.step ?? lastStep;
    }
    // 8. Edges.
    const edges = [];
    const seen = new Set();
    const link = (from, to, kind) => {
        if (from === to)
            return;
        const source = byId.get(from);
        const target = byId.get(to);
        if (source === undefined || target === undefined)
            return;
        const id = `${kind}:${from}->${to}`;
        if (seen.has(id))
            return;
        seen.add(id);
        edges.push({ id, from, to, kind, live: false });
    };
    // 8a. input → request (each input feeds at most one request, once).
    const consumed = new Set();
    for (const entry of assistantRequests) {
        let feeder;
        for (const node of nodes) {
            if (node.seq >= entry.node.seq)
                break;
            if (consumed.has(node.id))
                continue;
            if (node.kind === 'user' || node.kind === 'steering' || node.kind === 'context'
                || node.kind === 'system' || node.kind === 'compaction')
                feeder = node;
        }
        if (feeder !== undefined) {
            consumed.add(feeder.id);
            link(feeder.id, entry.node.id, 'prompt');
        }
    }
    // 8b. request → result (the ledger's own resultSeq / replacementSeq link).
    const bySeq = new Map();
    for (const node of nodes)
        if (!bySeq.has(node.seq))
            bySeq.set(node.seq, node);
    for (const entry of requests) {
        const resultSeq = num(entry.view.resultSeq);
        const replacementSeq = num(entry.view.replacementSeq);
        const targetSeq = resultSeq ?? replacementSeq;
        if (targetSeq !== undefined) {
            const target = bySeq.get(targetSeq);
            if (target !== undefined)
                link(entry.node.id, target.id, 'result');
            continue;
        }
        if (entry.node.status === 'running') {
            const streaming = nodes.find(node => node.kind === 'partial'
                && node.turn === entry.node.turn && node.step === entry.node.step);
            if (streaming !== undefined)
                link(entry.node.id, streaming.id, 'result');
        }
    }
    // 8c. assistant tool-call block → tool record (callId pairing).
    for (const record of snapshot.eventNodes ?? []) {
        if (record.kind !== 'assistant')
            continue;
        const seq = num(record.seq);
        if (seq === undefined)
            continue;
        const from = `ev:assistant:${seq}`;
        for (const call of toolCallBlocks(record)) {
            const target = call.callId === '' ? undefined : callNodes.get(call.callId);
            if (target !== undefined)
                link(from, target, 'dispatch');
        }
    }
    // 8d. tool record → child calls it dispatched.
    const walkSubCalls = (parentId, call) => {
        const callId = typeof call.callId === 'string' ? call.callId : '';
        const childId = callId === '' ? undefined : callNodes.get(callId);
        if (childId !== undefined)
            link(parentId, childId, 'subcall');
        for (const child of call.subCalls ?? [])
            walkSubCalls(childId ?? parentId, child);
    };
    for (const record of snapshot.eventNodes ?? []) {
        if (record.kind !== 'tool-result')
            continue;
        const seq = num(record.seq);
        if (seq === undefined)
            continue;
        const from = `ev:tool-result:${seq}`;
        for (const child of record.subCalls ?? [])
            walkSubCalls(from, child);
    }
    // Live call trees were flattened into nodes; re-walk the (tiny) host list to
    // recover the parent → child links.
    const walkLiveChildren = (parentId, call) => {
        for (const child of call.subCalls ?? []) {
            const callId = typeof child.callId === 'string' ? child.callId : '';
            const childId = callId === '' ? undefined : callNodes.get(callId);
            if (childId !== undefined)
                link(parentId, childId, 'subcall');
            walkLiveChildren(childId ?? parentId, child);
        }
    };
    for (const call of snapshot.runningCalls ?? []) {
        const callId = typeof call.callId === 'string' ? call.callId : '';
        const id = callId === '' ? undefined : callNodes.get(callId);
        if (id !== undefined)
            walkLiveChildren(id, call);
    }
    // 8e. tool record → the next request (the agent loop closing).
    const toolNodes = nodes.filter(node => node.lane === 'tool');
    for (const tool of toolNodes) {
        const next = assistantRequests.find(entry => entry.node.seq > tool.seq);
        if (next !== undefined)
            link(tool.id, next.node.id, 'loop');
    }
    // 8f. retry markers: previous attempt → marker → the retry request.
    for (const marker of nodes.filter(node => node.kind === 'retry')) {
        const previous = [...assistantRequests].reverse().find(entry => entry.node.seq < marker.seq);
        if (previous !== undefined)
            link(previous.node.id, marker.id, 'result');
        const retry = assistantRequests.find(entry => entry.node.seq > marker.seq && entry.node.turn === marker.turn);
        if (retry !== undefined)
            link(marker.id, retry.node.id, 'prompt');
    }
    // 8g. turn failures: the turn's last request → the failure marker.
    for (const marker of nodes.filter(node => node.kind === 'error' || node.kind === 'max-tokens')) {
        const previous = [...assistantRequests].reverse().find(entry => entry.node.seq < marker.seq
            && (marker.turn === null || entry.node.turn === marker.turn));
        if (previous !== undefined)
            link(previous.node.id, marker.id, 'result');
    }
    // 9. Live edge flags: data is moving into a live record.
    const liveIds = new Set(nodes.filter(node => node.live).map(node => node.id));
    const liveEdges = edges.map(edge => (liveIds.has(edge.to) ? { ...edge, live: true } : edge));
    return {
        nodes,
        edges: liveEdges,
        timeline: buildTimeline(nodes, liveEdges),
        stats: buildStats(nodes, liveEdges),
        live: liveIds.size > 0,
    };
}
/** Order the ledger for replay: each record with the edge that delivered it. */
function buildTimeline(nodes, edges) {
    const incoming = new Map();
    const priority = { prompt: 0, result: 1, dispatch: 2, subcall: 3, loop: 4 };
    for (const edge of edges) {
        const current = incoming.get(edge.to);
        if (current === undefined || priority[edge.kind] < priority[current.kind])
            incoming.set(edge.to, edge);
    }
    return nodes.map(node => ({
        nodeId: node.id,
        edgeId: incoming.get(node.id)?.id ?? null,
        at: node.time,
    }));
}
/** Session totals for the stats strip. */
function buildStats(nodes, edges) {
    const tokens = {};
    let turns = 0;
    let tools = 0;
    let running = 0;
    let errors = 0;
    for (const node of nodes) {
        if (node.turn !== null && node.turn > turns)
            turns = node.turn;
        if (node.lane === 'tool')
            tools++;
        if (node.live || node.status === 'running')
            running++;
        if (node.status === 'error')
            errors++;
        if (node.tokens !== undefined) {
            for (const key of ['input', 'cacheRead', 'cacheWrite', 'output', 'reasoning']) {
                const value = node.tokens[key];
                if (value !== undefined)
                    tokens[key] = (tokens[key] ?? 0) + value;
            }
        }
    }
    return { nodes: nodes.length, edges: edges.length, turns, tools, running, errors, tokens };
}
function emptyGraph() {
    return {
        nodes: [],
        edges: [],
        timeline: [],
        stats: { nodes: 0, edges: 0, turns: 0, tools: 0, running: 0, errors: 0, tokens: {} },
        live: false,
    };
}
/**
 * Keep only the most recent `limit` records (plus the edges between them).
 * Long sessions are unbounded; the graph view renders a tail window so a
 * thousand-record ledger cannot stall the sidebar.
 * @param graph - the full projection.
 * @param limit - maximum records to keep (<= 0 keeps nothing).
 * @returns the windowed graph and the number of dropped leading records.
 */
export function windowTrajectoryGraph(graph, limit) {
    if (limit <= 0)
        return { graph: emptyGraph(), hidden: graph.nodes.length };
    if (graph.nodes.length <= limit)
        return { graph, hidden: 0 };
    const dropped = graph.nodes.length - limit;
    const kept = graph.nodes.slice(dropped);
    const keptIds = new Set(kept.map(node => node.id));
    const edges = graph.edges.filter(edge => keptIds.has(edge.from) && keptIds.has(edge.to));
    return {
        graph: {
            nodes: kept,
            edges,
            timeline: graph.timeline.slice(dropped),
            stats: buildStats(kept, edges),
            live: graph.live,
        },
        hidden: dropped,
    };
}
