globalThis.__dshChunks__ = globalThis.__dshChunks__ || {};
globalThis.__dshChunks__["trajectory"] = (require) => {
	var module = { exports: {} };
	var exports = module.exports;
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	let react = require("react");
	let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
	let react_jsx_runtime = require("react/jsx-runtime");
	//#region src/client/trajectory-graph.ts
	/** Live records get order keys above every durable seq. */
	const LIVE_BASE = 1e9;
	function asRecord(value) {
		return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
	}
	function num(value) {
		return typeof value === "number" && Number.isFinite(value) ? value : void 0;
	}
	/** Read a token bucket from either the raw (`inputTokens`) or projected (`input`) shape. */
	function tokenBuckets(usage) {
		const record = asRecord(usage);
		if (record === null) return void 0;
		const pick = (...keys) => {
			for (const key of keys) {
				const value = num(record[key]);
				if (value !== void 0) return value;
			}
		};
		const buckets = {
			input: pick("input", "inputTokens", "promptTokens"),
			cacheRead: pick("cacheRead", "cacheReadTokens"),
			cacheWrite: pick("cacheWrite", "cacheWriteTokens"),
			output: pick("output", "outputTokens", "completionTokens"),
			reasoning: pick("reasoning", "reasoningTokens")
		};
		return Object.values(buckets).every((value) => value === void 0) ? void 0 : buckets;
	}
	/** Collapse content blocks to one whitespace-normalized line. */
	function contentText(content, limit) {
		if (content === void 0) return "";
		const parts = [];
		for (const block of content) if (typeof block.text === "string" && block.text !== "") parts.push(block.text);
		else if (typeof block.name === "string" && block.name !== "") parts.push(block.name);
		else if (typeof block.type === "string" && block.type !== "") parts.push(`[${block.type}]`);
		return squash(parts.join(" "), limit);
	}
	/** Collapse assistant blocks to one whitespace-normalized line (tool calls by name). */
	function blocksText(blocks, limit) {
		if (blocks === void 0) return "";
		const parts = [];
		for (const block of blocks) if (block.kind === "tool-call") parts.push(block.name ?? "tool");
		else if (typeof block.text === "string" && block.text !== "") parts.push(block.text);
		else if (typeof block.kind === "string" && block.kind !== "" && block.kind !== "text") parts.push(`[${block.kind}]`);
		return squash(parts.join(" "), limit);
	}
	/** One-line normalization: collapse whitespace and cut at `limit`. */
	function squash(text, limit) {
		const flat = text.replace(/\s+/g, " ").trim();
		return flat.length > limit ? `${flat.slice(0, Math.max(0, limit - 1))}…` : flat;
	}
	function firstLine(text, limit) {
		return typeof text === "string" ? squash(text, limit) : "";
	}
	/** The short tail a call id is displayed by. */
	function callTail(callId) {
		return callId.length > 10 ? callId.slice(-6) : callId;
	}
	/** Extract every `tool-call` block of an assistant record. */
	function toolCallBlocks(node) {
		const blocks = node.blocks;
		if (blocks === void 0) return [];
		const calls = [];
		for (const block of blocks) {
			if (block.kind !== "tool-call") continue;
			calls.push({
				callId: typeof block.callId === "string" ? block.callId : "",
				name: typeof block.name === "string" ? block.name : "tool",
				argsRaw: typeof block.argsRaw === "string" ? block.argsRaw : ""
			});
		}
		return calls;
	}
	/** Lane and kind of one durable ledger record. */
	function classifyEventNode(node) {
		switch (node.kind) {
			case "user": return {
				kind: "user",
				lane: "input"
			};
			case "steering": return {
				kind: "steering",
				lane: "input"
			};
			case "context": return {
				kind: "context",
				lane: "input"
			};
			case "command": return {
				kind: "command",
				lane: "input"
			};
			case "assistant": return {
				kind: "assistant",
				lane: "model"
			};
			case "tool-result": return {
				kind: "tool",
				lane: "tool"
			};
			case "compaction": return {
				kind: "compaction",
				lane: "model"
			};
			case "model-retry": return {
				kind: "retry",
				lane: "model"
			};
			case "turn-error": return {
				kind: "error",
				lane: "model"
			};
			case "turn-max-tokens": return {
				kind: "max-tokens",
				lane: "model"
			};
			default: return {
				kind: "unknown",
				lane: "model"
			};
		}
	}
	/** Chip label and inspector body of one durable ledger record. */
	function describeEventNode(node, kind) {
		switch (kind) {
			case "user": return {
				label: firstLine(contentText(node.content, 48), 48) || "user",
				detail: contentText(node.content, 4e3)
			};
			case "steering": return {
				label: firstLine(contentText(node.content, 48), 48) || "steering",
				detail: contentText(node.content, 4e3)
			};
			case "context": return {
				label: firstLine(node.provenance?.label ?? node.form ?? "context", 40),
				badge: node.provenance?.role,
				detail: contentText(node.content, 4e3)
			};
			case "command": return {
				label: `/${node.name ?? "command"}${node.args === null || node.args === void 0 ? "" : ` ${node.args}`}`.trim(),
				badge: node.outcome?.kind,
				detail: node.outcome?.text ?? ""
			};
			case "assistant": {
				const calls = toolCallBlocks(node);
				const text = blocksText(node.blocks, 52);
				return {
					label: text !== "" ? text : calls.length > 0 ? `${calls.length} tool call` : "assistant",
					badge: calls.length > 0 ? `${calls.length}×` : void 0,
					detail: blocksText(node.blocks, 4e3)
				};
			}
			case "tool": return {
				label: node.call?.name ?? node.callId ?? "tool",
				badge: node.isError === true ? "error" : callTail(node.callId ?? ""),
				detail: [node.call?.argsRaw ?? "", contentText(node.content, 4e3)].filter((part) => part !== "").join("\n")
			};
			case "compaction": {
				const shadowed = num(node.shadowedItemCount);
				return {
					label: firstLine(node.summary, 44) || "compaction",
					badge: shadowed === void 0 ? void 0 : `${shadowed}`,
					detail: node.summary ?? ""
				};
			}
			case "retry": return {
				label: node.retryState ?? "retry",
				badge: node.code,
				detail: node.message ?? ""
			};
			case "error": return {
				label: firstLine(node.message, 44) || "error",
				badge: node.code,
				detail: node.message ?? ""
			};
			case "max-tokens": return { label: "max tokens" };
			default: return {
				label: node.type ?? "event",
				detail: ""
			};
		}
	}
	/** Status of one durable ledger record. */
	function eventNodeStatus(node, kind) {
		switch (kind) {
			case "tool": return node.isError === true ? "error" : "complete";
			case "assistant": return node.interrupted === true ? "interrupted" : "complete";
			case "error":
			case "max-tokens": return "error";
			case "retry": return node.retryState === "started" ? "running" : "idle";
			default: return "idle";
		}
	}
	/**
	* Project one host trajectory snapshot into the graph model.
	* @param snapshot - host `TrajectorySnapshot` (structural mirror), or null.
	* @returns the graph; an absent/empty snapshot yields an empty graph.
	*/
	function buildTrajectoryGraph(snapshot) {
		if (snapshot === null || snapshot === void 0) return emptyGraph();
		const pending = [];
		/** callId → owning assistant record (turn/step source for tool records). */
		const callOwner = /* @__PURE__ */ new Map();
		/** Every node by its callId (settled results and live calls). */
		const callNodes = /* @__PURE__ */ new Map();
		const requests = [];
		for (const prompt of snapshot.systemPrompts ?? []) {
			const seq = num(prompt.seq);
			if (seq === void 0) continue;
			pending.push({
				node: {
					id: `sys:${seq}`,
					kind: "system",
					lane: "input",
					status: "idle",
					seq,
					time: num(prompt.time) ?? 0,
					turn: null,
					step: null,
					label: "system prompt",
					live: false
				},
				order: seq
			});
		}
		for (const record of snapshot.eventNodes ?? []) {
			const seq = num(record.seq);
			if (seq === void 0) continue;
			const { kind, lane } = classifyEventNode(record);
			const described = describeEventNode(record, kind);
			const status = eventNodeStatus(record, kind);
			const usage = tokenBuckets(record.usage);
			const timing = record.timing;
			const completed = num(timing?.completedTime);
			const started = num(timing?.stepStartTime);
			const node = {
				id: `ev:${record.kind ?? "unknown"}:${seq}`,
				kind,
				lane,
				status,
				seq,
				time: num(record.time) ?? 0,
				turn: num(record.turn) ?? null,
				step: num(record.step) ?? null,
				label: described.label,
				...described.badge === void 0 ? {} : { badge: described.badge },
				...described.detail === void 0 || described.detail === "" ? {} : { detail: described.detail },
				...usage === void 0 ? {} : { tokens: usage },
				...completed === void 0 || started === void 0 ? {} : { durationMs: Math.max(0, completed - started) },
				live: false,
				...kind === "user" ? { opensTurn: true } : {}
			};
			pending.push({
				node,
				order: seq
			});
			if (kind === "tool" && typeof record.callId === "string" && record.callId !== "") callNodes.set(record.callId, node.id);
			if (kind === "assistant") {
				const owner = {
					turn: node.turn,
					step: node.step
				};
				for (const call of toolCallBlocks(record)) if (call.callId !== "") callOwner.set(call.callId, owner);
			}
		}
		for (const view of snapshot.requests ?? []) {
			const startSeq = num(view.startSeq);
			if (startSeq === void 0) continue;
			const compaction = view.purpose === "compaction";
			const status = view.status === "running" ? "running" : view.status === "error" ? "error" : "complete";
			const startedAt = num(view.startedAt) ?? 0;
			const completedAt = num(view.completedAt);
			const usage = tokenBuckets(view.usage);
			const retry = num(view.retry);
			const seq = num(view.startSeq) ?? startSeq;
			const node = {
				id: compaction ? `creq:${startSeq}` : `req:${startSeq}`,
				kind: compaction ? "compact-request" : "request",
				lane: "model",
				status,
				seq,
				time: startedAt,
				turn: num(view.turn) ?? null,
				step: num(view.step) ?? (compaction ? 0 : null),
				label: compaction ? "compaction request" : "model request",
				badge: status === "running" ? "running" : retry === void 0 ? void 0 : `retry ${retry}`,
				...view.error === void 0 || view.error === "" ? {} : { detail: view.error },
				...usage === void 0 ? {} : { tokens: usage },
				durationMs: completedAt === void 0 ? null : Math.max(0, completedAt - startedAt),
				live: status === "running"
			};
			pending.push({
				node,
				order: startSeq
			});
			requests.push({
				node,
				view
			});
		}
		const liveNodes = [];
		const partial = snapshot.partial;
		if (partial !== null && partial !== void 0) {
			const turn = num(partial.turn) ?? null;
			const step = num(partial.step) ?? null;
			liveNodes.push({
				id: `partial:${turn ?? "-"}:${step ?? "-"}`,
				kind: "partial",
				lane: "model",
				status: "running",
				seq: LIVE_BASE,
				time: 0,
				turn,
				step,
				label: blocksText(partial.blocks, 52) || "streaming",
				badge: "live",
				live: true
			});
		}
		/** Flatten a call tree into live nodes (children keep their parent link). */
		const walkCalls = (call, parentId, count) => {
			const callId = typeof call.callId === "string" ? call.callId : "";
			const id = callId === "" ? `pending:${parentId ?? "root"}:${count}` : `call:${callId}`;
			const turn = num(call.turn) ?? null;
			const step = num(call.step) ?? null;
			liveNodes.push({
				id,
				kind: "running-call",
				lane: "tool",
				status: "running",
				seq: 1000001e3 + count,
				time: num(call.time) ?? 0,
				turn,
				step,
				label: call.name ?? "tool",
				badge: "live",
				...call.argsRaw === void 0 || call.argsRaw === "" ? {} : { detail: call.argsRaw },
				live: true
			});
			if (callId !== "") callNodes.set(callId, id);
			let next = count + 1;
			for (const child of call.subCalls ?? []) next = walkCalls(child, id, next);
			return next;
		};
		let liveCount = 0;
		for (const call of snapshot.runningCalls ?? []) liveCount = walkCalls(call, null, liveCount);
		for (const node of liveNodes) pending.push({
			node,
			order: node.seq
		});
		for (const record of snapshot.eventNodes ?? []) {
			if (record.kind !== "assistant") continue;
			const seq = num(record.seq);
			if (seq === void 0) continue;
			for (const call of toolCallBlocks(record)) {
				if (call.callId === "" || callNodes.has(call.callId)) continue;
				const id = `waiting:${call.callId}`;
				callNodes.set(call.callId, id);
				const owner = callOwner.get(call.callId);
				const node = {
					id,
					kind: "tool",
					lane: "tool",
					status: "idle",
					seq: seq + .5,
					time: num(record.time) ?? 0,
					turn: owner?.turn ?? null,
					step: owner?.step ?? null,
					label: call.name,
					badge: callTail(call.callId),
					...call.argsRaw === "" ? {} : { detail: call.argsRaw },
					live: false
				};
				pending.push({
					node,
					order: seq + .5
				});
			}
		}
		pending.sort((left, right) => left.order - right.order || left.node.id.localeCompare(right.node.id));
		const nodes = pending.map((entry) => entry.node);
		const byId = new Map(nodes.map((node) => [node.id, node]));
		const assistantRequests = requests.filter((entry) => entry.view.purpose !== "compaction").sort((left, right) => left.node.seq - right.node.seq);
		let lastTurn = null;
		let lastStep = null;
		for (const node of nodes) {
			if (node.kind === "request" || node.kind === "compact-request") {
				if (node.turn !== null) lastTurn = node.turn;
				lastStep = node.step;
				continue;
			}
			if (node.turn !== null && (node.kind === "assistant" || node.kind === "partial" || node.kind === "error" || node.kind === "max-tokens")) {
				lastTurn = node.turn;
				lastStep = node.step;
				continue;
			}
			if (node.kind === "user" || node.kind === "steering" || node.kind === "context" || node.kind === "command" || node.kind === "system") {
				const feeder = assistantRequests.find((entry) => entry.node.seq > node.seq);
				node.turn = feeder?.node.turn ?? lastTurn;
				node.step = feeder?.node.step ?? null;
				continue;
			}
			if (node.kind === "compaction") {
				const owner = requests.find((entry) => entry.view.purpose === "compaction" && num(entry.view.replacementSeq) === node.seq);
				node.turn = owner?.node.turn ?? null;
				node.step = owner?.node.step ?? null;
				continue;
			}
			node.turn = node.turn ?? lastTurn;
			node.step = node.step ?? lastStep;
		}
		const edges = [];
		const seen = /* @__PURE__ */ new Set();
		const link = (from, to, kind) => {
			if (from === to) return;
			const source = byId.get(from);
			const target = byId.get(to);
			if (source === void 0 || target === void 0) return;
			const id = `${kind}:${from}->${to}`;
			if (seen.has(id)) return;
			seen.add(id);
			edges.push({
				id,
				from,
				to,
				kind,
				live: false
			});
		};
		const consumed = /* @__PURE__ */ new Set();
		for (const entry of assistantRequests) {
			let feeder;
			for (const node of nodes) {
				if (node.seq >= entry.node.seq) break;
				if (consumed.has(node.id)) continue;
				if (node.kind === "user" || node.kind === "steering" || node.kind === "context" || node.kind === "system" || node.kind === "compaction") feeder = node;
			}
			if (feeder !== void 0) {
				consumed.add(feeder.id);
				link(feeder.id, entry.node.id, "prompt");
			}
		}
		const bySeq = /* @__PURE__ */ new Map();
		for (const node of nodes) if (!bySeq.has(node.seq)) bySeq.set(node.seq, node);
		for (const entry of requests) {
			const resultSeq = num(entry.view.resultSeq);
			const replacementSeq = num(entry.view.replacementSeq);
			const targetSeq = resultSeq ?? replacementSeq;
			if (targetSeq !== void 0) {
				const target = bySeq.get(targetSeq);
				if (target !== void 0) link(entry.node.id, target.id, "result");
				continue;
			}
			if (entry.node.status === "running") {
				const streaming = nodes.find((node) => node.kind === "partial" && node.turn === entry.node.turn && node.step === entry.node.step);
				if (streaming !== void 0) link(entry.node.id, streaming.id, "result");
			}
		}
		for (const record of snapshot.eventNodes ?? []) {
			if (record.kind !== "assistant") continue;
			const seq = num(record.seq);
			if (seq === void 0) continue;
			const from = `ev:assistant:${seq}`;
			for (const call of toolCallBlocks(record)) {
				const target = call.callId === "" ? void 0 : callNodes.get(call.callId);
				if (target !== void 0) link(from, target, "dispatch");
			}
		}
		const walkSubCalls = (parentId, call) => {
			const callId = typeof call.callId === "string" ? call.callId : "";
			const childId = callId === "" ? void 0 : callNodes.get(callId);
			if (childId !== void 0) link(parentId, childId, "subcall");
			for (const child of call.subCalls ?? []) walkSubCalls(childId ?? parentId, child);
		};
		for (const record of snapshot.eventNodes ?? []) {
			if (record.kind !== "tool-result") continue;
			const seq = num(record.seq);
			if (seq === void 0) continue;
			const from = `ev:tool-result:${seq}`;
			for (const child of record.subCalls ?? []) walkSubCalls(from, child);
		}
		const walkLiveChildren = (parentId, call) => {
			for (const child of call.subCalls ?? []) {
				const callId = typeof child.callId === "string" ? child.callId : "";
				const childId = callId === "" ? void 0 : callNodes.get(callId);
				if (childId !== void 0) link(parentId, childId, "subcall");
				walkLiveChildren(childId ?? parentId, child);
			}
		};
		for (const call of snapshot.runningCalls ?? []) {
			const callId = typeof call.callId === "string" ? call.callId : "";
			const id = callId === "" ? void 0 : callNodes.get(callId);
			if (id !== void 0) walkLiveChildren(id, call);
		}
		const toolNodes = nodes.filter((node) => node.lane === "tool");
		for (const tool of toolNodes) {
			const next = assistantRequests.find((entry) => entry.node.seq > tool.seq);
			if (next !== void 0) link(tool.id, next.node.id, "loop");
		}
		for (const marker of nodes.filter((node) => node.kind === "retry")) {
			const previous = [...assistantRequests].reverse().find((entry) => entry.node.seq < marker.seq);
			if (previous !== void 0) link(previous.node.id, marker.id, "result");
			const retry = assistantRequests.find((entry) => entry.node.seq > marker.seq && entry.node.turn === marker.turn);
			if (retry !== void 0) link(marker.id, retry.node.id, "prompt");
		}
		for (const marker of nodes.filter((node) => node.kind === "error" || node.kind === "max-tokens")) {
			const previous = [...assistantRequests].reverse().find((entry) => entry.node.seq < marker.seq && (marker.turn === null || entry.node.turn === marker.turn));
			if (previous !== void 0) link(previous.node.id, marker.id, "result");
		}
		const liveIds = new Set(nodes.filter((node) => node.live).map((node) => node.id));
		const liveEdges = edges.map((edge) => liveIds.has(edge.to) ? {
			...edge,
			live: true
		} : edge);
		return {
			nodes,
			edges: liveEdges,
			timeline: buildTimeline(nodes, liveEdges),
			stats: buildStats(nodes, liveEdges),
			live: liveIds.size > 0
		};
	}
	/** Order the ledger for replay: each record with the edge that delivered it. */
	function buildTimeline(nodes, edges) {
		const incoming = /* @__PURE__ */ new Map();
		const priority = {
			prompt: 0,
			result: 1,
			dispatch: 2,
			subcall: 3,
			loop: 4
		};
		for (const edge of edges) {
			const current = incoming.get(edge.to);
			if (current === void 0 || priority[edge.kind] < priority[current.kind]) incoming.set(edge.to, edge);
		}
		return nodes.map((node) => ({
			nodeId: node.id,
			edgeId: incoming.get(node.id)?.id ?? null,
			at: node.time
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
			if (node.turn !== null && node.turn > turns) turns = node.turn;
			if (node.lane === "tool") tools++;
			if (node.live || node.status === "running") running++;
			if (node.status === "error") errors++;
			if (node.tokens !== void 0) for (const key of [
				"input",
				"cacheRead",
				"cacheWrite",
				"output",
				"reasoning"
			]) {
				const value = node.tokens[key];
				if (value !== void 0) tokens[key] = (tokens[key] ?? 0) + value;
			}
		}
		return {
			nodes: nodes.length,
			edges: edges.length,
			turns,
			tools,
			running,
			errors,
			tokens
		};
	}
	function emptyGraph() {
		return {
			nodes: [],
			edges: [],
			timeline: [],
			stats: {
				nodes: 0,
				edges: 0,
				turns: 0,
				tools: 0,
				running: 0,
				errors: 0,
				tokens: {}
			},
			live: false
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
	function windowTrajectoryGraph(graph, limit) {
		if (limit <= 0) return {
			graph: emptyGraph(),
			hidden: graph.nodes.length
		};
		if (graph.nodes.length <= limit) return {
			graph,
			hidden: 0
		};
		const dropped = graph.nodes.length - limit;
		const kept = graph.nodes.slice(dropped);
		const keptIds = new Set(kept.map((node) => node.id));
		const edges = graph.edges.filter((edge) => keptIds.has(edge.from) && keptIds.has(edge.to));
		return {
			graph: {
				nodes: kept,
				edges,
				timeline: graph.timeline.slice(dropped),
				stats: buildStats(kept, edges),
				live: graph.live
			},
			hidden: dropped
		};
	}
	//#endregion
	//#region src/client/trajectory-layout.ts
	/** The three-lane geometry, tuned for a ~360px-wide side card, no cross-lane overlap. */
	const LANES = {
		input: {
			cx: 62,
			w: 108
		},
		model: {
			cx: 186,
			w: 140
		},
		tool: {
			cx: 310,
			w: 108
		}
	};
	const DEFAULTS = {
		width: 372,
		rowHeight: 44,
		nodeHeight: 30,
		bandHeight: 22,
		padding: 10
	};
	function clamp$1(value, min, max) {
		return value < min ? min : value > max ? max : value;
	}
	/** Full-width CJK/fullwidth ranges count as two latin columns. */
	const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;
	/**
	* Cut a chip label to the width the chip can actually draw.
	*
	* SVG has no text-overflow, and a `<text>` that overflows its chip bleeds into
	* the neighbouring lane. Counting CJK glyphs as two latin columns keeps both
	* scripts inside the box.
	* @param text - the label.
	* @param maxWidth - available width in user units.
	* @param fontSize - the chip's font size.
	* @returns the label, ellipsized when it does not fit.
	*/
	function ellipsize(text, maxWidth, fontSize) {
		const column = fontSize * .56;
		let used = 0;
		let out = "";
		for (const char of text) {
			const width = WIDE.test(char) ? column * 1.75 : column;
			if (used + width > maxWidth) return `${out}…`;
			out += char;
			used += width;
		}
		return out;
	}
	/** Evaluate a cubic bezier component at `t`. */
	function cubic(p0, p1, p2, p3, t) {
		const u = 1 - t;
		return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
	}
	/** Nested sub-calls step right inside the tool lane so ownership reads at a glance. */
	function laneOffset(kind, depth) {
		if (kind === "running-call" || kind === "tool") return {
			dx: depth * 10,
			shrink: depth * 12
		};
		return {
			dx: 0,
			shrink: 0
		};
	}
	/** Tool ownership depth: a call whose own id pattern marks it as a child is nested. */
	function subcallDepths(graph) {
		const parentOf = /* @__PURE__ */ new Map();
		for (const edge of graph.edges) if (edge.kind === "subcall") parentOf.set(edge.to, edge.from);
		const depths = /* @__PURE__ */ new Map();
		const depthOf = (id, guard) => {
			const cached = depths.get(id);
			if (cached !== void 0) return cached;
			if (guard.has(id)) return 0;
			const parent = parentOf.get(id);
			if (parent === void 0) {
				depths.set(id, 0);
				return 0;
			}
			guard.add(id);
			const depth = Math.min(depthOf(parent, guard) + 1, 3);
			depths.set(id, depth);
			return depth;
		};
		for (const node of graph.nodes) depthOf(node.id, /* @__PURE__ */ new Set());
		return depths;
	}
	/**
	* Lay out one graph projection.
	* @param graph - the graph model (already windowed by the caller).
	* @param options - geometry overrides (tests pin the defaults).
	* @returns positioned nodes, routed edges, and turn bands.
	*/
	function layoutTrajectoryGraph(graph, options = {}) {
		const width = options.width ?? DEFAULTS.width;
		const rowHeight = options.rowHeight ?? DEFAULTS.rowHeight;
		const nodeHeight = options.nodeHeight ?? DEFAULTS.nodeHeight;
		const bandHeight = options.bandHeight ?? DEFAULTS.bandHeight;
		const padding = options.padding ?? DEFAULTS.padding;
		const nodes = [];
		const bands = [];
		const byId = /* @__PURE__ */ new Map();
		const depths = subcallDepths(graph);
		let cursor = padding;
		let bandStart = 0;
		let bandTurn;
		let bandTop = padding;
		for (const [index, node] of graph.nodes.entries()) {
			if (bandTurn === void 0 || node.turn !== bandTurn) {
				if (bandTurn !== void 0) bands.push({
					turn: bandTurn,
					y: bandTop,
					height: cursor - bandTop,
					from: bandStart,
					to: index
				});
				bandTurn = node.turn;
				bandStart = index;
				bandTop = cursor;
				if (node.turn !== null) cursor += bandHeight;
			}
			const lane = LANES[node.lane];
			const depth = depths.get(node.id) ?? 0;
			const { dx, shrink } = laneOffset(node.kind, depth);
			const w = lane.w - shrink;
			const h = nodeHeight;
			const cx = lane.cx + dx;
			const x = cx - w / 2;
			const y = cursor + (rowHeight - h) / 2;
			const laid = {
				id: node.id,
				kind: node.kind,
				lane: node.lane,
				status: node.status,
				live: node.live,
				x,
				y,
				w,
				h,
				cx,
				cy: y + h / 2,
				depth,
				index
			};
			nodes.push(laid);
			byId.set(node.id, laid);
			cursor += rowHeight;
		}
		if (bandTurn !== void 0) bands.push({
			turn: bandTurn,
			y: bandTop,
			height: cursor - bandTop,
			from: bandStart,
			to: nodes.length
		});
		const edges = [];
		for (const edge of graph.edges) {
			const from = byId.get(edge.from);
			const to = byId.get(edge.to);
			if (from === void 0 || to === void 0) continue;
			const x1 = from.cx;
			const y1 = from.y + from.h;
			const x2 = to.cx;
			const y2 = to.y;
			const dy = y2 - y1;
			const dx = x2 - x1;
			let d;
			if (dy <= 4) {
				const rail = Math.max(from.x + from.w + 14, 8);
				d = `M ${x1} ${y1} C ${rail} ${y1 + 24}, ${rail} ${y2 - 24}, ${x2} ${y2}`;
			} else if (Math.abs(dx) < 2) d = `M ${x1} ${y1} C ${x1} ${y1 + dy * .4}, ${x2} ${y2 - dy * .4}, ${x2} ${y2}`;
			else {
				const k = clamp$1(dy * .45, 10, 64);
				if (edge.kind === "loop") {
					const rail = 26;
					d = `M ${x1} ${y1} C ${x1 + rail} ${y1 + k}, ${x2 + rail * 1.4} ${y2 - k}, ${x2} ${y2}`;
				} else d = `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`;
			}
			const control = controlPointsOf(d);
			const midX = control === null ? (x1 + x2) / 2 : cubic(control[0], control[2], control[4], control[6], .5);
			const midY = control === null ? (y1 + y2) / 2 : cubic(control[1], control[3], control[5], control[7], .5);
			edges.push({
				id: edge.id,
				kind: edge.kind,
				live: edge.live,
				from: edge.from,
				to: edge.to,
				d,
				x1,
				y1,
				x2,
				y2,
				midX,
				midY
			});
		}
		return {
			width,
			height: cursor + padding,
			nodes,
			edges,
			bands
		};
	}
	/**
	* Read the eight cubic ordinates back out of a path built by this module.
	* @param d - path data in the exact `M x y C …` shape this module emits.
	* @returns `[x0,y0,c1x,c1y,c2x,c2y,x1,y1]`, or null for another shape.
	*/
	function controlPointsOf(d) {
		const numbers = d.match(/-?\d+(?:\.\d+)?/g);
		if (numbers === null || numbers.length !== 8) return null;
		const parsed = numbers.map(Number);
		return [
			parsed[0],
			parsed[1],
			parsed[2],
			parsed[3],
			parsed[4],
			parsed[5],
			parsed[6],
			parsed[7]
		];
	}
	//#endregion
	//#region src/client/trajectory-source.ts
	/**
	* Probe the host trajectory target for one session.
	* @param ctx - plugin context (any `get`-capable context).
	* @param sessionId - the session whose ledger should be followed.
	* @returns an observable source, or null when the host face is unavailable.
	*/
	function resolveTrajectorySource(ctx, sessionId) {
		const ui = ctx.get("uiConversation");
		if (ui === null || ui === void 0 || typeof ui.binding !== "function") return null;
		let bound;
		try {
			bound = ui.binding(sessionId);
		} catch {
			return null;
		}
		const binding = bound;
		if (binding === null || binding === void 0 || typeof binding.target !== "function") return null;
		let resolved;
		try {
			resolved = binding.target("trajectory");
		} catch {
			return null;
		}
		const target = resolved;
		if (target === null || target === void 0) return null;
		if (typeof target.getSnapshot !== "function" || typeof target.subscribe !== "function") return null;
		const read = target.getSnapshot.bind(target);
		const listen = target.subscribe.bind(target);
		return {
			getSnapshot: () => {
				try {
					return read() ?? null;
				} catch {
					return null;
				}
			},
			subscribe: (listener) => {
				try {
					const disposer = listen(listener);
					return typeof disposer === "function" ? disposer : () => {};
				} catch {
					return () => {};
				}
			}
		};
	}
	//#endregion
	//#region src/client/locales.ts
	/**
	* Minimal zh/en/ja copy for the sidebar. The copy follows the DSH i18n system:
	* the client apply attaches the locale service (`ctx.locale`, provided by
	* `@deepseek-ai/dsh-client-locale`) through {@link attachLocale}, and
	* `t()`/`isZh()` resolve the active locale from it — the Host-backed
	* `locale.preference` wins over the raw browser language and switches live.
	* Without an attached service (standalone/test compositions) the browser
	* language is used, matching the previous behavior. The dictionaries are
	* also registered into the DSH locale registry under {@link LOCALE_NS}.
	*
	* ja (Japanese) is opt-in through `@huanlin/dsh-plugin-better-locale`: when
	* that plugin is installed, the client apply also calls
	* {@link attachBetterLocale} with the override store. `t()` then consults
	* the store's active override id first; if it is `'ja'` (or any id whose
	* dict has the requested key) the ja text wins, otherwise the existing
	* zh/en chain runs unchanged. better-locale itself patches
	* `LocaleRuntime.prototype.lookup` so DSH's own translate chain also
	* returns ja where the `betterSidebar` namespace has a ja entry — that
	* path covers external callers of `ctx.locale.bind('betterSidebar')`,
	* while the override-aware `t()` here covers dsh-coding-sidebar's own
	* components (which bypass `ctx.locale` and call `t()` directly).
	*/
	/** The zh dictionary (also registered into the DSH locale registry under {@link LOCALE_NS}). */
	const zh = {
		files: "文件",
		explorer: "资源管理器",
		git: "源代码管理",
		terminal: "终端",
		editor: "编辑器",
		editorExplorer: "文件打开方式",
		editorExplorerDesc: "控制文件打开方式",
		editorExplorerMerged: "合并",
		editorExplorerMergedDesc: "文件在同一窗口内原地切换；新窗口默认展开文件树",
		editorExplorerSplit: "独立",
		editorExplorerSplitDesc: "无路径窗口即资源管理器（仅文件树）；文件各自新开窗口（带文件树，默认收起）",
		editorTreeToggle: "文件树面板",
		editorPathPlaceholder: "输入文件路径（相对会话目录或绝对路径），Enter 打开",
		editorSearchPlaceholder: "按文件名搜索…",
		editorSearchNoResults: "无匹配文件",
		editorSearchTruncated: "结果过多，仅显示部分匹配",
		editorEmptyHint: "从右侧文件树或上方路径输入框选择文件开始预览",
		openFileNewTab: "在新 Tab 中打开",
		openFileSide: "在侧边打开",
		openWithMenu: "在应用中打开",
		openWithSshSuffix: " (SSH)",
		pinOpenWith: "固定到菜单",
		unpinOpenWith: "取消固定",
		openWithExplorer: "资源管理器",
		openWithVscode: "VS Code",
		openWithCursor: "Cursor",
		openWithZed: "Zed",
		openWithSettingsSshTitle: "SSH 远端主机",
		openWithSettingsSshDesc: "留空为本地工作区；填入 user@host 或 SSH 别名后，VSCode 系打开方式将改用 vscode-remote/ssh-remote 协议，资源管理器 / Zed / 非 VSCode 系自定义编辑器将从菜单隐藏",
		openWithSettingsSshPlaceholder: "user@host 或 SSH 别名",
		openWithSettingsCustomTitle: "自定义编辑器",
		openWithSettingsCustomDesc: "名称 + URL 模板（{path} 占位符）+ 是否 VSCode 系；SSH 模式下仅 VSCode 系可打开远端",
		openWithSettingsAdd: "添加",
		openWithSettingsName: "名称",
		openWithSettingsTemplate: "如 cursor://file/{path}",
		openWithSettingsFamily: "VSCode 系",
		openWithSettingsFamilyDesc: "该编辑器使用 VSCode 的 URL 协议（支持 SSH 远端打开）",
		openWithSettingsRemove: "删除",
		openWithSettingsInvalidHint: "名称或模板（需含 {path} 且以 scheme:// 开头）未填写的编辑器不会出现在菜单中",
		newTab: "新建标签页",
		openExplorer: "资源管理器",
		brokenSymlink: "失效的软链接",
		openGit: "Git 面板",
		newTerminal: "新终端",
		terminalLimit: "终端数量已达上限 (3)",
		close: "关闭",
		closeOtherTabs: "关闭其他页签",
		closeLeftTabs: "关闭左侧页签",
		closeRightTabs: "关闭右侧页签",
		moveToFreeWindow: "移动到自由窗口",
		floatDropHint: "松开以在自由窗口中打开",
		dockToSidebar: "回到侧边栏",
		pinTerminal: "固定终端",
		pinAgentTerminal: "固定 Agent 终端",
		pinToWorkspace: "固定到工作区",
		pinToGlobal: "固定到全局",
		unpinTerminal: "取消固定",
		pinnedTerminalTooltip: "{kind} · {scope} · {cwd}",
		pinnedTerminalKindUi: "UI 终端",
		pinnedTerminalKindAgent: "Agent 终端",
		pinnedTerminalScopeWorkspace: "固定到工作区",
		pinnedTerminalScopeGlobal: "固定到全局",
		pinnedRailLabel: "固定终端",
		closePinnedTerminal: "关闭终端",
		collapse: "折叠侧边栏",
		expand: "展开侧边栏",
		terminalError: "终端连接失败",
		terminalConnectFailed: "终端多次连接失败",
		terminalRetry: "重试",
		terminalDepsFailed: "终端依赖 node-pty 加载失败",
		terminalDepsHint: "在 DSH 所在环境的终端或 cmd 中执行以下命令修复，然后点重试（node-pty 与 DSH 核心保持同一版本）：",
		terminalDepsProfile: "（检测到 profile：{profile}）",
		terminalShellNotFound: "未找到配置的 Shell：{name}，请到 设置 → 侧边卡片 → 终端 检查 Shell 路径",
		preview: "预览",
		toc: "目录",
		edit: "编辑",
		mermaidError: "Mermaid 渲染失败",
		mermaidZoomIn: "放大",
		mermaidZoomOut: "缩小",
		mermaidZoomReset: "重置",
		mermaidZoomHint: "滚轮缩放 · 拖拽平移 · Esc 关闭",
		refresh: "刷新",
		refreshUnsavedConfirm: "文件已在磁盘更新，刷新将丢弃未保存编辑。继续吗？",
		save: "保存",
		saved: "已保存",
		unsaved: "未保存",
		saveFailed: "保存失败",
		truncation: "文件过大，仅显示前 512KB",
		binary: "二进制文件，无法预览",
		loading: "加载中…",
		error: "加载失败",
		retry: "重试",
		splitLeft: "向左分栏",
		splitRight: "向右分栏",
		splitUp: "向上分栏",
		splitDown: "向下分栏",
		notRepo: "当前目录不是 git 仓库",
		noChanges: "没有变更",
		statusTruncated: "变更过多，仅显示前 2000 条",
		stage: "暂存",
		unstage: "取消暂存",
		stageAll: "全部暂存",
		unstageAll: "全部取消暂存",
		commitPlaceholder: "提交信息 (Ctrl+Enter)",
		commit: "提交",
		commitError: "提交失败",
		branch: "分支",
		worktree: "工作树",
		checkoutError: "切换分支失败",
		history: "历史",
		changes: "变更",
		staged: "已暂存",
		unstaged: "未暂存",
		cancel: "取消",
		diffEmpty: "没有文本差异",
		diffLoadError: "加载差异失败",
		diffBinary: "二进制",
		diffAdded: "新增",
		diffDeleted: "删除",
		diffRenamed: "重命名",
		diffExpand: "展开其余 {count} 行",
		diffCollapse: "收起",
		discard: "放弃更改",
		discardTitle: "放弃更改",
		discardDesc: "将丢弃「{path}」的工作区修改（不可恢复）。",
		viewCommitDiff: "查看提交差异",
		copyShortHash: "复制短哈希",
		copyFullHash: "复制完整哈希",
		copySubject: "复制提交信息",
		revertCommit: "还原此提交",
		revertTitle: "还原此提交",
		revertDesc: "将在当前分支创建一个反转「{subject}」的新提交。",
		cherryPickCommit: "捡取此提交",
		cherryPickTitle: "捡取此提交",
		cherryPickDesc: "将「{subject}」的更改应用到当前分支。",
		timeJustNow: "刚刚",
		timeMinutesAgo: "{n} 分钟前",
		timeHoursAgo: "{n} 小时前",
		timeYesterday: "昨天",
		loadMore: "加载更多",
		historyLoadError: "加载更多历史失败",
		produced: "本次产出",
		producedOpen: "在侧边栏中打开",
		showInFolder: "在文件夹中显示",
		disconnected: "终端连接断开，重连中…",
		terminalWaitBanner: "Agent 正在等待 {needle}",
		terminalSkipWait: "跳过等待",
		gitFoldExpand: "展开 {count} 行上下文",
		gitFoldLoading: "展开中…",
		gitFoldFailed: "展开失败",
		rename: "重命名",
		renameInvalid: "名称不能为空，且不能包含路径分隔符。",
		delete: "删除",
		deleteTitle: "删除「{name}」？",
		deleteDescFile: "将永久删除该文件，此操作不可撤销。",
		deleteDescDir: "将永久删除该目录及其全部内容，此操作不可撤销。",
		dismiss: "关闭",
		changesSessionGit: "Git 变动",
		changesSessionLens: "会话变动",
		changesEmpty: "本会话尚无文件操作",
		changesCount: "{count} 个文件操作",
		changesRedacted: "[已脱敏]",
		changesBinary: "二进制文件，无法预览",
		changesPreviewError: "预览读取失败：{message}",
		changesLens: "视角",
		exited: "终端进程已退出",
		noSession: "选择一个会话以使用侧边栏",
		pluginNotLoaded: "插件未加载，标签页暂不可用：",
		hiddenFiles: "隐藏文件",
		parent: "上级目录",
		copied: "已复制",
		copy: "复制",
		newFile: "新文件",
		openEditor: "打开编辑器",
		gitDetail: "查看变更详情",
		referenceFile: "@文件",
		addToConversation: "添加到对话",
		copyRelative: "复制相对地址",
		copyAbsolute: "复制绝对地址",
		download: "下载",
		uploadFiles: "上传文件",
		uploadFolder: "上传文件夹",
		uploadHere: "上传到此处",
		uploadDropHint: "拖拽文件/文件夹到此处上传",
		uploadDropChat: "拖放到聊天区：添加图片到对话",
		uploadTo: "上传到 {dir}",
		uploadingTo: "正在上传到 {dir}…",
		uploadProgress: "正在上传 {done}/{total}: {name}",
		uploadDone: "已上传 {count} 个文件",
		uploadFailed: "上传失败：{error}",
		uploadFailedUnknown: "未知错误",
		uploadTooLarge: "文件过大，超出上传上限",
		uploadCancelled: "上传已取消",
		settingsNav: "侧边卡片",
		settingsIntro: "管理侧边卡片的显示内容与默认行为",
		settingsPopupDesc: "为「{feature}」配置相关选项",
		settingsDone: "完成",
		settingsOpenTitle: "新会话默认打开",
		settingsOpenDesc: "新建会话时自动展开侧边卡片；已存在的会话保持各自布局",
		settingsWidthTitle: "默认宽度占比",
		settingsWidthDesc: "新建会话时侧边卡片占窗口宽度的百分比 (20–60)",
		settingsWidthSuffix: "%",
		settingsOpenPathTitle: "聊天区文件在侧边栏打开",
		settingsOpenPathDesc: "在聊天里点击文件链接（工具行、产物列表、文件提及）时，在侧边栏编辑器中打开，不再调用系统默认应用",
		settingsOpenToolsTitle: "为模型注入侧边栏打开工具",
		settingsOpenToolsDesc: "开启后，模型可通过 sidebar_open 工具在侧边栏主动打开文件、文件夹和 HTTP(S) 网页（默认关闭）",
		settingsTitleBarTitle: "位置兼容模式",
		settingsTitleBarDesc: "选择顶栏兼容方案：自动检测（默认，保守）/ DSH官方Web / 已知桌面壳 / 自定义方案（下移距离 + 自定义 CSS）",
		settingsTitleBarStripTitle: "下移距离",
		settingsTitleBarStripDesc: "标题栏条带高度：侧边栏按钮与内容下移的像素数（0–120，默认 40；自定义方案下生效）",
		settingsSchemeAutoTitle: "自动检测",
		settingsSchemeAutoDesc: "保守方案：仅在 Window Controls Overlay 标准 API 可用时按真实标题栏高度让位；网页环境下不做任何修改",
		settingsSchemeWebTitle: "DSH官方Web",
		settingsSchemeWebDesc: "显式声明运行在官方网页版：不做任何适配（连标准 WCO 几何也不适用）",
		settingsSchemeCustomTitle: "自定义方案",
		settingsSchemeCustomDesc: "完全由你控制：注入自定义 CSS（可覆盖内置样式），并指定标题栏下移距离",
		settingsSchemeDetectedSuffix: "已检测",
		settingsCustomCssTitle: "自定义 CSS",
		settingsCustomCssDesc: "追加到页面末尾的样式（同优先级下后写胜出；覆盖 JS 内联变量需用 !important）",
		settingsCustomCssPlaceholder: "/* 例：为自绘标题栏的壳预留 36px */\nhtml[data-dsh-title-bar-height=\"36\"] {\n  --dsh-title-bar-strip: 36px !important;\n}",
		settingsSaveFailed: "保存失败",
		settingsConflict: "设置已被其他窗口修改，请重试",
		binaryNoPreview: "此文件类型不支持预览",
		downloadToView: "下载查看",
		settingsSubagentTitle: "检测到子代理时自动激活任务管理页",
		settingsSubagentDesc: "当前会话产生新的子代理时，自动激活任务管理页；宽屏同时展开侧边栏，窄屏不强制展开全屏抽屉；关闭后需手动打开",
		settingsJobsTitle: "有新后台任务时自动激活后台任务页",
		settingsJobsDesc: "当前会话出现新的后台任务时，自动激活后台任务页（每个新任务都会触发）；宽屏同时展开侧边栏，窄屏不强制展开全屏抽屉；关闭后需手动打开",
		settingsToolsTitle: "为模型注入终端工具",
		settingsToolsDesc: "开启后，模型可通过 terminal_create 等 8 个工具创建并操作侧边栏终端（默认关闭）",
		settingsFontFamilyTitle: "终端字体",
		settingsFontFamilyDesc: "自定义终端字体族（CSS font-family，如 \"JetBrains Mono\", monospace；留空跟随主题等宽字体）",
		settingsFontFamilyPlaceholder: "\"JetBrains Mono\", monospace",
		settingsFontSizeTitle: "终端字号",
		settingsFontSizeDesc: "终端字号（9–32，默认 13）",
		settingsFontSizeSuffix: "px",
		settingsShellTitle: "Shell 路径",
		settingsShellDesc: "UI 与模型终端启动的 shell（绝对路径或可执行名）。留空按既有顺序解析：yaml 的 config.shell → $SHELL / 登录 shell / Windows 的 powershell.exe。对之后打开的终端生效",
		settingsShellPlaceholder: "如 /bin/zsh（留空自动解析）",
		settingsShellArgsTitle: "Shell 参数",
		settingsShellArgsDesc: "显式 shell 启动参数，空格分隔；非空时完全替换默认参数（与 yaml 的 shellArgs 契约一致）",
		settingsShellArgsPlaceholder: "如 -l（留空用默认参数）",
		settingsTabsTitle: "侧边栏内容",
		settingsViewersTitle: "文件预览",
		settingsGeneralTitle: "常规",
		settingsPopup: "功能设置",
		settingsViewerCatchAll: "兜底：任意文件",
		viewerImage: "图片",
		viewerPdf: "PDF",
		viewerMarkdown: "Markdown",
		viewerCode: "代码",
		viewerBinary: "二进制下载",
		viewerDocx: "Word 文档",
		viewerXlsx: "Excel 表格",
		viewerPptx: "PPT 演示",
		viewerVideo: "视频",
		previousSlide: "上一页",
		nextSlide: "下一页",
		zoom: "缩放",
		zoomHint: "Alt + 滚轮",
		videoUnsupported: "该格式无法在浏览器内播放，可下载后用本地播放器打开",
		viewerHtml: "HTML",
		browser: "浏览器",
		browserPlaceholder: "输入网址，例如 example.com",
		browserGo: "前往",
		browserBack: "后退",
		browserForward: "前进",
		browserStart: "输入网址开始浏览（沙箱模式）",
		browserLive: "Agent 实况",
		browserLiveFree: "自由浏览",
		browserLiveConnecting: "连接 agent 浏览器宿主…",
		browserLiveDown: "宿主不可达：确认 KCoder 已启动（端口 9223）",
		browserLiveTargetNone: "暂无打开的页面——agent 发起浏览后此处实时显示",
		browserLiveFollowLatest: "跟随最新页面",
		browserBlockedScheme: "已阻止：仅支持 http/https 链接",
		browserBlockedLoopback: "已阻止：不允许在浏览器中访问本机或内部地址",
		browserInvalid: "无效的网址",
		browserNoSandboxWarning: "沙箱已关闭：当前页面与界面同源，拥有完整会话权限（可在设置中恢复）",
		htmlNoSandboxWarning: "沙箱已关闭：此 HTML 与界面同源，可读取会话文件与内部接口（可在设置中恢复）",
		sandboxStatusOn: "沙箱模式：已启用 · 页面无法访问界面数据与本地文件，登录态与第三方 Cookie 可能不可用",
		sandboxUnlock: "临时解锁（不安全）",
		sandboxRestore: "恢复沙箱",
		settingsHtmlDefaultUnsafeTitle: "HTML 预览默认以非沙箱模式打开（不安全）",
		settingsHtmlDefaultUnsafeDesc: "开启后，每次打开 HTML 文件时预览默认处于非沙箱状态（与界面同源，可读取会话文件与内部接口）；可在状态行临时恢复沙箱",
		settingsHtmlSandboxTitle: "关闭 HTML 预览沙箱（不安全）",
		settingsHtmlSandboxDesc: "关闭后，预览的 HTML 将与界面同源运行，可读取会话文件、本地存储并调用内部接口。仅对完全可信的文件开启",
		settingsBrowserSandboxTitle: "关闭浏览器沙箱（不安全）",
		settingsBrowserSandboxDesc: "关闭后，访问的任何网站都将与界面同源运行，可读取会话数据并冒充你的登录状态。仅对完全可信的站点开启",
		settingsBrowserLinksTitle: "聊天区外链在侧边栏打开",
		settingsBrowserLinksDesc: "开启后，点击聊天或界面中的外链时在侧边栏打开，不再弹出新窗口；HTTP 与 HTTPS 可分别通过下方开关控制；Ctrl/Cmd 点击可临时放行",
		settingsBrowserHttpTitle: "侧边打开HTTP网页",
		settingsBrowserHttpDesc: "开启后，点击聊天或界面中的 HTTP 外链时在侧边栏打开（声明了 urlTarget 的插件页面优先）；Ctrl/Cmd 点击可临时放行",
		settingsBrowserHttpsTitle: "侧边打开HTTPS网页",
		settingsBrowserHttpsDesc: "开启后，点击聊天或界面中的 HTTPS 外链时在侧边栏打开。默认关闭：多数 HTTPS 站点拒绝被嵌入，走系统浏览器更顺畅",
		settingsBrowserLoopbackTitle: "允许访问的本机地址",
		settingsBrowserLoopbackDesc: "逗号分隔的本地回环地址白名单（如 localhost:5174 或 127.0.0.1:8080），侧边栏浏览器可访问这些本地服务；默认留空则本机地址全部拦截。沙箱隔离仍然生效，页面无法读取界面数据",
		settingsBrowserLoopbackPlaceholder: "例如 localhost:5174, 127.0.0.1:8080",
		browserOpenExternal: "在浏览器中打开",
		browserEmbedBlocked: "{host} 拒绝了嵌入请求",
		browserEmbedBlockedDesc: "该站点通过 X-Frame-Options / frame-ancestors 禁止在其它页面中显示，无法在侧边栏内加载。可在浏览器中直接打开",
		browserEmbedAnyway: "仍然加载",
		subagent: "任务管理",
		openSubagent: "任务管理",
		subagentMainAgent: "主代理",
		subagentEmpty: "暂无子代理",
		subagentEmptyDesc: "当前主代理派生的子代理将显示在这里",
		subagentRunning: "运行中",
		subagentInactive: "空闲",
		subagentModeOneShot: "一次性",
		subagentModeContinuable: "可续接",
		subagentCount: "{count} 个子代理",
		subagentCountRunning: "{count} 个子代理 · {running} 运行中",
		subagentDiagCorrupt: "目录损坏",
		subagentDiagUnsupported: "不支持的条目",
		subagentDiagUnavailable: "不可用",
		subagentThinking: "思考中…",
		subagentShowHistory: "展开更早的 {count} 个子代理",
		subagentHideHistory: "收起更早的子代理",
		sideChat: "侧边对话(beta)",
		sideChatNew: "新建对话",
		sideChatUntitled: "新对话",
		sideChatEmpty: "暂无侧边对话",
		sideChatEmptyDesc: "每个侧边对话是标签栏里的独立 Tab，继承当前会话的上下文运行，不会进入主会话",
		sideChatCreating: "正在创建侧边对话…",
		sideChatRetry: "重试",
		sideChatThreads: "切换线程 / 新建",
		sideChatSave: "保存为新会话",
		sideChatSaveTitle: "把该线程提升为顶层会话，出现在主会话列表中",
		sideChatSaved: "已保存为新会话",
		sideChatNoTurn: "至少完成一轮对话后才能保存",
		sideChatPendingDrop: "最后一条未完成的追问不会包含在新会话中",
		sideChatFirstPlaceholder: "输入第一个问题，已继承当前会话上下文…",
		sideChatComposerPlaceholder: "追问…",
		sideChatThinking: "正在深入…",
		sideChatThink: "思考过程",
		sideChatInjection: "已注入上下文",
		sideChatSend: "发送",
		sideChatCancel: "停止",
		sideChatCancelTitle: "中止当前回合（保留队列）",
		sideChatClose: "关闭线程",
		sideChatCloseTitle: "释放线程的 agent（历史保留）",
		sideChatError: "侧边对话出错：{message}",
		jobs: "后台任务",
		jobsCount: "{count} 个后台任务",
		jobsCountRunning: "{count} 个后台任务 · {running} 运行中",
		jobsShowHistory: "展开更早的 {count} 个后台任务",
		jobsHideHistory: "收起更早的后台任务",
		jobStatusRunning: "运行中",
		jobStatusStopping: "终止中",
		jobStatusCompleted: "已完成",
		jobStatusKilled: "已终止",
		jobStatusFailed: "失败",
		jobDurationSeconds: "{seconds} 秒",
		jobDurationMinutes: "{minutes} 分 {seconds} 秒",
		jobDurationHours: "{hours} 小时 {minutes} 分",
		jobViewOutput: "查看输出",
		jobHideOutput: "收起输出",
		jobNoOutput: "暂无输出",
		jobNotReadYet: "等待模型读取该任务的输出（模型执行 job_output 后，输出会显示在这里）",
		jobOutputTruncated: "输出过长，已截断显示",
		jobOutputError: "输出读取失败",
		jobKill: "终止",
		jobKillConfirm: "再次点击确认终止",
		jobKillError: "终止失败",
		addPluginsTabCard: "添加 Tab 插件",
		addPluginsTabCardDesc: "注册新的侧边栏页面",
		addPluginsViewerCard: "添加预览插件",
		addPluginsViewerCardDesc: "注册新的文件类型预览",
		addPluginsTabDesc: "侧边栏页面（Tab）可以由插件扩展。插件通过 ctx.betterSidebar 服务注册；点击「安装」复制安装命令，粘贴到 DSH 所在环境的终端执行。",
		addPluginsViewerDesc: "文件预览器可以由插件扩展。插件通过 ctx.betterSidebar 服务注册；点击「安装」复制安装命令，粘贴到 DSH 所在环境的终端执行。",
		addPluginsBrowseMore: "在 GitHub 上浏览更多插件（topic: dsh-coding-sidebar）",
		addPluginsSearch: "搜索插件名称 / 描述…",
		addPluginsNoMatch: "没有匹配的插件",
		addPluginsRecommended: "推荐插件",
		addPluginsEmpty: "暂未收录插件，欢迎在 GitHub topic 下发布你的插件",
		openPlugin: "跳转",
		copyInstall: "复制安装命令",
		pluginFlowglassDesc: "实时会话流程图：三列泳道展示用户、助手与工具调用，支持并行分组、子代理支线、逐层钻取和实时状态；安装 dsh-coding-sidebar 后注册原生「流镜」Tab，未安装时保留独立抽屉",
		pluginGitForgeDesc: "dsh-coding-sidebar「Git 凭据」Tab：GitHub/Gitea 等 Forge 账号库 + 按项目授权 + push 策略硬拦；token 仅存本地 secrets，不进模型上下文；提供只读 GitForge 工具与 agent HTTPS credential helper",
		pluginGitRemotesDesc: "dsh-coding-sidebar Git 远程 Tab：看分支/上游/ahead-behind，fetch（可 prune）、ff-only pull、确认后才 push。不替换内置 Git 的暂存/提交，也不提供 force-push 或模型自动推送",
		pluginSentinelDesc: "条件驱动的 agent 唤醒系统：文件/进程/端口/HTTP/命令/webhook 传感器，条件达成自动唤醒休眠会话；注册「哨兵」Tab 展示服务器全局监控表",
		pluginSidebarQaDesc: "基于 dsh-coding-sidebar 的划选提问tab分页: 对话划选 → 右侧面板提问 → 同工作区独立追问会话（❓追问·主题）：快速无思考模型压缩主对话上下文后与引文一起注入，不打断主对话；追问可嵌套、可继续、可归档",
		pluginSshTunnelDesc: "dsh-coding-sidebar「SSH 隧道」Tab：多机主机清单 + 按项目授权 + 密钥本地保管；模型工具 SSHManager（exec/SFTP/会话策略）；中央交互终端与双栏 SFTP",
		pluginTurnReviewDesc: "对「刚刚这一回合」的 diff 做 Approve / Request changes 的人闸门：只审上一回合，不 fork 会话；文件按主会话/子代理/未归因分组，按文件勾选打回 + 可选评语，点文件先看回合开始快照 vs 现在的 diff。不是 /rewind",
		pluginDocsPanelDesc: "DSH 侧边栏里的「全局文档」：全局 Markdown 笔记，任何工作区随时可读——列表点选阅读、悬浮大纲跳转、Chrome / VS Code 外部打开、代码复制，目录可配置（默认 ~/.dsh/docs）",
		pluginEgoBrowserDesc: "把 CitroLabs/ego-lite 接进 DeepSeek Harness 的 agent 浏览器：32 个 ego_* 工具驱动真实 Chromium，侧边栏原生「ego 浏览器」Tab 实时观察 agent 逛的每个页面，可直接点击/拖拽/输入接管；装 dsh-coding-sidebar 时自动注册 Tab，没装则退回浮动浮窗",
		trajectory: "轨迹图",
		trajEmpty: "本会话还没有轨迹记录",
		trajUnavailable: "轨迹数据不可用",
		trajUnavailableHint: "宿主未提供轨迹视图（需要 DSH 的 ui-trajectory 插件，且当前会话已挂载）",
		trajFollow: "跟随最新",
		trajFit: "适应窗口",
		trajZoomIn: "放大",
		trajZoomOut: "缩小",
		trajReplay: "回放",
		trajPause: "暂停",
		trajStop: "停止回放",
		trajSpeed: "倍速",
		trajStatsNodes: "{n} 节点",
		trajStatsEdges: "{n} 条边",
		trajStatsTurns: "{n} 轮",
		trajStatsTokens: "{n} 令牌",
		trajTurn: "第 {n} 轮",
		trajCollapsed: "已折叠更早的 {n} 条记录",
		trajInspectorHint: "点击节点查看详情",
		trajSeq: "序号",
		trajDuration: "耗时",
		trajUsage: "输入 {input} · 输出 {output}",
		trajLaneInput: "输入",
		trajLaneModel: "模型",
		trajLaneTool: "工具",
		trajStatusRunning: "进行中",
		trajStatusError: "失败",
		trajStatusInterrupted: "已停止",
		confirm: "确定",
		gitViewChanges: "变更",
		gitViewBranches: "分支",
		gitAhead: "领先上游 {n} 个提交",
		gitBehind: "落后上游 {n} 个提交",
		gitPushed: "已同步",
		gitPendingPush: "待推送",
		gitNoUpstream: "无上游",
		gitPush: "推送",
		gitPushing: "推送中…",
		gitCommitPush: "提交并推送",
		gitCommitPushFailed: "提交并推送失败",
		gitPushFailed: "推送失败",
		gitUntracked: "{n} 个未跟踪",
		gitBranchSearch: "搜索分支…",
		gitBranchNoMatch: "无匹配分支",
		gitBranchNew: "新建分支",
		gitBranchNamePlaceholder: "分支名",
		gitBranchCreate: "创建并检出",
		gitBranchCreateFailed: "创建分支失败",
		gitBranchCurrent: "当前",
		gitBranchRemote: "远程",
		gitBranchTracked: "→ {upstream}",
		gitBranchDelete: "删除分支",
		gitBranchDeleteDesc: "删除本地分支「{name}」？未合并时会再次确认。",
		gitBranchDeleteForce: "强制删除",
		gitBranchDeleteUnmerged: "「{name}」尚未合并，强制删除会丢失它的提交。仍要删除？",
		gitBranchDeleteFailed: "删除分支失败",
		ghSection: "GitHub",
		ghEnv: "环境",
		ghNotInstalled: "gh CLI 未安装",
		ghNotAuthenticated: "gh 未登录",
		ghInstallHint: "安装 gh（https://cli.github.com）并执行 gh auth login 后重试。",
		ghFailed: "gh 调用失败",
		ghReprobe: "重新探测",
		ghOpenPrs: "开放 PR",
		ghOpenIssues: "开放 Issue",
		ghNoPr: "无开放 PR",
		ghNoIssue: "无开放 Issue",
		ghOpen: "打开",
		ghMerge: "合并",
		ghMergeConfirm: "合并 #{number}？",
		ghMerged: "已合并 #{number}",
		ghMergeFailed: "合并失败",
		ghDraft: "草稿",
		ghCreatePr: "创建 PR",
		ghCreateIssue: "新建 Issue",
		ghCreatedPr: "已创建 PR",
		ghCreatedIssue: "已新建 Issue",
		ghCreatePrFailed: "创建 PR 失败",
		ghCreateIssueFailed: "新建 Issue 失败",
		ghPrTitle: "PR 标题",
		ghIssueTitle: "Issue 标题",
		ghBody: "描述（可空）",
		ghCreate: "创建",
		plans: "任务计划",
		plansSearch: "搜索计划文档…",
		plansEmpty: "暂无任务计划文档",
		plansHint: "约定位置：plans/ · docs/plans/ · .plans/ · plan.md",
		plansNoMatch: "没有匹配的计划文档",
		plansOpenInApp: "用系统应用打开",
		plansOpenFailed: "打开失败",
		plansCapped: "仅显示最近 {n} 个文档"
	};
	/** The en dictionary (key-set-equal to zh, enforced by the type annotation). */
	const en = {
		files: "Files",
		explorer: "Explorer",
		git: "Source Control",
		terminal: "Terminal",
		editor: "Editor",
		editorExplorer: "File open behavior",
		editorExplorerDesc: "Controls how files open",
		editorExplorerMerged: "Merged",
		editorExplorerMergedDesc: "Files switch in place in the same window; new windows start with the tree open",
		editorExplorerSplit: "Separate",
		editorExplorerSplitDesc: "Path-less windows are the standalone explorer (tree only); each file opens its own window (tree docked, closed by default)",
		editorTreeToggle: "File tree panel",
		editorPathPlaceholder: "File path (relative to the session directory or absolute), Enter to open",
		editorSearchPlaceholder: "Search files by name…",
		editorSearchNoResults: "No matching files",
		editorSearchTruncated: "Too many results — showing a partial list",
		editorEmptyHint: "Pick a file from the tree panel or the path input above to start previewing",
		openFileNewTab: "Open in New Tab",
		openFileSide: "Open to the Side",
		openWithMenu: "Open with",
		openWithSshSuffix: " (SSH)",
		pinOpenWith: "Pin to menu",
		unpinOpenWith: "Unpin",
		openWithExplorer: "File Manager",
		openWithVscode: "VS Code",
		openWithCursor: "Cursor",
		openWithZed: "Zed",
		openWithSettingsSshTitle: "SSH remote host",
		openWithSettingsSshDesc: "Empty = local workspace; with a user@host or SSH alias, VSCode-family openers switch to the vscode-remote/ssh-remote protocol and the File Manager / Zed / non-VSCode-family custom editors are hidden from the menu",
		openWithSettingsSshPlaceholder: "user@host or SSH alias",
		openWithSettingsCustomTitle: "Custom editors",
		openWithSettingsCustomDesc: "Name + URL template ({path} placeholder) + VSCode-family flag; in remote mode only VSCode-family editors can open a remote path",
		openWithSettingsAdd: "Add",
		openWithSettingsName: "Name",
		openWithSettingsTemplate: "e.g. cursor://file/{path}",
		openWithSettingsFamily: "VSCode-family",
		openWithSettingsFamilyDesc: "This editor speaks the VSCode URL dialect (supports SSH-remote opens)",
		openWithSettingsRemove: "Remove",
		openWithSettingsInvalidHint: "Editors with a missing name or a template without {path} / scheme:// are not shown in the menu",
		newTab: "New tab",
		openExplorer: "Explorer",
		brokenSymlink: "Broken symlink",
		openGit: "Git panel",
		newTerminal: "New terminal",
		terminalLimit: "Terminal limit reached (3)",
		close: "Close",
		closeOtherTabs: "Close Other Tabs",
		closeLeftTabs: "Close Tabs to the Left",
		closeRightTabs: "Close Tabs to the Right",
		moveToFreeWindow: "Move to Free Window",
		floatDropHint: "Release to open in a free window",
		dockToSidebar: "Dock Back to Sidebar",
		pinTerminal: "Pin Terminal",
		pinAgentTerminal: "Pin Agent Terminal",
		pinToWorkspace: "Pin to Workspace",
		pinToGlobal: "Pin Globally",
		unpinTerminal: "Unpin",
		pinnedTerminalTooltip: "{kind} · {scope} · {cwd}",
		pinnedTerminalKindUi: "UI Terminal",
		pinnedTerminalKindAgent: "Agent Terminal",
		pinnedTerminalScopeWorkspace: "Pinned to workspace",
		pinnedTerminalScopeGlobal: "Pinned globally",
		pinnedRailLabel: "Pinned Terminals",
		closePinnedTerminal: "Close Terminal",
		collapse: "Collapse sidebar",
		expand: "Expand sidebar",
		terminalError: "Terminal connection failed",
		terminalConnectFailed: "Terminal failed to connect repeatedly",
		terminalRetry: "Retry",
		terminalDepsFailed: "Terminal dependency node-pty failed to load",
		terminalDepsHint: "Run the command below in a terminal or cmd on the DSH machine to repair it, then retry (node-pty stays in sync with the DSH core version):",
		terminalDepsProfile: " (detected profile: {profile})",
		terminalShellNotFound: "Configured shell not found: {name} — check the shell path under Settings → Side card → Terminal",
		preview: "Preview",
		toc: "Table of contents",
		edit: "Edit",
		mermaidError: "Mermaid render failed",
		mermaidZoomIn: "Zoom in",
		mermaidZoomOut: "Zoom out",
		mermaidZoomReset: "Reset",
		mermaidZoomHint: "Scroll to zoom · drag to pan · Esc to close",
		refresh: "Refresh",
		refreshUnsavedConfirm: "The file changed on disk. Refreshing will discard unsaved edits. Continue?",
		save: "Save",
		saved: "Saved",
		unsaved: "Unsaved",
		saveFailed: "Save failed",
		truncation: "File too large — showing the first 512KB",
		binary: "Binary file, preview unavailable",
		loading: "Loading…",
		error: "Failed to load",
		retry: "Retry",
		splitLeft: "Split left",
		splitRight: "Split right",
		splitUp: "Split up",
		splitDown: "Split down",
		notRepo: "This directory is not a git repository",
		noChanges: "No changes",
		statusTruncated: "Too many changes; showing the first 2,000 entries",
		stage: "Stage",
		unstage: "Unstage",
		stageAll: "Stage all",
		unstageAll: "Unstage all",
		commitPlaceholder: "Commit message (Ctrl+Enter)",
		commit: "Commit",
		commitError: "Commit failed",
		branch: "Branch",
		worktree: "Worktree",
		checkoutError: "Branch switch failed",
		history: "History",
		changes: "Changes",
		staged: "Staged",
		unstaged: "Unstaged",
		cancel: "Cancel",
		diffEmpty: "No text changes",
		diffLoadError: "Failed to load diff",
		diffBinary: "Binary",
		diffAdded: "Added",
		diffDeleted: "Deleted",
		diffRenamed: "Renamed",
		diffExpand: "Expand {count} more rows",
		diffCollapse: "Collapse",
		discard: "Discard changes",
		discardTitle: "Discard changes",
		discardDesc: "This discards the worktree changes of \"{path}\" (not recoverable).",
		viewCommitDiff: "View commit diff",
		copyShortHash: "Copy short hash",
		copyFullHash: "Copy full hash",
		copySubject: "Copy subject",
		revertCommit: "Revert commit",
		revertTitle: "Revert commit",
		revertDesc: "Create a new commit on the current branch that reverts \"{subject}\".",
		cherryPickCommit: "Cherry-pick commit",
		cherryPickTitle: "Cherry-pick commit",
		cherryPickDesc: "Apply the changes of \"{subject}\" to the current branch.",
		timeJustNow: "just now",
		timeMinutesAgo: "{n} min ago",
		timeHoursAgo: "{n} h ago",
		timeYesterday: "yesterday",
		loadMore: "Load more",
		historyLoadError: "Failed to load more history",
		produced: "Produced",
		producedOpen: "Open in sidebar",
		showInFolder: "Show in folder",
		disconnected: "Terminal disconnected, reconnecting…",
		terminalWaitBanner: "Agent is waiting for {needle}",
		terminalSkipWait: "Skip wait",
		gitFoldExpand: "Expand {count} context lines",
		gitFoldLoading: "Expanding…",
		gitFoldFailed: "Failed to expand",
		rename: "Rename",
		renameInvalid: "The name cannot be empty or contain path separators.",
		delete: "Delete",
		deleteTitle: "Delete \"{name}\"?",
		deleteDescFile: "This permanently deletes the file. This cannot be undone.",
		deleteDescDir: "This permanently deletes the directory and everything inside it. This cannot be undone.",
		dismiss: "Dismiss",
		changesSessionGit: "Git changes",
		changesSessionLens: "Session changes",
		changesEmpty: "No file operations in this session",
		changesCount: "{count} file operations",
		changesRedacted: "[REDACTED]",
		changesBinary: "Binary file — no preview",
		changesPreviewError: "Preview read failed: {message}",
		changesLens: "Lens",
		exited: "Terminal process exited",
		noSession: "Select a conversation to use the sidebar",
		pluginNotLoaded: "Plugin not loaded; tab unavailable:",
		hiddenFiles: "Hidden files",
		parent: "Parent directory",
		copied: "Copied",
		copy: "Copy",
		newFile: "New file",
		openEditor: "Open editor",
		gitDetail: "View change details",
		referenceFile: "@file",
		addToConversation: "Add to conversation",
		copyRelative: "Copy relative path",
		copyAbsolute: "Copy absolute path",
		download: "Download",
		uploadFiles: "Upload files",
		uploadFolder: "Upload folder",
		uploadHere: "Upload here",
		uploadDropHint: "Drop files/folders here to upload",
		uploadDropChat: "Drop onto the chat to add images",
		uploadTo: "Upload into {dir}",
		uploadingTo: "Uploading into {dir}…",
		uploadProgress: "Uploading {done}/{total}: {name}",
		uploadDone: "Uploaded {count} file(s)",
		uploadFailed: "Upload failed: {error}",
		uploadFailedUnknown: "Unknown error",
		uploadTooLarge: "File too large (over the upload limit)",
		uploadCancelled: "Upload cancelled",
		settingsNav: "Side card",
		settingsIntro: "Manage what the side card shows and how it behaves",
		settingsPopupDesc: "Configure related options for {feature}",
		settingsDone: "Done",
		settingsOpenTitle: "Open by default for new conversations",
		settingsOpenDesc: "Expand the side card automatically for brand-new conversations; existing conversations keep their own layouts",
		settingsWidthTitle: "Default width share",
		settingsWidthDesc: "The side card's default share of the window width for new conversations (20–60)",
		settingsWidthSuffix: "%",
		settingsOpenPathTitle: "Open chat files in the sidebar",
		settingsOpenPathDesc: "Open file links in the chat (tool rows, produced files, mentions) in the sidebar editor instead of the system default app",
		settingsOpenToolsTitle: "Inject the sidebar-open tool for the model",
		settingsOpenToolsDesc: "When enabled, the model can actively open files, folders, and HTTP(S) pages in the sidebar through the sidebar_open tool (off by default)",
		settingsTitleBarTitle: "Position compatibility mode",
		settingsTitleBarDesc: "Pick the title-bar compatibility scheme: auto-detect (default, conservative) / DSH official web / known desktop shells / custom (shift distance + custom CSS)",
		settingsTitleBarStripTitle: "Shift distance",
		settingsTitleBarStripDesc: "Title-bar strip height: how far the sidebar buttons and content move down in px (0–120, default 40; applies under the custom scheme)",
		settingsSchemeAutoTitle: "Auto-detect",
		settingsSchemeAutoDesc: "Conservative: only the standard Window Controls Overlay API contributes (real caption-overlay height); plain web environments get no modification",
		settingsSchemeWebTitle: "DSH official web",
		settingsSchemeWebDesc: "Explicitly declare the official web UI: no adaptation at all (not even standard WCO geometry)",
		settingsSchemeCustomTitle: "Custom",
		settingsSchemeCustomDesc: "Full control: inject custom CSS (can override built-in styles) and set the title-bar shift distance",
		settingsSchemeDetectedSuffix: "detected",
		settingsCustomCssTitle: "Custom CSS",
		settingsCustomCssDesc: "Styles appended at the end of the page (later in the cascade wins ties; use !important to override JS-written inline variables)",
		settingsCustomCssPlaceholder: "/* e.g. reserve 36px for a shell with a custom-drawn title bar */\nhtml[data-dsh-title-bar-height=\"36\"] {\n  --dsh-title-bar-strip: 36px !important;\n}",
		settingsSaveFailed: "Failed to save",
		settingsConflict: "The setting changed in another window — please retry",
		binaryNoPreview: "This file type cannot be previewed",
		downloadToView: "Download to view",
		settingsSubagentTitle: "Auto-activate the Tasks page when a subagent appears",
		settingsSubagentDesc: "Activate the Tasks page when the current conversation spawns a new subagent; on wide screens the side card expands with it, narrow screens never force the full-screen drawer; turn off to open it manually",
		settingsJobsTitle: "Auto-activate the Jobs page on a new background job",
		settingsJobsDesc: "Activate the Jobs page whenever a new background job appears for the current conversation (every new job triggers); on wide screens the side card expands with it, narrow screens never force the full-screen drawer; turn off to open it manually",
		settingsToolsTitle: "Inject terminal tools for the model",
		settingsToolsDesc: "When enabled, the model can create and drive sidebar terminals through the 8 terminal_* tools (off by default)",
		settingsFontFamilyTitle: "Terminal font family",
		settingsFontFamilyDesc: "Custom terminal font family (a CSS font-family stack like \"JetBrains Mono\", monospace; leave empty to follow the theme's monospace font)",
		settingsFontFamilyPlaceholder: "\"JetBrains Mono\", monospace",
		settingsFontSizeTitle: "Terminal font size",
		settingsShellTitle: "Shell path",
		settingsShellDesc: "Shell spawned for UI and model terminals (absolute path or bare executable). Empty keeps the legacy order: yaml config.shell → $SHELL / login shell / Windows powershell.exe. Applies to terminals opened afterwards",
		settingsShellPlaceholder: "e.g. /bin/zsh (empty = auto)",
		settingsShellArgsTitle: "Shell arguments",
		settingsShellArgsDesc: "Explicit shell arguments, space-separated; when non-empty they fully replace the defaults (same contract as the yaml shellArgs)",
		settingsShellArgsPlaceholder: "e.g. -l (empty = defaults)",
		settingsFontSizeDesc: "Terminal font size in px (9–32, default 13)",
		settingsFontSizeSuffix: "px",
		settingsTabsTitle: "Sidebar content",
		settingsViewersTitle: "File viewers",
		settingsGeneralTitle: "General",
		settingsPopup: "Feature settings",
		settingsViewerCatchAll: "Catch-all: any file",
		viewerImage: "Image",
		viewerPdf: "PDF",
		viewerMarkdown: "Markdown",
		viewerCode: "Code",
		viewerBinary: "Binary download",
		viewerDocx: "Word",
		viewerXlsx: "Excel",
		viewerPptx: "PowerPoint",
		viewerVideo: "Video",
		previousSlide: "Previous",
		nextSlide: "Next",
		zoom: "Zoom",
		zoomHint: "Alt + wheel",
		videoUnsupported: "This format cannot play in the browser — download it to open in a local player",
		viewerHtml: "HTML",
		browser: "Browser",
		browserPlaceholder: "Enter a URL, e.g. example.com",
		browserGo: "Go",
		browserBack: "Back",
		browserForward: "Forward",
		browserStart: "Enter a URL to start browsing (sandbox mode)",
		browserLive: "Agent live",
		browserLiveFree: "Free browse",
		browserLiveConnecting: "connecting to the agent browser host…",
		browserLiveDown: "host unreachable: make sure KCoder is running (port 9223)",
		browserLiveTargetNone: "No open pages yet — they appear here live once the agent browses",
		browserLiveFollowLatest: "Follow latest",
		browserBlockedScheme: "Blocked: only http/https URLs are allowed",
		browserBlockedLoopback: "Blocked: local and internal addresses cannot be browsed here",
		browserInvalid: "Invalid URL",
		browserNoSandboxWarning: "Sandbox off: the current page runs with full GUI privileges (re-enable in settings)",
		htmlNoSandboxWarning: "Sandbox off: this HTML runs with full GUI privileges (re-enable in settings)",
		sandboxStatusOn: "Sandbox mode: on · pages cannot access the GUI's data or local files; logins and third-party cookies may not work",
		sandboxUnlock: "Temporarily disable (unsafe)",
		sandboxRestore: "Restore sandbox",
		settingsHtmlDefaultUnsafeTitle: "Open HTML previews unsandboxed by default (unsafe)",
		settingsHtmlDefaultUnsafeDesc: "When on, every newly opened HTML preview starts in the unsandboxed state (same origin as the GUI — it can read session files and internal APIs); the status row still offers a one-tap restore",
		settingsHtmlSandboxTitle: "Disable HTML preview sandbox (unsafe)",
		settingsHtmlSandboxDesc: "With the sandbox off, previewed HTML runs with the same origin as the GUI: it can read session files, local storage and call internal APIs. Only enable for fully trusted files",
		settingsBrowserSandboxTitle: "Disable browser sandbox (unsafe)",
		settingsBrowserSandboxDesc: "With the sandbox off, any visited site runs with the same origin as the GUI: it can read session data and act as your logged-in session. Only enable for fully trusted sites",
		settingsBrowserLinksTitle: "Open chat external links in the sidebar",
		settingsBrowserLinksDesc: "When on, clicking an external link in the chat or GUI opens the sidebar instead of a new window; HTTP and HTTPS are controlled separately by the switches below; Ctrl/Cmd+click always bypasses",
		settingsBrowserHttpTitle: "Open HTTP pages in the sidebar",
		settingsBrowserHttpDesc: "When on, clicking an HTTP external link in the chat or GUI opens the sidebar (plugin pages declaring urlTarget win); Ctrl/Cmd+click always bypasses",
		settingsBrowserHttpsTitle: "Open HTTPS pages in the sidebar",
		settingsBrowserHttpsDesc: "When on, clicking an HTTPS external link in the chat or GUI opens the sidebar. Off by default: most HTTPS sites refuse to be embedded, so the system browser is the smoother default",
		settingsBrowserLoopbackTitle: "Allowed local addresses",
		settingsBrowserLoopbackDesc: "Comma-separated allowlist of loopback addresses (e.g. localhost:5174 or 127.0.0.1:8080) the sidebar browser may visit; empty blocks all local addresses by default. The sandbox still applies — pages cannot read GUI data",
		settingsBrowserLoopbackPlaceholder: "e.g. localhost:5174, 127.0.0.1:8080",
		browserOpenExternal: "Open in browser",
		browserEmbedBlocked: "{host} refused to be embedded",
		browserEmbedBlockedDesc: "The site forbids being displayed inside other pages (X-Frame-Options / frame-ancestors), so it cannot load in the sidebar. Open it directly in your browser instead.",
		browserEmbedAnyway: "Load anyway",
		subagent: "Tasks",
		openSubagent: "Tasks",
		subagentMainAgent: "Main agent",
		subagentEmpty: "No subagents",
		subagentEmptyDesc: "Subagents spawned under the main agent will appear here",
		subagentRunning: "Running",
		subagentInactive: "Inactive",
		subagentModeOneShot: "One-shot",
		subagentModeContinuable: "Continuable",
		subagentCount: "{count} subagents",
		subagentCountRunning: "{count} subagents · {running} running",
		subagentDiagCorrupt: "Corrupt",
		subagentDiagUnsupported: "Unsupported",
		subagentDiagUnavailable: "Unavailable",
		subagentThinking: "Thinking…",
		subagentShowHistory: "Show {count} earlier subagents",
		subagentHideHistory: "Collapse earlier subagents",
		sideChat: "Side Chat (beta)",
		sideChatNew: "New thread",
		sideChatUntitled: "New thread",
		sideChatEmpty: "No side conversations",
		sideChatEmptyDesc: "Every side conversation is its own tab in the tab strip — it inherits the current session's context and never enters the main conversation",
		sideChatCreating: "Creating side conversation…",
		sideChatRetry: "Retry",
		sideChatThreads: "Switch thread / new",
		sideChatSave: "Save as new session",
		sideChatSaveTitle: "Promote this thread to a top-level session in the main session list",
		sideChatSaved: "Saved as a new session",
		sideChatNoTurn: "Save is available after the first completed turn",
		sideChatPendingDrop: "The last unanswered follow-up will not be included in the saved session",
		sideChatFirstPlaceholder: "Ask the first question — context inherited…",
		sideChatComposerPlaceholder: "Ask a follow-up…",
		sideChatThinking: "Deep diving…",
		sideChatThink: "Thinking",
		sideChatInjection: "Context injected",
		sideChatSend: "Send",
		sideChatCancel: "Stop",
		sideChatCancelTitle: "Abort the running turn (queued work is kept)",
		sideChatClose: "Close thread",
		sideChatCloseTitle: "Release the thread's agent (history is kept)",
		sideChatError: "Side Chat error: {message}",
		jobs: "Background jobs",
		jobsCount: "{count} background jobs",
		jobsCountRunning: "{count} background jobs · {running} running",
		jobsShowHistory: "Show {count} earlier jobs",
		jobsHideHistory: "Collapse earlier jobs",
		jobStatusRunning: "Running",
		jobStatusStopping: "Stopping",
		jobStatusCompleted: "Completed",
		jobStatusKilled: "Killed",
		jobStatusFailed: "Failed",
		jobDurationSeconds: "{seconds}s",
		jobDurationMinutes: "{minutes}m {seconds}s",
		jobDurationHours: "{hours}h {minutes}m",
		jobViewOutput: "View output",
		jobHideOutput: "Hide output",
		jobNoOutput: "No output yet",
		jobNotReadYet: "Waiting for the model to read this job; its output appears here once the model runs job_output",
		jobOutputTruncated: "Output truncated",
		jobOutputError: "Failed to read output",
		jobKill: "Kill",
		jobKillConfirm: "Click again to confirm kill",
		jobKillError: "Kill failed",
		addPluginsTabCard: "Add tab plugins",
		addPluginsTabCardDesc: "Register a new sidebar page",
		addPluginsViewerCard: "Add preview plugins",
		addPluginsViewerCardDesc: "Register a file-type preview",
		addPluginsTabDesc: "Sidebar pages (tabs) can be extended by plugins. Plugins register through the ctx.betterSidebar service; clicking Install copies the install command — paste it into a terminal where your DSH profile lives and run it.",
		addPluginsViewerDesc: "File previewers can be extended by plugins. Plugins register through the ctx.betterSidebar service; clicking Install copies the install command — paste it into a terminal where your DSH profile lives and run it.",
		addPluginsBrowseMore: "Browse more plugins on GitHub (topic: dsh-coding-sidebar)",
		addPluginsSearch: "Search by plugin name or description…",
		addPluginsNoMatch: "No plugins match",
		addPluginsRecommended: "Recommended plugins",
		addPluginsEmpty: "No plugins curated yet — publish yours under the GitHub topic",
		openPlugin: "Open",
		copyInstall: "Copy install command",
		pluginFlowglassDesc: "Live session flowgraph with three lanes for user, assistant, and tool calls, plus parallel groups, sub-agent branches, drill-down, and live status; registers a native Flowglass tab when dsh-coding-sidebar is installed and keeps its standalone drawer as a fallback",
		pluginGitForgeDesc: "Git Forge tab: GitHub/Gitea (and other forge) account library + per-project grants + hard push policy; tokens stay in local secrets (never in model context); read-only GitForge tool and agent HTTPS credential helper",
		pluginGitRemotesDesc: "Git Remotes tab: branch/upstream/ahead-behind, fetch (optional prune), ff-only pull, and push only after an in-tab confirm. Does not replace the built-in Git stage/commit tab, and does not offer force-push or a model auto-push tool",
		pluginSentinelDesc: "Condition-driven agent wakeup: file/process/port/http/command/webhook sensors wake dormant sessions when conditions fire; registers a \"Sentinel\" tab with the server-wide watch table",
		pluginSidebarQaDesc: "Select-and-ask: Select conversation text → ask in the right-side panel → a dedicated follow-up session (❓追问) in the same workspace; a fast no-thinking model compresses the main context and injects it with the quote, without interrupting the main conversation. Follow-ups nest, continue, and archive",
		pluginSshTunnelDesc: "SSH Tunnel tab: multi-host inventory + per-project grants + local secrets; SSHManager tool (exec/SFTP/session strategies); center interactive terminal and dual-pane SFTP",
		pluginTurnReviewDesc: "A human gate on the just-finished turn: Approve / Request changes per path with an optional comment; paths grouped by main session / subagent / unattributed; inline snapshot-vs-now diff before you decide. No fork, no /rewind",
		pluginDocsPanelDesc: "Global docs in the DSH sidebar: read your own Markdown notes from any workspace — a file list, an outline, open in Chrome / VS Code, and copy buttons; the docs directory is configurable (default ~/.dsh/docs)",
		pluginEgoBrowserDesc: "The agent browser for DeepSeek Harness: 32 ego_* tools drive a real Chromium, with a native sidebar \"ego browser\" tab giving a live view of every page the agent visits — you can click, drag, and type to take over. Registers the tab automatically when dsh-coding-sidebar is present, otherwise falls back to a floating bubble",
		trajectory: "Trajectory Graph",
		trajEmpty: "No trajectory records in this session yet",
		trajUnavailable: "Trajectory data unavailable",
		trajUnavailableHint: "The host exposed no trajectory view (needs DSH's ui-trajectory plugin and a mounted session)",
		trajFollow: "Follow latest",
		trajFit: "Fit to width",
		trajZoomIn: "Zoom in",
		trajZoomOut: "Zoom out",
		trajReplay: "Replay",
		trajPause: "Pause",
		trajStop: "Stop replay",
		trajSpeed: "Playback speed",
		trajStatsNodes: "{n} nodes",
		trajStatsEdges: "{n} edges",
		trajStatsTurns: "{n} turns",
		trajStatsTokens: "{n} tokens",
		trajTurn: "Turn {n}",
		trajCollapsed: "{n} earlier records folded",
		trajInspectorHint: "Click a node for details",
		trajSeq: "seq",
		trajDuration: "took",
		trajUsage: "in {input} · out {output}",
		trajLaneInput: "Input",
		trajLaneModel: "Model",
		trajLaneTool: "Tools",
		trajStatusRunning: "running",
		trajStatusError: "failed",
		trajStatusInterrupted: "stopped",
		confirm: "Confirm",
		gitViewChanges: "Changes",
		gitViewBranches: "Branches",
		gitAhead: "{n} commits ahead of upstream",
		gitBehind: "{n} commits behind upstream",
		gitPushed: "up to date",
		gitPendingPush: "unpushed",
		gitNoUpstream: "no upstream",
		gitPush: "Push",
		gitPushing: "Pushing…",
		gitCommitPush: "Commit & push",
		gitCommitPushFailed: "Commit & push failed",
		gitPushFailed: "Push failed",
		gitUntracked: "{n} untracked",
		gitBranchSearch: "Search branches…",
		gitBranchNoMatch: "No matching branches",
		gitBranchNew: "New branch",
		gitBranchNamePlaceholder: "Branch name",
		gitBranchCreate: "Create & checkout",
		gitBranchCreateFailed: "Create branch failed",
		gitBranchCurrent: "current",
		gitBranchRemote: "remote",
		gitBranchTracked: "→ {upstream}",
		gitBranchDelete: "Delete branch",
		gitBranchDeleteDesc: "Delete the local branch “{name}”? An unmerged branch asks again.",
		gitBranchDeleteForce: "Force delete",
		gitBranchDeleteUnmerged: "“{name}” is not fully merged — force deleting loses its commits. Delete anyway?",
		gitBranchDeleteFailed: "Delete branch failed",
		ghSection: "GitHub",
		ghEnv: "Environment",
		ghNotInstalled: "gh CLI is not installed",
		ghNotAuthenticated: "gh is not logged in",
		ghInstallHint: "Install gh (https://cli.github.com) and run gh auth login, then retry.",
		ghFailed: "gh failed",
		ghReprobe: "Re-probe",
		ghOpenPrs: "Open PRs",
		ghOpenIssues: "Open issues",
		ghNoPr: "No open PRs",
		ghNoIssue: "No open issues",
		ghOpen: "Open",
		ghMerge: "Merge",
		ghMergeConfirm: "Merge #{number}?",
		ghMerged: "Merged #{number}",
		ghMergeFailed: "Merge failed",
		ghDraft: "draft",
		ghCreatePr: "Create PR",
		ghCreateIssue: "New issue",
		ghCreatedPr: "Pull request created",
		ghCreatedIssue: "Issue created",
		ghCreatePrFailed: "Create PR failed",
		ghCreateIssueFailed: "Create issue failed",
		ghPrTitle: "PR title",
		ghIssueTitle: "Issue title",
		ghBody: "Description (optional)",
		ghCreate: "Create",
		plans: "Task plans",
		plansSearch: "Search plan documents…",
		plansEmpty: "No plan documents",
		plansHint: "Convention: plans/ · docs/plans/ · .plans/ · plan.md",
		plansNoMatch: "No matching plan documents",
		plansOpenInApp: "Open with system app",
		plansOpenFailed: "Open failed",
		plansCapped: "Showing the {n} most recent documents"
	};
	/**
	* The active locale id ('zh' | 'en'): the DSH locale service's snapshot when
	* attached, else the browser language.
	*/
	function activeLocale() {
		return (typeof navigator !== "undefined" ? navigator.language : "") ?? "en";
	}
	/** Translate a copy key; `{name}` placeholders interpolate from `params`. */
	function t(key, params) {
		let text = void 0;
		if (text === void 0) text = (activeLocale().toLowerCase().startsWith("zh") ? zh : en)[key];
		if (text === void 0) text = key;
		if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
		return text;
	}
	//#endregion
	//#region \0dsh-css:/Users/libing/kk_Projects/dsh-coding-sidebar/src/client/trajectory-graph.module.css.mjs
	const css = ".vJGe7W_wrap{background:var(--dsw-alias-bg-layer-1,transparent);flex-direction:column;flex:1;min-height:0;display:flex}.vJGe7W_bar{border-bottom:1px solid var(--dsw-alias-border-l2,#80808033);flex:none;align-items:center;gap:6px;min-height:32px;padding:0 8px;display:flex}.vJGe7W_stat{font:var(--dsw-font-xs-12,11px/16px system-ui);color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap;flex:none}.vJGe7W_liveDot{background:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary));border-radius:50%;flex:none;width:6px;height:6px;animation:1.6s ease-in-out infinite vJGe7W_trajPulse}.vJGe7W_spacer{flex:1;min-width:4px}.vJGe7W_tool{min-width:22px;height:22px;color:var(--dsw-alias-label-secondary,inherit);font:var(--dsw-font-xs-12,11px/16px system-ui);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:6px;flex:none;justify-content:center;align-items:center;padding:0 4px;display:inline-flex}.vJGe7W_tool:hover{background:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb, currentcolor 10%, transparent));color:var(--dsw-alias-label-primary,inherit)}.vJGe7W_tool[aria-pressed=true]{border-color:var(--dsw-alias-border-l3,transparent);background:var(--dsw-alias-interactive-bg-active,color-mix(in srgb, currentcolor 14%, transparent));color:var(--dsw-alias-label-primary,inherit)}.vJGe7W_glyph{font-size:13px;line-height:1}.vJGe7W_tool:disabled{opacity:.4;cursor:default}.vJGe7W_legend{flex:none;align-items:center;gap:10px;padding:2px 8px 4px;display:flex}.vJGe7W_legendItem{font:var(--dsw-font-xs-12,11px/16px system-ui);color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));align-items:center;gap:4px;display:inline-flex}.vJGe7W_legendDot{border-radius:2px;width:7px;height:7px}.vJGe7W_laneInput{background:var(--dsw-alias-label-primary,currentcolor)}.vJGe7W_laneModel{background:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary))}.vJGe7W_laneTool{background:var(--dsw-alias-link,var(--dsw-alias-brand-primary))}.vJGe7W_canvas{overscroll-behavior:contain;cursor:grab;scrollbar-width:thin;flex:1;min-height:0;position:relative;overflow:auto}.vJGe7W_canvasDragging{cursor:grabbing}.vJGe7W_svg{margin:0 auto;display:block}.vJGe7W_paused .vJGe7W_flow,.vJGe7W_paused .vJGe7W_liveDot,.vJGe7W_paused .vJGe7W_nodeLive{animation-play-state:paused}.vJGe7W_band{fill:var(--dsw-alias-bg-layer-2,color-mix(in srgb, currentcolor 4%, transparent));opacity:.5}.vJGe7W_bandLabel{font:var(--dsw-font-xs-12,10px/14px system-ui);fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));letter-spacing:.04em;user-select:none}.vJGe7W_edge{fill:none;stroke:var(--dsw-alias-border-l3,#80808073);stroke-width:1.2px}.vJGe7W_edgePrompt{stroke:var(--dsw-alias-label-tertiary,#80808080)}.vJGe7W_edgeResult,.vJGe7W_edgeDispatch{stroke:var(--dsw-alias-border-l3,#80808073)}.vJGe7W_edgeSubcall{stroke:var(--dsw-alias-border-l2,#80808059);stroke-dasharray:3 3}.vJGe7W_edgeLoop{stroke:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));stroke-width:1.4px;opacity:.75}.vJGe7W_edgeLive{stroke:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary));stroke-width:1.8px;opacity:.95}.vJGe7W_edgeDim{opacity:.12}.vJGe7W_edgeHot{stroke:var(--dsw-alias-label-primary,currentcolor);stroke-width:2.2px}.vJGe7W_flow{fill:none;stroke:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary));stroke-width:2.4px;stroke-linecap:round;stroke-dasharray:2 12;animation:1.1s linear infinite vJGe7W_trajFlow}.vJGe7W_arrow{fill:var(--dsw-alias-border-l3,#80808099)}.vJGe7W_arrowLive{fill:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary))}.vJGe7W_packet{fill:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary));filter:drop-shadow(0 0 3px var(--dsw-alias-state-success-primary,currentcolor))}.vJGe7W_packetHot{fill:var(--dsw-alias-label-primary,currentcolor);filter:drop-shadow(0 0 4px var(--dsw-alias-label-primary,currentcolor))}.vJGe7W_node{cursor:pointer}.vJGe7W_nodeRect{fill:var(--dsw-alias-bg-layer-2,color-mix(in srgb, currentcolor 6%, transparent));stroke:var(--node-accent,var(--dsw-alias-border-l2,#80808059));stroke-width:1px}.vJGe7W_nodeAccent{fill:var(--node-accent,var(--dsw-alias-border-l2,currentcolor))}.vJGe7W_nodeLabel{font:var(--dsw-font-xs-12,11px/16px system-ui);fill:var(--dsw-alias-label-primary,currentcolor);user-select:none;pointer-events:none}.vJGe7W_nodeBadge{font:var(--dsw-font-xs-12,9px/12px system-ui);fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));user-select:none;pointer-events:none}.vJGe7W_nodeLive .vJGe7W_nodeRect{stroke-width:1.6px;animation:1.8s ease-in-out infinite vJGe7W_trajPulse}.vJGe7W_nodeDim{opacity:.14}.vJGe7W_nodeHot .vJGe7W_nodeRect{stroke:var(--dsw-alias-label-primary,currentcolor);stroke-width:2px}.vJGe7W_note{font:var(--dsw-font-xs-12,11px/16px system-ui);color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));border-top:1px dashed var(--dsw-alias-border-l2,transparent);flex:none;padding:6px 10px}.vJGe7W_empty{text-align:center;min-height:0;font:var(--dsw-font-s-14,13px/20px system-ui);color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));flex-direction:column;flex:1;justify-content:center;align-items:center;gap:6px;padding:24px;display:flex}.vJGe7W_emptyHint{font:var(--dsw-font-xs-12,11px/16px system-ui);color:var(--dsw-alias-label-dimmed,var(--dsw-alias-label-tertiary));max-width:260px}.vJGe7W_inspector{border-top:1px solid var(--dsw-alias-border-l2,#80808040);background:var(--dsw-alias-bg-layer-2,transparent);flex-direction:column;flex:none;max-height:40%;display:flex}.vJGe7W_inspectorHead{flex:none;align-items:center;gap:6px;padding:4px 6px 4px 8px;display:flex}.vJGe7W_inspectorKind{font:var(--dsw-font-xs-12,11px/16px ui-monospace, monospace);color:var(--node-accent,var(--dsw-alias-label-primary))}.vJGe7W_inspectorLane,.vJGe7W_inspectorStatus{font:var(--dsw-font-xs-12,10px/14px system-ui);border:1px solid var(--dsw-alias-border-l2,#8080804d);color:var(--dsw-alias-label-secondary,inherit);border-radius:999px;padding:0 5px}.vJGe7W_inspectorStatus[data-status=running]{color:var(--dsw-alias-state-success-primary,inherit)}.vJGe7W_inspectorStatus[data-status=error]{color:var(--dsw-alias-state-error-primary,inherit)}.vJGe7W_inspectorStatus[data-status=interrupted]{color:var(--dsw-alias-state-warn-label,var(--dsw-alias-state-warn-primary,inherit))}.vJGe7W_inspectorMeta{font:var(--dsw-font-xs-12,10px/14px ui-monospace, monospace);color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));flex:none;padding:0 8px 4px}.vJGe7W_inspectorBody{white-space:pre-wrap;word-break:break-word;min-height:0;font:var(--dsw-font-xs-12,11px/16px ui-monospace, monospace);color:var(--dsw-alias-label-secondary,inherit);flex:1;margin:0;padding:0 8px 8px;overflow:auto}@keyframes vJGe7W_trajFlow{0%{stroke-dashoffset:0}to{stroke-dashoffset:-14px}}@keyframes vJGe7W_trajPulse{0%,to{opacity:1}50%{opacity:.45}}@media (prefers-reduced-motion:reduce){.vJGe7W_flow,.vJGe7W_liveDot,.vJGe7W_nodeLive .vJGe7W_nodeRect{animation:none}}";
	const tagId = "dsh-coding-sidebar/trajectory-graph.module.css";
	if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
		const tag = document.createElement("style");
		tag.dataset.plugin = "dsh-coding-sidebar";
		tag.dataset.pluginCss = tagId;
		tag.textContent = css;
		document.head.appendChild(tag);
	}
	var trajectory_graph_module_css_default = {
		"arrow": "vJGe7W_arrow",
		"arrowLive": "vJGe7W_arrowLive",
		"band": "vJGe7W_band",
		"bandLabel": "vJGe7W_bandLabel",
		"bar": "vJGe7W_bar",
		"canvas": "vJGe7W_canvas",
		"canvasDragging": "vJGe7W_canvasDragging",
		"edge": "vJGe7W_edge",
		"edgeDim": "vJGe7W_edgeDim",
		"edgeDispatch": "vJGe7W_edgeDispatch",
		"edgeHot": "vJGe7W_edgeHot",
		"edgeLive": "vJGe7W_edgeLive",
		"edgeLoop": "vJGe7W_edgeLoop",
		"edgePrompt": "vJGe7W_edgePrompt",
		"edgeResult": "vJGe7W_edgeResult",
		"edgeSubcall": "vJGe7W_edgeSubcall",
		"empty": "vJGe7W_empty",
		"emptyHint": "vJGe7W_emptyHint",
		"flow": "vJGe7W_flow",
		"glyph": "vJGe7W_glyph",
		"inspector": "vJGe7W_inspector",
		"inspectorBody": "vJGe7W_inspectorBody",
		"inspectorHead": "vJGe7W_inspectorHead",
		"inspectorKind": "vJGe7W_inspectorKind",
		"inspectorLane": "vJGe7W_inspectorLane",
		"inspectorMeta": "vJGe7W_inspectorMeta",
		"inspectorStatus": "vJGe7W_inspectorStatus",
		"laneInput": "vJGe7W_laneInput",
		"laneModel": "vJGe7W_laneModel",
		"laneTool": "vJGe7W_laneTool",
		"legend": "vJGe7W_legend",
		"legendDot": "vJGe7W_legendDot",
		"legendItem": "vJGe7W_legendItem",
		"liveDot": "vJGe7W_liveDot",
		"node": "vJGe7W_node",
		"nodeAccent": "vJGe7W_nodeAccent",
		"nodeBadge": "vJGe7W_nodeBadge",
		"nodeDim": "vJGe7W_nodeDim",
		"nodeHot": "vJGe7W_nodeHot",
		"nodeLabel": "vJGe7W_nodeLabel",
		"nodeLive": "vJGe7W_nodeLive",
		"nodeRect": "vJGe7W_nodeRect",
		"note": "vJGe7W_note",
		"packet": "vJGe7W_packet",
		"packetHot": "vJGe7W_packetHot",
		"paused": "vJGe7W_paused",
		"spacer": "vJGe7W_spacer",
		"stat": "vJGe7W_stat",
		"svg": "vJGe7W_svg",
		"tool": "vJGe7W_tool",
		"trajFlow": "vJGe7W_trajFlow",
		"trajPulse": "vJGe7W_trajPulse",
		"wrap": "vJGe7W_wrap"
	};
	//#endregion
	//#region src/client/TrajectoryGraph.tsx
	/**
	* The trajectory graph tab: DSH's own trajectory ledger (the `trajectory`
	* Conversation view target contributed by `@deepseek-ai/dsh-client-ui-trajectory`)
	* drawn as a live node/edge flow.
	*
	* Data path — the plugin never parses session events itself:
	*
	*   ui-trajectory snapshot ──buildTrajectoryGraph──▶ graph model (nodes+edges)
	*                          └─layoutTrajectoryGraph─▶ swimlane coordinates
	*                          └───────── this view ────▶ SVG + motion
	*
	* The subscription follows the host's own activation contract: subscribing to
	* `binding(sessionId).target('trajectory')` activates the target for that
	* session, and the source is dropped when the tab stops being the visible one
	* (the host's active set is monotonic, so a later focus resumes instantly from
	* the latest snapshot).
	*
	* Motion is data-driven, not decorative:
	* - a record that is still moving (a running request, an unsettled tool call,
	*   the streaming assistant prefix) pulses, and every edge that delivers data
	*   INTO it carries a dashed flow overlay plus a packet that rides the edge's
	*   real path (`<animateMotion path>`);
	* - the replay control walks the ledger in the order the events actually
	*   happened, pacing each hop by the recorded timestamps (clamped, so a
	*   30-second tool call does not freeze the replay), and flying one packet per
	*   hop.
	*/
	/** Records kept in the render window (a long session's ledger is unbounded). */
	const RENDER_LIMIT = 400;
	/** Zoom bounds for the canvas. */
	const ZOOM_MIN = .4;
	const ZOOM_MAX = 2.4;
	/** Replay speeds (the speed button cycles them). */
	const SPEEDS = [
		1,
		2,
		4
	];
	/** Edge class per chain kind (kept explicit: a CSS-module map has no key type). */
	const EDGE_CLASS = {
		prompt: trajectory_graph_module_css_default.edgePrompt,
		result: trajectory_graph_module_css_default.edgeResult,
		dispatch: trajectory_graph_module_css_default.edgeDispatch,
		subcall: trajectory_graph_module_css_default.edgeSubcall,
		loop: trajectory_graph_module_css_default.edgeLoop
	};
	/** Per-kind accent, handed to CSS as `--node-accent` (tokens only). */
	const ACCENT = {
		system: "var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))",
		user: "var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary))",
		steering: "var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-primary))",
		context: "var(--dsw-alias-label-secondary, var(--dsw-alias-label-primary))",
		command: "var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary))",
		request: "var(--dsw-alias-state-success-primary, var(--dsw-alias-brand-primary))",
		"compact-request": "var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-primary))",
		assistant: "var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary))",
		partial: "var(--dsw-alias-state-success-primary, var(--dsw-alias-brand-primary))",
		tool: "var(--dsw-alias-link, var(--dsw-alias-brand-primary))",
		"running-call": "var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-primary))",
		compaction: "var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary))",
		retry: "var(--dsw-alias-state-warn-primary, var(--dsw-alias-label-primary))",
		error: "var(--dsw-alias-state-error-primary, var(--dsw-alias-label-primary))",
		"max-tokens": "var(--dsw-alias-state-error-primary, var(--dsw-alias-label-primary))",
		unknown: "var(--dsw-alias-label-dimmed, var(--dsw-alias-label-tertiary))"
	};
	/** Lane label key per lane. */
	const LANE_KEY = {
		input: "trajLaneInput",
		model: "trajLaneModel",
		tool: "trajLaneTool"
	};
	/** Lane swatch class per lane. */
	const LANE_CLASS = {
		input: trajectory_graph_module_css_default.laneInput,
		model: trajectory_graph_module_css_default.laneModel,
		tool: trajectory_graph_module_css_default.laneTool
	};
	/** Status chip copy per status. */
	function statusLabel(status) {
		switch (status) {
			case "running": return t("trajStatusRunning");
			case "error": return t("trajStatusError");
			case "interrupted": return t("trajStatusInterrupted");
			default: return "";
		}
	}
	function cx(...parts) {
		return parts.filter((part) => typeof part === "string" && part !== "").join(" ");
	}
	function clamp(value, min, max) {
		return value < min ? min : value > max ? max : value;
	}
	/** Clock label of one record; `—` when the host recorded no time. */
	function clockOf(ms) {
		if (!Number.isFinite(ms) || ms <= 0) return "—";
		const date = new Date(ms);
		const pad = (value) => String(value).padStart(2, "0");
		return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
	}
	/** Duration label (`184ms` / `2.4s`). */
	function durationOf(ms) {
		if (ms === null || ms === void 0 || !Number.isFinite(ms)) return "—";
		return ms < 1e3 ? `${Math.round(ms)}ms` : `${(ms / 1e3).toFixed(1)}s`;
	}
	/** Replay pacing of one hop: the recorded gap, clamped and scaled. */
	function hopDelay(timeline, index, speed) {
		const at = timeline[index]?.at ?? 0;
		return clamp(at - (index === 0 ? at : timeline[index - 1]?.at ?? at), 90, 1100) / speed;
	}
	/**
	* Render the trajectory graph of one session.
	* @param props - the tab's context, scope and visibility.
	* @returns the graph tab.
	*/
	function TrajectoryGraph(props) {
		const { ctx, scope, active } = props;
		const uid = (0, react.useId)().replace(/[^a-zA-Z0-9]/g, "");
		const arrowId = `traj-arrow-${uid}`;
		const arrowLiveId = `traj-arrow-live-${uid}`;
		const scrollRef = (0, react.useRef)(null);
		const dragRef = (0, react.useRef)(null);
		const [dragging, setDragging] = (0, react.useState)(false);
		const [follow, setFollow] = (0, react.useState)(true);
		const [scale, setScale] = (0, react.useState)(1);
		const [selectedId, setSelectedId] = (0, react.useState)(null);
		const [hoverId, setHoverId] = (0, react.useState)(null);
		const [replay, setReplay] = (0, react.useState)(null);
		const [, bump] = (0, react.useState)(0);
		const source = (0, react.useMemo)(() => resolveTrajectorySource(ctx, scope.sessionId), [ctx, scope.sessionId]);
		(0, react.useEffect)(() => {
			if (!active || source === null) return;
			let frame = 0;
			const unsubscribe = source.subscribe(() => {
				if (frame !== 0) return;
				frame = requestAnimationFrame(() => {
					frame = 0;
					bump((current) => current + 1);
				});
			});
			return () => {
				if (frame !== 0) cancelAnimationFrame(frame);
				unsubscribe();
			};
		}, [active, source]);
		const snapshot = source === null ? null : source.getSnapshot();
		const full = (0, react.useMemo)(() => buildTrajectoryGraph(snapshot), [snapshot]);
		const windowed = (0, react.useMemo)(() => windowTrajectoryGraph(full, RENDER_LIMIT), [full]);
		const layout = (0, react.useMemo)(() => layoutTrajectoryGraph(windowed.graph), [windowed]);
		const modelById = (0, react.useMemo)(() => new Map(windowed.graph.nodes.map((node) => [node.id, node])), [windowed]);
		const edgeById = (0, react.useMemo)(() => new Map(layout.edges.map((edge) => [edge.id, edge])), [layout]);
		const laidById = (0, react.useMemo)(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout]);
		const timeline = windowed.graph.timeline;
		(0, react.useEffect)(() => {
			if (!follow || replay !== null) return;
			const element = scrollRef.current;
			if (element === null) return;
			element.scrollTop = element.scrollHeight;
		}, [
			follow,
			replay,
			layout
		]);
		(0, react.useEffect)(() => {
			if (replay === null || !replay.playing) return;
			if (replay.index >= timeline.length) {
				setReplay((current) => current === null ? null : {
					...current,
					playing: false
				});
				return;
			}
			const timer = setTimeout(() => {
				setReplay((current) => current === null ? null : {
					...current,
					index: current.index + 1
				});
			}, hopDelay(timeline, replay.index, replay.speed));
			return () => {
				clearTimeout(timer);
			};
		}, [replay, timeline]);
		(0, react.useEffect)(() => {
			if (replay === null || replay.index === 0) return;
			const element = scrollRef.current;
			const step = timeline[replay.index - 1];
			if (element === null || step === void 0) return;
			const laid = layout.nodes.find((node) => node.id === step.nodeId);
			if (laid === void 0) return;
			const top = laid.y * scale;
			const bottom = (laid.y + laid.h) * scale;
			if (top < element.scrollTop || bottom > element.scrollTop + element.clientHeight) element.scrollTop = Math.max(0, top - element.clientHeight / 2);
		}, [
			replay,
			layout,
			scale,
			timeline
		]);
		(0, react.useEffect)(() => {
			const element = scrollRef.current;
			if (element === null) return;
			const onWheel = (event) => {
				if (!event.ctrlKey && !event.metaKey) return;
				event.preventDefault();
				setReplay((current) => current === null ? null : {
					...current,
					playing: false
				});
				setFollow(false);
				setScale((current) => clamp(current * (event.deltaY > 0 ? .9 : 1.1), ZOOM_MIN, ZOOM_MAX));
			};
			element.addEventListener("wheel", onWheel, { passive: false });
			return () => {
				element.removeEventListener("wheel", onWheel);
			};
		}, []);
		(0, react.useEffect)(() => {
			if (!dragging) return;
			const move = (event) => {
				const start = dragRef.current;
				const element = scrollRef.current;
				if (start === null || element === null) return;
				const dx = event.clientX - start.x;
				const dy = event.clientY - start.y;
				if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setFollow(false);
				element.scrollLeft = start.left - dx;
				element.scrollTop = start.top - dy;
			};
			const stop = () => {
				dragRef.current = null;
				setDragging(false);
			};
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", stop);
			window.addEventListener("pointercancel", stop);
			return () => {
				window.removeEventListener("pointermove", move);
				window.removeEventListener("pointerup", stop);
				window.removeEventListener("pointercancel", stop);
			};
		}, [dragging]);
		const onPointerDown = (0, react.useCallback)((event) => {
			if (event.button !== 0) return;
			const element = scrollRef.current;
			if (element === null) return;
			dragRef.current = {
				x: event.clientX,
				y: event.clientY,
				left: element.scrollLeft,
				top: element.scrollTop
			};
			setDragging(true);
		}, []);
		const startReplay = (0, react.useCallback)(() => {
			setFollow(false);
			setReplay((current) => current === null ? {
				index: 0,
				playing: true,
				speed: 1
			} : {
				...current,
				index: current.index >= timeline.length ? 0 : current.index,
				playing: true
			});
		}, [timeline.length]);
		const statTokens = (0, react.useMemo)(() => {
			const tokens = windowed.graph.stats.tokens;
			return (tokens.input ?? 0) + (tokens.output ?? 0);
		}, [windowed]);
		const selected = selectedId === null ? void 0 : modelById.get(selectedId);
		const activeEdgeId = (replay === null || replay.index === 0 ? void 0 : timeline[replay.index - 1])?.edgeId;
		const activeEdge = activeEdgeId === null || activeEdgeId === void 0 ? void 0 : edgeById.get(activeEdgeId);
		if (source === null || windowed.graph.nodes.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: cx(trajectory_graph_module_css_default.wrap, !active && trajectory_graph_module_css_default.paused),
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: trajectory_graph_module_css_default.empty,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: source === null ? t("trajUnavailable") : t("trajEmpty") }), source === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: trajectory_graph_module_css_default.emptyHint,
					children: t("trajUnavailableHint")
				})]
			})
		});
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: cx(trajectory_graph_module_css_default.wrap, !active && trajectory_graph_module_css_default.paused),
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: trajectory_graph_module_css_default.bar,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: trajectory_graph_module_css_default.stat,
							children: t("trajStatsNodes", { n: windowed.graph.stats.nodes })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: trajectory_graph_module_css_default.stat,
							children: t("trajStatsEdges", { n: windowed.graph.stats.edges })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: trajectory_graph_module_css_default.stat,
							children: t("trajStatsTurns", { n: windowed.graph.stats.turns })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: trajectory_graph_module_css_default.stat,
							children: t("trajStatsTokens", { n: statTokens })
						}),
						full.live && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: trajectory_graph_module_css_default.liveDot,
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: trajectory_graph_module_css_default.spacer }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: trajectory_graph_module_css_default.tool,
							"aria-label": t("trajZoomOut"),
							title: t("trajZoomOut"),
							onClick: () => {
								setScale((current) => clamp(current - .15, ZOOM_MIN, ZOOM_MAX));
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: trajectory_graph_module_css_default.glyph,
								children: "−"
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: trajectory_graph_module_css_default.tool,
							"aria-label": t("trajZoomIn"),
							title: t("trajZoomIn"),
							onClick: () => {
								setScale((current) => clamp(current + .15, ZOOM_MIN, ZOOM_MAX));
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: trajectory_graph_module_css_default.glyph,
								children: "+"
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: trajectory_graph_module_css_default.tool,
							"aria-label": t("trajFit"),
							title: t("trajFit"),
							onClick: () => {
								const element = scrollRef.current;
								if (element === null) return;
								setFollow(false);
								setScale(clamp((element.clientWidth - 4) / layout.width, ZOOM_MIN, ZOOM_MAX));
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFullscreenOutline16, { size: 14 })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: trajectory_graph_module_css_default.tool,
							"aria-pressed": follow,
							"aria-label": t("trajFollow"),
							title: t("trajFollow"),
							onClick: () => {
								setReplay(null);
								setFollow((current) => !current);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { size: 14 })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: trajectory_graph_module_css_default.tool,
							"aria-label": replay?.playing === true ? t("trajPause") : t("trajReplay"),
							title: replay?.playing === true ? t("trajPause") : t("trajReplay"),
							onClick: () => {
								if (replay === null) startReplay();
								else setReplay((current) => current === null ? null : {
									...current,
									playing: !current.playing
								});
							},
							children: replay?.playing === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPauseOutline16, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutline16, { size: 14 })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: trajectory_graph_module_css_default.tool,
							"aria-label": t("trajSpeed"),
							title: t("trajSpeed"),
							disabled: replay === null,
							onClick: () => {
								setReplay((current) => current === null ? null : {
									...current,
									speed: SPEEDS[(SPEEDS.indexOf(current.speed) + 1) % SPEEDS.length] ?? 1
								});
							},
							children: ["×", replay?.speed ?? 1]
						}),
						replay !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: trajectory_graph_module_css_default.tool,
							"aria-label": t("trajStop"),
							title: t("trajStop"),
							onClick: () => {
								setReplay(null);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFill16, { size: 12 })
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: trajectory_graph_module_css_default.legend,
					children: [
						"input",
						"model",
						"tool"
					].map((lane) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: trajectory_graph_module_css_default.legendItem,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: cx(trajectory_graph_module_css_default.legendDot, LANE_CLASS[lane]),
							"aria-hidden": "true"
						}), t(LANE_KEY[lane])]
					}, lane))
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: scrollRef,
					className: cx(trajectory_graph_module_css_default.canvas, dragging && trajectory_graph_module_css_default.canvasDragging),
					onPointerDown,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
						className: trajectory_graph_module_css_default.svg,
						width: Math.round(layout.width * scale),
						height: Math.round(layout.height * scale),
						viewBox: `0 0 ${layout.width} ${layout.height}`,
						role: "img",
						"aria-label": t("trajectory"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("defs", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("marker", {
								id: arrowId,
								viewBox: "0 0 8 8",
								refX: "7",
								refY: "4",
								markerWidth: "6",
								markerHeight: "6",
								orient: "auto-start-reverse",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									className: trajectory_graph_module_css_default.arrow,
									d: "M 0 0 L 8 4 L 0 8 z"
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("marker", {
								id: arrowLiveId,
								viewBox: "0 0 8 8",
								refX: "7",
								refY: "4",
								markerWidth: "6",
								markerHeight: "6",
								orient: "auto-start-reverse",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									className: trajectory_graph_module_css_default.arrowLive,
									d: "M 0 0 L 8 4 L 0 8 z"
								})
							})] }),
							layout.bands.map((band) => band.turn === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
								className: trajectory_graph_module_css_default.band,
								x: 0,
								y: band.y,
								width: layout.width,
								height: band.height,
								rx: 6
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
								className: trajectory_graph_module_css_default.bandLabel,
								x: 8,
								y: band.y + 14,
								children: t("trajTurn", { n: band.turn })
							})] }, `band-${band.turn}-${band.from}`)),
							layout.edges.map((edge) => {
								const from = laidById.get(edge.from);
								const hidden = replay !== null && from !== void 0 && from.index >= replay.index;
								const hot = hoverId !== null && (edge.from === hoverId || edge.to === hoverId);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										className: cx(trajectory_graph_module_css_default.edge, EDGE_CLASS[edge.kind], edge.live && trajectory_graph_module_css_default.edgeLive, hidden && trajectory_graph_module_css_default.edgeDim, hot && trajectory_graph_module_css_default.edgeHot),
										d: edge.d,
										markerEnd: `url(#${edge.live ? arrowLiveId : arrowId})`
									}),
									edge.live && active && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										className: trajectory_graph_module_css_default.flow,
										d: edge.d
									}),
									edge.live && active && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
										className: trajectory_graph_module_css_default.packet,
										r: 2.6,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("animateMotion", {
											dur: "1.1s",
											repeatCount: "indefinite",
											path: edge.d
										})
									})
								] }, edge.id);
							}),
							active && activeEdge !== void 0 && replay !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								className: trajectory_graph_module_css_default.packetHot,
								r: 3.2,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("animateMotion", {
									dur: `${Math.max(.12, hopDelay(timeline, replay.index - 1, replay.speed) / 1e3)}s`,
									repeatCount: "1",
									fill: "freeze",
									path: activeEdge.d
								})
							}, `hop-${replay.index}`),
							layout.nodes.map((node) => {
								const model = modelById.get(node.id);
								if (model === void 0) return null;
								const hidden = replay !== null && node.index >= replay.index;
								const hot = hoverId === node.id || selectedId === node.id;
								const badge = model.badge === void 0 || model.badge === "" ? void 0 : model.badge;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
									className: cx(trajectory_graph_module_css_default.node, node.live && trajectory_graph_module_css_default.nodeLive, hidden && trajectory_graph_module_css_default.nodeDim, hot && trajectory_graph_module_css_default.nodeHot),
									style: { "--node-accent": ACCENT[model.kind] },
									transform: `translate(${node.x} ${node.y})`,
									role: "button",
									tabIndex: 0,
									"aria-label": `${model.kind} ${model.label}`,
									onClick: () => {
										setSelectedId((current) => current === node.id ? null : node.id);
									},
									onKeyDown: (event) => {
										if (event.key !== "Enter" && event.key !== " ") return;
										event.preventDefault();
										setSelectedId((current) => current === node.id ? null : node.id);
									},
									onMouseEnter: () => {
										setHoverId(node.id);
									},
									onMouseLeave: () => {
										setHoverId((current) => current === node.id ? null : current);
									},
									onFocus: () => {
										setHoverId(node.id);
									},
									onBlur: () => {
										setHoverId((current) => current === node.id ? null : current);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
											className: trajectory_graph_module_css_default.nodeRect,
											width: node.w,
											height: node.h,
											rx: 7
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
											className: trajectory_graph_module_css_default.nodeAccent,
											x: 0,
											y: 0,
											width: 3,
											height: node.h,
											rx: 1.5
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
											className: trajectory_graph_module_css_default.nodeLabel,
											x: 10,
											y: badge === void 0 ? node.h / 2 + 4 : node.h / 2 - 1,
											children: ellipsize(model.label, node.w - 18, 11)
										}),
										badge !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
											className: trajectory_graph_module_css_default.nodeBadge,
											x: 10,
											y: node.h / 2 + 11,
											children: ellipsize(`${badge} · ${clockOf(model.time)}`, node.w - 18, 9)
										})
									]
								}, node.id);
							})
						]
					})
				}),
				windowed.hidden > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: trajectory_graph_module_css_default.note,
					children: t("trajCollapsed", { n: windowed.hidden })
				}),
				selected === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: trajectory_graph_module_css_default.note,
					children: t("trajInspectorHint")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: trajectory_graph_module_css_default.inspector,
					style: { "--node-accent": ACCENT[selected.kind] },
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: trajectory_graph_module_css_default.inspectorHead,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: trajectory_graph_module_css_default.inspectorKind,
									children: selected.kind
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: trajectory_graph_module_css_default.inspectorLane,
									children: t(LANE_KEY[selected.lane])
								}),
								statusLabel(selected.status) !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: trajectory_graph_module_css_default.inspectorStatus,
									"data-status": selected.status,
									children: statusLabel(selected.status)
								}),
								selected.live && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: trajectory_graph_module_css_default.liveDot,
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: trajectory_graph_module_css_default.spacer }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: trajectory_graph_module_css_default.tool,
									"aria-label": t("close"),
									title: t("close"),
									onClick: () => {
										setSelectedId(null);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 })
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: trajectory_graph_module_css_default.inspectorMeta,
							children: [
								`${t("trajSeq")} ${selected.seq}`,
								clockOf(selected.time),
								selected.durationMs === void 0 ? null : `${t("trajDuration")} ${durationOf(selected.durationMs)}`,
								selected.tokens === void 0 ? null : t("trajUsage", {
									input: selected.tokens.input ?? 0,
									output: selected.tokens.output ?? 0
								})
							].filter((part) => part !== null).join(" · ")
						}),
						selected.detail !== void 0 && selected.detail !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
							className: trajectory_graph_module_css_default.inspectorBody,
							children: selected.detail
						})
					]
				})
			]
		});
	}
	//#endregion
	exports.TrajectoryGraph = TrajectoryGraph;
	return module.exports;
};

//# sourceMappingURL=client-trajectory.js.map