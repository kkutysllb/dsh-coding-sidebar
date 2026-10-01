/**
 * Extract the concatenated plain text of a content-block list (the durable
 * `ContentBlock[]` shape, structurally: blocks with `type: 'text'` carry
 * `text`; anything else — tool_use, image, … — contributes nothing).
 * @param content - the raw `content` field of a message event.
 * @returns the joined text, or undefined when the message carries no text.
 */
export function contentText(content) {
    if (!Array.isArray(content))
        return undefined;
    const parts = [];
    for (const block of content) {
        if (block === null || typeof block !== 'object')
            continue;
        const candidate = block;
        if (candidate.type === 'text' && typeof candidate.text === 'string') {
            parts.push(candidate.text);
        }
    }
    return parts.length > 0 ? parts.join('\n') : undefined;
}
/**
 * Fold a session event log into the last text output + last tool call (each
 * is the LAST occurrence in event order). Lifecycle events and raw
 * `assistant/chunk` rows are ignored — the card shows what the subagent is
 * doing right now, not its plumbing. The scan runs BACKWARD from the newest
 * event and stops once both fields are found, so a long history costs only
 * the recent tail in the common case.
 * @param events - the session's append-only event log (oldest → newest).
 * @param maxMessages - optional message-boundary window: only the tail's
 *   last `maxMessages` surface messages (`user/message`, `assistant/message`)
 *   and the events between them are considered, mirroring the old
 *   `subagents.history({ maxMessages })` window. Stale activity older than
 *   the window is never surfaced, and a long log is never scanned in full.
 * @returns the last text and/or tool call; an empty object when the log has neither.
 */
export function lastActivity(events, maxMessages = Infinity) {
    let text;
    let tool;
    let messagesSeen = 0;
    for (let index = events.length - 1; index >= 0; index -= 1) {
        if (text !== undefined && tool !== undefined)
            break;
        const event = events[index];
        if (event === undefined)
            continue;
        const { type } = event;
        const data = event.data;
        if (type === 'user/message' || type === 'assistant/message') {
            messagesSeen += 1;
            if (messagesSeen > maxMessages)
                break;
        }
        else if (messagesSeen >= maxMessages) {
            // The window already holds its `maxMessages` messages: anything older
            // than the oldest in-window message sits outside the recent window.
            continue;
        }
        if (text === undefined && type === 'assistant/message') {
            const message = data.message;
            const extracted = contentText(message?.content);
            if (extracted !== undefined)
                text = extracted;
        }
        else if (tool === undefined && type === 'tool/call') {
            tool = {
                name: typeof data.name === 'string' ? data.name : 'tool',
                args: typeof data.arguments === 'string' ? data.arguments : '',
            };
        }
    }
    if (text === undefined && tool === undefined)
        return {};
    return {
        ...(text === undefined ? {} : { text }),
        ...(tool === undefined ? {} : { tool }),
    };
}
/**
 * Fold the window's tool calls into the merged activity line: names grouped
 * and counted in first-appearance order, plus the newest call that has no
 * matching `tool/result` (the one actually in flight).
 *
 * The window matches {@link lastActivity}: the tail's last `maxMessages`
 * surface messages and the events between them, so a long log costs only the
 * recent tail.
 * @param events - the session's append-only event log (oldest → newest).
 * @param maxMessages - optional message-boundary window (default: whole log).
 * @returns the grouped activity, or undefined when the window has no calls.
 */
export function mergedActivity(events, maxMessages = Infinity) {
    // Same window as `lastActivity`: the tail's last `maxMessages` surface
    // messages, INCLUDING the oldest of them. Zero/negative → no window at all.
    if (maxMessages <= 0)
        return undefined;
    let start = 0;
    if (Number.isFinite(maxMessages)) {
        let seen = 0;
        for (let index = events.length - 1; index >= 0; index -= 1) {
            const type = events[index]?.type;
            if (type === 'user/message' || type === 'assistant/message') {
                seen += 1;
                if (seen === maxMessages) {
                    start = index;
                    break;
                }
            }
        }
    }
    const calls = [];
    const finished = new Set();
    for (let index = start; index < events.length; index += 1) {
        const event = events[index];
        if (event === undefined)
            continue;
        const data = event.data;
        if (event.type === 'tool/call') {
            calls.push({
                callId: typeof data.callId === 'string' ? data.callId : `#${calls.length}`,
                name: typeof data.name === 'string' ? data.name : 'tool',
                args: typeof data.arguments === 'string' ? data.arguments : '',
            });
        }
        else if (event.type === 'tool/result' && typeof data.callId === 'string') {
            finished.add(data.callId);
        }
    }
    if (calls.length === 0)
        return undefined;
    const counts = [];
    for (const call of calls) {
        const row = counts.find((entry) => entry.name === call.name);
        if (row === undefined)
            counts.push({ name: call.name, count: 1 });
        else
            row.count += 1;
    }
    const running = [...calls].reverse().find((call) => !finished.has(call.callId));
    return {
        counts,
        total: calls.length,
        ...(running === undefined ? {} : { running: { name: running.name, args: running.args } }),
    };
}
