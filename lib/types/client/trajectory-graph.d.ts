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
/** Ledger node kinds the graph draws. */
export type TrajectoryNodeKind = 
/** The loaded system prompt / tool catalog state. */
'system' | 'user' | 'steering'
/** A context/system injection surfaced in the flow. */
 | 'context'
/** A slash-command lifecycle. */
 | 'command'
/** One ordinary model request (the agent-loop step). */
 | 'request'
/** One compaction provider request. */
 | 'compact-request'
/** A finalized assistant message. */
 | 'assistant'
/** The in-flight streaming assistant prefix. */
 | 'partial'
/** A settled tool result (possibly a sub-call). */
 | 'tool'
/** A tool call whose result has not landed yet. */
 | 'running-call'
/** A landed compaction checkpoint. */
 | 'compaction'
/** A scheduled/started model retry. */
 | 'retry' | 'error' | 'max-tokens'
/** A surface event this graph version does not know. */
 | 'unknown';
/** The swimlane a node belongs to (see TrajectoryGraph.tsx). */
export type TrajectoryLane = 'input' | 'model' | 'tool';
/** Node lifecycle as far as the graph needs it. */
export type TrajectoryNodeStatus = 'idle' | 'running' | 'complete' | 'error' | 'interrupted';
/** Chain-of-data edge kinds. */
export type TrajectoryEdgeKind = 'prompt' | 'result' | 'dispatch' | 'subcall' | 'loop';
/** Token buckets, read from either the raw or the projected usage shape. */
export interface TrajectoryTokens {
    input?: number;
    cacheRead?: number;
    cacheWrite?: number;
    output?: number;
    reasoning?: number;
}
/**
 * One attachment carried by a user/assistant/tool content block (upstream
 * 0.1.6-alpha.2 unified attachment display). Images and files keep their
 * recorded metadata so the inspector can list them (name, size, type,
 * dimensions) and the view can request authorized thumbnails.
 */
export interface TrajectoryAttachment {
    kind: 'image' | 'file';
    /** Opaque storage id; never a filesystem path. */
    attachmentId: string;
    /** Recorded display name (files always have one; images may not). */
    name?: string;
    bytes?: number;
    mediaType?: string;
    width?: number;
    height?: number;
    /** An image-offload decision replaced the bytes with placeholder text. */
    offloaded?: boolean;
}
/** One graph node (a ledger record). */
export interface TrajectoryGraphNode {
    /** Stable identity (`req:<startSeq>`, `ev:<kind>:<seq>`, `call:<callId>`…). */
    id: string;
    kind: TrajectoryNodeKind;
    lane: TrajectoryLane;
    status: TrajectoryNodeStatus;
    /** Ledger order key (fractional for synthesized records). */
    seq: number;
    /** Unix epoch ms. */
    time: number;
    /** Owning turn, or null for records outside any turn (a standalone compaction). */
    turn: number | null;
    /** Agent-loop step inside the turn, when known. */
    step: number | null;
    /** Short chip label (tool name, role, first text line…). */
    label: string;
    /** Optional chip badge (status, token count, call id tail). */
    badge?: string;
    /** Full inspector body. */
    detail?: string;
    /** Ordered attachments carried by this record's content blocks. */
    attachments?: readonly TrajectoryAttachment[];
    /** Structured tool-call facts (tool/waiting/running-call records). */
    toolDetail?: TrajectoryToolDetail;
    tokens?: TrajectoryTokens;
    durationMs?: number | null;
    /** Whether this node is still moving (drives the flow animation). */
    live: boolean;
    /** Whether the record opens a new turn (a user message). */
    opensTurn?: boolean;
}
/** One chain-of-data edge. */
export interface TrajectoryGraphEdge {
    id: string;
    from: string;
    to: string;
    kind: TrajectoryEdgeKind;
    /** Whether data is currently moving across this edge. */
    live: boolean;
}
/**
 * Structured tool-call facts for the refined inspector: the call header
 * (name, id, duration), the raw JSON arguments, and the settled result text
 * as separate fields instead of one pre-joined blob.
 */
export interface TrajectoryToolDetail {
    name: string;
    callId?: string;
    argsRaw?: string;
    resultText?: string;
    isError?: boolean;
}
/** One replay step: light a node, animate the edge that delivered it. */
export interface TrajectoryTimelineStep {
    nodeId: string;
    /** The incoming edge to animate, or null for a root record. */
    edgeId: string | null;
    /** Unix epoch ms of the record (the replay's real-time pacing). */
    at: number;
}
/** Session-level totals shown in the tab's stats strip. */
export interface TrajectoryGraphStats {
    nodes: number;
    edges: number;
    /** Highest turn number seen (0 when the session has no turn yet). */
    turns: number;
    tools: number;
    running: number;
    errors: number;
    /** Summed provider token buckets (absent buckets are skipped). */
    tokens: TrajectoryTokens;
}
/** The complete graph projection of one trajectory snapshot. */
export interface TrajectoryGraph {
    /** Nodes in ledger order. */
    nodes: readonly TrajectoryGraphNode[];
    edges: readonly TrajectoryGraphEdge[];
    /** Ledger order with the incoming edge per record, for replay. */
    timeline: readonly TrajectoryTimelineStep[];
    stats: TrajectoryGraphStats;
    /** Whether anything is still in flight (drives the live animation). */
    live: boolean;
}
/** One streamed/finalized assistant content block. */
export interface TrajectoryBlockLike {
    kind?: string;
    text?: string;
    callId?: string;
    name?: string;
    argsRaw?: string;
    /** Durable image reference of an `image` block (forward-compat shape). */
    attachment?: unknown;
    [key: string]: unknown;
}
/** One content block of a user/context/tool record. */
export interface TrajectoryContentBlockLike {
    type?: string;
    text?: string;
    name?: string;
    /** Durable attachment reference of an `image`/`file` block (structural). */
    attachment?: unknown;
    [key: string]: unknown;
}
/** One tool call (running or settled), possibly owning child calls. */
export interface TrajectoryCallLike {
    callId?: string;
    parentCallId?: string;
    name?: string;
    argsRaw?: string;
    turn?: number;
    step?: number;
    time?: number;
    callTime?: number | null;
    call?: {
        name?: string;
        argsRaw?: string;
    } | null;
    content?: readonly TrajectoryContentBlockLike[];
    isError?: boolean;
    error?: {
        name?: string;
        code?: string;
    };
    subCalls?: readonly TrajectoryCallLike[];
    [key: string]: unknown;
}
/** One finalized ledger record. */
export interface TrajectoryEventNodeLike {
    kind?: string;
    seq?: number;
    time?: number;
    turn?: number;
    step?: number;
    content?: readonly TrajectoryContentBlockLike[];
    blocks?: readonly TrajectoryBlockLike[];
    callId?: string;
    parentCallId?: string;
    call?: {
        name?: string;
        argsRaw?: string;
    } | null;
    isError?: boolean;
    error?: {
        name?: string;
        code?: string;
    };
    subCalls?: readonly TrajectoryCallLike[];
    summary?: string | null;
    message?: string;
    code?: string;
    name?: string | null;
    args?: string | null;
    outcome?: {
        kind?: string;
        text?: string;
    } | null;
    retryState?: string;
    type?: string;
    provenance?: {
        role?: string;
        label?: string | null;
    };
    form?: string | null;
    interrupted?: boolean;
    timing?: {
        stepStartTime?: number | null;
        firstTokenTime?: number | null;
        completedTime?: number | null;
    };
    usage?: unknown;
    shadowedItemCount?: number | null;
    [key: string]: unknown;
}
/** One provider request (ordinary generation or compaction). */
export interface TrajectoryRequestLike {
    purpose?: string;
    startSeq?: number;
    startedAt?: number;
    completedAt?: number | null;
    status?: string;
    error?: string;
    errorCode?: string;
    turn?: number | null;
    step?: number;
    resultSeq?: number;
    replacementSeq?: number;
    retry?: number;
    maxRetries?: number;
    usage?: unknown;
    [key: string]: unknown;
}
/** The in-flight streaming assistant prefix. */
export interface TrajectoryPartialLike {
    turn?: number;
    step?: number;
    blocks?: readonly TrajectoryBlockLike[];
    [key: string]: unknown;
}
/** The host snapshot this projection consumes. */
export interface TrajectorySnapshotLike {
    systemPrompts?: readonly {
        seq?: number;
        time?: number;
        [key: string]: unknown;
    }[];
    eventNodes?: readonly TrajectoryEventNodeLike[];
    requests?: readonly TrajectoryRequestLike[];
    partial?: TrajectoryPartialLike | null;
    runningCalls?: readonly TrajectoryCallLike[];
    [key: string]: unknown;
}
/**
 * Extract the ordered attachment list of one record's content blocks.
 * Both vocabularies are covered: user/tool records key blocks by `type`
 * ('image' | 'file'), assistant records key them by `kind` ('image' forward
 * compatibility). Repeated references are preserved, malformed refs are
 * skipped — the inspector list stays a faithful, bounded projection.
 */
export declare function attachmentsOfContent(content: readonly TrajectoryContentBlockLike[] | undefined): TrajectoryAttachment[];
/** Extract the ordered attachment list of one assistant record's blocks. */
export declare function attachmentsOfBlocks(blocks: readonly TrajectoryBlockLike[] | undefined): TrajectoryAttachment[];
/**
 * Project one host trajectory snapshot into the graph model.
 * @param snapshot - host `TrajectorySnapshot` (structural mirror), or null.
 * @returns the graph; an absent/empty snapshot yields an empty graph.
 */
export declare function buildTrajectoryGraph(snapshot: TrajectorySnapshotLike | null | undefined): TrajectoryGraph;
/**
 * The slowest settled tool records, descending by recorded duration.
 * @param graph - the (windowed) graph projection.
 * @param limit - how many leaders to keep.
 * @returns id, chip label and duration of each leader (empty when no tool
 * record carries a duration).
 */
export declare function slowestTools(graph: TrajectoryGraph, limit: number): {
    id: string;
    name: string;
    durationMs: number;
}[];
/** One windowed view of a graph (the render cap). */
export interface TrajectoryGraphWindow {
    graph: TrajectoryGraph;
    /** How many leading records the window dropped. */
    hidden: number;
}
/**
 * Search the graph's records by a case-insensitive substring of the chip
 * label, the node kind, the node id, or a tool record's call id — the
 * search box's match model.
 * @param graph - the (windowed) graph projection.
 * @param query - raw user text; blank matches nothing.
 * @returns matching node ids in ledger order (the Enter key cycles them).
 */
export declare function searchTrajectoryNodes(graph: TrajectoryGraph, query: string): string[];
/**
 * Keep only the most recent `limit` records (plus the edges between them).
 * Long sessions are unbounded; the graph view renders a tail window so a
 * thousand-record ledger cannot stall the sidebar.
 * @param graph - the full projection.
 * @param limit - maximum records to keep (<= 0 keeps nothing).
 * @returns the windowed graph and the number of dropped leading records.
 */
export declare function windowTrajectoryGraph(graph: TrajectoryGraph, limit: number): TrajectoryGraphWindow;
