window.__ModuleLoader__.load({
	id: "dsh-coding-sidebar",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_dom_client = require("react-dom/client");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		/** The title-bar / shell compatibility schemes (see {@link SidebarPrefs.titleBarScheme}). */
		const TITLE_BAR_SCHEMES = [
			"auto",
			"web",
			"preset",
			"custom"
		];
		/** Fallback prefs used whenever the settings document is unreachable or malformed. */
		const SIDEBAR_PREFS_DEFAULTS = {
			openByDefault: false,
			defaultWidthPercent: 35,
			autoOpenSubagent: true,
			autoOpenJobs: true,
			agentTerminalTools: false,
			agentOpenTools: false,
			terminalFontFamily: "",
			terminalFontSize: 13,
			interceptOpenPath: true,
			editorExplorer: false,
			terminalShell: "",
			terminalShellArgs: "",
			titleBarScheme: "auto",
			titleBarPresetId: "",
			customCss: "",
			titleBarCompat: false,
			titleBarStripPx: 40,
			htmlViewerNoSandbox: false,
			htmlViewerDefaultUnsafe: false,
			browserNoSandbox: false,
			browserInterceptLinks: true,
			browserInterceptHttp: true,
			browserInterceptHttps: true,
			tabsEnabled: {},
			viewersEnabled: {},
			pluginSettings: {}
		};
		/** Clamp one width percent into the contract range (shared by schema and client reads). */
		function clampWidthPercent(value) {
			return Math.min(60, Math.max(20, Math.round(value)));
		}
		/** Clamp one terminal font size into the contract range (shared by schema and client reads). */
		function clampTerminalFontSize(value) {
			return Math.min(32, Math.max(9, Math.round(value)));
		}
		/** Clamp one title-bar strip height into the contract range (shared by schema and client reads). */
		function clampTitleBarStrip(value) {
			return Math.min(120, Math.max(0, Math.round(value)));
		}
		/** Whether a viewport width is narrow (mobile). */
		function isNarrowWidth(width) {
			return width < 768;
		}
		/**
		* Live narrow-viewport flag for components. Reads `window.innerWidth` and
		* re-measures on resize (rAF-throttled, the repo's existing drag pattern).
		* Deliberately avoids `matchMedia` (jsdom does not implement it) — the
		* resize listener is equally exact for a breakpoint that never changes
		* while the page is open.
		*/
		function useViewportSize() {
			const [size, setSize] = (0, react.useState)(() => ({
				width: typeof window === "undefined" ? 0 : window.innerWidth,
				height: typeof window === "undefined" ? 0 : window.innerHeight
			}));
			(0, react.useEffect)(() => {
				if (typeof window === "undefined") return;
				let frame = null;
				const measure = () => {
					frame = null;
					setSize({
						width: window.innerWidth,
						height: window.innerHeight
					});
				};
				const onResize = () => {
					if (frame === null) frame = requestAnimationFrame(measure);
				};
				window.addEventListener("resize", onResize);
				return () => {
					window.removeEventListener("resize", onResize);
					if (frame !== null) cancelAnimationFrame(frame);
				};
			}, []);
			return size;
		}
		let nextIdCounter = 0;
		/** Unique pane/tab id within one state instance. */
		function uid(prefix) {
			nextIdCounter += 1;
			return `${prefix}:${nextIdCounter}`;
		}
		/** Mint a fresh uid-based tab id. The `'editor:' + path` convention only
		*  covers openSidebarFile opens (per-path dedupe); opens that must not
		*  dedupe (the tree's "open to the side") mint through here. */
		function mintTabId() {
			return uid("tab");
		}
		/**
		* The largest numeric suffix across a raw persisted state's counter ids
		* (`pane:N` / `tab:N` / `split:N` / `float:N`). The uid counter is module-global and
		* resets on every reload, so a split minted AFTER a reload would collide
		* with the persisted ids (a fresh "pane:1" beside the persisted "pane:1");
		* mapLeaf would then visit BOTH leaves and every open would land in both
		* panes of the split. Seeding the counter past the persisted ids keeps
		* fresh ids disjoint.
		*/
		function maxCounterId(parsed) {
			let max = 0;
			const consider = (id) => {
				if (typeof id !== "string") return;
				const match = /^(?:pane|tab|split|float):(\d+)$/.exec(id);
				if (match !== null) max = Math.max(max, Number(match[1]));
			};
			const walk = (node) => {
				if (node === null || typeof node !== "object") return;
				const record = node;
				consider(record.id);
				if (Array.isArray(record.tabs)) {
					for (const tab of record.tabs) if (tab !== null && typeof tab === "object") consider(tab.id);
				}
				if (Array.isArray(record.children)) for (const child of record.children) walk(child);
			};
			walk(parsed?.splits);
			walk(parsed?.bottomSplits);
			const floats = parsed?.floats;
			if (Array.isArray(floats)) {
				for (const float of floats) if (float !== null && typeof float === "object") consider(float.id);
			}
			return max;
		}
		/** A fresh default state: one seeded tab in one pane, open per the caller's
		* preference. `width` is the caller's preferred panel width (default
		* PANEL_DEFAULT) and `panelOpen` whether the panel starts expanded (default
		* true); the store seeds new sessions from the user's side card prefs.
		* `seed` picks the seeded tab: 'editor-home' places the EMPTY files window
		* (an editor tab with no path whose tree panel starts open,
		* `meta.treeOpen: true`) — in BOTH editorExplorer modes that window is the
		* file explorer page — and 'none' starts with an empty pane (the store
		* passes it when the user disabled the editor tab type in settings). */
		function makeDefaultState(width = 400, panelOpen = true, seed = "editor-home") {
			const leaf = {
				kind: "leaf",
				id: uid("pane"),
				tabs: [],
				active: null
			};
			if (seed === "editor-home") {
				leaf.tabs = [{
					id: uid("tab"),
					type: "editor",
					title: "Files",
					meta: { treeOpen: true }
				}];
				leaf.active = leaf.tabs[0].id;
			}
			return {
				panelOpen,
				width,
				activePane: leaf.id,
				nextTerminal: 1,
				nextBrowser: 1,
				expanded: [],
				revealed: [],
				splits: leaf,
				floats: [],
				agentWaits: {}
			};
		}
		/** Whether a tree node (or any descendant) carries the given pane/split id. */
		function treeHasId(node, id) {
			if (node.id === id) return true;
			if (node.kind === "split") return node.children.some((child) => treeHasId(child, id));
			return false;
		}
		/** Which tree owns a pane/split id. The bottom panel was removed in v1.0.0 —
		*  only the right tree remains; kept as a function so call sites stay
		*  written against the (formerly two-tree) resolution seam. */
		function treeOf(_state, _id) {
			return "splits";
		}
		/** Walk the tree and apply `visit` to the leaf with the given id. */
		function mapLeaf(node, paneId, visit) {
			if (node.kind === "leaf") {
				if (node.id === paneId) {
					const copy = {
						...node,
						tabs: [...node.tabs]
					};
					visit(copy);
					return copy;
				}
				return node;
			}
			const split = node;
			return {
				...split,
				sizes: [...split.sizes],
				children: split.children.map((child) => mapLeaf(child, paneId, visit))
			};
		}
		/** The first leaf of the tree (fallback pane when activePane is gone). */
		function firstLeaf(node) {
			if (node.kind === "leaf") return node;
			return firstLeaf(node.children[0]);
		}
		/** Find the leaf containing a tab id, if any. */
		function leafWithTab(node, tabId) {
			if (node.kind === "leaf") return node.tabs.some((tab) => tab.id === tabId) ? node : void 0;
			for (const child of node.children) {
				const found = leafWithTab(child, tabId);
				if (found !== void 0) return found;
			}
		}
		/** All leaves of the tree, depth-first. */
		function allLeaves(node) {
			if (node.kind === "leaf") return [node];
			return node.children.flatMap(allLeaves);
		}
		/** Whether a tab exists anywhere in a state (any pane, or any free window —
		*  a floating tab is as open as a docked one). */
		function tabOpenIn(state, tabId) {
			return allLeaves(state.splits).some((leaf) => leaf.tabs.some((tab) => tab.id === tabId)) || state.floats.some((float) => float.tab.id === tabId);
		}
		/** The free window holding a tab id, if any. */
		function floatWithTab(state, tabId) {
			return state.floats.find((float) => float.tab.id === tabId);
		}
		/** The free window with the given window id, if any. */
		function floatById(state, floatId) {
			return state.floats.find((float) => float.id === floatId);
		}
		/**
		* Split a leaf by inserting a fresh leaf holding `tab` beside it — the
		* VSCode drag-to-edge gesture. `dir` is the split direction ('row' for
		* left/right, 'col' for up/down); `front` places the new leaf first (left/
		* up) or second (right/down).
		* @returns the new tree plus the fresh leaf's id (the drop's active pane).
		*/
		function insertLeafAt(node, paneId, dir, tab, front) {
			const fresh = {
				kind: "leaf",
				id: uid("pane"),
				tabs: [tab],
				active: tab.id
			};
			const leafId = fresh.id;
			return {
				node: mapLeaf(node, paneId, (leaf) => {
					const target = { ...leaf };
					const split = {
						kind: "split",
						id: uid("split"),
						dir,
						sizes: [.5, .5],
						children: front ? [fresh, target] : [target, fresh]
					};
					Object.assign(leaf, split);
				}),
				leafId
			};
		}
		/**
		* The VSCode drag gesture: move a tab out of its pane and either merge it
		* into the target pane (center) or split the target pane with the tab in a
		* fresh leaf (edge). The source pane collapses when it empties.
		*/
		function moveTabToEdge(state, fromPane, tabId, toPane, zone) {
			if (fromPane === toPane && zone === "center") return moveTab(state, fromPane, tabId, toPane, -1);
			const node = state[treeOf(state, fromPane)];
			const source = leafWithTab(node, tabId);
			if (source === void 0) return state;
			const tab = source.tabs.find((candidate) => candidate.id === tabId);
			let emptied = false;
			let splits = mapLeaf(node, source.id, (leaf) => {
				leaf.tabs = leaf.tabs.filter((candidate) => candidate.id !== tabId);
				if (leaf.active === tabId) leaf.active = leaf.tabs[leaf.tabs.length - 1]?.id ?? null;
				if (leaf.tabs.length === 0) emptied = true;
			});
			if (emptied) splits = removeLeafAt(splits, source.id);
			if (zone === "center") {
				splits = mapLeaf(splits, toPane, (leaf) => {
					leaf.tabs = [...leaf.tabs, tab];
					leaf.active = tab.id;
				});
				return {
					...state,
					splits,
					activePane: toPane
				};
			}
			const result = insertLeafAt(splits, toPane, zone === "left" || zone === "right" ? "row" : "col", tab, zone === "left" || zone === "up");
			return {
				...state,
				splits: result.node,
				activePane: result.leafId
			};
		}
		/**
		* Remove a leaf from the tree. A split left with one child promotes that
		* child; removing the last leaf yields an empty leaf.
		*/
		function removeLeafAt(node, paneId) {
			if (node.kind === "leaf") return node.id === paneId ? {
				...node,
				tabs: [],
				active: null
			} : node;
			const children = node.children.filter((child) => !(child.kind === "leaf" && child.id === paneId));
			if (children.length === node.children.length) return {
				...node,
				sizes: [...node.sizes],
				children: node.children.map((child) => removeLeafAt(child, paneId))
			};
			if (children.length === 1) return children[0];
			return {
				...node,
				sizes: [...node.sizes],
				children
			};
		}
		/** Close a tab; an emptied leaf is removed (unless it is the only pane). */
		function closeTab(state, paneId, tabId) {
			const key = treeOf(state, paneId);
			let emptied = false;
			const splits = mapLeaf(state[key], paneId, (leaf) => {
				leaf.tabs = leaf.tabs.filter((tab) => tab.id !== tabId);
				if (leaf.active === tabId) leaf.active = leaf.tabs[leaf.tabs.length - 1]?.id ?? null;
				if (leaf.tabs.length === 0) emptied = true;
			});
			return {
				...state,
				[key]: emptied ? removeLeafAt(splits, paneId) : splits
			};
		}
		/** Activate a tab in its pane (the pane's own tree). */
		function activateTab(state, paneId, tabId) {
			const key = treeOf(state, paneId);
			return {
				...state,
				activePane: paneId,
				[key]: mapLeaf(state[key], paneId, (leaf) => {
					if (leaf.tabs.some((tab) => tab.id === tabId)) leaf.active = tabId;
				})
			};
		}
		/** Update the display fields of one open tab (title / path / meta) without
		*  re-opening it. The browser tab persists its FULL navigation snapshot
		*  (history + revision chain) plus current URL and hostname title through
		*  this reducer, so a reload or remount restores and replays the visited
		*  page (upstream native browser semantics). A missing tab id is a no-op.
		*  The tab may live in any pane or a free window. */
		function patchTab(state, tabId, patch) {
			let changed = false;
			const apply = (tab) => {
				changed = true;
				return {
					...tab,
					...patch.title !== void 0 ? { title: patch.title } : {},
					...patch.path !== void 0 ? { path: patch.path } : {},
					...patch.meta !== void 0 ? { meta: patch.meta } : {}
				};
			};
			const walk = (node) => {
				if (node.kind === "leaf") {
					const tabs = node.tabs.map((tab) => tab.id === tabId ? apply(tab) : tab);
					return tabs === node.tabs ? node : {
						...node,
						tabs
					};
				}
				const children = node.children.map(walk);
				return children === node.children ? node : {
					...node,
					children
				};
			};
			const splits = walk(state.splits);
			const floats = state.floats.map((float) => float.tab.id === tabId ? {
				...float,
				tab: apply(float.tab)
			} : float);
			return changed ? {
				...state,
				splits,
				floats
			} : state;
		}
		/**
		* Set or clear the pin marker on one open tab (v0.17.0+). A pin marker is
		* structural metadata (NOT display fields like title/path), so it walks
		* the split tree AND the free windows exactly like {@link patchTab} —
		* the tab may live in a pane or float. Passing `null` clears the pin
		* (the tab stays open in its home session); passing a `{ scope, homeCwd }`
		* object sets it. An unknown tab id is a strict no-op (same reference
		* returned) so a stale pin request never churns the state or rewrites
		* localStorage.
		* @param state - the current per-session sidebar state.
		* @param tabId - the tab to pin/unpin.
		* @param pin - the pin marker to set, or null to clear.
		* @returns the next state (or the same reference when the tab is missing
		*          or the pin marker is already the requested value).
		*/
		function setTabPin(state, tabId, pin) {
			let changed = false;
			const apply = (tab) => {
				if (tab.type !== "terminal") return tab;
				if (pin === null) {
					if (tab.pin === void 0) return tab;
				} else if (tab.pin !== void 0 && tab.pin.scope === pin.scope && tab.pin.homeCwd === pin.homeCwd) return tab;
				changed = true;
				const { pin: _omit, ...rest } = tab;
				return pin === null ? rest : {
					...rest,
					pin
				};
			};
			const walk = (node) => {
				if (node.kind === "leaf") {
					const idx = node.tabs.findIndex((tab) => tab.id === tabId);
					if (idx < 0) return node;
					const oldTab = node.tabs[idx];
					const newTab = apply(oldTab);
					if (newTab === oldTab) return node;
					const tabs = node.tabs.slice();
					tabs[idx] = newTab;
					return {
						...node,
						tabs
					};
				}
				const children = node.children.map(walk);
				if (children.every((child, i) => child === node.children[i])) return node;
				return {
					...node,
					children
				};
			};
			const splits = walk(state.splits);
			const floatIdx = state.floats.findIndex((f) => f.tab.id === tabId);
			const floats = floatIdx < 0 ? state.floats : (() => {
				const oldFloat = state.floats[floatIdx];
				const newTab = apply(oldFloat.tab);
				if (newTab === oldFloat.tab) return state.floats;
				const next = state.floats.slice();
				next[floatIdx] = {
					...oldFloat,
					tab: newTab
				};
				return next;
			})();
			return changed ? {
				...state,
				splits,
				floats
			} : state;
		}
		/**
		* Land a tab in the active pane (or focus its existing instance by id).
		* Dedup strategies (single-instance, per-path, per-change) are owned by the
		* tab descriptor through {@link BetterSidebarService.openTab} / `dedupeKey`;
		* this reducer only handles the id-based safety net (reconcile and
		* openDiffTab already check existence before calling) and the landing
		* itself — the service's dedupe path delegates here after its dedupeKey
		* check misses.
		*
		* A stale activePane id (its pane was closed since) falls back to the
		* right tree's first pane instead of swallowing the open.
		*/
		function openTabInActivePane(state, tab) {
			let targetId = state.activePane ?? firstLeaf(state.splits).id;
			if (!allLeaves(state[treeOf(state, targetId)]).some((leaf) => leaf.id === targetId)) targetId = firstLeaf(state.splits).id;
			const targetKey = treeOf(state, targetId);
			for (const leaf of allLeaves(state.splits)) {
				const existing = leaf.tabs.find((candidate) => candidate.id === tab.id);
				if (existing !== void 0) return activateTab(state, leaf.id, existing.id);
			}
			const floated = floatWithTab(state, tab.id);
			if (floated !== void 0) return raiseFloat(state, floated.id);
			return {
				...state,
				activePane: targetId,
				[targetKey]: mapLeaf(state[targetKey], targetId, (leaf) => {
					leaf.tabs = [...leaf.tabs, tab];
					leaf.active = tab.id;
				})
			};
		}
		/** Move a tab from one pane to another (insert at index; -1 appends). */
		function moveTab(state, fromPane, tabId, toPane, index = -1) {
			let moved;
			let emptied = false;
			let splits = mapLeaf(state.splits, fromPane, (leaf) => {
				const found = leaf.tabs.find((tab) => tab.id === tabId);
				if (found === void 0) return;
				moved = found;
				leaf.tabs = leaf.tabs.filter((tab) => tab.id !== tabId);
				if (leaf.active === tabId) leaf.active = leaf.tabs[leaf.tabs.length - 1]?.id ?? null;
				if (leaf.tabs.length === 0) emptied = true;
			});
			if (moved === void 0) return state;
			if (emptied) splits = removeLeafAt(splits, fromPane);
			splits = mapLeaf(splits, toPane, (leaf) => {
				const insertAt = index >= 0 && index <= leaf.tabs.length ? index : leaf.tabs.length;
				leaf.tabs = [
					...leaf.tabs.slice(0, insertAt),
					moved,
					...leaf.tabs.slice(insertAt)
				];
				leaf.active = moved.id;
			});
			return {
				...state,
				splits,
				activePane: toPane
			};
		}
		/**
		* Open a diff tab the VSCode way: an existing instance of the same change is
		* focused wherever it lives; otherwise the tab joins the first pane that
		* already holds diff tabs (diff panes are sticky — repeated clicks stack
		* there); on the FIRST diff of a layout the source pane splits vertically so
		* the diff lands in a fresh pane below it ("默认在下半栏新增一个").
		*
		* This is split-tree placement surgery, not registry dispatch: the diff tab
		* descriptor's `dedupeKey` is `(tab) => tab.id`, and the existing-instance
		* check below is exactly that rule — the two agree by construction (asserted
		* in tests). Diff tabs minted by the Git view carry change-derived ids, so
		* the id check is the per-change dedupe.
		* @returns the new state, with the diff pane active.
		*/
		function openDiffTab(state, sourcePaneId, tab) {
			const existingLeaf = leafWithTab(state.splits, tab.id);
			if (existingLeaf !== void 0) return activateTab(state, existingLeaf.id, tab.id);
			const diffLeaf = allLeaves(state.splits).find((leaf) => leaf.tabs.some((candidate) => candidate.type === "diff"));
			if (diffLeaf !== void 0) return {
				...state,
				activePane: diffLeaf.id,
				splits: mapLeaf(state.splits, diffLeaf.id, (leaf) => {
					leaf.tabs = [...leaf.tabs, tab];
					leaf.active = tab.id;
				})
			};
			if (!allLeaves(state.splits).some((leaf) => leaf.id === sourcePaneId)) return openTabInActivePane(state, tab);
			const result = insertLeafAt(state.splits, sourcePaneId, "col", tab, false);
			return {
				...state,
				splits: result.node,
				activePane: result.leafId
			};
		}
		/** Toggle the panel open/closed (opening restores the previous layout). */
		function togglePanel(state) {
			return {
				...state,
				panelOpen: !state.panelOpen
			};
		}
		/** Set the panel width (clamped to the contract range; the upper bound is
		* the viewport so the fullscreen expansion can fill the window). */
		function setWidth(state, width) {
			const max = typeof window !== "undefined" ? Math.max(280, window.innerWidth) : 640;
			return {
				...state,
				width: Math.min(max, Math.max(280, Math.round(width)))
			};
		}
		/** Toggle a directory in the explorer expansion set. */
		function toggleExpanded(state, path) {
			const expanded = state.expanded.includes(path) ? state.expanded.filter((item) => item !== path) : [...state.expanded, path];
			return {
				...state,
				expanded
			};
		}
		/**
		* Reveal files in the explorer: expand every ancestor directory between the
		* explorer root and each file (so the lazy tree actually shows the row) and
		* record the paths for highlighting. The reveal set is transient —
		* sanitizeState never restores it, so a reload starts unhighlighted.
		* @param state - current sidebar state.
		* @param cwd - the explorer's root (session working directory).
		* @param files - absolute paths to highlight (parent dirs are expanded).
		* @returns the next state, or the same reference when nothing is revealed.
		*/
		function revealPaths(state, cwd, files) {
			const expanded = new Set(state.expanded);
			const revealed = [];
			const rootParts = (cwd ?? "").split(/[\\/]+/).filter((part) => part !== "");
			for (const file of files) {
				if (typeof file !== "string" || file === "") continue;
				revealed.push(file);
				const parts = file.split(/[\\/]+/).filter((part) => part !== "" && part !== ".");
				const separator = file.includes("\\") ? "\\" : "/";
				const prefix = file.startsWith("/") ? "/" : file.startsWith("\\\\") ? "\\\\" : file.startsWith("\\") ? "\\" : "";
				for (let i = rootParts.length; i < parts.length - 1; i++) expanded.add(prefix + parts.slice(0, i + 1).join(separator));
			}
			if (revealed.length === 0) return state;
			return {
				...state,
				expanded: [...expanded],
				revealed
			};
		}
		/** Adjust one split divider: `i` is the left/top child index, delta in fractions. */
		function resizeSplit(node, splitId, index, delta) {
			if (node.kind === "leaf") return node;
			if (node.id === splitId) {
				const sizes = [...node.sizes];
				const left = Math.min(.92, Math.max(.08, sizes[index] + delta));
				const right = Math.min(.92, Math.max(.08, sizes[index + 1] - delta));
				sizes[index] = left;
				sizes[index + 1] = right;
				return {
					...node,
					sizes
				};
			}
			return {
				...node,
				sizes: [...node.sizes],
				children: node.children.map((child) => resizeSplit(child, splitId, index, delta))
			};
		}
		/** State-level {@link resizeSplit} route: the divider may live in either
		*  tree (split ids are globally unique). */
		function resizeSplitIn(state, splitId, index, delta) {
			const key = treeOf(state, splitId);
			return {
				...state,
				[key]: resizeSplit(state[key], splitId, index, delta)
			};
		}
		/** The viewport size, or Infinity where there is no (usable) window — unit
		*  tests stub partial window objects, and a NaN bound would poison geometry. */
		function viewportW() {
			return typeof window !== "undefined" && Number.isFinite(window.innerWidth) ? window.innerWidth : Infinity;
		}
		function viewportH() {
			return typeof window !== "undefined" && Number.isFinite(window.innerHeight) ? window.innerHeight : Infinity;
		}
		/** Clamp free-window geometry: sizes respect the floor and the viewport, and
		*  the position keeps the whole window inside the viewport. Without a window
		*  (unit tests) only the floor applies — the caller's values pass through. */
		function clampFloatGeometry(x, y, w, h) {
			const vw = viewportW();
			const vh = viewportH();
			const width = Math.round(Math.min(Math.max(w, 320), Math.max(320, vw)));
			const height = Math.round(Math.min(Math.max(h, 200), Math.max(200, vh)));
			return {
				x: Math.round(Math.min(Math.max(x, 0), Math.max(0, vw - width))),
				y: Math.round(Math.min(Math.max(y, 0), Math.max(0, vh - height))),
				w: width,
				h: height
			};
		}
		/**
		* Float a docked tab: remove it from its pane (an emptied pane collapses
		* like any move) and append a free window centered on the drop
		* point, with the default size clamped to the viewport. The stacking order
		* is the array order, so a fresh window is born topmost. An unknown tab id
		* (or one already floating) is a strict no-op.
		*/
		function floatTab(state, tabId, x, y) {
			const source = leafWithTab(state.splits, tabId);
			if (source === void 0) return state;
			const key = "splits";
			const tab = source.tabs.find((candidate) => candidate.id === tabId);
			let emptied = false;
			let node = mapLeaf(state[key], source.id, (leaf) => {
				leaf.tabs = leaf.tabs.filter((candidate) => candidate.id !== tabId);
				if (leaf.active === tabId) leaf.active = leaf.tabs[leaf.tabs.length - 1]?.id ?? null;
				if (leaf.tabs.length === 0) emptied = true;
			});
			if (emptied) node = removeLeafAt(node, source.id);
			const vw = viewportW();
			const vh = viewportH();
			const width = Math.min(390, Math.max(320, vw - 24));
			const height = Math.min(780, Math.max(200, vh - 24));
			const window = clampFloatGeometry(x - width / 2, y - height / 2, width, height);
			const next = {
				...state,
				[key]: node,
				floats: [...state.floats, {
					id: uid("float"),
					tab,
					...window
				}]
			};
			if (emptied && state.activePane === source.id) next.activePane = firstLeaf(next.splits).id;
			return next;
		}
		/** Move a free window (clamped to the viewport); unknown ids are a no-op. */
		function moveFloat(state, floatId, x, y) {
			const float = floatById(state, floatId);
			if (float === void 0) return state;
			const geo = clampFloatGeometry(x, y, float.w, float.h);
			if (geo.x === float.x && geo.y === float.y) return state;
			return {
				...state,
				floats: state.floats.map((f) => f.id === floatId ? {
					...f,
					...geo
				} : f)
			};
		}
		/** Resize a free window from its SE corner: the top-left corner stays
		*  anchored, sizes clamp to the floor and to the viewport's remaining room. */
		function resizeFloat(state, floatId, w, h) {
			const float = floatById(state, floatId);
			if (float === void 0) return state;
			const vw = viewportW();
			const vh = viewportH();
			const width = Math.round(Math.min(Math.max(w, 320), Math.max(320, vw - float.x)));
			const height = Math.round(Math.min(Math.max(h, 200), Math.max(200, vh - float.y)));
			if (width === float.w && height === float.h) return state;
			return {
				...state,
				floats: state.floats.map((f) => f.id === floatId ? {
					...f,
					w: width,
					h: height
				} : f)
			};
		}
		/** Bring a free window to the top (the array's end). Already topmost (or the
		*  only window) returns the same reference — no persist churn on every click. */
		function raiseFloat(state, floatId) {
			if (state.floats.length < 2) return state;
			const index = state.floats.findIndex((f) => f.id === floatId);
			if (index < 0 || index === state.floats.length - 1) return state;
			const floats = [...state.floats];
			const [raised] = floats.splice(index, 1);
			floats.push(raised);
			return {
				...state,
				floats
			};
		}
		/** Dock a free window back into a pane (center merge): the tab joins the
		*  target pane and activates. `toPane` defaults to the active pane with the
		*  right tree's first leaf as the stale-id fallback (mirrors
		*  {@link openTabInActivePane}). Unknown window ids are a no-op. */
		function dockFloat(state, floatId, toPane) {
			const float = floatById(state, floatId);
			if (float === void 0) return state;
			let targetId = toPane ?? state.activePane ?? firstLeaf(state.splits).id;
			if (!allLeaves(state[treeOf(state, targetId)]).some((leaf) => leaf.id === targetId)) targetId = firstLeaf(state.splits).id;
			const targetKey = treeOf(state, targetId);
			return {
				...state,
				floats: state.floats.filter((f) => f.id !== floatId),
				activePane: targetId,
				[targetKey]: mapLeaf(state[targetKey], targetId, (leaf) => {
					leaf.tabs = [...leaf.tabs, float.tab];
					leaf.active = float.tab.id;
				})
			};
		}
		/** Close the free window holding a tab (the tab closes WITH the window —
		*  the caller fires the descriptor's onClose lifecycle). */
		function closeFloatByTab(state, tabId) {
			if (!state.floats.some((f) => f.tab.id === tabId)) return state;
			return {
				...state,
				floats: state.floats.filter((f) => f.tab.id !== tabId)
			};
		}
		/** Prefix marking a tab id as an agent-owned terminal (suffix is the uuid). */
		const AGENT_TAB_PREFIX = "agent:";
		/** Whether a tab id refers to an agent-owned terminal. */
		function isAgentTabId(tabId) {
			return tabId.startsWith(AGENT_TAB_PREFIX);
		}
		/** Extract the agent terminal uuid from an `agent:<uuid>` tab id. */
		function agentUuidOf(tabId) {
			return tabId.slice(6);
		}
		/** Build the sidebar tab id for one agent terminal uuid. */
		function agentTabId(uuid) {
			return `${AGENT_TAB_PREFIX}${uuid}`;
		}
		/** Shallow equality of two agent-wait maps (same keys, same needle+since). */
		function sameAgentWaits(a, b) {
			if (a === void 0) return Object.keys(b).length === 0;
			const aKeys = Object.keys(a);
			if (aKeys.length !== Object.keys(b).length) return false;
			for (const key of aKeys) {
				const av = a[key];
				const bv = b[key];
				if (av === void 0 || bv === void 0) return false;
				if (av.needle !== bv.needle || av.since !== bv.since) return false;
			}
			return true;
		}
		/**
		* Reconcile the sidebar's agent-terminal tabs with the host's live list.
		* The host pushes the current list of agent terminals (created by the model
		* through the `terminal_create` tool) over a dedicated WebSocket; this
		* reducer mirrors that list into tabs: new uuids get a tab, vanished uuids
		* lose theirs. The agent owns the lifetime — the user closing a tab sends a
		* WS close frame that kills the pty, which fires a change, which converges
		* the view. Idempotent: a no-op when the lists already match.
		* @param state - the current per-session sidebar state.
		* @param agentTerminals - the live agent terminal snapshots from the host.
		* @returns the next state (or the same reference if no change was needed).
		*/
		function reconcileAgentTerminals(state, agentTerminals) {
			const existingAgentTabs = allLeaves(state.splits).flatMap((leaf) => leaf.tabs).concat(state.floats.map((float) => float.tab)).filter((tab) => isAgentTabId(tab.id));
			const existingUuids = new Set(existingAgentTabs.map((tab) => agentUuidOf(tab.id)));
			const serverUuids = new Set(agentTerminals.map((t) => t.uuid));
			const toAdd = agentTerminals.filter((t) => !existingUuids.has(t.uuid));
			const toRemove = existingAgentTabs.filter((tab) => !serverUuids.has(agentUuidOf(tab.id)) && tab.pin === void 0);
			const serverWaits = {};
			for (const terminal of agentTerminals) if (terminal.waiting !== void 0 && terminal.waiting !== null) serverWaits[terminal.uuid] = {
				needle: terminal.waiting.needle,
				since: terminal.waiting.since
			};
			if (toAdd.length === 0 && toRemove.length === 0 && sameAgentWaits(state.agentWaits, serverWaits)) return state;
			let splits = state.splits;
			let floats = state.floats;
			for (const tab of toRemove) {
				const leaf = leafWithTab(splits, tab.id);
				if (leaf !== void 0) splits = closeTab({
					...state,
					splits
				}, leaf.id, tab.id).splits;
				if (floats.some((float) => float.tab.id === tab.id)) floats = floats.filter((float) => float.tab.id !== tab.id);
			}
			let next = {
				...state,
				splits,
				floats,
				agentWaits: serverWaits
			};
			for (const terminal of toAdd) {
				const tab = {
					id: agentTabId(terminal.uuid),
					type: "terminal",
					title: terminal.title
				};
				next = openTabInActivePane(next, tab);
			}
			return next;
		}
		const STORAGE_PREFIX = "dsh-sidebar:v1";
		/**
		* Cross-session panel width: the last dragged width, shared by EVERY
		* conversation (the panel width is a layout preference, not per-session
		* content). Written on every persist, read at session load and on
		* cache-hit session switches, so a drag in one conversation carries to all
		* the others (last drag wins).
		*/
		const GLOBAL_WIDTH_KEY = "dsh-sidebar:v1:width";
		/** Clamp one width to the contract and the current viewport (mirror of {@link setWidth}). */
		function clampWidth(width) {
			const max = typeof window !== "undefined" ? Math.max(280, window.innerWidth) : 640;
			return Math.min(max, Math.max(280, Math.round(width)));
		}
		/** Read the cross-session panel width (undefined when never dragged). */
		function readGlobalWidth() {
			try {
				const raw = localStorage.getItem(GLOBAL_WIDTH_KEY);
				if (raw !== null) {
					const parsed = Number(raw);
					if (Number.isFinite(parsed) && parsed > 0) return clampWidth(parsed);
				}
			} catch {}
		}
		/** Persist the cross-session panel width (best-effort, like the session states). */
		function writeGlobalWidth(width) {
			try {
				localStorage.setItem(GLOBAL_WIDTH_KEY, String(width));
			} catch {}
		}
		/** Default panel width for one viewport: the prefs percent of the window,
		* clamped to the panel floor (a tiny percent must stay usable) and to the
		* viewport (a large one must never cover the whole window). */
		function defaultWidthFor(viewport, percent) {
			return Math.min(viewport, Math.max(280, Math.round(viewport * percent / 100)));
		}
		/**
		* URL escape hatch (#369): loading the app with `?dsh-sidebar-reset` drops
		* the persisted layout for the session instead of restoring it. When a
		* restored tab hangs the page on mount (the #369 freeze loop), reloading
		* into the same state replays the hang forever; this param starts from the
		* default layout and clears the stored copy, breaking the loop. Persisting
		* resumes as soon as the param is gone from the URL.
		*/
		const RESET_PARAM = "dsh-sidebar-reset";
		/** Whether the current page load asked for a persisted-state reset. */
		function resetRequested() {
			try {
				return new URLSearchParams(window.location.search).has(RESET_PARAM);
			} catch {
				return false;
			}
		}
		function loadState(sessionId, prefs) {
			const reset = resetRequested();
			const viewport = typeof window !== "undefined" ? window.innerWidth : void 0;
			if (reset) try {
				localStorage.removeItem(`${STORAGE_PREFIX}:${sessionId}`);
				localStorage.removeItem(GLOBAL_WIDTH_KEY);
			} catch {}
			const globalWidth = reset ? void 0 : readGlobalWidth();
			if (!reset) try {
				const raw = localStorage.getItem(`${STORAGE_PREFIX}:${sessionId}`);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					nextIdCounter = maxCounterId(parsed);
					const sanitized = sanitizeState(parsed);
					if (sanitized !== void 0) {
						const restored = globalWidth === void 0 ? sanitized : {
							...sanitized,
							width: globalWidth
						};
						return viewport !== void 0 && isNarrowWidth(viewport) && restored.panelOpen ? {
							...restored,
							panelOpen: false
						} : restored;
					}
				}
			} catch {}
			return makeDefaultState(globalWidth ?? (viewport === void 0 ? 400 : defaultWidthFor(viewport, prefs.defaultWidthPercent)), prefs.openByDefault && (viewport === void 0 || !isNarrowWidth(viewport)), prefs.tabsEnabled["editor"] === false ? "none" : "editor-home");
		}
		/**
		* Structural validation of one persisted state. A malformed or stale shape
		* (older layouts, hand-edited storage) must fall back to the default instead
		* of crashing the panel on every reload; the restored width is also clamped
		* to the current viewport so a stale fullscreen width can never crush the
		* app shell (margin-right larger than the window) or cover the whole screen.
		* @returns a clean state, or undefined to fall back to the default.
		*/
		function sanitizeState(parsed) {
			if (parsed === null || typeof parsed !== "object") return void 0;
			const record = parsed;
			if (typeof record.panelOpen !== "boolean") return void 0;
			if (typeof record.width !== "number" || !Number.isFinite(record.width)) return void 0;
			if (typeof record.nextTerminal !== "number" || !Number.isInteger(record.nextTerminal) || record.nextTerminal < 1) return;
			const nextBrowser = typeof record.nextBrowser === "number" && Number.isInteger(record.nextBrowser) && record.nextBrowser >= 1 ? record.nextBrowser : 1;
			if (typeof record.activePane !== "string" && record.activePane !== null) return void 0;
			if (!Array.isArray(record.expanded) || record.expanded.some((item) => typeof item !== "string")) return void 0;
			const seen = /* @__PURE__ */ new Set();
			const reid = /* @__PURE__ */ new Map();
			const restoredSplits = sanitizeNode(record.splits, seen, reid);
			if (restoredSplits === void 0) return void 0;
			const splits = pruneEmptyPanes(restoredSplits);
			const legacyBottomSplits = pruneEmptyPanes(sanitizeNode(record.bottomSplits, seen, reid) ?? {
				kind: "leaf",
				id: uid("pane"),
				tabs: [],
				active: null
			});
			const floats = [];
			if (Array.isArray(record.floats)) for (const entry of record.floats) {
				if (entry === null || typeof entry !== "object") continue;
				const candidate = entry;
				if (typeof candidate.id !== "string" || seen.has(candidate.id)) continue;
				const tab = sanitizePersistedTab(candidate.tab);
				if (tab === void 0 || tab === "diff") continue;
				if (typeof candidate.x !== "number" || !Number.isFinite(candidate.x) || typeof candidate.y !== "number" || !Number.isFinite(candidate.y) || typeof candidate.w !== "number" || !Number.isFinite(candidate.w) || typeof candidate.h !== "number" || !Number.isFinite(candidate.h)) continue;
				seen.add(candidate.id);
				floats.push({
					id: candidate.id,
					tab,
					...clampFloatGeometry(candidate.x, candidate.y, candidate.w, candidate.h)
				});
			}
			const requestedActivePane = typeof record.activePane === "string" ? reid.get(record.activePane) ?? record.activePane : null;
			const activePane = requestedActivePane === null ? null : treeHasId(splits, requestedActivePane) ? requestedActivePane : firstLeaf(splits).id;
			const maxWidth = typeof window !== "undefined" ? window.innerWidth : Infinity;
			const legacyTabs = allLeaves(legacyBottomSplits).flatMap((leaf) => leaf.tabs);
			const migratedSplits = legacyTabs.length > 0 ? mapLeaf(splits, firstLeaf(splits).id, (leaf) => {
				leaf.tabs = [...leaf.tabs, ...legacyTabs];
			}) : splits;
			return {
				panelOpen: record.panelOpen,
				width: Math.max(280, Math.min(record.width, maxWidth)),
				activePane,
				nextTerminal: record.nextTerminal,
				nextBrowser,
				expanded: record.expanded,
				revealed: [],
				splits: migratedSplits,
				floats,
				agentWaits: {}
			};
		}
		/** Collapse persisted split panes left empty after ephemeral diff tabs are dropped. */
		function pruneEmptyPanes(node) {
			const leaves = allLeaves(node);
			if (!leaves.some((leaf) => leaf.tabs.length > 0)) return node;
			return leaves.reduce((tree, leaf) => leaf.tabs.length === 0 ? removeLeafAt(tree, leaf.id) : tree, node);
		}
		/**
		* One tree node id, deduplicated against the ids already seen in this
		* state. Duplicates are exactly the pre-seeding counter-reset corruption
		* (a "pane:1"/"split:1" minted after a reload beside the persisted ones):
		* keeping both would make mapLeaf visit two leaves at once and every open
		* would land in both panes, so the repeat gets a fresh id.
		* @returns the id to use (the original, or a fresh uid for repeats).
		*/
		function uniqueNodeId(id, seen, reid) {
			if (!seen.has(id)) {
				seen.add(id);
				return id;
			}
			const fresh = uid(/^split:\d+$/.test(id) ? "split" : "pane");
			seen.add(fresh);
			reid.set(id, fresh);
			return fresh;
		}
		/**
		* Validate one persisted tab record. @returns the clean tab, `'diff'` for an
		* ephemeral diff tab (dropped everywhere — diff tabs never survive a reload),
		* or undefined when the record is malformed (structural corruption when it
		* comes from a split-tree leaf; a malformed FLOAT tab only drops the window).
		*/
		function sanitizePersistedTab(tab) {
			if (tab === null || typeof tab !== "object") return void 0;
			const candidate = tab;
			if (typeof candidate.id !== "string" || typeof candidate.title !== "string") return void 0;
			if (candidate.type === "diff") return "diff";
			if (typeof candidate.type !== "string") return void 0;
			if (candidate.type === "explorer") {
				const meta = candidate.meta !== null && typeof candidate.meta === "object" && !Array.isArray(candidate.meta) ? candidate.meta : void 0;
				return {
					id: candidate.id,
					type: "editor",
					title: "Files",
					meta: {
						treeOpen: true,
						...meta
					}
				};
			}
			const result = {
				id: candidate.id,
				type: candidate.type,
				title: candidate.title,
				...typeof candidate.path === "string" ? { path: candidate.path } : {},
				...candidate.meta !== void 0 ? { meta: candidate.meta } : {}
			};
			const pin = candidate.pin;
			if (pin !== null && typeof pin === "object" && !Array.isArray(pin) && result.type === "terminal") {
				const pinRecord = pin;
				if (pinRecord.scope === "workspace" || pinRecord.scope === "global") {
					const homeCwd = pinRecord.homeCwd;
					result.pin = homeCwd === void 0 || typeof homeCwd === "string" ? {
						scope: pinRecord.scope,
						...typeof homeCwd === "string" ? { homeCwd } : {}
					} : { scope: pinRecord.scope };
				}
			}
			return result;
		}
		/** Validate one split-tree node (leaf or split) and rebuild it cleanly. */
		function sanitizeNode(node, seen, reid) {
			if (node === null || typeof node !== "object") return void 0;
			const record = node;
			if (record.kind === "leaf") {
				if (typeof record.id !== "string" || !Array.isArray(record.tabs)) return void 0;
				const tabs = [];
				let droppedDiff = false;
				for (const tab of record.tabs) {
					const clean = sanitizePersistedTab(tab);
					if (clean === void 0) return void 0;
					if (clean === "diff") {
						droppedDiff = true;
						continue;
					}
					tabs.push(clean);
				}
				const active = typeof record.active === "string" ? record.active : null;
				if (active !== null && !tabs.some((tab) => tab.id === active) && !droppedDiff) return void 0;
				return {
					kind: "leaf",
					id: uniqueNodeId(record.id, seen, reid),
					tabs,
					active: active !== null && tabs.some((tab) => tab.id === active) ? active : null
				};
			}
			if (record.kind === "split") {
				if (typeof record.id !== "string" || record.dir !== "row" && record.dir !== "col") return void 0;
				if (!Array.isArray(record.children) || !Array.isArray(record.sizes)) return void 0;
				const children = [];
				for (const child of record.children) {
					const clean = sanitizeNode(child, seen, reid);
					if (clean === void 0) return void 0;
					children.push(clean);
				}
				if (children.length < 2) return void 0;
				if (record.sizes.length !== children.length || record.sizes.some((size) => typeof size !== "number" || !Number.isFinite(size) || size <= 0)) return;
				return {
					kind: "split",
					id: uniqueNodeId(record.id, seen, reid),
					dir: record.dir,
					sizes: record.sizes,
					children
				};
			}
		}
		/** The session-scoped store: one state per conversation, localStorage-backed. */
		var SidebarStore = class {
			bySession = /* @__PURE__ */ new Map();
			snapshot = {
				sessionId: void 0,
				state: void 0,
				prefs: { ...SIDEBAR_PREFS_DEFAULTS }
			};
			listeners = /* @__PURE__ */ new Set();
			/** Per-session persist debounce timers (v0.12.0+: one per session, so a
			*  targeted open never cancels another session's pending write). */
			persistTimers = /* @__PURE__ */ new Map();
			/** User-facing side card prefs seeding brand-new session states (defaults until the settings RPC resolves). */
			prefs = { ...SIDEBAR_PREFS_DEFAULTS };
			/**
			* External disable (the dsh-web-ui family's aionui-panel provider choice):
			* while true the sidebar must not mount at all. Not part of the snapshot —
			* nothing renders on it; the mount gate and the intercept predicates read
			* it directly.
			*/
			suspended = false;
			/**
			* Set the external-disable flag (from the settings route) and remember it
			* for the mount gate and the intercept predicates.
			*/
			setSuspended(suspended) {
				this.suspended = suspended;
			}
			/** Whether the sidebar is externally disabled (aionui-panel chosen). */
			getSuspended() {
				return this.suspended;
			}
			/**
			* Replace the side card prefs (the settings RPC result / settings page
			* write). Notifies like any store change: the snapshot carries the prefs,
			* so consumers that gate on enable switches (the + menu, derived flows)
			* re-render with the new values immediately.
			*/
			setPrefs(prefs) {
				this.prefs = { ...prefs };
				this.snapshot = {
					...this.snapshot,
					prefs: this.prefs
				};
				this.notify();
			}
			/** The current side card prefs (seeds new sessions; persisted states win). */
			getPrefs() {
				return { ...this.prefs };
			}
			/** Select a session (or none); loads its persisted state. */
			setSession(sessionId) {
				if (this.snapshot.sessionId === sessionId) return;
				if (sessionId === void 0) this.snapshot = {
					sessionId: void 0,
					state: void 0,
					prefs: this.prefs
				};
				else {
					let state = this.bySession.get(sessionId);
					if (state === void 0) {
						state = loadState(sessionId, this.prefs);
						this.bySession.set(sessionId, state);
					} else {
						nextIdCounter = maxCounterId(state);
						const globalWidth = readGlobalWidth();
						if (globalWidth !== void 0 && state.width !== globalWidth) {
							state = {
								...state,
								width: globalWidth
							};
							this.bySession.set(sessionId, state);
						}
					}
					this.snapshot = {
						sessionId,
						state,
						prefs: this.prefs
					};
				}
				this.notify();
			}
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			getSnapshot() {
				return this.snapshot;
			}
			/** Mutate the current session's state (no-op without a session). */
			update(mutator) {
				const sessionId = this.snapshot.sessionId;
				const state = this.snapshot.state;
				if (sessionId === void 0 || state === void 0) return;
				const draft = structuredClone(state);
				mutator(draft);
				this.bySession.set(sessionId, draft);
				this.snapshot = {
					sessionId,
					state: draft,
					prefs: this.prefs
				};
				this.schedulePersist(sessionId, draft);
				this.notify();
			}
			/**
			* Whether a tab still exists in its session's state. Views use this on
			* unmount to tell "the tab was closed" (release the terminal now) from
			* "the tree re-rendered / the conversation switched" (the tab is still
			* open — keep the terminal alive through the host's reconnect grace).
			* Checks the session's own map entry (the current snapshot may already
			* point at another session when a conversation switch unmounts the old
			* one's tabs).
			*/
			tabOpen(sessionId, tabId) {
				const state = this.bySession.get(sessionId) ?? (this.snapshot.sessionId === sessionId ? this.snapshot.state : void 0);
				return state !== void 0 && tabOpenIn(state, tabId);
			}
			/**
			* Read-only view of EVERY cached session's state (v0.17.0+). The
			* PinnedRail uses this to collect pinned terminals across sessions
			* without each render reading private fields. The map is the live
			* `bySession` reference — callers MUST treat it as read-only (mutations
			* go through {@link reduce} / {@link reduceFor}). A session that has
			* never been visited in this run is absent (its pinned tabs are not
			* visible until first load — accepted as YAGNI by the design).
			*/
			getSessionStates() {
				return new Map(this.bySession);
			}
			/** Apply a pure reducer (returns the next state). */
			reduce(reducer) {
				const sessionId = this.snapshot.sessionId;
				const state = this.snapshot.state;
				if (sessionId === void 0 || state === void 0) return;
				const next = reducer(state);
				if (next === state) return;
				this.bySession.set(sessionId, next);
				this.snapshot = {
					sessionId,
					state: next,
					prefs: this.prefs
				};
				this.schedulePersist(sessionId, next);
				this.notify();
			}
			/**
			* Apply a pure reducer to a TARGET session's state (not the active one),
			* loading it on demand and persisting the result — WITHOUT switching the
			* active snapshot or notifying (the UI must not follow along). Used by the
			* service's targeted `openTab(seed, scope)`: the open lands in the target
			* session's layout and is visible whenever the user switches to it.
			*/
			reduceFor(sessionId, reducer) {
				const counterBefore = nextIdCounter;
				let state = this.bySession.get(sessionId);
				if (state === void 0) {
					state = loadState(sessionId, this.prefs);
					this.bySession.set(sessionId, state);
				} else nextIdCounter = maxCounterId(state);
				const next = reducer(state);
				nextIdCounter = Math.max(nextIdCounter, counterBefore);
				if (next === state) return;
				this.bySession.set(sessionId, next);
				this.schedulePersist(sessionId, next);
			}
			schedulePersist(sessionId, state) {
				if (sessionId === this.snapshot.sessionId) writeGlobalWidth(state.width);
				const existing = this.persistTimers.get(sessionId);
				if (existing !== void 0) window.clearTimeout(existing);
				const timer = window.setTimeout(() => {
					this.persistTimers.delete(sessionId);
					try {
						localStorage.setItem(`${STORAGE_PREFIX}:${sessionId}`, JSON.stringify(state));
					} catch {}
				}, 200);
				this.persistTimers.set(sessionId, timer);
			}
			notify() {
				for (const listener of [...this.listeners]) listener();
			}
		};
		/**
		* Create one sidebar store instance. Production code calls this only from
		* the client plugin's `apply` (the instance is handed to components as a
		* prop); tests call it directly. No module-level singleton: the store's
		* lifetime belongs to the plugin activation, exactly like the official
		* `createXXXStore()` factory rule.
		*/
		function createSidebarStore() {
			return new SidebarStore();
		}
		//#endregion
		//#region src/client/file-icon-registry.ts
		/**
		* Reserved `exts` values that claim DIRECTORY rows instead of file
		* extensions: `'folder'` matches a closed directory, `'folder-open'` an
		* expanded one ({@link FileIconRegistry.folderIcon} resolves them). They are
		* filtered out of real-extension matching, so a file literally named
		* `x.folder` is NOT claimed by a folder registration.
		*/
		const FOLDER_EXT = "folder";
		const FOLDER_OPEN_EXT = "folder-open";
		/** The basename of a '/'- or '\'-separated path (trailing separators trimmed). */
		function baseNameOf$1(path) {
			const trimmed = path.replace(/[\\/]+$/, "");
			const at = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			return at === -1 ? trimmed : trimmed.slice(at + 1);
		}
		/**
		* The lowercased extension of a path ('' when none), the dot having to sit
		* inside the last segment: a dot in a directory name is not an extension.
		* A leading dot starts a suffix (`.gitignore` → `'gitignore'`), mirroring
		* the host classifier's own `fileExtension`.
		*/
		function extOf(path) {
			const at = path.lastIndexOf(".");
			if (at === -1) return "";
			const base = path.slice(at + 1).toLowerCase();
			return base.includes("/") || base.includes("\\") ? "" : base;
		}
		/**
		* Create one file-icon registry.
		* @param builtins - the built-in glyph pair the chain ends on.
		* @param onChange - called after every effective registry change (register
		* or dispose; a repeated dispose is a no-op and stays silent) so mounted
		* rows re-resolve their icons without a reload.
		* @returns the registry, whose six methods are the public service face.
		*/
		function createFileIconRegistry(builtins, onChange) {
			const fileIcons = /* @__PURE__ */ new Map();
			const notify = () => {
				onChange?.();
			};
			const registerFileIcon = (descriptor) => {
				if (fileIcons.has(descriptor.id)) throw new Error(`[dsh-coding-sidebar] file icons "${descriptor.id}" already registered`);
				fileIcons.set(descriptor.id, descriptor);
				notify();
				return () => {
					if (fileIcons.get(descriptor.id) === descriptor) {
						fileIcons.delete(descriptor.id);
						notify();
					}
				};
			};
			const getFileIcons = () => Array.from(fileIcons.values());
			const ranked = () => Array.from(fileIcons.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
			const matchFileIcon = (path) => {
				const ext = extOf(path);
				const reserved = ext === "folder" || ext === "folder-open";
				const name = baseNameOf$1(path).toLowerCase();
				const list = ranked();
				for (const d of list) if (d.names?.some((entry) => entry.toLowerCase() === name) === true) return d;
				if (reserved) return void 0;
				for (const d of list) if (d.exts?.includes(ext) === true) return d;
			};
			const matchFolderIcon = (open, name) => {
				const list = ranked();
				if (name !== void 0) {
					const wanted = name.toLowerCase();
					for (const d of list) if (d.folderNames?.some((entry) => entry.toLowerCase() === wanted) === true) return d;
				}
				const want = open ? FOLDER_OPEN_EXT : FOLDER_EXT;
				for (const d of list) if (d.exts?.includes(want) === true) return d;
			};
			/** Run one registered factory; a throw is logged and declines the row. */
			const safeIcon = (d, path, size, open) => {
				try {
					return d.icon(path, size, open);
				} catch (error) {
					console.error(`[dsh-coding-sidebar] file icon factory "${d.id}" error:`, error);
					return;
				}
			};
			const fileIcon = (path, size) => {
				const specific = matchFileIcon(path);
				if (specific !== void 0) {
					const icon = safeIcon(specific, path, size);
					if (icon !== void 0) return icon;
				}
				for (const d of ranked()) if (d.exts !== void 0 && d.exts.length === 0) {
					const icon = safeIcon(d, path, size);
					if (icon !== void 0) return icon;
				}
				return builtins.file(path, size);
			};
			const folderIcon = (path, open, size) => {
				const registered = matchFolderIcon(open, baseNameOf$1(path));
				if (registered !== void 0) {
					const icon = safeIcon(registered, path, size, open);
					if (icon !== void 0) return icon;
				}
				return builtins.folder(open, size);
			};
			return {
				registerFileIcon,
				getFileIcons,
				matchFileIcon,
				matchFolderIcon,
				fileIcon,
				folderIcon
			};
		}
		//#endregion
		//#region src/client/file-icons.tsx
		/**
		* A file row: the host's own classifier and artwork for any path. Unknown
		* extensions land on the generic document glyph, exactly like the host's
		* explorer.
		* @param path - the row's path (any separator; the classifier reads the basename).
		* @param size - the square edge in px.
		* @returns the host's file-type glyph.
		*/
		function builtinFileIcon(path, size) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
				path,
				size
			});
		}
		/**
		* A directory row: the host's folder glyph.
		*
		* The host ships one folder drawing (`kind: 'folder'` resolves to its own
		* monochrome folder icon, which rides `currentColor` and therefore still
		* follows the skin), and its classifier never returns a folder category of
		* its own. The expansion state is already legible from the tree's own
		* chevron and row affordances, so this deliberately does not invent a second
		* folder drawing.
		* @param _open - whether the row is expanded (accepted for API compatibility).
		* @param size - the square edge in px.
		* @returns the host's folder glyph.
		*/
		function builtinFolderIcon(_open, size) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
				kind: "folder",
				size
			});
		}
		/** The built-in pair the registry falls back to (DSH's own artwork). */
		const HOST_FILE_ICONS = {
			file: builtinFileIcon,
			folder: builtinFolderIcon
		};
		//#endregion
		//#region src/client/service.ts
		/** Extract the lowercase extension without leading dot from a path. */
		function extOfPath(path) {
			const at = path.lastIndexOf(".");
			if (at === -1) return "";
			const base = path.slice(at + 1).toLowerCase();
			return base.includes("/") || base.includes("\\") ? "" : base;
		}
		/** The file name of a path (both separators). */
		function baseNameOf(path) {
			const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return at === -1 ? path : path.slice(at + 1);
		}
		/**
		* Find the tab type that claims an intercepted external-link URL (v0.13.0+).
		* Walks the descriptors in REGISTRATION order and returns the first one
		* that declares `urlTarget` and matches `url`; a throwing predicate is
		* swallowed (console.error, type skipped) so one broken plugin can never
		* break the whole link pipeline. The caller passes the ENABLED tab
		* descriptors (enablement is the caller's prefs domain — filter
		* `service.getTabs()` through `tabsEnabled` before matching) and falls
		* back to the built-in browser tab when nothing claims the URL (the
		* browser never declares `urlTarget` itself, so it can never shadow a
		* plugin claim).
		*/
		function matchUrlTarget(tabs, url) {
			for (const tab of tabs) {
				if (tab.urlTarget === void 0) continue;
				let claimed = false;
				try {
					claimed = tab.urlTarget(url) === true;
				} catch (error) {
					console.error("[dsh-coding-sidebar] urlTarget error:", error);
					continue;
				}
				if (claimed) return tab;
			}
		}
		const SIDEBAR_SERVICE_VERSION = "1.0.33";
		/**
		* Monotonic capability list consumers use to gate new API usage (features
		* are never removed). Each string names a v0.12.0+ capability:
		* - 'badge': TabDescriptor.badge
		* - 'tabLifecycle': TabDescriptor.onOpen/onActivate/onClose
		* - 'updateTab': BetterSidebarService.updateTab
		* - 'openFile': BetterSidebarService.openFile
		* - 'targetedOpen': BetterSidebarService.openTab(seed, scope?)
		* - 'stateSubscription': getSnapshot/subscribeState
		* - 'tabMeta': SidebarTab.meta (seeds, createTab, updateTab, persistence)
		* - 'pluginSettings': SidebarSettingsDeclaration.pluginToggles/render
		* - 'urlTarget' (v0.13.0): TabDescriptor.urlTarget (external-link claims)
		* - 'settingSelect': SidebarSettingToggle type 'select' (options/multi)
		* - 'fileIcons' (v1.0.12): registerFileIcon/getFileIcons/matchFileIcon —
		*   external file-tree icons overriding the built-in artwork, matched by
		*   extension (`exts`), exact file name (`names`), or directory name
		*   (`folderNames`). Built-in glyphs are the host's own `FileTypeIcon`
		*   artwork (no plugin-side extension table).
		* - 'floatWindows' (v0.16.0): tabs float as free windows — openTab's dedupe/
		*   id focus targets RAISE the floating window (never duplicate the tab or
		*   expand panels), closeTab on a floating tab closes it with its window.
		*/
		const SIDEBAR_FEATURES = [
			"badge",
			"tabLifecycle",
			"updateTab",
			"openFile",
			"targetedOpen",
			"stateSubscription",
			"tabMeta",
			"pluginSettings",
			"urlTarget",
			"settingSelect",
			"fileIcons",
			"floatWindows"
		];
		/** Run one plugin callback; a throw is logged and never breaks the caller. */
		function safeCall(fn) {
			try {
				fn();
			} catch (error) {
				console.error("[dsh-coding-sidebar] plugin callback error:", error);
			}
		}
		/**
		* Create one BetterSidebar service bound to a store. The service owns the
		* tab/viewer registries (Map + listener set) and proxies openTab/closeTab
		* to the store's reducer. One instance per client plugin activation.
		*/
		function createBetterSidebarService(store) {
			const tabs = /* @__PURE__ */ new Map();
			const viewers = /* @__PURE__ */ new Map();
			const listeners = /* @__PURE__ */ new Set();
			const notify = () => {
				for (const fn of [...listeners]) fn();
			};
			const icons = createFileIconRegistry(HOST_FILE_ICONS, notify);
			const subscribe = (listener) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			};
			const registerTab = (descriptor) => {
				if (tabs.has(descriptor.id)) throw new Error(`[dsh-coding-sidebar] tab type "${descriptor.id}" already registered`);
				tabs.set(descriptor.id, descriptor);
				notify();
				return () => {
					if (tabs.get(descriptor.id) === descriptor) {
						tabs.delete(descriptor.id);
						notify();
					}
				};
			};
			const registerFileViewer = (descriptor) => {
				if (viewers.has(descriptor.id)) throw new Error(`[dsh-coding-sidebar] file viewer "${descriptor.id}" already registered`);
				viewers.set(descriptor.id, descriptor);
				notify();
				return () => {
					if (viewers.get(descriptor.id) === descriptor) {
						viewers.delete(descriptor.id);
						notify();
					}
				};
			};
			const getTabs = () => Array.from(tabs.values());
			const getFileViewers = () => Array.from(viewers.values());
			const getTab = (id) => tabs.get(id);
			const isTabEnabled = (id) => store.getPrefs().tabsEnabled[id] !== false;
			const isViewerEnabled = (id) => store.getPrefs().viewersEnabled[id] !== false;
			const matchFileViewer = (path, head) => {
				const ext = extOfPath(path);
				for (const v of Array.from(viewers.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
					if (!isViewerEnabled(v.id)) continue;
					if (head !== void 0 && v.detect !== void 0) {
						if (v.detect(path, head)) return v;
						if (v.exts.length === 0) continue;
					} else if (v.exts.length === 0) {
						if (v.detect === void 0) return v;
						continue;
					}
					if (v.exts.includes(ext)) return v;
				}
			};
			const openTab = (seed, scope) => {
				if (!isTabEnabled(seed.type)) {
					console.warn(`[dsh-coding-sidebar] tab type "${seed.type}" is disabled in the side card settings`);
					return;
				}
				const descriptor = tabs.get(seed.type);
				if (descriptor === void 0) return;
				const targetSessionId = scope?.sessionId ?? store.getSnapshot().sessionId;
				if (targetSessionId === void 0) return;
				const callbackScope = scope ?? { sessionId: targetSessionId };
				const activeSessionId = store.getSnapshot().sessionId;
				const targetsInactiveSession = scope !== void 0 && scope.sessionId !== activeSessionId;
				let created;
				let activated;
				const reducer = (state) => {
					let tab;
					let next;
					if (descriptor.createTab !== void 0) {
						const result = descriptor.createTab(state);
						if (result === null) return state;
						tab = result.tab;
						next = applyDedupe(state, result.tab, descriptor);
						if (result.patch !== void 0) next = {
							...next,
							...result.patch
						};
					} else {
						tab = {
							id: seed.id ?? seed.type,
							type: seed.type,
							title: seed.title ?? (typeof descriptor.title === "function" ? descriptor.title() : descriptor.title),
							...seed.path !== void 0 ? { path: seed.path } : {},
							...seed.diff !== void 0 ? { diff: seed.diff } : {},
							...seed.meta !== void 0 ? { meta: seed.meta } : {}
						};
						next = applyDedupe(state, tab, descriptor);
					}
					const dedupeKey = descriptor.dedupeKey ?? (descriptor.single === true ? () => descriptor.id : void 0);
					const key = dedupeKey?.(tab);
					const inputTabs = allLeaves(state.splits).flatMap((leaf) => leaf.tabs).concat(state.floats.map((f) => f.tab));
					const existedByKey = key !== void 0 && inputTabs.some((candidate) => candidate.type === tab.type && dedupeKey(candidate) === key);
					const existedById = tabOpenIn(state, tab.id);
					const isCreation = !existedByKey && !existedById;
					let landed = next;
					if (seed.url !== void 0 && isCreation) landed = patchTab(next, tab.id, {
						path: seed.url,
						...seed.title !== void 0 ? { title: seed.title } : {}
					});
					if (isCreation) created = allLeaves(landed.splits).flatMap((leaf) => leaf.tabs).find((candidate) => candidate.id === tab.id) ?? tab;
					else {
						const candidates = allLeaves(landed.splits).flatMap((leaf) => leaf.tabs).concat(landed.floats.map((f) => f.tab));
						activated = key !== void 0 ? candidates.find((candidate) => candidate.type === tab.type && dedupeKey(candidate) === key) : candidates.find((candidate) => candidate.id === tab.id);
						activated ??= tab;
					}
					if (!isCreation && floatWithTab(landed, activated?.id ?? tab.id) !== void 0) return landed;
					if (!targetsInactiveSession && typeof window !== "undefined" && (seed.path !== void 0 || seed.url !== void 0)) {
						if (!landed.panelOpen) return togglePanel(landed);
					}
					return landed;
				};
				if (targetsInactiveSession) store.reduceFor(scope.sessionId, reducer);
				else store.reduce(reducer);
				if (created !== void 0) safeCall(() => descriptor.onOpen?.(created, callbackScope));
				else if (activated !== void 0) safeCall(() => descriptor.onActivate?.(activated, callbackScope));
			};
			const closeTab$1 = (tabId, scope) => {
				let closed;
				store.reduce((state) => {
					if (!tabOpenIn(state, tabId)) return state;
					const float = floatWithTab(state, tabId);
					if (float !== void 0) {
						closed = float.tab;
						return closeFloatByTab(state, tabId);
					}
					const paneId = findPaneIdOf(state, tabId);
					closed = leafWithTab(state[treeOf(state, paneId)], tabId)?.tabs.find((tab) => tab.id === tabId);
					return closeTab(state, paneId, tabId);
				});
				if (closed !== void 0) {
					const sessionId = scope?.sessionId ?? store.getSnapshot().sessionId;
					if (sessionId !== void 0) {
						const descriptor = tabs.get(closed.type);
						safeCall(() => descriptor?.onClose?.(closed, scope ?? { sessionId }));
					}
				}
			};
			/** The snapshot the store publishes (state/prefs carry the active session). */
			const getSnapshot = () => store.getSnapshot();
			/** Store changes: session switch, state mutations, prefs writes. */
			const subscribeState = (listener) => store.subscribe(listener);
			/** Patch an open tab's display fields (a missing tab id is a no-op). */
			const updateTab = (tabId, patch) => {
				store.reduce((state) => patchTab(state, tabId, {
					...patch.title !== void 0 ? { title: patch.title } : {},
					...patch.path !== void 0 ? { path: patch.path } : {},
					...patch.meta !== void 0 ? { meta: patch.meta } : {}
				}));
			};
			/** Activate an open tab (the tab-bar activation path; fires onActivate). */
			const activateTab$1 = (tabId, scope) => {
				let activated;
				store.reduce((state) => {
					if (!tabOpenIn(state, tabId)) return state;
					const float = floatWithTab(state, tabId);
					if (float !== void 0) {
						activated = float.tab;
						return raiseFloat(state, float.id);
					}
					const paneId = findPaneIdOf(state, tabId);
					activated = leafWithTab(state[treeOf(state, paneId)], tabId)?.tabs.find((tab) => tab.id === tabId);
					return activateTab(state, paneId, tabId);
				});
				if (activated !== void 0) {
					const sessionId = scope?.sessionId ?? store.getSnapshot().sessionId;
					if (sessionId !== void 0) {
						const descriptor = tabs.get(activated.type);
						safeCall(() => descriptor?.onActivate?.(activated, scope ?? { sessionId }));
					}
				}
			};
			/** Open a file in the sidebar editor of `scope`'s session (title defaults
			*  to the file name; the tab id is path-derived, like the internal
			*  open-path interception, so distinct files open side by side). */
			const openFile = (scope, path, title) => {
				openTab({
					type: "editor",
					title: title ?? baseNameOf(path),
					path,
					id: `editor:${path}`
				}, scope);
			};
			return {
				registerTab,
				registerFileViewer,
				getTabs,
				getFileViewers,
				getTab,
				isTabEnabled,
				isViewerEnabled,
				matchFileViewer,
				openTab,
				closeTab: closeTab$1,
				subscribe,
				version: SIDEBAR_SERVICE_VERSION,
				features: SIDEBAR_FEATURES,
				getSnapshot,
				subscribeState,
				updateTab,
				activateTab: activateTab$1,
				openFile,
				...icons
			};
		}
		/**
		* Apply dedup: if a tab whose `dedupeKey` matches an existing tab of the
		* same type exists, focus it; otherwise land the tab through
		* `openTabInActivePane` (the id safety net + active-pane landing are that
		* reducer's job — not re-implemented here).
		* `single: true` resolves to the id-key sugar when no explicit key is given.
		*/
		function applyDedupe(state, tab, descriptor) {
			const dedupeKey = descriptor.dedupeKey ?? (descriptor.single === true ? () => descriptor.id : void 0);
			const key = dedupeKey?.(tab);
			if (key !== void 0) {
				for (const leaf of allLeaves(state.splits)) {
					const existing = leaf.tabs.find((t) => t.type === tab.type && dedupeKey(t) === key);
					if (existing !== void 0) return activateTab(state, leaf.id, existing.id);
				}
				const floated = state.floats.find((f) => f.tab.type === tab.type && dedupeKey(f.tab) === key);
				if (floated !== void 0) return raiseFloat(state, floated.id);
			}
			return openTabInActivePane(state, tab);
		}
		/** Find which pane hosts a tab id ('' if none). */
		function findPaneIdOf(state, tabId) {
			for (const leaf of allLeaves(state.splits)) if (leaf.tabs.some((t) => t.id === tabId)) return leaf.id;
			return state.activePane ?? "";
		}
		//#endregion
		//#region src/client/chunk-loader.ts
		/**
		* The platform externals a chunk bundle may require (mirror of
		* CLIENT_EXTERNALS in tsdown.config.ts — the chunk builds keep these
		* external and the loader resolves them here). A superset is safe: the
		* require only answers what the chunk actually asks for. The shell's static
		* module table seeds React, Cordis, and the UI libraries (primitives/slots);
		* `dsh-client-runtime/client` normalizes onto the runtime package row
		* (stripClientSuffix). dsh-client-web-react / dsh-client-schema-form were
		* dropped in DSH 0.1.0-rc.8 (no rc.8 publish, nothing requires them) — the
		* chunks never asked for them, so they no longer belong here.
		*
		* DSH 0.1.2-alpha.1 removed the `dsh-client-runtime` package outright (the
		* seed table gained bare-name `@deepseek-ai/dsh-client-store` instead); the
		* runtime/client row below stays for 0.1.1-rc.x hosts — no chunk requires
		* it, and {@link buildExternalsRequire} keeps an unresolvable spec
		* undefined until a chunk actually asks (only then is it a loud error), so
		* the entry is inert on 0.1.2-alpha.1+.
		*/
		const CHUNK_EXTERNALS = [
			"react",
			"react/jsx-runtime",
			"react-dom",
			"react-dom/client",
			"cordis",
			"@deepseek-ai/dsh-client-ui-slots",
			"@deepseek-ai/dsh-client-ui-primitives",
			"@deepseek-ai/dsh-client-runtime/client"
		];
		/** Chunk script endpoint served by the plugin host half (src/bundle-route.ts). */
		const CHUNK_URL = (name) => `/sidebar/bundle/${name}.js`;
		/** Bound on the revalidation HEAD round-trip. A timeout fails open (drop +
		*  re-fetch on the next open) so a stuck bundle route can never wedge lazy
		*  chunk loads behind the revalidation barrier. */
		const CHUNK_REVALIDATE_TIMEOUT_MS = 5e3;
		/** The module system injected by the client half at activation (rc.8+). */
		let injectedModuleSystem;
		/**
		* Plugin-owned page global carrying the injected module system across
		* bundle copies: the lazy chunk bundles (client-editor.js etc.) inline their
		* own chunk-loader instance, and rc.8 no longer exposes the shell module
		* system as a page global — so the core bundle's injection must be visible
		* to the chunk copies through a namespace of our own.
		*/
		const MODULE_SYSTEM_GLOBAL = "__dshSidebarModuleSystem__";
		/**
		* Inject the client module system the chunk externals resolve through.
		* Called by the client half's apply() with `ctx.modules` (rc.8+); pass
		* undefined to clear (tests). Survives {@link resetChunks} — the module
		* system is shell state, not chunk state, and stays live across HMR.
		*/
		function setChunkModuleSystem(system) {
			injectedModuleSystem = system;
			const g = globalThis;
			if (system === void 0) delete g[MODULE_SYSTEM_GLOBAL];
			else g[MODULE_SYSTEM_GLOBAL] = system;
		}
		/** Resolve the shell-installed module system (injected, then the plugin
		*  global shared with chunk-bundle copies, then the rc.7 page global). */
		function moduleSystem() {
			const g = globalThis;
			return injectedModuleSystem ?? g[MODULE_SYSTEM_GLOBAL] ?? g.__DSH_MODULES__;
		}
		function chunkRegistry() {
			const g = globalThis;
			return g.__dshChunks__ ??= {};
		}
		const defaultScriptLoader = (src) => new Promise((resolve, reject) => {
			const el = document.createElement("script");
			el.async = true;
			el.src = src;
			el.addEventListener("load", () => {
				el.remove();
				resolve();
			}, { once: true });
			el.addEventListener("error", () => {
				el.remove();
				reject(/* @__PURE__ */ new Error(`[dsh-coding-sidebar] chunk script ${src} failed to load`));
			}, { once: true });
			document.head.append(el);
		});
		let scriptLoader = defaultScriptLoader;
		/**
		* Script-load retry backoff (ms per retry, then the failure surfaces).
		* DEFAULT is module state so tests can shrink it; production never changes it.
		*/
		let scriptRetryDelaysMs = [400, 1200];
		/**
		* Load one chunk script, retrying transient failures. A script-tag `error`
		* event is NETWORK-level (404/403/aborted transfer): the classic producer is
		* a route that momentarily cannot serve — an in-place plugin upgrade's
		* rm/cp window, a server restart mid-fetch, a dropped connection. Those
		* clear on their own within a beat, and re-execution is idempotent (the
		* registry slot is overwritten by assignment), so retrying is safe. Only a
		* failure that survives every retry surfaces to the caller.
		*/
		async function loadScriptWithRetry(src) {
			let attempt = 0;
			for (;;) try {
				await scriptLoader(src);
				return;
			} catch (cause) {
				const delay = scriptRetryDelaysMs[attempt];
				if (delay === void 0) throw cause;
				attempt += 1;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
		/** Test/dev hook: resolve a chunk without fetching a script (e.g. vitest). */
		const testLoaders = /* @__PURE__ */ new Map();
		/** Memoized externals require, resolved once per page from the seed table. */
		let externalsRequire;
		async function buildExternalsRequire(modules) {
			if (externalsRequire !== void 0) return externalsRequire;
			const entries = await Promise.all(CHUNK_EXTERNALS.map(async (spec) => {
				try {
					return [spec, await modules.import(spec)];
				} catch {
					return [spec, void 0];
				}
			}));
			const table = new Map(entries);
			externalsRequire = (spec) => {
				if (!table.has(spec)) throw new Error(`[dsh-coding-sidebar] chunk require('${spec}') missed the module table`);
				return table.get(spec);
			};
			return externalsRequire;
		}
		/** In-flight/memoized chunk loads; a failure removes its entry so a retry re-fetches. */
		const cache = /* @__PURE__ */ new Map();
		/** Chunk names whose exports are currently cached (loaded successfully). */
		const loadedChunks = /* @__PURE__ */ new Set();
		/** ETags observed for loaded chunks (HEAD revalidation, see
		*  {@link revalidateChunksOnReactivate}). */
		const chunkEtags = /* @__PURE__ */ new Map();
		/** Pending revalidation barrier: while set, {@link loadChunk} awaits it
		*  before serving cache (see revalidateChunksOnReactivate). */
		let revalidation = null;
		/** Best-effort ETag capture for revalidation. The script tag itself exposes
		*  no response headers, so after a successful load we HEAD the bundle route
		*  once. Failures (including a stuck route — bounded by the timeout) are
		*  ignored — revalidation then fails open (re-fetch). */
		async function recordEtag(name) {
			try {
				const etag = (await fetch(CHUNK_URL(name), {
					method: "HEAD",
					cache: "no-cache",
					signal: AbortSignal.timeout(CHUNK_REVALIDATE_TIMEOUT_MS)
				})).headers.get("etag");
				if (etag !== null && etag !== "") chunkEtags.set(name, etag);
			} catch {
				chunkEtags.delete(name);
			}
		}
		/**
		* Load (once) and materialize a lazy chunk, returning its module exports.
		* Concurrent callers share one in-flight load; a failure clears the cache
		* entry so the next call retries (the script re-executes and overwrites its
		* global registry slot — assignments are idempotent).
		* @param name - the chunk to load.
		*/
		async function loadChunk(name) {
			if (revalidation !== null) await revalidation;
			const cached = cache.get(name);
			if (cached !== void 0) return cached;
			let task;
			task = (async () => {
				const test = testLoaders.get(name);
				if (test !== void 0) return test();
				const modules = moduleSystem();
				if (modules === void 0) throw new Error(`[dsh-coding-sidebar] chunk "${name}": client module system unavailable`);
				await loadScriptWithRetry(CHUNK_URL(name));
				const factory = chunkRegistry()[name];
				if (typeof factory !== "function") throw new Error(`[dsh-coding-sidebar] chunk "${name}" script did not register its factory`);
				const exports = factory(await buildExternalsRequire(modules));
				if (cache.get(name) !== void 0) {
					loadedChunks.add(name);
					recordEtag(name);
				}
				return exports;
			})();
			cache.set(name, task);
			task.catch(() => {
				cache.delete(name);
				loadedChunks.delete(name);
				chunkEtags.delete(name);
			});
			return task;
		}
		/**
		* HMR-safe re-activation hook (index.tsx calls this instead of a full
		* reset): keep the resolved exports of every loaded chunk and drop only the
		* ones whose script changed on disk — the bundle route revalidates every
		* request (cache-control: no-cache + ETag), so an unchanged chunk keeps its
		* memory cache and the next lazy open skips the re-inject / re-execute.
		* Fail-open: an unreachable, ETag-less, or timed-out chunk is dropped
		* (re-fetch on next open). Test-registry entries are always cleared
		* (per-test fixtures).
		* A page refresh remains the authoritative reset (the HMR poll watches only
		* client.js; chunk-only edits surface here on the next core re-activation).
		*
		* The returned promise is also a BARRIER for {@link loadChunk}: while a
		* revalidation is pending, every chunk load awaits it before serving cache,
		* so a lazy tab opening mid-revalidation can never render stale exports
		* that the sweep is about to invalidate (CR #232 P1).
		*/
		function revalidateChunksOnReactivate() {
			testLoaders.clear();
			const task = (async () => {
				for (const name of [...cache.keys()]) if (!loadedChunks.has(name)) cache.delete(name);
				if (loadedChunks.size === 0) return;
				const stale = [];
				await Promise.all([...loadedChunks].map(async (name) => {
					try {
						const etag = (await fetch(CHUNK_URL(name), {
							method: "HEAD",
							cache: "no-cache",
							signal: AbortSignal.timeout(CHUNK_REVALIDATE_TIMEOUT_MS)
						})).headers.get("etag");
						if (etag !== null && etag !== "" && chunkEtags.get(name) === etag) return;
					} catch {}
					stale.push(name);
				}));
				for (const name of stale) {
					cache.delete(name);
					loadedChunks.delete(name);
					chunkEtags.delete(name);
				}
			})();
			revalidation = task;
			task.finally(() => {
				if (revalidation === task) revalidation = null;
			});
			return task;
		}
		//#endregion
		//#region node_modules/.pnpm/react-icons@5.7.0_react@18.3.1/node_modules/react-icons/lib/iconContext.mjs
		var DefaultContext = {
			color: void 0,
			size: void 0,
			className: void 0,
			style: void 0,
			attr: void 0
		};
		var IconContext = react.default.createContext && /*#__PURE__*/ react.default.createContext(DefaultContext);
		//#endregion
		//#region node_modules/.pnpm/react-icons@5.7.0_react@18.3.1/node_modules/react-icons/lib/iconBase.mjs
		var _excluded = [
			"attr",
			"size",
			"title"
		];
		function _objectWithoutProperties(e, t) {
			if (null == e) return {};
			var o, r, i = _objectWithoutPropertiesLoose(e, t);
			if (Object.getOwnPropertySymbols) {
				var n = Object.getOwnPropertySymbols(e);
				for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
			}
			return i;
		}
		function _objectWithoutPropertiesLoose(r, e) {
			if (null == r) return {};
			var t = {};
			for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
				if (-1 !== e.indexOf(n)) continue;
				t[n] = r[n];
			}
			return t;
		}
		function _extends() {
			return _extends = Object.assign ? Object.assign.bind() : function(n) {
				for (var e = 1; e < arguments.length; e++) {
					var t = arguments[e];
					for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
				}
				return n;
			}, _extends.apply(null, arguments);
		}
		function ownKeys(e, r) {
			var t = Object.keys(e);
			if (Object.getOwnPropertySymbols) {
				var o = Object.getOwnPropertySymbols(e);
				r && (o = o.filter(function(r) {
					return Object.getOwnPropertyDescriptor(e, r).enumerable;
				})), t.push.apply(t, o);
			}
			return t;
		}
		function _objectSpread(e) {
			for (var r = 1; r < arguments.length; r++) {
				var t = null != arguments[r] ? arguments[r] : {};
				r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
					_defineProperty(e, r, t[r]);
				}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
					Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
				});
			}
			return e;
		}
		function _defineProperty(e, r, t) {
			return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
				value: t,
				enumerable: !0,
				configurable: !0,
				writable: !0
			}) : e[r] = t, e;
		}
		function _toPropertyKey(t) {
			var i = _toPrimitive(t, "string");
			return "symbol" == typeof i ? i : i + "";
		}
		function _toPrimitive(t, r) {
			if ("object" != typeof t || !t) return t;
			var e = t[Symbol.toPrimitive];
			if (void 0 !== e) {
				var i = e.call(t, r || "default");
				if ("object" != typeof i) return i;
				throw new TypeError("@@toPrimitive must return a primitive value.");
			}
			return ("string" === r ? String : Number)(t);
		}
		function Tree2Element(tree) {
			return tree && tree.map((node, i) => /*#__PURE__*/ react.default.createElement(node.tag, _objectSpread({ key: i }, node.attr), Tree2Element(node.child)));
		}
		function GenIcon(data) {
			return (props) => /*#__PURE__*/ react.default.createElement(IconBase, _extends({ attr: _objectSpread({}, data.attr) }, props), Tree2Element(data.child));
		}
		function IconBase(props) {
			var elem = (conf) => {
				var attr = props.attr, size = props.size, title = props.title, svgProps = _objectWithoutProperties(props, _excluded);
				var computedSize = size || conf.size || "1em";
				var className;
				if (conf.className) className = conf.className;
				if (props.className) className = (className ? className + " " : "") + props.className;
				return /*#__PURE__*/ react.default.createElement("svg", _extends({
					stroke: "currentColor",
					fill: "currentColor",
					strokeWidth: "0"
				}, conf.attr, attr, svgProps, {
					className,
					style: _objectSpread(_objectSpread({ color: props.color || conf.color }, conf.style), props.style),
					height: computedSize,
					width: computedSize,
					xmlns: "http://www.w3.org/2000/svg"
				}), title && /*#__PURE__*/ react.default.createElement("title", null, title), props.children);
			};
			return IconContext !== void 0 ? /*#__PURE__*/ react.default.createElement(IconContext.Consumer, null, (conf) => elem(conf)) : elem(DefaultContext);
		}
		//#endregion
		//#region node_modules/.pnpm/react-icons@5.7.0_react@18.3.1/node_modules/react-icons/vsc/index.mjs
		function VscTerminal(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 24 24",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M18.75 1.5H5.25C3.1815 1.5 1.5 3.183 1.5 5.25V18.75C1.5 20.8185 3.1815 22.5 5.25 22.5H18.75C20.8185 22.5 22.5 20.8185 22.5 18.75V5.25C22.5 3.183 20.8185 1.5 18.75 1.5ZM21 18.75C21 19.9905 19.9905 21 18.75 21H5.25C4.0095 21 3 19.9905 3 18.75V5.25C3 4.0095 4.0095 3 5.25 3H18.75C19.9905 3 21 4.0095 21 5.25V18.75ZM10.281 13.281L5.781 17.781C5.634 17.928 5.442 18 5.25 18C5.058 18 4.866 17.9265 4.719 17.781C4.4265 17.4885 4.4265 17.013 4.719 16.7205L8.688 12.7515L4.719 8.7825C4.4265 8.49 4.4265 8.0145 4.719 7.722C5.0115 7.4295 5.487 7.4295 5.7795 7.722L10.2795 12.222C10.572 12.5145 10.572 12.99 10.2795 13.2825L10.281 13.281ZM19.5 17.25C19.5 17.664 19.164 18 18.75 18H11.25C10.836 18 10.5 17.664 10.5 17.25C10.5 16.836 10.836 16.5 11.25 16.5H18.75C19.164 16.5 19.5 16.836 19.5 17.25Z" },
					"child": []
				}]
			})(props);
		}
		function VscTasklist(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M4.85401 2.14649C5.04901 2.34149 5.04901 2.65849 4.85401 2.85349L2.85401 4.85349C2.65901 5.04849 2.34201 5.04849 2.14701 4.85349L1.14701 3.85349C0.952013 3.65849 0.952013 3.34149 1.14701 3.14649C1.34201 2.95149 1.65901 2.95149 1.85401 3.14649L2.50001 3.79249L4.14601 2.14649C4.34101 1.95149 4.65901 1.95149 4.85401 2.14649ZM14.5 4.00049H6.50001C6.22401 4.00049 6.00001 3.77649 6.00001 3.50049C6.00001 3.22449 6.22401 3.00049 6.50001 3.00049H14.5C14.776 3.00049 15 3.22449 15 3.50049C15 3.77649 14.776 4.00049 14.5 4.00049ZM4.85401 11.1465C5.04901 11.3415 5.04901 11.6585 4.85401 11.8535L2.85401 13.8535C2.65901 14.0485 2.34201 14.0485 2.14701 13.8535L1.14701 12.8535C0.952013 12.6585 0.952013 12.3415 1.14701 12.1465C1.34201 11.9515 1.65901 11.9515 1.85401 12.1465L2.50001 12.7925L4.14601 11.1465C4.34101 10.9515 4.65901 10.9515 4.85401 11.1465ZM14.5 13.0005H6.50001C6.22401 13.0005 6.00001 12.7765 6.00001 12.5005C6.00001 12.2245 6.22401 12.0005 6.50001 12.0005H14.5C14.776 12.0005 15 12.2245 15 12.5005C15 12.7765 14.776 13.0005 14.5 13.0005ZM4.85401 6.64649C5.04901 6.84149 5.04901 7.15849 4.85401 7.35349L2.85401 9.35349C2.65901 9.54849 2.34201 9.54849 2.14701 9.35349L1.14701 8.35349C0.952013 8.15849 0.952013 7.84149 1.14701 7.64649C1.34201 7.45149 1.65901 7.45149 1.85401 7.64649L2.50001 8.29249L4.14601 6.64649C4.34101 6.45149 4.65901 6.45149 4.85401 6.64649ZM14.5 8.50049H6.50001C6.22401 8.50049 6.00001 8.27649 6.00001 8.00049C6.00001 7.72449 6.22401 7.50049 6.50001 7.50049H14.5C14.776 7.50049 15 7.72449 15 8.00049C15 8.27649 14.776 8.50049 14.5 8.50049Z" },
					"child": []
				}]
			})(props);
		}
		function VscRemoteExplorer(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 24 25",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": {
						"fillRule": "evenodd",
						"clipRule": "evenodd",
						"d": "M9.32 20.0677C9.469 20.5907 9.667 21.0917 9.911 21.5677H3.759C3.345 21.5677 3.009 21.2317 3.009 20.8177C3.009 20.4037 3.345 20.0677 3.759 20.0677H6.008V18.5517H3C1.343 18.5517 0 17.2087 0 15.5517V5.06775C0 3.41075 1.343 2.06775 3 2.06775H16.5C18.157 2.06775 19.5 3.41075 19.5 5.06775V9.88775C19.016 9.74975 18.516 9.65275 18 9.60575V5.06775C18 4.23975 17.328 3.56775 16.5 3.56775H3C2.172 3.56775 1.5 4.23975 1.5 5.06775V15.5517C1.5 16.3797 2.172 17.0517 3 17.0517H9.039C9.016 17.3047 9 17.5587 9 17.8177C9 18.0657 9.016 18.3097 9.037 18.5517H7.507V20.0677H9.32ZM24 17.8177C24 21.5457 20.978 24.5677 17.25 24.5677C13.522 24.5677 10.5 21.5457 10.5 17.8177C10.5 14.0897 13.522 11.0677 17.25 11.0677C20.978 11.0677 24 14.0897 24 17.8177ZM17.251 19.3177C17.251 19.2187 17.231 19.1217 17.194 19.0307C17.156 18.9397 17.101 18.8567 17.031 18.7867L14.781 16.5367C14.64 16.3957 14.449 16.3167 14.25 16.3167C14.051 16.3167 13.86 16.3957 13.719 16.5367C13.578 16.6777 13.499 16.8687 13.499 17.0677C13.499 17.2667 13.578 17.4577 13.719 17.5987L15.44 19.3177L13.719 21.0367C13.578 21.1777 13.499 21.3687 13.499 21.5677C13.499 21.7667 13.578 21.9577 13.719 22.0987C13.86 22.2397 14.051 22.3187 14.25 22.3187C14.449 22.3187 14.64 22.2397 14.781 22.0987L17.031 19.8487C17.101 19.7787 17.156 19.6967 17.194 19.6057C17.232 19.5147 17.251 19.4167 17.251 19.3177ZM19.06 16.3177L20.78 14.5987C20.921 14.4577 21 14.2667 21 14.0677C21 13.8687 20.921 13.6777 20.78 13.5367C20.639 13.3957 20.448 13.3167 20.249 13.3167C20.05 13.3167 19.859 13.3957 19.718 13.5367L17.468 15.7867C17.398 15.8567 17.343 15.9387 17.305 16.0307C17.267 16.1217 17.248 16.2197 17.248 16.3177C17.248 16.4157 17.268 16.5137 17.305 16.6057C17.343 16.6967 17.398 16.7797 17.468 16.8487L19.718 19.0987C19.859 19.2397 20.05 19.3187 20.249 19.3187C20.448 19.3187 20.639 19.2397 20.78 19.0987C20.921 18.9577 21 18.7667 21 18.5677C21 18.3687 20.921 18.1777 20.78 18.0367L19.06 16.3177Z"
					},
					"child": []
				}]
			})(props);
		}
		function VscPinned(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M10.0589 2.44511C9.34701 1.73063 8.14697 1.90829 7.67261 2.79839L5.6526 6.58878L2.8419 7.52568C2.6775 7.58048 2.5532 7.71649 2.51339 7.88514C2.47357 8.0538 2.52392 8.23104 2.64646 8.35357L4.79291 10.5L2.14645 13.1465L2 14L2.85356 13.8536L5.50002 11.2071L7.64646 13.3536C7.76899 13.4761 7.94623 13.5265 8.11489 13.4866C8.28354 13.4468 8.41955 13.3225 8.47435 13.1581L9.41143 10.3469L13.1897 8.32423C14.0759 7.84982 14.2538 6.6551 13.5443 5.94305L10.0589 2.44511ZM8.55511 3.2687C8.71323 2.972 9.11324 2.91278 9.35055 3.15094L12.836 6.64889C13.0725 6.88624 13.0131 7.28448 12.7178 7.44262L8.76403 9.55921C8.65137 9.61952 8.56608 9.72068 8.52567 9.84191L7.7815 12.0744L3.92562 8.21853L6.15812 7.47436C6.27966 7.43385 6.38101 7.34823 6.44126 7.23518L8.55511 3.2687Z" },
					"child": []
				}]
			})(props);
		}
		function VscPin(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M13.5 3C13.303 3 13.109 3.038 12.923 3.114L8.481 4.967L5.659 4.026C5.505 3.976 5.339 4.001 5.209 4.095C5.078 4.189 5.001 4.339 5.001 4.5V7H1.257L0.5 7.5L1.257 8H5V10.5C5 10.661 5.077 10.812 5.208 10.905C5.338 11 5.504 11.023 5.658 10.974L8.48 10.033L12.925 11.887C13.109 11.962 13.302 12 13.499 12C14.326 12 14.999 11.327 14.999 10.5V4.5C14.999 3.673 14.326 3 13.499 3H13.5ZM14 10.5C14 10.843 13.615 11.09 13.308 10.962L8.693 9.038C8.631 9.013 8.566 9 8.501 9C8.447 9 8.395 9.009 8.343 9.025L6.001 9.806V5.193L8.343 5.974C8.457 6.011 8.581 6.007 8.694 5.961L13.306 4.038C13.629 3.902 14.001 4.156 14.001 4.499V10.499L14 10.5Z" },
					"child": []
				}]
			})(props);
		}
		function VscOrganization(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M6.00195 4.00002C6.00195 2.89655 6.89649 2.00201 7.99995 2.00201C9.10342 2.00201 9.99796 2.89655 9.99796 4.00002C9.99796 5.10348 9.10342 5.99802 7.99995 5.99802C6.89649 5.99802 6.00195 5.10348 6.00195 4.00002ZM7.99995 3.00201C7.44877 3.00201 7.00195 3.44883 7.00195 4.00002C7.00195 4.5512 7.44877 4.99802 7.99995 4.99802C8.55114 4.99802 8.99796 4.5512 8.99796 4.00002C8.99796 3.44883 8.55114 3.00201 7.99995 3.00201ZM11 4.5C11 3.67157 11.6716 3 12.5 3C13.3284 3 14 3.67157 14 4.5C14 5.32843 13.3284 6 12.5 6C11.6716 6 11 5.32843 11 4.5ZM12.5 4C12.2239 4 12 4.22386 12 4.5C12 4.77614 12.2239 5 12.5 5C12.7761 5 13 4.77614 13 4.5C13 4.22386 12.7761 4 12.5 4ZM3.5 3C2.67157 3 2 3.67157 2 4.5C2 5.32843 2.67157 6 3.5 6C4.32843 6 5 5.32843 5 4.5C5 3.67157 4.32843 3 3.5 3ZM3 4.5C3 4.22386 3.22386 4 3.5 4C3.77614 4 4 4.22386 4 4.5C4 4.77614 3.77614 5 3.5 5C3.22386 5 3 4.77614 3 4.5ZM4.26756 6.99969C4.09739 7.29387 4 7.63541 4 7.99969L2 7.99969V10.5C2 11.3285 2.67157 12 3.5 12C3.71194 12 3.91361 11.9561 4.09639 11.8768C4.1705 12.2082 4.28572 12.524 4.43643 12.8187C4.14721 12.9356 3.83112 13 3.5 13C2.11929 13 1 11.8807 1 10.5V7.99969C1 7.44741 1.44772 6.99969 2 6.99969H4.26756ZM11.5636 12.8187C11.8528 12.9356 12.1689 13 12.5 13C13.8807 13 15 11.8807 15 10.5V7.99969C15 7.44741 14.5523 6.99969 14 6.99969H11.7324C11.9026 7.29387 12 7.63541 12 7.9997L14 7.99969V10.5C14 11.3285 13.3284 12 12.5 12C12.2881 12 12.0864 11.9561 11.9036 11.8768C11.8295 12.2082 11.7143 12.524 11.5636 12.8187ZM6 6.99969C5.44772 6.99969 5 7.44741 5 7.99969V11C5 12.6569 6.34315 14 8 14C9.65685 14 11 12.6569 11 11V7.99969C11 7.44741 10.5523 6.99969 10 6.99969H6ZM6 7.99969L10 7.99969V11C10 12.1046 9.10457 13 8 13C6.89543 13 6 12.1046 6 11V7.99969Z" },
					"child": []
				}]
			})(props);
		}
		function VscLinkExternal(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M15 9.5V12.5C15 13.879 13.879 15 12.5 15H3.5C2.121 15 1 13.879 1 12.5V3.5C1 2.121 2.121 1 3.5 1H6.5C6.776 1 7 1.224 7 1.5C7 1.776 6.776 2 6.5 2H3.5C2.673 2 2 2.673 2 3.5V12.5C2 13.327 2.673 14 3.5 14H12.5C13.327 14 14 13.327 14 12.5V9.5C14 9.224 14.224 9 14.5 9C14.776 9 15 9.224 15 9.5ZM14.5 1H9.5C9.224 1 9 1.224 9 1.5C9 1.776 9.224 2 9.5 2H13.293L9.147 6.146C8.952 6.341 8.952 6.658 9.147 6.853C9.245 6.951 9.373 6.999 9.501 6.999C9.629 6.999 9.757 6.95 9.855 6.853L14.001 2.707V6.5C14.001 6.776 14.225 7 14.501 7C14.777 7 15.001 6.776 15.001 6.5V1.5C15.001 1.224 14.777 1 14.501 1H14.5Z" },
					"child": []
				}]
			})(props);
		}
		function VscLayers(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [
					{
						"tag": "path",
						"attr": { "d": "M8 8.99993C7.819 8.99993 7.643 8.95093 7.486 8.85793L2.486 5.85693C2.186 5.67793 2 5.34893 2 4.99993C2 4.65093 2.187 4.32093 2.486 4.14193L7.486 1.14293C7.789 0.95693 8.207 0.95493 8.517 1.14493L13.513 4.14293C13.813 4.32293 13.999 4.65093 13.999 4.99993C13.999 5.34893 13.812 5.67893 13.513 5.85793L8.513 8.85693C8.357 8.95093 8.181 8.99993 8 8.99993ZM8 1.99993L3 4.99993L8 7.99993L13 4.99993L8 1.99993Z" },
						"child": []
					},
					{
						"tag": "path",
						"attr": { "d": "M2.146 6.9873L8 10.5003L13.854 6.9873C13.946 7.1413 14 7.3173 14 7.5003C14 7.8493 13.814 8.1783 13.514 8.3583L8.514 11.3573C8.357 11.4513 8.181 11.5003 8 11.5003C7.819 11.5003 7.642 11.4513 7.486 11.3583L2.486 8.35731C2.187 8.17931 2 7.8503 2 7.5003C2 7.3163 2.054 7.1403 2.146 6.9873Z" },
						"child": []
					},
					{
						"tag": "path",
						"attr": { "d": "M2.146 9.4873L8 13.0003L13.854 9.4873C13.946 9.6413 14 9.8173 14 10.0003C14 10.3493 13.814 10.6783 13.514 10.8583L8.514 13.8573C8.357 13.9513 8.181 14.0003 8 14.0003C7.819 14.0003 7.642 13.9513 7.486 13.8583L2.486 10.8573C2.187 10.6793 2 10.3503 2 10.0003C2 9.8163 2.054 9.6403 2.146 9.4873Z" },
						"child": []
					}
				]
			})(props);
		}
		function VscGraph(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [
					{
						"tag": "path",
						"attr": {
							"fillRule": "evenodd",
							"clipRule": "evenodd",
							"d": "M12.25 15L13.75 15C14.439 15 15 14.439 15 13.75L15 2.25C15 1.561 14.439 1 13.75 1L12.25 1C11.561 1 11 1.561 11 2.25L11 13.75C11 14.439 11.561 15 12.25 15ZM12 2.25C12 2.112 12.112 2 12.25 2L13.75 2C13.888 2 14 2.112 14 2.25L14 13.75C14 13.888 13.888 14 13.75 14L12.25 14C12.112 14 12 13.888 12 13.75L12 2.25Z"
						},
						"child": []
					},
					{
						"tag": "path",
						"attr": {
							"fillRule": "evenodd",
							"clipRule": "evenodd",
							"d": "M8.75 15L7.25 15C6.561 15 6 14.439 6 13.75L6 6.25C6 5.561 6.561 5 7.25 5L8.75 5C9.439 5 10 5.561 10 6.25L10 13.75C10 14.439 9.439 15 8.75 15ZM7.25 6C7.112 6 7 6.112 7 6.25L7 13.75C7 13.888 7.112 14 7.25 14L8.75 14C8.888 14 9 13.888 9 13.75L9 6.25C9 6.112 8.888 6 8.75 6L7.25 6Z"
						},
						"child": []
					},
					{
						"tag": "path",
						"attr": {
							"fillRule": "evenodd",
							"clipRule": "evenodd",
							"d": "M3.75 15L2.25 15C1.561 15 1 14.439 1 13.75L1 8.25C1 7.561 1.561 7 2.25 7L3.75 7C4.439 7 5 7.561 5 8.25L5 13.75C5 14.439 4.439 15 3.75 15ZM2.25 8C2.112 8 2 8.112 2 8.25L2 13.75C2 13.888 2.112 14 2.25 14L3.75 14C3.888 14 4 13.888 4 13.75L4 8.25C4 8.112 3.888 8 3.75 8L2.25 8Z"
						},
						"child": []
					}
				]
			})(props);
		}
		function VscGlobe(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M8 1C4.141 1 1 4.141 1 8C1 11.859 4.141 15 8 15C11.859 15 15 11.859 15 8C15 4.141 11.859 1 8 1ZM8 14C7.422 14 6.686 12.906 6.288 11H9.713C9.315 12.906 8.579 14 8.001 14H8ZM6.121 10C6.044 9.392 6 8.723 6 8C6 7.277 6.044 6.608 6.121 6H9.878C9.955 6.608 9.999 7.277 9.999 8C9.999 8.723 9.955 9.392 9.878 10H6.121ZM2 8C2 7.299 2.121 6.626 2.343 6H5.121C5.041 6.656 5 7.332 5 8C5 8.668 5.041 9.344 5.121 10H2.343C2.121 9.374 2 8.701 2 8ZM8 2C8.578 2 9.314 3.094 9.712 5H6.287C6.685 3.094 7.422 2 8 2ZM10.879 6H13.657C13.879 6.626 14 7.299 14 8C14 8.701 13.879 9.374 13.657 10H10.879C10.959 9.344 11 8.668 11 8C11 7.332 10.959 6.656 10.879 6ZM13.195 5H10.722C10.516 3.938 10.199 2.98 9.775 2.268C11.228 2.719 12.446 3.707 13.195 5ZM6.226 2.268C5.802 2.98 5.484 3.938 5.279 5H2.806C3.556 3.707 4.774 2.718 6.226 2.268ZM2.805 11H5.278C5.484 12.062 5.801 13.02 6.225 13.732C4.772 13.281 3.554 12.293 2.805 11ZM9.774 13.732C10.198 13.02 10.516 12.062 10.721 11H13.194C12.444 12.293 11.226 13.282 9.774 13.732Z" },
					"child": []
				}]
			})(props);
		}
		function VscGitCommit(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M11.5 8C11.5 6.24 10.194 4.779 8.5 4.536V1.5C8.5 1.224 8.276 1 8 1C7.724 1 7.5 1.224 7.5 1.5V4.536C5.806 4.779 4.5 6.24 4.5 8C4.5 9.76 5.806 11.221 7.5 11.464V14.5C7.5 14.776 7.724 15 8 15C8.276 15 8.5 14.776 8.5 14.5V11.464C10.194 11.221 11.5 9.76 11.5 8ZM8 10.5C6.621 10.5 5.5 9.378 5.5 8C5.5 6.622 6.621 5.5 8 5.5C9.379 5.5 10.5 6.622 10.5 8C10.5 9.378 9.379 10.5 8 10.5Z" },
					"child": []
				}]
			})(props);
		}
		function VscFolderOpened(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M2 4.5V9.10022L2.92389 7.5C3.45979 6.5718 4.45017 6 5.52196 6L11.9146 6C11.7087 5.4174 11.1531 5 10.5 5H7C6.86739 5 6.74021 4.94732 6.64645 4.85355L4.93934 3.14645C4.84557 3.05268 4.71839 3 4.58579 3H3.5C2.67157 3 2 3.67157 2 4.5ZM7.06895 13.9953C7.04641 13.9984 7.02339 14 7 14H3.5C2.11929 14 1 12.8807 1 11.5V4.5C1 3.11929 2.11929 2 3.5 2H4.58579C4.98361 2 5.36514 2.15804 5.64645 2.43934L7.20711 4H10.5C11.724 4 12.7426 4.87965 12.958 6.04127C14.605 6.34148 15.5443 8.22106 14.6616 9.75L13.0766 12.4953C12.5407 13.4235 11.5503 13.9953 10.4785 13.9953H7.06895ZM5.52196 7C4.80743 7 4.14718 7.3812 3.78991 8L2.20492 10.7453C1.62757 11.7453 2.34926 12.9953 3.50396 12.9953L10.4785 12.9953C11.193 12.9953 11.8533 12.6141 12.2105 11.9953L13.7955 9.25C14.3729 8.25 13.6512 7 12.4965 7L5.52196 7Z" },
					"child": []
				}]
			})(props);
		}
		function VscCommentDiscussion(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"viewBox": "0 0 16 16",
					"fill": "currentColor"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M14.56 7.44049C14.28 7.16049 13.9 7.00049 13.5 7.00049H13V4.00049C13 2.90049 12.1 2.00049 11 2.00049H3C1.9 2.00049 1 2.90049 1 4.00049V9.00049C1 10.1005 1.9 11.0005 3 11.0005V12.0005C3 12.8205 3.93 13.2905 4.59 12.8105L7 11.0505V11.5005C7 11.9005 7.16 12.2805 7.44 12.5605C7.72 12.8405 8.1 13.0005 8.5 13.0005H10.29L12.15 14.8505C12.19 14.9005 12.25 14.9405 12.31 14.9605C12.37 14.9905 12.43 15.0005 12.5 15.0005C12.57 15.0005 12.63 14.9905 12.69 14.9605C12.78 14.9205 12.86 14.8605 12.92 14.7805C12.97 14.7005 13 14.6005 13 14.5005V13.0005H13.5C13.9 13.0005 14.28 12.8405 14.56 12.5605C14.84 12.2805 15 11.9005 15 11.5005V8.50049C15 8.10049 14.84 7.72049 14.56 7.44049ZM6.75 10.0005L4 12.0005V10.0005H3C2.45 10.0005 2 9.55049 2 9.00049V4.00049C2 3.45049 2.45 3.00049 3 3.00049H11C11.55 3.00049 12 3.45049 12 4.00049V7.00049H8.5C8.1 7.00049 7.72 7.16049 7.44 7.44049C7.16 7.72049 7 8.10049 7 8.50049V10.0005H6.75ZM14 11.5005C14 11.6305 13.95 11.7605 13.85 11.8505C13.76 11.9505 13.63 12.0005 13.5 12.0005H12.5C12.37 12.0005 12.24 12.0505 12.15 12.1505C12.05 12.2405 12 12.3705 12 12.5005V13.2905L10.85 12.1505C10.81 12.1005 10.75 12.0605 10.69 12.0405C10.63 12.0105 10.57 12.0005 10.5 12.0005H8.5C8.37 12.0005 8.24 11.9505 8.15 11.8505C8.05 11.7605 8 11.6305 8 11.5005V8.50049C8 8.37049 8.05 8.24049 8.15 8.15049C8.24 8.05049 8.37 8.00049 8.5 8.00049H13.5C13.63 8.00049 13.76 8.05049 13.85 8.15049C13.95 8.24049 14 8.37049 14 8.50049V11.5005Z" },
					"child": []
				}]
			})(props);
		}
		//#endregion
		//#region \0dsh-css:/Users/libing/kk_Projects/dsh-coding-sidebar/src/client/builtins/tab-icons.module.css.mjs
		const css$7 = ".wDi0EW_files{color:var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary))}.wDi0EW_changes{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary)))}.wDi0EW_tasks,.wDi0EW_plans{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-primary))}.wDi0EW_sidechat{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary)))}.wDi0EW_terminal{color:var(--dsw-alias-label-primary)}.wDi0EW_browser{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary)))}.wDi0EW_trajectory{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary)))}.wDi0EW_team{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary,var(--dsw-alias-label-primary)))}";
		const tagId$6 = "dsh-coding-sidebar/tab-icons.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-coding-sidebar";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/builtins/tab-icons.tsx
		/** The styled wrapper classes; typed so a renamed rule fails the build. */
		const css$6 = {
			"browser": "wDi0EW_browser",
			"changes": "wDi0EW_changes",
			"files": "wDi0EW_files",
			"plans": "wDi0EW_plans",
			"sidechat": "wDi0EW_sidechat",
			"tasks": "wDi0EW_tasks",
			"team": "wDi0EW_team",
			"terminal": "wDi0EW_terminal",
			"trajectory": "wDi0EW_trajectory"
		};
		/** Surround a glyph with the class that hands it its token-driven color. */
		function themed(className, glyph) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className,
				children: glyph
			});
		}
		/** The Files tab: the host's folder artwork, like the rows it opens. */
		const filesTabIcon = (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: css$6.files,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
				kind: "folder",
				size
			})
		});
		/** Changes / diff: the commit glyph, green like the diff affordances. */
		const changesTabIcon = (size) => themed(css$6.changes, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscGitCommit, { size }));
		/**
		* Tasks (subagents and background jobs) — the live-activity amber. The glyph
		* is layered sheets, not a checklist: this page lists RUNNING work (subagent
		* sessions plus the host's background jobs), not a to-do list.
		*/
		const tasksTabIcon = (size) => themed(css$6.tasks, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscLayers, { size }));
		/**
		* Task plans — the markdown planning docs an agent writes during a run. Same
		* amber family as the tasks tab (both are agent work-in-progress surfaces),
		* with a deliberately different glyph: a checklist page, not stacked sheets.
		*/
		const plansTabIcon = (size) => themed(css$6.plans, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscTasklist, { size }));
		/** Side chat — the conversational/secondary accent. */
		const sidechatTabIcon = (size) => themed(css$6.sidechat, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscCommentDiscussion, { size }));
		/**
		* Terminal — primary ink, the shell is text. Rendered one step down from the
		* strip's 14px: the VSCodicon terminal is a wide filled rectangle and read
		* heavier than its neighbours at full size.
		*/
		const terminalTabIcon = (size) => themed(css$6.terminal, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscTerminal, { size: Math.max(10, Math.round(size * .85)) }));
		/** Browser — the same secondary accent as the side chat's sibling surfaces. */
		const browserTabIcon = (size) => themed(css$6.browser, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscGlobe, { size }));
		/**
		* Agent Teams — the roster glyph, in the side-chat family: both are the
		* collaboration surfaces beside the lead conversation.
		*/
		const teamTabIcon = (size) => themed(css$6.team, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscOrganization, { size }));
		/**
		* Trajectory — the flow glyph, in the model/request accent: this page and the
		* green request chips of the graph it draws are the same subject.
		*/
		const trajectoryTabIcon = (size) => themed(css$6.trajectory, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscGraph, { size }));
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
			browserBlockedCredentials: "已阻止：网址中不能包含账号密码",
			browserBlockedAppOrigin: "已阻止：不能在侧边栏里打开 KCoder 自身",
			browserInvalid: "无效的网址",
			browserEmpty: "请输入网址",
			browserAddressChanged: "地址已变",
			browserLimitUnknown: "地址栏显示的是最后一次打开的地址；页面内部的跳转无法用后退/前进回溯",
			browserLoadFailed: "页面加载失败（可能被网络或站点策略拦截）：可点刷新重试，或用「在浏览器中打开」",
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
			teamTitle: "智能体团队",
			teamRefresh: "刷新",
			teamLoading: "正在读取团队状态…",
			teamUnavailableTitle: "智能体团队未启用",
			teamUnavailableService: "名册与任务看板来自上游「智能体团队」插件（它会用团队工具替代 subagent 工具，故不随侧栏自动开启）。到「设置 → 插件」打开它，本页即刻可用。",
			teamUnavailableAgent: "当前会话还没有活动的 Agent（未开始运行或已归档）——让主 Agent 跑起来，或切换到正在运行的会话。",
			teamOpenPluginSettings: "去启用",
			teamRoster: "成员",
			teamOpenMember: "打开该成员的会话",
			teamTasks: "任务看板",
			teamCreate: "新建",
			teamNoTasks: "还没有任务",
			teamReady: "可开始",
			teamBlocked: "被阻塞",
			teamBlockedBy: "依赖",
			teamWriteScopes: "写入范围",
			teamOwner: "负责",
			teamUnowned: "未分配",
			teamEdit: "编辑",
			teamComplete: "完成",
			teamReopen: "重开",
			teamDelete: "删除",
			teamSubject: "任务标题",
			teamDescription: "任务描述",
			teamBlockers: "依赖的任务 ID（逗号分隔，可留空）",
			teamScopes: "写入范围（逗号分隔，可留空）",
			teamSave: "保存",
			teamCancel: "取消",
			teamConflict: "该任务已被其他成员修改，已刷新为最新状态",
			statusPending: "待办",
			statusInProgress: "进行中",
			statusCompleted: "已完成",
			memberRunning: "运行中",
			memberIdle: "空闲",
			memberInactive: "未激活",
			memberProvisioning: "创建中",
			memberFailed: "失败",
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
			trajAttachCounts: "{i} 张图片 · {f} 个文件",
			trajAttachImageN: "图片 {n}",
			trajAttachFile: "文件",
			trajAttachOffloaded: "已卸载",
			trajAttachView: "查看大图",
			trajToolArgs: "调用参数",
			trajToolResult: "结果",
			trajToolPending: "等待结果",
			trajEdgePrompt: "输入",
			trajEdgeResult: "产出",
			trajEdgeDispatch: "派发",
			trajEdgeSubcall: "子调用",
			trajEdgeLoop: "循环",
			trajEdgeLegendHint: "点击只高亮这一类边",
			trajSearchPlaceholder: "搜索轨迹…",
			trajSearchNone: "无匹配",
			trajStatsSlowest: "最慢 {name}·{duration}",
			trajLanesSummary: "输入 {n1} · 模型 {n2} · 工具 {n3}",
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
			plansCapped: "仅显示最近 {n} 个文档",
			schedPreviewTitle: "定时任务",
			schedPreviewClose: "收起",
			schedNext: "下次触发",
			schedCadence: "频率",
			schedPrompt: "提示词",
			schedEverySeconds: "每 {n} 秒",
			schedEveryMinutes: "每 {n} 分钟",
			schedEveryHours: "每 {n} 小时",
			schedKindAt: "一次性（指定时刻）",
			schedKindAfter: "一次性（延时）",
			schedKindEvery: "固定间隔",
			schedKindDaily: "每天",
			schedKindWeekly: "每周",
			schedKindCron: "Cron 表达式",
			schedKindLegacy: "旧格式任务",
			schedUnavailable: "读不到这条任务：schedule 插件未启用",
			schedGone: "这条任务已不存在（可能已被删除）",
			schedLoadFailed: "读取任务失败"
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
			browserBlockedCredentials: "Blocked: URLs must not embed credentials",
			browserBlockedAppOrigin: "Blocked: KCoder itself cannot be opened in the sidebar",
			browserInvalid: "Invalid URL",
			browserEmpty: "Enter a URL",
			browserAddressChanged: "Address changed",
			browserLimitUnknown: "The address bar shows the last address you opened; in-page navigations cannot be tracked with Back/Forward",
			browserLoadFailed: "The page failed to load (blocked by the network or the site) — retry, or open it in your browser",
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
			teamTitle: "Agent team",
			teamRefresh: "Refresh",
			teamLoading: "Reading team state…",
			teamUnavailableTitle: "Agent Teams is not enabled",
			teamUnavailableService: "The roster and task board come from the upstream Agent Teams plugin (it swaps the subagent tools for the team tools, so the sidebar never turns it on by itself). Enable it under Settings → Plugins and this page works immediately.",
			teamUnavailableAgent: "This session has no live agent yet (not started, or archived) — run the lead agent, or switch to a running session.",
			teamOpenPluginSettings: "Enable it",
			teamRoster: "Members",
			teamOpenMember: "Open this member’s session",
			teamTasks: "Task board",
			teamCreate: "New task",
			teamNoTasks: "No tasks yet",
			teamReady: "Ready",
			teamBlocked: "Blocked",
			teamBlockedBy: "Blocked by",
			teamWriteScopes: "Write scopes",
			teamOwner: "Owner",
			teamUnowned: "Unowned",
			teamEdit: "Edit",
			teamComplete: "Complete",
			teamReopen: "Reopen",
			teamDelete: "Delete",
			teamSubject: "Task subject",
			teamDescription: "Task description",
			teamBlockers: "Blocking task ids (comma-separated, optional)",
			teamScopes: "Write scopes (comma-separated, optional)",
			teamSave: "Save",
			teamCancel: "Cancel",
			teamConflict: "Another member changed this task — the board was refreshed to the latest state",
			statusPending: "Pending",
			statusInProgress: "In progress",
			statusCompleted: "Completed",
			memberRunning: "Running",
			memberIdle: "Idle",
			memberInactive: "Inactive",
			memberProvisioning: "Provisioning",
			memberFailed: "Failed",
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
			trajAttachCounts: "{i} images · {f} files",
			trajAttachImageN: "Image {n}",
			trajAttachFile: "File",
			trajAttachOffloaded: "Offloaded",
			trajAttachView: "View image",
			trajToolArgs: "Arguments",
			trajToolResult: "Result",
			trajToolPending: "Pending",
			trajEdgePrompt: "prompt",
			trajEdgeResult: "result",
			trajEdgeDispatch: "dispatch",
			trajEdgeSubcall: "subcall",
			trajEdgeLoop: "loop",
			trajEdgeLegendHint: "Click to highlight only this edge kind",
			trajSearchPlaceholder: "Search trajectory…",
			trajSearchNone: "no match",
			trajStatsSlowest: "slowest {name}·{duration}",
			trajLanesSummary: "input {n1} · model {n2} · tool {n3}",
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
			plansCapped: "Showing the {n} most recent documents",
			schedPreviewTitle: "Scheduled task",
			schedPreviewClose: "Dismiss",
			schedNext: "Next occurrence",
			schedCadence: "Cadence",
			schedPrompt: "Prompt",
			schedEverySeconds: "every {n} seconds",
			schedEveryMinutes: "every {n} minutes",
			schedEveryHours: "every {n} hours",
			schedKindAt: "One-shot (fixed instant)",
			schedKindAfter: "One-shot (delay)",
			schedKindEvery: "Fixed interval",
			schedKindDaily: "Daily",
			schedKindWeekly: "Weekly",
			schedKindCron: "Cron expression",
			schedKindLegacy: "Legacy task",
			schedUnavailable: "Cannot read this task: the schedule plugin is not enabled",
			schedGone: "This task no longer exists (it may have been deleted)",
			schedLoadFailed: "Reading the task failed"
		};
		/**
		* The dictionary namespace this plugin owns in the DSH locale registry
		* (`'sidebar'` is taken by DSH's own ui-sidebar, hence this distinct name).
		*/
		const LOCALE_NS = "betterSidebar";
		/** The DSH locale service attached by the client apply (absent → browser detection). */
		let localeService;
		/**
		* The better-locale override store attached by the client apply
		* (absent → no override; the zh/en chain runs). The store's `active`
		* field holds the user's chosen override id (e.g. `'ja'`); `undefined`
		* means "no override, use DSH native zh/en".
		*
		* The override only takes effect when DSH's active locale is `'en'`
		* (it borrows DSH's English slot to render a third language). While
		* DSH is on `'zh'` the override is inert — `getOverride` returns
		* `undefined` and `isOverrideActive` returns `false` — so `t()` and
		* `isZh()` fall through to the native zh/en chain unchanged.
		*/
		let betterLocaleStore;
		/**
		* Attach (or detach, with undefined) the DSH locale service. The sidebar
		* mounts its own React root outside the slot system's locale seat, so the
		* service rides this module-level holder: components keep calling the plain
		* `t()` function, and the Sidebar root's locale subscription re-renders the
		* whole tree on switches.
		*/
		function attachLocale(service) {
			localeService = service;
		}
		/**
		* Attach (or detach, with undefined) the better-locale override store.
		* When attached with an active override, `t()` consults the store's
		* `getOverride(active, LOCALE_NS, key)` first; if it returns a string,
		* that text wins over the zh/en chain. Detaching (or the store's active
		* being `undefined`) restores the zh/en chain unchanged.
		*
		* The Sidebar root subscribes to the store separately (see Sidebar.tsx)
		* so an override change re-renders the whole tree — the locale service's
		* own revision bump (which better-locale triggers via `publish(active, true)`)
		* does NOT fire the existing `localeRevision` uSES because that snapshot
		* reads `getSnapshot().active` (unchanged) rather than `revision`.
		*/
		function attachBetterLocale(store) {
			betterLocaleStore = store;
		}
		/**
		* The active locale id ('zh' | 'en'): the DSH locale service's snapshot when
		* attached, else the browser language.
		*/
		function activeLocale() {
			return localeService?.getSnapshot().active ?? (typeof navigator !== "undefined" ? navigator.language : "") ?? "en";
		}
		/** Translate a copy key; `{name}` placeholders interpolate from `params`. */
		function t(key, params) {
			const dshActive = localeService?.getSnapshot().active ?? "";
			let text = betterLocaleStore?.getOverride(dshActive, LOCALE_NS, key);
			if (text === void 0) text = (activeLocale().toLowerCase().startsWith("zh") ? zh : en)[key];
			if (text === void 0) text = key;
			if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		/** Format an ISO 8601 author date relative to now (刚刚 / N 分钟前 / N 小时前 / 昨天 / date). */
		function relativeTime(iso) {
			const then = Date.parse(iso);
			if (Number.isNaN(then)) return iso;
			const seconds = Math.floor((Date.now() - then) / 1e3);
			if (seconds < 60) return t("timeJustNow");
			if (seconds < 3600) return t("timeMinutesAgo", { n: Math.floor(seconds / 60) });
			if (seconds < 86400) return t("timeHoursAgo", { n: Math.floor(seconds / 3600) });
			if (seconds < 172800) return t("timeYesterday");
			const date = new Date(then);
			const pad = (value) => String(value).padStart(2, "0");
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
		}
		//#endregion
		//#region src/client/paths.ts
		/**
		* Path projection helpers shared by the explorer rows: a path relative to
		* the session cwd (for the @-reference button and "copy relative path").
		* The fs-tree joins with '/' even on Windows, so both separators normalize
		* to '/' before comparison.
		*
		* This module is dependency-free (no node:path in the client bundle): the
		* host is the authority for path semantics, so this mirror deliberately
		* accepts a SUPERSET of absolute forms — anything a Windows host would emit
		* (drive letters, UNC) plus POSIX roots. A form the host would reject
		* (e.g. a backslash UNC path on a POSIX host) passes through here and then
		* fails loudly in the host's requireAbsolute instead of being silently
		* joined onto the cwd.
		*/
		/**
		* Mirror of the host's absolute-path notion (see fs-tree.requireAbsolute):
		* POSIX roots, Windows drive letters, and Windows UNC network shares in
		* both backslash (`\\server\share\...`) and forward-slash
		* (`//server/share/...`) form. Deliberately a superset — see the module
		* comment — so a produced UNC path is never joined onto the cwd.
		*/
		function isAbsolutePath(path) {
			return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]{2}[^\\/]/.test(path);
		}
		/**
		* The path relative to the session's working directory.
		* @param cwd - the explorer root (absolute).
		* @param path - an absolute entry path from the fs-tree.
		* @returns the relative path with '/' separators ('.' for the cwd itself),
		* or `path` unchanged when it lies outside the cwd.
		*
		* The prefix test is case-insensitive: Windows paths (and macOS's
		* case-insensitive volumes) may arrive with different casing than the cwd
		* row, and the containment decision must not depend on it. The returned
		* relative text keeps the caller's own casing.
		*/
		function relativeTo(cwd, path) {
			const base = cwd.replace(/[\\/]+$/, "");
			const norm = (value) => value.replace(/\\/g, "/");
			const nBase = norm(base);
			const nPath = norm(path);
			if (nPath === nBase) return ".";
			if (nPath.toLowerCase().startsWith(`${nBase.toLowerCase()}/`)) return nPath.slice(nBase.length + 1);
			return path;
		}
		/**
		* Whether `target` lies under `base` (or equals it), tolerant of separator
		* style and — on Windows-style drive paths — of letter case. A client-side
		* mirror of the host's `isWithin` (fs-tree.ts) used to decide whether a
		* git-derived path can be opened in the editor (a linked worktree outside
		* the session workspace cannot: the host's workspace fence would reject it).
		*/
		function isWithinWorkspace(base, target) {
			const norm = (value) => value.replace(/[\\/]+/g, "/").replace(/\/$/, "");
			const b = norm(base);
			const t = norm(target);
			const lb = b.toLowerCase();
			const lt = t.toLowerCase();
			return lt === lb || lt.startsWith(`${lb}/`);
		}
		//#endregion
		//#region src/client/produced-files.ts
		/**
		* Pure derivation of one turn's produced files from finalized conversation
		* nodes — a structural replica of ui-deliverables' `producedForClosing`
		* (the mutation tools' follow-along `locations`, by render intent: a diff
		* card or a generic edit card; reads/deletes/failures produce nothing).
		* Kept dependency-free so the takeover logic is unit-testable and the
		* replica is easy to diff against upstream when it drifts.
		*/
		/** Paths a tool-result view reports as produced, by render intent. */
		function producedPaths(view) {
			if (view === null || typeof view !== "object") return [];
			const record = view;
			if (!(record.card === "diff" || record.card === "generic" && record.kind === "edit")) return [];
			if (!Array.isArray(record.locations)) return [];
			const paths = [];
			for (const location of record.locations) if (location !== null && typeof location === "object" && typeof location.path === "string") paths.push(location.path);
			return paths;
		}
		/**
		* Files produced by the turn the assistant at `seq` closes. Accumulation
		* resets on turn boundaries (a user message, or a node reporting a different
		* turn number); paths keep first-seen order and appear once.
		* @param nodes - snapshot nodes in surface order (structural, unknown-safe).
		* @param seq - the closing assistant's seq (the render site's anchor).
		* @returns produced paths; empty when the turn wrote nothing.
		*/
		function producedForClosing(nodes, seq) {
			let pending = [];
			let seen = /* @__PURE__ */ new Set();
			let turn;
			for (const node of nodes) {
				if (node === null || typeof node !== "object") continue;
				const record = node;
				if (record.kind === "tool-result") {
					if (record.isError === true) continue;
					for (const path of producedPaths(record.callView)) {
						if (seen.has(path)) continue;
						seen.add(path);
						pending.push(path);
					}
					continue;
				}
				if (record.kind === "user") {
					turn = void 0;
					pending = [];
					seen = /* @__PURE__ */ new Set();
				} else if (typeof record.turn === "number") {
					if (turn !== void 0 && record.turn !== turn) {
						pending = [];
						seen = /* @__PURE__ */ new Set();
					}
					turn = record.turn;
				}
				if (record.kind === "assistant" && record.seq === seq) return pending;
			}
			return [];
		}
		/**
		* Claim the turn-tail chain only when the closing turn produced files.
		*
		* The authoritative source is the engine Turn data — the same value
		* ui-deliverables reads (`owner.turn.data.get('deliverables')`): a
		* `{ produced: [{ seq, path }, ...] }` record accumulated per Turn. The
		* node-based replica below stays as a fallback for compositions that do not
		* publish it.
		* @param owner - the turn-tail owner currency ({turn, seq, openFile}).
		* @returns produced paths as the matched value, or null to decline.
		*/
		function selectProducedFiles(owner) {
			const record = owner;
			if (record === null || typeof record !== "object") return null;
			const seq = typeof record.seq === "number" ? record.seq : Number.POSITIVE_INFINITY;
			const data = record.turn?.data?.get?.("deliverables");
			if (data !== null && typeof data === "object" && Array.isArray(data.produced)) {
				const paths = [];
				const seen = /* @__PURE__ */ new Set();
				for (const item of data.produced) {
					if (item === null || typeof item !== "object") continue;
					const produced = item;
					if (typeof produced.path !== "string" || produced.path === "") continue;
					if (typeof produced.seq === "number" && produced.seq > seq) continue;
					if (seen.has(produced.path)) continue;
					seen.add(produced.path);
					paths.push(produced.path);
				}
				return paths.length === 0 ? null : paths;
			}
			if (!Array.isArray(record.nodes)) return null;
			const paths = producedForClosing(record.nodes, seq);
			return paths.length === 0 ? null : paths;
		}
		/**
		* Resolve a (possibly relative) path against the session cwd for the sidebar.
		* Absolute detection mirrors the host (see client/paths.isAbsolutePath):
		* POSIX roots, drive letters and UNC shares must not be joined onto the cwd.
		*/
		function resolveSidebarPath(cwd, path) {
			if (isAbsolutePath(path)) return path;
			const base = cwd ?? "";
			if (base === "") return path;
			const separator = base.includes("\\") ? "\\" : "/";
			return `${base.replace(/[\\/]+$/, "")}${separator}${path}`;
		}
		//#endregion
		//#region src/client/deliveries.ts
		/** One entry is a declaration when it carries a non-blank path. */
		function isDeclared(file) {
			if (file === null || typeof file !== "object" || Array.isArray(file)) return false;
			const { path } = file;
			return typeof path === "string" && path.trim().length > 0;
		}
		/**
		* Whether the closing turn declared explicit deliveries before its reply.
		*
		* Mirrors the built-in `presentedForClosing` boundary: a declaration settled at
		* or after the closing Assistant belongs to a later reply and does not count.
		* The record is read through a structural face on purpose — the @deepseek-ai
		* type releases this plugin builds against predate the field, so the map's keyof
		* constraint cannot name it — and every field is validated, because an older
		* carrier publishes no `presented` key at all and a malformed row must never
		* change the takeover decision.
		* @param owner - the turn-tail owner currency ({turn, seq}).
		* @returns `true` when this turn has at least one delivery to render.
		*/
		function hasDeclaredDeliveries(owner) {
			const record = owner;
			if (record === null || typeof record !== "object") return false;
			const data = record.turn?.data?.get?.("deliverables");
			if (data === null || typeof data !== "object" || !Array.isArray(data.presented)) return false;
			const seq = typeof record.seq === "number" ? record.seq : Number.POSITIVE_INFINITY;
			for (const file of data.presented) {
				if (!isDeclared(file)) continue;
				const at = file.seq;
				if (typeof at === "number" && at >= seq) continue;
				return true;
			}
			return false;
		}
		//#endregion
		//#region src/client/openpath-intercept.ts
		/**
		* The success envelope ui-chat's openFile expects from the RPC
		* (`if (!result.ok) throw` on the ClientResult); an intercepted open must
		* resolve as success so the chat view does not surface a failure toast.
		*/
		const REMOTE_OPEN_RESULT = {
			ok: true,
			value: { opened: true }
		};
		/**
		* Whether a path is the "Show in folder" folder-reveal gesture. The stock
		* ui-deliverables row passes `'.'` (the session workspace root, resolved by
		* the chat view to `"<cwd>/."`); any path whose final segment is `.` is the
		* same gesture. A directory has no editor content, so these opens must reach
		* the explorer instead of an editor tab.
		*/
		function isFolderRevealPath(path) {
			if (path === "." || path === "./") return true;
			const trimmed = path.replace(/[\\/]+$/, "");
			return trimmed === "." || /[\\/]\.$/.test(trimmed);
		}
		/**
		* Wrap `workspaces.openPath`: intercepted calls open the file in the sidebar
		* editor instead of the Host OS and resolve as success (the original's
		* callers ignore the result); anything that declines falls through to the
		* original method untouched. The one exception is the folder-reveal gesture,
		* which is routed to {@link OpenPathInterceptDeps.revealInExplorer} instead.
		* @param workspaces - the client workspaces service to wrap.
		* @param deps - per-call takeover decisions.
		* @returns the disposer restoring the original method (HMR-safe).
		*/
		function wrapOpenPath(workspaces, deps) {
			const original = workspaces.openPath;
			workspaces.openPath = (path) => {
				if (deps.takeoverEnabled()) {
					const sessionId = deps.currentSessionId();
					if (sessionId !== void 0) {
						if (isFolderRevealPath(path)) deps.revealInExplorer(path, sessionId);
						else deps.openInSidebar(path, sessionId);
						return Promise.resolve();
					}
				}
				return original.call(workspaces, path);
			};
			return () => {
				workspaces.openPath = original;
			};
		}
		/**
		* Wrap `session.openWorkspacePath` — the post-migration funnel — to the same
		* takeover semantics as {@link wrapOpenPath}: intercepted opens land in the
		* sidebar editor (folder reveals in the explorer) and resolve with the RPC
		* success envelope, declined opens reach the untouched original.
		*
		* The namespace service installs each method as a configurable getter (the
		* upstream gateway re-reads its method table on every access), so the raw
		* property descriptor is captured and re-defined rather than assigned: the
		* wrapped getter re-reads the ORIGINAL descriptor each call, meaning a
		* remount that swaps the underlying method is picked up transparently, and
		* the disposer restores the exact original descriptor (a chain of wrappers
		* from other plugins keeps working across disposals in any order).
		* @param session - the Remote session namespace to wrap.
		* @param deps - per-call takeover decisions (same face as the old door).
		* @returns the disposer restoring the original descriptor (HMR-safe); a
		*   no-op when the method is absent (pre-carrier baseline).
		*/
		function wrapRemoteOpenPath(session, deps) {
			const desc = Object.getOwnPropertyDescriptor(session, "openWorkspacePath");
			if (desc?.get === void 0) return () => {};
			Object.defineProperty(session, "openWorkspacePath", {
				configurable: true,
				enumerable: desc.enumerable,
				get: function() {
					const original = desc.get.call(this);
					return (request) => {
						if (deps.takeoverEnabled()) {
							const sessionId = deps.currentSessionId();
							if (sessionId !== void 0) {
								if (isFolderRevealPath(request.path)) deps.revealInExplorer(request.path, sessionId);
								else deps.openInSidebar(request.path, sessionId);
								return Promise.resolve(REMOTE_OPEN_RESULT);
							}
						}
						return original(request);
					};
				}
			});
			return () => {
				Object.defineProperty(session, "openWorkspacePath", desc);
			};
		}
		/**
		* Read the `url` a native browser-tab open carries, if any.
		* @param options - the caller's open options.
		* @returns the http(s) URL, or undefined when this open is not a browsable URL.
		*/
		function browserUrlOfOpen(options) {
			const params = options?.params;
			if (params === null || typeof params !== "object") return void 0;
			const url = params.url;
			if (typeof url !== "string" || url === "") return void 0;
			try {
				const parsed = new URL(url);
				return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : void 0;
			} catch {
				return;
			}
		}
		/**
		* Wrap the NATIVE side bar's `openTab` so a browser-kind open lands in THIS
		* plugin's own browser tab instead of the native right Sidebar.
		*
		* Why this exists: KCoder suppresses the native right-Sidebar shell on purpose
		* (产品铁律 1, docs/ARCHITECTURE.md §12). Upstream's link funnel calls
		* `ctx.sidebarRight.openTab('browser', …)` directly, so without this claim a
		* clicked http(s) link opens the native panel and the user sees a blank area
		* (2026-09-19 现场). The claim is the safety net under every caller — the
		* plugin's own document-level link interception handles plain clicks, but
		* modified clicks, programmatic opens, and links the interception declines
		* (protocol flags, disabled tab) all reach this method.
		*
		* Every other kind falls through untouched (the native pane registries own
		* them; claiming them would break their pages).
		*
		* @param right - the `ctx.sidebarRight` face.
		* @param open - routes one browsable URL into this plugin's browser tab.
		* @returns the disposer restoring the original method (HMR-safe).
		*/
		function wrapNativeBrowserOpen(right, open) {
			const original = right.openTab;
			if (typeof original !== "function") return () => {};
			right.openTab = function(kind, options) {
				const url = kind === "browser" ? browserUrlOfOpen(options) : void 0;
				if (url !== void 0) {
					open(url);
					return;
				}
				return original.call(this, kind, options);
			};
			return () => {
				right.openTab = original;
			};
		}
		/**
		* The scheme and type every file address opens with (mirror of the runtime
		* grammar). The QiLin channel renames the scheme to `qilin-resource://file/`
		* at sync time — the channel rewrite below is the single source of that
		* difference.
		*/
		const FILE_ADDRESS_PREFIX = "dsh-resource://file/";
		/**
		* Decode a file-resource address into the path it names.
		*
		* A dependency-free mirror of the runtime's `parseFileAddress`
		* (`@deepseek-ai/dsh-util-workspace-path`): this module deliberately imports no
		* runtime package so the takeover stays unit-testable, and the grammar is
		* small and frozen by the address format itself. Both scopes are accepted —
		* `session/<sessionId>/<path>` (what ui-chat's `openFile` builds, and the one
		* that carries the Session a fork's file belongs to) and
		* `absolute/<path>` (POSIX, drive-letter, and UNC spellings). Query/fragment
		* suffixes are ignored and each segment is decoded; a malformed escape or an
		* unknown scope declines rather than guessing.
		* @param address - a candidate resource address.
		* @returns the decoded target, or undefined when this is not a file address.
		*/
		function fileTargetOfAddress(address) {
			if (typeof address !== "string" || !address.startsWith(FILE_ADDRESS_PREFIX)) return void 0;
			try {
				const end = address.search(/[?#]/);
				const [scope, ...rest] = address.slice(20, end === -1 ? void 0 : end).split("/");
				if (scope === "session") {
					const [id, ...segments] = rest;
					if (id === void 0 || id === "" || segments.length === 0) return void 0;
					return {
						sessionId: decodeURIComponent(id),
						path: segments.map(decodeURIComponent).join("/")
					};
				}
				if (scope === "absolute") {
					const unc = rest[0] === "" && rest.length > 1;
					const segments = (unc ? rest.slice(1) : rest).map(decodeURIComponent);
					const first = segments[0];
					if (first === void 0 || first === "") return void 0;
					if (unc) return { path: `//${segments.join("/")}` };
					return { path: /^[A-Za-z]:$/.test(first) ? segments.join("/") : `/${segments.join("/")}` };
				}
				return;
			} catch {
				return;
			}
		}
		/**
		* Wrap `sidebarRight.openResource` — the funnel dsh 0.1.5's chat uses for every
		* file open it starts (tool-row links, prose mentions, the built-in
		* produced-files chips, and the `present` delivery cards' preview gesture).
		* The address is decoded and rerouted into the sidebar editor; the
		* folder-reveal gesture reaches the explorer, exactly like the older doors.
		*
		* Two declines keep the wrapper honest: an address no file scope claims, and a
		* call whose `options.kind` names the page type the caller demands (that caller
		* is addressing the right Sidebar on purpose, so rerouting would silently
		* ignore its request). The Session the address names wins over the current one
		* — a fork's file belongs to the fork, and `ctx.sessions…current` is whatever
		* conversation the user is looking at. `openResource` is a prototype method on
		* the controller, so the raw reference is captured and reassigned; a remount
		* that swaps the controller replaces the wrapper with the new instance's own.
		* @param right - the `ctx.sidebarRight` face.
		* @param deps - per-call takeover decisions (same face as the older doors).
		* @returns the disposer restoring the original method (HMR-safe); a no-op when
		*   the face or its method is absent (pre-0.1.5 baseline).
		*/
		function wrapSidebarRight(right, deps) {
			const original = right.openResource;
			if (typeof original !== "function") return () => {};
			right.openResource = function(address, options) {
				const target = deps.takeoverEnabled() && options?.kind === void 0 ? fileTargetOfAddress(address) : void 0;
				const sessionId = target?.sessionId ?? deps.currentSessionId();
				if (target !== void 0 && sessionId !== void 0) {
					if (target.path === "" || isFolderRevealPath(target.path)) deps.revealInExplorer(target.path, sessionId);
					else deps.openInSidebar(target.path, sessionId);
					return;
				}
				return original.call(this, address, options);
			};
			return () => {
				right.openResource = original;
			};
		}
		//#endregion
		//#region \0dsh-css:/Users/libing/kk_Projects/dsh-coding-sidebar/src/client/sidebar.module.css.mjs
		const css$5 = "[data-dsh-panel-host]{z-index:25;pointer-events:none;position:fixed;inset:0;overflow:hidden}[data-dsh-panel-host][data-dsh-panel-host-degraded]{position:absolute;top:0;left:0}.S5HVoW_toggleCluster{top:calc(3px + env(safe-area-inset-top));z-index:45;pointer-events:auto;flex-direction:row;gap:4px;display:flex;position:absolute;right:10px}.S5HVoW_panel:not(.S5HVoW_panelHidden) .S5HVoW_tabBar{padding-right:72px}.S5HVoW_toggleButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), color var(--ds-transition-duration-slow) var(--ds-ease-in-out);background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;display:flex}.S5HVoW_toggleButton:hover:not(:disabled):not([aria-disabled=true]){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_toggleButton:disabled,.S5HVoW_toggleButton[aria-disabled=true]{opacity:.4;cursor:default}.S5HVoW_panel{box-sizing:border-box;z-index:40;pointer-events:auto;background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l2);padding-bottom:env(safe-area-inset-bottom);transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out), width var(--ds-transition-duration-slow) var(--ds-ease-in-out);flex-direction:column;display:flex;position:absolute;top:0;bottom:0;right:0}.S5HVoW_panelHidden{pointer-events:none;visibility:hidden;transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out), width var(--ds-transition-duration-slow) var(--ds-ease-in-out), visibility 0s linear var(--ds-transition-duration-slow);transform:translate(102%)}.S5HVoW_panel[data-dragging]{transition:none}.S5HVoW_panelResize{cursor:col-resize;z-index:2;touch-action:none;width:8px;position:absolute;top:0;bottom:0;left:-4px}.S5HVoW_panelResizeActive{background:var(--dsw-alias-interactive-bg-hover-accent)}.S5HVoW_panelBody{flex:1;min-width:0;min-height:0;display:flex}.S5HVoW_panel{contain:layout style}body[data-dsh-sidebar-dragging] .S5HVoW_panel{will-change:transform}.S5HVoW_floatWindow{z-index:42;pointer-events:auto;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-shadow-lv3);contain:layout style;border-radius:8px;flex-direction:column;display:flex;position:absolute;overflow:hidden}.S5HVoW_floatWindowDragging{will-change:left, top, width, height}.S5HVoW_floatHeader{height:34px;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);cursor:grab;user-select:none;flex:none;align-items:center;gap:4px;padding:0 4px 0 10px;display:flex}.S5HVoW_floatWindowDragging .S5HVoW_floatHeader{cursor:grabbing}.S5HVoW_floatTitle{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.S5HVoW_floatClose{width:18px;height:18px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:4px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.S5HVoW_floatClose:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_floatContent{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;overflow:hidden}.S5HVoW_floatResize{z-index:2;cursor:nwse-resize;touch-action:none;width:14px;height:14px;position:absolute;bottom:0;right:0}.S5HVoW_floatResize:hover{background:var(--dsw-alias-interactive-bg-hover-accent)}.S5HVoW_pane[data-dsh-float-dock-over]{outline:2px dashed var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-2px}.S5HVoW_floatDropHint{z-index:46;pointer-events:none;border:2px dashed var(--dsw-alias-interactive-bg-hover-accent);background:color-mix(in srgb, var(--dsw-alias-interactive-bg-hover-accent) 12%, transparent);border-radius:8px;justify-content:center;align-items:center;display:flex;position:absolute}.S5HVoW_floatDropHintLabel{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:4px 12px}.S5HVoW_toggleCluster,.S5HVoW_toggleButton,.S5HVoW_tabBar,.S5HVoW_floatHeader{-webkit-app-region:no-drag}body[data-dsh-title-bar-compat] .S5HVoW_toggleCluster{top:calc(var(--dsh-title-bar-strip,40px) + 3px)}body[data-dsh-title-bar-compat] .S5HVoW_panel{padding-top:var(--dsh-title-bar-strip,40px)}.S5HVoW_iconButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.S5HVoW_iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_iconButton:disabled{opacity:.4;cursor:default}.S5HVoW_workbench,.S5HVoW_split{flex:1;min-width:0;min-height:0;display:flex}.S5HVoW_splitRow{flex-direction:row}.S5HVoW_splitCol{flex-direction:column}.S5HVoW_splitChild{display:flex;position:relative;overflow:hidden}.S5HVoW_divider{z-index:3;touch-action:none;flex:none;position:relative}.S5HVoW_dividerRow:after,.S5HVoW_dividerCol:after{content:\"\";background:var(--dsw-alias-border-l2);transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out);position:absolute}.S5HVoW_dividerRow{cursor:col-resize;width:7px;margin:0 -2px}.S5HVoW_dividerRow:after{width:1px;top:0;bottom:0;left:50%;transform:translate(-50%)}.S5HVoW_dividerCol{cursor:row-resize;height:7px;margin:-2px 0}.S5HVoW_dividerCol:after{height:1px;top:50%;left:0;right:0;transform:translateY(-50%)}.S5HVoW_divider:hover:after,.S5HVoW_dividerActive:after{background:var(--dsw-alias-interactive-bg-hover-accent)}.S5HVoW_pane{background:var(--dsw-alias-bg-base);flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;position:relative}.S5HVoW_paneDrop{outline:1px solid var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-1px}.S5HVoW_dropOverlay{z-index:6;pointer-events:none;background:var(--dsw-alias-interactive-bg-hover-accent);opacity:.5;position:absolute}.S5HVoW_dropLeft{width:25%;top:0;bottom:0;left:0}.S5HVoW_dropRight{width:25%;top:0;bottom:0;right:0}.S5HVoW_dropUp{height:25%;top:0;left:0;right:0}.S5HVoW_dropDown{height:25%;bottom:0;left:0;right:0}.S5HVoW_dropCenter{outline:2px dashed var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-2px;background:0 0;inset:25%}.S5HVoW_paneContent{flex-direction:column;flex:1;min-height:0;display:flex;overflow:hidden}.S5HVoW_paneTab{flex-direction:column;flex:1;min-height:0;display:flex}.S5HVoW_paneTabHidden{display:none}.S5HVoW_paneEmptyCards{flex:1;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));align-content:start;gap:8px;min-height:0;padding:12px;display:grid;overflow:hidden}.S5HVoW_paneCard{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-strong-12);cursor:pointer;text-align:center;border-radius:8px;flex-direction:column;justify-content:center;align-items:center;gap:6px;padding:12px 8px;display:flex}.S5HVoW_paneCard:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}.S5HVoW_paneCard:disabled{opacity:.45;cursor:default}.S5HVoW_tabBar{border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:none;align-items:stretch;height:34px;display:flex}.S5HVoW_tabBarDrop{outline:1px dashed var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-1px}.S5HVoW_tabList{scrollbar-width:none;flex:1;min-width:0;display:flex;overflow-x:auto}.S5HVoW_tabList::-webkit-scrollbar{display:none}.S5HVoW_tab{min-width:64px;max-width:160px;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);border-right:1px solid var(--dsw-alias-border-l1);cursor:pointer;user-select:none;background:0 0;flex:none;align-items:center;gap:4px;padding:0 4px 0 10px;display:flex}.S5HVoW_tab:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_tabActive{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-active)}.S5HVoW_tabTitle{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.S5HVoW_tabBadge{min-width:16px;height:15px;font:var(--dsw-font-xxxs-strong-11);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary);border-radius:8px;flex:none;justify-content:center;align-items:center;padding:0 4px;display:inline-flex}.S5HVoW_tabClose{width:18px;height:18px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:4px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.S5HVoW_tabClose:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_tabBarPlus{background:var(--dsw-alias-bg-layer-1);width:22px;height:22px;color:var(--dsw-alias-label-tertiary);cursor:pointer;border:none;border-radius:5px;flex:none;justify-content:center;align-self:center;align-items:center;margin:0 6px;padding:0;display:inline-flex;position:sticky;right:0}.S5HVoW_tabBarPlus:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_pinnedTab{color:var(--dsw-alias-label-tertiary);font-style:italic}.S5HVoW_pinnedTab:hover{color:var(--dsw-alias-label-secondary)}.S5HVoW_explorer{flex-direction:column;flex:1;min-height:0;display:flex}.S5HVoW_explorerHeader{flex:none;justify-content:space-between;align-items:center;gap:8px;height:36px;padding:0 8px 0 12px;display:flex}.S5HVoW_explorerRoot{font:var(--dsw-font-s-14);color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.S5HVoW_explorerBody{flex:1;min-height:0;padding:4px 8px 8px;overflow:hidden auto}.S5HVoW_explorerRow{box-sizing:border-box;width:100%;max-width:100%;height:34px;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;white-space:nowrap;animation:S5HVoW_dsh-row-in .15s var(--ds-ease-in-out);background:0 0;border:none;border-radius:8px;align-items:center;gap:6px;padding:0 8px;display:flex}.S5HVoW_explorerRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_explorerRowRevealed{background:color-mix(in srgb, var(--dsw-alias-interactive-bg-hover-accent) 18%, transparent);box-shadow:inset 2px 0 0 var(--dsw-alias-interactive-bg-hover-accent)}.S5HVoW_explorerDir{font:var(--dsw-font-s-strong-14)}.S5HVoW_explorerHidden{opacity:.45}.S5HVoW_explorerSymlink{color:var(--dsw-alias-label-tertiary);flex:none}.S5HVoW_explorerBroken .S5HVoW_explorerName{color:var(--dsw-alias-state-error-primary)}.S5HVoW_explorerName{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.S5HVoW_explorerRef{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);height:20px;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-strong-11);cursor:pointer;border-radius:999px;flex:none;align-items:center;padding:0 8px;display:none}.S5HVoW_explorerRef:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_explorerRow:hover .S5HVoW_explorerRef,.S5HVoW_explorerRow:focus-within .S5HVoW_explorerRef{display:inline-flex}.S5HVoW_explorerCopied{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.S5HVoW_explorerError{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);cursor:default}@keyframes S5HVoW_dsh-row-in{0%{opacity:0}}.S5HVoW_explorerEmpty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px}.S5HVoW_explorerRowDropTarget{background:var(--dsw-alias-interactive-bg-hover);outline:1px dashed var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-1px}.S5HVoW_uploadDropZone{z-index:1001;pointer-events:none;border:2px dashed var(--dsw-alias-interactive-bg-hover-accent);box-shadow:0 0 0 200vmax var(--dsw-alias-bg-mask-drop);animation:S5HVoW_dsh-row-in .15s var(--ds-ease-in-out);border-radius:10px;justify-content:center;align-items:flex-start;padding:12px;display:flex;position:fixed}.S5HVoW_uploadDropHero{flex-direction:column;align-items:center;gap:10px;max-width:100%;padding-top:8px;display:flex}.S5HVoW_uploadDropZonePill{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);max-width:100%;box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-strong-12);border-radius:999px;align-items:center;gap:6px;padding:6px 12px;display:flex}.S5HVoW_uploadDropZoneText{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.S5HVoW_uploadDropChatHint{z-index:1002;pointer-events:none;animation:S5HVoW_dsh-row-in .15s var(--ds-ease-in-out);justify-content:center;align-items:center;padding:24px;display:flex;position:fixed;top:0;bottom:0;left:0}.S5HVoW_uploadDropChatCard{text-align:center;max-width:100%;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-strong-14);flex-direction:column;align-items:center;gap:12px;display:flex}.S5HVoW_uploadOverlay{z-index:30;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);animation:S5HVoW_dsh-row-in .15s var(--ds-ease-in-out);justify-content:center;align-items:center;display:flex;position:absolute;inset:0}.S5HVoW_uploadOverlayCard{border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-alias-bg-layer-2);min-width:280px;max-width:min(420px,100% - 48px);box-shadow:var(--dsw-shadow-lv3);border-radius:24px;flex-direction:column;gap:12px;padding:20px 24px;display:flex}.S5HVoW_uploadOverlayTitle{font:var(--dsw-font-s-strong-14);color:var(--dsw-alias-label-primary);align-items:center;gap:8px;display:flex}.S5HVoW_uploadOverlayTitle>svg{flex:none}.S5HVoW_uploadOverlayTitle>span{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.S5HVoW_uploadOverlayProgress{background:var(--dsw-alias-border-l2);border-radius:3px;height:6px;overflow:hidden}.S5HVoW_uploadOverlayProgressFill{background:var(--dsw-alias-interactive-bg-hover-accent);height:100%;transition:width .15s var(--ds-ease-in-out);border-radius:3px}.S5HVoW_uploadOverlayStatus{min-height:1em;font:var(--dsw-font-xxs-12);font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.S5HVoW_uploadOverlayCancel{border:1px solid var(--dsw-alias-border-l2);height:28px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-strong-12);cursor:pointer;background:0 0;border-radius:8px;align-self:flex-end;padding:0 14px}.S5HVoW_uploadOverlayCancel:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}.S5HVoW_uploadOverlayCancel:disabled{opacity:.4;cursor:default}.S5HVoW_editor{flex-direction:column;flex:1;min-height:0;display:flex}.S5HVoW_editorHeader{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:6px;padding:6px 8px;display:flex}.S5HVoW_editorTitle{min-width:0;font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.S5HVoW_editorPathInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0;height:28px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);border-radius:6px;flex:1;padding:0 10px}.S5HVoW_editorPathInput:focus{border-color:var(--dsw-alias-border-l2);outline:none}.S5HVoW_editorTreeToggleActive{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-active)}.S5HVoW_editorBody{flex:1;min-height:0;display:flex}.S5HVoW_editorMain{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}.S5HVoW_editorTreeDock{border-left:1px solid var(--dsw-alias-border-l1);flex:none;min-height:0;display:flex;position:relative}.S5HVoW_editorTreeResize{cursor:col-resize;touch-action:none;z-index:3;width:6px;position:absolute;top:0;bottom:0;left:0}.S5HVoW_editorTreeResize:hover{background:var(--dsw-alias-border-l2)}.S5HVoW_editorTreePanel{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;position:relative}.S5HVoW_editorTreePanelFull{flex:1}.S5HVoW_editorTreeSearch{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:6px;padding:6px 8px;display:flex}.S5HVoW_editorSearchInput{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0;height:26px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);border-radius:6px;flex:1;padding:0 10px}.S5HVoW_editorSearchInput:focus{border-color:var(--dsw-alias-border-l2);outline:none}.S5HVoW_editorSearchHint{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);padding:8px 12px}.S5HVoW_editorSearchResult{width:100%;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);text-align:left;cursor:pointer;text-overflow:ellipsis;white-space:nowrap;background:0 0;border:none;border-radius:6px;padding:4px 8px;display:block;overflow:hidden}.S5HVoW_editorSearchResult:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_editorStatus{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}.S5HVoW_editorStatusError{color:var(--dsw-alias-state-error-primary)}.S5HVoW_dirtyDot{background:var(--dsw-alias-state-warn-primary);border-radius:50%;flex:none;width:7px;height:7px}.S5HVoW_editorPlaceholder{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;flex:1;justify-content:center;align-items:center;padding:16px;display:flex}.S5HVoW_orphanedType{opacity:.7;overflow-wrap:anywhere;margin-top:8px;font-size:12px;display:block}.S5HVoW_editorBinary{text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:12px;padding:24px 16px;display:flex}.S5HVoW_editorBinaryNotice{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}.S5HVoW_editorDownloadLink{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-strong-12);cursor:pointer;transition:background var(--ds-transition-duration-slow) var(--ds-ease-in-out), border-color var(--ds-transition-duration-slow) var(--ds-ease-in-out);border-radius:6px;align-items:center;gap:6px;padding:6px 14px;text-decoration:none;display:inline-flex}.S5HVoW_editorDownloadLink:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}.S5HVoW_editorDocx{background:var(--dsw-alias-bg-base);flex-direction:column;flex:1;min-height:0;display:flex}.S5HVoW_editorDocxViewport{background:var(--dsw-alias-bg-base);flex-direction:column;flex:1;min-height:0;display:flex;overflow:auto}.S5HVoW_editorDocxWrap{flex:none;padding:16px}.S5HVoW_editorDocxZoom{border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:none;align-items:center;gap:8px;min-height:34px;padding:4px 10px;display:flex}.S5HVoW_editorDocxZoomHint,.S5HVoW_editorDocxZoomValue{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.S5HVoW_editorDocxZoomValue{text-align:right;width:36px}.S5HVoW_editorDocxZoomRange{min-width:72px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;flex:1}.S5HVoW_editorXlsx{background:var(--dsw-alias-bg-base);flex:1;min-height:0;position:relative;overflow:hidden}.S5HVoW_editorUniverHost{width:100%;min-width:0;height:100%;min-height:0}.S5HVoW_editorOfficeOverlay{z-index:2;background:var(--dsw-alias-bg-base);display:flex;position:absolute;inset:0}.S5HVoW_editorPptx{background:var(--dsw-alias-bg-base);flex-direction:column;flex:1;min-height:0;display:flex}.S5HVoW_editorPptxToolbar{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;justify-content:center;align-items:center;gap:8px;padding:6px 8px;display:flex}.S5HVoW_editorPptxToolbar .S5HVoW_editorDownloadLink{margin-left:auto}.S5HVoW_editorPptxButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:28px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-strong-12);cursor:pointer;border-radius:6px;padding:0 10px}.S5HVoW_editorPptxButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_editorPptxButton:disabled{opacity:.4;cursor:default}.S5HVoW_editorPptxPosition{text-align:center;min-width:64px;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}.S5HVoW_editorPptxStage{flex:1;min-height:0;position:relative;overflow:hidden}.S5HVoW_editorPptxHost{width:100%;min-width:0;height:100%;min-height:0;overflow:auto}.S5HVoW_editorVideo{background:var(--dsw-alias-bg-base);flex-direction:column;flex:1;min-height:0;display:flex}.S5HVoW_editorVideoStage{background:#000;flex:1;justify-content:center;align-items:center;min-height:0;display:flex}.S5HVoW_editorVideoPlayer{background:#000;outline:none;width:100%;height:100%;min-height:0;max-height:100%}.S5HVoW_editorVideoMeta{border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:none;align-items:center;gap:10px;min-height:34px;padding:4px 10px;display:flex}.S5HVoW_editorVideoName{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);flex:1;overflow:hidden}.S5HVoW_editorVideoNotice{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.S5HVoW_editorError{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);padding:12px 16px}.S5HVoW_editorBanner{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary);flex:none;padding:4px 8px}.S5HVoW_sandboxStatus{font:var(--dsw-font-xxxs-11);flex:none;align-items:center;gap:8px;padding:4px 10px;display:flex}.S5HVoW_sandboxStatusOn{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1)}.S5HVoW_sandboxStatusOff{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);border-bottom:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent)}.S5HVoW_sandboxDot{background:var(--dsw-alias-state-success-primary);border-radius:50%;flex:none;width:6px;height:6px}.S5HVoW_sandboxStatusOff .S5HVoW_sandboxDot{background:var(--dsw-alias-state-error-primary)}.S5HVoW_sandboxStatusText{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.S5HVoW_sandboxAction{border:1px solid var(--dsw-alias-border-l2);font:inherit;color:inherit;cursor:pointer;background:0 0;border-radius:6px;flex:none;padding:2px 8px}.S5HVoW_sandboxAction:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_editorHtml{background:var(--dsw-alias-bg-base);border:none;flex:1;width:100%;min-height:0}.S5HVoW_browser{flex-direction:column;flex:1;min-height:0;display:flex}.S5HVoW_browserBar{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:4px;padding:6px 8px;display:flex}.S5HVoW_browserInput{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-width:0;height:28px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);border-radius:6px;flex:1;padding:0 10px}.S5HVoW_browserInput:focus{border-color:var(--dsw-alias-border-l2);outline:none}.S5HVoW_browserMessage{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary);flex:none;padding:4px 12px}.S5HVoW_browserChanged{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;padding:0 6px}.S5HVoW_browserLimit{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);border-top:1px solid var(--dsw-alias-border-l1);flex:none;margin:0;padding:4px 12px}.S5HVoW_browserFrame{background:var(--dsw-alias-bg-base);border:none;flex:1;width:100%;min-height:0}.S5HVoW_browserStart{text-align:center;min-height:0;font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);flex:1;justify-content:center;align-items:center;padding:20px;display:flex}.S5HVoW_browserBlocked{text-align:center;min-height:0;color:var(--dsw-alias-state-warn-primary);flex-direction:column;flex:1;justify-content:center;align-items:center;gap:6px;padding:24px;display:flex}.S5HVoW_browserBlockedTitle{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary)}.S5HVoW_browserBlockedDesc{max-width:280px;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-secondary)}.S5HVoW_browserBlockedActions{gap:8px;margin-top:6px;display:flex}.S5HVoW_browserBlockedButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxxs-11);cursor:pointer;border-radius:6px;padding:4px 12px}.S5HVoW_browserBlockedButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_editorCm{background:0 0;flex:1;min-height:0;overflow:hidden}.S5HVoW_editorCmHidden{display:none}.S5HVoW_editorCm .cm-editor{height:100%}.S5HVoW_editorCm .cm-scroller{padding:12px 16px}.S5HVoW_editorCm .cm-editor.cm-focused{outline:none}.S5HVoW_editorModeToggle{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:6px;flex:none;align-items:center;gap:2px;padding:2px;display:inline-flex}.S5HVoW_editorModeButton{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);cursor:pointer;background:0 0;border:none;border-radius:4px;padding:2px 8px}.S5HVoW_editorModeButton:hover{color:var(--dsw-alias-label-primary)}.S5HVoW_editorModeActive{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}.S5HVoW_editorImageWrap{flex:1;justify-content:center;align-items:center;min-height:0;padding:12px;display:flex;overflow:auto}.S5HVoW_editorImage{object-fit:contain;max-width:100%;max-height:100%}.S5HVoW_editorMd{min-height:0;font:var(--dsw-font-xs-13);flex:1;padding:12px 16px;overflow-y:auto}.S5HVoW_mermaidWrap{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:6px;margin:6px 0;overflow:hidden}.S5HVoW_mermaidHeader{border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);justify-content:space-between;align-items:center;gap:6px;padding:4px 8px;display:flex}.S5HVoW_mermaidInfo{font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-tertiary)}.S5HVoW_mermaidCopy{height:20px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-11);cursor:pointer;background:0 0;border:none;border-radius:4px;align-items:center;gap:4px;padding:0 6px;display:inline-flex}.S5HVoW_mermaidCopy:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_mermaidBody{cursor:zoom-in;justify-content:center;padding:10px;display:flex;overflow:auto}.S5HVoW_mermaidBody svg{max-width:100%;height:auto}.S5HVoW_mermaidError{border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xxxs-11);padding:6px 10px}.S5HVoW_mermaidCode{font:var(--dsw-font-xxxs-11);margin:0;padding:8px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto}.S5HVoW_mermaidMarkdown .md-code-block[data-mermaid-processed]{display:contents}.S5HVoW_mermaidModal{z-index:1000;background:var(--dsw-alias-bg-mask-1);backdrop-filter:blur(2px);flex-direction:column;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.S5HVoW_mermaidModalToolbar{z-index:10;gap:8px;display:flex;position:absolute;top:16px;right:16px}.S5HVoW_mermaidModalButton{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);width:36px;height:36px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xs-strong-13);cursor:pointer;border-radius:8px;justify-content:center;align-items:center;display:inline-flex}.S5HVoW_mermaidModalButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_mermaidModalStage{justify-content:center;align-items:center;width:90vw;height:80vh;display:flex;position:relative;overflow:hidden}.S5HVoW_mermaidModalStage svg{cursor:grab;transform-origin:50%;user-select:none;-webkit-user-drag:none;background:var(--dsw-alias-bg-layer-1);border-radius:12px;max-width:none;max-height:none;padding:16px}.S5HVoW_mermaidModalStage svg:active{cursor:grabbing}.S5HVoW_mermaidModalHint{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);pointer-events:none;position:absolute;bottom:16px;left:50%;transform:translate(-50%)}.S5HVoW_selectionPopup{z-index:60;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);height:28px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxxs-strong-11);white-space:nowrap;cursor:pointer;border-radius:6px;align-items:center;padding:0 10px;display:inline-flex;position:fixed;transform:translate(-50%,calc(-100% - 8px))}.S5HVoW_selectionPopup:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_editorPdf{background:var(--dsw-alias-bg-base);flex-direction:column;flex:1;min-height:0;display:flex}.S5HVoW_editorPdfToolbar{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;justify-content:flex-end;padding:6px 8px;display:flex}.S5HVoW_editorPdfStage{flex:1;min-height:0;display:flex;position:relative}.S5HVoW_editorPdfFrame{background:var(--dsw-alias-bg-base);border:none;flex:1;width:100%;min-height:0}.S5HVoW_editorPdfFrameBlocked{pointer-events:none}.S5HVoW_editorPdfDragShield{z-index:4;pointer-events:none;background:0 0;position:absolute;inset:0}.S5HVoW_editorPdfDragShieldActive{pointer-events:auto}body[data-dsh-tab-dragging] .S5HVoW_editorPdfFrame{pointer-events:none!important}body[data-dsh-tab-dragging] .S5HVoW_editorPdfDragShield{pointer-events:auto!important}.S5HVoW_terminalWrap{background:var(--dsw-alias-bg-base);flex-direction:column;flex:1;min-height:0;display:flex;position:relative}.S5HVoW_terminal{flex:1;min-height:0;padding:6px 4px 6px 8px}.S5HVoW_terminal .xterm{height:100%}.S5HVoW_terminalBanner{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary);flex-wrap:wrap;flex:none;align-items:center;gap:8px;padding:3px 10px;display:flex}.S5HVoW_terminalBannerUrl{word-break:break-all;opacity:.85;flex-basis:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.S5HVoW_boundaryError{z-index:50;background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l2);font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);flex-direction:column;align-items:flex-start;gap:8px;padding:16px;display:flex;position:fixed;top:0;bottom:0;right:0;overflow:auto}.S5HVoW_terminalRetry{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-strong-11);cursor:pointer;border-radius:999px;flex:none;padding:1px 8px}.S5HVoW_terminalRetry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_gitFoldRow{box-sizing:border-box;background:var(--dsw-alias-bg-layer-1);width:100%;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);text-align:center;cursor:pointer;border:none;outline:none;padding:2px 12px;display:block}.S5HVoW_gitFoldRow:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.S5HVoW_gitFoldRow:disabled{cursor:default}.S5HVoW_gitFoldRowFailed{color:var(--dsw-alias-state-error-primary);opacity:.7}.S5HVoW_explorerRenameInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;height:20px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);border-radius:4px;outline:none;flex:1;padding:0 4px}.S5HVoW_changesLensToggle{flex:none;gap:2px;padding:2px;display:flex}.S5HVoW_changesLensTab{height:24px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-strong-11);cursor:pointer;background:0 0;border:none;border-radius:6px;flex:1}.S5HVoW_changesLensTab:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_changesLensTabActive,.S5HVoW_changesLensTabActive:hover{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}.S5HVoW_sessionLens{flex:1;min-height:0;overflow-y:auto}.S5HVoW_sessionLensBar{align-items:center;gap:6px;height:26px;padding:0 4px;display:flex}.S5HVoW_sessionLensCount{min-width:0;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:1}.S5HVoW_sessionLensEmpty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px}.S5HVoW_sessionLensItem{border-bottom:1px solid var(--dsw-alias-border-l1)}.S5HVoW_sessionLensRow{box-sizing:border-box;width:100%;min-height:30px;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:6px;outline:none;align-items:center;gap:8px;padding:4px 10px;display:flex}.S5HVoW_sessionLensRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_sessionLensPath{text-overflow:ellipsis;white-space:nowrap;text-align:left;direction:rtl;flex:1;min-width:0;overflow:hidden}.S5HVoW_sessionLensMeta{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.S5HVoW_sessionLensPreview{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);max-height:260px;font-family:var(--ds-font-family-code);font-size:var(--dsw-font-xxxs-11-font-size);color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;border-radius:6px;margin:0 8px 6px;padding:6px 8px;line-height:1.5;overflow:auto}.S5HVoW_terminalWaitBanner{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary);flex:none;align-items:center;gap:8px;padding:3px 10px;display:flex}.S5HVoW_terminalWaitNeedle{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden}.S5HVoW_terminalDepsBanner{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary);flex-direction:column;flex:none;gap:6px;padding:10px;display:flex}.S5HVoW_terminalDepsTitle{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-state-warn-primary)}.S5HVoW_terminalDepsHint{opacity:.9}.S5HVoW_terminalDepsCommandRow{align-items:flex-start;gap:8px;display:flex}.S5HVoW_terminalRepairCommand{white-space:pre-wrap;word-break:break-all;user-select:text;min-width:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;flex:1;max-height:160px;margin:0;padding:6px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.5;overflow:auto}.S5HVoW_terminalDepsNote{opacity:.85}.S5HVoW_terminalDepsActions{align-items:center;gap:8px;display:flex}.S5HVoW_tabBoundaryError{min-height:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);flex-direction:column;flex:1;align-items:flex-start;gap:8px;padding:12px 16px;display:flex;overflow:auto}.S5HVoW_git{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;overflow:hidden auto}.S5HVoW_gitHeader{flex:none;align-items:center;gap:8px;height:36px;padding:0 8px 0 12px;display:flex}.S5HVoW_gitWorktreeRow{flex:none;align-items:center;gap:8px;padding:6px 8px 0 12px;display:flex}.S5HVoW_gitWorktreeLabel{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);flex:none}.S5HVoW_gitBranchSelect{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);min-width:0;height:26px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);border-radius:6px;flex:1;padding:0 6px}.S5HVoW_gitSection{border-top:1px solid var(--dsw-alias-border-l1)}.S5HVoW_gitSectionHeader{font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-tertiary);text-transform:uppercase;justify-content:space-between;align-items:center;padding:6px 12px 4px;display:flex}.S5HVoW_gitLink{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-brand-primary);cursor:pointer;background:0 0;border:none;padding:0}.S5HVoW_gitLink:hover:not(:disabled){text-decoration:underline}.S5HVoW_gitLink:disabled{opacity:.4;cursor:default}.S5HVoW_gitRow{min-height:34px;animation:S5HVoW_dsh-row-in .15s var(--ds-ease-in-out);border-radius:8px;align-items:center;gap:6px;margin:0 6px;padding:0 8px;display:flex}.S5HVoW_gitRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_gitRowSelected{background:var(--dsw-alias-interactive-bg-active)}.S5HVoW_gitRowMain{cursor:pointer;text-align:left;background:0 0;border:none;flex:1;align-items:center;gap:8px;min-width:0;padding:3px 0;display:flex}.S5HVoW_gitBadge{width:20px;height:16px;font:var(--dsw-font-xxxs-strong-11);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);border-radius:4px;flex:none;justify-content:center;align-items:center;display:inline-flex}.S5HVoW_gitName{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);flex:1;overflow:hidden}.S5HVoW_gitEmpty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);padding:4px 12px 8px}.S5HVoW_gitPlaceholder{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px}.S5HVoW_gitError{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);white-space:pre-wrap;align-items:flex-start;gap:8px;padding:8px 12px;display:flex}.S5HVoW_gitDiff{border-top:1px solid var(--dsw-alias-border-l1);padding:8px}.S5HVoW_gitDiffTab{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;overflow:hidden auto}.S5HVoW_gitDiffTabHeader{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:8px;height:36px;padding:0 8px 0 12px;display:flex}.S5HVoW_gitDiffTabTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);flex:1;overflow:hidden}.S5HVoW_gitDiffFile{width:100%;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:baseline;gap:6px;padding:8px 2px 2px;display:flex}.S5HVoW_gitDiffFile:disabled{cursor:default}.S5HVoW_gitDiffFile:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_gitDiffFileChevron{color:var(--dsw-alias-label-tertiary);flex:none;transform:rotate(0)}.S5HVoW_gitDiffFileChevronExpanded{transform:rotate(90deg)}.S5HVoW_gitDiffFilePath{font:var(--dsw-font-xxs-strong-12);color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.S5HVoW_gitDiffFileOld{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:none;max-width:40%;overflow:hidden}.S5HVoW_gitDiffFileTag{border:1px solid var(--dsw-alias-border-l2);font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:0 6px}.S5HVoW_gitDiffHunk{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-tertiary);gap:8px;padding:3px 2px;display:flex}.S5HVoW_gitDiffHunkHeader{color:var(--dsw-alias-label-secondary);flex:none}.S5HVoW_gitDiffHunkSection{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.S5HVoW_gitDiffLine{font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap;overflow-wrap:anywhere;align-items:stretch;min-width:0;line-height:20px;display:flex}.S5HVoW_gitDiffNum{text-align:right;width:36px;color:var(--dsw-alias-label-tertiary);user-select:none;flex:none;padding-right:8px}.S5HVoW_gitDiffCode{flex:1;min-width:0;overflow:visible}.S5HVoW_gitDiffCtx{color:var(--dsw-alias-label-primary)}.S5HVoW_gitDiffDel{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)}.S5HVoW_gitDiffAdd{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)}.S5HVoW_gitDiffMeta{padding-left:2px}.S5HVoW_gitDiffMetaText{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);font-style:italic}.S5HVoW_gitDiffExpand{width:100%;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-brand-primary);cursor:pointer;text-align:center;background:0 0;border:none;margin:4px 0;display:block}.S5HVoW_gitDiffExpand:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_gitConfirmDesc{font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);white-space:pre-wrap;margin:0}.S5HVoW_gitCommit{border-top:1px solid var(--dsw-alias-border-l1);align-items:center;gap:6px;padding:8px 12px;display:flex}.S5HVoW_gitCommitInput{flex:1;min-width:0}.S5HVoW_gitCommitButton{background:var(--dsw-alias-button-primary-fill);height:26px;color:var(--dsw-alias-label-primary-inverted);font:var(--dsw-font-xxs-strong-12);cursor:pointer;border:none;border-radius:6px;flex:none;padding:0 12px}.S5HVoW_gitCommitButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.S5HVoW_gitCommitButton:disabled{opacity:.45;cursor:default}.S5HVoW_gitLogRow{cursor:pointer;border-radius:8px;flex-direction:column;gap:2px;padding:5px 12px;display:flex}.S5HVoW_gitLogRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_gitLogLine1{align-items:baseline;gap:8px;min-width:0;display:flex}.S5HVoW_gitLogHash{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-tertiary);flex:none}.S5HVoW_gitLogLine2{flex-wrap:wrap;align-items:center;gap:6px;min-width:0;display:flex}.S5HVoW_gitLogRef{border:1px solid var(--dsw-alias-border-l2);font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-brand-primary);white-space:nowrap;border-radius:999px;flex:none;padding:0 5px}.S5HVoW_gitLogSubject{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);flex:1;overflow:hidden}.S5HVoW_gitLogMeta{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}.S5HVoW_gitLogMore{border:1px solid var(--dsw-alias-border-l2);width:calc(100% - 24px);font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:6px;margin:4px 12px 8px;padding:6px 0;display:block}.S5HVoW_gitLogMore:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_gitLogMore:disabled{opacity:.5;cursor:default}.S5HVoW_producedRow{flex-wrap:wrap;align-items:center;gap:8px;padding:4px 0;display:flex}.S5HVoW_producedLabel{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}.S5HVoW_producedChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);max-width:200px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);cursor:pointer;border-radius:999px;align-items:center;gap:4px;padding:2px 8px;display:inline-flex;overflow:hidden}.S5HVoW_producedChip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_producedChip span{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.S5HVoW_producedMore{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary)}.S5HVoW_toggleButton:focus-visible,.S5HVoW_iconButton:focus-visible,.S5HVoW_tab:focus-visible,.S5HVoW_tabClose:focus-visible,.S5HVoW_tabBarPlus:focus-visible,.S5HVoW_paneCard:focus-visible,.S5HVoW_explorerRow:focus-visible,.S5HVoW_explorerRef:focus-visible,.S5HVoW_gitRowMain:focus-visible,.S5HVoW_gitLink:focus-visible,.S5HVoW_gitCommitButton:focus-visible,.S5HVoW_gitLogRow:focus-visible,.S5HVoW_gitLogMore:focus-visible,.S5HVoW_gitDiffFile:focus-visible,.S5HVoW_gitDiffExpand:focus-visible,.S5HVoW_terminalRetry:focus-visible,.S5HVoW_editorModeButton:focus-visible,.S5HVoW_editorDownloadLink:focus-visible,.S5HVoW_editorPptxButton:focus-visible,.S5HVoW_editorDocxZoomRange:focus-visible{outline:2px solid var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-1px}@media (prefers-reduced-motion:reduce){.S5HVoW_panel,.S5HVoW_panelHidden,.S5HVoW_toggleCluster,.S5HVoW_toggleButton,.S5HVoW_tab,.S5HVoW_tabBarPlus,.S5HVoW_paneCard,.S5HVoW_explorerRow,.S5HVoW_gitRow,.S5HVoW_divider,.S5HVoW_dividerRow:after,.S5HVoW_dividerCol:after{transition:none;animation:none}}@media (width<=767px){.S5HVoW_panel:not(.S5HVoW_panelHidden) .S5HVoW_tabBar{padding-right:40px}.S5HVoW_tab{min-width:48px;max-width:128px}}.S5HVoW_openWithLabel{align-items:center;gap:8px;width:100%;min-width:0;display:flex}.S5HVoW_openWithName{text-overflow:ellipsis;white-space:nowrap;flex:auto;min-width:0;overflow:hidden}.S5HVoW_openWithChevron{color:var(--dsw-alias-label-tertiary);flex:none}.S5HVoW_openWithPin{width:20px;height:20px;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:6px;flex:none;justify-content:center;align-items:center;display:inline-flex}.S5HVoW_openWithPin:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_openWithPinActive{color:var(--dsw-alias-state-business-primary)}.S5HVoW_editorHtmlBlock{margin:8px 0}.S5HVoW_editorHtmlBlock img,.S5HVoW_editorHtmlBlock video{max-width:100%}.S5HVoW_editorHtmlBlock details{margin:4px 0;padding:4px 0}.S5HVoW_editorHtmlBlock summary{cursor:pointer}.S5HVoW_tocBar{z-index:3;pointer-events:none;justify-content:flex-end;height:0;display:flex;position:sticky;top:0}.S5HVoW_tocButton{pointer-events:auto;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);width:26px;height:26px;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;justify-content:center;align-items:center;margin:4px 2px 0 0;padding:0;display:inline-flex}.S5HVoW_tocButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_tocPanel{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);width:min(300px,82%);max-height:60vh;box-shadow:var(--dsw-shadow-lv2);pointer-events:auto;border-radius:8px;flex-direction:column;padding:4px;display:flex;position:absolute;top:32px;right:2px;overflow-y:auto}.S5HVoW_tocItem{min-width:0;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:6px;align-items:baseline;gap:8px;padding:4px 8px;display:flex}.S5HVoW_tocItem:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_tocItem[data-level=\"2\"]{padding-left:18px}.S5HVoW_tocItem[data-level=\"3\"]{padding-left:28px}.S5HVoW_tocItem[data-level=\"4\"]{padding-left:38px}.S5HVoW_tocItem[data-level=\"5\"]{padding-left:48px}.S5HVoW_tocItem[data-level=\"6\"]{padding-left:58px}.S5HVoW_tocItemLevel{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.S5HVoW_tocItemText{text-overflow:ellipsis;white-space:nowrap;flex:auto;min-width:0;overflow:hidden}@keyframes S5HVoW_dsh-toc-flash{0%,60%{background:var(--dsw-alias-interactive-bg-hover)}to{background:0 0}}.S5HVoW_browserLive{flex-direction:column;gap:6px;padding:8px 10px;display:flex;position:absolute;inset:0;overflow:hidden}.S5HVoW_browserLiveStatus{opacity:.75;align-items:center;gap:8px;font-size:12px;display:flex}.S5HVoW_browserLiveCanvas{object-fit:contain;border:1px solid var(--dsw-alias-border-l,#80808040);cursor:crosshair;background:#fff;border-radius:8px;flex:1;width:100%;min-height:0}.S5HVoW_browserLiveTarget{max-width:260px;font-size:12px}.S5HVoW_spacer{flex:1;min-width:4px}.S5HVoW_gitUpstream{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;align-items:center;gap:4px;display:inline-flex}.S5HVoW_gitAhead{color:var(--dsw-alias-state-business-primary)}.S5HVoW_gitBehind{color:var(--dsw-alias-state-warn-primary)}.S5HVoW_gitSynced{color:var(--dsw-alias-state-success-primary)}.S5HVoW_gitPending{color:var(--dsw-alias-state-warn-primary)}.S5HVoW_gitLineStat{font:var(--dsw-font-xxxs-11);white-space:nowrap;flex:none;align-items:center;gap:4px;margin-left:auto;padding-left:8px;display:inline-flex}.S5HVoW_gitAdded{color:var(--dsw-alias-state-success-primary)}.S5HVoW_gitRemoved{color:var(--dsw-alias-state-error-primary)}.S5HVoW_gitUntracked{color:var(--dsw-alias-label-tertiary)}.S5HVoW_gitPushRow{align-items:center;gap:8px;padding:0 12px 8px;display:flex}.S5HVoW_gitPushRow .S5HVoW_gitLink{align-items:center;gap:3px;display:inline-flex}.S5HVoW_gitBranchView{flex-direction:column;flex:1;min-height:0;display:flex;overflow:hidden auto}.S5HVoW_gitBranchToolbar,.S5HVoW_gitBranchForm{flex:none;align-items:center;gap:6px;padding:6px 8px 6px 12px;display:flex}.S5HVoW_gitBranchForm{padding-top:0}.S5HVoW_gitBranchSearch{flex:1;min-width:0}.S5HVoW_gitBranchRow{align-items:center;gap:4px;min-height:30px;padding-right:6px;display:flex}.S5HVoW_gitBranchRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_gitBranchName{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);overflow:hidden}.S5HVoW_gitBranchBadge{background:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxxs-11);white-space:nowrap;border-radius:999px;flex:none;padding:0 5px}.S5HVoW_gitBranchMeta{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);flex:none;overflow:hidden}.S5HVoW_gitGh{flex-direction:column;flex:1;min-height:0;display:flex;overflow:hidden auto}.S5HVoW_gitGhHeader{flex:none;align-items:center;gap:6px;min-height:32px;padding:0 8px 0 12px;display:flex}.S5HVoW_gitGhRepo{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-strong-12);overflow:hidden}.S5HVoW_gitGhEnv{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);flex:none;padding:0 12px 6px}.S5HVoW_gitGhHint{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);margin-top:6px;line-height:1.5}.S5HVoW_gitGhNotice{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxxs-11);border-radius:6px;flex:none;align-items:center;gap:6px;margin:0 12px 6px;padding:6px 8px;display:flex}.S5HVoW_gitGhRow{flex-wrap:wrap;align-items:center;gap:6px;min-height:30px;padding:5px 12px;display:flex}.S5HVoW_gitGhRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_gitGhNumber{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);flex:none}.S5HVoW_gitGhTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);flex:1;overflow:hidden}.S5HVoW_gitGhMergeConfirm{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-11);flex:none;align-items:center;gap:6px;display:inline-flex}.S5HVoW_gitGhMethod{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);height:22px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxxs-11);border-radius:6px;padding:0 4px}.S5HVoW_gitGhForm{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;flex-direction:column;flex:none;gap:6px;margin:6px 12px 12px;padding:8px;display:flex}.S5HVoW_gitGhFormTitle{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-strong-11)}.S5HVoW_gitGhInput{width:100%}.S5HVoW_gitGhTextarea{resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);width:100%;min-height:56px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);border-radius:6px;padding:6px 8px;font-family:inherit}.S5HVoW_gitGhFormRow{align-items:center;gap:8px;display:flex}.S5HVoW_gitGhDraft{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-11);white-space:nowrap;flex:none;align-items:center;gap:4px;display:inline-flex}.S5HVoW_gitError button{flex:none;margin-left:auto}.S5HVoW_gitConfirmDanger{color:var(--dsw-alias-state-error-primary)}.S5HVoW_schedPreview{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);border-radius:8px;flex-direction:column;flex:none;gap:4px;margin:8px 8px 4px;padding:8px 10px 10px;display:flex}.S5HVoW_schedPreviewHead{align-items:flex-start;gap:6px;display:flex}.S5HVoW_schedPreviewTitle{min-width:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;flex:1;font-size:13px;font-weight:600}.S5HVoW_schedPreviewClose{width:20px;height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.S5HVoW_schedPreviewClose:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.S5HVoW_schedPreviewClose:focus-visible{outline:2px solid var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-1px}.S5HVoW_schedPreviewRow{align-items:flex-start;gap:8px;font-size:12px;line-height:18px;display:flex}.S5HVoW_schedPreviewLabel{width:56px;color:var(--dsw-alias-label-secondary);flex:none}.S5HVoW_schedPreviewValue{min-width:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;flex:1}.S5HVoW_schedPreviewPrompt{min-width:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;-webkit-line-clamp:6;-webkit-box-orient:vertical;flex:1;display:-webkit-box;overflow:hidden}.S5HVoW_plansView{flex-direction:column;flex:1;min-height:0;display:flex;overflow:hidden auto}.S5HVoW_plansToolbar{flex:none;align-items:center;gap:6px;padding:6px 8px 6px 12px;display:flex}.S5HVoW_plansSearch{flex:1;min-width:0}.S5HVoW_plansRow{align-items:center;gap:4px;padding-right:6px;display:flex}.S5HVoW_plansRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.S5HVoW_plansRowMain{cursor:pointer;text-align:left;background:0 0;border:none;flex:1;align-items:flex-start;gap:8px;min-width:0;padding:5px 0 5px 12px;display:flex}.S5HVoW_plansRowMain:focus-visible{outline:2px solid var(--dsw-alias-interactive-bg-hover-accent);outline-offset:-1px}.S5HVoW_plansGlyph{color:var(--dsw-alias-label-secondary);flex:none;padding-top:1px;display:inline-flex}.S5HVoW_plansText{flex-direction:column;flex:1;gap:1px;min-width:0;display:flex}.S5HVoW_plansTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);overflow:hidden}.S5HVoW_plansMeta{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);overflow:hidden}.S5HVoW_plansEmpty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px 12px}.S5HVoW_plansHint{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);overflow-wrap:anywhere;padding:6px 12px}.S5HVoW_plansEmpty .S5HVoW_plansHint{padding:4px 0 0;& .S5HVoW_tocFlash{border-radius:4px;animation:1.2s ease-out S5HVoW_dsh-toc-flash}}";
		const tagId$5 = "dsh-coding-sidebar/sidebar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-coding-sidebar";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var sidebar_module_css_default = {
			"boundaryError": "S5HVoW_boundaryError",
			"browser": "S5HVoW_browser",
			"browserBar": "S5HVoW_browserBar",
			"browserBlocked": "S5HVoW_browserBlocked",
			"browserBlockedActions": "S5HVoW_browserBlockedActions",
			"browserBlockedButton": "S5HVoW_browserBlockedButton",
			"browserBlockedDesc": "S5HVoW_browserBlockedDesc",
			"browserBlockedTitle": "S5HVoW_browserBlockedTitle",
			"browserChanged": "S5HVoW_browserChanged",
			"browserFrame": "S5HVoW_browserFrame",
			"browserInput": "S5HVoW_browserInput",
			"browserLimit": "S5HVoW_browserLimit",
			"browserLive": "S5HVoW_browserLive",
			"browserLiveCanvas": "S5HVoW_browserLiveCanvas",
			"browserLiveStatus": "S5HVoW_browserLiveStatus",
			"browserLiveTarget": "S5HVoW_browserLiveTarget",
			"browserMessage": "S5HVoW_browserMessage",
			"browserStart": "S5HVoW_browserStart",
			"changesLensTab": "S5HVoW_changesLensTab",
			"changesLensTabActive": "S5HVoW_changesLensTabActive",
			"changesLensToggle": "S5HVoW_changesLensToggle",
			"dirtyDot": "S5HVoW_dirtyDot",
			"divider": "S5HVoW_divider",
			"dividerActive": "S5HVoW_dividerActive",
			"dividerCol": "S5HVoW_dividerCol",
			"dividerRow": "S5HVoW_dividerRow",
			"dropCenter": "S5HVoW_dropCenter",
			"dropDown": "S5HVoW_dropDown",
			"dropLeft": "S5HVoW_dropLeft",
			"dropOverlay": "S5HVoW_dropOverlay",
			"dropRight": "S5HVoW_dropRight",
			"dropUp": "S5HVoW_dropUp",
			"dsh-row-in": "S5HVoW_dsh-row-in",
			"dsh-toc-flash": "S5HVoW_dsh-toc-flash",
			"editor": "S5HVoW_editor",
			"editorBanner": "S5HVoW_editorBanner",
			"editorBinary": "S5HVoW_editorBinary",
			"editorBinaryNotice": "S5HVoW_editorBinaryNotice",
			"editorBody": "S5HVoW_editorBody",
			"editorCm": "S5HVoW_editorCm",
			"editorCmHidden": "S5HVoW_editorCmHidden",
			"editorDocx": "S5HVoW_editorDocx",
			"editorDocxViewport": "S5HVoW_editorDocxViewport",
			"editorDocxWrap": "S5HVoW_editorDocxWrap",
			"editorDocxZoom": "S5HVoW_editorDocxZoom",
			"editorDocxZoomHint": "S5HVoW_editorDocxZoomHint",
			"editorDocxZoomRange": "S5HVoW_editorDocxZoomRange",
			"editorDocxZoomValue": "S5HVoW_editorDocxZoomValue",
			"editorDownloadLink": "S5HVoW_editorDownloadLink",
			"editorError": "S5HVoW_editorError",
			"editorHeader": "S5HVoW_editorHeader",
			"editorHtml": "S5HVoW_editorHtml",
			"editorHtmlBlock": "S5HVoW_editorHtmlBlock",
			"editorImage": "S5HVoW_editorImage",
			"editorImageWrap": "S5HVoW_editorImageWrap",
			"editorMain": "S5HVoW_editorMain",
			"editorMd": "S5HVoW_editorMd",
			"editorModeActive": "S5HVoW_editorModeActive",
			"editorModeButton": "S5HVoW_editorModeButton",
			"editorModeToggle": "S5HVoW_editorModeToggle",
			"editorOfficeOverlay": "S5HVoW_editorOfficeOverlay",
			"editorPathInput": "S5HVoW_editorPathInput",
			"editorPdf": "S5HVoW_editorPdf",
			"editorPdfDragShield": "S5HVoW_editorPdfDragShield",
			"editorPdfDragShieldActive": "S5HVoW_editorPdfDragShieldActive",
			"editorPdfFrame": "S5HVoW_editorPdfFrame",
			"editorPdfFrameBlocked": "S5HVoW_editorPdfFrameBlocked",
			"editorPdfStage": "S5HVoW_editorPdfStage",
			"editorPdfToolbar": "S5HVoW_editorPdfToolbar",
			"editorPlaceholder": "S5HVoW_editorPlaceholder",
			"editorPptx": "S5HVoW_editorPptx",
			"editorPptxButton": "S5HVoW_editorPptxButton",
			"editorPptxHost": "S5HVoW_editorPptxHost",
			"editorPptxPosition": "S5HVoW_editorPptxPosition",
			"editorPptxStage": "S5HVoW_editorPptxStage",
			"editorPptxToolbar": "S5HVoW_editorPptxToolbar",
			"editorSearchHint": "S5HVoW_editorSearchHint",
			"editorSearchInput": "S5HVoW_editorSearchInput",
			"editorSearchResult": "S5HVoW_editorSearchResult",
			"editorStatus": "S5HVoW_editorStatus",
			"editorStatusError": "S5HVoW_editorStatusError",
			"editorTitle": "S5HVoW_editorTitle",
			"editorTreeDock": "S5HVoW_editorTreeDock",
			"editorTreePanel": "S5HVoW_editorTreePanel",
			"editorTreePanelFull": "S5HVoW_editorTreePanelFull",
			"editorTreeResize": "S5HVoW_editorTreeResize",
			"editorTreeSearch": "S5HVoW_editorTreeSearch",
			"editorTreeToggleActive": "S5HVoW_editorTreeToggleActive",
			"editorUniverHost": "S5HVoW_editorUniverHost",
			"editorVideo": "S5HVoW_editorVideo",
			"editorVideoMeta": "S5HVoW_editorVideoMeta",
			"editorVideoName": "S5HVoW_editorVideoName",
			"editorVideoNotice": "S5HVoW_editorVideoNotice",
			"editorVideoPlayer": "S5HVoW_editorVideoPlayer",
			"editorVideoStage": "S5HVoW_editorVideoStage",
			"editorXlsx": "S5HVoW_editorXlsx",
			"explorer": "S5HVoW_explorer",
			"explorerBody": "S5HVoW_explorerBody",
			"explorerBroken": "S5HVoW_explorerBroken",
			"explorerCopied": "S5HVoW_explorerCopied",
			"explorerDir": "S5HVoW_explorerDir",
			"explorerEmpty": "S5HVoW_explorerEmpty",
			"explorerError": "S5HVoW_explorerError",
			"explorerHeader": "S5HVoW_explorerHeader",
			"explorerHidden": "S5HVoW_explorerHidden",
			"explorerName": "S5HVoW_explorerName",
			"explorerRef": "S5HVoW_explorerRef",
			"explorerRenameInput": "S5HVoW_explorerRenameInput",
			"explorerRoot": "S5HVoW_explorerRoot",
			"explorerRow": "S5HVoW_explorerRow",
			"explorerRowDropTarget": "S5HVoW_explorerRowDropTarget",
			"explorerRowRevealed": "S5HVoW_explorerRowRevealed",
			"explorerSymlink": "S5HVoW_explorerSymlink",
			"floatClose": "S5HVoW_floatClose",
			"floatContent": "S5HVoW_floatContent",
			"floatDropHint": "S5HVoW_floatDropHint",
			"floatDropHintLabel": "S5HVoW_floatDropHintLabel",
			"floatHeader": "S5HVoW_floatHeader",
			"floatResize": "S5HVoW_floatResize",
			"floatTitle": "S5HVoW_floatTitle",
			"floatWindow": "S5HVoW_floatWindow",
			"floatWindowDragging": "S5HVoW_floatWindowDragging",
			"git": "S5HVoW_git",
			"gitAdded": "S5HVoW_gitAdded",
			"gitAhead": "S5HVoW_gitAhead",
			"gitBadge": "S5HVoW_gitBadge",
			"gitBehind": "S5HVoW_gitBehind",
			"gitBranchBadge": "S5HVoW_gitBranchBadge",
			"gitBranchForm": "S5HVoW_gitBranchForm",
			"gitBranchMeta": "S5HVoW_gitBranchMeta",
			"gitBranchName": "S5HVoW_gitBranchName",
			"gitBranchRow": "S5HVoW_gitBranchRow",
			"gitBranchSearch": "S5HVoW_gitBranchSearch",
			"gitBranchSelect": "S5HVoW_gitBranchSelect",
			"gitBranchToolbar": "S5HVoW_gitBranchToolbar",
			"gitBranchView": "S5HVoW_gitBranchView",
			"gitCommit": "S5HVoW_gitCommit",
			"gitCommitButton": "S5HVoW_gitCommitButton",
			"gitCommitInput": "S5HVoW_gitCommitInput",
			"gitConfirmDanger": "S5HVoW_gitConfirmDanger",
			"gitConfirmDesc": "S5HVoW_gitConfirmDesc",
			"gitDiff": "S5HVoW_gitDiff",
			"gitDiffAdd": "S5HVoW_gitDiffAdd",
			"gitDiffCode": "S5HVoW_gitDiffCode",
			"gitDiffCtx": "S5HVoW_gitDiffCtx",
			"gitDiffDel": "S5HVoW_gitDiffDel",
			"gitDiffExpand": "S5HVoW_gitDiffExpand",
			"gitDiffFile": "S5HVoW_gitDiffFile",
			"gitDiffFileChevron": "S5HVoW_gitDiffFileChevron",
			"gitDiffFileChevronExpanded": "S5HVoW_gitDiffFileChevronExpanded",
			"gitDiffFileOld": "S5HVoW_gitDiffFileOld",
			"gitDiffFilePath": "S5HVoW_gitDiffFilePath",
			"gitDiffFileTag": "S5HVoW_gitDiffFileTag",
			"gitDiffHunk": "S5HVoW_gitDiffHunk",
			"gitDiffHunkHeader": "S5HVoW_gitDiffHunkHeader",
			"gitDiffHunkSection": "S5HVoW_gitDiffHunkSection",
			"gitDiffLine": "S5HVoW_gitDiffLine",
			"gitDiffMeta": "S5HVoW_gitDiffMeta",
			"gitDiffMetaText": "S5HVoW_gitDiffMetaText",
			"gitDiffNum": "S5HVoW_gitDiffNum",
			"gitDiffTab": "S5HVoW_gitDiffTab",
			"gitDiffTabHeader": "S5HVoW_gitDiffTabHeader",
			"gitDiffTabTitle": "S5HVoW_gitDiffTabTitle",
			"gitEmpty": "S5HVoW_gitEmpty",
			"gitError": "S5HVoW_gitError",
			"gitFoldRow": "S5HVoW_gitFoldRow",
			"gitFoldRowFailed": "S5HVoW_gitFoldRowFailed",
			"gitGh": "S5HVoW_gitGh",
			"gitGhDraft": "S5HVoW_gitGhDraft",
			"gitGhEnv": "S5HVoW_gitGhEnv",
			"gitGhForm": "S5HVoW_gitGhForm",
			"gitGhFormRow": "S5HVoW_gitGhFormRow",
			"gitGhFormTitle": "S5HVoW_gitGhFormTitle",
			"gitGhHeader": "S5HVoW_gitGhHeader",
			"gitGhHint": "S5HVoW_gitGhHint",
			"gitGhInput": "S5HVoW_gitGhInput",
			"gitGhMergeConfirm": "S5HVoW_gitGhMergeConfirm",
			"gitGhMethod": "S5HVoW_gitGhMethod",
			"gitGhNotice": "S5HVoW_gitGhNotice",
			"gitGhNumber": "S5HVoW_gitGhNumber",
			"gitGhRepo": "S5HVoW_gitGhRepo",
			"gitGhRow": "S5HVoW_gitGhRow",
			"gitGhTextarea": "S5HVoW_gitGhTextarea",
			"gitGhTitle": "S5HVoW_gitGhTitle",
			"gitHeader": "S5HVoW_gitHeader",
			"gitLineStat": "S5HVoW_gitLineStat",
			"gitLink": "S5HVoW_gitLink",
			"gitLogHash": "S5HVoW_gitLogHash",
			"gitLogLine1": "S5HVoW_gitLogLine1",
			"gitLogLine2": "S5HVoW_gitLogLine2",
			"gitLogMeta": "S5HVoW_gitLogMeta",
			"gitLogMore": "S5HVoW_gitLogMore",
			"gitLogRef": "S5HVoW_gitLogRef",
			"gitLogRow": "S5HVoW_gitLogRow",
			"gitLogSubject": "S5HVoW_gitLogSubject",
			"gitName": "S5HVoW_gitName",
			"gitPending": "S5HVoW_gitPending",
			"gitPlaceholder": "S5HVoW_gitPlaceholder",
			"gitPushRow": "S5HVoW_gitPushRow",
			"gitRemoved": "S5HVoW_gitRemoved",
			"gitRow": "S5HVoW_gitRow",
			"gitRowMain": "S5HVoW_gitRowMain",
			"gitRowSelected": "S5HVoW_gitRowSelected",
			"gitSection": "S5HVoW_gitSection",
			"gitSectionHeader": "S5HVoW_gitSectionHeader",
			"gitSynced": "S5HVoW_gitSynced",
			"gitUntracked": "S5HVoW_gitUntracked",
			"gitUpstream": "S5HVoW_gitUpstream",
			"gitWorktreeLabel": "S5HVoW_gitWorktreeLabel",
			"gitWorktreeRow": "S5HVoW_gitWorktreeRow",
			"iconButton": "S5HVoW_iconButton",
			"mermaidBody": "S5HVoW_mermaidBody",
			"mermaidCode": "S5HVoW_mermaidCode",
			"mermaidCopy": "S5HVoW_mermaidCopy",
			"mermaidError": "S5HVoW_mermaidError",
			"mermaidHeader": "S5HVoW_mermaidHeader",
			"mermaidInfo": "S5HVoW_mermaidInfo",
			"mermaidMarkdown": "S5HVoW_mermaidMarkdown",
			"mermaidModal": "S5HVoW_mermaidModal",
			"mermaidModalButton": "S5HVoW_mermaidModalButton",
			"mermaidModalHint": "S5HVoW_mermaidModalHint",
			"mermaidModalStage": "S5HVoW_mermaidModalStage",
			"mermaidModalToolbar": "S5HVoW_mermaidModalToolbar",
			"mermaidWrap": "S5HVoW_mermaidWrap",
			"openWithChevron": "S5HVoW_openWithChevron",
			"openWithLabel": "S5HVoW_openWithLabel",
			"openWithName": "S5HVoW_openWithName",
			"openWithPin": "S5HVoW_openWithPin",
			"openWithPinActive": "S5HVoW_openWithPinActive",
			"orphanedType": "S5HVoW_orphanedType",
			"pane": "S5HVoW_pane",
			"paneCard": "S5HVoW_paneCard",
			"paneContent": "S5HVoW_paneContent",
			"paneDrop": "S5HVoW_paneDrop",
			"paneEmptyCards": "S5HVoW_paneEmptyCards",
			"paneTab": "S5HVoW_paneTab",
			"paneTabHidden": "S5HVoW_paneTabHidden",
			"panel": "S5HVoW_panel",
			"panelBody": "S5HVoW_panelBody",
			"panelHidden": "S5HVoW_panelHidden",
			"panelResize": "S5HVoW_panelResize",
			"panelResizeActive": "S5HVoW_panelResizeActive",
			"pinnedTab": "S5HVoW_pinnedTab",
			"plansEmpty": "S5HVoW_plansEmpty",
			"plansGlyph": "S5HVoW_plansGlyph",
			"plansHint": "S5HVoW_plansHint",
			"plansMeta": "S5HVoW_plansMeta",
			"plansRow": "S5HVoW_plansRow",
			"plansRowMain": "S5HVoW_plansRowMain",
			"plansSearch": "S5HVoW_plansSearch",
			"plansText": "S5HVoW_plansText",
			"plansTitle": "S5HVoW_plansTitle",
			"plansToolbar": "S5HVoW_plansToolbar",
			"plansView": "S5HVoW_plansView",
			"producedChip": "S5HVoW_producedChip",
			"producedLabel": "S5HVoW_producedLabel",
			"producedMore": "S5HVoW_producedMore",
			"producedRow": "S5HVoW_producedRow",
			"sandboxAction": "S5HVoW_sandboxAction",
			"sandboxDot": "S5HVoW_sandboxDot",
			"sandboxStatus": "S5HVoW_sandboxStatus",
			"sandboxStatusOff": "S5HVoW_sandboxStatusOff",
			"sandboxStatusOn": "S5HVoW_sandboxStatusOn",
			"sandboxStatusText": "S5HVoW_sandboxStatusText",
			"schedPreview": "S5HVoW_schedPreview",
			"schedPreviewClose": "S5HVoW_schedPreviewClose",
			"schedPreviewHead": "S5HVoW_schedPreviewHead",
			"schedPreviewLabel": "S5HVoW_schedPreviewLabel",
			"schedPreviewPrompt": "S5HVoW_schedPreviewPrompt",
			"schedPreviewRow": "S5HVoW_schedPreviewRow",
			"schedPreviewTitle": "S5HVoW_schedPreviewTitle",
			"schedPreviewValue": "S5HVoW_schedPreviewValue",
			"selectionPopup": "S5HVoW_selectionPopup",
			"sessionLens": "S5HVoW_sessionLens",
			"sessionLensBar": "S5HVoW_sessionLensBar",
			"sessionLensCount": "S5HVoW_sessionLensCount",
			"sessionLensEmpty": "S5HVoW_sessionLensEmpty",
			"sessionLensItem": "S5HVoW_sessionLensItem",
			"sessionLensMeta": "S5HVoW_sessionLensMeta",
			"sessionLensPath": "S5HVoW_sessionLensPath",
			"sessionLensPreview": "S5HVoW_sessionLensPreview",
			"sessionLensRow": "S5HVoW_sessionLensRow",
			"spacer": "S5HVoW_spacer",
			"split": "S5HVoW_split",
			"splitChild": "S5HVoW_splitChild",
			"splitCol": "S5HVoW_splitCol",
			"splitRow": "S5HVoW_splitRow",
			"tab": "S5HVoW_tab",
			"tabActive": "S5HVoW_tabActive",
			"tabBadge": "S5HVoW_tabBadge",
			"tabBar": "S5HVoW_tabBar",
			"tabBarDrop": "S5HVoW_tabBarDrop",
			"tabBarPlus": "S5HVoW_tabBarPlus",
			"tabBoundaryError": "S5HVoW_tabBoundaryError",
			"tabClose": "S5HVoW_tabClose",
			"tabList": "S5HVoW_tabList",
			"tabTitle": "S5HVoW_tabTitle",
			"terminal": "S5HVoW_terminal",
			"terminalBanner": "S5HVoW_terminalBanner",
			"terminalBannerUrl": "S5HVoW_terminalBannerUrl",
			"terminalDepsActions": "S5HVoW_terminalDepsActions",
			"terminalDepsBanner": "S5HVoW_terminalDepsBanner",
			"terminalDepsCommandRow": "S5HVoW_terminalDepsCommandRow",
			"terminalDepsHint": "S5HVoW_terminalDepsHint",
			"terminalDepsNote": "S5HVoW_terminalDepsNote",
			"terminalDepsTitle": "S5HVoW_terminalDepsTitle",
			"terminalRepairCommand": "S5HVoW_terminalRepairCommand",
			"terminalRetry": "S5HVoW_terminalRetry",
			"terminalWaitBanner": "S5HVoW_terminalWaitBanner",
			"terminalWaitNeedle": "S5HVoW_terminalWaitNeedle",
			"terminalWrap": "S5HVoW_terminalWrap",
			"tocBar": "S5HVoW_tocBar",
			"tocButton": "S5HVoW_tocButton",
			"tocFlash": "S5HVoW_tocFlash",
			"tocItem": "S5HVoW_tocItem",
			"tocItemLevel": "S5HVoW_tocItemLevel",
			"tocItemText": "S5HVoW_tocItemText",
			"tocPanel": "S5HVoW_tocPanel",
			"toggleButton": "S5HVoW_toggleButton",
			"toggleCluster": "S5HVoW_toggleCluster",
			"uploadDropChatCard": "S5HVoW_uploadDropChatCard",
			"uploadDropChatHint": "S5HVoW_uploadDropChatHint",
			"uploadDropHero": "S5HVoW_uploadDropHero",
			"uploadDropZone": "S5HVoW_uploadDropZone",
			"uploadDropZonePill": "S5HVoW_uploadDropZonePill",
			"uploadDropZoneText": "S5HVoW_uploadDropZoneText",
			"uploadOverlay": "S5HVoW_uploadOverlay",
			"uploadOverlayCancel": "S5HVoW_uploadOverlayCancel",
			"uploadOverlayCard": "S5HVoW_uploadOverlayCard",
			"uploadOverlayProgress": "S5HVoW_uploadOverlayProgress",
			"uploadOverlayProgressFill": "S5HVoW_uploadOverlayProgressFill",
			"uploadOverlayStatus": "S5HVoW_uploadOverlayStatus",
			"uploadOverlayTitle": "S5HVoW_uploadOverlayTitle",
			"workbench": "S5HVoW_workbench"
		};
		//#endregion
		//#region src/client/intercept.tsx
		/**
		* Open one http(s) URL in this plugin's own browser tab — the landing spot for
		* every native `openTab('browser', …)` the claim below takes over, and for the
		* document-level link interception.
		*
		* The browser tab's own enable switch is honoured: a user who turned the tab
		* off does not get it reopened behind their back — the URL goes to the system
		* browser instead (the old pre-sidebar behaviour, and the only remaining
		* option once the native panel is suppressed by product policy).
		*/
		function openSidebarBrowser(ctx, store, url) {
			if (store.getPrefs().tabsEnabled["browser"] === false) {
				window.open(url, "_blank", "noopener,noreferrer");
				return;
			}
			let title;
			try {
				title = new URL(url).hostname;
			} catch {}
			ctx.get("betterSidebar")?.openTab({
				type: "browser",
				url,
				...title !== void 0 ? { title } : {}
			});
		}
		/** Open a file in the sidebar's editor (used by the intercepted row and the explorer). */
		function openSidebarFile(ctx, store, sessionId, path) {
			const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
			const absolute = resolveSidebarPath(cwd, path);
			const at = Math.max(absolute.lastIndexOf("/"), absolute.lastIndexOf("\\"));
			const title = at === -1 ? absolute : absolute.slice(at + 1);
			const meta = cwd === void 0 ? void 0 : {
				readSessionId: sessionId,
				readCwd: cwd
			};
			ctx.get("betterSidebar")?.openTab({
				type: "editor",
				title,
				path: absolute,
				id: `editor:${absolute}`,
				...meta !== void 0 ? { meta } : {}
			});
			return absolute;
		}
		/**
		* The produced files the turn-tail selector last matched for the visible
		* session. The "Show in folder" gesture carries no file path of its own
		* (`'.'`), so the reveal highlights exactly these rows when available.
		*/
		let lastProduced = [];
		/**
		* Reveal the produced files in the sidebar explorer: expand their parent
		* directories, highlight the rows, and focus the explorer tab (expanding the
		* hosting panel when it is collapsed). Unknown files fall back to revealing
		* the workspace root itself.
		*/
		function revealInExplorer(ctx, store, sessionId, files) {
			const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
			const targets = files.length > 0 ? files.map((path) => resolveSidebarPath(cwd, path)) : cwd === void 0 ? [] : [cwd];
			store.reduce((state) => revealPaths(state, cwd, targets));
			store.reduce((s) => s.panelOpen ? s : togglePanel(s));
			store.reduce((s) => ({
				...s,
				activePane: firstLeaf(s.splits).id
			}));
			ctx.get("betterSidebar")?.openTab({
				type: "editor",
				title: t("files")
			});
		}
		/** The intercepted produced-files row (visual twin of the deliverables chips). */
		function SidebarProducedFiles(props) {
			const { matched, openInSidebar, onShowInFolder } = props;
			const shown = matched.slice(0, 6);
			const hidden = matched.length - shown.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.producedRow,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: sidebar_module_css_default.producedLabel,
						children: t("produced")
					}),
					shown.map((path) => {
						const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
						const name = at === -1 ? path : path.slice(at + 1);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: sidebar_module_css_default.producedChip,
							title: path,
							onClick: () => {
								openInSidebar(path);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 12 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: name })]
						}, path);
					}),
					hidden > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: sidebar_module_css_default.producedMore,
						children: ["+", hidden]
					}),
					hidden > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: sidebar_module_css_default.producedMore,
						style: {
							cursor: "pointer",
							textDecoration: "underline",
							textUnderlineOffset: 2
						},
						onClick: () => {
							onShowInFolder(matched);
						},
						children: t("showInFolder")
					})
				]
			});
		}
		/**
		* Register the turn-tail interception (returns the disposer).
		*
		* The slot is a CHILD slot the host's ui-conversation declares in its
		* `conversation.chat.node` children table (kind: chain, scope: session).
		* Registering it directly races the declaration — the ui-slots core's
		* load-time validation throws "not declared (a parent entry's children
		* table must declare it)" when the parent entry is not on the ledger yet.
		* slots.inject waits for the declaration: the callback runs synchronously
		* when the slot is already declared, otherwise it runs inside the declaring
		* register() call once the declaration commits; declaration collapse
		* disposes the entry and a later declaration re-registers it. This mirrors
		* @deepseek-ai/dsh-client-ui-deliverables' registration of the same slot.
		*/
		function registerTurnTailInterception(ctx, store) {
			/**
			* The turn-tail list entry's render: decline (null) on every coexistence
			* rule, otherwise the produced-files chip row. Defined inside the
			* registration so the store/ctx closure is reachable; the structural
			* props face keeps the build independent of the type releases' chain-era
			* shapes (same recipe as {@link hasDeclaredDeliveries}).
			*/
			function SidebarTurnTail(props) {
				if (store.getSuspended()) return null;
				if (store.getPrefs().tabsEnabled["editor"] === false) return null;
				if (hasDeclaredDeliveries(props)) return null;
				if (hasChangesAnnouncement(props)) return null;
				if (hasFileReviewData(props)) return null;
				const matched = selectProducedFiles(props);
				if (matched === null) return null;
				lastProduced = matched;
				const { openInSidebar, onShowInFolder } = props;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SidebarProducedFiles, {
					matched,
					openInSidebar,
					onShowInFolder
				});
			}
			return ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: "dsh-coding-sidebar",
				registrant: "dsh-coding-sidebar",
				inject: (sessionId) => ({
					openInSidebar: (path) => {
						openSidebarFile(ctx, store, sessionId, path);
					},
					onShowInFolder: (files) => {
						revealInExplorer(ctx, store, sessionId, files);
					}
				})
			}, SidebarTurnTail));
		}
		/**
		* Whether the turn carries dsh-file-review-kcoder's own turn data — its
		* enhanced card (hunks/stats/undo, produced + presented sections) renders
		* its own row for such turns regardless of git availability. Structural
		* face, same recipe as {@link hasChangesAnnouncement}; absent data simply
		* means the plugin is not composed in and this row keeps its gap role.
		* @param owner - the turn-tail owner currency ({turn, seq}).
		* @returns true when the file-review card will claim this turn.
		*/
		function hasFileReviewData(owner) {
			const record = owner;
			if (record === null || typeof record !== "object") return false;
			const data = record.turn?.data?.get?.("fileReviewChanges");
			if (data === null || typeof data !== "object") return false;
			return Array.isArray(data.files) && data.files.length > 0;
		}
		/**
		* Whether the turn carries a `workspace/changes` announcement — the built-in
		* changed-files card renders its own row for such turns. Read through the
		* same structural turn-data face as {@link hasDeclaredDeliveries}; an older
		* carrier without the `deliverables` key publishes no announcement.
		* @param owner - the turn-tail owner currency ({turn, seq}).
		* @returns true when the built-in card will claim this turn.
		*/
		function hasChangesAnnouncement(owner) {
			const record = owner;
			if (record === null || typeof record !== "object") return false;
			const data = record.turn?.data?.get?.("deliverables");
			if (data === null || typeof data !== "object") return false;
			const changes = data.changes;
			return changes !== null && typeof changes === "object" && typeof changes.seq === "number";
		}
		/**
		* Register the chat file-open interception: wraps THREE file-open doors so
		* opens land in the sidebar editor instead of the Host OS (or DSH's own right
		* Sidebar) — the folder-reveal gesture ("Show in folder" passes `'.'`, and so
		* does the workspace-root address) is the one exception, routed to the
		* explorer. The doors, oldest first: `ctx.workspaces.openPath` (pre-0.1.2),
		* `ctx.remote.session.openWorkspacePath` (0.1.2-alpha.1), and
		* `ctx.sidebarRight.openResource` (0.1.5 — the one ui-chat actually calls
		* today; without it this plugin's chat-side takeover is inert). Each is wrapped
		* only when present, so one build intercepts baselines on either side of both
		* migrations. Gated by BOTH the `interceptOpenPath` pref and the editor tab's
		* enable switch; declined opens fall through to the original method. Returns
		* the disposer restoring all three doors (HMR-safe).
		*/
		function registerOpenPathInterception(ctx, store) {
			const deps = {
				takeoverEnabled: () => !store.getSuspended() && store.getPrefs().interceptOpenPath !== false && store.getPrefs().tabsEnabled["editor"] !== false,
				currentSessionId: () => ctx.sessions.list.getSnapshot().current,
				openInSidebar: (path, sessionId) => {
					openSidebarFile(ctx, store, sessionId, path);
				},
				revealInExplorer: (_path, sessionId) => {
					revealInExplorer(ctx, store, sessionId, lastProduced);
				}
			};
			const workspaces = ctx.get("workspaces");
			const disposeOld = workspaces === void 0 ? () => {} : wrapOpenPath(workspaces, deps);
			if (workspaces === void 0 && ctx.get("sidebarRight") === void 0) console.log("[dsh-coding-sidebar] open-path interception: sidebarRight 未就绪，等待 inject 装配");
			const remote = ctx.get("remote");
			const disposeRemote = remote === void 0 ? () => {} : wrapRemoteOpenPath(remote.session, deps);
			let disposed = false;
			let disposeRight = () => {};
			let disposeBrowser = () => {};
			const injectFiber = ctx.inject(["sidebarRight"], () => {
				if (disposed) return;
				const sidebarRight = ctx.get("sidebarRight");
				if (sidebarRight === void 0) return;
				disposeRight = wrapSidebarRight(sidebarRight, deps);
				disposeBrowser = wrapNativeBrowserOpen(sidebarRight, (url) => {
					openSidebarBrowser(ctx, store, url);
				});
				console.log("[dsh-coding-sidebar] open-path interception: doors workspaces=" + (workspaces !== void 0) + " remote.session=" + (remote !== void 0) + " sidebarRight=true browserOpenTab=" + (typeof sidebarRight.openTab === "function"));
			});
			return () => {
				disposed = true;
				disposeOld();
				disposeRemote();
				disposeRight();
				disposeBrowser();
				injectFiber.dispose();
			};
		}
		//#endregion
		//#region node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region src/client/api.ts
		/** One wire failure. */
		var SidebarApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
			}
		};
		async function call(method, payload, signal) {
			let response;
			try {
				response = await fetch(`/sidebar/api/${method}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
					signal
				});
			} catch (error) {
				throw new SidebarApiError("network", error instanceof Error ? error.message : String(error));
			}
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new SidebarApiError(parsed?.error?.code ?? "http", parsed?.error?.message ?? `HTTP ${response.status}`);
			return parsed.value;
		}
		/**
		* Upload one file to the sidebar's raw upload route: the File goes straight
		* into the POST body (no JSON/base64 re-encoding — the host streams it into
		* the workspace). Failure surfaces as {@link SidebarApiError} with the wire
		* code, exactly like every `/sidebar/api` call. An aborted `signal` rejects
		* with the DOMException as-is (the caller decides whether that is an error).
		*/
		async function fetchUpload(scope, dir, relativePath, body, signal) {
			const params = new URLSearchParams({
				sessionId: scope.sessionId,
				dir,
				relativePath
			});
			if (scope.cwd !== void 0 && scope.cwd !== "") params.set("cwd", scope.cwd);
			let response;
			try {
				response = await fetch(`/sidebar/upload?${params.toString()}`, {
					method: "POST",
					headers: { "content-type": "application/octet-stream" },
					body,
					signal
				});
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") throw error;
				throw new SidebarApiError("network", error instanceof Error ? error.message : String(error));
			}
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new SidebarApiError(parsed?.error?.code ?? "http", parsed?.error?.message ?? `HTTP ${response.status}`);
			return parsed.value;
		}
		/** Fold a scope into a JSON payload ({cwd} only when present). */
		function scopePayload(scope, extra) {
			return {
				sessionId: scope.sessionId,
				...scope.cwd !== void 0 && scope.cwd !== "" ? { cwd: scope.cwd } : {},
				...scope.repoRoot !== void 0 && scope.repoRoot !== "" ? { repoRoot: scope.repoRoot } : {},
				...extra
			};
		}
		/** Add a linked-worktree selection to a scoped Git request. The host validates
		* membership before using it as a command cwd. */
		function gitPayload(scope, worktree, extra) {
			return scopePayload(scope, {
				...worktree !== void 0 && worktree !== "" ? { worktree } : {},
				...extra
			});
		}
		/** The sidebar API surface (session scope threaded through every call). */
		const api = {
			sessionCwd: (scope, signal) => call("session.cwd", scopePayload(scope, {}), signal),
			/**
			* Agent Teams: the roster + task board the upstream `ctx.agentTeams` service
			* reports for this Session's team. `available: false` is an ordinary answer
			* (the official 「智能体团队」 bundle is opt-in) — the tab renders it as an
			* enable-me empty state.
			*/
			teamView: (scope, signal) => call("team.view", scopePayload(scope, {}), signal),
			/** Create one shared task (subject + description are required by the service). */
			teamCreateTask: (scope, input, signal) => call("team.createTask", scopePayload(scope, { ...input }), signal),
			/** Apply one compare-and-set task mutation (`expectedRevision` guards the row). */
			teamUpdateTask: (scope, input, signal) => call("team.updateTask", scopePayload(scope, { ...input }), signal),
			fsTree: (scope, path, signal) => call("fs.tree", scopePayload(scope, { path }), signal),
			/** Global recursive file-name search rooted at the session cwd (the editor
			*  side panel's search box); matches are cwd-relative '/'-separated paths. */
			fsSearch: (scope, query, signal) => call("fs.search", scopePayload(scope, { query }), signal),
			fsRead: (scope, path, signal) => call("fs.read", scopePayload(scope, { path }), signal),
			fsWrite: (scope, path, content) => call("fs.write", scopePayload(scope, {
				path,
				content
			})),
			/** Rename one tree row within its directory (single-segment name; a
			*  destination-existence clash is a 409; symlink rows rename the link). */
			fsRename: (scope, path, name) => call("fs.rename", scopePayload(scope, {
				path,
				name
			})),
			/** Delete one tree row permanently (recursive for directories; a symlink
			*  row unlinks the link only). */
			fsRemove: (scope, path) => call("fs.remove", scopePayload(scope, { path })),
			/** Upload one file's raw bytes into `dir` (keeps the folder tree via
			*  `relativePath`); the host streams it under the session workspace. */
			uploadFile: (scope, dir, relativePath, body, signal) => fetchUpload(scope, dir, relativePath, body, signal),
			gitWorktrees: (scope, signal) => call("git.worktrees", scopePayload(scope, {}), signal),
			gitStatus: (scope, worktree, signal) => call("git.status", gitPayload(scope, worktree, {}), signal),
			gitDiff: (scope, path, staged, worktree, signal) => call("git.diff", gitPayload(scope, worktree, {
				...path !== void 0 ? { path } : {},
				staged
			}), signal),
			gitStage: (scope, path, worktree) => call("git.stage", gitPayload(scope, worktree, { ...path !== void 0 ? { path } : {} })),
			gitUnstage: (scope, path, worktree) => call("git.unstage", gitPayload(scope, worktree, { ...path !== void 0 ? { path } : {} })),
			gitCommit: (scope, message, worktree) => call("git.commit", gitPayload(scope, worktree, { message })),
			gitBranch: (scope, worktree, signal) => call("git.branch", gitPayload(scope, worktree, {}), signal),
			gitCheckout: (scope, branch, worktree) => call("git.checkout", gitPayload(scope, worktree, { branch })),
			/** Recent commit history, lazily pageable (skip/count; defaults 0/30). */
			gitLog: (scope, count, skip, worktree, signal) => call("git.log", gitPayload(scope, worktree, {
				...count !== void 0 ? { count } : {},
				...skip !== void 0 ? { skip } : {}
			}), signal),
			/** Full patch text of one commit (diff display for the history rows). */
			gitCommitDiff: (scope, hash, worktree, signal) => call("git.commit-diff", gitPayload(scope, worktree, { hash }), signal),
			/** Both sides' full file contents for a diff-fold expansion; a missing
			*  side is null (untracked / deleted) and the view degrades the fold. */
			gitFoldContents: (scope, opts, worktree, signal) => call("git.fold-contents", gitPayload(scope, worktree, {
				path: opts.path,
				...opts.staged !== void 0 ? { staged: opts.staged } : {},
				...opts.hash !== void 0 ? { hash: opts.hash } : {}
			}), signal),
			/** Discard the worktree changes of one file (the index is untouched). */
			gitDiscard: (scope, path, worktree) => call("git.discard", gitPayload(scope, worktree, { path })),
			/** Revert one commit onto the current branch. */
			gitRevert: (scope, hash, worktree) => call("git.revert", gitPayload(scope, worktree, { hash })),
			/** Cherry-pick one commit onto the current branch. */
			gitCherryPick: (scope, hash, worktree) => call("git.cherry-pick", gitPayload(scope, worktree, { hash })),
			/** Upstream distance + remote/default branch + per-file line counts. */
			gitSummary: (scope, worktree, signal) => call("git.summary", gitPayload(scope, worktree, {}), signal),
			/** Push the current branch (the host sets an upstream when there is none). */
			gitPush: (scope, worktree, setUpstream) => call("git.push", gitPayload(scope, worktree, { ...setUpstream !== void 0 ? { setUpstream } : {} })),
			/** Local + remote branches with upstream/current markers. */
			gitBranchRows: (scope, worktree, signal) => call("git.branch-rows", gitPayload(scope, worktree, {}), signal),
			/** Create a branch and check it out. */
			gitBranchCreate: (scope, name, worktree) => call("git.branch-create", gitPayload(scope, worktree, { name })),
			/** Delete a local branch; an unmerged branch fails with code `not-merged`
			*  unless `force` is set (the panel asks before escalating). */
			gitBranchDelete: (scope, name, force, worktree) => call("git.branch-delete", gitPayload(scope, worktree, {
				name,
				force
			})),
			/** gh CLI environment probe (installed / logged in / account). */
			ghProbe: (scope) => call("gh.probe", scopePayload(scope, {})),
			/** Open PRs + issues plus the repository identity. */
			ghList: (scope, worktree, signal) => call("gh.list", gitPayload(scope, worktree, {}), signal),
			/** Create a PR from the current branch (the host pushes it first when needed). */
			ghCreatePr: (scope, opts, worktree) => call("gh.create-pr", gitPayload(scope, worktree, {
				title: opts.title,
				body: opts.body,
				...opts.base !== void 0 && opts.base !== "" ? { base: opts.base } : {},
				...opts.draft === true ? { draft: true } : {}
			})),
			/** Merge one PR (method: merge | squash | rebase; the host defaults to squash). */
			ghMergePr: (scope, number, method, worktree) => call("gh.merge-pr", gitPayload(scope, worktree, {
				number,
				...method !== void 0 ? { method } : {}
			})),
			/** Create an issue in the repository the cwd belongs to. */
			ghCreateIssue: (scope, opts, worktree) => call("gh.create-issue", gitPayload(scope, worktree, {
				title: opts.title,
				body: opts.body
			})),
			/** Plan documents the workspace's convention declares (newest first). */
			plansList: (scope, signal) => call("plans.list", scopePayload(scope, {}), signal),
			/** Hand one plan document to the OS default application (workspace-contained). */
			plansOpen: (scope, path) => call("plans.open", scopePayload(scope, { path })),
			/** Release a terminal's process immediately (tab closed; the WS close frame
			*  may be unreachable while the socket is down, so the host also accepts
			*  this explicit route). */
			ptyClose: (scope, tab) => call("pty.close", scopePayload(scope, { tab })),
			/** Release an agent terminal by uuid (tab closed while WS was down). */
			agentPtyClose: (uuid) => call("agent-pty.close", { uuid }),
			/** Skip every active terminal_wait_for on one agent terminal (the wait
			*  banner's skip button). Idempotent: {skipped:0} when none is active. */
			agentSkipWait: (uuid) => call("agent-pty.skip-wait", { uuid }),
			/** The session lens: file operations the model performed in one session
			*  (parsed from the session's own event log; newest first). */
			changesOps: (scope, signal) => call("changes.ops", scopePayload(scope, {}), signal),
			/** Terminal dependency status (issue #140): after a WS close 1011 with
			*  reason `pty-deps-missing` the view fetches the full repair details here
			*  (the close reason itself is capped at 123 bytes). */
			terminalDeps: () => call("terminal.deps", {}),
			/**
			* The output the model has read so far for one background job (replayed
			* from the owner session's event log — never the model's job_output
			* cursor). The scope MUST be the job's OWNER session.
			*/
			jobOutput: (scope, id, signal) => call("jobs.output", scopePayload(scope, { id }), signal),
			/** Request cancellation of one background job (live jobs flip to stopping). */
			jobKill: (scope, id, reason) => call("jobs.kill", scopePayload(scope, {
				id,
				...reason !== void 0 ? { reason } : {}
			})),
			/**
			* One batch live-preview fetch for the whole Subagent tree. The payload is
			* the already-resolved topology ROOT (not a session scope); the host
			* enumerates descendants once and folds running children's activity.
			*/
			subagentsLive: (rootSessionId, signal) => call("subagents.live", { rootSessionId }, signal),
			/** Create a Side Chat thread: a child session seeded with the parent's
			*  full log up to now. Empty question = immediate create (Codex-style):
			*  the thread opens empty, the first prompt carries the boundary. */
			sidechatStart: (sessionId, question) => call("sidechat.start", {
				sessionId,
				question: question ?? ""
			}),
			/** Deliver one follow-up message to a Side Chat thread. */
			sidechatPrompt: (childId, text) => call("sidechat.prompt", {
				childId,
				text
			}),
			/** Abort a Side Chat thread's running turn (queued work is preserved). */
			sidechatCancel: (childId) => call("sidechat.cancel", { childId }),
			/** Release a Side Chat thread's live agent (history stays persisted). */
			sidechatDispose: (childId) => call("sidechat.dispose", { childId }),
			/** Live state + agent identity (provider/model/preset) of a thread. */
			sidechatInfo: (childId) => call("sidechat.info", { childId }),
			/** The effective terminal shell and its display name (plugin-global). */
			shellGet: () => call("shell.get", {}),
			/** Read the side card preferences (plugin-global, no session scope). */
			settingsGet: () => call("settings.get", {}),
			/** Merge a patch into the side card preferences (revision-guarded). */
			settingsUpdate: (patch, expectedRevision) => call("settings.update", {
				patch,
				...expectedRevision !== void 0 ? { expectedRevision } : {}
			}),
			/** Probe a URL's response headers (the sidebar browser's embeddability
			*  check; see the host's browser.probe route). */
			browserProbe: (url, signal) => call("browser.probe", { url }, signal),
			/** Agent 浏览器宿主的 page target 列表（host 代理 CDP /json/list）。 */
			cdpTargets: (signal) => call("cdp.targets", {}, signal),
			/** External open for the file tree's "open with" menu: reveal a path in
			*  the OS file manager, or hand a custom-scheme URL (vscode://, cursor://,
			*  zed://, custom editors) to its registered handler. The host launches
			*  the platform opener (argv, no shell). */
			openExternal: (payload) => call("open.external", payload)
		};
		/** Absolute URL of the media route for one path (images only). */
		function mediaUrl(scope, path) {
			return fileUrl(scope, path, false);
		}
		/** Absolute URL of the download route: serves raw bytes (binary-safe) with
		*  `Content-Disposition: attachment`, so the browser saves the file. */
		function downloadUrl(scope, path) {
			return fileUrl(scope, path, true);
		}
		/** Shared URL builder for the /sidebar/file route (media vs download). */
		function fileUrl(scope, path, download) {
			const params = new URLSearchParams({
				sessionId: scope.sessionId,
				path
			});
			if (scope.cwd !== void 0 && scope.cwd !== "") params.set("cwd", scope.cwd);
			if (download) params.set("download", "1");
			return `/sidebar/file?${params.toString()}`;
		}
		//#endregion
		//#region src/client/binary-download.tsx
		function BinaryDownload(props) {
			const { scope, path } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.editorBinary,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: sidebar_module_css_default.editorBinaryNotice,
					children: t("binaryNoPreview")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
					className: sidebar_module_css_default.editorDownloadLink,
					href: downloadUrl(scope, path),
					download: true,
					children: t("downloadToView")
				})]
			});
		}
		//#endregion
		//#region src/client/editor-load.ts
		/** Decode the host's base64 head bytes into the sniffing buffer. */
		function decodeHead(headBase64) {
			const binary = atob(headBase64);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
			return bytes;
		}
		/**
		* Dispatch one matched viewer's fetchStrategy. A missing viewer or a
		* `binary-download` strategy both mean "no client-side renderer" → the
		* download UI. `mediaUrlOf` builds the media URL for `mediaUrl`/`none`
		* strategies (pure, but scope-bound — injected by the host).
		*/
		function planFirstMatch(viewer, mediaUrlOf) {
			if (viewer === void 0 || viewer.fetchStrategy === "binary-download") return { kind: "binary" };
			switch (viewer.fetchStrategy) {
				case "mediaUrl":
				case "none": return {
					kind: "render",
					viewer,
					mediaUrl: mediaUrlOf()
				};
				case "custom": return {
					kind: "customLoad",
					viewer
				};
				case "fsRead": return {
					kind: "fetchFsRead",
					viewer
				};
			}
		}
		/**
		* Decide what an fsRead result means for the editor.
		* - Text: the first match stands (content is valid for any fsRead viewer).
		* - Binary: the host head bytes enable a re-match — a `detect` viewer (e.g.
		*   a plugin sniffing a binary format) may claim the file. `custom` viewers
		*   load their own bytes; `mediaUrl`/`none` viewers render the media route;
		*   an fsRead viewer or nothing cannot render binary → download UI.
		*/
		function planFsReadOutcome(viewer, result, rematch, mediaUrlOf) {
			if (!result.binary) return {
				kind: "render",
				viewer,
				content: result.content,
				truncated: result.truncated
			};
			const claimed = result.head === void 0 ? void 0 : rematch(decodeHead(result.head));
			if (claimed !== void 0 && claimed.fetchStrategy === "custom") return {
				kind: "customLoad",
				viewer: claimed
			};
			if (claimed !== void 0 && (claimed.fetchStrategy === "mediaUrl" || claimed.fetchStrategy === "none")) return {
				kind: "render",
				viewer: claimed,
				mediaUrl: mediaUrlOf()
			};
			return { kind: "binary" };
		}
		//#endregion
		//#region src/client/editor-read-scope.ts
		/**
		* Resolve the read scope for one editor tab.
		*
		* A well-formed recorded pair wins (the file's own workspace); anything else
		* — an absent meta, an older tab, a malformed value — falls back to the scope
		* the tab was rendered with, i.e. the previous behaviour.
		*
		* @param rendered - the scope the tab lives in (its session's state).
		* @param meta - the tab's persisted meta blob (untrusted shape).
		* @returns the scope to read the file with.
		*/
		function readScopeOf(rendered, meta) {
			if (meta === null || typeof meta !== "object" || Array.isArray(meta)) return rendered;
			const { readSessionId, readCwd } = meta;
			if (typeof readSessionId !== "string" || readSessionId === "") return rendered;
			if (typeof readCwd !== "string" || readCwd === "") return rendered;
			return {
				sessionId: readSessionId,
				cwd: readCwd
			};
		}
		//#endregion
		//#region node_modules/.pnpm/react-icons@5.7.0_react@18.3.1/node_modules/react-icons/si/index.mjs
		function SiZedindustries(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"role": "img",
					"viewBox": "0 0 24 24"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M2.25 1.5a.75.75 0 0 0-.75.75v16.5H0V2.25A2.25 2.25 0 0 1 2.25 0h20.095c1.002 0 1.504 1.212.795 1.92L10.764 14.298h3.486V12.75h1.5v1.922a1.125 1.125 0 0 1-1.125 1.125H9.264l-2.578 2.578h11.689V9h1.5v9.375a1.5 1.5 0 0 1-1.5 1.5H5.185L2.562 22.5H21.75a.75.75 0 0 0 .75-.75V5.25H24v16.5A2.25 2.25 0 0 1 21.75 24H1.655C.653 24 .151 22.788.86 22.08L13.19 9.75H9.75v1.5h-1.5V9.375A1.125 1.125 0 0 1 9.375 8.25h5.314l2.625-2.625H5.625V15h-1.5V5.625a1.5 1.5 0 0 1 1.5-1.5h13.19L21.438 1.5z" },
					"child": []
				}]
			})(props);
		}
		function SiCursor(props) {
			return GenIcon({
				"tag": "svg",
				"attr": {
					"role": "img",
					"viewBox": "0 0 24 24"
				},
				"child": [{
					"tag": "path",
					"attr": { "d": "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" },
					"child": []
				}]
			})(props);
		}
		//#endregion
		//#region src/client/icons.tsx
		/**
		* Right-panel toggle glyph (the "侧拉" button): a frame with a filled strip
		* along its RIGHT edge, in the app's outline style (1.5px stroke,
		* currentColor).
		*/
		const IconPanelRightOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: "1.5",
				y: "2",
				width: "13",
				height: "12",
				rx: "2.5",
				stroke: "currentColor",
				strokeWidth: "1.5"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: "10.5",
				y: "3.25",
				width: "2.75",
				height: "9.5",
				rx: "1",
				fill: "currentColor",
				stroke: "none"
			})]
		});
		/**
		* Stop glyph for the background-job kill button: a filled square in the
		* app's outline scale (16), the universal "halt this work" mark.
		*/
		const IconStopOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: "4",
				y: "4",
				width: "8",
				height: "8",
				rx: "1.5",
				fill: "currentColor",
				stroke: "none"
			})
		});
		/** Upload glyph in the app's outline style: an arrow rising into a tray
		*  (the file-manager "upload into the workspace" action). */
		const IconUploadOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M8 10V2.75M4.75 5.5 8 2.25 11.25 5.5",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M2.75 10.5v2.25A1.25 1.25 0 0 0 4 14h8a1.25 1.25 0 0 0 1.25-1.25V10.5",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round"
			})]
		});
		/**
		* Pin glyph in the app's outline style (1.5px stroke, currentColor): a pushpin
		* tilted to the lower-right. Used by the PinnedRail and the tab context menu's
		* pin entry (v0.17.0+).
		*/
		const IconPinOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M9.5 1.5 14.5 6.5 12.5 8.5 10 6 5.5 10.5 6 12 4.5 13.5 2.5 11.5 4 10 5.5 10.5 10 6 7.5 8.5 6.5Z",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinejoin: "round"
			})
		});
		/** Image viewer glyph: a picture frame with a sun and a mountain. */
		const IconImageOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "1.5",
					y: "2.5",
					width: "13",
					height: "11",
					rx: "2",
					stroke: "currentColor",
					strokeWidth: "1.5"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "5.5",
					cy: "6",
					r: "1.2",
					stroke: "currentColor",
					strokeWidth: "1.5"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "m3.5 12 3-3 2.25 2.25L11.5 8.5 13 10.5",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			]
		});
		/** PDF viewer glyph: a document frame with the "PDF" label. */
		const IconPdfOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 1.5h6.5L13.5 5v9.5h-10z",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M9.5 1.5V5h4",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M5 13.5v-3h1.4c.75 0 1.1.32 1.1.85 0 .54-.35.85-1.1.85H5.3",
					stroke: "currentColor",
					strokeWidth: "1.25",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8.3 13.5v-3h1.05c.8 0 1.35.5 1.35 1.5s-.55 1.5-1.35 1.5z",
					stroke: "currentColor",
					strokeWidth: "1.25",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M11.6 13.5v-3h1.3",
					stroke: "currentColor",
					strokeWidth: "1.25",
					strokeLinecap: "round"
				})
			]
		});
		/** Word viewer glyph: a document frame with a "W". */
		const IconDocxOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 1.5h6.5L13.5 5v9.5h-10z",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M9.5 1.5V5h4",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6.2 13.4 7.4 10l1.2 3.4M7.4 10.6l-.35-1.1c-.2-.62.2-1.25.85-1.25h.2c.65 0 1.05.63.85 1.25l-.35 1.1",
					stroke: "currentColor",
					strokeWidth: "1.25",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8.75 10.6 9.2 9.4",
					stroke: "currentColor",
					strokeWidth: "1.25",
					strokeLinecap: "round"
				})
			]
		});
		/** Excel viewer glyph: a spreadsheet grid. */
		const IconXlsxOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "1.5",
					y: "2",
					width: "13",
					height: "12",
					rx: "2",
					stroke: "currentColor",
					strokeWidth: "1.5"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M1.5 6h13M1.5 9.5h13M6 6v8M10.5 6v8",
					stroke: "currentColor",
					strokeWidth: "1.25"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "m3.8 13.2 2-3M5.8 13.2l-2-3",
					stroke: "currentColor",
					strokeWidth: "1.25",
					strokeLinecap: "round"
				})
			]
		});
		/** PowerPoint viewer glyph: a chart with rising bars. */
		const IconPptxOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: "1.5",
				y: "2.5",
				width: "13",
				height: "11",
				rx: "2",
				stroke: "currentColor",
				strokeWidth: "1.5"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M4 12.5v-3M7 12.5V7M10 12.5V4.5M13 12.5v-1.5",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round"
			})]
		});
		/** Video viewer glyph: a screen with a filled play triangle. */
		const IconVideoOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: "1.5",
				y: "3",
				width: "13",
				height: "10",
				rx: "2",
				stroke: "currentColor",
				strokeWidth: "1.5"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "m6 5.75 4.25 2.25L6 10.25z",
				fill: "currentColor",
				stroke: "none"
			})]
		});
		/** Markdown viewer glyph: the classic "M with a down arrow" badge. */
		const IconMarkdownOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: "1.5",
				y: "2.5",
				width: "13",
				height: "11",
				rx: "2",
				stroke: "currentColor",
				strokeWidth: "1.5"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M4 10.5V5.5l2 2.5 2-2.5v5M9.5 10.5v-5l2 2.5 2-2.5v5",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round",
				strokeLinejoin: "round"
			})]
		});
		/** HTML viewer glyph: a document frame with a "‹/›" tag pair. */
		const IconHtmlOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 1.5h6.5L13.5 5v9.5h-10z",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M9.5 1.5V5h4",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M5.6 13.2 4.2 10l1.4-3.2M7.4 6.8 8.8 10l-1.4 3.2",
					stroke: "currentColor",
					strokeWidth: "1.25",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			]
		});
		/** History glyph (thread switcher): a clock with a counterclockwise arrow,
		*  in the app's outline style — the "past conversations" mark. */
		const IconHistoryOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2.4 6.8A5.6 5.6 0 1 1 2.4 9.2",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2.2 3.4v3.4h3.4",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 5.4V8l1.9 1.2",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			]
		});
		/** Save glyph (save-as-new-session): the classic floppy disk, in the app's
		*  outline style. */
		const IconSaveOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4.2 14.5h7.6a1.2 1.2 0 0 0 1.2-1.2V4.9L10.6 2.5H4.2A1.2 1.2 0 0 0 3 3.7v9.6a1.2 1.2 0 0 0 1.2 1.2z",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M10 2.5v2.6H5.6V2.5",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M5.4 14.5v-4.2h5.2v4.2",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinejoin: "round"
				})
			]
		});
		/**
		* Visual Studio Code brand mark for the file-tree "open with" menu. The
		* path is the Simple Icons `visualstudiocode` glyph (CC0 1.0,
		* simple-icons@11.0.0 — later releases dropped it over Microsoft's brand
		* policy, so it is inlined here rather than pulled from react-icons),
		* rendered monochrome via currentColor to follow the active skin.
		*/
		const IconVscode16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 24 24",
			fill: "currentColor",
			xmlns: "http://www.w3.org/2000/svg",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" })
		});
		/**
		* Send glyph for the side-chat composer. Vendored from
		* @deepseek-ai/dsh-client-ui-primitives 0.1.5-rc.2 (IconSendOutline16, a
		* filled up-arrow): upstream DELETED that export in 0.1.6-alpha.1, which left
		* the imported binding undefined and crashed the side-chat panel with React
		* "Element type is invalid". Kept in this module (like the history / save
		* glyphs above) so a future upstream icon-table change cannot reach us.
		*/
		const IconSendOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M8.3125 0.981587C8.66767 1.0545 8.97902 1.20558 9.2627 1.43374C9.48724 1.61438 9.73029 1.85933 9.97949 2.10854L14.707 6.83608L13.293 8.25014L9 3.95717V15.0431H7V3.95717L2.70703 8.25014L1.29297 6.83608L6.02051 2.10854C6.26971 1.85933 6.51277 1.61438 6.7373 1.43374C6.97662 1.24126 7.28445 1.04542 7.6875 0.981587C7.8973 0.94841 8.1031 0.956564 8.3125 0.981587Z",
				fill: "currentColor"
			})
		});
		//#endregion
		//#region src/client/upload.ts
		/**
		* File-upload plumbing for the files window: turn a file picker or a drag-drop
		* into per-file raw-byte uploads through the sidebar's `/sidebar/upload` route.
		*
		* Folders keep their tree in both flows: the picker's `webkitdirectory`
		* selection arrives as Files with `webkitRelativePath` filled, and dropped
		* folders — which never surface in `dataTransfer.files` — are traversed via
		* `webkitGetAsEntry`, so the relative path is preserved for every nested file
		* and the host recreates the tree under the chosen directory. The File is
		* streamed straight into the POST body (no base64 inflation); uploads run
		* sequentially so one slow file cannot starve the others, and each result
		* reports its own outcome (the tree keeps going after a failure). An
		* optional `AbortSignal` stops the queue at the next item boundary and
		* aborts the in-flight request; the host cleans up its temp file when the
		* request stream dies.
		*/
		/** Sanitize a relative target: absolute paths, traversal, and empty segments
		*  are rejected (the host enforces the same rules with a 400). */
		function sanitizeRelativePath(rel) {
			if (rel === "" || isAbsolutePath(rel)) return void 0;
			if (rel.split(/[\\/]/).some((s) => s === "" || s === "." || s === "..")) return void 0;
			return rel;
		}
		/** The picker's relative path: webkitRelativePath when present, else the name. */
		function relativePathOf(file) {
			return sanitizeRelativePath(file.webkitRelativePath || file.name || "");
		}
		/** Collect a picker selection (webkitdirectory folders carry relative paths). */
		function uploadItemsFromFiles(files) {
			const items = [];
			for (const file of files) {
				const rel = relativePathOf(file);
				if (rel !== void 0) items.push({
					file,
					relativePath: rel
				});
			}
			return items;
		}
		/** Read one dropped file-system entry into upload items; directories
		*  recurse, prefixing their name onto every descendant's relative path. */
		async function itemsFromEntry(entry, prefix) {
			if (entry.isFile) {
				const file = await new Promise((resolve, reject) => {
					entry.file(resolve, reject);
				});
				const rel = sanitizeRelativePath(prefix + file.name);
				return rel === void 0 ? [] : [{
					file,
					relativePath: rel
				}];
			}
			if (entry.isDirectory) {
				const reader = entry.createReader();
				const entries = [];
				for (;;) {
					const batch = await new Promise((resolve, reject) => {
						reader.readEntries(resolve, reject);
					});
					if (batch.length === 0) break;
					entries.push(...batch);
				}
				return (await Promise.all(entries.map((child) => itemsFromEntry(child, `${prefix}${entry.name}/`)))).flat();
			}
			return [];
		}
		/**
		* Collect a drag-drop payload. Dropped folders do NOT surface in
		* `dataTransfer.files` — they arrive as directory items, so entries are
		* captured via `webkitGetAsEntry` and traversed (draining readEntries
		* batches), keeping each nested file's relative path. MUST be invoked
		* synchronously from the drop handler: the dataTransfer enters protected
		* mode once the event dispatch ends, while the captured entry handles stay
		* readable asynchronously. Falls back to the flat file list when the entry
		* API is unavailable; an entry that fails to read is skipped, not fatal.
		*/
		async function uploadItemsFromDrop(data) {
			if (data === void 0) return [];
			const entries = [...data.items].map((item) => item.kind === "file" ? item.webkitGetAsEntry() : null).filter((entry) => entry !== null);
			if (entries.length === 0) return uploadItemsFromFiles(data.files);
			return (await Promise.all(entries.map((entry) => itemsFromEntry(entry, "").catch(() => [])))).flat();
		}
		/** How long a success hint stays before fading (failures stay until the next action). */
		const UPLOAD_HINT_MS = 3500;
		/**
		* One-line upload progress text: 'Uploading into {dir}…' while no file is in
		* flight, then 'Uploading {done}/{total}: {name}' per file. Shared by the tree
		* hint and the full-window upload overlay.
		*/
		function uploadHintText(done, total, current, dir, t) {
			return current === "" ? t("uploadingTo", { dir }) : t("uploadProgress", {
				done,
				total,
				name: current
			});
		}
		/**
		* Upload every item into `dir` (absolute, inside the session workspace),
		* sequentially, reporting progress as `(done, total, currentRelativePath)`.
		* Resolves with one result per item — never rejects; `signal.aborted` stops
		* the queue at the next item boundary (completed items stay uploaded).
		*/
		async function uploadToDir(scope, dir, items, onProgress, signal) {
			const results = [];
			let done = 0;
			for (const item of items) {
				if (signal?.aborted) break;
				onProgress?.(done, items.length, item.relativePath);
				try {
					if (item.file.size > 134217728) results.push({
						relativePath: item.relativePath,
						ok: false,
						code: "too-large"
					});
					else {
						const res = await api.uploadFile(scope, dir, item.relativePath, item.file, signal);
						results.push({
							relativePath: item.relativePath,
							ok: true,
							path: res.path
						});
					}
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") break;
					results.push({
						relativePath: item.relativePath,
						ok: false,
						code: error instanceof SidebarApiError ? error.code : void 0,
						error: error instanceof Error ? error.message : String(error)
					});
				}
				done++;
			}
			onProgress?.(done, items.length, "");
			return results;
		}
		/** Fold a result list into a one-line status for the tree hint. */
		function summarizeResults(results, t) {
			const okCount = results.filter((r) => r.ok).length;
			const failed = results.find((r) => !r.ok);
			if (failed !== void 0) return t("uploadFailed", { error: failed.code === "too-large" ? t("uploadTooLarge") : failed.error ?? t("uploadFailedUnknown") });
			return t("uploadDone", { count: okCount });
		}
		//#endregion
		//#region src/client/FileTree.tsx
		/**
		* The controlled file tree behind the files window's tree panel (TreePanel
		* wraps it with the search box): a lazy VSCode-style tree rooted at the
		* session's working directory. Levels load on expansion (one API call per
		* directory), directories sort first, hidden entries render dimmed. The
		* expansion set lives in the per-session state (owned by the caller); the
		* caller also owns the refresh affordance — a `refreshTick` bump wipes the
		* level cache so the visible set reloads.
		*
		* Row actions: hovering a row reveals an @-reference button on the far
		* right (appends `@<relative path>` to the composer draft), and right-click
		* opens a context menu: file rows offer the caller's open escapes
		* (new tab / to the side, only when the callbacks exist) and a download
		* action (the host serves raw bytes, binary-safe); directory rows offer
		* "upload here"; every row can copy the relative or absolute path (with a
		* brief "copied" label replacing the button after a successful write).
		*
		* Uploads start here (drag-drop or the context menu picker) but run in the
		* caller: every request is reported through `onUploadRequest(dir, items)`
		* (VSCode semantics — a drop on a file row targets its parent directory),
		* and `busy` gates new drags while one upload is in flight.
		*/
		/** Root label: the last path segment (mirror of the host rootLabel). */
		function baseName$1(path) {
			const trimmed = path.replace(/[\\/]+$/, "");
			const at = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			return at === -1 ? trimmed : trimmed.slice(at + 1);
		}
		/** The containing directory of an absolute row path (never the root edge here). */
		function parentOf(path) {
			const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return at <= 0 ? path : path.slice(0, at);
		}
		/** Only OS file drags belong to the upload surface; in-app drags (tab reorder,
		*  split zones) must pass through untouched to the pane's tab-drop handling
		*  (mirror of Sidebar.tsx's panel-host shield gate). */
		function isFileDrag(event) {
			return event.dataTransfer?.types.includes("Files") ?? false;
		}
		/** How long the row's "copied" label stays after a successful write. */
		const COPIED_MS = 1200;
		/**
		* The drop overlay's hero art: an arrow rising out of a notched tray
		* (upload zone — the same glyph family as the toolbar's upload icon) and a
		* tilted pair of photo cards (chat zone). Hand-drawn, colored in the
		* palette of DSH's own native drop illustration (#3964FE / #9CE5ED) so the
		* two zones read as one family; the drop overlay is this flow's one brand
		* moment, so it gets color the rest of the UI never does.
		*/
		const UploadDropIllustration = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: "64",
			height: "56",
			viewBox: "0 0 64 56",
			fill: "none",
			"aria-hidden": "true",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M32 28V11",
					stroke: "#3964FE",
					strokeWidth: "5",
					strokeLinecap: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M23 20l9-9 9 9",
					stroke: "#3964FE",
					strokeWidth: "5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M10 40a4 4 0 0 1 4-4h7l3.2 4.6a5 5 0 0 0 4.1 2.2h7.4a5 5 0 0 0 4.1-2.2L43 36h7a4 4 0 0 1 4 4v2a10 10 0 0 1-10 10H20A10 10 0 0 1 10 42v-2z",
					fill: "#9CE5ED"
				})
			]
		});
		/** The chat zone's art: two tilted photo cards, each with its own
		*  sun-over-mountains motif (the back card carries detail too, so it never
		*  reads as a bare blob). */
		const ChatDropIllustration = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: "96",
			height: "76",
			viewBox: "0 0 96 76",
			fill: "none",
			"aria-hidden": "true",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
				transform: "rotate(-12 24 34)",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "6",
						y: "16",
						width: "36",
						height: "36",
						rx: "10",
						fill: "#9CE5ED"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "16",
						cy: "27",
						r: "3.5",
						fill: "white"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M11 44l8-9 6 6 4-4 8 9",
						stroke: "white",
						strokeWidth: "3",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
				transform: "rotate(8 61 35)",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "40",
						y: "12",
						width: "42",
						height: "46",
						rx: "10",
						fill: "#3964FE"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "55",
						cy: "27",
						r: "5",
						fill: "white"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M46 50l10-13 7 8 6-6 9 11",
						stroke: "white",
						strokeWidth: "3.5",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				]
			})]
		});
		function FileTree(props) {
			const { sessionId, cwd, expanded, revealed, onToggle, onOpenFile, onOpenFileNewTab, onOpenFileSide, openWithTargets, openWithPinned, openWithSsh, onOpenWith, onToggleOpenWithPin, onReferenceFile, refreshTick, onUploadRequest, busy, onPathRenamed, onPathRemoved, service } = props;
			const [data, setData] = (0, react.useState)({});
			const dataRef = (0, react.useRef)(data);
			/**
			* Registry revision (feature `fileIcons`): bumps on ANY registry change
			* (register/dispose of tabs or icons — one listener set) so mounted rows
			* re-resolve their glyphs. The value itself is unread; the state bump IS
			* the re-render trigger.
			*/
			const [, setIconsVersion] = (0, react.useState)(0);
			(0, react.useEffect)(() => service?.subscribe(() => {
				setIconsVersion((version) => version + 1);
			}), [service]);
			/**
			* One file row's leading glyph. The service resolver owns the whole chain
			* (registered specific name/extension → registered catch-all → the host's
			* file-type artwork, with per-factory crash isolation); without a service
			* the built-in host artwork alone applies.
			*/
			const fileRowIcon = (path) => service !== void 0 ? service.fileIcon(path, 14) : builtinFileIcon(path, 14);
			/**
			* One directory row's leading glyph: the registered `'folder'` /
			* `'folder-open'` (or `folderNames`) icon when present, else the host's
			* folder glyph.
			*/
			const dirRowIcon = (path, open) => service !== void 0 ? service.folderIcon(path, open, 14) : builtinFolderIcon(open, 14);
			/** The row whose path was just copied ("copied" label replaces its button). */
			const [copiedPath, setCopiedPath] = (0, react.useState)(null);
			/** Open context menu: the row path (and whether it is a directory) plus the cursor position. */
			const [rowMenu, setRowMenu] = (0, react.useState)(null);
			/** The row being renamed inline (pre-filled base name; Enter commits). */
			const [renaming, setRenaming] = (0, react.useState)(null);
			/** The row pending delete confirmation (the Modal owns the final call). */
			const [deleting, setDeleting] = (0, react.useState)(null);
			/** The last mutation failure (dismissable strip above the tree). */
			const [mutationError, setMutationError] = (0, react.useState)(null);
			/** Whether a file drag hovers the tree (drives the portaled drop zone). */
			const [dropOver, setDropOver] = (0, react.useState)(false);
			/** The directory a drag is hovering right now (null = body, drop to root). */
			const [dropTarget, setDropTarget] = (0, react.useState)(null);
			/**
			* Enter/leave depth under the tree body. dragenter/dragleave fire per
			* element along the drag path (and bubble), so a counter — DSH InputBar's
			* own pattern — is the flicker-free signal; relatedTarget is unreliable
			* across engines for drag events.
			*/
			const dropDepth = (0, react.useRef)(0);
			/** Explorer body element; its viewport rect anchors the portaled drop zone. */
			const bodyRef = (0, react.useRef)(null);
			/** The body's viewport rect captured at drag entry (null = not measured). */
			const [dropRect, setDropRect] = (0, react.useState)(null);
			/** Context-menu "upload here" target directory. */
			const pendingUploadDir = (0, react.useRef)(void 0);
			const fileInputRef = (0, react.useRef)(null);
			/** Reset all drag state (drop landed, the drag left, or a new drag begins). */
			const resetDrop = () => {
				dropDepth.current = 0;
				setDropOver(false);
				setDropTarget(null);
				setDropRect(null);
			};
			/**
			* Drop handlers: always swallow the event (a dropped file must never open
			* in the browser), then report the target directory to the caller. A drop
			* ends the drag without further leave events, so the depth resets here.
			* The payload collection is async (dropped folders are traversed through
			* their entry handles — captured synchronously inside uploadItemsFromDrop
			* while the dataTransfer is still live), so the request rides a then.
			*/
			const reportDrop = (dir, data) => {
				if (busy) return;
				uploadItemsFromDrop(data).then((items) => {
					if (items.length > 0) onUploadRequest(dir, items);
				});
			};
			const handleBodyDrop = (event) => {
				if (!isFileDrag(event)) return;
				event.preventDefault();
				event.stopPropagation();
				resetDrop();
				if (cwd !== void 0) reportDrop(cwd, event.dataTransfer);
			};
			const handleDirDrop = (event, dir) => {
				if (!isFileDrag(event)) return;
				event.preventDefault();
				event.stopPropagation();
				resetDrop();
				reportDrop(dir, event.dataTransfer);
			};
			const handleFileDrop = (event, path) => {
				handleDirDrop(event, parentOf(path));
			};
			const handleBodyDragEnter = (event) => {
				if (!isFileDrag(event)) return;
				event.preventDefault();
				event.stopPropagation();
				dropDepth.current += 1;
				if (busy) return;
				if (dropDepth.current === 1) {
					const rect = bodyRef.current?.getBoundingClientRect();
					setDropRect(rect === void 0 ? null : {
						top: rect.top,
						left: rect.left,
						width: rect.width,
						height: rect.height
					});
				}
				setDropOver(true);
			};
			const handleBodyDragLeave = () => {
				dropDepth.current = Math.max(0, dropDepth.current - 1);
				if (dropDepth.current > 0) return;
				setDropOver(false);
				setDropTarget(null);
				setDropRect(null);
			};
			const handleBodyDragOver = (event) => {
				if (!isFileDrag(event)) return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = busy ? "none" : "copy";
				if (busy) return;
				setDropTarget(null);
			};
			const handleRowDragOver = (event, dir) => {
				if (!isFileDrag(event)) return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = busy ? "none" : "copy";
				if (busy) return;
				setDropTarget(dir);
			};
			const storeLevel = (0, react.useCallback)((path, level) => {
				dataRef.current = {
					...dataRef.current,
					[path]: level
				};
				setData(dataRef.current);
			}, []);
			const loadDir = (0, react.useCallback)((dir) => {
				if (dataRef.current[dir] !== void 0) return;
				storeLevel(dir, {});
				api.fsTree({
					sessionId,
					cwd
				}, dir).then((listing) => {
					storeLevel(dir, { entries: listing.entries });
				}).catch((error) => {
					storeLevel(dir, { error: error instanceof Error ? error.message : String(error) });
				});
			}, [
				sessionId,
				cwd,
				storeLevel
			]);
			const lastTick = (0, react.useRef)(refreshTick);
			(0, react.useEffect)(() => {
				if (lastTick.current === refreshTick) return;
				lastTick.current = refreshTick;
				dataRef.current = {};
				setData({});
			}, [refreshTick]);
			(0, react.useEffect)(() => {
				const root = cwd;
				if (root === void 0) return;
				loadDir(root);
				for (const dir of expanded) loadDir(dir);
			}, [
				cwd,
				expanded,
				refreshTick,
				loadDir
			]);
			(0, react.useEffect)(() => {
				if (revealed.length === 0) return;
				(bodyRef.current?.querySelector("[data-dsh-revealed]"))?.scrollIntoView({
					block: "center",
					behavior: "smooth"
				});
			}, [revealed, data]);
			/** Copy `text`; on success flip the row's copied label for a moment. */
			const copyPath = (0, react.useCallback)((text, path) => {
				(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(text).then((ok) => {
					if (!ok) return;
					setCopiedPath(path);
					window.setTimeout(() => {
						setCopiedPath((current) => current === path ? null : current);
					}, COPIED_MS);
				});
			}, []);
			/** Re-fetch one directory level (a mutation changed it on disk). */
			const reloadDir = (0, react.useCallback)((dir) => {
				dataRef.current = {
					...dataRef.current,
					[dir]: {}
				};
				setData(dataRef.current);
				api.fsTree({
					sessionId,
					cwd
				}, dir).then((listing) => {
					storeLevel(dir, { entries: listing.entries });
				}).catch((error) => {
					storeLevel(dir, { error: error instanceof Error ? error.message : String(error) });
				});
			}, [
				sessionId,
				cwd,
				storeLevel
			]);
			/** Commit the inline rename: single-segment name; the row reloads from
			*  its parent and open tabs retarget through the caller. */
			const commitRename = (target) => {
				const name = target.name.trim();
				if (name === "" || name.includes("/") || name.includes("\\")) {
					setMutationError(t("renameInvalid"));
					return;
				}
				api.fsRename({
					sessionId,
					cwd
				}, target.path, name).then(({ path }) => {
					setRenaming(null);
					reloadDir(parentOf(target.path) ?? path);
					onPathRenamed?.(target.path, path);
				}).catch((error) => {
					setMutationError(error instanceof Error ? error.message : String(error));
				});
			};
			/** Commit the confirmed delete: the parent reloads and the caller closes
			*  every open tab at or under the removed path. */
			const commitDelete = (target) => {
				api.fsRemove({
					sessionId,
					cwd
				}, target.path).then(() => {
					setDeleting(null);
					reloadDir(parentOf(target.path) ?? target.path);
					onPathRemoved?.(target.path);
				}).catch((error) => {
					setMutationError(error instanceof Error ? error.message : String(error));
				});
			};
			/** The inline rename input (auto-focused, pre-selected; Enter/blur commits,
			*  Esc cancels, an IME composition never triggers the key handlers). */
			const renameCancelled = (0, react.useRef)(false);
			const renderRenameInput = (path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				autoFocus: true,
				className: sidebar_module_css_default.explorerRenameInput,
				defaultValue: renaming?.name ?? "",
				onClick: (event) => {
					event.stopPropagation();
				},
				onKeyDown: (event) => {
					event.stopPropagation();
					if (event.nativeEvent.isComposing) return;
					if (event.key === "Enter") {
						event.preventDefault();
						if (renaming !== null) commitRename(renaming);
					} else if (event.key === "Escape") {
						event.preventDefault();
						renameCancelled.current = true;
						setRenaming(null);
					}
				},
				onBlur: () => {
					if (renameCancelled.current) {
						renameCancelled.current = false;
						return;
					}
					if (renaming !== null) commitRename(renaming);
				}
			});
			/** The row's trailing actions: the @-reference button, or the copied label. */
			const rowActions = (entry) => {
				if (copiedPath === entry.path) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: sidebar_module_css_default.explorerCopied,
					children: t("copied")
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: sidebar_module_css_default.explorerRef,
					"aria-label": t("referenceFile"),
					title: t("referenceFile"),
					onClick: (event) => {
						event.stopPropagation();
						onReferenceFile(entry.path, entry.isDir);
					},
					children: t("referenceFile")
				});
			};
			const openRowMenu = (event, path, isDir) => {
				event.preventDefault();
				event.stopPropagation();
				setRowMenu({
					path,
					isDir,
					x: event.clientX,
					y: event.clientY
				});
			};
			/** Download a file through the host route (raw bytes, binary-safe). */
			const downloadFile = (path) => {
				const url = downloadUrl({
					sessionId,
					cwd
				}, path);
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.style.display = "none";
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
			};
			/** The menu label of one open target: a locale key for the built-ins, the
			*  user's own name for custom editors, plus the SSH hint in remote mode. */
			const openWithLabelOf = (target) => {
				const name = target.nameKey !== void 0 ? t(target.nameKey) : target.name;
				return openWithSsh === true && !target.localOnly ? `${name}${t("openWithSshSuffix")}` : name;
			};
			/**
			* The "open with" menu entries: the pinned targets as DIRECT rows, then
			* the parent row with every target as a nested submenu. Both only render
			* when the caller wired the feature and at least one target is visible.
			*/
			const openWithEntries = () => {
				if (openWithTargets === void 0 || onOpenWith === void 0 || openWithTargets.length === 0) return [];
				const pinnedIds = openWithPinned ?? [];
				/** Brand marks for the built-ins (monochrome silhouettes, currentColor);
				*  reveal gets the folder glyph, custom editors a generic code mark. */
				const itemIcon = (target) => {
					if (target.kind === "reveal") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscFolderOpened, { size: 16 });
					if (target.id === "vscode") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconVscode16, { size: 16 });
					if (target.id === "cursor") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SiCursor, { size: 16 });
					if (target.id === "zed") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SiZedindustries, { size: 16 });
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 16 });
				};
				const pinned = openWithTargets.filter((target) => pinnedIds.includes(target.id)).map((target) => ({
					id: `open-with:${target.id}`,
					label: openWithLabelOf(target),
					icon: itemIcon(target)
				}));
				const submenu = openWithTargets.map((target) => {
					const pinnedNow = pinnedIds.includes(target.id);
					return {
						id: `open-with:${target.id}`,
						label: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: sidebar_module_css_default.openWithLabel,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.openWithName,
								children: openWithLabelOf(target)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								role: "button",
								tabIndex: -1,
								className: clsx(sidebar_module_css_default.openWithPin, pinnedNow && sidebar_module_css_default.openWithPinActive),
								"aria-label": pinnedNow ? t("unpinOpenWith") : t("pinOpenWith"),
								title: pinnedNow ? t("unpinOpenWith") : t("pinOpenWith"),
								onClick: (event) => {
									event.preventDefault();
									event.stopPropagation();
									onToggleOpenWithPin?.(target.id);
								},
								children: pinnedNow ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscPinned, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscPin, { size: 14 })
							})]
						}),
						icon: itemIcon(target)
					};
				});
				return [
					...pinned,
					...pinned.length > 0 ? [{
						id: "open-with-sep",
						type: "separator"
					}] : [],
					{
						id: "open-with-menu",
						label: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: sidebar_module_css_default.openWithLabel,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.openWithName,
								children: t("openWithMenu")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
								size: 14,
								className: sidebar_module_css_default.openWithChevron,
								"aria-hidden": true
							})]
						}),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscLinkExternal, { size: 16 }),
						submenu
					}
				];
			};
			const root = cwd;
			const renderLevel = (dir, depth) => {
				const level = data[dir];
				if (level === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebar_module_css_default.explorerRow,
					style: { paddingLeft: depth * 22 + 6 },
					children: t("loading")
				});
				if (level.error !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: clsx(sidebar_module_css_default.explorerRow, sidebar_module_css_default.explorerError),
					style: { paddingLeft: depth * 22 + 6 },
					children: level.error
				});
				return (level.entries ?? []).map((entry) => {
					if (entry.isDir) {
						const isOpen = expanded.includes(entry.path);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							role: "button",
							tabIndex: 0,
							className: clsx(sidebar_module_css_default.explorerRow, sidebar_module_css_default.explorerDir, entry.hidden && sidebar_module_css_default.explorerHidden, dropTarget === entry.path && sidebar_module_css_default.explorerRowDropTarget, revealed.includes(entry.path) && sidebar_module_css_default.explorerRowRevealed),
							"data-dsh-revealed": revealed.includes(entry.path) ? "true" : void 0,
							style: { paddingLeft: depth * 22 + 6 },
							onClick: () => {
								onToggle(entry.path);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									onToggle(entry.path);
								}
							},
							onDragOver: (event) => {
								handleRowDragOver(event, entry.path);
							},
							onDrop: (event) => {
								handleDirDrop(event, entry.path);
							},
							onContextMenu: (event) => {
								openRowMenu(event, entry.path, true);
							},
							children: [
								dirRowIcon(entry.path, isOpen),
								renaming?.path === entry.path ? renderRenameInput(entry.path) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.explorerName,
									children: entry.name
								}),
								entry.isSymlink && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineRegular, {
									size: 12,
									className: sidebar_module_css_default.explorerSymlink
								}),
								rowActions(entry)
							]
						}), isOpen && renderLevel(entry.path, depth + 1)] }, entry.path);
					}
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "button",
						tabIndex: 0,
						className: clsx(sidebar_module_css_default.explorerRow, entry.hidden && sidebar_module_css_default.explorerHidden, entry.broken && sidebar_module_css_default.explorerBroken, dropTarget === parentOf(entry.path) && sidebar_module_css_default.explorerRowDropTarget, revealed.includes(entry.path) && sidebar_module_css_default.explorerRowRevealed),
						"data-dsh-revealed": revealed.includes(entry.path) ? "true" : void 0,
						style: { paddingLeft: depth * 22 + 6 },
						title: entry.broken ? `${entry.path} — ${t("brokenSymlink")}` : entry.path,
						onClick: () => {
							onOpenFile(entry.path);
						},
						onKeyDown: (event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								onOpenFile(entry.path);
							}
						},
						onDragOver: (event) => {
							handleRowDragOver(event, parentOf(entry.path));
						},
						onDrop: (event) => {
							handleFileDrop(event, entry.path);
						},
						onContextMenu: (event) => {
							openRowMenu(event, entry.path, false);
						},
						children: [
							fileRowIcon(entry.path),
							renaming?.path === entry.path ? renderRenameInput(entry.path) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.explorerName,
								children: entry.name
							}),
							entry.isSymlink && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineRegular, {
								size: 12,
								className: sidebar_module_css_default.explorerSymlink
							}),
							rowActions(entry)
						]
					}, entry.path);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: bodyRef,
				className: sidebar_module_css_default.explorerBody,
				onDragEnter: handleBodyDragEnter,
				onDragOver: handleBodyDragOver,
				onDragLeave: handleBodyDragLeave,
				onDrop: handleBodyDrop,
				children: [
					root === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.explorerEmpty,
						children: t("noSession")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: clsx(sidebar_module_css_default.explorerRow, dropTarget === root && sidebar_module_css_default.explorerRowDropTarget),
						style: { paddingLeft: 6 },
						onDragOver: (event) => {
							handleRowDragOver(event, root);
						},
						onDrop: (event) => {
							handleDirDrop(event, root);
						},
						onContextMenu: (event) => {
							openRowMenu(event, root, true);
						},
						children: [
							dirRowIcon(root, true),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.explorerName,
								children: baseName$1(root)
							}),
							copiedPath === root ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.explorerCopied,
								children: t("copied")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.explorerRef,
								"aria-label": t("referenceFile"),
								title: t("referenceFile"),
								onClick: (event) => {
									event.stopPropagation();
									onReferenceFile(root, true);
								},
								children: t("referenceFile")
							})
						]
					}), data[root] !== void 0 && renderLevel(root, 1)] }),
					dropOver && dropRect !== null && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.uploadDropZone,
						style: {
							top: dropRect.top + 2,
							left: dropRect.left + 2,
							width: dropRect.width - 4,
							height: dropRect.height - 4
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.uploadDropHero,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UploadDropIllustration, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.uploadDropZonePill,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconUploadOutline16, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.uploadDropZoneText,
									children: dropTarget !== null ? t("uploadTo", { dir: dropTarget }) : t("uploadDropHint")
								})]
							})]
						})
					}), dropRect.left >= 200 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.uploadDropChatHint,
						style: { width: dropRect.left },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.uploadDropChatCard,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChatDropIllustration, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("uploadDropChat") })]
						})
					})] }), document.body),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: fileInputRef,
						type: "file",
						multiple: true,
						style: { display: "none" },
						onChange: (event) => {
							const dir = pendingUploadDir.current ?? root;
							pendingUploadDir.current = void 0;
							if (dir !== void 0 && !busy) onUploadRequest(dir, uploadItemsFromFiles(event.target.files ?? []));
							event.target.value = "";
						}
					}),
					mutationError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: clsx(sidebar_module_css_default.explorerRow, sidebar_module_css_default.explorerError),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								flex: 1,
								minWidth: 0,
								overflow: "hidden",
								textOverflow: "ellipsis"
							},
							children: mutationError
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.explorerRef,
							"aria-label": t("dismiss"),
							title: t("dismiss"),
							onClick: () => {
								setMutationError(null);
							},
							children: t("dismiss")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
						open: rowMenu !== null,
						onClose: () => {
							setRowMenu(null);
						},
						items: [
							...rowMenu?.isDir === false && onOpenFileNewTab !== void 0 ? [{
								id: "open-new-tab",
								label: t("openFileNewTab"),
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 16 })
							}] : [],
							...rowMenu?.isDir === false && onOpenFileSide !== void 0 ? [{
								id: "open-side",
								label: t("openFileSide"),
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscFolderOpened, { size: 16 })
							}] : [],
							...openWithEntries(),
							...rowMenu?.isDir === false ? [{
								id: "download",
								label: t("download"),
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutlineRegular, { size: 16 })
							}] : [],
							...rowMenu?.isDir === true ? [{
								id: "upload-here",
								label: t("uploadHere"),
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconUploadOutline16, { size: 16 })
							}] : [],
							{
								id: "relative",
								label: t("copyRelative"),
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 16 })
							},
							{
								id: "absolute",
								label: t("copyAbsolute"),
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 16 })
							},
							...onPathRenamed !== void 0 && rowMenu !== null && rowMenu.path !== root || onPathRemoved !== void 0 && rowMenu !== null && rowMenu.path !== root ? [{
								id: "mutation-sep",
								type: "separator"
							}] : [],
							...onPathRenamed !== void 0 && rowMenu !== null && rowMenu.path !== root ? [{
								id: "rename-row",
								label: t("rename")
							}] : [],
							...onPathRemoved !== void 0 && rowMenu !== null && rowMenu.path !== root ? [{
								id: "delete-row",
								label: t("delete")
							}] : []
						],
						onSelect: (id) => {
							const target = rowMenu;
							if (target === null) return;
							setRowMenu(null);
							if (id === "open-new-tab") {
								onOpenFileNewTab?.(target.path);
								return;
							}
							if (id === "open-side") {
								onOpenFileSide?.(target.path);
								return;
							}
							if (id.startsWith("open-with:")) {
								onOpenWith?.(id.slice(10), target.path);
								return;
							}
							if (id === "download") {
								downloadFile(target.path);
								return;
							}
							if (id === "upload-here") {
								pendingUploadDir.current = target.path;
								fileInputRef.current?.click();
								return;
							}
							if (id === "rename-row") {
								setMutationError(null);
								setRenaming({
									path: target.path,
									name: baseName$1(target.path)
								});
								return;
							}
							if (id === "delete-row") {
								setDeleting({
									path: target.path,
									isDir: target.isDir
								});
								return;
							}
							copyPath(id === "relative" ? relativeTo(cwd ?? "", target.path) : target.path, target.path);
						},
						portal: true,
						align: "start",
						getAnchorRect: () => rowMenu === null ? null : new DOMRect(rowMenu.x, rowMenu.y, 0, 0),
						anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleting !== null,
						onClose: () => {
							setDeleting(null);
						},
						title: deleting === null ? "" : t("deleteTitle", { name: baseName$1(deleting.path) }),
						closeLabel: t("cancel"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setDeleting(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							onClick: () => {
								const target = deleting;
								if (target === null) return;
								commitDelete(target);
							},
							children: t("delete")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: sidebar_module_css_default.explorerError,
							children: deleting?.isDir === true ? t("deleteDescDir") : t("deleteDescFile")
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/frame-batcher.ts
		function createFrameBatcher() {
			let frame = null;
			let task = null;
			const run = () => {
				frame = null;
				const current = task;
				task = null;
				current?.();
			};
			return {
				schedule(next) {
					task = next;
					if (frame === null) frame = requestAnimationFrame(run);
				},
				flushNow() {
					if (frame !== null) {
						cancelAnimationFrame(frame);
						frame = null;
					}
					run();
				},
				dispose() {
					if (frame !== null) {
						cancelAnimationFrame(frame);
						frame = null;
					}
					task = null;
				}
			};
		}
		//#endregion
		//#region src/client/open-with.ts
		/** The default open-with configuration (fresh documents). */
		const OPEN_WITH_DEFAULTS = {
			sshHost: "",
			customEditors: [],
			pinned: []
		};
		/** The built-in open targets, in menu order. */
		const OPEN_WITH_BUILTINS = [
			{
				id: "explorer",
				nameKey: "openWithExplorer",
				name: "",
				kind: "reveal",
				isVscodeFamily: false,
				localOnly: true
			},
			{
				id: "vscode",
				nameKey: "openWithVscode",
				name: "",
				kind: "url",
				urlTemplate: "vscode://file/{path}",
				isVscodeFamily: true,
				localOnly: false
			},
			{
				id: "cursor",
				nameKey: "openWithCursor",
				name: "",
				kind: "url",
				urlTemplate: "cursor://file/{path}",
				isVscodeFamily: true,
				localOnly: false
			},
			{
				id: "zed",
				nameKey: "openWithZed",
				name: "",
				kind: "url",
				urlTemplate: "zed://file/{path}",
				isVscodeFamily: false,
				localOnly: true
			}
		];
		/** Whether a persisted value makes a structurally valid custom-editor row.
		*  Name/template may be empty — the settings panel edits rows in place and
		*  an in-progress row must survive the round-trip; the MENU hides rows that
		*  fail the stricter {@link isValidCustomEditor} check. */
		function isCustomEditor(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
			const record = value;
			return typeof record.id === "string" && record.id !== "" && typeof record.name === "string" && typeof record.urlTemplate === "string" && typeof record.isVscodeFamily === "boolean";
		}
		/**
		* Parse the persisted `openWith` blob (tolerant): malformed fields fall back
		* to the defaults, malformed custom-editor rows are dropped, and pinned ids
		* are kept verbatim (unknown ids are pruned when the targets are resolved —
		* the menu is the only consumer of the resolved list).
		*/
		function parseOpenWithConfig(raw) {
			if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ...OPEN_WITH_DEFAULTS };
			const record = raw;
			return {
				sshHost: typeof record.sshHost === "string" ? record.sshHost : "",
				customEditors: Array.isArray(record.customEditors) ? record.customEditors.filter(isCustomEditor) : [],
				pinned: Array.isArray(record.pinned) ? record.pinned.filter((id) => typeof id === "string" && id !== "") : []
			};
		}
		/** Whether a custom editor id belongs to this config (id prefix match). */
		function customIdOf(id) {
			return `custom:${id}`;
		}
		/**
		* The menu-visible open targets, in order (built-ins then custom editors).
		* In SSH mode the local-only targets (the OS file manager, Zed, custom
		* editors without the VSCode dialect) are dropped — they cannot reach a
		* remote path. Unknown pinned ids are pruned here too.
		*/
		function resolveOpenWithTargets(config) {
			const ssh = config.sshHost.trim() !== "";
			return [...OPEN_WITH_BUILTINS, ...config.customEditors.filter(isValidCustomEditor).map((editor) => ({
				id: customIdOf(editor.id),
				name: editor.name,
				kind: "url",
				urlTemplate: editor.urlTemplate,
				isVscodeFamily: editor.isVscodeFamily,
				localOnly: !editor.isVscodeFamily
			}))].filter((target) => !(ssh && target.localOnly));
		}
		/** The SSH hint appended to a target's label in remote mode. */
		function openWithSshActive(config) {
			return config.sshHost.trim() !== "";
		}
		/**
		* The URL to open for one resolved target, or undefined when the target has
		* no URL form (reveal) or the template is malformed. The path is inserted
		* RAW into the template (browsers percent-encode as needed; VSCode-family
		* URL parsers consume the absolute path with its leading slash, e.g.
		* `vscode://file//home/u/f.ts` or `vscode://file/C:/Users/u/f.ts`).
		*/
		function openWithUrl(target, path, config) {
			if (target.kind !== "url" || target.urlTemplate === void 0) return void 0;
			const normalized = normalizeUrlPath(path);
			if (openWithSshActive(config) && target.isVscodeFamily) {
				const scheme = schemeOf(target.urlTemplate);
				if (scheme === void 0) return void 0;
				return `${scheme}://vscode-remote/ssh-remote+${config.sshHost.trim()}${normalized}`;
			}
			if (!target.urlTemplate.includes("{path}") || !hasUrlScheme(target.urlTemplate)) return void 0;
			return target.urlTemplate.replace("{path}", normalized);
		}
		/** Whether a template starts with a `scheme://` prefix (the only shape the
		*  host's external opener accepts and the settings panel suggests). */
		function hasUrlScheme(template) {
			return /^[a-z][a-z0-9+.-]*:\/\//i.test(template);
		}
		/** The scheme of a URL template (the part before the first ':'), or undefined. */
		function schemeOf(template) {
			const at = template.indexOf(":");
			if (at <= 0) return void 0;
			const scheme = template.slice(0, at);
			return /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? scheme : void 0;
		}
		/** Normalize a filesystem path for embedding in a URL (backslashes → '/'). */
		function normalizeUrlPath(path) {
			return path.replace(/\\/g, "/");
		}
		/** A fresh custom-editor id (uuid when available, time-based fallback). */
		function newCustomEditorId() {
			if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
			return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
		}
		/** Validate one custom-editor row before the settings panel accepts it. */
		function isValidCustomEditor(row) {
			return row.name.trim() !== "" && row.urlTemplate.includes("{path}") && /^[a-z][a-z0-9+.-]*:\/\//i.test(row.urlTemplate.trim());
		}
		//#endregion
		//#region src/client/prefs.ts
		/** Validate one raw resolved value into {@link SidebarPrefs}. Used for the
		* settings.get payload AND the settings.update response (both carry the
		* layered resolved value); any malformed field falls back to its default.
		* @param value - the raw resolved section from the settings wire.
		* @returns validated prefs (always well-formed).
		*/
		function parsePrefs(value) {
			if (value === null || typeof value !== "object") return { ...SIDEBAR_PREFS_DEFAULTS };
			const record = value;
			return {
				openByDefault: typeof record.openByDefault === "boolean" ? record.openByDefault : SIDEBAR_PREFS_DEFAULTS.openByDefault,
				defaultWidthPercent: typeof record.defaultWidthPercent === "number" && Number.isFinite(record.defaultWidthPercent) ? clampWidthPercent(record.defaultWidthPercent) : SIDEBAR_PREFS_DEFAULTS.defaultWidthPercent,
				autoOpenSubagent: typeof record.autoOpenSubagent === "boolean" ? record.autoOpenSubagent : SIDEBAR_PREFS_DEFAULTS.autoOpenSubagent,
				autoOpenJobs: typeof record.autoOpenJobs === "boolean" ? record.autoOpenJobs : SIDEBAR_PREFS_DEFAULTS.autoOpenJobs,
				agentTerminalTools: typeof record.agentTerminalTools === "boolean" ? record.agentTerminalTools : SIDEBAR_PREFS_DEFAULTS.agentTerminalTools,
				agentOpenTools: typeof record.agentOpenTools === "boolean" ? record.agentOpenTools : SIDEBAR_PREFS_DEFAULTS.agentOpenTools,
				terminalFontFamily: typeof record.terminalFontFamily === "string" ? record.terminalFontFamily : SIDEBAR_PREFS_DEFAULTS.terminalFontFamily,
				terminalShell: typeof record.terminalShell === "string" ? record.terminalShell : SIDEBAR_PREFS_DEFAULTS.terminalShell,
				terminalShellArgs: typeof record.terminalShellArgs === "string" ? record.terminalShellArgs : SIDEBAR_PREFS_DEFAULTS.terminalShellArgs,
				terminalFontSize: typeof record.terminalFontSize === "number" && Number.isFinite(record.terminalFontSize) ? clampTerminalFontSize(record.terminalFontSize) : SIDEBAR_PREFS_DEFAULTS.terminalFontSize,
				interceptOpenPath: typeof record.interceptOpenPath === "boolean" ? record.interceptOpenPath : SIDEBAR_PREFS_DEFAULTS.interceptOpenPath,
				editorExplorer: typeof record.editorExplorer === "boolean" ? record.editorExplorer : SIDEBAR_PREFS_DEFAULTS.editorExplorer,
				titleBarScheme: isTitleBarScheme(record.titleBarScheme) ? record.titleBarScheme : record.titleBarCompat === true || hasLegacyStripValue(record.titleBarStripPx) ? "custom" : "auto",
				titleBarPresetId: typeof record.titleBarPresetId === "string" ? record.titleBarPresetId : SIDEBAR_PREFS_DEFAULTS.titleBarPresetId,
				customCss: typeof record.customCss === "string" ? record.customCss : SIDEBAR_PREFS_DEFAULTS.customCss,
				titleBarCompat: typeof record.titleBarCompat === "boolean" ? record.titleBarCompat : SIDEBAR_PREFS_DEFAULTS.titleBarCompat,
				titleBarStripPx: typeof record.titleBarStripPx === "number" && Number.isFinite(record.titleBarStripPx) ? clampTitleBarStrip(record.titleBarStripPx) : SIDEBAR_PREFS_DEFAULTS.titleBarStripPx,
				htmlViewerNoSandbox: typeof record.htmlViewerNoSandbox === "boolean" ? record.htmlViewerNoSandbox : SIDEBAR_PREFS_DEFAULTS.htmlViewerNoSandbox,
				htmlViewerDefaultUnsafe: typeof record.htmlViewerDefaultUnsafe === "boolean" ? record.htmlViewerDefaultUnsafe : SIDEBAR_PREFS_DEFAULTS.htmlViewerDefaultUnsafe,
				browserNoSandbox: typeof record.browserNoSandbox === "boolean" ? record.browserNoSandbox : SIDEBAR_PREFS_DEFAULTS.browserNoSandbox,
				browserInterceptLinks: typeof record.browserInterceptLinks === "boolean" ? record.browserInterceptLinks : SIDEBAR_PREFS_DEFAULTS.browserInterceptLinks,
				browserInterceptHttp: typeof record.browserInterceptHttp === "boolean" ? record.browserInterceptHttp : SIDEBAR_PREFS_DEFAULTS.browserInterceptHttp,
				browserInterceptHttps: typeof record.browserInterceptHttps === "boolean" ? record.browserInterceptHttps : SIDEBAR_PREFS_DEFAULTS.browserInterceptHttps,
				tabsEnabled: booleanMapOf(record.tabsEnabled),
				viewersEnabled: booleanMapOf(record.viewersEnabled),
				pluginSettings: pluginSettingsMapOf(record.pluginSettings)
			};
		}
		/**
		* Validate the plugin-owned settings map (v0.12.0+): `{ descriptorId: { key:
		* value } }`, nested open maps. Any non-object value (or a malformed whole)
		* falls back to the empty map — the schema defaults already guard the wire
		* shape, this is the client's second line.
		*/
		function pluginSettingsMapOf(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
			const out = {};
			for (const [id, blob] of Object.entries(value)) if (blob !== null && typeof blob === "object" && !Array.isArray(blob)) out[id] = blob;
			return out;
		}
		/**
		* Validate one enable-switch map (per-tab / per-viewer). Only boolean values
		* survive; a non-object or a non-boolean entry falls back to the empty map /
		* drops the entry — an absent key means the feature stays enabled.
		*/
		function booleanMapOf(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
			const out = {};
			for (const [key, item] of Object.entries(value)) if (typeof item === "boolean") out[key] = item;
			return out;
		}
		/** Type guard for the title-bar scheme union (anything else falls back). */
		function isTitleBarScheme(value) {
			return typeof value === "string" && TITLE_BAR_SCHEMES.includes(value);
		}
		/**
		* Whether the legacy document carries an explicit strip value (only
		* reachable through the old gear popup): a stored number different from the
		* default counts as "the user already configured something" and migrates to
		* the `custom` scheme.
		*/
		function hasLegacyStripValue(value) {
			return typeof value === "number" && Number.isFinite(value) && value !== 40;
		}
		/**
		* Read the resolved side card preferences through the plugin's settings route.
		* @param settings - the settings wire face (the plugin api by default).
		* @returns validated prefs, or the schema defaults when the route rejects,
		* the namespace is absent, or a stored value violates the contract.
		*/
		async function loadPrefs(settings) {
			try {
				return parsePrefs((await settings.settingsGet()).value);
			} catch {
				return { ...SIDEBAR_PREFS_DEFAULTS };
			}
		}
		/**
		* Read the external-disable flag from the same settings route: the
		* dsh-web-ui family's aionui-panel provider choice. True only when the host
		* resolved `aionui-panel.rightPanel` to 'aionui-panel' — while true the
		* sidebar must not mount (the two right panels are mutually exclusive). Any
		* failure (route rejected, aionui absent, malformed response) reads false,
		* so a missing family never hides the sidebar.
		* @param settings - the settings wire face (the plugin api by default).
		* @returns the external-disable flag (false on any failure).
		*/
		async function loadExternalDisable(settings) {
			try {
				return (await settings.settingsGet()).externalDisable === true;
			} catch {
				return false;
			}
		}
		//#endregion
		//#region src/client/plugin-settings.ts
		/**
		* Pending-writes queue for the file tree's open-with config: pin toggles and
		* (outside the settings popup) config edits land in the sidebar prefs as
		* `pluginSettings['editor']`. Writes are serialized through one promise chain
		* so a quick burst of pin clicks can never read a stale pluginSettings map
		* and drop an earlier toggle; each write pushes the whole open map patch
		* through the revision-free settings route and adopts the returned document.
		*
		* (The settings popup has its own serialized commit — SideCardSection's —
		* so its rows and this helper rarely race; the shared route's last-write-wins
		* semantics cover the uncommon overlap.)
		*/
		let queue = Promise.resolve();
		/**
		* Merge one plugin-owned settings blob of one descriptor and persist it.
		* @param store - the sidebar store (its prefs are replaced by the write result).
		* @param descriptorId - the descriptor whose blob is patched ('editor' here).
		* @param updater - pure patch function; receives a shallow copy of the blob.
		*/
		function updatePluginSettings(store, descriptorId, updater) {
			queue = queue.then(async () => {
				const prefs = store.getPrefs();
				const next = updater({ ...prefs.pluginSettings[descriptorId] ?? {} });
				const view = await api.settingsUpdate({ pluginSettings: {
					...prefs.pluginSettings,
					[descriptorId]: next
				} });
				store.setPrefs(parsePrefs(view.value));
			}).catch((error) => {
				console.error("open-with settings write failed", error);
			});
		}
		//#endregion
		//#region src/client/UploadOverlay.tsx
		/**
		* Full-window upload progress over the files tree: a blurred scrim (same mask
		* token as the repo's Modal primitive) with a card showing the target
		* directory, file-level progress, and a cancel button. Esc cancels too —
		* clicking the scrim does not, so a stray click can never abort an upload.
		* Rendered inside TreePanel (absolute inset-0), so it covers only the file
		* window and never the conversation column.
		*/
		function UploadOverlay(props) {
			const { dir, done, total, current, onCancel, cancelling } = props;
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onCancel();
				};
				window.addEventListener("keydown", onKey);
				return () => {
					window.removeEventListener("keydown", onKey);
				};
			}, [onCancel]);
			const percent = total === 0 ? 0 : Math.min(100, Math.round(done / total * 100));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidebar_module_css_default.uploadOverlay,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": t("uploadingTo", { dir }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.uploadOverlayCard,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.uploadOverlayTitle,
							title: dir,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconUploadOutline16, { size: 16 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("uploadingTo", { dir }) })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.uploadOverlayProgress,
							role: "progressbar",
							"aria-valuemin": 0,
							"aria-valuemax": total,
							"aria-valuenow": done,
							"aria-valuetext": t("uploadProgress", {
								done,
								total,
								name: current
							}),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.uploadOverlayProgressFill,
								style: { width: `${percent}%` }
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.uploadOverlayStatus,
							children: uploadHintText(done, total, current, dir, t)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.uploadOverlayCancel,
							disabled: cancelling,
							onClick: onCancel,
							children: t("cancel")
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/TreePanel.tsx
		/**
		* The files window's tree surface: a global file-name search box on top
		* (300ms debounce; an in-flight search is aborted by the next keystroke)
		* over either the shared controlled FileTree (empty query) or the flat
		* result list (relative paths; click opens through the caller's mode-aware
		* open). Owns its refresh tick: the icon next to the search input clears
		* the tree cache. EditorHost docks it as the tab's right panel (wrapped in
		* a drag-resize handle) and provides the file context-menu open escapes.
		*
		* Uploads (header pickers, the tree's drag-drop and "upload here" menu)
		* all funnel through here: one session at a time, shown in a full-window
		* progress overlay with cancel, followed by a tree refresh and a one-line
		* hint under the search row (success fades, failures and cancels stay).
		* OS file drags are shielded at the panel host (see Sidebar.tsx), so a
		* drop over the file window uploads here and never reaches DSH's chat
		* intake.
		*/
		function TreePanel(props) {
			const { sessionId, cwd, expanded, revealed, onToggle, onOpenFile, onOpenFileNewTab, onOpenFileSide, openWithTargets, openWithPinned, openWithSsh, onOpenWith, onToggleOpenWithPin, onReferenceFile, onPathRenamed, onPathRemoved, full, service } = props;
			const [query, setQuery] = (0, react.useState)("");
			const [results, setResults] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [refreshTick, setRefreshTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const bump = () => {
					setRefreshTick((tick) => tick + 1);
				};
				window.addEventListener("focus", bump);
				window.addEventListener("dsh-sidebar:refresh-files", bump);
				return () => {
					window.removeEventListener("focus", bump);
					window.removeEventListener("dsh-sidebar:refresh-files", bump);
				};
			}, []);
			/** One-line upload status under the search row ('' hides the hint). */
			const [uploadStatus, setUploadStatus] = (0, react.useState)("");
			/** Whether the status line is a failure/cancel (error color, stays visible). */
			const [uploadFailed, setUploadFailed] = (0, react.useState)(false);
			/** The in-flight upload session (null → no overlay, buttons enabled). */
			const [upload, setUpload] = (0, react.useState)(null);
			/** True between the cancel click and the session settling (button disabled). */
			const [cancelling, setCancelling] = (0, react.useState)(false);
			/** Set by cancelUpload; the settle path shows 'upload cancelled' instead of
			*  summarizing the partial results. */
			const cancelledRef = (0, react.useRef)(false);
			const fileInputRef = (0, react.useRef)(null);
			const folderInputRef = (0, react.useRef)(null);
			/** Start one upload session into `dir` (absolute, inside the workspace). */
			const startUpload = (dir, items) => {
				if (items.length === 0 || cwd === void 0 || upload !== null) return;
				cancelledRef.current = false;
				const controller = new AbortController();
				setUploadFailed(false);
				setUploadStatus(uploadHintText(0, items.length, "", dir, t));
				setUpload({
					dir,
					done: 0,
					total: items.length,
					current: "",
					controller
				});
				uploadToDir({
					sessionId,
					cwd
				}, dir, items, (done, total, current) => {
					if (current !== "") setUploadStatus(uploadHintText(done, total, current, dir, t));
					setUpload((session) => session === null ? session : {
						...session,
						done,
						total,
						current
					});
				}, controller.signal).then((results) => {
					setUpload(null);
					setCancelling(false);
					setRefreshTick((tick) => tick + 1);
					if (cancelledRef.current) {
						setUploadStatus(t("uploadCancelled"));
						setUploadFailed(true);
						return;
					}
					const status = summarizeResults(results, t);
					setUploadStatus(status);
					setUploadFailed(results.some((result) => !result.ok));
					if (results.every((result) => result.ok)) window.setTimeout(() => {
						setUploadStatus((current) => current === status ? "" : current);
					}, UPLOAD_HINT_MS);
				});
			};
			/** Cancel the in-flight upload (aborts the request; the host drops its temp). */
			const cancelUpload = () => {
				if (upload === null || cancelling) return;
				cancelledRef.current = true;
				setCancelling(true);
				upload.controller.abort();
			};
			const folderInputProps = { webkitdirectory: "" };
			const needle = query.trim();
			(0, react.useEffect)(() => {
				if (needle === "") {
					setResults(null);
					setError(null);
					return;
				}
				const controller = new AbortController();
				const timer = window.setTimeout(() => {
					api.fsSearch({
						sessionId,
						cwd
					}, needle, controller.signal).then((found) => {
						setResults(found);
						setError(null);
					}).catch((failure) => {
						if (controller.signal.aborted) return;
						setResults(null);
						setError(failure instanceof Error ? failure.message : String(failure));
					});
				}, 300);
				return () => {
					window.clearTimeout(timer);
					controller.abort();
				};
			}, [
				sessionId,
				cwd,
				needle
			]);
			const busy = upload !== null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(sidebar_module_css_default.editorTreePanel, full === true && sidebar_module_css_default.editorTreePanelFull),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.editorTreeSearch,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: sidebar_module_css_default.editorSearchInput,
								value: query,
								placeholder: t("editorSearchPlaceholder"),
								spellCheck: false,
								onChange: (event) => {
									setQuery(event.target.value);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("refresh"),
								title: t("refresh"),
								onClick: () => {
									setRefreshTick((tick) => tick + 1);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("uploadFiles"),
								title: t("uploadFiles"),
								disabled: busy,
								onClick: () => {
									fileInputRef.current?.click();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconUploadOutline16, { size: 14 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("uploadFolder"),
								title: t("uploadFolder"),
								disabled: busy,
								onClick: () => {
									folderInputRef.current?.click();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenRegular, { size: 14 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: fileInputRef,
								type: "file",
								multiple: true,
								style: { display: "none" },
								onChange: (event) => {
									if (cwd !== void 0) startUpload(cwd, uploadItemsFromFiles(event.target.files ?? []));
									event.target.value = "";
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								ref: folderInputRef,
								type: "file",
								multiple: true,
								...folderInputProps,
								style: { display: "none" },
								onChange: (event) => {
									if (cwd !== void 0) startUpload(cwd, uploadItemsFromFiles(event.target.files ?? []));
									event.target.value = "";
								}
							})
						]
					}),
					uploadStatus !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: clsx(sidebar_module_css_default.editorSearchHint, uploadFailed && sidebar_module_css_default.editorError),
						title: uploadStatus,
						children: uploadStatus
					}),
					needle === "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileTree, {
						sessionId,
						cwd,
						expanded,
						revealed,
						onToggle,
						onOpenFile,
						onOpenFileNewTab,
						onOpenFileSide,
						openWithTargets,
						openWithPinned,
						openWithSsh,
						onOpenWith,
						onToggleOpenWithPin,
						onReferenceFile,
						onPathRenamed,
						onPathRemoved,
						refreshTick,
						onUploadRequest: startUpload,
						busy,
						service
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.explorerBody,
						children: [
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: clsx(sidebar_module_css_default.editorSearchHint, sidebar_module_css_default.editorError),
								children: error
							}),
							error === null && results === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.editorSearchHint,
								children: t("loading")
							}),
							error === null && results !== null && results.matches.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.editorSearchHint,
								children: t("editorSearchNoResults")
							}),
							error === null && results !== null && results.matches.map((rel) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.editorSearchResult,
								title: rel,
								onClick: () => {
									onOpenFile(resolveSidebarPath(cwd, rel));
								},
								children: rel
							}, rel)),
							error === null && results?.truncated === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.editorSearchHint,
								children: t("editorSearchTruncated")
							})
						]
					}),
					upload !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UploadOverlay, {
						dir: upload.dir,
						done: upload.done,
						total: upload.total,
						current: upload.current,
						onCancel: cancelUpload,
						cancelling
					})
				]
			});
		}
		//#endregion
		//#region src/client/EditorHost.tsx
		/**
		* The editor tab host: the single FILES WINDOW. It resolves a file's
		* previewer through the sidebar registry (`matchFileViewer`), fetches bytes
		* per the matched viewer's fetch strategy, and renders its component — or
		* the shared download pane when nothing can render the file. A tab without
		* a path (the seeded "Files" home) renders an empty-state hint instead of
		* the viewer loading flow; that path-less window IS the file explorer.
		*
		* The chrome depends on the `editorExplorer` mode (read reactively so
		* toggling it re-renders without a reload):
		* - merged (in-place): tree click / path-input Enter switch the CURRENT
		*   tab in place (updateTab rewrites path/title; the tab keeps its id and
		*   meta, so treeOpen/treeWidth survive the switch);
		* - split: they open through `openSidebarFile` (a per-path dedupe tab),
		*   and a PATH-LESS window is the standalone explorer — it renders ONLY
		*   the tree panel (search + FileTree, full-window), no editor chrome.
		*   Editor tabs (with a path) keep the full chrome in both modes.
		* The tree's context menu offers the explicit escapes in both modes: open
		* in a new tab (per-path dedupe) or to the side (a fresh tab in a fresh
		* rightward split of the current pane).
		*
		* The strategy dispatch is pure (planFirstMatch / planFsReadOutcome in
		* editor-load.ts); this component only wires it to the host APIs.
		*/
		/** The docked tree panel's width bounds (drag-resize clamps into them). */
		const TREE_WIDTH_DEFAULT = 240;
		const TREE_WIDTH_MIN = 160;
		const TREE_WIDTH_MAX = 480;
		/** Stable empty blob for the editor pluginSettings read (a fresh `?? {}`
		*  would change identity every snapshot and loop useSyncExternalStore). */
		const EMPTY_PLUGIN_BLOB = {};
		/** The tab's persisted meta object (a malformed meta reads as empty). */
		function metaOf(tab) {
			return tab.meta !== null && typeof tab.meta === "object" && !Array.isArray(tab.meta) ? tab.meta : {};
		}
		/** Read the persisted tree-panel flag of one editor tab: an explicit
		*  boolean meta wins; otherwise path-less tabs (the seeded home) default
		*  open and file tabs default closed. */
		function treeOpenOf(tab) {
			const treeOpen = metaOf(tab).treeOpen;
			return typeof treeOpen === "boolean" ? treeOpen : tab.path === void 0 || tab.path === "";
		}
		/** Read the persisted tree-panel width (clamped; default 240). */
		function treeWidthOf(tab) {
			const width = metaOf(tab).treeWidth;
			return typeof width === "number" && Number.isFinite(width) ? Math.min(TREE_WIDTH_MAX, Math.max(TREE_WIDTH_MIN, Math.round(width))) : TREE_WIDTH_DEFAULT;
		}
		/** Merge a patch into the tab's persisted meta (rides the layout). */
		function patchMeta(ctx, tab, patch) {
			ctx.get("betterSidebar")?.updateTab(tab.id, { meta: {
				...metaOf(tab),
				...patch
			} });
		}
		/** Clamp one dock width into the contract range. */
		function clampTreeWidth(value) {
			return Math.min(TREE_WIDTH_MAX, Math.max(TREE_WIDTH_MIN, Math.round(value)));
		}
		function EditorHost(props) {
			const { ctx, store, scope, tab, expanded, revealed, onToggleDir, onReferenceFile, onPathRenamed, onPathRemoved } = props;
			const readScope = readScopeOf(scope, metaOf(tab));
			const path = tab.path ?? "";
			const title = tab.title;
			const isDir = metaOf(tab).dir === true;
			const [load, setLoad] = (0, react.useState)({ status: "loading" });
			const [reloadSeq, setReloadSeq] = (0, react.useState)(0);
			const refreshFile = () => {
				if (toolbar?.dirty === true) {
					if (!(typeof window.confirm === "function" ? window.confirm(t("refreshUnsavedConfirm")) : false)) return;
				}
				setReloadSeq((sequence) => sequence + 1);
			};
			const inPlace = (0, react.useSyncExternalStore)((0, react.useCallback)((callback) => store.subscribe(callback), [store]), (0, react.useCallback)(() => store.getSnapshot().prefs.editorExplorer, [store]));
			const editorBlob = (0, react.useSyncExternalStore)((0, react.useCallback)((callback) => store.subscribe(callback), [store]), (0, react.useCallback)(() => store.getSnapshot().prefs.pluginSettings["editor"] ?? EMPTY_PLUGIN_BLOB, [store]));
			const openWithConfig = (0, react.useMemo)(() => parseOpenWithConfig(editorBlob.openWith), [editorBlob]);
			const openWithTargets = (0, react.useMemo)(() => resolveOpenWithTargets(openWithConfig), [openWithConfig]);
			const showEmpty = path === "";
			const treeOnly = showEmpty && !inPlace;
			const folderRoot = isDir ? path : void 0;
			/**
			* Open a file from THIS window (tree click / search row / path input):
			* merged mode switches this tab in place (stable id, meta survives);
			* split mode opens a per-path dedupe tab through openSidebarFile.
			*/
			const openFile = (absolute) => {
				if (inPlace) ctx.get("betterSidebar")?.updateTab(tab.id, {
					path: absolute,
					title: baseName$1(absolute)
				});
				else openSidebarFile(ctx, store, readScope.sessionId, absolute);
			};
			/** The context menu's explicit "new tab" escape (per-path dedupe). */
			const openFileNewTab = (absolute) => {
				openSidebarFile(ctx, store, readScope.sessionId, absolute);
			};
			/**
			* The context menu's "open to the side": a fresh editor tab (uid id — the
			* `'editor:' + path` convention would clash with the id safety net on a
			* second side-open of the same file) in a rightward split of THIS pane.
			*/
			const openFileSide = (absolute) => {
				store.reduce((state) => {
					const key = treeOf(state, tab.id);
					const pane = leafWithTab(state[key], tab.id) ?? firstLeaf(state[key]);
					const fresh = {
						id: mintTabId(),
						type: "editor",
						title: baseName$1(absolute),
						path: absolute,
						meta: { treeOpen: false }
					};
					const { node, leafId } = insertLeafAt(state[key], pane.id, "row", fresh, false);
					return {
						...state,
						[key]: node,
						activePane: leafId
					};
				});
			};
			/** The context menu's "open with" action: reveal the path in the OS file
			*  manager, or hand the target's URL (a local `file` URL, or the SSH-remote
			*  form for VSCode-family editors in remote mode) to the host's external
			*  opener. Failures are logged only — a missing handler is the OS's
			*  dialog, not a sidebar error. */
			const openWith = (targetId, absolute) => {
				const target = openWithTargets.find((item) => item.id === targetId);
				if (target === void 0) return;
				if (target.kind === "reveal") {
					api.openExternal({
						action: "reveal",
						path: absolute
					}).catch((error) => {
						console.error("open external failed", error);
					});
					return;
				}
				const url = openWithUrl(target, absolute, openWithConfig);
				if (url === void 0) return;
				api.openExternal({
					action: "url",
					url
				}).catch((error) => {
					console.error("open external failed", error);
				});
			};
			/** Toggle one target's pinned state. The write is serialized (see
			*  plugin-settings.ts) and the menu re-renders when the store prefs land. */
			const toggleOpenWithPin = (targetId) => {
				updatePluginSettings(store, "editor", (blob) => {
					const config = parseOpenWithConfig(blob.openWith);
					const pinned = config.pinned.includes(targetId) ? config.pinned.filter((id) => id !== targetId) : [...config.pinned, targetId];
					return {
						...blob,
						openWith: {
							...config,
							pinned
						}
					};
				});
			};
			const [toolbar, setToolbar] = (0, react.useState)(null);
			const controlsRef = (0, react.useRef)(null);
			const onToolbarState = (0, react.useCallback)((next) => {
				setToolbar((prev) => prev !== null && JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
			}, []);
			const onToolbarControls = (0, react.useCallback)((controls) => {
				controlsRef.current = controls;
			}, []);
			const [dragWidth, setDragWidth] = (0, react.useState)(null);
			const dragRef = (0, react.useRef)(null);
			const pendingWidthRef = (0, react.useRef)(0);
			const dragBatcher = (0, react.useRef)(createFrameBatcher()).current;
			(0, react.useEffect)(() => () => dragBatcher.dispose(), [dragBatcher]);
			const treeWidth = dragWidth ?? treeWidthOf(tab);
			const onResizeStart = (event) => {
				event.preventDefault();
				event.currentTarget.setPointerCapture?.(event.pointerId);
				dragRef.current = {
					startX: event.clientX,
					startWidth: treeWidth
				};
			};
			const onResizeMove = (event) => {
				const drag = dragRef.current;
				if (drag === null) return;
				pendingWidthRef.current = clampTreeWidth(drag.startWidth + (drag.startX - event.clientX));
				dragBatcher.schedule(() => setDragWidth(pendingWidthRef.current));
			};
			const onResizeEnd = (event) => {
				const drag = dragRef.current;
				if (drag === null) return;
				dragBatcher.flushNow();
				dragRef.current = null;
				setDragWidth(null);
				const finalWidth = clampTreeWidth(drag.startWidth + (drag.startX - event.clientX));
				if (finalWidth !== treeWidthOf(tab)) patchMeta(ctx, tab, { treeWidth: finalWidth });
			};
			(0, react.useEffect)(() => {
				setToolbar(null);
				if (showEmpty || isDir) return;
				let cancelled = false;
				const controller = new AbortController();
				setLoad({ status: "loading" });
				const mediaUrlOf = () => mediaUrl(readScope, path);
				const apply = (action) => {
					if (cancelled) return;
					switch (action.kind) {
						case "binary":
							setLoad({ status: "binary" });
							return;
						case "render":
							setLoad({
								status: "ready",
								viewer: action.viewer,
								content: action.content,
								truncated: action.truncated,
								mediaUrl: action.mediaUrl,
								customData: action.customData
							});
							return;
						case "customLoad":
							action.viewer.load?.(path, readScope, controller.signal).then((data) => {
								if (cancelled) return;
								setLoad({
									status: "ready",
									viewer: action.viewer,
									customData: data
								});
							}).catch((error) => {
								if (cancelled) return;
								setLoad({
									status: "error",
									message: error instanceof Error ? error.message : String(error)
								});
							});
							return;
						case "fetchFsRead":
							api.fsRead(readScope, path).then((result) => {
								if (cancelled) return;
								const outcome = planFsReadOutcome(action.viewer, {
									binary: result.kind === "binary",
									content: result.kind === "text" ? result.content : "",
									truncated: result.truncated,
									head: result.kind === "binary" ? result.head : void 0
								}, (head) => ctx.get("betterSidebar")?.matchFileViewer(path, head), mediaUrlOf);
								apply(outcome);
							}).catch((error) => {
								if (cancelled) return;
								setLoad({
									status: "error",
									message: error instanceof Error ? error.message : String(error)
								});
							});
							return;
					}
				};
				apply(planFirstMatch(ctx.get("betterSidebar")?.matchFileViewer(path), mediaUrlOf));
				return () => {
					cancelled = true;
					controller.abort();
				};
			}, [
				readScope.sessionId,
				readScope.cwd,
				path,
				ctx,
				showEmpty,
				isDir,
				reloadSeq
			]);
			const prevSaveState = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				const current = toolbar?.saveState;
				if (prevSaveState.current !== "saved" && current === "saved" && toolbar?.mode === "preview") setReloadSeq((sequence) => sequence + 1);
				prevSaveState.current = current;
			}, [toolbar?.saveState, toolbar?.mode]);
			const treeOpen = treeOpenOf(tab);
			/** Persist the panel flag on the tab (survives reloads with the layout). */
			const toggleTree = () => {
				patchMeta(ctx, tab, { treeOpen: !treeOpen });
			};
			const saveLabel = toolbar === null ? "" : toolbar.saveState === "saving" ? t("loading") : toolbar.saveState === "saved" ? t("saved") : toolbar.saveState === "failed" ? t("saveFailed") : "";
			if (treeOnly || folderRoot !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidebar_module_css_default.editor,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreePanel, {
					full: true,
					sessionId: readScope.sessionId,
					cwd: folderRoot ?? readScope.cwd,
					expanded,
					revealed,
					onToggle: onToggleDir,
					onOpenFile: openFile,
					onOpenFileNewTab: openFileNewTab,
					onOpenFileSide: openFileSide,
					openWithTargets,
					openWithPinned: openWithConfig.pinned,
					openWithSsh: openWithSshActive(openWithConfig),
					onOpenWith: openWith,
					onToggleOpenWithPin: toggleOpenWithPin,
					onReferenceFile,
					onPathRenamed,
					onPathRemoved,
					service: ctx.get("betterSidebar")
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.editor,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.editorHeader,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(EditorPathInput, {
							path,
							cwd: readScope.cwd,
							onOpen: openFile
						}, path),
						toolbar?.modes === true && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.editorModeToggle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: clsx(sidebar_module_css_default.editorModeButton, toolbar.mode === "preview" && sidebar_module_css_default.editorModeActive),
								onClick: () => {
									if (toolbar.mode === "edit" && toolbar.dirty !== true && toolbar.saveState !== "failed") setReloadSeq((sequence) => sequence + 1);
									controlsRef.current?.setMode("preview");
								},
								children: t("preview")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: clsx(sidebar_module_css_default.editorModeButton, toolbar.mode === "edit" && sidebar_module_css_default.editorModeActive),
								onClick: () => {
									controlsRef.current?.setMode("edit");
								},
								children: t("edit")
							})]
						}),
						toolbar?.dirty === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.dirtyDot,
							title: t("unsaved")
						}),
						toolbar?.editable === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("save"),
							title: `${t("save")} (Ctrl/Cmd+S)`,
							onClick: () => {
								controlsRef.current?.save();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 })
						}),
						saveLabel !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: clsx(sidebar_module_css_default.editorStatus, toolbar?.saveState === "failed" && sidebar_module_css_default.editorStatusError),
							children: saveLabel
						}),
						toolbar !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("refresh"),
							title: t("refresh"),
							onClick: refreshFile,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: clsx(sidebar_module_css_default.iconButton, treeOpen && sidebar_module_css_default.editorTreeToggleActive),
							"aria-label": t("editorTreeToggle"),
							title: t("editorTreeToggle"),
							"aria-pressed": treeOpen,
							onClick: toggleTree,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenRegular, { size: 14 })
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.editorBody,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.editorMain,
						children: [
							showEmpty && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.editorPlaceholder,
								children: t("editorEmptyHint")
							}),
							!showEmpty && load.status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.editorPlaceholder,
								children: t("loading")
							}),
							!showEmpty && load.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.editorError,
								children: load.message
							}),
							!showEmpty && load.status === "binary" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BinaryDownload, {
								scope: readScope,
								path
							}),
							!showEmpty && load.status === "ready" && (0, react.createElement)(load.viewer.component, {
								ctx,
								store,
								scope: readScope,
								path,
								title,
								viewerId: load.viewer.id,
								content: load.content,
								truncated: load.truncated,
								mediaUrl: load.mediaUrl,
								customData: load.customData,
								toolbar: "host",
								onToolbarState,
								onToolbarControls
							})
						]
					}), treeOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.editorTreeDock,
						style: { width: treeWidth },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.editorTreeResize,
							role: "separator",
							"aria-orientation": "vertical",
							"aria-label": t("editorTreeToggle"),
							onPointerDown: onResizeStart,
							onPointerMove: onResizeMove,
							onPointerUp: onResizeEnd,
							onPointerCancel: onResizeEnd
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TreePanel, {
							sessionId: readScope.sessionId,
							cwd: readScope.cwd,
							expanded,
							revealed,
							onToggle: onToggleDir,
							onOpenFile: openFile,
							onOpenFileNewTab: openFileNewTab,
							onOpenFileSide: openFileSide,
							openWithTargets,
							openWithPinned: openWithConfig.pinned,
							openWithSsh: openWithSshActive(openWithConfig),
							onOpenWith: openWith,
							onToggleOpenWithPin: toggleOpenWithPin,
							onReferenceFile,
							onPathRenamed,
							onPathRemoved,
							service: ctx.get("betterSidebar")
						})]
					})]
				})]
			});
		}
		/**
		* The header's path input: shows the current file relative to the session
		* cwd (absolute when outside it). Enter resolves the typed path (relative
		* input joins onto the cwd — the same resolution `openSidebarFile` uses)
		* and opens it through the parent's mode-aware open (in-place switch or a
		* per-path dedupe tab); Escape/blur restores the current value. The parent
		* keys it by `path` so an in-place switch remounts and reseeds the draft.
		*/
		function EditorPathInput(props) {
			const { path, cwd, onOpen } = props;
			const display = path === "" ? "" : relativeTo(cwd ?? "", path);
			const [value, setValue] = (0, react.useState)(display);
			const commit = () => {
				const input = value.trim();
				if (input === "" || input === display) {
					setValue(display);
					return;
				}
				onOpen(resolveSidebarPath(cwd, input));
				setValue(display);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				className: sidebar_module_css_default.editorPathInput,
				value,
				placeholder: t("editorPathPlaceholder"),
				title: path,
				spellCheck: false,
				onChange: (event) => {
					setValue(event.target.value);
				},
				onKeyDown: (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						commit();
					} else if (event.key === "Escape") setValue(display);
				},
				onBlur: () => {
					setValue(display);
				}
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/libing/kk_Projects/dsh-coding-sidebar/src/client/SideCardSection.module.css.mjs
		const css$4 = ".AC9POW_section{flex-direction:column;gap:16px;width:100%;max-width:760px;display:flex}.AC9POW_intro{color:var(--dsw-alias-label-tertiary);margin:0;padding:0 2px;font-size:13px;line-height:20px}.AC9POW_group{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:16px;flex-direction:column;flex:none;gap:8px;padding:20px;display:flex}.AC9POW_groupHeading{color:var(--dsw-alias-label-primary);align-items:baseline;gap:7px;padding:0 2px 6px;font-size:13px;font-weight:600;line-height:20px;display:flex}.AC9POW_count{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:16px}.AC9POW_grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;display:grid}.AC9POW_card{border:1px solid var(--dsw-alias-border-l2);min-height:106px;font:inherit;color:inherit;cursor:pointer;background:0 0;border-radius:12px;flex-direction:column;transition:background .12s,border-color .12s;display:flex;position:relative;overflow:hidden}.AC9POW_card:not(.AC9POW_cardOn):hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-label-dimmed)}.AC9POW_cardOn{border-color:color-mix(in srgb, var(--dsw-alias-button-primary-fill) 45%, transparent);background:var(--dsw-alias-interactive-bg-active)}.AC9POW_cardMain{border-radius:inherit;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex-direction:column;flex:1;gap:6px;padding:12px;display:flex}.AC9POW_cardMain:focus-visible,.AC9POW_cardSettings:focus-visible,.AC9POW_rowGear:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:2px}.AC9POW_cardTop{align-items:center;gap:8px;min-width:0;min-height:28px;display:flex}.AC9POW_cardIconChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:28px;height:28px;color:var(--dsw-alias-label-tertiary);border-radius:8px;flex:none;justify-content:center;align-items:center;display:inline-flex}.AC9POW_cardOn .AC9POW_cardIconChip{border-color:color-mix(in srgb, var(--dsw-alias-button-primary-fill) 35%, transparent);background:color-mix(in srgb, var(--dsw-alias-button-primary-fill) 12%, transparent);color:var(--dsw-alias-button-primary-fill)}.AC9POW_cardTitle{min-width:0;color:var(--dsw-alias-label-secondary);white-space:nowrap;text-overflow:ellipsis;flex:1;font-size:13px;font-weight:600;line-height:20px;overflow:hidden}.AC9POW_cardOn .AC9POW_cardTitle{color:var(--dsw-alias-label-primary)}.AC9POW_cardSwitch{flex:none;align-items:center;display:inline-flex}.AC9POW_cardSwitchTrack{box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;align-items:center;width:30px;height:16px;padding:2px;transition:background .15s,border-color .15s;display:inline-flex}.AC9POW_cardSwitchThumb{background:var(--dsw-alias-label-tertiary);border-radius:50%;width:10px;height:10px;transition:transform .15s,background .15s;display:block}.AC9POW_cardOn .AC9POW_cardSwitchTrack{border-color:var(--dsw-alias-button-primary-fill);background:var(--dsw-alias-button-primary-fill)}.AC9POW_cardOn .AC9POW_cardSwitchThumb{background:var(--dsw-alias-bg-layer-3);transform:translate(14px)}.AC9POW_cardDesc{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;font-size:11px;line-height:16px;overflow:hidden}.AC9POW_cardOn .AC9POW_cardDesc{color:var(--dsw-alias-label-secondary)}.AC9POW_cardSettings{border:0;border-top:1px solid var(--dsw-alias-border-l1);width:100%;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;align-items:center;gap:6px;padding:6px 12px;font-size:11px;font-weight:500;line-height:16px;transition:background .12s,color .12s;display:flex}.AC9POW_cardOn .AC9POW_cardSettings{border-top-color:color-mix(in srgb, var(--dsw-alias-button-primary-fill) 18%, transparent)}.AC9POW_cardSettings:hover{background:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-brand-primary)}.AC9POW_rowGear{border:1px solid var(--dsw-alias-border-l2);width:22px;height:22px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:6px;flex:none;justify-content:center;align-items:center;padding:0;transition:background .12s,border-color .12s,color .12s;display:inline-flex}.AC9POW_rowGear:hover{border-color:var(--dsw-alias-interactive-bg-hover-accent);background:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-brand-primary)}.AC9POW_row{border-bottom:1px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:16px;padding:12px 2px;display:flex}.AC9POW_row:last-child{border-bottom:none}.AC9POW_rowText{flex-direction:column;gap:4px;min-width:0;display:flex}.AC9POW_title{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}.AC9POW_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.AC9POW_switch{cursor:pointer;flex:none;display:inline-flex;position:relative}.AC9POW_switchInput{opacity:0;width:1px;height:1px;margin:0;position:absolute}.AC9POW_switchTrack{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;align-items:center;width:36px;height:20px;padding:2px;transition:background .15s,border-color .15s;display:inline-flex}.AC9POW_switchThumb{background:var(--dsw-alias-label-tertiary);border-radius:50%;width:14px;height:14px;transition:transform .15s,background .15s;display:block}.AC9POW_switch:hover .AC9POW_switchTrack{border-color:var(--dsw-alias-label-dimmed)}.AC9POW_switchInput:checked+.AC9POW_switchTrack{border-color:var(--dsw-alias-button-primary-fill);background:var(--dsw-alias-button-primary-fill)}.AC9POW_switchInput:checked+.AC9POW_switchTrack .AC9POW_switchThumb{background:var(--dsw-alias-bg-layer-3);transform:translate(16px)}.AC9POW_switchInput:focus-visible+.AC9POW_switchTrack{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.AC9POW_control{flex:none;align-items:center;gap:6px;display:flex}.AC9POW_percentInput{width:76px}.AC9POW_typedInput{width:200px}.AC9POW_typedInputNumber{width:76px}.AC9POW_selectAnchor{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-width:220px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;align-items:center;gap:6px;padding:4px 8px;font-size:13px;line-height:20px;display:flex}.AC9POW_selectAnchor:hover{border-color:var(--dsw-alias-label-dimmed)}.AC9POW_selectAnchorIcon{flex:none;display:inline-flex}.AC9POW_selectAnchorText{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.AC9POW_selectOption{align-items:center;gap:10px;min-width:200px;display:flex}.AC9POW_selectOptionIcon{color:var(--dsw-alias-label-secondary);flex:none;display:inline-flex}.AC9POW_selectOptionText{flex-direction:column;min-width:0;display:flex}.AC9POW_suffix{color:var(--dsw-alias-label-secondary);font-size:14px;line-height:22px}.AC9POW_cssTextArea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;min-height:120px;color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code,monospace);resize:vertical;border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.6}.AC9POW_cssTextArea:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.AC9POW_popupDialog.AC9POW_popupDialog{width:min(460px,100%)}.AC9POW_popupRows{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2,transparent) transparent;flex-direction:column;gap:8px;width:100%;max-height:min(52vh,440px);padding-right:4px;display:flex;overflow:hidden auto}.AC9POW_popupRows::-webkit-scrollbar{width:6px}.AC9POW_popupRows::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l2,var(--dsw-alias-border-l2));border-radius:3px}.AC9POW_popupRows::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l2,var(--dsw-alias-label-dimmed))}.AC9POW_popupRow{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;flex:none;justify-content:space-between;align-items:center;gap:16px;min-width:0;padding:12px 14px;transition:border-color .16s,background .16s;display:flex}.AC9POW_popupRow:hover{border-color:var(--dsw-alias-label-dimmed)}.AC9POW_done{appearance:none;font:inherit;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.AC9POW_done:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.AC9POW_error{color:var(--dsw-alias-state-error-primary);padding:10px 0 2px;font-size:12px;line-height:17px}.AC9POW_pluginModal.AC9POW_pluginModal{width:min(560px,100%)}.AC9POW_pluginList{flex-direction:column;gap:12px;width:100%;display:flex}.AC9POW_pluginTopicBtn{appearance:none;border:1px solid var(--dsw-alias-border-l2);width:100%;font:inherit;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;border-radius:8px;padding:6px 12px;font-size:12px;line-height:18px}.AC9POW_pluginTopicBtn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-label-primary)}.AC9POW_pluginTopicBtn:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:1px}.AC9POW_pluginEmpty{color:var(--dsw-alias-label-tertiary);padding:20px 2px;font-size:12px;line-height:18px}.AC9POW_pluginEntry{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;flex-direction:column;gap:4px;padding:12px;display:flex}.AC9POW_pluginEntryHead{justify-content:space-between;align-items:center;gap:12px;display:flex}.AC9POW_pluginEntryActions{flex:none;align-items:center;gap:6px;display:inline-flex}.AC9POW_pluginJumpBtn{appearance:none;border:1px solid var(--dsw-alias-border-l2);font:inherit;cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border-radius:8px;flex:none;padding:3px 12px;font-size:12px;line-height:1.5}.AC9POW_pluginJumpBtn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-label-primary)}.AC9POW_pluginJumpBtn:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:1px}.AC9POW_pluginName{appearance:none;min-width:0;font:inherit;color:var(--dsw-alias-label-primary);text-align:left;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;background:0 0;border:0;padding:0;font-size:13px;font-weight:600;line-height:20px;text-decoration:none;overflow:hidden}.AC9POW_pluginName:hover{color:var(--dsw-alias-button-primary-fill);text-decoration:underline}.AC9POW_pluginDesc{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.AC9POW_pluginInstall{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);white-space:nowrap;border-radius:8px;padding:6px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;display:block;overflow-x:auto}.AC9POW_pluginCopyBtn{appearance:none;font:inherit;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border:1px solid #0000;border-radius:8px;flex:none;padding:3px 12px;font-size:12px;line-height:1.5}.AC9POW_pluginCopyBtn:hover{background:var(--dsw-alias-button-primary-hover)}.AC9POW_pluginCopyBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}@media (prefers-reduced-motion:reduce){.AC9POW_card,.AC9POW_cardSettings,.AC9POW_cardSwitchTrack,.AC9POW_cardSwitchThumb,.AC9POW_rowGear,.AC9POW_popupRow,.AC9POW_switchTrack,.AC9POW_switchThumb{transition:none}}.AC9POW_versionBadge{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:999px;align-self:flex-start;align-items:center;gap:8px;padding:4px 12px 4px 14px;font-size:12px;line-height:18px;display:inline-flex}.AC9POW_versionBadgeName{color:var(--dsw-alias-label-primary);font-weight:600}.AC9POW_versionBadgeTag{background:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;border-radius:999px;padding:1px 8px}.AC9POW_pluginSearch{box-sizing:border-box;appearance:none;border:1px solid var(--dsw-alias-border-l2);width:100%;font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:6px 10px;font-size:12px;line-height:18px}.AC9POW_pluginSearch::placeholder{color:var(--dsw-alias-label-tertiary)}.AC9POW_pluginSearch:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:1px}.AC9POW_pluginEntries{flex-direction:column;gap:10px;max-height:46vh;padding-right:2px;display:flex;overflow:hidden auto}.AC9POW_pluginGroup{flex-direction:column;gap:8px;display:flex}.AC9POW_pluginGroupHeading{color:var(--dsw-alias-label-secondary);padding:2px 2px 0;font-size:12px;font-weight:600;line-height:18px}.AC9POW_openWithEditorRow{grid-template-columns:1fr 1.5fr auto auto;align-items:center;gap:8px;min-width:0;display:grid}.AC9POW_openWithEditorInput,.AC9POW_openWithEditorTemplate{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;min-width:0;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:5px 8px;font-size:13px;line-height:20px}.AC9POW_openWithEditorInput:focus-visible,.AC9POW_openWithEditorTemplate:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.AC9POW_openWithFamily{color:var(--dsw-alias-label-secondary);white-space:nowrap;cursor:pointer;align-items:center;gap:5px;font-size:12px;display:inline-flex}.AC9POW_openWithRemove{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:8px;justify-content:center;align-items:center;padding:4px;display:inline-flex}.AC9POW_openWithRemove:hover{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-2)}.AC9POW_openWithHint{color:var(--dsw-alias-state-error-primary);padding:0 2px;font-size:12px;line-height:17px}";
		const tagId$4 = "dsh-coding-sidebar/SideCardSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-coding-sidebar";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var SideCardSection_module_css_default = {
			"card": "AC9POW_card",
			"cardDesc": "AC9POW_cardDesc",
			"cardIconChip": "AC9POW_cardIconChip",
			"cardMain": "AC9POW_cardMain",
			"cardOn": "AC9POW_cardOn",
			"cardSettings": "AC9POW_cardSettings",
			"cardSwitch": "AC9POW_cardSwitch",
			"cardSwitchThumb": "AC9POW_cardSwitchThumb",
			"cardSwitchTrack": "AC9POW_cardSwitchTrack",
			"cardTitle": "AC9POW_cardTitle",
			"cardTop": "AC9POW_cardTop",
			"control": "AC9POW_control",
			"count": "AC9POW_count",
			"cssTextArea": "AC9POW_cssTextArea",
			"desc": "AC9POW_desc",
			"done": "AC9POW_done",
			"error": "AC9POW_error",
			"grid": "AC9POW_grid",
			"group": "AC9POW_group",
			"groupHeading": "AC9POW_groupHeading",
			"intro": "AC9POW_intro",
			"openWithEditorInput": "AC9POW_openWithEditorInput",
			"openWithEditorRow": "AC9POW_openWithEditorRow",
			"openWithEditorTemplate": "AC9POW_openWithEditorTemplate",
			"openWithFamily": "AC9POW_openWithFamily",
			"openWithHint": "AC9POW_openWithHint",
			"openWithRemove": "AC9POW_openWithRemove",
			"percentInput": "AC9POW_percentInput",
			"pluginCopyBtn": "AC9POW_pluginCopyBtn",
			"pluginDesc": "AC9POW_pluginDesc",
			"pluginEmpty": "AC9POW_pluginEmpty",
			"pluginEntries": "AC9POW_pluginEntries",
			"pluginEntry": "AC9POW_pluginEntry",
			"pluginEntryActions": "AC9POW_pluginEntryActions",
			"pluginEntryHead": "AC9POW_pluginEntryHead",
			"pluginGroup": "AC9POW_pluginGroup",
			"pluginGroupHeading": "AC9POW_pluginGroupHeading",
			"pluginInstall": "AC9POW_pluginInstall",
			"pluginJumpBtn": "AC9POW_pluginJumpBtn",
			"pluginList": "AC9POW_pluginList",
			"pluginModal": "AC9POW_pluginModal",
			"pluginName": "AC9POW_pluginName",
			"pluginSearch": "AC9POW_pluginSearch",
			"pluginTopicBtn": "AC9POW_pluginTopicBtn",
			"popupDialog": "AC9POW_popupDialog",
			"popupRow": "AC9POW_popupRow",
			"popupRows": "AC9POW_popupRows",
			"row": "AC9POW_row",
			"rowGear": "AC9POW_rowGear",
			"rowText": "AC9POW_rowText",
			"section": "AC9POW_section",
			"selectAnchor": "AC9POW_selectAnchor",
			"selectAnchorIcon": "AC9POW_selectAnchorIcon",
			"selectAnchorText": "AC9POW_selectAnchorText",
			"selectOption": "AC9POW_selectOption",
			"selectOptionIcon": "AC9POW_selectOptionIcon",
			"selectOptionText": "AC9POW_selectOptionText",
			"suffix": "AC9POW_suffix",
			"switch": "AC9POW_switch",
			"switchInput": "AC9POW_switchInput",
			"switchThumb": "AC9POW_switchThumb",
			"switchTrack": "AC9POW_switchTrack",
			"title": "AC9POW_title",
			"typedInput": "AC9POW_typedInput",
			"typedInputNumber": "AC9POW_typedInputNumber",
			"versionBadge": "AC9POW_versionBadge",
			"versionBadgeName": "AC9POW_versionBadgeName",
			"versionBadgeTag": "AC9POW_versionBadgeTag"
		};
		//#endregion
		//#region src/client/open-with-settings.tsx
		/**
		* The editor tab's custom settings panel ("打开方式"): the file tree's
		* "open with" configuration — the optional SSH host marking the workspace as
		* remote, and the user-defined editors (name + URL template with `{path}` +
		* whether they speak the VSCode URL dialect). Persisted as the editor
		* blob's `openWith` key through the settings popup's `updatePluginSetting`.
		*
		* The popup renders the declarative rows (the editorExplorer picker) ABOVE
		* this panel — SettingsBody renders the custom panel after the row list, so
		* this component owns only its own section.
		*/
		function OpenWithSettings(props) {
			const { pluginSettings, updatePluginSetting } = props;
			const [draft, setDraft] = (0, react.useState)(() => parseOpenWithConfig(pluginSettings.openWith));
			const commit = (next) => {
				setDraft(next);
				updatePluginSetting("openWith", next);
			};
			const setSshHost = (sshHost) => commit({
				...draft,
				sshHost
			});
			const patchCustom = (id, patch) => {
				commit({
					...draft,
					customEditors: draft.customEditors.map((editor) => editor.id === id ? {
						...editor,
						...patch
					} : editor)
				});
			};
			const removeCustom = (id) => {
				commit({
					...draft,
					customEditors: draft.customEditors.filter((editor) => editor.id !== id),
					pinned: draft.pinned.filter((pinnedId) => pinnedId !== `custom:${id}`)
				});
			};
			const addCustom = () => {
				commit({
					...draft,
					customEditors: [...draft.customEditors, {
						id: newCustomEditorId(),
						name: "",
						urlTemplate: "",
						isVscodeFamily: false
					}]
				});
			};
			const hasInvalid = draft.customEditors.some((editor) => !isValidCustomEditor(editor));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SideCardSection_module_css_default.popupRows,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideCardSection_module_css_default.popupRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SideCardSection_module_css_default.rowText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.title,
								children: t("openWithSettingsSshTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.desc,
								children: t("openWithSettingsSshDesc")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: SideCardSection_module_css_default.typedInput,
							value: draft.sshHost,
							placeholder: t("openWithSettingsSshPlaceholder"),
							spellCheck: false,
							onChange: (event) => {
								setSshHost(event.target.value);
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideCardSection_module_css_default.popupRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SideCardSection_module_css_default.rowText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.title,
								children: t("openWithSettingsCustomTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.desc,
								children: t("openWithSettingsCustomDesc")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SideCardSection_module_css_default.control,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SideCardSection_module_css_default.done,
								onClick: addCustom,
								children: t("openWithSettingsAdd")
							})
						})]
					}),
					draft.customEditors.map((editor) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideCardSection_module_css_default.openWithEditorRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: SideCardSection_module_css_default.openWithEditorInput,
								value: editor.name,
								placeholder: t("openWithSettingsName"),
								spellCheck: false,
								onChange: (event) => {
									patchCustom(editor.id, { name: event.target.value });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: SideCardSection_module_css_default.openWithEditorTemplate,
								value: editor.urlTemplate,
								placeholder: t("openWithSettingsTemplate"),
								spellCheck: false,
								onChange: (event) => {
									patchCustom(editor.id, { urlTemplate: event.target.value });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: SideCardSection_module_css_default.openWithFamily,
								title: t("openWithSettingsFamilyDesc"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: editor.isVscodeFamily,
									onChange: (event) => {
										patchCustom(editor.id, { isVscodeFamily: event.currentTarget.checked });
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("openWithSettingsFamily") })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SideCardSection_module_css_default.openWithRemove,
								"aria-label": t("openWithSettingsRemove"),
								title: t("openWithSettingsRemove"),
								onClick: () => {
									removeCustom(editor.id);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
							})
						]
					}, editor.id)),
					hasInvalid && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SideCardSection_module_css_default.openWithHint,
						role: "note",
						children: t("openWithSettingsInvalidHint")
					})
				]
			});
		}
		//#endregion
		//#region src/client/lazy-chunk.tsx
		/**
		* Lazy chunk view wrapper: mounts a component that lives in a lazy chunk,
		* showing a loading placeholder while the chunk script loads and an error +
		* retry affordance on failure. Used by the built-in tab/viewer descriptors.
		*
		* Contract note: {@link lazyChunkComponent} returns a plain render-prop
		* function — the descriptor contract is `component: (props) => ReactNode`,
		* and the repo renders descriptors BOTH ways: Sidebar calls
		* `descriptor.component(props)` directly, EditorHost renders it via
		* `createElement`. The wrapper function body therefore contains no hooks;
		* all state lives in the inner {@link LazyChunkView} component.
		*/
		function LazyChunkView({ chunk, pick, props }) {
			const [attempt, setAttempt] = (0, react.useState)(0);
			const [state, setState] = (0, react.useState)({ status: "loading" });
			(0, react.useEffect)(() => {
				let cancelled = false;
				setState({ status: "loading" });
				loadChunk(chunk).then((mod) => {
					if (cancelled) return;
					const Comp = pick(mod);
					if (Comp === void 0) {
						setState({
							status: "error",
							message: `[dsh-coding-sidebar] chunk "${chunk}" is missing its component`
						});
						return;
					}
					setState({
						status: "ready",
						Comp
					});
				}).catch((error) => {
					if (cancelled) return;
					setState({
						status: "error",
						message: error instanceof Error ? error.message : String(error)
					});
				});
				return () => {
					cancelled = true;
				};
			}, [
				chunk,
				pick,
				attempt
			]);
			if (state.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidebar_module_css_default.editorPlaceholder,
				children: t("loading")
			});
			if (state.status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.editorError,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: state.message }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: sidebar_module_css_default.terminalRetry,
					onClick: () => {
						setAttempt((current) => current + 1);
					},
					children: t("terminalRetry")
				})]
			});
			return (0, react.createElement)(state.Comp, props);
		}
		/**
		* Build a descriptor-compatible lazy wrapper for a chunk-resident component.
		* The returned function is the descriptor `component` itself: it returns an
		* element and never calls hooks, so both invocation styles (plain function
		* call and createElement/JSX render) work. `pick` must be a module-level
		* function (stable identity) — an inline lambda would re-trigger the load
		* effect on every render.
		* @param chunk - the chunk name (see chunk-loader.ts).
		* @param pick - select the component from the chunk's exports.
		*/
		function lazyChunkComponent(chunk, pick) {
			return (props) => (0, react.createElement)(LazyChunkView, {
				chunk,
				pick,
				props
			});
		}
		//#endregion
		//#region src/client/redact.ts
		/** The heuristics, applied in order; `$1` keeps the leading keyword where the
		*  rule matches an assignment shape. */
		const RULES = [
			{
				pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
				replacement: "[REDACTED PRIVATE KEY]"
			},
			{
				pattern: /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})\b/g,
				replacement: "[REDACTED KEY]"
			},
			{
				pattern: /([Aa]uthorization\s*:\s*)[^\n"']{4,}/g,
				replacement: "$1[REDACTED]"
			},
			{
				pattern: /\b([Bb]earer\s+)[A-Za-z0-9._-]{16,}\b/g,
				replacement: "$1[REDACTED]"
			},
			{
				pattern: /(\b[A-Za-z_-]*(?:password|passwd|secret|token|apikey|api_key)[A-Za-z_-]*(?:\s*[:=]\s*))['"]?[^\s"',;){]{3,}/gi,
				replacement: "$1[REDACTED]"
			}
		];
		/**
		* Mask credential-shaped strings in `text`. Best-effort by design: the goal
		* is to keep the common accident (a key echoed into a file the model wrote)
		* out of the sidebar, not to parse every secret format ever shipped.
		*/
		function redactSecrets(text) {
			let out = text;
			for (const rule of RULES) out = out.replace(rule.pattern, rule.replacement);
			return out;
		}
		//#endregion
		//#region src/client/SessionLens.tsx
		/**
		* The session lens: file operations the model performed in this session,
		* parsed from the session's own event log (`changes.ops`). Clicking a row
		* expands a best-effort text preview of the file (read through `fs.read`,
		* passed through the secret-redaction layer). Kept a leaf component — the
		* GitView hosts it as the "session changes" lens of the unified tab.
		*/
		/** Preview cap: a long file shows its head only (the sidebar is not an editor). */
		const PREVIEW_CHARS = 2e4;
		function SessionLens(props) {
			const { scope } = props;
			const [ops, setOps] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [openPath, setOpenPath] = (0, react.useState)(null);
			const [preview, setPreview] = (0, react.useState)(null);
			const [previewLoading, setPreviewLoading] = (0, react.useState)(false);
			const load = (0, react.useCallback)(async () => {
				setError(null);
				try {
					const result = await api.changesOps(scope);
					setOps(result.ops);
				} catch (reason) {
					setError(reason instanceof Error ? reason.message : String(reason));
				}
			}, [scope]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			/** Toggle one row's preview: fetch + redact on first open, cached after. */
			const togglePreview = (path) => {
				if (openPath === path) {
					setOpenPath(null);
					return;
				}
				setOpenPath(path);
				setPreview(null);
				setPreviewLoading(true);
				api.fsRead(scope, path).then((result) => {
					const text = result.kind === "text" ? redactSecrets(result.content) : t("changesBinary");
					setPreview(text.slice(0, PREVIEW_CHARS));
				}).catch((reason) => {
					setPreview(t("changesPreviewError", { message: reason instanceof Error ? reason.message : String(reason) }));
				}).finally(() => {
					setPreviewLoading(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.sessionLens,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.sessionLensBar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.sessionLensCount,
							children: ops === null ? t("loading") : t("changesCount", { count: ops.length })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("refresh"),
							title: t("refresh"),
							onClick: () => {
								load();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.sessionLensEmpty,
						children: error
					}),
					error === null && ops !== null && ops.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.sessionLensEmpty,
						children: t("changesEmpty")
					}),
					ops !== null && ops.map((op) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.sessionLensItem,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: sidebar_module_css_default.sessionLensRow,
							"aria-expanded": openPath === op.path,
							onClick: () => {
								togglePreview(op.path);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.sessionLensPath,
								title: op.path,
								children: op.path
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: sidebar_module_css_default.sessionLensMeta,
								children: [op.tool, op.count > 1 ? ` ×${op.count}` : ""]
							})]
						}), openPath === op.path && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.sessionLensPreview,
							children: previewLoading ? t("loading") : preview ?? ""
						})]
					}, op.path))
				]
			});
		}
		//#endregion
		//#region src/client/git-branch-model.ts
		/**
		* The name a row checks out. A local row checks out itself; a remote row
		* checks out its short name, which makes git create (or switch to) the local
		* tracking branch instead of landing on a detached HEAD.
		* @param row - the branch row a click landed on.
		* @returns the ref name to pass to `git checkout`.
		*/
		function trackingNameOf(row) {
			if (!row.remote) return row.name;
			const slash = row.name.indexOf("/");
			return slash === -1 ? row.name : row.name.slice(slash + 1);
		}
		/**
		* Case-insensitive substring filter over a branch list.
		* @param rows - every row, local first (the host's order is preserved).
		* @param query - the search box's raw value.
		* @returns the rows to render (the input array itself is never mutated).
		*/
		function filterBranches(rows, query) {
			const needle = query.trim().toLowerCase();
			if (needle === "") return [...rows];
			return rows.filter((row) => row.name.toLowerCase().includes(needle));
		}
		//#endregion
		//#region src/client/GitBranchView.tsx
		/**
		* The branch view of the source-control tab (ported from the retired
		* `@kkutysllb/dsh-git-panel` plugin).
		*
		* Local branches first (checked-out branch marked, upstream shown), then remote
		* branches as informational rows that check out their tracking short name.
		* Supports search, create-and-checkout, and delete with the panel's two-step
		* safety: a plain `branch -d` first, and — only when git refuses because the
		* branch is not fully merged — a second, explicitly confirmed force delete.
		*
		* The list is owned here (mount + `refreshKey`), so the parent's status/history
		* refresh never blocks on it; every mutation reports back through
		* {@link GitBranchViewProps.onChanged} and reloads the rows.
		*/
		function GitBranchView(props) {
			const { gitScope, worktree, busy, setBusy, onChanged, onError, refreshKey, active } = props;
			const [rows, setRows] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [query, setQuery] = (0, react.useState)("");
			/** The create-branch form's draft name (null while the form is closed). */
			const [newName, setNewName] = (0, react.useState)(null);
			/** The branch awaiting a safe-delete confirmation. */
			const [deleting, setDeleting] = (0, react.useState)(null);
			/** A safe delete git refused: the force escalation prompt. */
			const [forcing, setForcing] = (0, react.useState)(null);
			const gitScopeKey = `${gitScope.sessionId}\u0000${gitScope.cwd ?? ""}\u0000${gitScope.repoRoot ?? ""}\u0000${worktree ?? ""}`;
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				try {
					const result = await api.gitBranchRows(gitScope, worktree);
					setRows(result.rows);
				} catch (reason) {
					onError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setLoading(false);
				}
			}, [
				gitScopeKey,
				worktree,
				onError
			]);
			(0, react.useEffect)(() => {
				if (!active) return;
				load();
			}, [
				active,
				load,
				refreshKey
			]);
			const checkout = async (row) => {
				if (busy || row.current) return;
				setBusy(true);
				try {
					await api.gitCheckout(gitScope, trackingNameOf(row), worktree);
					await onChanged();
					await load();
				} catch (reason) {
					onError(`${t("checkoutError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			const create = async () => {
				const name = (newName ?? "").trim();
				if (name === "" || busy) return;
				setBusy(true);
				try {
					await api.gitBranchCreate(gitScope, name, worktree);
					setNewName(null);
					await onChanged();
					await load();
				} catch (reason) {
					onError(`${t("gitBranchCreateFailed")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			const remove = async (row, force) => {
				if (busy) return;
				setBusy(true);
				try {
					await api.gitBranchDelete(gitScope, row.name, force, worktree);
					setDeleting(null);
					setForcing(null);
					await load();
				} catch (reason) {
					if (!force && reason instanceof SidebarApiError && reason.code === "not-merged") {
						setDeleting(null);
						setForcing(row);
						return;
					}
					onError(`${t("gitBranchDeleteFailed")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			const shown = filterBranches(rows, query);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.gitBranchView,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitBranchToolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								className: sidebar_module_css_default.gitBranchSearch,
								placeholder: t("gitBranchSearch"),
								value: query,
								onChange: (event) => {
									setQuery(event.target.value);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("gitBranchNew"),
								title: t("gitBranchNew"),
								disabled: busy,
								onClick: () => {
									setNewName((current) => current === null ? "" : null);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("refresh"),
								title: t("refresh"),
								onClick: () => {
									load();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
							})
						]
					}),
					newName !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitBranchForm,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								className: sidebar_module_css_default.gitBranchSearch,
								placeholder: t("gitBranchNamePlaceholder"),
								value: newName,
								autoFocus: true,
								disabled: busy,
								onChange: (event) => {
									setNewName(event.target.value);
								},
								onKeyDown: (event) => {
									if (event.key === "Enter") create();
									if (event.key === "Escape") setNewName(null);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								disabled: busy || newName.trim() === "",
								onClick: () => {
									create();
								},
								children: t("gitBranchCreate")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("cancel"),
								title: t("cancel"),
								onClick: () => {
									setNewName(null);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
							})
						]
					}),
					loading && rows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: t("loading")
					}),
					!loading && shown.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitEmpty,
						children: query.trim() === "" ? t("noChanges") : t("gitBranchNoMatch")
					}),
					shown.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitBranchRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: sidebar_module_css_default.gitRowMain,
							title: row.upstream === null ? row.name : `${row.name} → ${row.upstream}`,
							disabled: busy || row.current,
							onClick: () => {
								checkout(row);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 13 }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.gitBranchName,
									children: row.name
								}),
								row.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.gitBranchBadge,
									children: t("gitBranchCurrent")
								}),
								row.remote && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.gitBranchMeta,
									children: t("gitBranchRemote")
								}),
								!row.remote && row.upstream !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.gitBranchMeta,
									children: t("gitBranchTracked", { upstream: row.upstream })
								})
							]
						}), !row.remote && !row.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("gitBranchDelete"),
							title: t("gitBranchDelete"),
							disabled: busy,
							onClick: () => {
								setDeleting(row);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
						})]
					}, `${row.remote ? "r" : "l"}:${row.name}`)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleting !== null,
						onClose: () => {
							setDeleting(null);
						},
						title: t("gitBranchDelete"),
						closeLabel: t("cancel"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setDeleting(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy,
							onClick: () => {
								const row = deleting;
								if (row === null) return;
								remove(row, false);
							},
							children: t("gitBranchDelete")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: sidebar_module_css_default.gitConfirmDesc,
							children: t("gitBranchDeleteDesc", { name: deleting?.name ?? "" })
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: forcing !== null,
						onClose: () => {
							setForcing(null);
						},
						title: t("gitBranchDeleteForce"),
						closeLabel: t("cancel"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setForcing(null);
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: busy,
							onClick: () => {
								const row = forcing;
								if (row === null) return;
								remove(row, true);
							},
							children: t("gitBranchDeleteForce")
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: clsx(sidebar_module_css_default.gitConfirmDesc, sidebar_module_css_default.gitConfirmDanger),
							children: t("gitBranchDeleteUnmerged", { name: forcing?.name ?? "" })
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/GitHubView.tsx
		/**
		* The GitHub section of the source-control tab (ported from the retired
		* `@kkutysllb/dsh-git-panel` plugin, v1.0.1).
		*
		* Open PRs and issues with counts, one-click PR creation (the host pushes the
		* branch and sets its upstream first when needed), squash/merge/rebase PR
		* merge behind an inline confirmation, and issue creation. `gh` is a soft
		* dependency: without the binary or a login the section degrades to an
		* explanation plus a re-probe button, and the rest of the git panel is
		* untouched.
		*
		* Loading is manual (open + refresh): the GitHub API is remote and rate
		* limited, so this section never joins the panel's 2s status poll.
		*/
		/** The merge strategies offered in the inline confirmation (gh flag names). */
		const METHODS = [
			"squash",
			"merge",
			"rebase"
		];
		/** Display label of one merge strategy (proper nouns, kept untranslated). */
		function methodLabel(method) {
			switch (method) {
				case "merge": return "Merge";
				case "rebase": return "Rebase";
				default: return "Squash";
			}
		}
		function GitHubView(props) {
			const { gitScope, worktree, busy, setBusy, onError, defaultBranch, active } = props;
			const [list, setList] = (0, react.useState)(null);
			const [probe, setProbe] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			/** The PR whose merge confirmation is open. */
			const [merging, setMerging] = (0, react.useState)(null);
			/** The chosen merge strategy for the open confirmation. */
			const [method, setMethod] = (0, react.useState)("squash");
			/** The create-PR form (null while closed). */
			const [prForm, setPrForm] = (0, react.useState)(null);
			/** The create-issue form (null while closed). */
			const [issueForm, setIssueForm] = (0, react.useState)(null);
			/** Post-action feedback: a created URL or a completion note. */
			const [notice, setNotice] = (0, react.useState)(null);
			const gitScopeKey = `${gitScope.sessionId}\u0000${gitScope.cwd ?? ""}\u0000${gitScope.repoRoot ?? ""}\u0000${worktree ?? ""}`;
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setNotice(null);
				try {
					const [listResult, probeResult] = await Promise.all([api.ghList(gitScope, worktree).catch((reason) => ({
						ok: false,
						error: reason instanceof Error ? reason.message : String(reason),
						repo: null,
						current: null,
						prs: [],
						issues: []
					})), api.ghProbe(gitScope).catch(() => ({
						installed: false,
						authenticated: false,
						account: null,
						version: null,
						error: "probe failed"
					}))]);
					setList(listResult);
					setProbe(probeResult);
				} finally {
					setLoading(false);
				}
			}, [gitScopeKey, worktree]);
			(0, react.useEffect)(() => {
				if (!active) return;
				load();
			}, [active, load]);
			const createPr = async () => {
				const form = prForm;
				if (form === null || busy || form.title.trim() === "") return;
				setBusy(true);
				try {
					const result = await api.ghCreatePr(gitScope, {
						title: form.title.trim(),
						body: form.body,
						base: form.base.trim(),
						draft: form.draft
					}, worktree);
					setPrForm(null);
					setNotice({
						text: t("ghCreatedPr"),
						url: result.url
					});
					await load();
				} catch (reason) {
					onError(`${t("ghCreatePrFailed")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			const createIssue = async () => {
				const form = issueForm;
				if (form === null || busy || form.title.trim() === "") return;
				setBusy(true);
				try {
					const result = await api.ghCreateIssue(gitScope, {
						title: form.title.trim(),
						body: form.body
					}, worktree);
					setIssueForm(null);
					setNotice({
						text: t("ghCreatedIssue"),
						url: result.url
					});
					await load();
				} catch (reason) {
					onError(`${t("ghCreateIssueFailed")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			const merge = async (number) => {
				if (busy) return;
				setBusy(true);
				try {
					await api.ghMergePr(gitScope, number, method, worktree);
					setMerging(null);
					setNotice({
						text: t("ghMerged", { number }),
						url: null
					});
					await load();
				} catch (reason) {
					onError(`${t("ghMergeFailed")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			/** One link action: a real anchor, so the plugin's link policy decides
			*  (HTTPS falls through to the system browser by default) and keyboard
			*  activation works for free. */
			const openLink = (url, label) => url === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
				className: sidebar_module_css_default.gitLink,
				href: url,
				target: "_blank",
				rel: "noreferrer noopener",
				children: label
			});
			const degraded = probe !== null && (!probe.installed || !probe.authenticated);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.gitGh,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitGhHeader,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitGhRepo,
								children: list?.repo ?? t("ghSection")
							}),
							list?.current !== null && list?.current !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitBranchBadge,
								children: list.current
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: sidebar_module_css_default.spacer }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("ghReprobe"),
								title: t("ghReprobe"),
								disabled: loading,
								onClick: () => {
									load();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
							})
						]
					}),
					(probe?.version !== null || probe?.account !== null) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitGhEnv,
						children: [
							t("ghEnv"),
							probe?.version !== null && probe?.version !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" · ", probe.version] }),
							probe?.account !== null && probe?.account !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" · ", probe.account] })
						]
					}),
					degraded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: [probe?.installed === false ? t("ghNotInstalled") : t("ghNotAuthenticated"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.gitGhHint,
							children: t("ghInstallHint")
						})]
					}),
					!degraded && loading && list === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: t("loading")
					}),
					!degraded && list !== null && !list.ok && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: [
							t("ghFailed"),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitGhHint,
								children: list.error
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								onClick: () => {
									load();
								},
								children: t("retry")
							})
						]
					}),
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitGhNotice,
						children: [notice.text, openLink(notice.url, ` ${t("ghOpen")}`)]
					}),
					!degraded && list !== null && list.ok && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitSection,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitSectionHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									t("ghOpenPrs"),
									" (",
									list.prs.length,
									")"
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: sidebar_module_css_default.gitLink,
									disabled: busy,
									onClick: () => {
										setPrForm((current) => current === null ? {
											title: "",
											body: "",
											base: defaultBranch ?? "",
											draft: false
										} : null);
									},
									children: t("ghCreatePr")
								})]
							}),
							list.prs.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitEmpty,
								children: t("ghNoPr")
							}),
							list.prs.map((pr) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitGhRow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: sidebar_module_css_default.gitGhNumber,
										children: ["#", pr.number]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.gitGhTitle,
										title: pr.title,
										children: pr.title
									}),
									pr.draft && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.gitBranchBadge,
										children: t("ghDraft")
									}),
									pr.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.gitBranchBadge,
										children: t("gitBranchCurrent")
									}),
									pr.author !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.gitBranchMeta,
										children: pr.author
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: sidebar_module_css_default.spacer }),
									openLink(pr.url, t("ghOpen")),
									!pr.draft && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLink,
										disabled: busy,
										onClick: () => {
											setMethod("squash");
											setMerging((current) => current === pr.number ? null : pr.number);
										},
										children: merging === pr.number ? t("cancel") : t("ghMerge")
									}),
									merging === pr.number && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: sidebar_module_css_default.gitGhMergeConfirm,
										children: [
											t("ghMergeConfirm", { number: pr.number }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												className: sidebar_module_css_default.gitGhMethod,
												value: method,
												"aria-label": t("ghMerge"),
												onChange: (event) => {
													setMethod(event.target.value);
												},
												children: METHODS.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: candidate,
													children: methodLabel(candidate)
												}, candidate))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												variant: "primary",
												disabled: busy,
												onClick: () => {
													merge(pr.number);
												},
												children: t("confirm")
											})
										]
									})
								]
							}, pr.number))
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitSection,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitSectionHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									t("ghOpenIssues"),
									" (",
									list.issues.length,
									")"
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: sidebar_module_css_default.gitLink,
									disabled: busy,
									onClick: () => {
										setIssueForm((current) => current === null ? {
											title: "",
											body: ""
										} : null);
									},
									children: t("ghCreateIssue")
								})]
							}),
							list.issues.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitEmpty,
								children: t("ghNoIssue")
							}),
							list.issues.map((issue) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitGhRow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: sidebar_module_css_default.gitGhNumber,
										children: ["#", issue.number]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.gitGhTitle,
										title: issue.title,
										children: issue.title
									}),
									issue.author !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.gitBranchMeta,
										children: issue.author
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: sidebar_module_css_default.spacer }),
									openLink(issue.url, t("ghOpen"))
								]
							}, issue.number))
						]
					})] }),
					prForm !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitGhForm,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitGhFormTitle,
								children: t("ghCreatePr")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								className: sidebar_module_css_default.gitGhInput,
								placeholder: t("ghPrTitle"),
								value: prForm.title,
								disabled: busy,
								onChange: (event) => {
									setPrForm((form) => form === null ? null : {
										...form,
										title: event.target.value
									});
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: sidebar_module_css_default.gitGhTextarea,
								placeholder: t("ghBody"),
								value: prForm.body,
								disabled: busy,
								rows: 3,
								onChange: (event) => {
									setPrForm((form) => form === null ? null : {
										...form,
										body: event.target.value
									});
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitGhFormRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									className: sidebar_module_css_default.gitGhInput,
									placeholder: defaultBranch ?? t("branch"),
									value: prForm.base,
									disabled: busy,
									onChange: (event) => {
										setPrForm((form) => form === null ? null : {
											...form,
											base: event.target.value
										});
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: sidebar_module_css_default.gitGhDraft,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: prForm.draft,
										disabled: busy,
										onChange: (event) => {
											setPrForm((form) => form === null ? null : {
												...form,
												draft: event.target.checked
											});
										}
									}), t("ghDraft")]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitGhFormRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: busy || prForm.title.trim() === "",
									onClick: () => {
										createPr();
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 14 }),
										" ",
										t("ghCreate")
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									onClick: () => {
										setPrForm(null);
									},
									children: t("cancel")
								})]
							})
						]
					}),
					issueForm !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitGhForm,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitGhFormTitle,
								children: t("ghCreateIssue")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								className: sidebar_module_css_default.gitGhInput,
								placeholder: t("ghIssueTitle"),
								value: issueForm.title,
								disabled: busy,
								onChange: (event) => {
									setIssueForm((form) => form === null ? null : {
										...form,
										title: event.target.value
									});
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: clsx(sidebar_module_css_default.gitGhTextarea),
								placeholder: t("ghBody"),
								value: issueForm.body,
								disabled: busy,
								rows: 3,
								onChange: (event) => {
									setIssueForm((form) => form === null ? null : {
										...form,
										body: event.target.value
									});
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitGhFormRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: busy || issueForm.title.trim() === "",
									onClick: () => {
										createIssue();
									},
									children: t("ghCreate")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									onClick: () => {
										setIssueForm(null);
									},
									children: t("cancel")
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/GitView.tsx
		/**
		* The source-control panel: status list (staged vs unstaged), stage/unstage,
		* commit with a message box, branch switch, and a VSCode-like history — rows
		* carry branch decorations, author and relative time. Clicking a changed
		* file or a history row opens a dedicated diff TAB (see {@link DiffTab}),
		* placed below the git pane on first use. File rows and history rows open a
		* right-click context menu with advanced operations (open in editor, discard,
		* revert, cherry-pick, copy paths/hashes). Refresh is manual + on mount/
		* focus. While visible it polls lightweight porcelain state so model-authored
		* file changes appear without a manual refresh.
		*/
		/** The XY status letters a row badge shows (X = index, Y = worktree). */
		function badgeOf(entry) {
			const index = entry.xy[0];
			const worktree = entry.xy[1];
			if (index !== void 0 && index !== " " && index !== "?") return index;
			if (worktree !== void 0 && worktree !== " " && worktree !== "?") return worktree;
			return "?";
		}
		/** Whether the entry carries STAGED (index) changes — the X letter is set. */
		function isStagedEntry(entry) {
			const index = entry.xy[0];
			return index !== void 0 && index !== " " && index !== "?";
		}
		/** Whether the entry carries UNSTAGED (worktree) changes — the Y letter is set
		*  (untracked `??` counts as unstaged: it is a worktree-only change). A file
		*  with both letters set ('MM') lands in BOTH sections. */
		function isUnstagedEntry(entry) {
			if (entry.xy === "??") return true;
			const worktree = entry.xy[1];
			return worktree !== void 0 && worktree !== " " && worktree !== "?";
		}
		/** Whether the entry is untracked (`??`): git diff never includes it. */
		function isUntracked(entry) {
			return badgeOf(entry) === "?";
		}
		/** The last path segment (tab title for a file's diff). */
		function baseName(path) {
			const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return at === -1 ? path : path.slice(at + 1);
		}
		/** The ref names of one log row's decorations (`HEAD -> main` → `main`), deduped. */
		function refNames(refs) {
			return [...new Set(refs.split(",").map((ref) => ref.trim()).filter((ref) => ref !== "").map((ref) => ref.includes(" -> ") ? ref.slice(ref.indexOf(" -> ") + 4) : ref).map((ref) => ref.startsWith("tag: ") ? ref.slice(5) : ref))];
		}
		/** History batch size: the log loads lazily in pages so a long history never
		*  floods the panel at once (the end of the log is reached by paging). */
		const LOG_BATCH = 20;
		function GitView(props) {
			const { scope, onOpenFile, onOpenDiff, visible } = props;
			const [lens, setLens] = (0, react.useState)("git");
			const lensToggle = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.changesLensToggle,
				role: "tablist",
				"aria-label": t("changesLens"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: clsx(sidebar_module_css_default.changesLensTab, lens === "git" && sidebar_module_css_default.changesLensTabActive),
					"aria-pressed": lens === "git",
					onClick: () => {
						setLens("git");
					},
					children: t("changesSessionGit")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: clsx(sidebar_module_css_default.changesLensTab, lens === "session" && sidebar_module_css_default.changesLensTabActive),
					"aria-pressed": lens === "session",
					onClick: () => {
						setLens("session");
					},
					children: t("changesSessionLens")
				})]
			});
			/** The Git lens' sub-view (the retired git panel's view switcher). */
			const [view, setView] = (0, react.useState)("changes");
			const [status, setStatus] = (0, react.useState)(null);
			/** Upstream distance + per-file line counts (loaded on demand, not on the 2s poll). */
			const [summary, setSummary] = (0, react.useState)(null);
			/** Bumped after a mutation so the child views re-read their own data. */
			const [branchRefreshKey, setBranchRefreshKey] = (0, react.useState)(0);
			/** The in-flight push (drives the button label). */
			const [pushing, setPushing] = (0, react.useState)(false);
			const [worktrees, setWorktrees] = (0, react.useState)([]);
			const [selectedWorktree, setSelectedWorktree] = (0, react.useState)();
			const [repoRoot, setRepoRoot] = (0, react.useState)(void 0);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [branchNames, setBranchNames] = (0, react.useState)([]);
			const [logEntries, setLogEntries] = (0, react.useState)([]);
			const [commitMsg, setCommitMsg] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [commitError, setCommitError] = (0, react.useState)(null);
			/** Whether the history was fully paged (a batch shorter than LOG_BATCH). */
			const [logEnded, setLogEnded] = (0, react.useState)(false);
			const [logLoadingMore, setLogLoadingMore] = (0, react.useState)(false);
			/** The open file-row context menu (cursor position for the portaled Menu). */
			const [fileMenu, setFileMenu] = (0, react.useState)(null);
			/** The open history-row context menu. */
			const [historyMenu, setHistoryMenu] = (0, react.useState)(null);
			/** The pending destructive action awaiting confirmation. */
			const [confirm, setConfirm] = (0, react.useState)(null);
			const refreshInFlight = (0, react.useRef)(false);
			/** Monotonic request id: a manual worktree switch invalidates any older poll
			*  before it can publish state from the previous checkout. */
			const refreshGeneration = (0, react.useRef)(0);
			const worktreeChosenByUser = (0, react.useRef)(false);
			/** selectedWorktree read inside refresh without re-creating the callback:
			*  avoids a spurious full refresh on every auto-select (the very state
			*  change refresh writes back via setSelectedWorktree would recreate the
			*  callback and re-trigger the mount effect — an N→N+1 fetch loop). */
			const selectedRef = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				selectedRef.current = selectedWorktree;
			}, [selectedWorktree]);
			const gitScope = repoRoot === void 0 ? scope : {
				...scope,
				repoRoot
			};
			/** Read the enrichment (upstream distance / line counts). Deliberately NOT
			*  part of the 2s status poll: it runs an extra diff plus untracked file
			*  reads, so it is refreshed on demand and after every mutation. */
			const refreshSummary = (0, react.useCallback)(async (target) => {
				try {
					const result = await api.gitSummary(gitScope, target ?? selectedRef.current);
					setSummary(result.summary);
				} catch {
					setSummary(null);
				}
			}, [
				scope.sessionId,
				scope.cwd,
				repoRoot
			]);
			/** Publish a complete checkout-derived view. Status, branch choices and
			*  history are one consistency unit: never mix rows from two worktrees. */
			const refreshTarget = (0, react.useCallback)(async (target, options) => {
				if (options.loading) setLoading(true);
				setError(null);
				try {
					const [statusResult, branchResult, logResult] = await Promise.all([
						api.gitStatus(gitScope, target),
						api.gitBranch(gitScope, target).catch(() => ({
							current: "",
							names: []
						})),
						api.gitLog(gitScope, LOG_BATCH, 0, target).catch(() => [])
					]);
					if (options.generation !== refreshGeneration.current) return;
					setStatus(statusResult);
					if (statusResult.root !== void 0 && statusResult.root !== repoRoot) setRepoRoot(statusResult.root);
					setBranchNames(branchResult.names);
					setLogEntries(logResult);
					setLogEnded(logResult.length < LOG_BATCH);
					if (statusResult.isRepo) refreshSummary(target);
				} catch (reason) {
					if (options.generation === refreshGeneration.current) setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					if (options.loading && options.generation === refreshGeneration.current) setLoading(false);
				}
			}, [
				scope.sessionId,
				scope.cwd,
				repoRoot,
				refreshSummary
			]);
			const refresh = (0, react.useCallback)(async (silent = false) => {
				if (refreshInFlight.current) return;
				refreshInFlight.current = true;
				let generation = refreshGeneration.current;
				try {
					const listed = await api.gitWorktrees(scope);
					if (generation !== refreshGeneration.current) return;
					setWorktrees(listed);
					let target = listed.some((entry) => entry.path === selectedRef.current) ? selectedRef.current : listed.find((entry) => entry.current)?.path;
					const current = listed.find((entry) => entry.current);
					const dirtyLinked = listed.filter((entry) => !entry.current && entry.changes > 0);
					if (!worktreeChosenByUser.current) target = (current?.changes ?? 0) === 0 && dirtyLinked.length === 1 ? dirtyLinked[0].path : current?.path;
					const targetChanged = target !== selectedRef.current;
					if (targetChanged) {
						generation = refreshGeneration.current += 1;
						selectedRef.current = target;
						setSelectedWorktree(target);
						setStatus(null);
						setBranchNames([]);
						setLogEntries([]);
						setLogEnded(false);
						setLogLoadingMore(false);
					}
					if (silent && !targetChanged) {
						const statusResult = await api.gitStatus(gitScope, target);
						if (generation === refreshGeneration.current) {
							setStatus(statusResult);
							api.gitSummary(gitScope, target).then((result) => {
								if (generation === refreshGeneration.current) setSummary(result.summary);
							}).catch(() => {});
						}
						return;
					}
					await refreshTarget(target, {
						loading: !silent,
						generation
					});
				} catch (reason) {
					if (generation === refreshGeneration.current) {
						setError(reason instanceof Error ? reason.message : String(reason));
						if (!silent) setLoading(false);
					}
				} finally {
					refreshInFlight.current = false;
				}
			}, [
				scope.sessionId,
				scope.cwd,
				refreshTarget
			]);
			(0, react.useEffect)(() => {
				refreshGeneration.current += 1;
				refreshInFlight.current = false;
				worktreeChosenByUser.current = false;
				selectedRef.current = void 0;
				setSelectedWorktree(void 0);
			}, [scope.sessionId, scope.cwd]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			/** A user choice invalidates any older poll and atomically refreshes every
			*  checkout-derived surface before destructive history actions can run. */
			const chooseWorktree = (target) => {
				worktreeChosenByUser.current = true;
				selectedRef.current = target;
				setSelectedWorktree(target);
				setStatus(null);
				setBranchNames([]);
				setLogEntries([]);
				setLogEnded(false);
				setLogLoadingMore(false);
				const generation = refreshGeneration.current += 1;
				refreshTarget(target, {
					loading: true,
					generation
				});
			};
			/** Switching the selected child repository must invalidate every
			*  target-derived surface (status/history/log) before the asynchronous
			*  refresh resolves; otherwise stale rows remain actionable while their
			*  handlers already address the new repository. Mirrors chooseWorktree. */
			const chooseRepo = (target) => {
				setRepoRoot(target);
				setStatus(null);
				setBranchNames([]);
				setLogEntries([]);
				setLogEnded(false);
				setLogLoadingMore(false);
				const generation = refreshGeneration.current += 1;
				refreshTarget(selectedRef.current ?? "", {
					loading: true,
					generation
				});
			};
			(0, react.useEffect)(() => {
				if (!visible) return;
				const timer = window.setInterval(() => {
					refresh(true);
				}, 2e3);
				return () => {
					window.clearInterval(timer);
				};
			}, [visible, refresh]);
			/** Append the next history page (lazy: only when the user asks for more). */
			const loadMoreLog = async () => {
				if (logLoadingMore || logEnded) return;
				const generation = refreshGeneration.current;
				const target = selectedRef.current;
				setLogLoadingMore(true);
				try {
					const next = await api.gitLog(gitScope, LOG_BATCH, logEntries.length, target);
					if (generation !== refreshGeneration.current || target !== selectedRef.current) return;
					setLogEntries((entries) => [...entries, ...next]);
					if (next.length < LOG_BATCH) setLogEnded(true);
				} catch (reason) {
					if (generation === refreshGeneration.current && target === selectedRef.current) setCommitError(`${t("historyLoadError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					if (generation === refreshGeneration.current && target === selectedRef.current) setLogLoadingMore(false);
				}
			};
			/** The diff tab for one changed file (one tab per path+side; same id = focused). */
			const openWorktreeDiff = (entry, staged) => {
				onOpenDiff({
					id: `diff:w:${encodeURIComponent(selectedWorktree ?? "")}:${staged ? "s" : "u"}:${entry.path}`,
					type: "diff",
					title: baseName(entry.path),
					diff: {
						kind: "worktree",
						path: entry.path,
						staged,
						untracked: isUntracked(entry),
						worktree: selectedWorktree,
						repoRoot
					}
				});
			};
			/** The diff tab for one commit (one tab per commit). */
			const openCommitDiff = (entry) => {
				onOpenDiff({
					id: `diff:c:${encodeURIComponent(selectedWorktree ?? "")}:${entry.hashFull}`,
					type: "diff",
					title: `${entry.hash} ${entry.subject}`,
					diff: {
						kind: "commit",
						hash: entry.hash,
						hashFull: entry.hashFull,
						subject: entry.subject,
						worktree: selectedWorktree,
						repoRoot
					}
				});
			};
			const stageEntry = async (entry, staged) => {
				setBusy(true);
				try {
					if (staged) await api.gitUnstage(gitScope, entry.path, selectedWorktree);
					else await api.gitStage(gitScope, entry.path, selectedWorktree);
					await refresh();
				} finally {
					setBusy(false);
				}
			};
			const stageAll = async (staged) => {
				setBusy(true);
				try {
					if (staged) await api.gitUnstage(gitScope, void 0, selectedWorktree);
					else await api.gitStage(gitScope, void 0, selectedWorktree);
					await refresh();
				} finally {
					setBusy(false);
				}
			};
			/**
			* Commit, optionally pushing afterwards (the retired panel's "提交或推送").
			*
			* Staging semantics follow that panel: with nothing staged but a dirty tree,
			* everything is staged first — a selective index is never overridden, since
			* only the "nothing staged yet" case auto-stages. `pushAfter` then pushes the
			* branch, setting its upstream when it has none.
			*/
			const commit = async (pushAfter = false) => {
				const message = commitMsg.trim();
				if (message === "" || busy) return;
				setBusy(true);
				setCommitError(null);
				try {
					if (stagedEntries.length === 0) await api.gitStage(gitScope, void 0, selectedWorktree);
					await api.gitCommit(gitScope, message, selectedWorktree);
					setCommitMsg("");
					if (pushAfter) await api.gitPush(gitScope, selectedWorktree);
					await refresh();
				} catch (reason) {
					setCommitError(`${pushAfter ? t("gitCommitPushFailed") : t("commitError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
					await refresh();
				} finally {
					setBusy(false);
				}
			};
			/** Push the current branch (the host sets an upstream when there is none). */
			const push = async () => {
				if (busy || pushing) return;
				setPushing(true);
				setCommitError(null);
				try {
					await api.gitPush(gitScope, selectedWorktree);
					await refresh();
				} catch (reason) {
					setCommitError(`${t("gitPushFailed")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setPushing(false);
				}
			};
			const checkout = async (branch) => {
				if (branch === status?.branch || busy) return;
				setBusy(true);
				setCommitError(null);
				try {
					await api.gitCheckout(gitScope, branch, selectedWorktree);
					await refresh();
				} catch (reason) {
					setCommitError(`${t("checkoutError")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				} finally {
					setBusy(false);
				}
			};
			/** Run one destructive operation after the confirm modal, then refresh. */
			const runConfirmed = (confirmState) => {
				setConfirm({
					...confirmState,
					onConfirm: async () => {
						setBusy(true);
						setCommitError(null);
						try {
							await confirmState.onConfirm();
							await refresh();
						} catch (reason) {
							setCommitError(reason instanceof Error ? reason.message : String(reason));
						} finally {
							setBusy(false);
						}
					}
				});
			};
			/** Copy `text` to the clipboard (best-effort; no visual feedback needed — the menu closes). */
			const copy = (text) => {
				(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(text);
			};
			const openFileMenu = (event, entry, staged) => {
				event.preventDefault();
				event.stopPropagation();
				setFileMenu({
					entry,
					staged,
					x: event.clientX,
					y: event.clientY
				});
			};
			const openHistoryMenu = (event, entry) => {
				event.preventDefault();
				event.stopPropagation();
				setHistoryMenu({
					entry,
					x: event.clientX,
					y: event.clientY
				});
			};
			const stagedEntries = (status?.entries ?? []).filter(isStagedEntry);
			const unstagedEntries = (status?.entries ?? []).filter(isUnstagedEntry);
			/** Per-path line counts keyed for the file rows (untracked files have none
			*  in git's numstat; the summary's totals still count their bodies). */
			const fileStats = new Map((summary?.files ?? []).map((file) => [file.path, file]));
			/** The upstream badge: distance and whether a push is pending. */
			const pendingPush = summary !== null && (!summary.hasUpstream || summary.ahead > 0);
			const viewSwitcher = status !== null && status.isRepo ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidebar_module_css_default.changesLensToggle,
				role: "tablist",
				"aria-label": t("git"),
				children: [
					"changes",
					"branches",
					"github"
				].map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: clsx(sidebar_module_css_default.changesLensTab, view === candidate && sidebar_module_css_default.changesLensTabActive),
					"aria-pressed": view === candidate,
					onClick: () => {
						setCommitError(null);
						setView(candidate);
					},
					children: candidate === "changes" ? t("gitViewChanges") : candidate === "branches" ? t("gitViewBranches") : t("ghSection")
				}, candidate))
			}) : null;
			const renderEntry = (entry, staged) => {
				const stat = fileStats.get(entry.path);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.gitRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: sidebar_module_css_default.gitRowMain,
						title: entry.path,
						onClick: () => {
							openWorktreeDiff(entry, staged);
						},
						onContextMenu: (event) => {
							openFileMenu(event, entry, staged);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitBadge,
								children: badgeOf(entry)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitName,
								children: entry.path
							}),
							stat !== void 0 && stat.added !== null && (stat.added > 0 || (stat.removed ?? 0) > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: sidebar_module_css_default.gitLineStat,
								children: [stat.added > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: sidebar_module_css_default.gitAdded,
									children: ["+", stat.added]
								}), (stat.removed ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: sidebar_module_css_default.gitRemoved,
									children: ["−", stat.removed]
								})]
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: sidebar_module_css_default.iconButton,
						"aria-label": staged ? t("unstage") : t("stage"),
						title: staged ? t("unstage") : t("stage"),
						disabled: busy,
						onClick: () => {
							stageEntry(entry, staged);
						},
						children: staged ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, {})
					})]
				}, `${staged ? "s" : "u"}:${entry.path}`);
			};
			if (lens === "session") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.git,
				children: [lensToggle, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionLens, { scope })]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.git,
				children: [
					lensToggle,
					viewSwitcher,
					commitError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitError,
						role: "status",
						children: [commitError, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("close"),
							title: t("close"),
							onClick: () => {
								setCommitError(null);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
						})]
					}),
					view === "branches" && status !== null && status.isRepo && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GitBranchView, {
						gitScope,
						worktree: selectedWorktree,
						busy,
						setBusy,
						onChanged: refresh,
						onError: setCommitError,
						refreshKey: branchRefreshKey,
						active: visible && view === "branches"
					}),
					view === "github" && status !== null && status.isRepo && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GitHubView, {
						gitScope,
						worktree: selectedWorktree,
						busy,
						setBusy,
						onError: setCommitError,
						defaultBranch: summary?.defaultBranch ?? null,
						active: visible && view === "github"
					}),
					view === "changes" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						worktrees.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.gitWorktreeRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitWorktreeLabel,
								children: t("worktree")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								className: sidebar_module_css_default.gitBranchSelect,
								value: selectedWorktree ?? "",
								title: selectedWorktree,
								disabled: busy,
								onChange: (event) => {
									chooseWorktree(event.target.value);
								},
								children: worktrees.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: entry.path,
									children: [
										entry.branch,
										" · ",
										baseName(entry.path),
										" (",
										entry.changes,
										")"
									]
								}, entry.path))
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.gitHeader,
							children: [
								(status?.repositories?.length ?? 0) > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: sidebar_module_css_default.gitBranchSelect,
									value: repoRoot ?? "",
									title: repoRoot,
									onChange: (event) => {
										chooseRepo(event.target.value);
									},
									disabled: busy,
									children: status.repositories.map((root) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: root,
										children: baseName(root)
									}, root))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: sidebar_module_css_default.gitBranchSelect,
									value: status?.branch ?? "",
									onChange: (event) => {
										checkout(event.target.value);
									},
									disabled: busy || status !== null && !status.isRepo,
									children: [(status?.branch ?? "") !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: status.branch,
										children: status.branch
									}), branchNames.filter((name) => name !== status?.branch).map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: name,
										children: name
									}, name))]
								}),
								summary !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.gitUpstream,
									title: summary.remoteUrl ?? void 0,
									children: summary.hasUpstream ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										summary.ahead > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: sidebar_module_css_default.gitAhead,
											title: t("gitAhead", { n: summary.ahead }),
											children: ["↑", summary.ahead]
										}),
										summary.behind > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: sidebar_module_css_default.gitBehind,
											title: t("gitBehind", { n: summary.behind }),
											children: ["↓", summary.behind]
										}),
										summary.ahead === 0 && summary.behind === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: sidebar_module_css_default.gitSynced,
											children: t("gitPushed")
										}),
										summary.ahead > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: sidebar_module_css_default.gitPending,
											children: t("gitPendingPush")
										})
									] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.gitPending,
										children: t("gitNoUpstream")
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: sidebar_module_css_default.iconButton,
									"aria-label": t("refresh"),
									title: t("refresh"),
									onClick: () => {
										refresh();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
								})
							]
						}),
						loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.gitPlaceholder,
							children: t("loading")
						}),
						!loading && error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.gitError,
							children: error
						}),
						!loading && status !== null && !status.isRepo && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.gitPlaceholder,
							children: t("notRepo")
						}),
						status !== null && status.isRepo && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							status.truncated === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: sidebar_module_css_default.gitEmpty,
								children: t("statusTruncated")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitSection,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: sidebar_module_css_default.gitSectionHeader,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t("staged"),
											" (",
											stagedEntries.length,
											")"
										] }), stagedEntries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: sidebar_module_css_default.gitLink,
											disabled: busy,
											onClick: () => {
												stageAll(true);
											},
											children: t("unstageAll")
										})]
									}),
									stagedEntries.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: sidebar_module_css_default.gitEmpty,
										children: t("noChanges")
									}),
									stagedEntries.map((entry) => renderEntry(entry, true))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitSection,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: sidebar_module_css_default.gitSectionHeader,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t("unstaged"),
											" (",
											unstagedEntries.length,
											")"
										] }), unstagedEntries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: sidebar_module_css_default.gitLink,
											disabled: busy,
											onClick: () => {
												stageAll(false);
											},
											children: t("stageAll")
										})]
									}),
									unstagedEntries.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: sidebar_module_css_default.gitEmpty,
										children: t("noChanges")
									}),
									unstagedEntries.map((entry) => renderEntry(entry, false))
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitCommit,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									className: sidebar_module_css_default.gitCommitInput,
									placeholder: t("commitPlaceholder"),
									value: commitMsg,
									disabled: busy,
									onChange: (event) => {
										setCommitMsg(event.target.value);
										setCommitError(null);
									},
									onKeyDown: (event) => {
										if ((event.ctrlKey || event.metaKey) && event.key === "Enter") commit();
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: sidebar_module_css_default.gitCommitButton,
									disabled: busy || commitMsg.trim() === "" || stagedEntries.length === 0 && unstagedEntries.length === 0,
									onClick: () => {
										commit();
									},
									children: t("commit")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitPushRow,
								children: [
									summary !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: sidebar_module_css_default.gitLineStat,
										children: [
											summary.untracked > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitUntracked,
												children: t("gitUntracked", { n: summary.untracked })
											}),
											summary.added > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: sidebar_module_css_default.gitAdded,
												children: ["+", summary.added]
											}),
											summary.removed > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: sidebar_module_css_default.gitRemoved,
												children: ["−", summary.removed]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: sidebar_module_css_default.spacer }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLink,
										disabled: busy || pushing || commitMsg.trim() === "" || stagedEntries.length === 0 && unstagedEntries.length === 0,
										title: t("gitCommitPush"),
										onClick: () => {
											commit(true);
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 13 }),
											" ",
											t("gitCommitPush")
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLink,
										disabled: busy || pushing || !pendingPush,
										title: t("gitPush"),
										onClick: () => {
											push();
										},
										children: pushing ? t("gitPushing") : t("gitPush")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: sidebar_module_css_default.gitSection,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: sidebar_module_css_default.gitSectionHeader,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("history") })
									}),
									logEntries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										role: "button",
										tabIndex: 0,
										className: sidebar_module_css_default.gitLogRow,
										title: `${entry.author} · ${entry.date}\n${entry.hashFull}`,
										onClick: () => {
											openCommitDiff(entry);
										},
										onKeyDown: (event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												openCommitDiff(entry);
											}
										},
										onContextMenu: (event) => {
											openHistoryMenu(event, entry);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: sidebar_module_css_default.gitLogLine1,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitLogHash,
												children: entry.hash
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitLogSubject,
												children: entry.subject
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: sidebar_module_css_default.gitLogLine2,
											children: [refNames(entry.refs).map((ref) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: sidebar_module_css_default.gitLogRef,
												children: ref
											}, ref)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: sidebar_module_css_default.gitLogMeta,
												children: [
													entry.author,
													" · ",
													relativeTime(entry.date)
												]
											})]
										})]
									}, entry.hashFull)),
									!logEnded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.gitLogMore,
										disabled: logLoadingMore || busy,
										onClick: () => {
											loadMoreLog();
										},
										children: logLoadingMore ? t("loading") : t("loadMore")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: fileMenu !== null,
								onClose: () => {
									setFileMenu(null);
								},
								items: [
									...fileMenu !== null && isWithinWorkspace(scope.cwd ?? "", resolveSidebarPath(repoRoot ?? selectedWorktree ?? scope.cwd, fileMenu.entry.path)) ? [{
										id: "open",
										label: t("openEditor"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 })
									}] : [],
									fileMenu?.staged === true ? {
										id: "stage",
										label: t("unstage"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
									} : {
										id: "stage",
										label: t("stage"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, { size: 14 })
									},
									...fileMenu !== null && !isUntracked(fileMenu.entry) ? [{
										id: "discard",
										label: t("discard"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }),
										danger: true
									}] : [],
									{
										type: "separator",
										id: "sep1"
									},
									{
										id: "relative",
										label: t("copyRelative"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 })
									},
									{
										id: "absolute",
										label: t("copyAbsolute"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 })
									}
								],
								onSelect: (id) => {
									const target = fileMenu;
									if (target === null) return;
									setFileMenu(null);
									if (id === "open") {
										const resolved = resolveSidebarPath(repoRoot ?? selectedWorktree ?? scope.cwd, target.entry.path);
										if (!isWithinWorkspace(scope.cwd ?? "", resolved)) return;
										onOpenFile(resolved);
										return;
									}
									if (id === "stage") {
										stageEntry(target.entry, target.staged);
										return;
									}
									if (id === "discard") {
										runConfirmed({
											title: t("discardTitle"),
											description: t("discardDesc", { path: target.entry.path }),
											confirmLabel: t("discard"),
											onConfirm: () => api.gitDiscard(gitScope, target.entry.path, selectedWorktree)
										});
										return;
									}
									if (id === "relative") {
										copy(relativeTo(repoRoot ?? selectedWorktree ?? scope.cwd ?? "", target.entry.path));
										return;
									}
									if (id === "absolute") copy(resolveSidebarPath(repoRoot ?? selectedWorktree ?? scope.cwd, target.entry.path));
								},
								portal: true,
								align: "start",
								getAnchorRect: () => fileMenu === null ? null : new DOMRect(fileMenu.x, fileMenu.y, 0, 0),
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: historyMenu !== null,
								onClose: () => {
									setHistoryMenu(null);
								},
								items: [
									{
										id: "view",
										label: t("viewCommitDiff")
									},
									{
										id: "copyShort",
										label: t("copyShortHash"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 })
									},
									{
										id: "copyFull",
										label: t("copyFullHash"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 })
									},
									{
										id: "copySubject",
										label: t("copySubject"),
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, { size: 14 })
									},
									{
										type: "separator",
										id: "sep2"
									},
									{
										id: "revert",
										label: t("revertCommit"),
										danger: true
									},
									{
										id: "cherryPick",
										label: t("cherryPickCommit"),
										danger: true
									}
								],
								onSelect: (id) => {
									const target = historyMenu;
									if (target === null) return;
									setHistoryMenu(null);
									if (id === "view") {
										openCommitDiff(target.entry);
										return;
									}
									if (id === "copyShort") {
										copy(target.entry.hash);
										return;
									}
									if (id === "copyFull") {
										copy(target.entry.hashFull);
										return;
									}
									if (id === "copySubject") {
										copy(target.entry.subject);
										return;
									}
									if (id === "revert") {
										runConfirmed({
											title: t("revertTitle"),
											description: t("revertDesc", { subject: target.entry.subject }),
											confirmLabel: t("revertCommit"),
											onConfirm: () => api.gitRevert(gitScope, target.entry.hashFull, selectedWorktree)
										});
										return;
									}
									if (id === "cherryPick") runConfirmed({
										title: t("cherryPickTitle"),
										description: t("cherryPickDesc", { subject: target.entry.subject }),
										confirmLabel: t("cherryPickCommit"),
										onConfirm: () => api.gitCherryPick(gitScope, target.entry.hashFull, selectedWorktree)
									});
								},
								portal: true,
								align: "start",
								getAnchorRect: () => historyMenu === null ? null : new DOMRect(historyMenu.x, historyMenu.y, 0, 0),
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
								open: confirm !== null,
								onClose: () => {
									setConfirm(null);
								},
								title: confirm?.title ?? "",
								closeLabel: t("cancel"),
								footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									onClick: () => {
										setConfirm(null);
									},
									children: t("cancel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: busy,
									onClick: () => {
										const pending = confirm;
										if (pending === null) return;
										setConfirm(null);
										pending.onConfirm();
									},
									children: confirm?.confirmLabel ?? ""
								})] }),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: sidebar_module_css_default.gitConfirmDesc,
									children: confirm?.description
								})
							})
						] })
					] })
				]
			});
		}
		//#endregion
		//#region src/client/ScheduleTaskPreview.tsx
		/**
		* The scheduled-task preview the 「任务计划」 tab shows when the engine opens that
		* tab for one task.
		*
		* Both schedule surfaces that used to expand the right Sidebar column — the
		* schedule Turn card's 打开 and the Session header's task menu — navigate here
		* instead: expanding that column costs the transcript a whole column of width,
		* and this panel is already the workbench the user is in. The navigation carries
		* identity only (`{ sessionId, taskId }`, written into the tab's `meta`), and the
		* panel reads the task itself through the schedule Remote, so the engine side
		* owns no product data and this preview keeps up with the task.
		*
		* The Remote face is looked up optionally and never injected: the schedule
		* plugins are opt-in upstream (KCoder's product policy layer turns them on), and
		* a profile without them must keep the plans list working and only report that
		* the task cannot be read.
		*
		* @module dsh-coding-sidebar/client/ScheduleTaskPreview
		*/
		/**
		* Read the preview target out of a tab's `meta`.
		*
		* Absent means this tab was opened as the ordinary plans list (the + menu, or
		* any open without the marker) — the preview then takes no room at all.
		* @param meta - the tab's `meta` value as the sidebar stored it.
		* @returns The target, or null when the tab carries none.
		*/
		function readScheduleTaskTarget(meta) {
			if (typeof meta !== "object" || meta === null) return null;
			const raw = meta.kcScheduleTask;
			if (typeof raw !== "object" || raw === null) return null;
			const { sessionId, taskId } = raw;
			return typeof sessionId === "string" && typeof taskId === "string" ? {
				sessionId,
				taskId
			} : null;
		}
		/** One record out of a `schedule.list` answer, or null when it is not there. */
		function pickTask(result, taskId) {
			const value = result?.value;
			if (!Array.isArray(value)) return null;
			return value.find((record) => record.id === taskId) ?? null;
		}
		/** Local rendering of the stored UTC instant; null when it cannot be parsed. */
		function nextFire(iso) {
			if (iso === void 0) return null;
			const at = Date.parse(iso);
			return Number.isNaN(at) ? null : new Date(at).toLocaleString();
		}
		/** The cadence line: `every` states its own interval, the rest name their rule. */
		function cadence(task) {
			if (task.kind === "every" && typeof task.everySeconds === "number") {
				const seconds = task.everySeconds;
				if (seconds % 3600 === 0) return t("schedEveryHours", { n: seconds / 3600 });
				if (seconds % 60 === 0) return t("schedEveryMinutes", { n: seconds / 60 });
				return t("schedEverySeconds", { n: seconds });
			}
			switch (task.kind) {
				case "at": return t("schedKindAt");
				case "after": return t("schedKindAfter");
				case "daily": return t("schedKindDaily");
				case "weekly": return t("schedKindWeekly");
				case "cron": return t("schedKindCron");
				case "legacy": return t("schedKindLegacy");
				case "every": return t("schedKindEvery");
				default: return null;
			}
		}
		function ScheduleTaskPreview(props) {
			const { ctx, target, visible, onDismiss } = props;
			const [task, setTask] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const targetKey = `${target.sessionId}\u0000${target.taskId}`;
			(0, react.useEffect)(() => {
				if (!visible) return;
				let cancelled = false;
				const load = async (face) => {
					if (cancelled) return;
					setLoading(true);
					try {
						const list = face?.list;
						if (list === void 0) {
							setTask(null);
							setError(t("schedUnavailable"));
							return;
						}
						const result = await list({ sessionId: target.sessionId });
						if (cancelled) return;
						const found = pickTask(result, target.taskId);
						setTask(found);
						setError(found === null ? t("schedGone") : null);
					} catch (reason) {
						if (cancelled) return;
						setTask(null);
						setError(`${t("schedLoadFailed")}: ${reason instanceof Error ? reason.message : String(reason)}`);
					} finally {
						if (!cancelled) setLoading(false);
					}
				};
				const fiber = ctx.inject(["remote.schedule"], (scoped) => {
					const face = scoped.remote?.schedule;
					load(face);
				});
				return () => {
					cancelled = true;
					fiber.dispose?.();
				};
			}, [
				ctx,
				targetKey,
				visible
			]);
			const cadenceText = task === null ? null : cadence(task);
			const next = task === null ? null : nextFire(task.scheduledAt);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: sidebar_module_css_default.schedPreview,
				"data-schedule-preview": target.taskId,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.schedPreviewHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.schedPreviewTitle,
							children: task?.title ?? t("schedPreviewTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.schedPreviewClose,
							"aria-label": t("schedPreviewClose"),
							title: t("schedPreviewClose"),
							onClick: onDismiss,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitError,
						role: "status",
						children: error
					}),
					loading && task === null && error === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: t("loading")
					}),
					task !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						cadenceText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.schedPreviewRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.schedPreviewLabel,
								children: t("schedCadence")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.schedPreviewValue,
								children: cadenceText
							})]
						}),
						next !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.schedPreviewRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.schedPreviewLabel,
								children: t("schedNext")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.schedPreviewValue,
								children: next
							})]
						}),
						task.prompt !== void 0 && task.prompt !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidebar_module_css_default.schedPreviewRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.schedPreviewLabel,
								children: t("schedPrompt")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.schedPreviewPrompt,
								children: task.prompt
							})]
						})
					] })
				]
			});
		}
		//#endregion
		//#region src/client/PlansView.tsx
		/**
		* The task-plan tab: the workspace's agent-authored plan documents (the
		* retired `@kkutysllb/dsh-git-panel` plugin's 任务计划 section, promoted from a
		* block inside its card to a page of its own).
		*
		* The rows come from the host's plan convention (`plans/`, `docs/plans/`,
		* `.plans/` one level down, plus `plan.md` / `PLAN.md` / `docs/plan.md`) and
		* are newest-first. The primary click opens the document in the sidebar's own
		* editor tab — the exact hand-off the retired panel preferred when the sidebar
		* was present (its `open-plan` system launch was only the fallback, and stays
		* available here as the row's secondary action, contained to the workspace on
		* the host side).
		*
		* The list refreshes on mount, whenever the tab becomes visible again, every
		* few seconds while it IS visible (a plan is being rewritten under the user's
		* eyes during a run), and on demand through the toolbar button.
		*/
		/** While the tab is on screen, re-scan the plan convention this often. */
		const POLL_MS$1 = 4e3;
		/** Format a document mtime with the panel's shared relative-time copy. */
		function when(ms) {
			return relativeTime(new Date(ms).toISOString());
		}
		function PlansView(props) {
			const { scope, visible, onOpenFile, scheduleTask } = props;
			const [docs, setDocs] = (0, react.useState)([]);
			/** The host's cap, echoed back so a truncated list can say so. */
			const [limit, setLimit] = (0, react.useState)(0);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const scopeKey = `${scope.sessionId}\u0000${scope.cwd ?? ""}`;
			const load = (0, react.useCallback)(async (silent = false) => {
				if (!silent) setLoading(true);
				try {
					const result = await api.plansList(scope);
					setDocs(result.plans);
					setLimit(result.limit);
					setError(null);
				} catch (reason) {
					setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					setLoading(false);
				}
			}, [scopeKey]);
			(0, react.useEffect)(() => {
				if (!visible) return;
				load();
			}, [visible, load]);
			(0, react.useEffect)(() => {
				if (!visible) return;
				const timer = window.setInterval(() => {
					load(true);
				}, POLL_MS$1);
				return () => {
					window.clearInterval(timer);
				};
			}, [visible, load]);
			/** Hand one document to the OS default application (the host fences it to
			*  the workspace and to text documents). */
			const openInApp = async (doc) => {
				try {
					await api.plansOpen(scope, doc.path);
				} catch (reason) {
					setError(`${t("plansOpenFailed")}: ${reason instanceof Error ? reason.message : String(reason)}`);
				}
			};
			const shown = (0, react.useMemo)(() => {
				const needle = query.trim().toLowerCase();
				if (needle === "") return docs;
				return docs.filter((doc) => doc.title.toLowerCase().includes(needle) || doc.rel.toLowerCase().includes(needle));
			}, [docs, query]);
			const filtering = query.trim() !== "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.plansView,
				children: [
					scheduleTask !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ScheduleTaskPreview, {
						ctx: props.ctx,
						target: scheduleTask,
						visible,
						onDismiss: props.onDismissSchedule
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.plansToolbar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							className: sidebar_module_css_default.plansSearch,
							placeholder: t("plansSearch"),
							value: query,
							onChange: (event) => {
								setQuery(event.target.value);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("refresh"),
							title: t("refresh"),
							onClick: () => {
								load();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitError,
						role: "status",
						children: error
					}),
					loading && docs.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: t("loading")
					}),
					!loading && shown.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.plansEmpty,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: filtering ? t("plansNoMatch") : t("plansEmpty") }), !filtering && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.plansHint,
							children: t("plansHint")
						})]
					}),
					shown.map((doc) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.plansRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: sidebar_module_css_default.plansRowMain,
							title: doc.path,
							onClick: () => {
								onOpenFile(doc.path);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.plansGlyph,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutlineRegular, { size: 14 })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: sidebar_module_css_default.plansText,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: sidebar_module_css_default.plansTitle,
									children: doc.title
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: sidebar_module_css_default.plansMeta,
									children: [
										doc.rel,
										" · ",
										when(doc.mtimeMs)
									]
								})]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("plansOpenInApp"),
							title: t("plansOpenInApp"),
							onClick: () => {
								openInApp(doc);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 14 })
						})]
					}, doc.path)),
					limit > 0 && docs.length >= limit && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.plansHint,
						children: t("plansCapped", { n: limit })
					})
				]
			});
		}
		//#endregion
		//#region src/client/DiffView.tsx
		/**
		* The real diff surface for the git panel: parses the host's unified diff
		* text (`git diff` / `git show`) and renders it VSCode-style — per-file
		* sections with hunks (`@@ -a,b +c,d @@` headers), old/new line-number
		* gutters, and aligned context / deleted / added rows colored through the
		* DSH tokens. Untracked files produce no `git diff` output, so the caller
		* can pass the file content to render as a full-file addition instead.
		*
		* The parser is a pure function (`parseUnifiedDiff`) so the interesting
		* cases are unit-tested without a DOM.
		*/
		/** Parse the hunk header `@@ -a[,b] +c[,d] @@ section` (section may contain '@@'). */
		function parseHunkHeader(line) {
			const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line);
			if (match === null) return null;
			return {
				oldStart: Number(match[1]),
				newStart: Number(match[3]),
				header: match[5] ?? ""
			};
		}
		/**
		* Parse `git diff --no-color` output into file sections and hunks. Rows
		* outside a file section (leading noise) and metadata rows between the
		* `diff --git`/`---`/`+++` headers and the first hunk (index lines, mode
		* changes, rename/similarity lines) are skipped; a section that never
		* reaches a hunk (a mode/rename-only change) stays hunkless so the caller
		* can still draw its path.
		*/
		function parseUnifiedDiff(text) {
			const files = [];
			let current = null;
			let inHunk = false;
			let hunk = null;
			let oldNum = 0;
			let newNum = 0;
			const flushHunk = () => {
				if (current !== null && hunk !== null) current.hunks.push(hunk);
				hunk = null;
				inHunk = false;
			};
			for (const raw of text.split("\n")) {
				if (raw.startsWith("diff --git ")) {
					flushHunk();
					current = {
						oldPath: "",
						newPath: "",
						binary: false,
						hunks: []
					};
					files.push(current);
					continue;
				}
				if (current === null) continue;
				if (raw.startsWith("Binary files ") || raw === "GIT binary patch") {
					flushHunk();
					current.binary = true;
					continue;
				}
				if (raw.startsWith("--- ")) {
					flushHunk();
					current.oldPath = raw.slice(4);
					continue;
				}
				if (raw.startsWith("+++ ")) {
					current.newPath = raw.slice(4);
					continue;
				}
				const header = parseHunkHeader(raw);
				if (header !== null) {
					flushHunk();
					hunk = {
						oldStart: header.oldStart,
						newStart: header.newStart,
						header: header.header,
						lines: []
					};
					oldNum = header.oldStart;
					newNum = header.newStart;
					inHunk = true;
					continue;
				}
				if (!inHunk || hunk === null) continue;
				const marker = raw[0];
				if (marker === "\\") {
					hunk.lines.push({
						kind: "meta",
						text: raw.slice(1),
						oldNum: null,
						newNum: null
					});
					continue;
				}
				if (marker === " ") {
					hunk.lines.push({
						kind: "ctx",
						text: raw.slice(1),
						oldNum,
						newNum
					});
					oldNum += 1;
					newNum += 1;
				} else if (marker === "-") {
					hunk.lines.push({
						kind: "del",
						text: raw.slice(1),
						oldNum,
						newNum: null
					});
					oldNum += 1;
				} else if (marker === "+") {
					hunk.lines.push({
						kind: "add",
						text: raw.slice(1),
						oldNum: null,
						newNum
					});
					newNum += 1;
				} else flushHunk();
			}
			flushHunk();
			return { files };
		}
		/** Build the untracked-file shape: one file, one hunk of pure additions. */
		function untrackedFile(path, content) {
			const lines = [];
			const body = content.endsWith("\n") ? content.slice(0, -1) : content;
			if (body !== "") {
				let num = 1;
				for (const line of body.split("\n")) {
					lines.push({
						kind: "add",
						text: line,
						oldNum: null,
						newNum: num
					});
					num += 1;
				}
			}
			return {
				oldPath: "/dev/null",
				newPath: `b/${path}`,
				binary: false,
				hunks: [{
					oldStart: 0,
					newStart: 1,
					header: "",
					lines
				}]
			};
		}
		/** Strip the `a/` / `b/` prefix git puts on diff paths (not on /dev/null). */
		function displayPath(path) {
			if (path === "/dev/null") return path;
			if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
			return path;
		}
		/** How many old-side rows a hunk carries (rows without an old number are
		*  pure additions and do not advance the old side). */
		function hunkOldEnd(hunk) {
			return hunk.oldStart + hunk.lines.filter((line) => line.oldNum !== null).length - 1;
		}
		/** How many new-side rows a hunk carries. */
		function hunkNewEnd(hunk) {
			return hunk.newStart + hunk.lines.filter((line) => line.newNum !== null).length - 1;
		}
		/**
		* Materialize a git gap fold's hidden rows from the two sides' full file
		* contents, by the fold's known line ranges: the old side drives context
		* rows (each mapped onto the new side through the fold's offset — a gap is
		* an unchanged run, so the sides align), and new-side lines the old range
		* never reaches become pure additions. Line numbers clip to the actual
		* content (a no-newline file's ranges can overrun by one); `\r` endings
		* survive verbatim, like git's own context lines.
		*/
		function foldRowsFromContents(fold, oldContent, newContent) {
			const oldLines = oldContent.length === 0 ? [] : oldContent.split("\n");
			const newLines = newContent.length === 0 ? [] : newContent.split("\n");
			const offset = fold.newStart - fold.oldStart;
			const rows = [];
			const oldFrom = Math.max(fold.oldStart, 1);
			const oldTo = Math.min(fold.oldEnd, oldLines.length);
			for (let oldLine = oldFrom; oldLine <= oldTo; oldLine += 1) {
				const text = oldLines[oldLine - 1] ?? "";
				const newLine = oldLine + offset;
				rows.push(newLine >= fold.newStart && newLine <= fold.newEnd && newLine <= newLines.length ? {
					kind: "ctx",
					text,
					oldNum: oldLine,
					newNum: newLine
				} : {
					kind: "ctx",
					text,
					oldNum: oldLine,
					newNum: null
				});
			}
			const newFrom = Math.max(Math.max(fold.newStart, 1), oldTo + offset + 1);
			const newTo = Math.min(fold.newEnd, newLines.length);
			for (let newLine = newFrom; newLine <= newTo; newLine += 1) rows.push({
				kind: "add",
				text: newLines[newLine - 1] ?? "",
				oldNum: null,
				newNum: newLine
			});
			return rows;
		}
		/** The file header badge: added / deleted / renamed / binary ('' for a plain edit). */
		function fileTag(file) {
			if (file.binary) return t("diffBinary");
			if (file.oldPath === "/dev/null") return t("diffAdded");
			if (file.newPath === "/dev/null") return t("diffDeleted");
			if (displayPath(file.oldPath) !== displayPath(file.newPath)) return t("diffRenamed");
			return null;
		}
		/** Cap the flattened rows like DiffBlock: head + tail, expand button between. */
		const MAX_DIFF_ROWS = 500;
		const TEST_PATH = /(^|\/)(?:__tests__|tests?|specs?|fixtures?|mocks?|snapshots?)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i;
		const DOC_PATH = /(^|\/)(?:docs?|documentation)(?:\/|$)|(^|\/)(?:readme|changelog|contributing|license|authors|notice)(?:\.[^/]*)?$/i;
		const GENERATED_PATH = /(^|\/)(?:dist|build|coverage|generated|vendor|node_modules)(?:\/|$)|(^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|composer\.lock|cargo\.lock|poetry\.lock)$/i;
		const SOURCE_PATH = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts|py|pyw|rb|php|java|kt|kts|scala|go|rs|swift|c|h|cc|cpp|cxx|hpp|hh|hxx|cs|fs|fsx|vb|dart|lua|r|ex|exs|erl|hrl|clj|cljs|cljc|groovy|sh|bash|zsh|fish|ps1|sql|vue|svelte|astro|html|htm|css|scss|sass|less)$/i;
		/** Source files open by default; tests, docs, generated files and unknown types stay folded. */
		function defaultExpandedFiles(files) {
			const expanded = /* @__PURE__ */ new Set();
			files.forEach((file, index) => {
				const path = displayPath(file.newPath === "/dev/null" ? file.oldPath : file.newPath);
				if (!file.binary && file.hunks.length > 0 && !TEST_PATH.test(path) && !DOC_PATH.test(path) && !GENERATED_PATH.test(path) && SOURCE_PATH.test(path)) expanded.add(index);
			});
			return expanded;
		}
		function DiffView({ diff, untrackedPath, untrackedContent, foldSource }) {
			const parsed = (0, react.useMemo)(() => {
				if (untrackedPath !== void 0) return { files: [untrackedFile(untrackedPath, untrackedContent ?? "")] };
				return parseUnifiedDiff(diff);
			}, [
				diff,
				untrackedPath,
				untrackedContent
			]);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [expandedFiles, setExpandedFiles] = (0, react.useState)(() => defaultExpandedFiles(parsed.files));
			const [foldRows, setFoldRows] = (0, react.useState)(/* @__PURE__ */ new Map());
			const foldInflight = (0, react.useRef)(/* @__PURE__ */ new Map());
			(0, react.useEffect)(() => {
				setExpandedFiles(defaultExpandedFiles(parsed.files));
			}, [parsed]);
			(0, react.useEffect)(() => {
				setFoldRows(/* @__PURE__ */ new Map());
				foldInflight.current.clear();
			}, [parsed]);
			/** Fetch both sides' contents and materialize one fold's hidden rows. */
			const resolveFold = (key, file, fold) => {
				if (foldSource === void 0 || foldInflight.current.has(key)) return;
				setFoldRows((current) => new Map(current).set(key, { status: "loading" }));
				const task = (async () => {
					try {
						const path = displayPath(file.newPath === "/dev/null" ? file.oldPath : file.newPath);
						const contents = await api.gitFoldContents(foldSource.scope, {
							path,
							...foldSource.ref.kind === "commit" ? { hash: foldSource.ref.hashFull } : { staged: foldSource.ref.staged === true }
						}, foldSource.ref.kind === "worktree" ? foldSource.ref.worktree : void 0);
						if (contents.old === null || contents.new === null) {
							setFoldRows((current) => new Map(current).set(key, { status: "failed" }));
							return;
						}
						const rows = foldRowsFromContents(fold, contents.old, contents.new);
						setFoldRows((current) => new Map(current).set(key, {
							status: "ready",
							rows
						}));
					} catch {
						setFoldRows((current) => new Map(current).set(key, { status: "failed" }));
					} finally {
						foldInflight.current.delete(key);
					}
				})();
				foldInflight.current.set(key, task);
			};
			const rows = (0, react.useMemo)(() => {
				const out = [];
				parsed.files.forEach((file, fileIndex) => {
					out.push({
						key: `f${fileIndex}`,
						file,
						fileIndex,
						type: "path"
					});
					if (file.binary || !expandedFiles.has(fileIndex)) return;
					let prevOldEnd = 0;
					let prevNewEnd = 0;
					file.hunks.forEach((hunk, hunkIndex) => {
						const oldGap = hunk.oldStart - prevOldEnd - 1;
						const newGap = hunk.newStart - prevNewEnd - 1;
						if (foldSource !== void 0 && (oldGap > 0 || newGap > 0)) {
							const key = `f${fileIndex}fold${hunkIndex}`;
							out.push({
								key,
								file,
								fileIndex,
								type: "fold",
								fold: {
									oldStart: prevOldEnd + 1,
									oldEnd: Math.max(hunk.oldStart - 1, prevOldEnd),
									newStart: prevNewEnd + 1,
									newEnd: Math.max(hunk.newStart - 1, prevNewEnd)
								},
								count: Math.max(oldGap, newGap, 0),
								state: foldRows.get(key)
							});
						}
						prevOldEnd = hunkOldEnd(hunk);
						prevNewEnd = hunkNewEnd(hunk);
						out.push({
							key: `f${fileIndex}h${hunkIndex}`,
							file,
							fileIndex,
							type: "hunk",
							hunk
						});
						hunk.lines.forEach((line, lineIndex) => {
							out.push({
								key: `f${fileIndex}h${hunkIndex}l${lineIndex}`,
								file,
								fileIndex,
								type: "line",
								hunk,
								line
							});
						});
					});
				});
				return out;
			}, [
				parsed,
				expandedFiles,
				foldRows,
				foldSource
			]);
			const hidden = rows.length - MAX_DIFF_ROWS;
			const capped = hidden > 0 && !expanded;
			const headLines = Math.ceil(MAX_DIFF_ROWS / 2);
			const tailLines = 250;
			const head = capped ? rows.slice(0, headLines) : rows;
			const tail = capped ? rows.slice(rows.length - tailLines) : [];
			if (rows.length === 0) return null;
			const renderLine = (line, key) => {
				const lineClass = line.kind === "del" ? sidebar_module_css_default.gitDiffDel : line.kind === "add" ? sidebar_module_css_default.gitDiffAdd : line.kind === "meta" ? sidebar_module_css_default.gitDiffMeta : sidebar_module_css_default.gitDiffCtx;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: clsx(sidebar_module_css_default.gitDiffLine, lineClass),
					children: line.kind === "meta" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: sidebar_module_css_default.gitDiffMetaText,
						children: line.text
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitDiffNum,
							children: line.oldNum ?? ""
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitDiffNum,
							children: line.newNum ?? ""
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitDiffCode,
							children: line.text
						})
					] })
				}, key);
			};
			const renderRow = (row) => {
				if (row.type === "path") {
					const tag = fileTag(row.file);
					const from = displayPath(row.file.oldPath);
					const to = displayPath(row.file.newPath);
					const expandable = !row.file.binary && row.file.hunks.length > 0;
					const fileExpanded = expandedFiles.has(row.fileIndex);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: sidebar_module_css_default.gitDiffFile,
						disabled: !expandable,
						"aria-expanded": expandable ? fileExpanded : void 0,
						onClick: () => {
							setExpandedFiles((current) => {
								const next = new Set(current);
								if (next.has(row.fileIndex)) next.delete(row.fileIndex);
								else next.add(row.fileIndex);
								return next;
							});
						},
						children: [
							expandable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								className: clsx(sidebar_module_css_default.gitDiffFileChevron, fileExpanded && sidebar_module_css_default.gitDiffFileChevronExpanded),
								children: "›"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitDiffFilePath,
								children: to
							}),
							from !== to && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: sidebar_module_css_default.gitDiffFileOld,
								children: ["← ", from]
							}),
							tag !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.gitDiffFileTag,
								children: tag
							})
						]
					}, row.key);
				}
				if (row.type === "hunk") {
					const hunk = row.hunk;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitDiffHunk,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: sidebar_module_css_default.gitDiffHunkHeader,
							children: [
								"@@ -",
								hunk.oldStart,
								",",
								hunk.lines.filter((l) => l.oldNum !== null).length,
								" +",
								hunk.newStart,
								",",
								hunk.lines.filter((l) => l.newNum !== null).length,
								" @@"
							]
						}), hunk.header !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitDiffHunkSection,
							children: hunk.header
						})]
					}, row.key);
				}
				if (row.type === "fold") {
					if (row.state?.status === "ready") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: row.state.rows.map((line, index) => renderLine(line, `${row.key}r${index}`)) }, row.key);
					const loading = row.state?.status === "loading";
					const failed = row.state?.status === "failed";
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(sidebar_module_css_default.gitFoldRow, failed && sidebar_module_css_default.gitFoldRowFailed),
						disabled: loading || failed,
						onClick: () => {
							resolveFold(row.key, row.file, row.fold);
						},
						children: failed ? t("gitFoldFailed") : loading ? t("gitFoldLoading") : t("gitFoldExpand", { count: row.count })
					}, row.key);
				}
				return renderLine(row.line, row.key);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.gitDiff,
				children: [
					head.map(renderRow),
					hidden > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: sidebar_module_css_default.gitDiffExpand,
						"aria-expanded": expanded,
						onClick: () => {
							setExpanded((value) => !value);
						},
						children: expanded ? t("diffCollapse") : t("diffExpand", { count: hidden })
					}),
					tail.map(renderRow)
				]
			});
		}
		//#endregion
		//#region src/client/DiffTab.tsx
		/**
		* The diff tab: one change opened from the git panel, like VSCode's diff
		* editor. A worktree ref loads the file's unified diff (`git diff`, staged or
		* not; untracked files — which git diff never covers — render as a full-file
		* addition from their content), a commit ref loads the commit's full patch
		* (`git.show`-style). The header carries a refresh button because the tab
		* stays mounted while the git panel's staging/discard operations change the
		* very content it shows.
		*/
		function DiffTab(props) {
			const { sessionId, cwd, diff } = props;
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [data, setData] = (0, react.useState)(null);
			const [tick, setTick] = (0, react.useState)(0);
			const refresh = (0, react.useCallback)(() => {
				setTick((value) => value + 1);
			}, []);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const scope = {
					sessionId,
					cwd,
					...diff.repoRoot !== void 0 ? { repoRoot: diff.repoRoot } : {}
				};
				setLoading(true);
				setError(null);
				setData(null);
				const load = async () => {
					try {
						if (diff.kind === "commit") {
							const result = await api.gitCommitDiff(scope, diff.hashFull, diff.worktree);
							if (!cancelled) setData({ diff: result.diff });
							return;
						}
						let result = await api.gitDiff(scope, diff.path, diff.staged, diff.worktree);
						if (result.diff === "") {
							const other = await api.gitDiff(scope, diff.path, !diff.staged, diff.worktree);
							if (other.diff !== "") result = other;
						}
						if (result.diff !== "") {
							if (!cancelled) setData({ diff: result.diff });
							return;
						}
						if (diff.untracked === true && !diff.staged) {
							const text = await api.fsRead(scope, resolveSidebarPath(diff.repoRoot ?? diff.worktree ?? cwd, diff.path));
							if (!cancelled) setData(text.kind === "text" ? {
								diff: "",
								untracked: text.content
							} : { diff: "" });
							return;
						}
						if (!cancelled) setData({ diff: "" });
					} catch (reason) {
						if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
					} finally {
						if (!cancelled) setLoading(false);
					}
				};
				load();
				return () => {
					cancelled = true;
				};
			}, [
				sessionId,
				cwd,
				diff,
				tick
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.gitDiffTab,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitDiffTabHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.gitDiffTabTitle,
							title: diff.kind === "worktree" ? diff.path : `${diff.hash} ${diff.subject}`,
							children: diff.kind === "worktree" ? diff.path : `${diff.hash} ${diff.subject}`
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.iconButton,
							"aria-label": t("refresh"),
							title: t("refresh"),
							onClick: refresh,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
						})]
					}),
					loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitPlaceholder,
						children: t("loading")
					}),
					!loading && error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.gitError,
						children: [
							t("diffLoadError"),
							": ",
							error
						]
					}),
					!loading && error === null && data !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [data.untracked !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffView, {
						diff: "",
						untrackedPath: diff.kind === "worktree" ? diff.path : "",
						untrackedContent: data.untracked
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffView, {
						diff: data.diff,
						foldSource: {
							scope: {
								sessionId,
								cwd,
								...diff.repoRoot !== void 0 ? { repoRoot: diff.repoRoot } : {}
							},
							ref: diff,
							cwd
						}
					}), data.diff === "" && data.untracked === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.gitEmpty,
						children: t("diffEmpty")
					})] })
				]
			});
		}
		/** The boundary message's opening line — the transcript mapping drops user
		*  rows starting with it (same first line as dsh-sidechain's boundary, so
		*  the two plugins' threads render consistently in either UI). */
		const SIDE_BOUNDARY_PREFIX = "Side conversation boundary";
		/**
		* The boundary prompt delivered as the thread's first user message: the
		* inherited seed is reference context only, never active instruction.
		* Model-facing contract — change only with intent, tests pin the sentences.
		*/
		const SIDE_BOUNDARY_PROMPT = `Side conversation boundary.

Everything before this boundary is inherited history from the parent session: its completed turns, its pending question, and — if the parent was mid-turn — its in-progress output frozen at the moment this side conversation started. It is reference context only. It is not your current task.

Do not continue, execute, or complete any instructions, plans, tool calls, approvals, edits, or requests from before this boundary. Only messages submitted after this boundary are active user instructions for this side conversation.

Mode: this is a continuable side conversation. Your answers stay in this side thread and are viewed in the side panel; they are never delivered into the parent session.`;
		/**
		* Derive the side threads of one parent session from the client session list:
		* durable `origin: 'subagent'` children of the parent whose pinned title
		* carries the thread label prefix (our creation path pins it via
		* sessionTitle.rename; dsh-sidechain threads share the convention, so they
		* are visible here too).
		*/
		function sideThreadRows(byId, sessionId) {
			const rows = [];
			for (const summary of Object.values(byId)) {
				if (summary.origin !== "subagent" || summary.parentId !== sessionId) continue;
				if (!summary.displayTitle.startsWith("Side: ")) continue;
				rows.push({
					id: summary.id,
					title: summary.displayTitle,
					running: summary.running === true
				});
			}
			return rows;
		}
		/** The leading text of a user/message's content (block array or bare string). */
		function messageLeadText(data) {
			const content = data.content;
			const first = Array.isArray(content) ? content[0] : content;
			return typeof first === "string" ? first : typeof first === "object" && first !== null && "text" in first ? String(first.text) : "";
		}
		/**
		* Whether a logged user/message is a CONTEXT INJECTION (the boundary prompt
		* plus the parked in-progress snapshot) rather than a real user message.
		* New threads deliver the injection via `agent.inject` stamped with a
		* non-'user' source kind; threads created before that split carry
		* boundary+question in ONE 'user' message, recognized by the boundary
		* prefix. Both render as one collapsible injection row — never as a user
		* bubble.
		*/
		function isContextInjectionMessage(data) {
			const source = data.source;
			if (source?.kind !== void 0 && source.kind !== "user") return true;
			return messageLeadText(data).startsWith(SIDE_BOUNDARY_PREFIX);
		}
		/** The events a thread produced itself: everything after the LAST
		*  `session/end-seed` marker (the fork-seed boundary). */
		function threadOwnEvents(entries) {
			const events = entries.map((entry) => entry.event);
			for (let index = events.length - 1; index >= 0; index--) if (events[index]?.type === "session/end-seed") return events.slice(index + 1);
			return events;
		}
		/**
		* Whether the thread has at least one completed turn — the save-as-new-
		* session precondition (`session.fork` refuses to fork before the first
		* `turn/end`).
		*/
		function threadHasCompletedTurn(entries) {
			return threadOwnEvents(entries).some((event) => event.type === "turn/end");
		}
		/** Whether the thread ends with a user message that no completed turn
		*  answered yet — such a pending follow-up is NOT carried into the saved
		*  session (the fork cut is the last `turn/end`). */
		function threadTrailingPending(entries) {
			const own = threadOwnEvents(entries);
			let lastUser = -1;
			let lastTurnEnd = -1;
			own.forEach((event, index) => {
				if (event.type === "user/message") lastUser = index;
				if (event.type === "turn/end") lastTurnEnd = index;
			});
			return lastUser > lastTurnEnd;
		}
		//#endregion
		//#region src/client/subagent-detect.ts
		/**
		* Side Chat threads ride the subagent origin (main-list hiding + the RPC
		* ownership fence) but they are NOT subagent topology: they carry the
		* durable 'Side: ' label and live as sidebar tabs. Excluding them here
		* keeps the auto-open trigger and the Subagent page counts clean.
		*/
		function isSideThreadSummary(summary) {
			return summary.origin === "subagent" && summary.displayTitle.startsWith("Side: ");
		}
		/** Count the direct subagent children of one session (durable `origin` rows). */
		function directSubagentCount(byId, sessionId) {
			let count = 0;
			for (const summary of Object.values(byId)) if (summary.origin === "subagent" && summary.parentId === sessionId && !isSideThreadSummary(summary)) count += 1;
			return count;
		}
		/**
		* The main agent of the current session's tree: walk the durable parent
		* chain upward until the first non-subagent session. The Subagent page shows
		* THIS root's full topology regardless of how deep the current selection is
		* (a session whose row is still hydrating, or a broken chain, degrades to
		* the session itself).
		*/
		function rootAncestor(byId, sessionId) {
			if (sessionId === void 0) return void 0;
			const seen = /* @__PURE__ */ new Set();
			let current = byId[sessionId];
			while (current !== void 0 && current.origin === "subagent" && current.parentId !== void 0 && !seen.has(current.id)) {
				seen.add(current.id);
				current = byId[current.parentId];
			}
			return current?.id ?? sessionId;
		}
		/**
		* Whether a new direct subagent appeared under `sessionId` between two
		* consecutive list snapshots (the count crossed 0 → >0). Switching to a
		* session that already has subagents yields `false` (its baseline starts at
		* the current count), so the auto-open never fights an existing layout.
		*/
		function detectNewDirectSubagent(prev, next, sessionId) {
			return directSubagentCount(prev.byId, sessionId) === 0 && directSubagentCount(next.byId, sessionId) > 0;
		}
		/**
		* Index every subagent descendant under each ancestor it reaches through an
		* uninterrupted subagent-origin chain (same semantics as the official
		* `indexSubagentDescendants`; cycles fail soft).
		*/
		function countSubagentDescendants(byId, sessionId) {
			const totals = {
				count: 0,
				runningCount: 0
			};
			for (const descendant of Object.values(byId)) {
				if (descendant.origin !== "subagent" || isSideThreadSummary(descendant)) continue;
				const seen = /* @__PURE__ */ new Set();
				let current = descendant;
				while (current?.origin === "subagent" && current.parentId !== void 0 && !seen.has(current.id)) {
					seen.add(current.id);
					if (current.parentId === sessionId) {
						totals.count += 1;
						if (descendant.running === true) totals.runningCount += 1;
						break;
					}
					current = byId[current.parentId];
				}
			}
			return totals;
		}
		//#endregion
		//#region src/client/subagent-catalogs.ts
		/**
		* Map ONE projection value onto the catalog shape the page already consumes.
		* @param projection - the parent Session's projection snapshot.
		* @param childHasChildren - resolves whether a child id owns further children.
		* @param childRunning - resolves a child id's live activity.
		* @returns the catalog, or undefined when this Session has no catalog at all.
		*/
		function catalogOf(projection, childHasChildren, childRunning) {
			const rows = projection.values?.subagentCatalog;
			const state = projection.state === "idle" ? rows === void 0 ? "loading" : "ready" : projection.state === "loading" ? "loading" : projection.state === "error" ? "error" : "ready";
			if (rows === void 0 && state === "ready") return void 0;
			const entries = [];
			for (const row of rows ?? []) {
				if (row.mode === "unknown") {
					entries.push({
						kind: "diagnostic",
						id: row.id,
						reason: "unsupported"
					});
					continue;
				}
				entries.push({
					kind: "child",
					id: row.id,
					activity: childRunning(row.id) ? "running" : "inactive",
					hasChildren: childHasChildren(row.id),
					mode: row.mode,
					...row.label === void 0 ? {} : { label: row.label }
				});
			}
			return {
				entries,
				parentAvailable: true,
				state,
				error: projection.error ?? null
			};
		}
		/**
		* Build every parent catalog the topology page can render from the projection
		* store.
		* @param projections - `list.projectionsBySession` (absent on pre-0.1.7 runtimes).
		* @param byId - session summaries, for activity and title fallbacks.
		* @returns catalogs keyed by parent Session id (empty when the store is absent).
		*/
		function deriveCatalogs(projections, byId) {
			if (projections === void 0) return {};
			const childHasChildren = (childId) => (projections[childId]?.values?.subagentCatalog?.length ?? 0) > 0;
			const childRunning = (childId) => byId[childId]?.running === true;
			const catalogs = {};
			for (const [parentId, projection] of Object.entries(projections)) {
				const catalog = catalogOf(projection, childHasChildren, childRunning);
				if (catalog !== void 0) catalogs[parentId] = catalog;
			}
			return catalogs;
		}
		//#endregion
		//#region src/client/use-jobs-rows.ts
		/**
		* Subscribe to the client jobs service (`ctx.jobs`) for a bounded set of
		* Sessions and read its shared row snapshot.
		*
		* ## Why this exists (0.1.7 seam migration)
		*
		* Up to 0.1.6-alpha.2 the harness pushed a per-session job roster into the
		* session list snapshot (`jobsBySession`). 0.1.7 removed that mirror: job rows
		* now come from the `jobs` client service, which serves rows only for Sessions
		* someone is WATCHING (`watchRows`) and exposes one shared snapshot. Reading
		* the removed field yields `undefined` silently, so the jobs section simply
		* stayed empty rather than failing loudly — hence this hook makes the watch
		* set explicit and drops it again on release.
		*
		* The service is read through `ctx.get('jobs')` rather than a hard `inject`:
		* the sidebar must still load on a runtime whose job-controller client half is
		* absent, in which case this returns `undefined` and the section renders
		* nothing (the pre-existing graceful degradation).
		*/
		/** Stable empty snapshot: `useSyncExternalStore` needs one identity per state. */
		const NO_ROWS = { rows: {} };
		const NOOP_UNSUBSCRIBE = () => {};
		/**
		* Watch the given Sessions' job rows and return the shared roster snapshot.
		* @param ctx - the client cordis context (the service is optional).
		* @param sessionIds - Sessions whose rows this surface shows; watching stops on change/unmount.
		* @returns rows keyed by Session id, or undefined when the service is absent.
		*/
		function useJobsRows(ctx, sessionIds) {
			const service = ctx.get("jobs");
			const key = sessionIds.join("\n");
			const idsRef = (0, react.useRef)(sessionIds);
			idsRef.current = sessionIds;
			const subscribe = (0, react.useMemo)(() => service === void 0 ? () => NOOP_UNSUBSCRIBE : (listener) => service.state.subscribe(listener), [service]);
			const getSnapshot = (0, react.useCallback)(() => service === void 0 ? NO_ROWS : service.state.getSnapshot(), [service]);
			const snapshot = (0, react.useSyncExternalStore)(subscribe, getSnapshot);
			(0, react.useEffect)(() => {
				const watchRows = service?.watchRows;
				if (watchRows === void 0) return;
				const releases = idsRef.current.map((id) => watchRows.call(service, id));
				return () => {
					for (const release of releases) release();
				};
			}, [service, key]);
			return service === void 0 ? void 0 : snapshot.rows;
		}
		//#endregion
		//#region src/client/subagent-jobs.ts
		/** Whether the registry still holds the job open (its duration ticks). */
		function isJobLive(job) {
			return job.status === "running" || job.status === "stopping";
		}
		/**
		* Every session id of the topology tree rooted at `rootId` (the root plus
		* each session whose uninterrupted subagent-origin chain reaches it — same
		* lineage semantics as {@link countSubagentDescendants}; cycles fail soft).
		* Sessions outside the tree (orphans, other trees) are excluded, so the
		* jobs section never shows foreign work.
		*/
		function treeSessionIds(byId, rootId) {
			const ids = /* @__PURE__ */ new Set();
			if (rootId === void 0) return ids;
			for (const summary of Object.values(byId)) {
				const seen = /* @__PURE__ */ new Set();
				let current = summary;
				let reachesRoot = false;
				while (current !== void 0 && !seen.has(current.id)) {
					seen.add(current.id);
					if (current.id === rootId) {
						reachesRoot = true;
						break;
					}
					if (current.origin !== "subagent" || current.parentId === void 0) break;
					current = byId[current.parentId];
				}
				if (reachesRoot) ids.add(summary.id);
			}
			return ids;
		}
		/**
		* Whether a NEW background job appeared for one session between two
		* consecutive job rosters (a job id the previous roster lacked).
		* Unlike the subagent auto-open (0 → N only), ANY new job id triggers: the
		* agent may start several jobs over a session, and each new one should
		* surface the Jobs page (a fresh page load never triggers — its baseline
		* starts at the current roster).
		*/
		function detectNewJob(prev, next, sessionId) {
			const prevIds = new Set((prev?.[sessionId] ?? []).map((job) => job.id));
			return (next?.[sessionId] ?? []).some((job) => !prevIds.has(job.id));
		}
		/**
		* Collect the background jobs of the whole current tree, owner-labeled.
		* Sessions without a roster entry contribute nothing; an absent roster
		* (runtime without the jobs service) yields an empty list.
		*/
		function collectTreeJobs(byId, jobsRows, rootId) {
			const rows = [];
			if (jobsRows === void 0) return rows;
			for (const sessionId of treeSessionIds(byId, rootId)) {
				const jobs = jobsRows[sessionId];
				if (jobs === void 0 || jobs.length === 0) continue;
				const ownerTitle = byId[sessionId]?.displayTitle ?? sessionId;
				for (const job of jobs) rows.push({
					ownerSessionId: sessionId,
					ownerTitle,
					job
				});
			}
			return rows;
		}
		/**
		* Live rows first in start order, then settled rows newest-first (mirror of
		* the official ui-jobs ordering); a tie falls back to start order so the
		* sort never depends on the host's map iteration.
		*/
		function orderJobs(rows) {
			return [...rows].sort((left, right) => {
				const liveLeft = isJobLive(left.job);
				if (liveLeft !== isJobLive(right.job)) return liveLeft ? -1 : 1;
				if (liveLeft) return left.job.startedAt - right.job.startedAt;
				const finished = (right.job.finishedAt ?? right.job.startedAt) - (left.job.finishedAt ?? left.job.startedAt);
				return finished !== 0 ? finished : left.job.startedAt - right.job.startedAt;
			});
		}
		/**
		* Status marker semantics. `stopping` and `killed` share the attention
		* color: both mean the work ended (or is ending) on request rather than on
		* its own.
		*/
		function jobDotState(status) {
			switch (status) {
				case "running": return "ongoing";
				case "stopping": return "warning";
				case "completed": return "done";
				case "killed": return "warning";
				case "failed": return "error";
			}
		}
		/** Human status word of one wire status (localized through the passed translator). */
		function jobStatusLabel(status, t) {
			switch (status) {
				case "running": return t("jobStatusRunning");
				case "stopping": return t("jobStatusStopping");
				case "completed": return t("jobStatusCompleted");
				case "killed": return t("jobStatusKilled");
				case "failed": return t("jobStatusFailed");
			}
		}
		/**
		* Elapsed time in at most two adjacent units (mirror of the official
		* ui-jobs duration wording). A background job that outlives an hour is
		* already exceptional, so hours is the widest unit.
		*/
		function formatJobDuration(elapsedMs, t) {
			const total = Math.max(0, Math.floor(elapsedMs / 1e3));
			const seconds = total % 60;
			const minutes = Math.floor(total / 60) % 60;
			const hours = Math.floor(total / 3600);
			if (hours > 0) return t("jobDurationHours", {
				hours,
				minutes
			});
			if (minutes > 0) return t("jobDurationMinutes", {
				minutes,
				seconds
			});
			return t("jobDurationSeconds", { seconds });
		}
		//#endregion
		//#region src/client/workspace-nav.ts
		/** The plugin fiber's uiWorkspace seat, captured through the waitable inject. */
		let capturedFace;
		/**
		* Capture the host uiWorkspace face handed to a waitable `ctx.inject`
		* callback. Wire once from the client apply inside `ctx.effect`, so a fiber
		* disposal (HMR reload) clears the stale capture:
		*
		* ```ts
		* ctx.effect(() => ctx.inject(['uiWorkspace'], (scope) => {
		*   observeUiWorkspaceFace((scope as { uiWorkspace?: unknown }).uiWorkspace)
		* }), 'dsh-coding-sidebar: uiWorkspace seat')
		* ```
		*
		* Non-object faces are ignored (the capture keeps its previous value).
		*/
		function observeUiWorkspaceFace(face) {
			if (face !== null && typeof face === "object") capturedFace = face;
		}
		/**
		* Invoke one opener AS A METHOD of its face — never extract and call it
		* detached. Host service methods read `this` (UiWorkspaceService.openSession
		* → this.replaceMain/this.lifetime; sessions.open reads this.list — the same
		* trap SideChatView documents for `fork`): an unbound reference throws
		* TypeError, which would surface as a silent "opened nothing, warned
		* nothing useful" navigation failure.
		*/
		function callOpen(face, method, target) {
			if (face === null || typeof face !== "object") return void 0;
			if (typeof face[method] !== "function") return void 0;
			const bound = face;
			try {
				bound[method](target);
				return "opened";
			} catch {
				return "failed";
			}
		}
		/**
		* Open one session (or a subagent child through its direct-parent address)
		* as the host workspace's main conversation.
		* @param ctx - plugin context (any `get`-capable context).
		* @param target - session id or subagent address to display.
		* @param legacy - optional pre-0.1.6 sessions face used when the host has no
		*   uiWorkspace (`open` for session ids, `openSubagent` for addresses).
		* @returns how the navigation ended: `'opened'`, `'unavailable'` (nothing to
		*   call — e.g. an older host without either face) or `'failed'` (the opener
		*   threw). Callers should warn on every non-`'opened'` outcome: silence here
		*   once cost a full round of "the button does nothing" debugging.
		*/
		function openViaUiWorkspace(ctx, target, legacy) {
			if (capturedFace !== void 0) {
				const outcome = callOpen(capturedFace, "openSession", target);
				if (outcome !== void 0) return outcome;
			}
			let workspace;
			try {
				workspace = ctx.get("uiWorkspace");
			} catch {
				workspace = void 0;
			}
			if (workspace !== null && typeof workspace === "object") {
				const outcome = callOpen(workspace, "openSession", target);
				if (outcome !== void 0) return outcome;
			}
			return (typeof target === "string" ? callOpen(legacy, "open", target) : callOpen(legacy, "openSubagent", target)) ?? "unavailable";
		}
		//#endregion
		//#region \0dsh-css:/Users/libing/kk_Projects/dsh-coding-sidebar/src/client/SubagentView.module.css.mjs
		const css$3 = ".F2T6aa_subagent{flex-direction:column;flex:1;min-height:0;display:flex}.F2T6aa_subagentHeader{flex:none;align-items:center;gap:8px;height:36px;padding:0 8px 0 12px;display:flex}.F2T6aa_subagentTitle{min-width:0;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.F2T6aa_subagentCount{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.F2T6aa_subagentRefresh{width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;flex:none;justify-content:center;align-items:center;display:inline-flex}.F2T6aa_subagentRefresh:hover{background:var(--dsw-alias-interactive-bg-hover)}.F2T6aa_subagentBody{flex:1;min-height:0;padding:2px 6px 8px;overflow-y:auto}.F2T6aa_subagentRow{box-sizing:border-box;width:100%;min-height:50px;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;outline:none;align-items:flex-start;gap:8px;padding:7px 8px 7px 11px;display:flex;position:relative}.F2T6aa_subagentRow:hover,.F2T6aa_subagentRow:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.F2T6aa_subagentRowActive,.F2T6aa_subagentRowActive:hover,.F2T6aa_subagentRowActive:focus-visible{background:var(--dsw-alias-interactive-bg-active)}.F2T6aa_subagentRowDisabled{color:var(--dsw-alias-label-dimmed);cursor:not-allowed}.F2T6aa_subagentRowDisabled:hover{background:0 0}.F2T6aa_subagentRowLoading{cursor:default}.F2T6aa_subagentDot{margin-top:4px}.F2T6aa_subagentContent{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.F2T6aa_subagentLabel,.F2T6aa_subagentSecondary{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.F2T6aa_subagentLabel{color:inherit;font-weight:400}.F2T6aa_subagentSecondary{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}.F2T6aa_subagentLive{min-width:0;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);align-items:baseline;gap:4px;display:flex;overflow:hidden}.F2T6aa_subagentLiveTool{font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-secondary);flex:none}.F2T6aa_subagentLiveArgs{min-width:0;font-family:var(--ds-font-family-code);font-size:var(--dsw-font-xxxs-11-font-size);line-height:var(--dsw-font-xxxs-11-line-height);color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.F2T6aa_subagentLiveText{-webkit-line-clamp:2;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-secondary);-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.F2T6aa_subagentNode{min-width:0;position:relative}.F2T6aa_subagentChildren{margin-left:18px;padding-left:4px;position:relative}.F2T6aa_subagentChildren:before{content:\"\";border-left:1px solid var(--dsw-alias-border-l2);height:26px;position:absolute;top:-26px;left:0}.F2T6aa_subagentChildren[aria-busy=true]:before{content:none}.F2T6aa_subagentChildren>.F2T6aa_subagentNode:before{content:\"\";border-left:1px solid var(--dsw-alias-border-l2);position:absolute;top:0;bottom:0;left:-4px}.F2T6aa_subagentChildren>.F2T6aa_subagentNode:last-child:before{height:17px;bottom:auto}.F2T6aa_subagentChildren>.F2T6aa_subagentNode>.F2T6aa_subagentRow:before{content:\"\";border-top:1px solid var(--dsw-alias-border-l2);width:14px;position:absolute;top:16px;left:-4px}.F2T6aa_subagentEmpty{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-align:center;flex-direction:column;gap:2px;padding:16px;display:flex}.F2T6aa_subagentEmptyHint{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-dimmed)}.F2T6aa_subagentError{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-state-error-primary);justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;display:flex}.F2T6aa_subagentErrorRetry{height:24px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-strong-11);cursor:pointer;background:0 0;border:none;border-radius:6px;flex:none;align-items:center;gap:4px;padding:0 8px;display:inline-flex}.F2T6aa_subagentErrorRetry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.F2T6aa_historyToggle{box-sizing:border-box;width:100%;min-height:26px;font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-tertiary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;outline:none;align-items:center;gap:5px;padding:3px 8px 3px 11px;display:flex}.F2T6aa_historyToggle:hover,.F2T6aa_historyToggle:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.F2T6aa_historyToggle svg{flex:none}.F2T6aa_jobs .F2T6aa_historyToggle{margin-top:2px}.F2T6aa_jobs{border-top:1px solid var(--dsw-alias-border-l2);margin-top:10px;padding-top:8px}.F2T6aa_jobsHeader{align-items:center;gap:8px;height:26px;padding:0 2px;display:flex}.F2T6aa_jobsTitle{min-width:0;font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.F2T6aa_jobsCount{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.F2T6aa_jobsList{flex-direction:column;gap:2px;margin:0;padding:0;list-style:none;display:flex}.F2T6aa_jobsRow{border-radius:8px;align-items:center;gap:4px;display:flex}.F2T6aa_jobsRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.F2T6aa_jobsRowSettled{opacity:.8}.F2T6aa_jobsRowSelected,.F2T6aa_jobsRowSelected:hover{background:var(--dsw-alias-interactive-bg-active)}.F2T6aa_jobsRowMain{min-width:0;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;outline:none;flex:1;align-items:flex-start;gap:8px;padding:6px 8px 6px 11px;display:flex}.F2T6aa_jobsRowMain:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.F2T6aa_jobsDot{margin-top:5px}.F2T6aa_jobsContent{flex-direction:column;gap:1px;min-width:0;display:flex}.F2T6aa_jobsLabelLine{align-items:center;gap:6px;min-width:0;display:flex}.F2T6aa_jobsKind{text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--dsw-alias-border-l2);max-width:90px;font:var(--dsw-font-xxxs-strong-11);color:var(--dsw-alias-label-tertiary);border-radius:4px;flex:none;padding:0 5px;line-height:14px;overflow:hidden}.F2T6aa_jobsLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-family:var(--ds-font-family-code);font-size:var(--dsw-font-xxxs-11-font-size);line-height:var(--dsw-font-xxxs-11-line-height);color:var(--dsw-alias-label-primary);flex:1;overflow:hidden}.F2T6aa_jobsSecondary{text-overflow:ellipsis;white-space:nowrap;font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);overflow:hidden}.F2T6aa_jobsKill{width:22px;height:22px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;flex:none;justify-content:center;align-items:center;margin-right:4px;display:inline-flex}.F2T6aa_jobsKill:hover{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);color:var(--dsw-alias-state-error-primary)}.F2T6aa_jobsKillArmed,.F2T6aa_jobsKillArmed:hover{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);width:auto;height:20px;color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xxxs-strong-11);white-space:nowrap;padding:0 8px}.F2T6aa_jobsKill:disabled{opacity:.5;cursor:default}.F2T6aa_jobsKillError{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-state-error-primary);flex:none;margin-right:4px}.F2T6aa_jobsPane{z-index:1;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);border-radius:8px;margin-top:4px;position:sticky;bottom:0;overflow:hidden;box-shadow:0 -6px 12px -8px #00000059}.F2T6aa_jobsPaneHeader{border-bottom:1px solid var(--dsw-alias-border-l1);align-items:center;gap:6px;height:28px;padding:0 4px 0 10px;display:flex}.F2T6aa_jobsPaneDot{flex:none}.F2T6aa_jobsPaneLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-family:var(--ds-font-family-code);font-size:var(--dsw-font-xxxs-11-font-size);line-height:var(--dsw-font-xxxs-11-line-height);color:var(--dsw-alias-label-primary);flex:1;overflow:hidden}.F2T6aa_jobsPaneStatus{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex:none}.F2T6aa_jobsPaneClose{width:20px;height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:5px;flex:none;justify-content:center;align-items:center;display:inline-flex}.F2T6aa_jobsPaneClose:hover{background:var(--dsw-alias-interactive-bg-hover)}.F2T6aa_jobsPanePre{max-height:200px;font-family:var(--ds-font-family-code);font-size:var(--dsw-font-xxxs-11-font-size);color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;margin:0;padding:6px 10px;line-height:1.5;overflow:auto}.F2T6aa_jobsPaneHint{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);padding:8px 10px}.F2T6aa_jobsPaneError{color:var(--dsw-alias-state-error-primary)}";
		const tagId$3 = "dsh-coding-sidebar/SubagentView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-coding-sidebar";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var SubagentView_module_css_default = {
			"historyToggle": "F2T6aa_historyToggle",
			"jobs": "F2T6aa_jobs",
			"jobsContent": "F2T6aa_jobsContent",
			"jobsCount": "F2T6aa_jobsCount",
			"jobsDot": "F2T6aa_jobsDot",
			"jobsHeader": "F2T6aa_jobsHeader",
			"jobsKill": "F2T6aa_jobsKill",
			"jobsKillArmed": "F2T6aa_jobsKillArmed",
			"jobsKillError": "F2T6aa_jobsKillError",
			"jobsKind": "F2T6aa_jobsKind",
			"jobsLabel": "F2T6aa_jobsLabel",
			"jobsLabelLine": "F2T6aa_jobsLabelLine",
			"jobsList": "F2T6aa_jobsList",
			"jobsPane": "F2T6aa_jobsPane",
			"jobsPaneClose": "F2T6aa_jobsPaneClose",
			"jobsPaneDot": "F2T6aa_jobsPaneDot",
			"jobsPaneError": "F2T6aa_jobsPaneError",
			"jobsPaneHeader": "F2T6aa_jobsPaneHeader",
			"jobsPaneHint": "F2T6aa_jobsPaneHint",
			"jobsPaneLabel": "F2T6aa_jobsPaneLabel",
			"jobsPanePre": "F2T6aa_jobsPanePre",
			"jobsPaneStatus": "F2T6aa_jobsPaneStatus",
			"jobsRow": "F2T6aa_jobsRow",
			"jobsRowMain": "F2T6aa_jobsRowMain",
			"jobsRowSelected": "F2T6aa_jobsRowSelected",
			"jobsRowSettled": "F2T6aa_jobsRowSettled",
			"jobsSecondary": "F2T6aa_jobsSecondary",
			"jobsTitle": "F2T6aa_jobsTitle",
			"subagent": "F2T6aa_subagent",
			"subagentBody": "F2T6aa_subagentBody",
			"subagentChildren": "F2T6aa_subagentChildren",
			"subagentContent": "F2T6aa_subagentContent",
			"subagentCount": "F2T6aa_subagentCount",
			"subagentDot": "F2T6aa_subagentDot",
			"subagentEmpty": "F2T6aa_subagentEmpty",
			"subagentEmptyHint": "F2T6aa_subagentEmptyHint",
			"subagentError": "F2T6aa_subagentError",
			"subagentErrorRetry": "F2T6aa_subagentErrorRetry",
			"subagentHeader": "F2T6aa_subagentHeader",
			"subagentLabel": "F2T6aa_subagentLabel",
			"subagentLive": "F2T6aa_subagentLive",
			"subagentLiveArgs": "F2T6aa_subagentLiveArgs",
			"subagentLiveText": "F2T6aa_subagentLiveText",
			"subagentLiveTool": "F2T6aa_subagentLiveTool",
			"subagentNode": "F2T6aa_subagentNode",
			"subagentRefresh": "F2T6aa_subagentRefresh",
			"subagentRow": "F2T6aa_subagentRow",
			"subagentRowActive": "F2T6aa_subagentRowActive",
			"subagentRowDisabled": "F2T6aa_subagentRowDisabled",
			"subagentRowLoading": "F2T6aa_subagentRowLoading",
			"subagentSecondary": "F2T6aa_subagentSecondary",
			"subagentTitle": "F2T6aa_subagentTitle"
		};
		//#endregion
		//#region src/client/SubagentView.tsx
		/**
		* Subagent page: the FULL agent topology of the current tree's main session.
		*
		* The root is resolved by walking the durable parent chain upward from the
		* current session to the first non-subagent session — the MAIN session — and
		* every subagent under it shares this one topology view, no matter how deep
		* the current selection is (including a subagent transcript opened in the
		* main view). The main agent renders as the root node card (click it to jump
		* back to the main session), with its subagents hanging below it in clearly
		* LAYERED levels: tree connector lines (first level included) and per-level
		* indentation show the hierarchy, and the currently-open session is
		* highlighted in place. Every branch is expanded automatically (lazy
		* catalogs hydrate on demand and consume live membership while visible).
		*
		* To keep long histories browsable, each catalog level shows only its
		* LATEST {@link SUBAGENT_VISIBLE} children by default — earlier rows fold
		* behind a history toggle — and the jobs section shows its latest
		* {@link JOBS_VISIBLE} rows the same way. Collapsing is view-only: the
		* header counts, the output dock and live observation still see every row.
		*
		* Each node card carries live status (state dot, durable label, mode and
		* activity); while a child RUNS, its card additionally shows the LAST text
		* output and LAST tool call pulled from its history tail, auto-refreshing
		* every few seconds while the page is visible. Clicking a card jumps
		* straight into the child transcript (`openSubagent`); the page stays open
		* and the topology remains rooted at the main session.
		*/
		/** Refresh cadence of the live "last text + tool call" lines while a child runs. */
		const POLL_MS = 3e3;
		/** Preview cap of one tool-call argument line. */
		const ARGS_PREVIEW = 60;
		/** Refresh cadence of an expanded job-output panel while its job runs. */
		const JOB_POLL_MS = 2e3;
		/** How long the kill button stays armed before it needs re-confirming. */
		const JOB_KILL_ARM_MS = 3e3;
		/**
		* How many of the LATEST rows stay visible by default before the earlier
		* (history) rows collapse behind a toggle: {@link SUBAGENT_VISIBLE} for the
		* topology's child rows, {@link JOBS_VISIBLE} for the background-job list.
		* Collapsing is view-only — counts, the output dock and live observation
		* keep seeing every entry.
		*/
		const SUBAGENT_VISIBLE = 5;
		const JOBS_VISIBLE = 3;
		/** The direct subagent children of one parent (durable `origin` rows;
		*  Side Chat threads ride the same origin but are tab-strip conversations,
		*  never topology). */
		function directChildren(byId, parentSessionId) {
			return Object.values(byId).filter((summary) => summary.origin === "subagent" && summary.parentId === parentSessionId && !isSideThreadSummary(summary));
		}
		/** Human label of one catalog child: durable label, then summary title, then id. */
		function childLabel(entry, summary) {
			return entry.label ?? summary?.displayTitle ?? entry.id;
		}
		function diagnosticReason(entry) {
			switch (entry.reason) {
				case "corrupt": return t("subagentDiagCorrupt");
				case "unsupported": return t("subagentDiagUnsupported");
				case "unavailable": return t("subagentDiagUnavailable");
			}
		}
		/** The secondary line of one card: title · mode · activity (skips empty parts). */
		function cardSecondary(summary, entry) {
			return [
				summary?.displayTitle,
				entry.mode === "one-shot" ? t("subagentModeOneShot") : t("subagentModeContinuable"),
				entry.activity === "running" ? t("subagentRunning") : t("subagentInactive")
			].filter(Boolean).join(" · ");
		}
		/** First `limit` characters with an ellipsis when truncated. */
		function preview(text, limit) {
			return text.length > limit ? `${text.slice(0, limit)}…` : text;
		}
		/** Collapse whitespace for the single-paragraph live-text preview. */
		function flatten(text) {
			return text.replace(/\s+/g, " ").trim();
		}
		/** Disabled "loading…" cards backed by the summary mirror while a catalog hydrates. */
		function CatalogLoadingRows(props) {
			const { parentSessionId, byId, level } = props;
			const children = directChildren(byId, parentSessionId);
			if (children.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: SubagentView_module_css_default.subagentEmpty,
				children: t("loading")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: children.map((summary) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "treeitem",
				"aria-disabled": "true",
				"aria-level": level,
				"aria-label": t("loading"),
				className: `${SubagentView_module_css_default.subagentRow} ${SubagentView_module_css_default.subagentRowDisabled} ${SubagentView_module_css_default.subagentRowLoading}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
					state: summary.running === true ? "ongoing" : "done",
					className: SubagentView_module_css_default.subagentDot
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SubagentView_module_css_default.subagentContent,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SubagentView_module_css_default.subagentLabel,
						children: t("loading")
					})
				})]
			}, summary.id)) });
		}
		/**
		* The live lines of one RUNNING subagent card: a pure presentation of the
		* batch `subagents.live` activity. The polling lives in one place (the
		* SubagentView hook), not per card. A running child with neither output yet
		* reads "thinking…".
		*/
		function SubagentLiveLines(props) {
			const { live } = props;
			if (live?.text === void 0 && live?.tool === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: SubagentView_module_css_default.subagentLive,
				children: t("subagentThinking")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [live.tool !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: SubagentView_module_css_default.subagentLive,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SubagentView_module_css_default.subagentLiveTool,
					children: live.tool.name
				}), live.tool.args !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SubagentView_module_css_default.subagentLiveArgs,
					children: preview(live.tool.args, ARGS_PREVIEW)
				})]
			}), live.text !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: SubagentView_module_css_default.subagentLiveText,
				children: flatten(live.text)
			})] });
		}
		/**
		* One shared live-preview poller for the whole Subagent tree. Unlike the old
		* per-card `subagents.history` timers, this sends at most ONE `subagents.live`
		* request at a time: a recursive timeout starts only after the previous
		* request settles, so a slow host never sees abort/restart storms.
		*/
		function useSubagentLive(rootId, active) {
			const [live, setLive] = (0, react.useState)({});
			const controllerRef = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				setLive({});
			}, [rootId]);
			(0, react.useEffect)(() => {
				if (rootId === void 0 || !active) return;
				const targetRootId = rootId;
				let disposed = false;
				let timer;
				const schedule = () => {
					if (disposed) return;
					timer = window.setTimeout(() => {
						load();
					}, POLL_MS);
				};
				async function load() {
					if (disposed) return;
					const controller = new AbortController();
					controllerRef.current = controller;
					try {
						const result = await api.subagentsLive(targetRootId, controller.signal);
						if (!disposed) setLive(result.live);
					} catch {} finally {
						if (controllerRef.current === controller) controllerRef.current = void 0;
						if (!disposed) schedule();
					}
				}
				load();
				return () => {
					disposed = true;
					if (timer !== void 0) window.clearTimeout(timer);
					controllerRef.current?.abort();
					controllerRef.current = void 0;
				};
			}, [rootId, active]);
			return live;
		}
		/**
		* Render one topology level; branches are always expanded (lazy catalogs).
		* When a level lists more than {@link SUBAGENT_VISIBLE} children, only the
		* LATEST ones render by default — the earlier rows collapse behind a
		* history toggle (per-level state; a fresh catalog page collapses again).
		*/
		function CatalogRows({ parentSessionId, catalog, catalogs, byId, level, currentSessionId, live, openChild, refresh }) {
			const emptyLoading = catalog?.state === "loading" && catalog.entries.length === 0;
			const visibleEntries = (catalog?.entries ?? []).filter((entry) => {
				if (entry.kind === "child") return !(entry.label?.startsWith("Side: ") ?? false);
				return !(byId[entry.id]?.displayTitle.startsWith("Side: ") ?? false);
			});
			const [historyOpen, setHistoryOpen] = (0, react.useState)(false);
			const historyCount = visibleEntries.length - SUBAGENT_VISIBLE;
			const renderEntries = historyCount > 0 && !historyOpen ? visibleEntries.slice(-5) : visibleEntries;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				emptyLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CatalogLoadingRows, {
					parentSessionId,
					byId,
					level
				}),
				catalog?.state === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SubagentView_module_css_default.subagentError,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: catalog.error?.message ?? t("error") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: SubagentView_module_css_default.subagentErrorRetry,
						onClick: () => {
							refresh(parentSessionId);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {}), t("retry")]
					})]
				}),
				historyCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: SubagentView_module_css_default.historyToggle,
					"aria-expanded": historyOpen,
					onClick: () => {
						setHistoryOpen((open) => !open);
					},
					children: [historyOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {}), historyOpen ? t("subagentHideHistory") : t("subagentShowHistory", { count: historyCount })]
				}),
				renderEntries.map((entry) => {
					if (entry.kind === "diagnostic") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SubagentView_module_css_default.subagentNode,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							role: "treeitem",
							"aria-disabled": "true",
							"aria-level": level,
							className: `${SubagentView_module_css_default.subagentRow} ${SubagentView_module_css_default.subagentRowDisabled}`,
							title: diagnosticReason(entry),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
								state: "error",
								className: SubagentView_module_css_default.subagentDot
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SubagentView_module_css_default.subagentContent,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SubagentView_module_css_default.subagentLabel,
									children: entry.id
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SubagentView_module_css_default.subagentSecondary,
									children: diagnosticReason(entry)
								})]
							})]
						})
					}, entry.id);
					const childCatalog = catalogs[entry.id];
					const knownLeaf = !entry.hasChildren;
					const summary = byId[entry.id];
					const label = childLabel(entry, summary);
					const secondary = cardSecondary(summary, entry);
					const childLoading = childCatalog === void 0 || childCatalog.state === "loading" && childCatalog.entries.length === 0;
					const address = {
						parentSessionId,
						childSessionId: entry.id,
						mode: entry.mode
					};
					const current = entry.id === currentSessionId;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SubagentView_module_css_default.subagentNode,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							role: "treeitem",
							tabIndex: 0,
							"aria-level": level,
							"aria-label": `${label} ${secondary}`,
							"aria-current": current ? "true" : void 0,
							...knownLeaf ? {} : { "aria-expanded": true },
							className: clsx(SubagentView_module_css_default.subagentRow, current && SubagentView_module_css_default.subagentRowActive),
							onClick: () => {
								openChild(address);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									event.stopPropagation();
									openChild(address);
								}
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
								state: entry.activity === "running" ? "ongoing" : "done",
								className: SubagentView_module_css_default.subagentDot
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SubagentView_module_css_default.subagentContent,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SubagentView_module_css_default.subagentLabel,
										children: label
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SubagentView_module_css_default.subagentSecondary,
										children: secondary
									}),
									entry.activity === "running" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentLiveLines, { live: live[entry.id] })
								]
							})]
						}), !knownLeaf && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							className: SubagentView_module_css_default.subagentChildren,
							"aria-busy": childLoading || void 0,
							children: childCatalog === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CatalogLoadingRows, {
								parentSessionId: entry.id,
								byId,
								level: level + 1
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CatalogRows, {
								parentSessionId: entry.id,
								catalog: childCatalog,
								catalogs,
								byId,
								level: level + 1,
								currentSessionId,
								live,
								openChild,
								refresh
							})
						})]
					}, entry.id);
				})
			] });
		}
		/**
		* The shared output dock of the jobs section: ONE pane at the bottom of the
		* sidebar body (sticky, terminal-like) shows the SELECTED job's output as
		* the MODEL has read it so far (replayed from the owner session's event
		* log), refreshed every {@link JOB_POLL_MS} while the job runs and the
		* page is visible. The model's `job_output` cursor is never touched — the
		* pane can never steal the agent's bytes, and it stays empty until the
		* agent reads the job. A single dock — not a panel per row — keeps the
		* job list compact and stable when many jobs are running.
		*/
		function JobOutputPane(props) {
			const { ownerSessionId, job, active, onClose } = props;
			const [state, setState] = (0, react.useState)("loading");
			const controllerRef = (0, react.useRef)(void 0);
			const preRef = (0, react.useRef)(null);
			const load = (0, react.useCallback)(async () => {
				controllerRef.current?.abort();
				const controller = new AbortController();
				controllerRef.current = controller;
				try {
					const result = await api.jobOutput({ sessionId: ownerSessionId }, job.id, controller.signal);
					setState(result);
				} catch {
					setState((current) => current === "loading" ? "error" : current);
				}
			}, [ownerSessionId, job.id]);
			(0, react.useEffect)(() => {
				load();
				if (!active || !isJobLive(job)) return;
				const timer = window.setInterval(() => {
					load();
				}, JOB_POLL_MS);
				return () => {
					window.clearInterval(timer);
				};
			}, [
				load,
				active,
				job.status
			]);
			(0, react.useEffect)(() => () => {
				controllerRef.current?.abort();
			}, []);
			(0, react.useEffect)(() => {
				if (!isJobLive(job) || typeof state !== "object" || state.text.length === 0) return;
				const pre = preRef.current;
				if (pre !== null) pre.scrollTop = pre.scrollHeight;
			}, [state, job.status]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SubagentView_module_css_default.jobsPane,
				role: "region",
				"aria-label": `${job.label} ${t("jobs")}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SubagentView_module_css_default.jobsPaneHeader,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
								state: jobDotState(job.status),
								className: SubagentView_module_css_default.jobsPaneDot
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SubagentView_module_css_default.jobsPaneLabel,
								title: job.label,
								children: job.label
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SubagentView_module_css_default.jobsPaneStatus,
								children: [jobStatusLabel(job.status, t), job.detail !== void 0 && job.detail !== "" ? ` · ${job.detail}` : ""]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SubagentView_module_css_default.jobsPaneClose,
								"aria-label": t("close"),
								title: t("close"),
								onClick: onClose,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconStopOutline16, { size: 10 })
							})
						]
					}),
					state === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SubagentView_module_css_default.jobsPaneHint,
						children: t("loading")
					}),
					state === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${SubagentView_module_css_default.jobsPaneHint} ${SubagentView_module_css_default.jobsPaneError}`,
						children: t("jobOutputError")
					}),
					typeof state === "object" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [state.text.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						ref: preRef,
						className: SubagentView_module_css_default.jobsPanePre,
						children: state.text
					}) : state.read ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SubagentView_module_css_default.jobsPaneHint,
						children: t("jobNoOutput")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SubagentView_module_css_default.jobsPaneHint,
						children: t("jobNotReadYet")
					}), state.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SubagentView_module_css_default.jobsPaneHint,
						children: t("jobOutputTruncated")
					})] })
				]
			});
		}
		/**
		* The background-job section of the Subagent page: every job of the whole
		* current tree (main agent + subagents, owner-labeled), fed by the client
		* jobs-service roster (0.1.7 replaced the old `session/jobs` push mirror;
		* see ./use-jobs-rows.ts). When more than {@link JOBS_VISIBLE} jobs
		* exist, only the head of the standard order (live rows, then newest
		* settled) stays visible — earlier rows collapse behind a history toggle.
		* Clicking a row feeds its model-read output to the shared bottom dock
		* (event replay — never the model's cursor); live rows carry a
		* two-click-confirm kill button. Renders nothing while the tree has no jobs.
		*/
		function JobsSection(props) {
			const { byId, jobsRows, rootId, active } = props;
			const rows = (0, react.useMemo)(() => orderJobs(collectTreeJobs(byId, jobsRows, rootId)), [
				byId,
				jobsRows,
				rootId
			]);
			const [selectedId, setSelectedId] = (0, react.useState)(void 0);
			const [historyOpen, setHistoryOpen] = (0, react.useState)(false);
			const [armedId, setArmedId] = (0, react.useState)(void 0);
			const [killingId, setKillingId] = (0, react.useState)(void 0);
			const [killErrorId, setKillErrorId] = (0, react.useState)(void 0);
			const [now, setNow] = (0, react.useState)(() => Date.now());
			const selectedRow = (0, react.useMemo)(() => selectedId === void 0 ? void 0 : rows.find((row) => row.job.id === selectedId), [rows, selectedId]);
			const liveCount = (0, react.useMemo)(() => rows.reduce((count, row) => count + (isJobLive(row.job) ? 1 : 0), 0), [rows]);
			const multiOwner = (0, react.useMemo)(() => new Set(rows.map((row) => row.ownerSessionId)).size > 1, [rows]);
			(0, react.useEffect)(() => {
				if (armedId === void 0) return;
				const timer = window.setTimeout(() => {
					setArmedId(void 0);
				}, JOB_KILL_ARM_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [armedId]);
			(0, react.useEffect)(() => {
				if (liveCount === 0) return;
				setNow(Date.now());
				const timer = window.setInterval(() => {
					setNow(Date.now());
				}, 1e3);
				return () => {
					window.clearInterval(timer);
				};
			}, [liveCount]);
			(0, react.useEffect)(() => {
				if (selectedId !== void 0 && selectedRow === void 0) setSelectedId(void 0);
			}, [selectedId, selectedRow]);
			const kill = (0, react.useCallback)(async (row) => {
				setKillingId(row.job.id);
				setKillErrorId(void 0);
				try {
					await api.jobKill({ sessionId: row.ownerSessionId }, row.job.id);
				} catch {
					setKillErrorId(row.job.id);
				} finally {
					setKillingId(void 0);
					setArmedId(void 0);
				}
			}, []);
			if (rows.length === 0) return null;
			const countLabel = liveCount > 0 ? t("jobsCountRunning", {
				count: rows.length,
				running: liveCount
			}) : t("jobsCount", { count: rows.length });
			const historyCount = rows.length - JOBS_VISIBLE;
			const visibleRows = historyCount > 0 && !historyOpen ? rows.slice(0, JOBS_VISIBLE) : rows;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: SubagentView_module_css_default.jobs,
				"aria-label": t("jobs"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SubagentView_module_css_default.jobsHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SubagentView_module_css_default.jobsTitle,
							children: t("jobs")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SubagentView_module_css_default.jobsCount,
							children: countLabel
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: SubagentView_module_css_default.jobsList,
						"aria-label": t("jobs"),
						children: visibleRows.map((row) => {
							const { job } = row;
							const live = isJobLive(job);
							const selected = selectedId === job.id;
							const armed = armedId === job.id;
							const killing = killingId === job.id;
							const killFailed = killErrorId === job.id;
							const elapsed = live ? now - job.startedAt : (job.finishedAt ?? job.startedAt) - job.startedAt;
							const secondary = [
								...multiOwner ? [row.ownerTitle] : [],
								jobStatusLabel(job.status, t),
								...job.detail !== void 0 && job.detail !== "" ? [job.detail] : [],
								formatJobDuration(elapsed, t)
							].filter(Boolean).join(" · ");
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: clsx(SubagentView_module_css_default.jobsRow, !live && SubagentView_module_css_default.jobsRowSettled, selected && SubagentView_module_css_default.jobsRowSelected),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: SubagentView_module_css_default.jobsRowMain,
										"aria-pressed": selected,
										"aria-label": `${job.label} ${secondary}`,
										onClick: () => {
											setSelectedId(selected ? void 0 : job.id);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
											state: jobDotState(job.status),
											className: SubagentView_module_css_default.jobsDot
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: SubagentView_module_css_default.jobsContent,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: SubagentView_module_css_default.jobsLabelLine,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: SubagentView_module_css_default.jobsKind,
													children: job.kind
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: SubagentView_module_css_default.jobsLabel,
													title: job.label,
													children: job.label
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: SubagentView_module_css_default.jobsSecondary,
												children: secondary
											})]
										})]
									}),
									job.status === "running" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: armed ? `${SubagentView_module_css_default.jobsKill} ${SubagentView_module_css_default.jobsKillArmed}` : SubagentView_module_css_default.jobsKill,
										"aria-label": armed ? t("jobKillConfirm") : t("jobKill"),
										title: armed ? t("jobKillConfirm") : t("jobKill"),
										disabled: killing,
										onClick: (event) => {
											event.stopPropagation();
											if (armed) kill(row);
											else setArmedId(job.id);
										},
										children: armed ? t("jobKillConfirm") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconStopOutline16, { size: 12 })
									}),
									killFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SubagentView_module_css_default.jobsKillError,
										children: t("jobKillError")
									})
								]
							}, job.id);
						})
					}),
					historyCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: SubagentView_module_css_default.historyToggle,
						"aria-expanded": historyOpen,
						onClick: () => {
							setHistoryOpen((open) => !open);
						},
						children: [historyOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {}), historyOpen ? t("jobsHideHistory") : t("jobsShowHistory", { count: historyCount })]
					})
				]
			}), selectedRow !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(JobOutputPane, {
				ownerSessionId: selectedRow.ownerSessionId,
				job: selectedRow.job,
				active,
				onClose: () => {
					setSelectedId(void 0);
				}
			})] });
		}
		/**
		* The sidebar's Subagent topology page.
		* @param props - current session id, whether the page is actually visible
		*   (active tab + open panel), the client context, and an optional
		*   jump-notify hook fired right before `openSubagent` (lets the sidebar
		*   shell re-open the Subagent page after the conversation switch lands on
		*   the child session).
		* @returns the main agent's topology tree, or the empty/error/loading states.
		*/
		function SubagentView(props) {
			const { sessionId, active, ctx, onOpenChild } = props;
			const sessions = ctx.sessions;
			const list = (0, react.useSyncExternalStore)((0, react.useMemo)(() => (callback) => sessions.list.subscribe(callback), [sessions]), (0, react.useCallback)(() => sessions.list.getSnapshot(), [sessions]));
			const byId = list.byId;
			const catalogs = (0, react.useMemo)(() => deriveCatalogs(list.projectionsBySession, byId), [list.projectionsBySession, byId]);
			const rootId = (0, react.useMemo)(() => rootAncestor(byId, sessionId), [byId, sessionId]);
			const rootCatalog = rootId === void 0 ? void 0 : catalogs[rootId];
			const rootSummary = rootId === void 0 ? void 0 : byId[rootId];
			const live = useSubagentLive(rootId, active);
			const treeIds = (0, react.useMemo)(() => [...treeSessionIds(byId, rootId)], [byId, rootId]);
			const jobsRows = useJobsRows(ctx, treeIds);
			const refreshProjections = sessions.refreshProjections;
			/** Branches already asked for on this tree activation (a failed read retries). */
			const requestedRef = (0, react.useRef)(/* @__PURE__ */ new Set());
			(0, react.useEffect)(() => {
				if (rootId === void 0 || !active) return;
				requestedRef.current.clear();
				return () => {
					requestedRef.current.clear();
				};
			}, [rootId, active]);
			(0, react.useEffect)(() => {
				if (!active || refreshProjections === void 0) return;
				for (const id of treeIds) {
					if (requestedRef.current.has(id)) continue;
					requestedRef.current.add(id);
					refreshProjections.call(sessions, id).catch(() => {
						requestedRef.current.delete(id);
					});
				}
			}, [
				active,
				treeIds,
				refreshProjections,
				sessions
			]);
			const openChild = (0, react.useCallback)((address) => {
				onOpenChild?.(address);
				const outcome = openViaUiWorkspace(ctx, address, sessions);
				if (outcome !== "opened") console.warn(`[dsh-coding-sidebar] openSubagent ${outcome}:`, address);
			}, [
				ctx,
				sessions,
				onOpenChild
			]);
			/** Jump back to the main agent (the topology root) from its node. */
			const openMain = (0, react.useCallback)(() => {
				if (rootId === void 0) return;
				const outcome = openViaUiWorkspace(ctx, rootId, sessions);
				if (outcome !== "opened") console.warn(`[dsh-coding-sidebar] open session ${outcome}:`, rootId);
			}, [
				ctx,
				sessions,
				rootId
			]);
			const refresh = (0, react.useCallback)((parentSessionId) => {
				sessions.refreshProjections?.(parentSessionId);
			}, [sessions]);
			const totals = (0, react.useMemo)(() => rootId === void 0 ? {
				count: 0,
				runningCount: 0
			} : countSubagentDescendants(byId, rootId), [byId, rootId]);
			const summaryBackedLoading = rootId !== void 0 && (rootCatalog === void 0 || rootCatalog.state === "ready" && rootCatalog.entries.length === 0) && directChildren(byId, rootId).length > 0;
			const readyEmpty = rootCatalog?.state === "ready" && rootCatalog.entries.length === 0 && directChildren(byId, rootId ?? "").length === 0;
			const countLabel = totals.count === 0 ? void 0 : totals.runningCount > 0 ? t("subagentCountRunning", {
				count: totals.count,
				running: totals.runningCount
			}) : t("subagentCount", { count: totals.count });
			/** Arrow-key tree navigation over the visible rows (official catalog recipe). */
			const bodyRef = (0, react.useRef)(null);
			const focusAt = (0, react.useCallback)((index) => {
				const items = bodyRef.current?.querySelectorAll("[role=\"treeitem\"]:not([aria-disabled=\"true\"])") ?? [];
				if (items.length === 0) return;
				items[(index + items.length) % items.length]?.focus();
			}, []);
			const onTreeKeyDown = (0, react.useCallback)((event) => {
				const items = bodyRef.current?.querySelectorAll("[role=\"treeitem\"]:not([aria-disabled=\"true\"])") ?? [];
				const index = Array.prototype.indexOf.call(items, document.activeElement);
				if (event.key === "ArrowDown") {
					event.preventDefault();
					focusAt(index + 1);
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					focusAt(index < 0 ? items.length - 1 : index - 1);
				} else if (event.key === "Home") {
					event.preventDefault();
					focusAt(0);
				} else if (event.key === "End") {
					event.preventDefault();
					focusAt(items.length - 1);
				}
			}, [focusAt]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SubagentView_module_css_default.subagent,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SubagentView_module_css_default.subagentHeader,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SubagentView_module_css_default.subagentTitle,
							children: [t("subagent"), rootSummary?.displayTitle !== void 0 && rootSummary.displayTitle !== "" ? ` · ${rootSummary.displayTitle}` : ""]
						}),
						countLabel !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SubagentView_module_css_default.subagentCount,
							children: countLabel
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SubagentView_module_css_default.subagentRefresh,
							"aria-label": t("refresh"),
							title: t("refresh"),
							disabled: rootId === void 0,
							onClick: () => {
								if (rootId !== void 0) refresh(rootId);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: bodyRef,
					className: SubagentView_module_css_default.subagentBody,
					onKeyDown: onTreeKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "tree",
						"aria-label": t("subagent"),
						"aria-busy": summaryBackedLoading || void 0,
						children: [
							rootId !== void 0 && rootSummary !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								role: "treeitem",
								tabIndex: 0,
								"aria-level": 0,
								"aria-label": `${rootSummary.displayTitle !== "" ? rootSummary.displayTitle : t("subagentMainAgent")} ${t("subagentMainAgent")}`,
								"aria-current": rootId === sessionId ? "true" : void 0,
								className: clsx(SubagentView_module_css_default.subagentRow, rootId === sessionId && SubagentView_module_css_default.subagentRowActive),
								onClick: openMain,
								onKeyDown: (event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										event.stopPropagation();
										openMain();
									}
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
									state: rootSummary.running === true ? "ongoing" : "done",
									className: SubagentView_module_css_default.subagentDot
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SubagentView_module_css_default.subagentContent,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SubagentView_module_css_default.subagentLabel,
										children: rootSummary.displayTitle !== "" ? rootSummary.displayTitle : t("subagentMainAgent")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SubagentView_module_css_default.subagentSecondary,
										children: `${t("subagentMainAgent")} · ${rootSummary.running === true ? t("subagentRunning") : t("subagentInactive")}`
									})]
								})]
							}),
							rootId !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SubagentView_module_css_default.subagentChildren,
								role: "group",
								"aria-busy": summaryBackedLoading || void 0,
								children: [summaryBackedLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CatalogLoadingRows, {
									parentSessionId: rootId,
									byId,
									level: 1
								}), !summaryBackedLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CatalogRows, {
									parentSessionId: rootId,
									catalog: rootCatalog,
									catalogs,
									byId,
									level: 1,
									currentSessionId: sessionId,
									live,
									openChild,
									refresh
								})]
							}),
							readyEmpty && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SubagentView_module_css_default.subagentEmpty,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("subagentEmpty") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: SubagentView_module_css_default.subagentEmptyHint,
									children: t("subagentEmptyDesc")
								})]
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(JobsSection, {
						byId,
						jobsRows,
						rootId,
						active
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/team-model.ts
		/** The blank draft every create form starts from. */
		const EMPTY_TEAM_DRAFT = {
			subject: "",
			description: "",
			blockers: "",
			scopes: ""
		};
		/**
		* Parse one comma-separated list into unique non-empty items (`scopes`).
		* @param value - raw input.
		* @returns trimmed, de-duplicated items in first-seen order.
		*/
		function teamItems(value) {
			return [...new Set(value.split(",").map((item) => item.trim()).filter((item) => item !== ""))];
		}
		/** Parse a comma-separated list of task ids (the blocker field). */
		function teamTaskIds(value) {
			return teamItems(value);
		}
		/** Whether a draft carries the two fields the service requires. */
		function isTeamDraftCommittable(draft) {
			return draft.subject.trim() !== "" && draft.description.trim() !== "";
		}
		/** Seed an edit draft from one task row. */
		function teamDraftOfTask(task) {
			return {
				subject: task.subject,
				description: task.description,
				blockers: task.blockedBy.join(", "),
				scopes: task.writeScopes.join(", ")
			};
		}
		/** Whether two dependency lists are identical (the edit form skips a no-op write). */
		function sameTeamDependencies(left, right) {
			return left.length === right.length && left.every((id, index) => id === right[index]);
		}
		/**
		* Normalize one service mutation result.
		* @param result - the upstream business result.
		* @returns the outcome the tab acts on.
		*/
		function teamMutationOutcome(result) {
			if (result.ok) return {
				kind: "ok",
				task: result.value
			};
			if (result.error.code === "team-task-conflict") return { kind: "conflict" };
			return {
				kind: "rejected",
				code: result.error.code,
				message: result.error.message
			};
		}
		/** One-line failure copy for a remote/business error (upstream's format). */
		function teamFailureText(error) {
			return `${error.message} (${error.code})`;
		}
		/** The task-status copy key (deleted rows never reach the board). */
		function teamTaskStatusKey(status) {
			switch (status) {
				case "pending": return "statusPending";
				case "in_progress": return "statusInProgress";
				case "completed": return "statusCompleted";
				case "deleted": return "statusCompleted";
			}
		}
		/** The member-status copy key. */
		function teamMemberStatusKey(status) {
			switch (status) {
				case "running": return "memberRunning";
				case "idle": return "memberIdle";
				case "inactive": return "memberInactive";
				case "provisioning": return "memberProvisioning";
				case "failed": return "memberFailed";
			}
		}
		/** The state-dot tone one member row shows. */
		function teamMemberTone(status) {
			if (status === "running") return "ongoing";
			if (status === "failed") return "error";
			return "done";
		}
		/** Whether a member row can be opened (teammates only, and only while live). */
		function isTeamMemberOpenable(member) {
			return member.role === "teammate" && member.status !== "failed" && member.status !== "provisioning";
		}
		/** Whether a member can be assigned a task. */
		function isTeamMemberAssignable(member) {
			return member.status !== "failed" && member.status !== "provisioning";
		}
		//#endregion
		//#region \0dsh-css:/Users/libing/kk_Projects/dsh-coding-sidebar/src/client/TeamView.module.css.mjs
		const css$2 = ".bKts_G_root{height:100%;min-height:0;font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-primary);flex-direction:column;display:flex;overflow-y:auto}.bKts_G_toolbar{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;align-items:center;gap:6px;padding:6px 8px;display:flex}.bKts_G_toolbarTitle{align-items:center;gap:6px;font-weight:600;display:inline-flex}.bKts_G_spacer{flex:1}.bKts_G_count{background:var(--dsw-alias-interactive-bg-hover);min-width:18px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-11);text-align:center;border-radius:9px;padding:0 5px}.bKts_G_iconButton{width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;justify-content:center;align-items:center;display:inline-flex}.bKts_G_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.bKts_G_section{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;padding:8px}.bKts_G_sectionHead{justify-content:space-between;align-items:center;gap:6px;display:flex}.bKts_G_sectionTitle{font:var(--dsw-font-xxxs-11);text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);margin:0 0 6px;font-weight:600}.bKts_G_roster{flex-direction:column;gap:4px;display:flex}.bKts_G_member{width:100%;color:inherit;text-align:left;cursor:pointer;background:0 0;border:1px solid #0000;border-radius:6px;align-items:flex-start;gap:8px;padding:6px 8px;display:flex}.bKts_G_member:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}.bKts_G_member:disabled{cursor:default}.bKts_G_memberText{flex-direction:column;gap:1px;min-width:0;display:flex}.bKts_G_memberName{font-weight:600}.bKts_G_memberText small{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}.bKts_G_diagnostic{color:var(--dsw-alias-state-warn-label)!important}.bKts_G_tasks{flex-direction:column;gap:6px;margin-top:6px;display:flex}.bKts_G_task{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:6px;padding:8px}.bKts_G_taskHead{justify-content:space-between;align-items:baseline;gap:8px;display:flex}.bKts_G_taskStatus{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary)}.bKts_G_taskDesc{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0 0}.bKts_G_meta{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;gap:6px;margin-top:6px;display:flex}.bKts_G_warning{color:var(--dsw-alias-state-warn-label)}.bKts_G_taskActions{flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px;display:flex}.bKts_G_owner{font:var(--dsw-font-xxxs-11);color:var(--dsw-alias-label-tertiary);align-items:center;gap:4px;display:inline-flex}.bKts_G_owner select,.bKts_G_input,.bKts_G_textarea{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxxs-11);border-radius:6px;padding:3px 6px}.bKts_G_input{width:100%}.bKts_G_textarea{resize:vertical;width:100%;min-height:54px}.bKts_G_smallButton{border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-11);cursor:pointer;background:0 0;border-radius:6px;align-items:center;gap:4px;padding:3px 8px;display:inline-flex}.bKts_G_smallButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.bKts_G_smallButton:disabled{opacity:.55;cursor:default}.bKts_G_primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-inverted);font:var(--dsw-font-xxs-strong-12);cursor:pointer;border:none;border-radius:6px;padding:4px 10px}.bKts_G_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.bKts_G_primary:disabled{opacity:.45;cursor:default}.bKts_G_form{flex-direction:column;gap:4px;margin:6px 0;display:flex}.bKts_G_formActions{gap:6px;margin-top:2px;display:flex}.bKts_G_hint{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);padding:10px 8px}.bKts_G_notice{color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary);font:var(--dsw-font-xxxs-11);flex:none;padding:4px 10px}.bKts_G_empty{text-align:left;flex-direction:column;gap:6px;padding:18px 14px;display:flex}.bKts_G_emptyTitle{margin:0;font-weight:600}.bKts_G_emptyDesc{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-11);margin:0}.bKts_G_empty .bKts_G_primary{align-self:flex-start;margin-top:4px}";
		const tagId$2 = "dsh-coding-sidebar/TeamView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-coding-sidebar";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var TeamView_module_css_default = {
			"count": "bKts_G_count",
			"diagnostic": "bKts_G_diagnostic",
			"empty": "bKts_G_empty",
			"emptyDesc": "bKts_G_emptyDesc",
			"emptyTitle": "bKts_G_emptyTitle",
			"form": "bKts_G_form",
			"formActions": "bKts_G_formActions",
			"hint": "bKts_G_hint",
			"iconButton": "bKts_G_iconButton",
			"input": "bKts_G_input",
			"member": "bKts_G_member",
			"memberName": "bKts_G_memberName",
			"memberText": "bKts_G_memberText",
			"meta": "bKts_G_meta",
			"notice": "bKts_G_notice",
			"owner": "bKts_G_owner",
			"primary": "bKts_G_primary",
			"root": "bKts_G_root",
			"roster": "bKts_G_roster",
			"section": "bKts_G_section",
			"sectionHead": "bKts_G_sectionHead",
			"sectionTitle": "bKts_G_sectionTitle",
			"smallButton": "bKts_G_smallButton",
			"spacer": "bKts_G_spacer",
			"task": "bKts_G_task",
			"taskActions": "bKts_G_taskActions",
			"taskDesc": "bKts_G_taskDesc",
			"taskHead": "bKts_G_taskHead",
			"taskStatus": "bKts_G_taskStatus",
			"tasks": "bKts_G_tasks",
			"textarea": "bKts_G_textarea",
			"toolbar": "bKts_G_toolbar",
			"toolbarTitle": "bKts_G_toolbarTitle",
			"warning": "bKts_G_warning"
		};
		//#endregion
		//#region src/client/TeamView.tsx
		/**
		* Agent Teams tab: the roster and shared task board of the Session's team,
		* rendered inside KCoder's own sidebar (产品铁律 1 — upstream's UI surface is
		* not reused; its data plane is).
		*
		* Data comes from this plugin's own host bridge (`team.*` routes → the
		* upstream `ctx.agentTeams` service); the board semantics (compare-and-set
		* mutations, stale-revision conflicts, assignable members) mirror the upstream
		* Team panel exactly, so both surfaces agree on what a task is.
		*
		* The official 「智能体团队」 bundle is opt-in and swaps the subagent tools for
		* the team tools, so this tab never mounts it: when the service is absent the
		* tab shows an enable-me empty state with a jump into the plugin settings
		* (产品决策 2026-09-19).
		*/
		/**
		* The lead Session of this tab's Session: a teammate's Session belongs to the
		* lead's team, exactly as the upstream panel resolves it.
		*/
		function leadSessionOf(ctx, sessionId) {
			try {
				const parent = (ctx.sessions?.binding?.(sessionId))?.session?.getSnapshot().subagent?.address?.parentSessionId;
				return typeof parent === "string" && parent !== "" ? parent : sessionId;
			} catch {
				return sessionId;
			}
		}
		/**
		* Best-effort jump into 设置 → 插件 (产品决策：空态带"去启用"入口).
		*
		* There is no programmatic settings-navigation API in the shipped client, so
		* this drives the two real DOM affordances: the settings trigger (the
		* `_trigger` + `aria-haspopup="dialog"` combination the SettingsRoot owns —
		* the same anchor KCoder's account menu uses) and then the 插件 entry inside
		* the opened surface by its visible text. Both steps are best-effort: a miss
		* leaves the user in the settings page, which is where they need to be.
		*/
		function openPluginSettings() {
			try {
				const trigger = document.querySelector("button[class*=\"_trigger\"][aria-haspopup=\"dialog\"]");
				if (trigger instanceof HTMLElement) trigger.click();
				window.setTimeout(() => {
					const hit = [...document.querySelectorAll("[role=\"tab\"], [role=\"menuitem\"], button, a")].find((el) => /插件|Plugins/.test((el.textContent ?? "").trim()));
					if (hit instanceof HTMLElement) hit.click();
				}, 320);
			} catch {}
		}
		function TeamView(props) {
			const { ctx, scope } = props;
			const sessionId = scope.sessionId;
			const leadId = (0, react.useMemo)(() => leadSessionOf(ctx, sessionId), [ctx, sessionId]);
			const leadScope = (0, react.useMemo)(() => ({
				...scope,
				sessionId: leadId
			}), [scope, leadId]);
			const [state, setState] = (0, react.useState)({ status: "loading" });
			const [creating, setCreating] = (0, react.useState)(false);
			const [createDraft, setCreateDraft] = (0, react.useState)(EMPTY_TEAM_DRAFT);
			const [editing, setEditing] = (0, react.useState)(null);
			const [editDraft, setEditDraft] = (0, react.useState)(EMPTY_TEAM_DRAFT);
			const [pending, setPending] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [notice, setNotice] = (0, react.useState)(null);
			/** Guards late responses after the tab switched sessions or unmounted. */
			const generation = (0, react.useRef)(0);
			/** Load the roster + board; the caller's identity is the lead Session. */
			const refresh = (0, react.useCallback)(async () => {
				const mine = ++generation.current;
				try {
					const result = await api.teamView(leadScope);
					if (generation.current !== mine) return false;
					if (!result.available) {
						setState({
							status: "unavailable",
							reason: result.reason
						});
						return false;
					}
					setState({
						status: "ready",
						view: result.view
					});
					return true;
				} catch (error) {
					if (generation.current !== mine) return false;
					setState({
						status: "error",
						message: error instanceof Error ? error.message : String(error)
					});
					return false;
				}
			}, [leadScope]);
			(0, react.useEffect)(() => {
				generation.current += 1;
				setState({ status: "loading" });
				setCreating(false);
				setCreateDraft(EMPTY_TEAM_DRAFT);
				setEditing(null);
				setNotice(null);
				refresh();
			}, [refresh]);
			const markPending = (0, react.useCallback)((key, on) => {
				setPending((current) => {
					const next = new Set(current);
					if (on) next.add(key);
					else next.delete(key);
					return next;
				});
			}, []);
			/**
			* Run one mutation, then reload: a stale-revision rejection says so and the
			* board refreshes to the winner's state (upstream's conflict semantics).
			*/
			const mutate = (0, react.useCallback)(async (key, operation) => {
				markPending(key, true);
				try {
					const envelope = await operation();
					if (!envelope.available) {
						setState({
							status: "unavailable",
							reason: envelope.reason
						});
						return;
					}
					const outcome = teamMutationOutcome(envelope.result);
					if (outcome.kind === "rejected") {
						setNotice(teamFailureText(outcome));
						return;
					}
					if (outcome.kind === "conflict") {
						if (await refresh()) setNotice(t("teamConflict"));
						return;
					}
					setNotice(null);
					await refresh();
					return outcome.task;
				} catch (error) {
					setNotice(error instanceof Error ? error.message : String(error));
					return;
				} finally {
					markPending(key, false);
				}
			}, [markPending, refresh]);
			const submitCreate = (0, react.useCallback)(async () => {
				if (!isTeamDraftCommittable(createDraft)) return;
				markPending("create", true);
				try {
					const envelope = await api.teamCreateTask(leadScope, {
						subject: createDraft.subject.trim(),
						description: createDraft.description.trim(),
						blockedBy: teamTaskIds(createDraft.blockers),
						writeScopes: teamItems(createDraft.scopes)
					});
					if (!envelope.available) {
						setState({
							status: "unavailable",
							reason: envelope.reason
						});
						return;
					}
					const outcome = teamMutationOutcome(envelope.result);
					if (outcome.kind === "conflict") {
						await refresh();
						setNotice(t("teamConflict"));
						return;
					}
					if (outcome.kind === "rejected") {
						setNotice(teamFailureText(outcome));
						return;
					}
					setNotice(null);
					setCreateDraft(EMPTY_TEAM_DRAFT);
					setCreating(false);
					await refresh();
				} catch (error) {
					setNotice(error instanceof Error ? error.message : String(error));
				} finally {
					markPending("create", false);
				}
			}, [
				createDraft,
				leadScope,
				markPending,
				refresh
			]);
			const submitEdit = (0, react.useCallback)(async (task) => {
				const edited = await mutate(task.id, () => api.teamUpdateTask(leadScope, {
					taskId: task.id,
					expectedRevision: task.revision,
					action: "edit",
					subject: editDraft.subject.trim(),
					description: editDraft.description.trim(),
					writeScopes: teamItems(editDraft.scopes)
				}));
				if (edited === void 0) return;
				const blockedBy = teamTaskIds(editDraft.blockers);
				if (sameTeamDependencies(blockedBy, edited.blockedBy)) {
					setEditing(null);
					return;
				}
				if (await mutate(task.id, () => api.teamUpdateTask(leadScope, {
					taskId: task.id,
					expectedRevision: edited.revision,
					action: "set_dependencies",
					blockedBy
				})) === void 0) return;
				setEditing(null);
			}, [
				editDraft,
				leadScope,
				mutate
			]);
			const openTeammate = (0, react.useCallback)((member) => {
				if (!isTeamMemberOpenable(member)) return;
				const sessions = ctx.sessions;
				try {
					sessions?.refreshProjections?.(leadId);
				} catch {}
				try {
					openViaUiWorkspace(ctx, {
						parentSessionId: leadId,
						childSessionId: member.id,
						mode: "continuable"
					});
				} catch {}
			}, [ctx, leadId]);
			const view = state.status === "ready" ? state.view : null;
			const teammates = view?.members.filter((member) => member.role === "teammate") ?? [];
			const assignable = view?.members.filter(isTeamMemberAssignable) ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: TeamView_module_css_default.root,
				"data-team-tab": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TeamView_module_css_default.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: TeamView_module_css_default.toolbarTitle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineRegular, { size: 14 }), t("teamTitle")]
							}),
							teammates.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: TeamView_module_css_default.count,
								children: teammates.length
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: TeamView_module_css_default.spacer }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: TeamView_module_css_default.iconButton,
								"aria-label": t("teamRefresh"),
								title: t("teamRefresh"),
								onClick: () => {
									refresh();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
							})
						]
					}),
					notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: TeamView_module_css_default.notice,
						role: "alert",
						children: notice
					}),
					state.status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: TeamView_module_css_default.hint,
						children: t("teamLoading")
					}),
					state.status === "unavailable" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TeamView_module_css_default.empty,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: TeamView_module_css_default.emptyTitle,
								children: t("teamUnavailableTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: TeamView_module_css_default.emptyDesc,
								children: state.reason === "service-missing" ? t("teamUnavailableService") : t("teamUnavailableAgent")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: TeamView_module_css_default.primary,
								onClick: openPluginSettings,
								children: t("teamOpenPluginSettings")
							})
						]
					}),
					state.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: TeamView_module_css_default.hint,
						role: "alert",
						children: state.message
					}),
					view !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: TeamView_module_css_default.section,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: TeamView_module_css_default.sectionTitle,
							children: t("teamRoster")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: TeamView_module_css_default.roster,
							children: view.members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: TeamView_module_css_default.member,
								disabled: !isTeamMemberOpenable(member),
								title: isTeamMemberOpenable(member) ? t("teamOpenMember") : void 0,
								onClick: () => {
									openTeammate(member);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: teamMemberTone(member.status) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: TeamView_module_css_default.memberText,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: TeamView_module_css_default.memberName,
											children: member.name
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [t(teamMemberStatusKey(member.status)), member.model === void 0 || member.model === "" ? "" : ` · ${member.model}`] }),
										member.description !== void 0 && member.description !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: member.description }),
										member.diagnostics.map((diagnostic) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
											className: TeamView_module_css_default.diagnostic,
											children: diagnostic
										}, diagnostic))
									]
								})]
							}, member.id))
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: TeamView_module_css_default.section,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: TeamView_module_css_default.sectionHead,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: TeamView_module_css_default.sectionTitle,
									children: t("teamTasks")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: TeamView_module_css_default.smallButton,
									onClick: () => {
										setCreating(true);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 13 }),
										" ",
										t("teamCreate")
									]
								})]
							}),
							creating && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamTaskForm, {
								draft: createDraft,
								setDraft: setCreateDraft,
								pending: pending.has("create"),
								onSave: () => {
									submitCreate();
								},
								onCancel: () => {
									setCreating(false);
								}
							}),
							view.tasks.length === 0 && !creating && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: TeamView_module_css_default.hint,
								children: t("teamNoTasks")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: TeamView_module_css_default.tasks,
								children: view.tasks.map((task) => editing === task.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamTaskForm, {
									draft: editDraft,
									setDraft: setEditDraft,
									pending: pending.has(task.id),
									onSave: () => {
										submitEdit(task);
									},
									onCancel: () => {
										setEditing(null);
									}
								}, task.id) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									className: TeamView_module_css_default.task,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: TeamView_module_css_default.taskHead,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: task.subject }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: TeamView_module_css_default.taskStatus,
												children: t(teamTaskStatusKey(task.status))
											})]
										}),
										task.description !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: TeamView_module_css_default.taskDesc,
											children: task.description
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: TeamView_module_css_default.meta,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: task.id }),
												task.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: task.ready ? t("teamReady") : t("teamBlocked") }),
												task.blockedBy.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t("teamBlockedBy"),
													": ",
													task.blockedBy.join(", ")
												] }),
												task.writeScopes.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t("teamWriteScopes"),
													": ",
													task.writeScopes.join(", ")
												] }),
												task.writeScopeWarnings.map((warning) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: TeamView_module_css_default.warning,
													children: warning
												}, warning))
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: TeamView_module_css_default.taskActions,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: TeamView_module_css_default.owner,
													children: [t("teamOwner"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
														value: task.ownerName ?? "",
														disabled: pending.has(task.id) || task.status === "completed",
														onChange: (event) => {
															const owner = event.target.value;
															mutate(task.id, () => api.teamUpdateTask(leadScope, {
																taskId: task.id,
																expectedRevision: task.revision,
																action: "reassign",
																...owner === "" ? {} : { owner }
															}));
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: "",
															children: t("teamUnowned")
														}), assignable.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: member.name,
															children: member.name
														}, member.id))]
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: TeamView_module_css_default.smallButton,
													disabled: pending.has(task.id),
													onClick: () => {
														setEditing(task.id);
														setEditDraft(teamDraftOfTask(task));
													},
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 13 }),
														" ",
														t("teamEdit")
													]
												}),
												task.status === "in_progress" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: TeamView_module_css_default.smallButton,
													disabled: pending.has(task.id),
													onClick: () => {
														mutate(task.id, () => api.teamUpdateTask(leadScope, {
															taskId: task.id,
															expectedRevision: task.revision,
															action: "complete"
														}));
													},
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {}),
														" ",
														t("teamComplete")
													]
												}),
												task.status === "completed" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: TeamView_module_css_default.smallButton,
													disabled: pending.has(task.id),
													onClick: () => {
														mutate(task.id, () => api.teamUpdateTask(leadScope, {
															taskId: task.id,
															expectedRevision: task.revision,
															action: "reopen"
														}));
													},
													children: t("teamReopen")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: TeamView_module_css_default.smallButton,
													disabled: pending.has(task.id),
													onClick: () => {
														mutate(task.id, () => api.teamUpdateTask(leadScope, {
															taskId: task.id,
															expectedRevision: task.revision,
															action: "delete"
														}));
													},
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 13 }),
														" ",
														t("teamDelete")
													]
												})
											]
										})
									]
								}, task.id))
							})
						]
					})] })
				]
			});
		}
		/** The create/edit form (subject, description, blockers, write scopes). */
		function TeamTaskForm(props) {
			const { draft, setDraft, pending, onSave, onCancel } = props;
			const field = (key, value) => {
				setDraft({
					...draft,
					[key]: value
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: TeamView_module_css_default.form,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: TeamView_module_css_default.input,
						value: draft.subject,
						placeholder: t("teamSubject"),
						onChange: (event) => {
							field("subject", event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: TeamView_module_css_default.textarea,
						value: draft.description,
						placeholder: t("teamDescription"),
						onChange: (event) => {
							field("description", event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: TeamView_module_css_default.input,
						value: draft.blockers,
						placeholder: t("teamBlockers"),
						onChange: (event) => {
							field("blockers", event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: TeamView_module_css_default.input,
						value: draft.scopes,
						placeholder: t("teamScopes"),
						onChange: (event) => {
							field("scopes", event.target.value);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: TeamView_module_css_default.formActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: TeamView_module_css_default.primary,
							disabled: pending || !isTeamDraftCommittable(draft),
							onClick: onSave,
							children: t("teamSave")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: TeamView_module_css_default.smallButton,
							disabled: pending,
							onClick: onCancel,
							children: t("teamCancel")
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/markdown-labels.tsx
		/** Build the dual-shape chrome labels from a flat copy-button pair. */
		function markdownChromeLabels(labels) {
			return {
				copyLabel: labels.copyLabel,
				copiedLabel: labels.copiedLabel,
				code: {
					copyLabel: labels.copyLabel,
					copiedLabel: labels.copiedLabel
				},
				footnotes: ""
			};
		}
		/** MarkdownText props carrying the labels under BOTH prop names. The cast is
		*  load-bearing: the plugin builds against the 0.1.1-rc.x declaration, where
		*  `labels` does not exist yet (and vice versa on a 0.1.2-alpha.1+ host). */
		function markdownTextProps(text, labels) {
			const chrome = markdownChromeLabels(labels);
			return {
				text,
				codeLabels: chrome,
				labels: chrome
			};
		}
		//#endregion
		//#region src/client/sidechat-transcript.ts
		/** Extract the visible text of a content-block list (`text` blocks verbatim,
		*  joined by blank lines); empty reads `…` so rows never render blank. */
		function blockText(content) {
			const parts = [];
			for (const block of content) {
				if (block === null || typeof block !== "object") continue;
				const candidate = block;
				if (candidate.type === "text" && typeof candidate.text === "string") parts.push(candidate.text);
			}
			const text = parts.join("\n\n");
			return text === "" ? "…" : text;
		}
		/** Cap for a tool row's one-line argument summary (display only). */
		const ARGS_SUMMARY_MAX = 80;
		/** The most identifying argument keys, in priority order (bash's command,
		*  fs tools' paths, search's pattern, …). */
		const ARGS_SUMMARY_KEYS = [
			"command",
			"file_path",
			"path",
			"pattern",
			"query",
			"url",
			"prompt"
		];
		function flatTruncate(text) {
			const flat = text.replace(/\s+/g, " ").trim();
			return flat.length > ARGS_SUMMARY_MAX ? `${flat.slice(0, 79)}…` : flat;
		}
		/**
		* One-line summary of a tool call's raw arguments JSON for the collapsed
		* row: the first identifying string field when the JSON parses, else the
		* flattened raw text; empty when there is nothing worth showing.
		*/
		function toolArgsSummary(args) {
			if (args === void 0) return "";
			try {
				const parsed = JSON.parse(args);
				if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) for (const key of ARGS_SUMMARY_KEYS) {
					const value = parsed[key];
					if (typeof value === "string" && value.trim() !== "") return flatTruncate(value);
				}
			} catch {}
			return flatTruncate(args);
		}
		/** The plain text of a tool/result message (text blocks inside its
		*  `tool-result` content block). */
		function resultTextOf(data) {
			const content = data.message?.content;
			if (!Array.isArray(content)) return "";
			const parts = [];
			for (const block of content) {
				if (block === null || typeof block !== "object") continue;
				const candidate = block;
				if (candidate.type !== "tool-result") continue;
				const inner = candidate.content;
				if (!Array.isArray(inner)) continue;
				for (const item of inner) {
					if (item === null || typeof item !== "object") continue;
					const textItem = item;
					if (textItem.type === "text" && typeof textItem.text === "string") parts.push(textItem.text);
				}
			}
			return parts.join("\n");
		}
		/** Index of the last `session/end-seed` event (fork seed marker), or -1. */
		function lastSeedEnd(events) {
			for (let index = events.length - 1; index >= 0; index--) if (events[index]?.type === "session/end-seed") return index;
			return -1;
		}
		/**
		* Collect the thread's OWN events on first attach: walk backward from the
		* log tail (oldest-first accumulation) until the `session/end-seed` marker
		* surfaces, then keep everything after it.
		*
		* Page size matters: cold reads re-expand persisted chunk-rows into one
		* `assistant/chunk` event per delta, so a single streamed answer can be
		* HUNDREDS of events. A small walk window (the old 8×32 = 256 events) let
		* earlier `tool/call` events fall out of the loaded window — the tool rows
		* vanished on re-entry while the settled text survived. The walk therefore
		* pages big; tail polls stay small.
		*
		* Exhaustion (log start reached without a marker — a thread created before
		* seeding existed, or a pathological log) returns `seedBoundary: 0` so the
		* caller stops re-walking and renders the window as-is.
		*
		* @param fetchPage - one history page (newest-first window ending at
		*   `beforeSeq`, exclusive; omit for the tail page).
		* @param pageCap - safety bound on backward pages.
		*/
		async function collectOwnEvents(fetchPage, pageCap = 40) {
			const collected = [];
			let beforeSeq;
			for (let page = 0; page < pageCap; page++) {
				const events = await fetchPage(beforeSeq);
				if (events.length === 0) return {
					seedBoundary: 0,
					entries: collected
				};
				const olderThan = collected.length > 0 ? collected[0].event.seq : void 0;
				const fresh = olderThan === void 0 ? [...events] : events.filter((entry) => entry.event.seq < olderThan);
				const seedEnd = fresh.findLastIndex((entry) => entry.event.type === "session/end-seed");
				if (seedEnd >= 0) {
					collected.unshift(...fresh.slice(seedEnd + 1));
					return {
						seedBoundary: fresh[seedEnd].event.seq,
						entries: collected
					};
				}
				collected.unshift(...fresh);
				if (fresh.length === 0) return {
					seedBoundary: 0,
					entries: collected
				};
				beforeSeq = fresh[0].event.seq;
			}
			return {
				seedBoundary: 0,
				entries: collected
			};
		}
		/**
		* Map a thread child's history rows onto compact transcript rows: the
		* inherited fork seed is cut at the last `session/end-seed`, context
		* injections map onto a collapsible injection row, `assistant/chunk`
		* deltas accumulate into streaming rows per (turn, step, block) and are
		* superseded by the assembled `assistant/message`, and tool invocations
		* render one expandable line each (arguments, paired result text, failure
		* marker; a still-executing call is marked until its result lands).
		* @param entries - history rows (event + host-computed view) in seq order.
		* @returns display rows in log order.
		*/
		function transcriptRows(entries) {
			const events = entries.map((entry) => entry.event);
			const seedEnd = lastSeedEnd(events);
			const rows = [];
			/** (turn, step, index, kind) key → index of its accumulating stream row. */
			const streamRows = /* @__PURE__ */ new Map();
			/** tool callId → index of its tool row in `rows` (result pairing). */
			const callRows = /* @__PURE__ */ new Map();
			for (let index = 0; index < events.length; index++) {
				if (index <= seedEnd) continue;
				const event = events[index];
				if (event === void 0) continue;
				const data = event.data;
				switch (event.type) {
					case "user/message": {
						const text = blockText(Array.isArray(data.content) ? data.content : []);
						if (isContextInjectionMessage(data)) {
							if (data.source?.kind === "user" && text.startsWith(`${SIDE_BOUNDARY_PROMPT}\n\n`)) {
								rows.push({
									kind: "injection",
									seq: event.seq,
									text: SIDE_BOUNDARY_PROMPT
								});
								const body = text.slice(SIDE_BOUNDARY_PROMPT.length + 2);
								if (body !== "") rows.push({
									kind: "user",
									seq: event.seq,
									text: body
								});
								break;
							}
							rows.push({
								kind: "injection",
								seq: event.seq,
								text
							});
							break;
						}
						rows.push({
							kind: "user",
							seq: event.seq,
							text
						});
						break;
					}
					case "assistant/chunk": {
						const chunk = data.chunk;
						if (chunk === null || typeof chunk !== "object") break;
						const kind = chunk.type === "text-delta" ? "assistant" : chunk.type === "reasoning-delta" ? "reasoning" : null;
						if (kind === null || typeof chunk.text !== "string" || chunk.text === "") break;
						const turn = data.turn;
						const step = data.step;
						const blockIndex = chunk.index;
						const key = `${String(turn)}:${String(step)}:${String(blockIndex)}:${kind}`;
						const existing = streamRows.get(key);
						if (existing !== void 0) {
							const row = rows[existing];
							if (row !== void 0 && row.kind === kind && !row.settled) rows[existing] = {
								...row,
								text: row.text + chunk.text
							};
						} else {
							streamRows.set(key, rows.length);
							rows.push({
								kind,
								seq: event.seq,
								text: chunk.text,
								settled: false
							});
						}
						break;
					}
					case "assistant/message": {
						const prefix = `${String(data.turn)}:${String(data.step)}:`;
						const streamed = [...streamRows.entries()].filter(([key]) => key.startsWith(prefix)).map(([, rowIndex]) => rowIndex);
						for (const key of [...streamRows.keys()]) if (key.startsWith(prefix)) streamRows.delete(key);
						const settled = (Array.isArray(data.message?.content) ? data.message.content : []).flatMap((block) => {
							if (block === null || typeof block !== "object") return [];
							const candidate = block;
							if (candidate.type === "reasoning" && typeof candidate.text === "string" && candidate.text !== "") return [{
								kind: "reasoning",
								seq: event.seq,
								text: candidate.text,
								settled: true
							}];
							if (candidate.type === "text" && typeof candidate.text === "string" && candidate.text !== "") return [{
								kind: "assistant",
								seq: event.seq,
								text: candidate.text,
								settled: true
							}];
							return [];
						});
						if (streamed.length === 0) rows.push(...settled);
						else rows.splice(Math.min(...streamed), streamed.length, ...settled);
						break;
					}
					case "tool/call": {
						const callId = data.callId;
						const name = typeof data.name === "string" ? data.name : "tool";
						const args = typeof data.arguments === "string" ? data.arguments : void 0;
						const rowIndex = rows.length;
						if (typeof callId === "string") callRows.set(callId, rowIndex);
						rows.push({
							kind: "tool",
							seq: event.seq,
							name,
							failed: false,
							args,
							executing: true
						});
						break;
					}
					case "tool/result": {
						const source = data.message;
						const callId = typeof source?.source?.callId === "string" ? source.source.callId : void 0;
						const rowIndex = callId === void 0 ? void 0 : callRows.get(callId);
						const failed = data.error !== void 0;
						const resultText = resultTextOf(data);
						if (rowIndex !== void 0) {
							const row = rows[rowIndex];
							if (row !== void 0 && row.kind === "tool") rows[rowIndex] = {
								...row,
								failed: row.failed || failed,
								resultText: resultText === "" ? row.resultText : resultText,
								executing: false
							};
						} else if (failed || resultText !== "") rows.push({
							kind: "tool",
							seq: event.seq,
							name: callId === void 0 ? "tool" : `tool:${callId.slice(0, 8)}`,
							failed,
							resultText: resultText === "" ? void 0 : resultText
						});
						break;
					}
				}
			}
			return rows;
		}
		//#endregion
		//#region \0dsh-css:/Users/libing/kk_Projects/dsh-coding-sidebar/src/client/SideChatView.module.css.mjs
		const css$1 = "._64UoUa_sidechat{flex-direction:column;flex:1;min-height:0;display:flex}._64UoUa_sidechatDetailHeader{border-bottom:1px solid var(--dsw-alias-border-l);flex:none;align-items:center;gap:4px;min-height:36px;padding:4px 8px 4px 12px;display:flex}._64UoUa_sidechatHeaderDot{flex:none}._64UoUa_sidechatHeaderSpacer{flex:1;min-width:0}._64UoUa_sidechatAgentBadge{border:1px solid var(--dsw-alias-border-l);max-width:55%;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;border-radius:999px;flex:none;padding:1px 8px;overflow:hidden}._64UoUa_sidechatIconBtn{width:26px;height:26px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;flex:none;justify-content:center;align-items:center;padding:0;transition:background-color .1s ease-out,color .1s ease-out;display:inline-flex}._64UoUa_sidechatIconBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._64UoUa_sidechatIconBtn:disabled{opacity:.4;cursor:default}._64UoUa_sidechatHero{min-height:0;color:var(--dsw-alias-label-tertiary);text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:8px;padding:24px 20px;animation:.2s ease-out _64UoUa_sidechatFadeIn;display:flex}._64UoUa_sidechatHeroTitle{font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);font-weight:500}._64UoUa_sidechatHeroDesc{max-width:300px;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);line-height:1.6}._64UoUa_sidechatPrimaryBtn{background:var(--dsw-alias-button-info-fill,var(--dsw-alias-interactive-bg-hover-solid));color:#fff;font:var(--dsw-font-s-14);cursor:pointer;border:none;border-radius:999px;flex:none;margin-top:4px;padding:6px 14px;transition:opacity .1s ease-out}._64UoUa_sidechatPrimaryBtn:hover:not(:disabled){opacity:.88}._64UoUa_sidechatPrimaryBtn:disabled{opacity:.4;cursor:default}._64UoUa_sidechatHint{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);flex:none;padding:4px 12px}._64UoUa_sidechatError{font:var(--dsw-font-xxs-12);color:#d5304d;flex:none;padding:4px 12px}._64UoUa_sidechatScroll{flex-direction:column;flex:1;gap:10px;min-height:0;padding:10px 12px;display:flex;overflow-y:auto}._64UoUa_sidechatScroll>*{animation:.18s ease-out _64UoUa_sidechatRowIn}._64UoUa_sidechatUser{background:var(--dsw-specific-bubble,var(--dsw-alias-bg-base));max-width:88%;font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;border-radius:18px;align-self:flex-end;padding:8px 14px}._64UoUa_sidechatAssistant{font:var(--dsw-font-s-14);color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;align-self:stretch}._64UoUa_sidechatRow{align-self:stretch}._64UoUa_sidechatRowLine{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);align-items:center;gap:6px;padding:1px 0;display:flex}._64UoUa_sidechatRowSummary{cursor:pointer;user-select:none;list-style:none}._64UoUa_sidechatRowSummary::-webkit-details-marker{display:none}._64UoUa_sidechatRowSummary:hover{color:var(--dsw-alias-label-secondary)}._64UoUa_sidechatRowStatic{cursor:default}._64UoUa_sidechatRowChevron{flex:none;align-items:center;transition:transform .1s ease-out;display:inline-flex}._64UoUa_sidechatRow[open] ._64UoUa_sidechatRowChevron{transform:rotate(90deg)}._64UoUa_sidechatRowLabel{text-overflow:ellipsis;white-space:nowrap;max-width:60%;color:var(--dsw-alias-label-secondary);flex:none;overflow:hidden}._64UoUa_sidechatRowMono{font-family:var(--dsw-font-mono)}._64UoUa_sidechatRowMeta{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-family:var(--dsw-font-mono);color:var(--dsw-alias-label-tertiary);flex:1;overflow:hidden}._64UoUa_sidechatRowFailed ._64UoUa_sidechatRowLabel,._64UoUa_sidechatRowFailed ._64UoUa_sidechatRowMeta{color:#d5304d}._64UoUa_sidechatRowBody{border-left:1px solid var(--dsw-alias-border-l);margin:2px 0 4px 7px;padding:2px 0 2px 10px}._64UoUa_sidechatRowProse{font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow-y:auto}._64UoUa_sidechatRowCode{font:var(--dsw-font-xxs-12);font-family:var(--dsw-font-mono);color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;margin:0;padding:4px 0;overflow-y:auto}._64UoUa_sidechatRowCode+._64UoUa_sidechatRowCode{border-top:1px solid var(--dsw-alias-border-l)}._64UoUa_sidechatShimmerText{background-image:linear-gradient(90deg, var(--dsw-alias-label-tertiary) 0%, var(--dsw-alias-label-primary) 50%, var(--dsw-alias-label-tertiary) 100%);color:#0000;background-size:200% 100%;-webkit-background-clip:text;background-clip:text;animation:2.6s linear infinite _64UoUa_sidechatSweep}._64UoUa_sidechatStatus{flex:none;align-items:center;gap:8px;padding:2px 14px 6px;animation:.16s ease-out _64UoUa_sidechatFadeIn;display:flex}._64UoUa_sidechatStatusText{font:var(--dsw-font-xxs-12);background-image:linear-gradient(90deg, var(--dsw-alias-label-tertiary) 0%, var(--dsw-alias-label-primary) 50%, var(--dsw-alias-label-tertiary) 100%);color:#0000;background-size:200% 100%;-webkit-background-clip:text;background-clip:text;animation:2.6s linear infinite _64UoUa_sidechatSweep}._64UoUa_sidechatComposer{border:1px solid var(--dsw-alias-border-l2-darkmode-thin,var(--dsw-alias-border-l));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));box-shadow:var(--dsw-shadow-lv2,none);border-radius:16px;flex-direction:column;flex:none;gap:4px;margin:0 8px 8px;padding:8px 8px 6px 14px;display:flex}._64UoUa_sidechatComposerInput{box-sizing:border-box;width:100%;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);resize:none;background:0 0;border:none;outline:none;max-height:132px;padding:2px 0;line-height:22px}._64UoUa_sidechatComposerInput::placeholder{color:var(--dsw-alias-label-tertiary)}._64UoUa_sidechatComposerBar{flex:none;align-items:center;gap:8px;min-height:28px;display:flex}._64UoUa_sidechatComposerMeta{min-width:0;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}._64UoUa_sidechatSendBtn{background:var(--dsw-alias-button-info-fill,var(--dsw-alias-interactive-bg-hover-solid));color:#fff;cursor:pointer;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;width:28px;height:28px;padding:0;transition:opacity .1s ease-out;animation:.12s ease-out _64UoUa_sidechatBtnIn;display:inline-flex}._64UoUa_sidechatSendBtn:hover:not(:disabled){opacity:.88}._64UoUa_sidechatSendBtn:disabled{opacity:.35;cursor:default}@keyframes _64UoUa_sidechatRowIn{0%{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes _64UoUa_sidechatFadeIn{0%{opacity:0}to{opacity:1}}@keyframes _64UoUa_sidechatBtnIn{0%{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}@keyframes _64UoUa_sidechatSweep{0%{background-position:200% 0}to{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){._64UoUa_sidechatScroll>*,._64UoUa_sidechatHero,._64UoUa_sidechatStatus,._64UoUa_sidechatSendBtn{animation:none}._64UoUa_sidechatStatusText,._64UoUa_sidechatShimmerText{color:var(--dsw-alias-label-tertiary);background-image:none;animation:none}._64UoUa_sidechatRowChevron{transition:none}}";
		const tagId$1 = "dsh-coding-sidebar/SideChatView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-coding-sidebar";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var SideChatView_module_css_default = {
			"sidechat": "_64UoUa_sidechat",
			"sidechatAgentBadge": "_64UoUa_sidechatAgentBadge",
			"sidechatAssistant": "_64UoUa_sidechatAssistant",
			"sidechatBtnIn": "_64UoUa_sidechatBtnIn",
			"sidechatComposer": "_64UoUa_sidechatComposer",
			"sidechatComposerBar": "_64UoUa_sidechatComposerBar",
			"sidechatComposerInput": "_64UoUa_sidechatComposerInput",
			"sidechatComposerMeta": "_64UoUa_sidechatComposerMeta",
			"sidechatDetailHeader": "_64UoUa_sidechatDetailHeader",
			"sidechatError": "_64UoUa_sidechatError",
			"sidechatFadeIn": "_64UoUa_sidechatFadeIn",
			"sidechatHeaderDot": "_64UoUa_sidechatHeaderDot",
			"sidechatHeaderSpacer": "_64UoUa_sidechatHeaderSpacer",
			"sidechatHero": "_64UoUa_sidechatHero",
			"sidechatHeroDesc": "_64UoUa_sidechatHeroDesc",
			"sidechatHeroTitle": "_64UoUa_sidechatHeroTitle",
			"sidechatHint": "_64UoUa_sidechatHint",
			"sidechatIconBtn": "_64UoUa_sidechatIconBtn",
			"sidechatPrimaryBtn": "_64UoUa_sidechatPrimaryBtn",
			"sidechatRow": "_64UoUa_sidechatRow",
			"sidechatRowBody": "_64UoUa_sidechatRowBody",
			"sidechatRowChevron": "_64UoUa_sidechatRowChevron",
			"sidechatRowCode": "_64UoUa_sidechatRowCode",
			"sidechatRowFailed": "_64UoUa_sidechatRowFailed",
			"sidechatRowIn": "_64UoUa_sidechatRowIn",
			"sidechatRowLabel": "_64UoUa_sidechatRowLabel",
			"sidechatRowLine": "_64UoUa_sidechatRowLine",
			"sidechatRowMeta": "_64UoUa_sidechatRowMeta",
			"sidechatRowMono": "_64UoUa_sidechatRowMono",
			"sidechatRowProse": "_64UoUa_sidechatRowProse",
			"sidechatRowStatic": "_64UoUa_sidechatRowStatic",
			"sidechatRowSummary": "_64UoUa_sidechatRowSummary",
			"sidechatScroll": "_64UoUa_sidechatScroll",
			"sidechatSendBtn": "_64UoUa_sidechatSendBtn",
			"sidechatShimmerText": "_64UoUa_sidechatShimmerText",
			"sidechatStatus": "_64UoUa_sidechatStatus",
			"sidechatStatusText": "_64UoUa_sidechatStatusText",
			"sidechatSweep": "_64UoUa_sidechatSweep",
			"sidechatUser": "_64UoUa_sidechatUser"
		};
		//#endregion
		//#region src/client/SideChatView.tsx
		/**
		* Side Chat page: Codex-style side conversations for the current session.
		*
		* EVERY side conversation is its own sidebar tab (侧边对话1/2/3 …): the
		* descriptor's createTab mints a fresh tab flagged `autoCreate` and this
		* view creates the EMPTY thread on mount (one click = one conversation,
		* exactly like the Codex app); the composer owns the first message (the
		* host wraps it with the side boundary + the in-progress snapshot parked
		* at creation, and the thread earns its real label — and the tab its
		* title — from that first message). Closing the tab releases the thread's
		* live agent (its history stays persisted); the header menu reopens any
		* existing thread into a tab (deduped by threadId).
		*
		* Each side thread is a child session the plugin created itself with a
		* custom seed (the parent's full log up to the click moment — see
		* sidechat-core.ts). Transport: thread creation/follow-up/cancel/dispose/
		* info go through the plugin's own /sidebar/api sidechat.* routes
		* (subagent-origin identities are fenced from the generic session RPCs);
		* the transcript is polled from the generic session.history RPC (seed-cut
		* at session/end-seed, boundary row dropped, chunk streaming accumulated)
		* — see sidechat-transcript.ts.
		*/
		/** Tail-page size for one transcript poll (events per page). Small on
		*  purpose: streaming polls ride the tail and merge by seq. */
		const PAGE_MESSAGES = 8;
		/** First-attach walk page size: cold reads re-expand chunk-rows into one
		*  event per streamed delta, so a single answer can be hundreds of events —
		*  the walk must page big or earlier tool/call rows fall out of the window. */
		const WALK_PAGE_EVENTS = 200;
		/** Poll cadence while the selected thread is running and the tab visible.
		*  ADAPTIVE (no event channel reaches the browser client for another
		*  session's appends): a pull that observed new tail events schedules the
		*  next one at POLL_FAST_MS (streaming reads near-smooth), consecutive
		*  quiet pulls back off toward POLL_SLOW_MS so an idle turn costs almost
		*  nothing. */
		const POLL_FAST_MS = 700;
		const POLL_BASE_MS = 2e3;
		const POLL_SLOW_MS = 5e3;
		/** Textarea auto-grow ceiling (px) — the composer scrolls beyond it. */
		const COMPOSER_MAX_HEIGHT = 132;
		/** The thread a tab is bound to (durable in tab.meta across refreshes). */
		function sidechatThreadIdOf(tab) {
			const meta = tab.meta;
			return typeof meta?.threadId === "string" ? meta.threadId : void 0;
		}
		/** The parked reopen target consumed by the descriptor's createTab (the
		*  service's createTab receives no seed, so a thread-switch parks the id
		*  here and openTab picks it up synchronously — exactly one consume per
		*  park). */
		let parkedReopen;
		/** Park a thread id for the NEXT sidechat openTab to reattach. */
		function parkSidechatReopen(threadId) {
			parkedReopen = threadId;
		}
		/** Consume the parked reopen target (undefined = mint a fresh thread tab). */
		function consumeSidechatSeed() {
			const value = parkedReopen;
			parkedReopen = void 0;
			return value;
		}
		/** In-flight thread creations keyed by tab id (double-mount guard: React
		*  StrictMode / HMR must not mint two threads for one tab). */
		const inFlightStarts = /* @__PURE__ */ new Set();
		/** Merge history entries by event seq (newest wins), log order preserved. */
		function mergeBySeq(previous, incoming) {
			const bySeq = /* @__PURE__ */ new Map();
			for (const entry of previous) bySeq.set(entry.event.seq, entry);
			for (const entry of incoming) bySeq.set(entry.event.seq, entry);
			return [...bySeq.values()].sort((a, b) => a.event.seq - b.event.seq);
		}
		/** The display title of a thread: the durable label minus the 'Side: '
		*  prefix, with the fresh-thread placeholder localized. */
		function threadDisplayTitle(title) {
			if (title === "Side: New thread") return t("sideChatUntitled");
			return title.startsWith("Side: ") ? title.slice(6) : title;
		}
		/**
		* One collapsible context row — the shared Codex-style chrome of tool
		* calls, thinking and context injections: a single quiet line (chevron +
		* label + one-line summary) that expands into an indented body hung on a
		* hairline thread. Rows with nothing to reveal render as a static line.
		*/
		function CollapsibleRow(props) {
			const label = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: clsx(SideChatView_module_css_default.sidechatRowLabel, props.mono === true && SideChatView_module_css_default.sidechatRowMono, props.streaming === true && SideChatView_module_css_default.sidechatShimmerText),
				children: props.label
			});
			const meta = props.meta !== void 0 && props.meta !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: SideChatView_module_css_default.sidechatRowMeta,
				children: props.meta
			}) : null;
			if (props.children === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(SideChatView_module_css_default.sidechatRowLine, SideChatView_module_css_default.sidechatRowStatic, props.failed === true && SideChatView_module_css_default.sidechatRowFailed),
				children: [label, meta]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: SideChatView_module_css_default.sidechatRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
					className: clsx(SideChatView_module_css_default.sidechatRowLine, SideChatView_module_css_default.sidechatRowSummary, props.failed === true && SideChatView_module_css_default.sidechatRowFailed),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SideChatView_module_css_default.sidechatRowChevron,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 12 })
						}),
						label,
						meta
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SideChatView_module_css_default.sidechatRowBody,
					children: props.children
				})]
			});
		}
		/** One row renderer (React keys ride the source event seq). */
		function renderRow(row, labels) {
			switch (row.kind) {
				case "user": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SideChatView_module_css_default.sidechatUser,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { ...markdownTextProps(row.text, labels) })
				}, `${row.kind}:${row.seq}`);
				case "assistant": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SideChatView_module_css_default.sidechatAssistant,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { ...markdownTextProps(row.text, labels) })
				}, `${row.kind}:${row.seq}`);
				case "reasoning": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CollapsibleRow, {
					label: labels.thinkLabel,
					streaming: !row.settled,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SideChatView_module_css_default.sidechatRowProse,
						children: row.text
					})
				}, `${row.kind}:${row.seq}`);
				case "injection": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CollapsibleRow, {
					label: labels.injectionLabel,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SideChatView_module_css_default.sidechatRowProse,
						children: row.text
					})
				}, `${row.kind}:${row.seq}`);
				case "tool": {
					const body = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [row.args !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: SideChatView_module_css_default.sidechatRowCode,
						children: row.args
					}), row.resultText !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						className: SideChatView_module_css_default.sidechatRowCode,
						children: row.resultText
					})] });
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CollapsibleRow, {
						label: row.name,
						meta: toolArgsSummary(row.args),
						mono: true,
						streaming: row.executing === true,
						failed: row.failed,
						...row.args === void 0 && row.resultText === void 0 ? {} : { children: body }
					}, `${row.kind}:${row.seq}`);
				}
			}
		}
		/** One side conversation tab (one thread per tab, Codex-style). */
		function SideChatView(props) {
			const { ctx, scope, tab, visible } = props;
			const rowLabels = (0, react.useMemo)(() => ({
				copyLabel: t("copy"),
				copiedLabel: t("copied"),
				thinkLabel: t("sideChatThink"),
				injectionLabel: t("sideChatInjection")
			}), []);
			const list = (0, react.useSyncExternalStore)((0, react.useMemo)(() => (callback) => ctx.sessions.list.subscribe(callback), [ctx]), (0, react.useCallback)(() => ctx.sessions.list.getSnapshot(), [ctx]));
			const threads = (0, react.useMemo)(() => sideThreadRows(list.byId, scope.sessionId), [list, scope.sessionId]);
			const threadId = sidechatThreadIdOf(tab);
			const autoCreate = tab.meta?.autoCreate === true;
			const [composer, setComposer] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [saved, setSaved] = (0, react.useState)(false);
			const [revision, setRevision] = (0, react.useState)(0);
			const [info, setInfo] = (0, react.useState)(null);
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const cacheRef = (0, react.useRef)({
				seedBoundary: null,
				entries: []
			});
			const controllerRef = (0, react.useRef)(null);
			const scrollRef = (0, react.useRef)(null);
			const composerRef = (0, react.useRef)(null);
			const summary = threadId === void 0 ? void 0 : list.byId[threadId];
			const running = summary?.running === true;
			/** The agent-identity badge of the thread header (preset · model). */
			const agentBadge = (0, react.useMemo)(() => {
				if (info === null) return "";
				return [info.preset, info.model ?? info.provider].filter(Boolean).join(" · ");
			}, [info]);
			/** Create this tab's thread (immediate-create tabs and hero retries). */
			const startThread = (0, react.useCallback)(async () => {
				if (inFlightStarts.has(tab.id)) return;
				inFlightStarts.add(tab.id);
				setBusy("starting");
				setError(null);
				try {
					const { childId } = await api.sidechatStart(scope.sessionId);
					ctx.get("betterSidebar")?.updateTab(tab.id, { meta: { threadId: childId } });
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					inFlightStarts.delete(tab.id);
					setBusy(null);
				}
			}, [
				ctx,
				scope.sessionId,
				tab.id
			]);
			(0, react.useEffect)(() => {
				if (threadId !== void 0 || !autoCreate || !visible) return;
				startThread();
			}, [
				threadId,
				autoCreate,
				visible,
				startThread
			]);
			(0, react.useEffect)(() => {
				const display = summary?.displayTitle;
				if (display === void 0) return;
				const title = threadDisplayTitle(display);
				if (title !== "" && title !== tab.title) try {
					ctx.get("betterSidebar")?.updateTab(tab.id, { title });
				} catch {}
			}, [
				summary,
				tab.id,
				tab.title,
				ctx
			]);
			/** One transcript pull: the first read walks back to the seed boundary
			*  (big pages — chunk deltas re-expand on cold reads), later reads fetch
			*  one tail page and merge (seq-deduped).
			*  @returns whether the merged transcript grew (the poll's pacing signal). */
			const fetchThread = (0, react.useCallback)(async (childId) => {
				if (ctx.connection.api?.sessions?.history === void 0) return false;
				controllerRef.current?.abort();
				const controller = new AbortController();
				controllerRef.current = controller;
				const cache = cacheRef.current;
				const before = cache.entries.length;
				try {
					if (cache.seedBoundary === null) {
						const walk = await collectOwnEvents(async (beforeSeq) => {
							const response = await ctx.connection.api.sessions.history({
								sessionId: childId,
								maxMessages: WALK_PAGE_EVENTS,
								...beforeSeq === void 0 ? {} : { beforeSeq }
							}, controller.signal);
							if (!response.result.ok) throw new Error("history walk failed");
							return response.result.value.events;
						});
						cache.seedBoundary = walk.seedBoundary;
						cache.entries = mergeBySeq(cache.entries, walk.entries);
					} else {
						const response = await ctx.connection.api.sessions.history({
							sessionId: childId,
							maxMessages: PAGE_MESSAGES
						}, controller.signal);
						if (!response.result.ok) return false;
						cache.entries = mergeBySeq(cache.entries, response.result.value.events);
					}
					setRevision((value) => value + 1);
					return cache.entries.length > before;
				} catch {
					return false;
				}
			}, [ctx]);
			/** The thread header badge pull (live state + preset/model identity). */
			const fetchInfo = (0, react.useCallback)(async (childId) => {
				try {
					setInfo(await api.sidechatInfo(childId));
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				cacheRef.current = {
					seedBoundary: null,
					entries: []
				};
				controllerRef.current?.abort();
				setError(null);
				setSaved(false);
				setInfo(null);
				if (threadId !== void 0) {
					fetchInfo(threadId);
					window.setTimeout(() => composerRef.current?.focus(), 0);
				}
			}, [threadId, fetchInfo]);
			(0, react.useEffect)(() => {
				if (!visible || threadId === void 0) return;
				fetchThread(threadId);
				if (!running) return;
				let timer = 0;
				let quiet = 0;
				const schedule = (delay) => {
					timer = window.setTimeout(async () => {
						let grew = false;
						try {
							grew = await fetchThread(threadId);
							fetchInfo(threadId);
						} catch {
							quiet += 1;
						}
						quiet = grew ? 0 : quiet + 1;
						schedule(quiet === 0 ? POLL_FAST_MS : Math.min(POLL_SLOW_MS, POLL_BASE_MS * 1.8 ** (quiet - 1)));
					}, delay);
				};
				schedule(POLL_FAST_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [
				visible,
				threadId,
				running,
				fetchThread,
				fetchInfo
			]);
			(0, react.useEffect)(() => () => {
				controllerRef.current?.abort();
			}, []);
			const rows = (0, react.useMemo)(() => threadId === void 0 ? [] : transcriptRows(cacheRef.current.entries), [threadId, revision]);
			const canSave = threadId !== void 0 && threadHasCompletedTurn(cacheRef.current.entries);
			const trailingPending = threadId !== void 0 && threadTrailingPending(cacheRef.current.entries);
			const freshThread = threadId !== void 0 && rows.length === 0;
			(0, react.useEffect)(() => {
				const scroller = scrollRef.current;
				if (scroller === null) return;
				scroller.scrollTop = scroller.scrollHeight;
			}, [rows.length, threadId]);
			/** Open a NEW thread tab (createTab mints the autoCreate tab; its view
			*  creates the thread on mount). */
			const openNewThread = () => {
				setMenuOpen(false);
				ctx.get("betterSidebar")?.openTab({ type: "sidechat" }, scope);
			};
			/** Switch to an existing thread: parked for createTab, deduped to the
			*  already-open tab when there is one. */
			const openExistingThread = (id) => {
				setMenuOpen(false);
				if (id === threadId) return;
				parkSidechatReopen(id);
				ctx.get("betterSidebar")?.openTab({ type: "sidechat" }, scope);
			};
			const menuItems = (0, react.useMemo)(() => {
				const items = [{
					id: "$new",
					label: t("sideChatNew"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, {})
				}];
				if (threads.length > 0) {
					items.push({
						type: "separator",
						id: "$sep"
					});
					for (const row of threads) items.push({
						id: row.id,
						label: threadDisplayTitle(row.title),
						...row.running ? { icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
							state: "ongoing",
							size: 8
						}) } : {}
					});
				}
				return items;
			}, [threads]);
			const growComposer = () => {
				const field = composerRef.current;
				if (field === null) return;
				field.style.height = "0px";
				field.style.height = `${Math.min(field.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
			};
			const handleSend = async () => {
				const text = composer.trim();
				if (text === "" || threadId === void 0 || busy !== null) return;
				setBusy("sending");
				setError(null);
				try {
					await api.sidechatPrompt(threadId, text);
					setComposer("");
					const field = composerRef.current;
					if (field !== null) field.style.height = "";
					fetchThread(threadId);
					fetchInfo(threadId);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(null);
				}
			};
			const handleCancel = async () => {
				if (threadId === void 0 || busy !== null) return;
				try {
					await api.sidechatCancel(threadId);
					fetchThread(threadId);
					fetchInfo(threadId);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			const handleSave = async () => {
				if (threadId === void 0 || !canSave || busy !== null) return;
				setBusy("saving");
				setError(null);
				setSaved(false);
				try {
					if (ctx.sessions.fork === void 0) throw new Error("session fork is unavailable");
					const newId = await ctx.sessions.fork({
						sessionId: threadId,
						increaseTitle: true
					});
					const title = summary === void 0 ? "" : threadDisplayTitle(summary.displayTitle).trim();
					const binding = ctx.sessions.binding?.(newId);
					if (binding !== void 0 && title !== "") await binding.session.rename(title);
					const outcome = openViaUiWorkspace(ctx, newId, ctx.sessions);
					if (outcome !== "opened") console.warn(`[dsh-coding-sidebar] promote side thread ${outcome}:`, newId);
					setSaved(true);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(null);
				}
			};
			if (threadId === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: SideChatView_module_css_default.sidechat,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SideChatView_module_css_default.sidechatHero,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutlineRegular, {}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: clsx(SideChatView_module_css_default.sidechatHeroTitle, busy === "starting" && SideChatView_module_css_default.sidechatShimmerText),
							children: busy === "starting" ? t("sideChatCreating") : t("sideChatEmpty")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SideChatView_module_css_default.sidechatHeroDesc,
							children: t("sideChatEmptyDesc")
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SideChatView_module_css_default.sidechatError,
							children: t("sideChatError", { message: error })
						}),
						busy !== "starting" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SideChatView_module_css_default.sidechatPrimaryBtn,
							onClick: () => void startThread(),
							children: error === null ? t("sideChatNew") : t("sideChatRetry")
						})
					]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SideChatView_module_css_default.sidechat,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideChatView_module_css_default.sidechatDetailHeader,
						children: [
							running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
								state: "ongoing",
								size: 8,
								className: SideChatView_module_css_default.sidechatHeaderDot
							}),
							agentBadge !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideChatView_module_css_default.sidechatAgentBadge,
								children: agentBadge
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: SideChatView_module_css_default.sidechatHeaderSpacer }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: SideChatView_module_css_default.sidechatIconBtn,
									onClick: () => {
										setMenuOpen((value) => !value);
									},
									title: t("sideChatThreads"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconHistoryOutline16, {})
								}),
								items: menuItems,
								selectedId: threadId,
								onSelect: (id) => {
									id === "$new" ? openNewThread() : openExistingThread(id);
								},
								onClose: () => {
									setMenuOpen(false);
								},
								align: "end",
								portal: true,
								dense: true
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SideChatView_module_css_default.sidechatIconBtn,
								onClick: () => void handleSave(),
								disabled: !canSave || busy !== null,
								title: `${t("sideChatSave")} — ${t("sideChatSaveTitle")}`,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSaveOutline16, {})
							})
						]
					}),
					!canSave && !freshThread && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SideChatView_module_css_default.sidechatHint,
						children: t("sideChatNoTurn")
					}),
					canSave && trailingPending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SideChatView_module_css_default.sidechatHint,
						children: t("sideChatPendingDrop")
					}),
					saved && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SideChatView_module_css_default.sidechatHint,
						children: t("sideChatSaved")
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SideChatView_module_css_default.sidechatError,
						children: t("sideChatError", { message: error })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: scrollRef,
						className: SideChatView_module_css_default.sidechatScroll,
						children: rows.map((row) => renderRow(row, rowLabels))
					}),
					running && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideChatView_module_css_default.sidechatStatus,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
							state: "ongoing",
							size: 8
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SideChatView_module_css_default.sidechatStatusText,
							children: t("sideChatThinking")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideChatView_module_css_default.sidechatComposer,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							ref: composerRef,
							className: SideChatView_module_css_default.sidechatComposerInput,
							value: composer,
							placeholder: freshThread ? t("sideChatFirstPlaceholder") : t("sideChatComposerPlaceholder"),
							rows: 1,
							onChange: (event) => {
								setComposer(event.target.value);
								growComposer();
							},
							onKeyDown: (event) => {
								if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
								event.preventDefault();
								handleSend();
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SideChatView_module_css_default.sidechatComposerBar,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideChatView_module_css_default.sidechatComposerMeta,
								children: running ? "" : agentBadge
							}), running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SideChatView_module_css_default.sidechatSendBtn,
								onClick: () => void handleCancel(),
								disabled: busy !== null,
								title: t("sideChatCancelTitle"),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFillRegular, {})
							}, "stop") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SideChatView_module_css_default.sidechatSendBtn,
								onClick: () => void handleSend(),
								disabled: composer.trim() === "" || busy !== null,
								title: t("sideChatSend"),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSendOutline16, {})
							}, "send")]
						})]
					})
				]
			});
		}
		/**
		* Decide whether a site can render inside the sidebar iframe. The signals
		* are exactly the ones the BROWSER enforces when it refuses an iframe load:
		* X-Frame-Options DENY/SAMEORIGIN, or a frame-ancestors directive that does
		* not allow `*` ('self' here means the SITE's own origin — never ours, so
		* it also blocks the sidebar). A site we could not reach yields 'unknown'
		* and the plain iframe stays.
		*/
		function embeddabilityOf(probe) {
			if (probe.reachable !== true) return "unknown";
			const xfo = probe.xFrameOptions?.trim().toUpperCase();
			if (xfo === "DENY" || xfo === "SAMEORIGIN") return "blocked";
			if (probe.frameAncestors !== void 0 && !probe.frameAncestors.some((source) => source === "*")) return "blocked";
			return "embeddable";
		}
		/** Schemes that must never reach the iframe, even without `//` (javascript:,
		*  data:, file:, ...). Host:port lookalikes (example.com:8080) are NOT here —
		*  they parse as hosts below. */
		const FORBIDDEN_SCHEMES = /* @__PURE__ */ new Set([
			"javascript",
			"data",
			"file",
			"about",
			"vbscript",
			"blob",
			"mailto",
			"tel",
			"ftp",
			"ftps",
			"ws",
			"wss",
			"sftp",
			"ssh",
			"chrome",
			"chrome-extension",
			"moz-extension",
			"edge",
			"opera",
			"resource",
			"view-source"
		]);
		function normalizeBrowserUrl(input, selfOrigin) {
			const trimmed = input.trim();
			if (trimmed === "") return {
				kind: "blocked",
				reason: "empty"
			};
			if (trimmed.length > 16384) return {
				kind: "blocked",
				reason: "invalid"
			};
			const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
			let withScheme;
			if (schemeMatch === null) withScheme = `https://${trimmed}`;
			else {
				const scheme = schemeMatch[1].toLowerCase();
				if (scheme === "http" || scheme === "https") withScheme = trimmed;
				else if (FORBIDDEN_SCHEMES.has(scheme)) return {
					kind: "blocked",
					reason: "scheme"
				};
				else withScheme = `https://${trimmed}`;
			}
			let url;
			try {
				url = new URL(withScheme);
			} catch {
				return {
					kind: "blocked",
					reason: "invalid"
				};
			}
			if (url.protocol !== "http:" && url.protocol !== "https:") return {
				kind: "blocked",
				reason: "scheme"
			};
			if (url.username !== "" || url.password !== "") return {
				kind: "blocked",
				reason: "credentials"
			};
			try {
				if (url.origin === new URL(selfOrigin).origin) return {
					kind: "blocked",
					reason: "app-origin"
				};
			} catch {}
			return {
				kind: "ok",
				url: url.href,
				title: url.hostname
			};
		}
		/**
		* Owns the application-known URL history and the frame-observation state
		* machine. The first load for a request keeps its URL authoritative; another
		* load for the same revision marks it unknown.
		*/
		var BrowserNavigation = class BrowserNavigation {
			value;
			/**
			* @param initial - restored state for this tab, or a fresh empty state.
			*/
			constructor(initial = BrowserNavigation.empty()) {
				this.value = initial;
			}
			/** @returns state before a tab has a controlled navigation target. */
			static empty() {
				return {
					entries: [],
					index: -1,
					request: void 0,
					navigation: { status: "empty" },
					failure: void 0
				};
			}
			/**
			* Read the selected application-history entry.
			* @param state - serializable tab state.
			* @returns the current entry, if any.
			*/
			static current(state) {
				return state === void 0 || state.index < 0 ? void 0 : state.entries[state.index];
			}
			/**
			* Whether Back can use the preceding application-owned entry. An `unknown`
			* document means the carrier navigated on its own, so the application-owned
			* stack no longer describes where the user is — both directions disable.
			* @param state - serializable tab state.
			* @returns whether Back is available.
			*/
			static canGoBack(state) {
				return state.navigation.status !== "unknown" && state.index > 0;
			}
			/** @param state - serializable tab state. @returns whether Forward is available. */
			static canGoForward(state) {
				return state.navigation.status !== "unknown" && state.index >= 0 && state.index < state.entries.length - 1;
			}
			/** Current immutable serializable state. */
			get snapshot() {
				return this.value;
			}
			/** @returns whether the reload command has a target. */
			get canReload() {
				return BrowserNavigation.current(this.value) !== void 0;
			}
			/**
			* Add a controlled target and discard its stale forward branch.
			* @param target - validated canonical target.
			* @returns the new load request (revision + target).
			*/
			navigate(target) {
				const entries = [...this.value.entries.slice(0, this.value.index + 1), target];
				if (entries.length > 100) entries.splice(0, entries.length - 100);
				return this.request(target, {
					...this.value,
					entries,
					index: entries.length - 1
				});
			}
			/**
			* Select the preceding application-known target.
			* @returns a new load request, or undefined when unavailable.
			*/
			back() {
				if (!BrowserNavigation.canGoBack(this.value)) return void 0;
				const index = this.value.index - 1;
				const target = this.value.entries[index];
				return this.request(target, {
					...this.value,
					index
				});
			}
			/**
			* Select the following application-known target.
			* @returns a new load request, or undefined when unavailable.
			*/
			forward() {
				if (!BrowserNavigation.canGoForward(this.value)) return void 0;
				const index = this.value.index + 1;
				const target = this.value.entries[index];
				return this.request(target, {
					...this.value,
					index
				});
			}
			/**
			* Start another load of the last application-known target (also the path a
			* same-address submit takes, so re-submitting the current URL reloads it
			* instead of stacking a duplicate history entry).
			* @returns a new load request, or undefined before the first target.
			*/
			reload() {
				const target = BrowserNavigation.current(this.value);
				return target === void 0 ? void 0 : this.request(target, this.value);
			}
			/**
			* Record an invalid address without changing the active document state.
			* @param reason - the URL policy's refusal reason.
			*/
			addressFailed(reason) {
				this.value = {
					...this.value,
					failure: {
						kind: "address",
						reason
					}
				};
			}
			/**
			* Record a frame load for its captured revision.
			* @param revision - revision bound to the rendered frame.
			*/
			frameLoaded(revision) {
				const navigation = this.value.navigation;
				if (navigation.status === "empty" || navigation.revision !== revision) return;
				if (navigation.status === "loading") this.value = {
					...this.value,
					navigation: {
						status: "known",
						revision
					}
				};
				else if (navigation.status === "known") this.value = {
					...this.value,
					navigation: {
						status: "unknown",
						revision
					}
				};
			}
			request(target, basis) {
				const request = {
					revision: (this.value.request?.revision ?? 0) + 1,
					target
				};
				this.value = {
					...basis,
					request,
					navigation: {
						status: "loading",
						revision: request.revision
					},
					failure: void 0
				};
				return request;
			}
		};
		/** Refusal reasons a persisted failure may carry (runtime twin of the type). */
		const FAILURE_REASONS = /* @__PURE__ */ new Set([
			"empty",
			"invalid",
			"scheme",
			"credentials",
			"app-origin"
		]);
		/** Local bound for persisted strings (titles are hostnames; urls ≤ 16 KiB by policy). */
		const MAX_PERSISTED_URL = 16384;
		const MAX_PERSISTED_TITLE = 1024;
		/** Whether a value is a plain non-empty bounded string. */
		function isBoundedString(value, max) {
			return typeof value === "string" && value !== "" && value.length <= max;
		}
		/** Whether a value is a well-formed history entry. */
		function isHistoryEntry(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
			const entry = value;
			return isBoundedString(entry.url, MAX_PERSISTED_URL) && isBoundedString(entry.title, MAX_PERSISTED_TITLE);
		}
		/** Whether a value is a positive integer revision. */
		function isRevision(value) {
			return typeof value === "number" && Number.isInteger(value) && value > 0;
		}
		/**
		* Validate one persisted `tab.meta` value back into a `BrowserTabState`.
		* The meta channel is plugin-owned JSON restored verbatim from localStorage,
		* so the browser tab re-validates the whole shape before adopting it: any
		* malformed field (wrong type, out-of-range index, entry/reason outside the
		* vocabulary, a request that does not match the selected entry) rejects the
		* whole snapshot and the tab falls back to its legacy `path` seed. The result
		* is rebuilt field by field, so unknown extra keys in the stored object are
		* dropped instead of being re-persisted.
		*
		* @param value - the persisted `tab.meta` (unknown provenance).
		* @returns a clean state, or undefined when the snapshot cannot be trusted.
		*/
		function restoreBrowserTabState(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
			const record = value;
			const entries = record.entries;
			if (!Array.isArray(entries) || entries.length > 100) return void 0;
			if (!entries.every((entry) => isHistoryEntry(entry))) return void 0;
			const index = record.index;
			if (typeof index !== "number" || !Number.isInteger(index) || index < -1 || index >= entries.length) return void 0;
			let request;
			if (record.request === void 0) request = void 0;
			else {
				if (record.request === null || typeof record.request !== "object" || Array.isArray(record.request)) return void 0;
				const raw = record.request;
				if (!isRevision(raw.revision) || !isHistoryEntry(raw.target)) return void 0;
				const selected = index >= 0 ? entries[index] : void 0;
				if (selected === void 0 || selected.url !== raw.target.url || selected.title !== raw.target.title) return void 0;
				request = {
					revision: raw.revision,
					target: raw.target
				};
			}
			const rawNavigation = record.navigation;
			if (rawNavigation === null || typeof rawNavigation !== "object" || Array.isArray(rawNavigation)) return void 0;
			const navigation = rawNavigation;
			let navigationStatus;
			if (navigation.status === "empty") navigationStatus = { status: "empty" };
			else if (navigation.status === "loading" || navigation.status === "known" || navigation.status === "unknown") {
				if (!isRevision(navigation.revision)) return void 0;
				navigationStatus = {
					status: navigation.status,
					revision: navigation.revision
				};
			} else return;
			let failure;
			if (record.failure === void 0) failure = void 0;
			else {
				if (record.failure === null || typeof record.failure !== "object" || Array.isArray(record.failure)) return void 0;
				const raw = record.failure;
				if (raw.kind !== "address" || typeof raw.reason !== "string" || !FAILURE_REASONS.has(raw.reason)) return void 0;
				failure = {
					kind: "address",
					reason: raw.reason
				};
			}
			return {
				entries,
				index,
				request,
				navigation: navigationStatus,
				failure
			};
		}
		//#endregion
		//#region src/client/SandboxStatusBar.tsx
		/**
		* The live sandbox status row of the two built-in web surfaces (HTML
		* preview and the browser tab): a green "sandbox on" state with a one-tap
		* TEMPORARY unlock, or a RED "sandbox off" state (global setting or the
		* temporary unlock) with a restore action.
		*
		* The temporary unlock is component state only — it never writes the
		* global side card setting (`htmlViewerNoSandbox` / `browserNoSandbox`);
		* it lasts until the surface unmounts (tab switch / file switch) or the
		* user restores the sandbox from the row. When the global setting already
		* drops the sandbox, no unlock/restore action is offered (changing the
		* global setting is the settings page's job) — the red warning stands.
		*/
		function SandboxStatusBar(props) {
			const { sandboxed, local, dangerCopy, onUnlock, onRestore } = props;
			if (sandboxed) {
				const copy = t("sandboxStatusOn");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: clsx(sidebar_module_css_default.sandboxStatus, sidebar_module_css_default.sandboxStatusOn),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: sidebar_module_css_default.sandboxDot }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.sandboxStatusText,
							title: copy,
							children: copy
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.sandboxAction,
							onClick: onUnlock,
							children: t("sandboxUnlock")
						})
					]
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(sidebar_module_css_default.sandboxStatus, sidebar_module_css_default.sandboxStatusOff),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: sidebar_module_css_default.sandboxDot }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: sidebar_module_css_default.sandboxStatusText,
						title: dangerCopy,
						children: dangerCopy
					}),
					local && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: sidebar_module_css_default.sandboxAction,
						onClick: onRestore,
						children: t("sandboxRestore")
					})
				]
			});
		}
		//#endregion
		//#region src/client/LiveView.tsx
		/**
		* Agent 浏览器实况（CDP screencast + 输入回传，2026-09-12 方案 2）。
		*
		* 数据面：KCoder 桌面端 browser-host 维护一个无头 Chromium（固定 CDP
		* 转发地址 127.0.0.1:9223，与 playwright MCP `--cdp-endpoint` 共用）。
		* 本组件作为第二个 CDP 客户端：
		* - target 列表经宿主代理 `/sidebar/api`（CDP HTTP 无 CORS 头）；
		* - screencast/输入走 renderer 直连 `ws://127.0.0.1:9223/devtools/page/<id>`
		*   （WebSocket 不受 CORS 约束，宿主未设 CSP）。
		*
		* 连接模型：`attachedId`（用户显式选择）优先，否则自动跟随「最新创建的
		* page target」；连接按 effectiveId 建立与重建，列表仅在内容变化时更新
		* state（JSON 比对），避免轮询引起重连抖动。
		*
		* 交互：screencast 帧绘到 canvas；指针/滚轮按 canvas→viewport 比例回传
		* （Input.dispatchMouseEvent）；可打印字符经 Input.insertText，控制键走
		* rawKeyDown/keyUp。视口统一 1280×800（Emulation.setDeviceMetricsOverride），
		* canvas 等比缩放显示。
		*/
		/** 与 KCoder desktop/main/browser-host.ts 的 BROWSER_HOST_PORT 一致。 */
		const CDP_WS = "ws://127.0.0.1:9223";
		/** 实况视口（CDP 侧强制，帧与输入坐标以此为基准）。 */
		const VIEW_W = 1280;
		const VIEW_H = 800;
		function LiveView() {
			const canvasRef = (0, react.useRef)(null);
			const wsRef = (0, react.useRef)(null);
			const [status, setStatus] = (0, react.useState)("connecting");
			const [targets, setTargets] = (0, react.useState)([]);
			const [hostDown, setHostDown] = (0, react.useState)(false);
			/** 用户显式钉住的 target（null = 自动跟随最新）。 */
			const [pinnedId, setPinnedId] = (0, react.useState)(null);
			/** 连接代数：手动重连/换 target 时 +1。 */
			const [epoch, setEpoch] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let alive = true;
				const poll = async () => {
					try {
						const { targets: list } = await api.cdpTargets();
						if (!alive) return;
						setHostDown(false);
						setTargets((prev) => JSON.stringify(prev) === JSON.stringify(list) ? prev : list);
					} catch {
						if (alive) setHostDown(true);
					}
				};
				poll();
				const timer = setInterval(() => {
					poll();
				}, 3e3);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, []);
			/** 实际附加的 target:id 钉住且存活 → 它;否则自动跟随最新页。 */
			const effectiveId = (0, react.useMemo)(() => {
				if (pinnedId !== null && targets.some((tg) => tg.id === pinnedId)) return pinnedId;
				return targets.length > 0 ? targets[targets.length - 1].id : null;
			}, [pinnedId, targets]);
			(0, react.useEffect)(() => {
				if (effectiveId === null) {
					setStatus("idle");
					return;
				}
				let cancelled = false;
				let socket = null;
				let msgId = 0;
				setStatus("connecting");
				socket = new WebSocket(`${CDP_WS}/devtools/page/${effectiveId}`);
				wsRef.current = socket;
				const send = (method, params) => {
					if (socket !== null && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({
						id: ++msgId,
						method,
						params: params ?? {}
					}));
				};
				const draw = (data) => {
					const el = canvasRef.current;
					if (el === null || cancelled) return;
					const img = new Image();
					img.onload = () => {
						if (cancelled) return;
						el.width = img.naturalWidth;
						el.height = img.naturalHeight;
						el.getContext("2d")?.drawImage(img, 0, 0);
					};
					img.src = `data:image/jpeg;base64,${data}`;
				};
				socket.onopen = () => {
					if (cancelled) return;
					setStatus("live");
					send("Page.enable");
					send("Runtime.enable");
					send("Emulation.setDeviceMetricsOverride", {
						width: VIEW_W,
						height: VIEW_H,
						deviceScaleFactor: 1,
						mobile: false
					});
					send("Page.startScreencast", {
						format: "jpeg",
						quality: 62,
						maxWidth: VIEW_W,
						maxHeight: VIEW_H,
						everyNthFrame: 1
					});
				};
				socket.onmessage = (event) => {
					const msg = JSON.parse(event.data);
					if (msg.method === "Page.screencastFrame") {
						const p = msg.params ?? {};
						if (typeof p.data === "string") draw(p.data);
						if (typeof p.screencastFrameId === "string") send("Page.screencastFrameAck", { screencastFrameId: p.screencastFrameId });
					}
				};
				socket.onclose = () => {
					if (!cancelled) setStatus("connecting");
				};
				socket.onerror = () => {
					if (!cancelled) setStatus("down");
				};
				return () => {
					cancelled = true;
					socket?.close();
					wsRef.current = null;
				};
			}, [effectiveId]);
			const sendInput = (method, params) => {
				wsRef.current?.send(JSON.stringify({
					id: Math.floor(Math.random() * 1e9),
					method,
					params
				}));
			};
			const scaleOf = (el) => {
				const shown = el.getBoundingClientRect().width;
				return shown > 0 ? VIEW_W / shown : 1;
			};
			const posOf = (e) => {
				const rect = e.currentTarget.getBoundingClientRect();
				const k = scaleOf(e.currentTarget);
				return {
					x: (e.clientX - rect.left) * k,
					y: (e.clientY - rect.top) * k
				};
			};
			const onPointerDown = (e) => {
				const p = posOf(e);
				sendInput("Input.dispatchMouseEvent", {
					type: "mousePressed",
					x: p.x,
					y: p.y,
					button: "left",
					clickCount: 1
				});
			};
			const onPointerUp = (e) => {
				const p = posOf(e);
				sendInput("Input.dispatchMouseEvent", {
					type: "mouseReleased",
					x: p.x,
					y: p.y,
					button: "left",
					clickCount: 1
				});
			};
			const onPointerMove = (e) => {
				if (e.buttons === 0) return;
				const p = posOf(e);
				sendInput("Input.dispatchMouseEvent", {
					type: "mouseMoved",
					x: p.x,
					y: p.y,
					button: "left"
				});
			};
			const onWheel = (e) => {
				const p = posOf(e);
				sendInput("Input.dispatchMouseEvent", {
					type: "mouseWheel",
					x: p.x,
					y: p.y,
					deltaX: e.deltaX,
					deltaY: e.deltaY
				});
			};
			const onKeyDown = (e) => {
				const code = {
					Enter: 13,
					Backspace: 8,
					Tab: 9,
					Escape: 27,
					ArrowUp: 38,
					ArrowDown: 40,
					ArrowLeft: 37,
					ArrowRight: 39
				}[e.key];
				if (code !== void 0) {
					sendInput("Input.dispatchKeyEvent", {
						type: "rawKeyDown",
						windowsVirtualKeyCode: code,
						key: e.key
					});
					sendInput("Input.dispatchKeyEvent", {
						type: "keyUp",
						windowsVirtualKeyCode: code,
						key: e.key
					});
					return;
				}
				if (e.key.length === 1) sendInput("Input.insertText", { text: e.key });
			};
			const statusText = hostDown || status === "down" ? t("browserLiveDown") : status === "live" ? targets.find((tg) => tg.id === effectiveId)?.url ?? t("browserLiveTargetNone") : effectiveId === null ? t("browserLiveTargetNone") : t("browserLiveConnecting");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "browserLive",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "browserLiveStatus",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setEpoch((e) => e + 1);
							},
							children: t("refresh")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: "browserLiveTarget",
							value: effectiveId ?? "",
							onChange: (e) => {
								setPinnedId(e.target.value === "" ? null : e.target.value);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("browserLiveFollowLatest")
							}), targets.map((tg) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: tg.id,
								children: tg.title || tg.url
							}, tg.id))]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: statusText })
					]
				}), effectiveId !== null && status !== "idle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("canvas", {
					ref: canvasRef,
					className: "browserLiveCanvas",
					width: VIEW_W,
					height: VIEW_H,
					tabIndex: 0,
					onPointerDown,
					onPointerUp,
					onPointerMove,
					onWheel,
					onKeyDown
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "browserStart",
					children: hostDown ? t("browserLiveDown") : t("browserLiveTargetNone")
				})]
			});
		}
		//#endregion
		//#region src/client/BrowserView.tsx
		/**
		* The built-in browser tab: a toolbar plus a sandboxed iframe, with the
		* navigation semantics of the upstream native side bar's browser
		* (2026-09-20 full alignment — see browser-nav.ts for the state machine and
		* browser.ts for the address policy).
		*
		* Sandbox (aligned with upstream, token for token): the frame carries
		* `allow-same-origin` for every site — without it the frame gets an opaque
		* origin and real sites break (no cookies, no storage, no module scripts).
		* It does NOT hand the page anything of ours: the page keeps its OWN origin
		* and stays cross-origin to the GUI, and the address policy refuses the
		* GUI's own origin outright. NO `allow-downloads`/`allow-modals` and NO
		* `allow-top-navigation` (upstream posture): downloads and modal dialogs
		* require dropping the sandbox — the side card setting "关闭浏览器沙箱" (or
		* this surface's temporary unlock) does that for fully trusted sites, and a
		* status bar warns while it is off.
		*
		* The FULL navigation state (history + request revision + load lifecycle) is
		* persisted onto the tab record's `meta` after every publish, so a reload or
		* remount restores it and replays the last controlled URL via `reload()`
		* (upstream semantics: the seed URL from `tab.path` is only consumed when no
		* controlled target exists — the legacy restore path for pre-alignment
		* tabs). In-frame navigations (link clicks inside the visited site) are
		* cross-origin and invisible to us: the carrier reports a second load for
		* the same revision and the tab switches to the `unknown` state — the
		* address bar says so, Back/Forward disable themselves, and the body
		* explains the limit, exactly like the upstream browser.
		*/
		/**
		* The browser iframe sandbox tokens — token-for-token the upstream native
		* browser's string (dsh 0.1.6-alpha.2). `allow-same-origin` is REQUIRED for
		* real sites (opaque-origin frames cannot keep a session, store anything, or
		* run module pipelines); it gives the page nothing of ours — it keeps its own
		* origin and stays cross-origin to the GUI, whose own origin the address
		* policy refuses. Deliberately absent, exactly like upstream: NO
		* `allow-downloads` / `allow-modals` (downloads and modal dialogs need the
		* sandbox off) and NO `allow-top-navigation` (a browsed page must not hijack
		* the GUI). allow-forms/popups keep login flows working;
		* allow-popups-to-escape-sandbox lets OAuth popups open as normal tabs (they
		* are cross-origin to the GUI either way).
		*/
		const BROWSER_IFRAME_SANDBOX = "allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox";
		/** One refusal reason → the copy shown under the toolbar. */
		function failureText(reason) {
			switch (reason) {
				case "empty": return t("browserEmpty");
				case "invalid": return t("browserInvalid");
				case "scheme": return t("browserBlockedScheme");
				case "credentials": return t("browserBlockedCredentials");
				case "app-origin": return t("browserBlockedAppOrigin");
			}
		}
		/**
		* Address-bar draft keyed by the current request revision (upstream's
		* `useBrowserDraft`): a NEW revision (navigate / back / forward / reload)
		* resets the bar to the controlled URL, while the user's in-progress edit —
		* including a refused one, which mints no revision — survives every state
		* change until then.
		*/
		function useBrowserDraft(controlledUrl, requestId) {
			const [edit, setEdit] = (0, react.useState)();
			return [edit !== void 0 && edit.requestId === requestId ? edit.value : controlledUrl ?? "", (draft) => {
				setEdit({
					requestId,
					value: draft
				});
			}];
		}
		function BrowserView(props) {
			const { store, tab, ctx } = props;
			/** The URL restored from the persisted tab (undefined = fresh tab). */
			const restoredUrl = tab.path;
			const navRef = (0, react.useRef)();
			if (navRef.current === void 0) navRef.current = new BrowserNavigation(restoreBrowserTabState(tab.meta));
			const navigation = navRef.current;
			const [nav, setNav] = (0, react.useState)(() => navigation.snapshot);
			const sync = (0, react.useCallback)(() => {
				const next = navigation.snapshot;
				setNav(next);
				const entry = BrowserNavigation.current(next);
				store.reduce((state) => patchTab(state, tab.id, entry === void 0 ? { meta: next } : {
					path: entry.url,
					title: entry.title,
					meta: next
				}));
			}, [
				navigation,
				store,
				tab.id
			]);
			const current = BrowserNavigation.current(nav);
			const request = nav.request;
			/** A document the carrier navigated away from on its own (in-frame clicks). */
			const unknown = nav.navigation.status === "unknown";
			/** Blocked/invalid hint shown under the address bar (undefined = none). */
			const message = nav.failure === void 0 ? void 0 : failureText(nav.failure.reason);
			/** The address-bar draft: follows the controlled URL on every new request
			* revision; the user's edit survives until then (upstream semantics). */
			const [input, setInput] = useBrowserDraft(current?.url ?? restoredUrl, request?.revision);
			/** TEMPORARY sandbox unlock for THIS surface only (never writes the global
			*  side card setting; lasts until the tab unmounts or the user restores). */
			const [localUnlock, setLocalUnlock] = (0, react.useState)(false);
			const noSandbox = store.getPrefs().browserNoSandbox === true || localUnlock;
			/** A site that refuses to be embedded (X-Frame-Options / frame-ancestors):
			*  the probe verdict shown instead of the blank iframe. */
			const [embedBlocked, setEmbedBlocked] = (0, react.useState)(null);
			/** The user asked to load the refused site anyway (keeps the plain iframe). */
			const [forceEmbed, setForceEmbed] = (0, react.useState)(false);
			/** Revision whose frame reported a load error (banner for that document). */
			const [failedRevision, setFailedRevision] = (0, react.useState)(null);
			/** Agent 实况模式（CDP screencast）：开启后本 tab 只显示 agent 无头
			*  浏览器的实况画面，地址栏/iframe 暂停。会话态开关，不持久化。 */
			const [live, setLive] = (0, react.useState)(false);
			/** Validate one address and load it (or record the refusal). */
			const loadUrl = (0, react.useCallback)((raw) => {
				const result = normalizeBrowserUrl(raw, window.location.origin);
				if (result.kind === "blocked") {
					navigation.addressFailed(result.reason);
					sync();
					return;
				}
				if (current?.url === result.url) {
					navigation.reload();
					sync();
					return;
				}
				navigation.navigate({
					url: result.url,
					title: result.title
				});
				setFailedRevision(null);
				sync();
			}, [
				current?.url,
				navigation,
				sync
			]);
			const goBack = (0, react.useCallback)(() => {
				navigation.back();
				sync();
			}, [navigation, sync]);
			const goForward = (0, react.useCallback)(() => {
				navigation.forward();
				sync();
			}, [navigation, sync]);
			const reload = (0, react.useCallback)(() => {
				navigation.reload();
				setFailedRevision(null);
				sync();
			}, [navigation, sync]);
			/** Report one rendered frame back to the state machine (loading → known,
			*  a second load for the same revision → unknown). */
			const reportLoaded = (0, react.useCallback)((revision) => {
				navigation.frameLoaded(revision);
				sync();
			}, [navigation, sync]);
			const bootstrapped = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (bootstrapped.current) return;
				bootstrapped.current = true;
				if (BrowserNavigation.current(navigation.snapshot) !== void 0) {
					reload();
					return;
				}
				if (restoredUrl !== void 0) loadUrl(restoredUrl);
			}, [
				loadUrl,
				navigation,
				reload,
				restoredUrl
			]);
			(0, react.useEffect)(() => {
				if (request === void 0) return;
				let cancelled = false;
				setEmbedBlocked(null);
				setForceEmbed(false);
				api.browserProbe(request.target.url).then((probe) => {
					if (!cancelled && embeddabilityOf(probe) === "blocked") setEmbedBlocked(request.target.url);
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, [request]);
			const autoRaised = (0, react.useRef)(false);
			const hadAgentPage = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (live || autoRaised.current) return;
				const timer = setInterval(async () => {
					if (autoRaised.current) return;
					try {
						const { targets: list } = await api.cdpTargets();
						const agentPages = list.filter((t) => t.url !== "" && !t.url.startsWith("about:"));
						const had = hadAgentPage.current;
						hadAgentPage.current = agentPages.length > 0;
						if (agentPages.length > 0 && had === false) {
							autoRaised.current = true;
							setLive(true);
							try {
								ctx.betterSidebar?.activateTab?.(tab.id);
							} catch {}
						}
					} catch {}
				}, 3e3);
				return () => {
					clearInterval(timer);
				};
			}, [
				live,
				ctx,
				tab.id
			]);
			const externalUrl = unknown ? void 0 : current?.url;
			const loadFailed = failedRevision !== null && failedRevision === request?.revision;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.browser,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.browserBar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("browserBack"),
								title: t("browserBack"),
								disabled: !BrowserNavigation.canGoBack(nav),
								onClick: goBack,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutlineRegular, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("browserForward"),
								title: t("browserForward"),
								disabled: !BrowserNavigation.canGoForward(nav),
								onClick: goForward,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("refresh"),
								title: t("refresh"),
								disabled: !navigation.canReload,
								onClick: reload,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: sidebar_module_css_default.browserInput,
								value: input,
								placeholder: t("browserPlaceholder"),
								spellCheck: false,
								onChange: (event) => {
									setInput(event.target.value);
								},
								onKeyDown: (event) => {
									if (event.key === "Enter") loadUrl(input);
								}
							}),
							unknown && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.browserChanged,
								title: t("browserLimitUnknown"),
								children: t("browserAddressChanged")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("browserGo"),
								title: t("browserGo"),
								onClick: () => {
									loadUrl(input);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineRegular, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("browserLive"),
								title: t("browserLive"),
								"aria-pressed": live,
								onClick: () => {
									setLive((value) => !value);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscRemoteExplorer, { size: 15 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.iconButton,
								"aria-label": t("browserOpenExternal"),
								title: t("browserOpenExternal"),
								disabled: externalUrl === void 0,
								onClick: () => {
									if (externalUrl !== void 0) window.open(externalUrl, "_blank", "noopener,noreferrer");
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VscLinkExternal, { size: 15 })
							})
						]
					}),
					message !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.browserMessage,
						children: message
					}),
					loadFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.browserMessage,
						children: t("browserLoadFailed")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SandboxStatusBar, {
						sandboxed: !noSandbox,
						local: localUnlock,
						dangerCopy: t("browserNoSandboxWarning"),
						onUnlock: () => {
							setLocalUnlock(true);
						},
						onRestore: () => {
							setLocalUnlock(false);
						}
					}),
					live ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LiveView, {}) : request === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.browserStart,
						children: t("browserStart")
					}) : embedBlocked !== null && !forceEmbed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrowserEmbedBlocked, {
						url: embedBlocked,
						onOpenInBrowser: () => {
							window.open(embedBlocked, "_blank", "noopener,noreferrer");
						},
						onLoadAnyway: () => {
							setForceEmbed(true);
						}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
						className: sidebar_module_css_default.browserFrame,
						src: request.target.url,
						sandbox: noSandbox ? void 0 : BROWSER_IFRAME_SANDBOX,
						referrerPolicy: "no-referrer",
						allow: "",
						title: request.target.title,
						onLoad: () => {
							reportLoaded(request.revision);
						},
						onError: () => {
							setFailedRevision(request.revision);
						},
						"data-sidebar-browser-frame": true
					}, `${request.target.url}:${String(request.revision)}:${noSandbox ? "ns" : "sb"}`),
					unknown && !live && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: sidebar_module_css_default.browserLimit,
						children: t("browserLimitUnknown")
					})
				]
			});
		}
		/**
		* The embed-refusal panel: shown when the probed site forbids being
		* displayed inside other pages (X-Frame-Options / frame-ancestors) — the
		* iframe would only show the browser's "refused to connect" blank. Explains
		* the reason and offers the real-browser open plus a load-anyway escape.
		* Exported so the copy and the actions are testable without a DOM.
		*/
		function BrowserEmbedBlocked(props) {
			const { url, onOpenInBrowser, onLoadAnyway } = props;
			let host = url;
			try {
				host = new URL(url).hostname;
			} catch {}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.browserBlocked,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 16 }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.browserBlockedTitle,
						children: t("browserEmbedBlocked", { host })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.browserBlockedDesc,
						children: t("browserEmbedBlockedDesc")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.browserBlockedActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.browserBlockedButton,
							onClick: onOpenInBrowser,
							children: t("browserOpenExternal")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.browserBlockedButton,
							onClick: onLoadAnyway,
							children: t("browserEmbedAnyway")
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/builtins/tabs.tsx
		/**
		* The 7 built-in tab descriptors: the plugin registers its own pages
		* (editor / git / subagent / sidechat / terminal / browser / diff) through
		* the same {@link BetterSidebarService} external plugins use — eating its
		* own dogfood. The terminal descriptor owns its quota (`TERMINAL_LIMIT`)
		* and mints `terminal:<uuid>` ids through `createTab`; the browser mints
		* `browser:<n>` the same way (no quota). The editor IS the files window
		* (the old standalone explorer merged into it).
		*/
		/**
		* Lazy wrapper over the terminal view: xterm (and its stylesheet) is fetched
		* only when a terminal tab is first opened (see chunk-loader.ts). The
		* wrapper keeps the descriptor contract `(props) => ReactNode` — Sidebar
		* calls it as a plain function.
		*
		* TerminalView's props are { scope, tabId, store } — `tabId` is NOT part of
		* TabComponentProps (it carries `tab: SidebarTab` instead), so the
		* descriptor maps it explicitly; a bare pass-through would leave tabId
		* undefined and TerminalView's isAgentTabId(tabId) would crash on
		* `undefined.startsWith` (regression-pinned in tests/lazy-chunk.spec.tsx).
		*/
		const LazyTerminal = lazyChunkComponent("terminal", (mod) => mod.TerminalView);
		/**
		* Lazy wrapper over the trajectory graph: the projection, swimlane layout and
		* SVG view (~70KB source) are fetched only when the tab is first opened, so
		* the core bundle keeps its startup size. The wrapper keeps the descriptor
		* contract `(props) => ReactNode`; `pick` is module-level for a stable
		* identity (an inline lambda would re-trigger the load effect).
		*/
		const LazyTrajectory = lazyChunkComponent("trajectory", (mod) => mod.TrajectoryGraph);
		/** A client-side uuid for terminal tab identity (not shown in the UI). */
		function terminalUuid() {
			if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
			return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
		}
		/** Count UI-owned terminals (agent:` tabs excluded — they are the model's). */
		function uiTerminalCount(state) {
			return allLeaves(state.splits).flatMap((leaf) => leaf.tabs).filter((tab) => tab.type === "terminal" && !isAgentTabId(tab.id)).length;
		}
		/** The 6 built-in tab descriptors. */
		function builtinTabs(ctx, options = {}) {
			return [
				{
					id: "editor",
					title: () => t("files"),
					icon: filesTabIcon,
					order: 10,
					hidden: false,
					dedupeKey: (tab) => tab.path,
					settings: {
						toggles: [{
							key: "editorExplorer",
							type: "select",
							title: () => t("editorExplorer"),
							desc: () => t("editorExplorerDesc"),
							options: [{
								value: true,
								icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutlineRegular, { size }),
								title: () => t("editorExplorerMerged"),
								desc: () => t("editorExplorerMergedDesc")
							}, {
								value: false,
								icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size }),
								title: () => t("editorExplorerSplit"),
								desc: () => t("editorExplorerSplitDesc")
							}]
						}],
						render: ({ pluginSettings, updatePluginSetting }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpenWithSettings, {
							pluginSettings,
							updatePluginSetting
						})
					},
					component: ({ ctx, store, scope, tab, expanded, revealed, onToggleDir, onReferenceFile }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EditorHost, {
						ctx,
						store,
						scope,
						tab,
						expanded: expanded ?? [],
						revealed: revealed ?? [],
						onToggleDir: onToggleDir ?? (() => {}),
						onReferenceFile: onReferenceFile ?? (() => {})
					})
				},
				{
					id: "git",
					title: () => t("git"),
					icon: changesTabIcon,
					order: 20,
					single: true,
					component: ({ ctx, store, scope, visible, onOpenDiff }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GitView, {
						scope,
						visible,
						onOpenFile: (path) => {
							openSidebarFile(ctx, store, scope.sessionId, path);
						},
						onOpenDiff: onOpenDiff ?? (() => {})
					})
				},
				{
					id: "subagent",
					title: () => t("subagent"),
					icon: tasksTabIcon,
					order: 30,
					single: true,
					settings: { toggles: [{
						key: "autoOpenSubagent",
						title: () => t("settingsSubagentTitle"),
						desc: () => t("settingsSubagentDesc")
					}, {
						key: "autoOpenJobs",
						title: () => t("settingsJobsTitle"),
						desc: () => t("settingsJobsDesc")
					}] },
					component: ({ ctx, scope, visible, onSubagentJump }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SubagentView, {
						sessionId: scope.sessionId,
						ctx,
						active: visible,
						onOpenChild: (address) => {
							onSubagentJump?.(address.childSessionId);
						}
					})
				},
				{
					id: "team",
					title: () => t("teamTitle"),
					icon: teamTabIcon,
					order: 31,
					single: true,
					component: ({ ctx, store, scope, tab, visible }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamView, {
						ctx,
						store,
						scope,
						tab,
						visible
					})
				},
				{
					id: "plans",
					title: () => t("plans"),
					icon: plansTabIcon,
					order: 32,
					single: true,
					component: ({ ctx, store, scope, visible, tab }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlansView, {
						ctx,
						scope,
						visible,
						scheduleTask: readScheduleTaskTarget(tab.meta),
						onDismissSchedule: () => {
							ctx.get("betterSidebar")?.updateTab(tab.id, { meta: {} });
						},
						onOpenFile: (path) => {
							openSidebarFile(ctx, store, scope.sessionId, path);
						}
					})
				},
				{
					id: "trajectory",
					title: () => t("trajectory"),
					icon: trajectoryTabIcon,
					order: 33,
					single: true,
					component: ({ ctx, scope, visible }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LazyTrajectory, {
						ctx,
						scope,
						active: visible
					})
				},
				{
					id: "sidechat",
					title: () => t("sideChat"),
					icon: sidechatTabIcon,
					order: 35,
					createTab: () => {
						const threadId = consumeSidechatSeed();
						if (threadId !== void 0) return { tab: {
							id: `sidechat:${threadId}`,
							type: "sidechat",
							title: t("sideChat"),
							meta: { threadId }
						} };
						return { tab: {
							id: `sidechat:new-${crypto.randomUUID()}`,
							type: "sidechat",
							title: t("sideChatUntitled"),
							meta: { autoCreate: true }
						} };
					},
					dedupeKey: (tab) => sidechatThreadIdOf(tab),
					onClose: (tab) => {
						const threadId = sidechatThreadIdOf(tab);
						if (threadId !== void 0) api.sidechatDispose(threadId).catch(() => {});
					},
					component: ({ ctx, scope, tab, visible }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SideChatView, {
						ctx,
						scope,
						tab,
						visible
					})
				},
				{
					id: "terminal",
					title: () => t("terminal"),
					icon: terminalTabIcon,
					order: 40,
					available: (_ctx, _scope, state) => uiTerminalCount(state) < 3,
					settings: { toggles: [
						{
							key: "agentTerminalTools",
							title: () => t("settingsToolsTitle"),
							desc: () => t("settingsToolsDesc")
						},
						{
							key: "terminalShell",
							type: "text",
							title: () => t("settingsShellTitle"),
							desc: () => t("settingsShellDesc"),
							placeholder: t("settingsShellPlaceholder")
						},
						{
							key: "terminalShellArgs",
							type: "text",
							title: () => t("settingsShellArgsTitle"),
							desc: () => t("settingsShellArgsDesc"),
							placeholder: t("settingsShellArgsPlaceholder")
						},
						{
							key: "terminalFontFamily",
							type: "text",
							title: () => t("settingsFontFamilyTitle"),
							desc: () => t("settingsFontFamilyDesc"),
							placeholder: t("settingsFontFamilyPlaceholder")
						},
						{
							key: "terminalFontSize",
							type: "number",
							title: () => t("settingsFontSizeTitle"),
							desc: () => t("settingsFontSizeDesc"),
							min: 9,
							max: 32,
							unit: "px"
						}
					] },
					createTab: (state) => {
						if (uiTerminalCount(state) >= 3) return null;
						return {
							tab: {
								id: `terminal:${terminalUuid()}`,
								type: "terminal",
								title: options.terminalTitle?.() ?? t("terminal")
							},
							patch: { nextTerminal: state.nextTerminal + 1 }
						};
					},
					component: ({ tab, scope, store }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LazyTerminal, {
						scope,
						store,
						tabId: tab.id
					})
				},
				{
					id: "browser",
					title: () => t("browser"),
					icon: browserTabIcon,
					order: 50,
					settings: { toggles: [
						{
							key: "browserNoSandbox",
							title: () => t("settingsBrowserSandboxTitle"),
							desc: () => t("settingsBrowserSandboxDesc")
						},
						{
							key: "browserInterceptLinks",
							title: () => t("settingsBrowserLinksTitle"),
							desc: () => t("settingsBrowserLinksDesc")
						},
						{
							key: "browserInterceptHttp",
							title: () => t("settingsBrowserHttpTitle"),
							desc: () => t("settingsBrowserHttpDesc")
						},
						{
							key: "browserInterceptHttps",
							title: () => t("settingsBrowserHttpsTitle"),
							desc: () => t("settingsBrowserHttpsDesc")
						}
					] },
					createTab: (state) => ({
						tab: {
							id: `browser:${state.nextBrowser}`,
							type: "browser",
							title: t("browser")
						},
						patch: { nextBrowser: state.nextBrowser + 1 }
					}),
					component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrowserView, { ...props })
				},
				{
					id: "diff",
					title: () => t("git"),
					icon: changesTabIcon,
					order: -1,
					hidden: true,
					dedupeKey: (tab) => tab.id,
					component: ({ scope, tab }) => tab.diff === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffTab, {
						sessionId: scope.sessionId,
						cwd: scope.cwd,
						diff: tab.diff
					})
				}
			];
		}
		//#endregion
		//#region src/client/PdfView.tsx
		/** Browser-native PDF preview with an always-available download fallback. */
		function PdfView(props) {
			const { scope, path, title } = props;
			const [load, setLoad] = (0, react.useState)({ status: "loading" });
			const [interactionBlocked, setInteractionBlocked] = (0, react.useState)(false);
			const frameRef = (0, react.useRef)(null);
			const shieldRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				let objectUrl;
				setLoad({ status: "loading" });
				(async () => {
					try {
						const response = await fetch(mediaUrl(scope, path), { signal: controller.signal });
						if (!response.ok) throw new Error(`HTTP ${response.status}`);
						const bytes = await response.arrayBuffer();
						if (controller.signal.aborted) return;
						objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
						setLoad({
							status: "ready",
							url: objectUrl
						});
					} catch (error) {
						if (controller.signal.aborted) return;
						setLoad({
							status: "error",
							message: error instanceof Error ? error.message : String(error)
						});
					}
				})();
				return () => {
					controller.abort();
					if (objectUrl !== void 0) URL.revokeObjectURL(objectUrl);
				};
			}, [
				scope.sessionId,
				scope.cwd,
				path
			]);
			(0, react.useEffect)(() => {
				const block = () => {
					setInteractionBlocked(true);
					if (frameRef.current !== null) frameRef.current.style.pointerEvents = "none";
					if (shieldRef.current !== null) shieldRef.current.style.pointerEvents = "auto";
				};
				const unblock = () => {
					setInteractionBlocked(false);
					if (frameRef.current !== null) frameRef.current.style.pointerEvents = "";
					if (shieldRef.current !== null) shieldRef.current.style.pointerEvents = "none";
				};
				const blockForResize = (event) => {
					const target = event.target;
					if (target instanceof Element && target.closest(`.${sidebar_module_css_default.panelResize}, .${sidebar_module_css_default.divider}`) !== null) block();
				};
				document.addEventListener("dragstart", block, true);
				document.addEventListener("dragend", unblock, true);
				document.addEventListener("drop", unblock, true);
				window.addEventListener("pointerdown", blockForResize, true);
				window.addEventListener("pointerup", unblock, true);
				window.addEventListener("pointercancel", unblock, true);
				window.addEventListener("blur", unblock);
				return () => {
					document.removeEventListener("dragstart", block, true);
					document.removeEventListener("dragend", unblock, true);
					document.removeEventListener("drop", unblock, true);
					window.removeEventListener("pointerdown", blockForResize, true);
					window.removeEventListener("pointerup", unblock, true);
					window.removeEventListener("pointercancel", unblock, true);
					window.removeEventListener("blur", unblock);
				};
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.editorPdf,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebar_module_css_default.editorPdfToolbar,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						className: sidebar_module_css_default.editorDownloadLink,
						href: downloadUrl(scope, path),
						download: true,
						children: t("downloadToView")
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.editorPdfStage,
					children: [
						load.status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.editorPlaceholder,
							children: t("loading")
						}),
						load.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.editorError,
							children: load.message
						}),
						load.status === "ready" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
							ref: frameRef,
							className: clsx(sidebar_module_css_default.editorPdfFrame, interactionBlocked && sidebar_module_css_default.editorPdfFrameBlocked),
							src: load.url,
							title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							ref: shieldRef,
							className: clsx(sidebar_module_css_default.editorPdfDragShield, interactionBlocked && sidebar_module_css_default.editorPdfDragShieldActive),
							"aria-hidden": "true"
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/VideoView.tsx
		/**
		* Inline video preview: plays the file in a native `<video>` element that
		* streams from the media route (which answers HTTP Range with 206 — see
		* src/media-range.ts), so scrubbing works and the file is never capped by
		* the route's `mediaLimit`.
		*
		* Absorbed from the derivative plugin `dsh-video-preview` (MIT, zemul): the
		* viewer keeps its contract (viewer id `video`, the same extension list, the
		* same "always offer the raw file" affordance) but now lives in-tree, uses
		* the sidebar's own localization and shares the core bundle — the player
		* itself is a few KB, so no lazy chunk is warranted.
		*
		* Deliberate deviation from that plugin's extension list: `ts` is NOT
		* claimed. `.ts` means TypeScript in this repo's world (and MPEG-TS in the
		* video one); claiming it hijacked every TypeScript file into the player.
		* `m2ts` keeps the container covered without the collision — the same
		* correction the plugin itself shipped in 0.1.4.
		*/
		function VideoView(props) {
			const { scope, path, title } = props;
			const [failed, setFailed] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				setFailed(false);
			}, [
				scope.sessionId,
				scope.cwd,
				path
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.editorVideo,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebar_module_css_default.editorVideoStage,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
						className: sidebar_module_css_default.editorVideoPlayer,
						src: mediaUrl(scope, path),
						controls: true,
						preload: "metadata",
						playsInline: true,
						onError: () => {
							setFailed(true);
						}
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.editorVideoMeta,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.editorVideoName,
							title: path,
							children: title
						}),
						failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.editorVideoNotice,
							children: t("videoUnsupported")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							className: sidebar_module_css_default.editorDownloadLink,
							href: downloadUrl(scope, path),
							download: true,
							children: t("downloadToView")
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/builtins/viewers.tsx
		/**
		* The 10 built-in file viewer descriptors: every preview surface is a
		* registered viewer (image / pdf / docx / xlsx / pptx / video / markdown /
		* html / code / binary-download), exactly like external plugins register
		* theirs.
		*
		* The Office three-piece set (docx/xlsx/pptx) and the video player are
		* maintained in-tree since 1.0.15: the derivative plugins that used to
		* provide them (`@huanlin/dsh-plugin-better-sidebar-plugin-office`,
		* `dsh-video-preview`) are absorbed into this package, so they must NOT be
		* installed alongside this version — their viewer ids would collide with
		* these registrations.
		*
		* The `binary-download` viewer sniffs NUL bytes via `detect` for unknown
		* binaries and serves legacy doc/xls/ppt by extension; `code` is the
		* catch-all (`exts: []`, lowest priority) that claims any file no other
		* viewer did.
		*
		* The heavy viewers (the CodeMirror-backed markdown/html/code and the
		* docx-preview + Univer + pptx-renderer Office stack) render through
		* {@link lazyChunkComponent} wrappers — their libraries are fetched only
		* when such a file is first opened (see chunk-loader.ts). The descriptor
		* metadata (id/exts/priority/detect) is identical either way, so matching
		* semantics and external-plugin overrides are unaffected; the `component`
		* wrapper keeps the descriptor contract `(props) => ReactNode`.
		*
		* Every viewer carries the declarative settings-surface fields — `title`
		* and `icon` — so the Side card settings page can render the enable/disable
		* inventory without hardcoding (eating our own dogfood).
		*/
		/**
		* Lazy wrapper over the chunk-resident viewer component. The `pick`
		* function is module-level (stable identity — the wrapper effect depends
		* on it); the cast bridges the chunk exports record to the descriptor prop
		* shape (the view reads only its own subset of FileViewerProps).
		*/
		const LazyTextEditor = lazyChunkComponent("editor", (mod) => mod.TextEditor);
		const LazyDocxView = lazyChunkComponent("office", (mod) => mod.DocxView);
		const LazyXlsxView = lazyChunkComponent("office", (mod) => mod.XlsxView);
		const LazyPptxView = lazyChunkComponent("office", (mod) => mod.PptxView);
		/** The 10 built-in file viewer descriptors. */
		function builtinViewers() {
			return [
				{
					id: "image",
					title: () => t("viewerImage"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconImageOutline16, { size }),
					exts: [
						"png",
						"jpg",
						"jpeg",
						"gif",
						"webp",
						"svg",
						"bmp",
						"ico",
						"avif"
					],
					fetchStrategy: "mediaUrl",
					component: ({ mediaUrl: url, title }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.editorImageWrap,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
							className: sidebar_module_css_default.editorImage,
							src: url,
							alt: title
						})
					})
				},
				{
					id: "pdf",
					title: () => t("viewerPdf"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPdfOutline16, { size }),
					exts: ["pdf"],
					fetchStrategy: "mediaUrl",
					component: ({ scope, path, title }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PdfView, {
						scope,
						path,
						title
					})
				},
				{
					id: "docx",
					title: () => t("viewerDocx"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconDocxOutline16, { size }),
					exts: ["docx"],
					fetchStrategy: "mediaUrl",
					component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LazyDocxView, { ...props })
				},
				{
					id: "xlsx",
					title: () => t("viewerXlsx"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconXlsxOutline16, { size }),
					exts: ["xlsx"],
					fetchStrategy: "mediaUrl",
					component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LazyXlsxView, { ...props })
				},
				{
					id: "pptx",
					title: () => t("viewerPptx"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPptxOutline16, { size }),
					exts: ["pptx"],
					fetchStrategy: "mediaUrl",
					component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LazyPptxView, { ...props })
				},
				{
					id: "video",
					title: () => t("viewerVideo"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconVideoOutline16, { size }),
					exts: [
						"mp4",
						"webm",
						"mov",
						"qt",
						"m4v",
						"mkv",
						"avi",
						"wmv",
						"flv",
						"ogv",
						"ogg",
						"mpeg",
						"mpg",
						"3gp",
						"3g2",
						"m2ts"
					],
					fetchStrategy: "none",
					component: ({ scope, path, title }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VideoView, {
						scope,
						path,
						title
					})
				},
				{
					id: "markdown",
					title: () => t("viewerMarkdown"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconMarkdownOutline16, { size }),
					exts: ["md", "markdown"],
					fetchStrategy: "fsRead",
					component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LazyTextEditor, { ...props })
				},
				{
					id: "html",
					title: () => t("viewerHtml"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconHtmlOutline16, { size }),
					exts: ["html", "htm"],
					fetchStrategy: "fsRead",
					settings: { toggles: [{
						key: "htmlViewerNoSandbox",
						title: () => t("settingsHtmlSandboxTitle"),
						desc: () => t("settingsHtmlSandboxDesc")
					}, {
						key: "htmlViewerDefaultUnsafe",
						title: () => t("settingsHtmlDefaultUnsafeTitle"),
						desc: () => t("settingsHtmlDefaultUnsafeDesc")
					}] },
					component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LazyTextEditor, { ...props })
				},
				{
					id: "code",
					title: () => t("viewerCode"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size }),
					exts: [],
					priority: -100,
					fetchStrategy: "fsRead",
					component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LazyTextEditor, { ...props })
				},
				{
					id: "binary-download",
					title: () => t("viewerBinary"),
					icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutlineRegular, { size }),
					exts: [
						"doc",
						"xls",
						"ppt"
					],
					priority: -50,
					fetchStrategy: "binary-download",
					detect: (_path, head) => head.includes(0),
					component: ({ scope, path }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BinaryDownload, {
						scope,
						path
					})
				}
			];
		}
		//#endregion
		//#region src/client/builtins/index.ts
		/**
		* Register all built-in tabs and viewers with the service. Returns a
		* disposer that unregisters everything (cordis auto-invokes it on fiber
		* disposal). The `ctx` is threaded into tab descriptors that need it
		* (EditorHost reads `ctx.betterSidebar` for file-viewer matching).
		*/
		function registerBuiltins(ctx, service, options = {}) {
			const disposers = [];
			for (const tab of builtinTabs(ctx, options)) disposers.push(service.registerTab(tab));
			for (const viewer of builtinViewers()) disposers.push(service.registerFileViewer(viewer));
			return () => {
				for (const d of disposers) try {
					d();
				} catch {}
			};
		}
		//#endregion
		//#region src/client/conversation-draft.ts
		/**
		* Splice `text` into `draft` at `caret` (replacing any live selection) with
		* whitespace-aware joins and report the caret position right after the
		* inserted text. `caret === null` (position unknown) appends at the end,
		* exactly like the original behavior.
		*/
		function spliceInsert(draft, text, caret) {
			if (caret === null || draft === "") {
				const next = draft.trim() === "" ? text : `${draft} ${text}`;
				return {
					draft: next,
					caretAfter: next.length
				};
			}
			const prefix = draft.slice(0, caret.start);
			const suffix = draft.slice(caret.end);
			if (prefix === "" && suffix === "") return {
				draft: text,
				caretAfter: text.length
			};
			const left = prefix === "" || /\s$/.test(prefix) ? "" : " ";
			return {
				draft: `${prefix}${left}${text}${suffix === "" || /^\s/.test(suffix) ? "" : " "}${suffix}`,
				caretAfter: prefix.length + left.length + text.length
			};
		}
		/**
		* Locate the composer `<textarea>` in the conversation column: prefer the
		* `data-phase`-tagged textarea (the composer's marker), falling back to any
		* textarea in the column, then to a bare data-phase textarea (older host
		* layouts without the column attribute). Null in jsdom-less hosts.
		*/
		function findComposerTextarea() {
			if (typeof document === "undefined") return null;
			const column = document.querySelector("#root [data-slot=\"conversation\"]");
			const find = (scope) => scope.querySelector("textarea[data-phase]") ?? scope.querySelector("textarea");
			return column !== null ? find(column) : document.querySelector("textarea[data-phase]");
		}
		/**
		* Resolve the composer's live caret from its DOM `<textarea>`. The draft
		* store has no caret API, so the sidebar reads the composed input's selection
		* directly; the value-sync check (`el.value === draft`) discards stale or
		* wrong-composer reads — a caret must never be applied against a draft it
		* was not measured on.
		*
		* Returns null when the composer is missing, disabled/read-only, out of
		* sync with the store draft, or has no measurable selection (odd hosts
		* report null selectionStart/End).
		*/
		function probeComposerCaret(draft) {
			const el = findComposerTextarea();
			if (el === null || el.disabled || el.readOnly) return null;
			if (el.value !== draft) return null;
			let start = el.selectionStart;
			let end = el.selectionEnd;
			if (typeof start !== "number" || typeof end !== "number") return null;
			if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
			start = Math.max(0, Math.min(start, draft.length));
			end = Math.max(start, Math.min(end, draft.length));
			return {
				start,
				end
			};
		}
		/**
		* Restore the composer caret to `caretIndex` after a programmatic
		* `setDraft` commit. A controlled textarea update resets the caret (React
		* commits the value asynchronously and the browser moves the caret to the
		* start/end), so the placement is scheduled and retried across at most two
		* animation frames (setTimeout fallback), and only applied when the textarea
		* still matches `expectedDraft` — a newer edit or a different composer wins
		* the race untouched. The caret is clamped into the value bounds, mirroring
		* how browsers clamp type-in positions.
		*/
		function placeComposerCaretAfterInsert(expectedDraft, caretIndex) {
			let remaining = 2;
			let scheduled = false;
			const schedule = (fn) => {
				if (scheduled) return;
				scheduled = true;
				if (typeof requestAnimationFrame === "function") requestAnimationFrame(fn);
				else setTimeout(fn, 0);
			};
			const place = () => {
				scheduled = false;
				if (remaining <= 0) return;
				remaining -= 1;
				const el = findComposerTextarea();
				if (el === null || el.disabled || el.readOnly) return;
				if (el.value !== expectedDraft) {
					schedule(place);
					return;
				}
				const clamped = Math.max(0, Math.min(caretIndex, el.value.length));
				el.setSelectionRange(clamped, clamped);
			};
			schedule(place);
		}
		/**
		* Insert `text` into the session's composer draft at the composer's live
		* caret (see {@link probeComposerCaret}), falling back to appending at the
		* end when the caret cannot be resolved. Returns false — and logs — when the
		* conversation service or the session scope is unavailable.
		*/
		function appendToDraft(ctx, sessionId, text) {
			try {
				const actx = ctx.sessions.scope(sessionId);
				if (actx === void 0) {
					console.warn("[dsh-coding-sidebar] draft insert skipped: no session scope", sessionId);
					return false;
				}
				const conversation = ctx.get("conversation");
				if (conversation === void 0) {
					console.warn("[dsh-coding-sidebar] draft insert skipped: conversation service unavailable");
					return false;
				}
				const input = conversation.input.for(actx);
				const draft = input.state.getSnapshot().draft;
				const { draft: next, caretAfter } = spliceInsert(draft, text, probeComposerCaret(draft));
				input.setDraft(next);
				placeComposerCaretAfterInsert(next, caretAfter);
				return true;
			} catch (error) {
				console.warn("[dsh-coding-sidebar] draft insert failed:", error);
				return false;
			}
		}
		/**
		* The DSH `@file` spelling for one relative path, mirroring the host grammar
		* (`formatFileMention` in `@deepseek-ai/dsh-file-reference`): plain when
		* there is no whitespace, quoted when there is, and `undefined` when the
		* path contains a control character or an embedded quote the editor grammar
		* cannot represent.
		*/
		function fileMention(relativePath) {
			const path = relativePath.replace(/[\\/]+$/, "");
			if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return void 0;
			const mention = /\s/u.test(path) ? `@"${path}"` : `@${path}`;
			const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return {
				mention,
				label: at === -1 ? path : path.slice(at + 1)
			};
		}
		/**
		* Insert one FILE reference as a structured chip (like DSH's own `@` picker).
		* The chip displays `@<basename>` but serializes to `@<relative path>` on
		* send, so the reference stays a single link from trigger to basename.
		*
		* Directories are NOT handled here: DSH's folder grammar wants the trailing
		* slash as plain text (`@dir/`) so completion can descend, which
		* `appendToDraft` already covers.
		*/
		function insertFileReference(ctx, sessionId, relativePath) {
			const reference = fileMention(relativePath);
			if (reference === void 0) return false;
			try {
				const actx = ctx.sessions.scope(sessionId);
				if (actx === void 0) return false;
				const conversation = ctx.get("conversation");
				if (conversation === void 0) return false;
				const input = conversation.input.for(actx);
				const before = input.state.getSnapshot();
				if (before.draftRev === void 0) return false;
				actx.emit("slash/input-insert-reference", {
					reference: {
						source: "reference",
						ref: reference.mention,
						label: reference.label,
						appearance: "file",
						clipboardText: reference.mention
					},
					span: {
						draftRev: before.draftRev,
						start: before.draft.length,
						end: before.draft.length
					}
				});
				return input.state.getSnapshot().draftRev !== before.draftRev;
			} catch (error) {
				console.warn("[dsh-coding-sidebar] file-reference insert failed:", error);
				return false;
			}
		}
		//#endregion
		//#region src/client/pinned.ts
		const PINNED_META_KEY = "__pinnedHome";
		const PINNED_VID_PREFIX = "pinned:";
		/** Whether a tab id is a pinned virtual id (prefixed). */
		function isPinnedVirtualId(tabId) {
			return tabId.startsWith(PINNED_VID_PREFIX);
		}
		/** Parse a pinned virtual id into its home session id and original tab id.
		*  Format: `pinned:<homeSessionId>:<originalTabId>` — session ids are UUIDs
		*  (no colons), so the first colon after the prefix delimits the session. */
		function parsePinnedVirtualId(tabId) {
			const rest = tabId.slice(7);
			const sep = rest.indexOf(":");
			if (sep < 0) return {
				homeSessionId: rest,
				tabId: ""
			};
			return {
				homeSessionId: rest.slice(0, sep),
				tabId: rest.slice(sep + 1)
			};
		}
		/** Extract the home scope from a pinned virtual tab's meta (undefined for
		*  regular tabs). */
		function getPinnedHomeScope(tab) {
			return tab.meta?.[PINNED_META_KEY] ?? void 0;
		}
		/** Whether a tab is a pinned virtual tab (injected from another session). */
		function isPinnedVirtualTab(tab) {
			return getPinnedHomeScope(tab) !== void 0;
		}
		/** Create a virtual SidebarTab for a pinned entry. The virtual id is unique
		*  (prefixed with home session) to avoid collision with the viewer's own
		*  tab ids; the original id is stored in meta for TerminalView. */
		function createPinnedVirtualTab(entry) {
			const { tab, homeSessionId } = entry;
			const home = {
				sessionId: homeSessionId,
				cwd: tab.pin?.homeCwd,
				tabId: tab.id
			};
			return {
				...tab,
				id: PINNED_VID_PREFIX + homeSessionId + ":" + tab.id,
				meta: {
					...tab.meta ?? {},
					[PINNED_META_KEY]: home
				}
			};
		}
		/** Inject pinned virtual tabs into the first leaf of a split tree, and
		*  override that leaf's `active` when a pinned tab is activated. Returns
		*  the original tree when there are no pinned tabs and no active override. */
		function injectPinnedIntoTree(tree, pinned, activePinnedId) {
			if (pinned.length === 0 && activePinnedId === null) return tree;
			if (tree.kind === "leaf") return {
				...tree,
				tabs: pinned.length > 0 ? [...tree.tabs, ...pinned] : tree.tabs,
				active: activePinnedId ?? tree.active
			};
			return {
				...tree,
				children: [injectPinnedIntoTree(tree.children[0], pinned, activePinnedId), ...tree.children.slice(1)]
			};
		}
		/**
		* Whether a pinned tab is visible to the viewer session. Conservative on
		* unknown cwd: a `workspace` pin with no `homeCwd` is visible everywhere
		* (the pin was set before the home session's cwd resolved), and a viewer
		* whose cwd is unknown sees every workspace pin (avoids hydration flash).
		*/
		function pinnedVisibleTo(tab, viewer) {
			const pin = tab.pin;
			if (pin === void 0) return false;
			if (pin.scope === "global") return true;
			const home = pin.homeCwd;
			if (home === void 0) return true;
			if (viewer.cwd === void 0) return true;
			return viewer.cwd === home;
		}
		/**
		* Collect every pinned terminal visible to the viewer across ALL cached
		* session states. Excludes the viewer's own session (those tabs are on its
		* own strip). Order is stable: sessions in the cache's insertion order,
		* tabs in tree order (splits → floats) within each session
		* — the order tabs were opened/pinned, so the rail never reorders between
		* renders.
		*/
		function collectPinnedTabs(bySession, viewer) {
			const entries = [];
			for (const [homeSessionId, state] of bySession) {
				if (homeSessionId === viewer.sessionId) continue;
				collectFromTree(state.splits, homeSessionId, viewer, entries);
				for (const float of state.floats) if (float.tab.type === "terminal" && pinnedVisibleTo(float.tab, viewer)) entries.push({
					tab: float.tab,
					homeSessionId
				});
			}
			return entries;
		}
		/** Walk one split tree depth-first, collecting visible pinned terminals. */
		function collectFromTree(node, homeSessionId, viewer, out) {
			if (node.kind === "leaf") {
				for (const tab of node.tabs) if (tab.type === "terminal" && pinnedVisibleTo(tab, viewer)) out.push({
					tab,
					homeSessionId
				});
				return;
			}
			for (const child of node.children) collectFromTree(child, homeSessionId, viewer, out);
		}
		//#endregion
		//#region src/client/TabBar.tsx
		/**
		* The tab strip of one pane: tabs capped at TAB_MAX_WIDTH (ellipsized),
		* overflow scrolls horizontally, a close button per tab, a four-way split
		* button cluster, and the + menu that opens new tabs (explorer / git /
		* terminal). Tabs are draggable; dropping onto another tab inserts before it,
		* dropping on the strip background appends to this pane. Right-clicking a
		* tab opens the tab context menu (float as a free window / close / close
		* others / close to the left / close to the right, the close ones scoped to
		* this pane).
		*/
		/** Drag payload for tab moves (HTML5 DnD dataTransfer). */
		const TAB_DRAG_TYPE = "application/x-dsh-tab";
		function serializeDrag(payload) {
			return JSON.stringify(payload);
		}
		function parseDrag(raw) {
			try {
				const parsed = JSON.parse(raw);
				if (typeof parsed.tabId === "string" && typeof parsed.paneId === "string") return parsed;
				return null;
			} catch {
				return null;
			}
		}
		/** Global tab-drag flag: PDF iframes become non-interactive synchronously. */
		function setTabDragging(active) {
			if (active) document.body.setAttribute("data-dsh-tab-dragging", "");
			else document.body.removeAttribute("data-dsh-tab-dragging");
		}
		function TabBar(props) {
			const { paneId, tabs, active, onActivate, onClose, onNewTab, newTabOptions, onDropTab, onFloatTab, onPinTab, getTabIcon, getTabBadge } = props;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const [tabMenu, setTabMenu] = (0, react.useState)(null);
			const [dragOver, setDragOver] = (0, react.useState)(false);
			const listRef = (0, react.useRef)(null);
			const tabMenuIndex = tabMenu === null ? -1 : tabs.findIndex((tab) => tab.id === tabMenu.tabId);
			const onCloseRef = (0, react.useRef)(onClose);
			const middlePressed = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				onCloseRef.current = onClose;
			});
			(0, react.useEffect)(() => {
				const onMouseUp = (event) => {
					if (event.button !== 1) return;
					const pressed = middlePressed.current;
					middlePressed.current = null;
					if (pressed !== null && pressed.node.isConnected && pressed.node.contains(event.target)) onCloseRef.current(pressed.id);
				};
				window.addEventListener("mouseup", onMouseUp);
				return () => {
					window.removeEventListener("mouseup", onMouseUp);
				};
			}, []);
			(0, react.useEffect)(() => {
				const el = listRef.current;
				if (el === null) return;
				const onWheel = (event) => {
					if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
					if (el.scrollWidth <= el.clientWidth) return;
					event.preventDefault();
					const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1;
					el.scrollLeft += (event.deltaX + event.deltaY) * unit;
				};
				el.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					el.removeEventListener("wheel", onWheel);
				};
			}, []);
			(0, react.useEffect)(() => {
				const clear = () => {
					setTabDragging(false);
					setDragOver(false);
				};
				window.addEventListener("dragend", clear, true);
				window.addEventListener("drop", clear, true);
				window.addEventListener("blur", clear);
				return () => {
					window.removeEventListener("dragend", clear, true);
					window.removeEventListener("drop", clear, true);
					window.removeEventListener("blur", clear);
				};
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: clsx(sidebar_module_css_default.tabBar, dragOver && sidebar_module_css_default.tabBarDrop),
				onDragOver: (event) => {
					event.preventDefault();
					event.stopPropagation();
					setDragOver(true);
				},
				onDragLeave: () => {
					setDragOver(false);
				},
				onDrop: (event) => {
					event.preventDefault();
					event.stopPropagation();
					setDragOver(false);
					setTabDragging(false);
					const payload = parseDrag(event.dataTransfer.getData(TAB_DRAG_TYPE));
					if (payload !== null) onDropTab(payload, null);
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: listRef,
					className: sidebar_module_css_default.tabList,
					children: [
						tabs.map((tab) => {
							const pinned = isPinnedVirtualTab(tab) || tab.pin !== void 0;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: clsx(sidebar_module_css_default.tab, active === tab.id && sidebar_module_css_default.tabActive, pinned && sidebar_module_css_default.pinnedTab),
								title: tab.title,
								draggable: !pinned,
								onDragStart: pinned ? void 0 : (event) => {
									setTabDragging(true);
									event.dataTransfer.setData(TAB_DRAG_TYPE, serializeDrag({
										tabId: tab.id,
										paneId
									}));
									event.dataTransfer.effectAllowed = "move";
								},
								onDragEnd: () => {
									setTabDragging(false);
									setDragOver(false);
								},
								onDragOver: (event) => {
									event.preventDefault();
									event.stopPropagation();
								},
								onDrop: (event) => {
									if (pinned) {
										event.stopPropagation();
										return;
									}
									event.preventDefault();
									event.stopPropagation();
									setTabDragging(false);
									const payload = parseDrag(event.dataTransfer.getData(TAB_DRAG_TYPE));
									if (payload !== null) onDropTab(payload, tab.id);
								},
								onClick: () => {
									onActivate(tab.id);
								},
								onMouseDown: (event) => {
									if (event.button === 1) {
										event.preventDefault();
										middlePressed.current = {
											id: tab.id,
											node: event.currentTarget
										};
									}
								},
								onContextMenu: (event) => {
									event.preventDefault();
									setMenuOpen(false);
									setTabMenu({
										tabId: tab.id,
										x: event.clientX,
										y: event.clientY
									});
								},
								children: [
									pinned && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPinOutline16, { size: 16 }),
									getTabIcon?.(tab) ?? null,
									getTabBadge?.(tab) ?? null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: sidebar_module_css_default.tabTitle,
										children: tab.title
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: sidebar_module_css_default.tabClose,
										"aria-label": t("close"),
										onClick: (event) => {
											event.stopPropagation();
											onClose(tab.id);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillRegular, {})
									})
								]
							}, tab.id);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: newTabOptions.map((option) => ({
								id: option.id,
								label: option.label,
								...option.disabled === true ? { disabled: true } : {},
								...option.icon !== void 0 ? { icon: option.icon } : {}
							})),
							onSelect: (id) => {
								onNewTab(id);
								setMenuOpen(false);
							},
							portal: true,
							align: "end",
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.tabBarPlus,
								"aria-label": t("newTab"),
								title: t("newTab"),
								onClick: () => {
									setMenuOpen((v) => !v);
									setTabMenu(null);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, {})
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: tabMenu !== null && tabMenuIndex >= 0,
							onClose: () => {
								setTabMenu(null);
							},
							items: (() => {
								const targetTab = tabMenuIndex >= 0 ? tabs[tabMenuIndex] : void 0;
								const isTerminal = targetTab?.type === "terminal";
								const isPinnedVirtual = targetTab !== void 0 && isPinnedVirtualTab(targetTab);
								const pinEntries = isTerminal && onPinTab !== void 0 ? targetTab.pin !== void 0 ? [{
									id: "unpin",
									label: t("unpinTerminal")
								}] : [{
									id: "pin",
									label: isAgentTabId(targetTab.id) ? t("pinAgentTerminal") : t("pinTerminal"),
									submenu: [{
										id: "pinWorkspace",
										label: t("pinToWorkspace")
									}, {
										id: "pinGlobal",
										label: t("pinToGlobal")
									}]
								}] : [];
								if (isPinnedVirtual) return [...pinEntries, {
									id: "close",
									label: t("close")
								}];
								return [
									{
										id: "float",
										label: t("moveToFreeWindow")
									},
									...pinEntries,
									{
										id: "close",
										label: t("close")
									},
									{
										id: "closeOthers",
										label: t("closeOtherTabs"),
										...tabs.length <= 1 ? { disabled: true } : {}
									},
									{
										id: "closeLeft",
										label: t("closeLeftTabs"),
										...tabMenuIndex <= 0 ? { disabled: true } : {}
									},
									{
										id: "closeRight",
										label: t("closeRightTabs"),
										...tabMenuIndex >= tabs.length - 1 ? { disabled: true } : {}
									}
								];
							})(),
							onSelect: (id) => {
								const target = tabMenu;
								if (target === null) return;
								setTabMenu(null);
								const index = tabs.findIndex((tab) => tab.id === target.tabId);
								if (index < 0) return;
								if (id === "float") onFloatTab(target.tabId);
								else if (id === "pinWorkspace") onPinTab?.(target.tabId, "workspace");
								else if (id === "pinGlobal") onPinTab?.(target.tabId, "global");
								else if (id === "unpin") onPinTab?.(target.tabId, null);
								else if (id === "close") onClose(target.tabId);
								else if (id === "closeOthers") {
									for (const tab of tabs) if (tab.id !== target.tabId) onClose(tab.id);
								} else if (id === "closeLeft") for (const tab of tabs.slice(0, index)) onClose(tab.id);
								else if (id === "closeRight") for (const tab of tabs.slice(index + 1)) onClose(tab.id);
							},
							portal: true,
							align: "start",
							getAnchorRect: () => tabMenu === null ? null : new DOMRect(tabMenu.x, tabMenu.y, 0, 0),
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/split-pane.tsx
		/**
		* The split-pane workbench: renders the recursive split tree. A split lays
		* children out row- or column-wise with draggable dividers (fractional
		* sizes); a leaf renders its tab strip plus the active tab's content.
		*
		* Splitting is VSCode-style DRAG-TO-EDGE, not buttons: while dragging a tab
		* over a pane, a drop overlay shows five zones — four edges (left/right/up/
		* down) that split the pane with the tab in a fresh leaf, and the center
		* that merges the tab into the pane. The tree and all operations live in
		* state.ts; this file is pure presentation over them.
		*/
		/** One divider: pointer-capture drag translating px deltas into fractions.
		* Deltas are incremental — each move reports the displacement since the
		* previous move — because the store adds every reported delta to the pane
		* sizes; a cumulative (since-pointer-down) delta would be re-added on each
		* move and the divider would run away from the cursor.
		*
		* The moves are BATCHED per frame (createFrameBatcher): a pointer stream
		* fires faster than the display refresh, and applying each move is a store
		* reduce that re-renders both workbenches (terminals, editors, trees) per
		* event — the visible drag lag on slower CPUs (#315). The batch accumulates
		* the incremental deltas in a ref and applies the summed fraction at most
		* once per frame; the sum equals what the per-event application would have
		* produced (the reducer clamps each application, and at a settled position
		* a clamped sum is clamped to the same boundary), so the result is
		* indistinguishable at rest and at most one frame behind the cursor.
		*/
		function Divider(props) {
			const { dir, onResize } = props;
			const last = (0, react.useRef)({
				x: 0,
				y: 0,
				size: 0
			});
			const [dragging, setDragging] = (0, react.useState)(false);
			const pendingDelta = (0, react.useRef)(0);
			const batcher = (0, react.useRef)(createFrameBatcher()).current;
			(0, react.useEffect)(() => () => batcher.dispose(), [batcher]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: clsx(sidebar_module_css_default.divider, dir === "row" ? sidebar_module_css_default.dividerRow : sidebar_module_css_default.dividerCol, dragging && sidebar_module_css_default.dividerActive),
				onPointerDown: (event) => {
					event.preventDefault();
					event.currentTarget.setPointerCapture(event.pointerId);
					const box = event.currentTarget.parentElement?.getBoundingClientRect();
					last.current = {
						x: event.clientX,
						y: event.clientY,
						size: box === void 0 ? 1 : dir === "row" ? box.width : box.height
					};
					setDragging(true);
				},
				onPointerMove: (event) => {
					if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
					const delta = dir === "row" ? event.clientX - last.current.x : event.clientY - last.current.y;
					pendingDelta.current += delta;
					batcher.schedule(() => {
						const accumulated = pendingDelta.current;
						pendingDelta.current = 0;
						if (accumulated !== 0) onResize(accumulated / Math.max(1, last.current.size));
					});
					last.current.x = event.clientX;
					last.current.y = event.clientY;
				},
				onPointerUp: (event) => {
					if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
					batcher.flushNow();
					event.currentTarget.releasePointerCapture(event.pointerId);
					setDragging(false);
				}
			});
		}
		/** Map a pointer position inside a pane to the VSCode drop zone (25% edges). */
		function zoneAt(event, pane) {
			const rect = pane.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) return "center";
			const x = (event.clientX - rect.left) / rect.width;
			const y = (event.clientY - rect.top) / rect.height;
			if (x < .25) return "left";
			if (x > .75) return "right";
			if (y < .25) return "up";
			if (y > .75) return "down";
			return "center";
		}
		/** The icon of one openable type card (mirror of the + menu options). */
		/**
		* An empty pane's welcome cards: the openable types as cards, clicked to
		* open (instead of a bare "this pane is empty" message).
		*/
		function PaneEmptyCards(props) {
			const { newTabOptions, onNewTab } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidebar_module_css_default.paneEmptyCards,
				children: newTabOptions.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: sidebar_module_css_default.paneCard,
					disabled: option.disabled === true,
					title: option.label,
					onClick: () => {
						onNewTab(option.id);
					},
					children: [option.icon ?? null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: option.label })]
				}, option.id))
			});
		}
		/** A leaf: tab strip + active content + VSCode-style drop target for tabs. */
		function LeafView(props) {
			const { leaf, newTabOptions, actions, onNewTab, renderTab, getTabIcon, getTabBadge } = props;
			const [dropZone, setDropZone] = (0, react.useState)(null);
			const activeTab = leaf.tabs.find((tab) => tab.id === leaf.active) ?? leaf.tabs[leaf.tabs.length - 1];
			(0, react.useEffect)(() => {
				const clear = () => {
					setDropZone(null);
				};
				window.addEventListener("dragend", clear, true);
				window.addEventListener("drop", clear, true);
				window.addEventListener("blur", clear);
				return () => {
					window.removeEventListener("dragend", clear, true);
					window.removeEventListener("drop", clear, true);
					window.removeEventListener("blur", clear);
				};
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(sidebar_module_css_default.pane, dropZone !== null && sidebar_module_css_default.paneDrop),
				"data-dsh-pane": leaf.id,
				onPointerDown: () => {
					actions.focusPane(leaf.id);
				},
				onDragOver: (event) => {
					event.preventDefault();
					const zone = zoneAt(event, event.currentTarget);
					setDropZone(zone);
				},
				onDragLeave: (event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) setDropZone(null);
				},
				onDrop: (event) => {
					event.preventDefault();
					const zone = dropZone ?? zoneAt(event, event.currentTarget);
					setDropZone(null);
					const payload = parseDrag(event.dataTransfer.getData("application/x-dsh-tab"));
					if (payload !== null) actions.moveTabToEdge(payload, leaf.id, zone);
				},
				children: [
					dropZone !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: clsx(sidebar_module_css_default.dropOverlay, sidebar_module_css_default[`drop${dropZone[0].toUpperCase()}${dropZone.slice(1)}`]) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabBar, {
						paneId: leaf.id,
						tabs: leaf.tabs,
						active: leaf.active,
						onActivate: (tabId) => {
							actions.activateTab(leaf.id, tabId);
						},
						onClose: (tabId) => {
							actions.closeTab(leaf.id, tabId);
						},
						onNewTab,
						newTabOptions,
						getTabIcon,
						getTabBadge,
						onDropTab: (payload, before) => {
							if (before === null) actions.moveTabToEdge(payload, leaf.id, "center");
							else actions.moveTabBefore(payload, leaf.id, before);
						},
						onFloatTab: actions.floatTab,
						onPinTab: actions.pinTab
					}),
					leaf.tabs.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.paneContent,
						children: leaf.tabs.map((tab) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: clsx(sidebar_module_css_default.paneTab, tab.id !== activeTab?.id && sidebar_module_css_default.paneTabHidden),
							children: renderTab(tab, tab.id === activeTab?.id, leaf.id)
						}, tab.id))
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PaneEmptyCards, {
						newTabOptions,
						onNewTab
					})
				]
			});
		}
		/** Recursive node renderer. */
		function NodeView(props) {
			const { node, state, newTabOptions, actions, onNewTab, renderTab, getTabIcon, getTabBadge } = props;
			if (node.kind === "leaf") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LeafView, {
				leaf: node,
				newTabOptions,
				actions,
				onNewTab,
				renderTab,
				getTabIcon,
				getTabBadge
			});
			const isRow = node.dir === "row";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: clsx(sidebar_module_css_default.split, isRow ? sidebar_module_css_default.splitRow : sidebar_module_css_default.splitCol),
				children: node.children.map((child, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [index > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Divider, {
					dir: node.dir,
					onResize: (deltaFrac) => {
						actions.resizeSplit(node.id, index - 1, deltaFrac);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebar_module_css_default.splitChild,
					style: {
						flexGrow: node.sizes[index],
						flexBasis: 0,
						minWidth: 0,
						minHeight: 0
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NodeView, {
						node: child,
						state,
						newTabOptions,
						actions,
						onNewTab,
						renderTab,
						getTabIcon,
						getTabBadge
					})
				})] }, child.id))
			});
		}
		/** The workbench: the split tree filling the sidebar body (`tree` overrides
		*  `state.splits` — the pinned-injection augmented tree). */
		function Workbench(props) {
			const { state, tree, newTabOptions, actions, onNewTab, renderTab, getTabIcon, getTabBadge } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidebar_module_css_default.workbench,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NodeView, {
					node: tree ?? state.splits,
					state,
					newTabOptions,
					actions,
					onNewTab,
					renderTab,
					getTabIcon,
					getTabBadge
				})
			});
		}
		//#endregion
		//#region src/client/layout-push.ts
		/**
		* Width written to `--dsh-sidebar-width`: the app shell gives up this much
		* of the viewport while the sidebar is open (0 while collapsed), so the
		* conversation column (output + composer) is squeezed instead of covered.
		* The value is capped at the viewport so a stale persisted size (e.g.
		* fullscreen on a bigger window) can never crush the app shell to zero.
		*/
		function finiteNonNegative(value) {
			return Number.isFinite(value) ? Math.max(0, value) : 0;
		}
		/** Compute the live layout-push width. Narrow drawers float and push 0. */
		function layoutPushSize(input) {
			if (input.narrow) return 0;
			return input.panelOpen ? Math.min(finiteNonNegative(input.width), finiteNonNegative(input.viewportWidth)) : 0;
		}
		//#endregion
		//#region src/client/desktop-env.ts
		let cached;
		/** Read the shell's desktop stamps (memoized per page; SSR-safe). */
		function parseDesktopEnv() {
			if (cached !== void 0) return cached;
			const hasWindow = typeof window !== "undefined";
			const hasPreloadMarker = hasWindow && typeof window.__DSH_DESKTOP_FILE_PATH__ !== "undefined";
			const params = hasWindow ? new URLSearchParams(window.location.search.replace(/^\?/, "")) : new URLSearchParams();
			const modeParam = params.get("dsh-desktop-mode");
			const mode = modeParam === "compatibility" || modeParam === "advanced" ? modeParam : null;
			const platformParam = params.get("dsh-desktop-platform");
			const platform = platformParam !== null && platformParam !== "" ? platformParam.toLowerCase() : null;
			cached = {
				desktop: mode !== null || hasPreloadMarker,
				mode,
				platform,
				titlebarInset: parseTitlebarInset(params.get("dsh-desktop-titlebar-inset"))
			};
			return cached;
		}
		/** Clamp the contract inset parameter into 0–120 (invalid/absent → 0). */
		function parseTitlebarInset(raw) {
			if (raw === null) return 0;
			const parsed = Number(raw);
			if (!Number.isFinite(parsed)) return 0;
			return Math.min(120, Math.max(0, Math.round(parsed)));
		}
		//#endregion
		//#region src/client/wco.ts
		/** Snapshot when the API is unavailable (plain browser / non-overlay shell). */
		const WCO_NONE = Object.freeze({
			present: false,
			height: 0
		});
		let source;
		let snapshot = WCO_NONE;
		let attached = false;
		let sourceListener;
		const listeners = /* @__PURE__ */ new Set();
		function read() {
			if (source === void 0) return WCO_NONE;
			try {
				if (source.visible !== true) return {
					present: false,
					height: 0
				};
				const rect = source.getTitlebarAreaRect();
				const height = Math.round(rect.height);
				return Number.isFinite(height) && height > 0 ? {
					present: true,
					height
				} : {
					present: true,
					height: 0
				};
			} catch {
				return {
					present: false,
					height: 0
				};
			}
		}
		function onGeometryChange() {
			snapshot = read();
			emit();
		}
		function emit() {
			for (const listener of listeners) listener();
		}
		/** Attach the native geometrychange listener (once). */
		function attach() {
			if (attached) return;
			attached = true;
			const candidate = source ?? navigator.windowControlsOverlay;
			if (candidate === void 0) return;
			source = candidate;
			sourceListener = onGeometryChange;
			snapshot = read();
			source.addEventListener("geometrychange", sourceListener);
		}
		/** Detach the native listener (last subscriber left or source swapped). */
		function detach() {
			if (source !== void 0 && sourceListener !== void 0) source.removeEventListener("geometrychange", sourceListener);
			sourceListener = void 0;
			attached = false;
		}
		/** Read the current snapshot (returns the frozen NONE when unavailable). */
		function getWcoSnapshot() {
			return snapshot;
		}
		/**
		* Subscribe to overlay geometry changes. Attaches to the real
		* `navigator.windowControlsOverlay` on first subscribe; the disposer
		* detaches the native listener when the last subscriber leaves.
		*/
		function subscribeWco(onChange) {
			listeners.add(onChange);
			attach();
			return () => {
				listeners.delete(onChange);
				if (listeners.size === 0) detach();
			};
		}
		//#endregion
		//#region src/client/shell-presets.ts
		const PRESETS = [{
			id: "dsh-desktop",
			title: "DeepSeek Harness Desktop",
			desc: "Electron 高级模式（无边框）：macOS 顶栏 20px、Windows 无 WCO 时 32px 标题栏让位",
			stripFor: (env) => {
				if (env.mode !== "advanced") return void 0;
				if (env.platform === "darwin") return 20;
				if (env.platform === "win32") return 32;
			},
			detect: (env) => env.mode === "advanced"
		}];
		/** All built-in shell presets (registration order = settings list order). */
		function getShellPresets() {
			return PRESETS;
		}
		/** One preset by id, or undefined for an unknown/empty id. */
		function getShellPreset(id) {
			return PRESETS.find((preset) => preset.id === id);
		}
		/** The strip the active preset contributes for the given environment. */
		function presetStripFor(preset, env) {
			return preset?.stripFor?.(env);
		}
		//#endregion
		//#region src/client/titlebar-strip.ts
		function computeTitleBarStrip(env, wco, scheme, preset, customStripPx) {
			if (scheme === "web") return 0;
			if (wco.present) return wco.height;
			if (env.titlebarInset > 0) return env.titlebarInset;
			if (scheme === "preset") return presetStripFor(preset, env) ?? 0;
			if (scheme === "custom") return customStripPx;
			return 0;
		}
		//#endregion
		//#region src/client/FreeWindow.tsx
		/**
		* One free window: a tab dragged out of the workbench floating over the
		* conversation area at viewport coordinates (rendered inside the panel host,
		* so desktop-shell transforms can never hijack its fixed containing block).
		*
		* The header drags the window with the panel-resize pattern — pointer
		* capture + per-frame direct DOM writes + a store commit on release — and
		* doubling as the DOCK-BACK gesture: while the pointer is over a workbench
		* pane ([data-dsh-pane], either panel), that pane highlights live and
		* releasing docks the tab into it (center merge); releasing anywhere else
		* just moves the window. The SE corner resizes, any press raises (the
		* floats array's order is the stacking order), the header right-click menu
		* and the X button dock / close. The tab content reuses the regular tab
		* renderer, so every tab type (terminal, editor, plugin tabs) floats
		* unchanged.
		*/
		/** The pane under a viewport point, if any (rect hit-test; the dragged
		*  window itself is not a pane, so it cannot shadow the targets). */
		function paneAt(x, y) {
			for (const pane of document.querySelectorAll("[data-dsh-pane]")) {
				const rect = pane.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) continue;
				if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return pane;
			}
			return null;
		}
		/** Pointer-capture helpers tolerant of environments without the API (jsdom
		*  lacks setPointerCapture — component tests dispatch plain MouseEvents, so
		*  the optional calls keep them driving the drag; real browsers always have
		*  it and a missing pointerId can never occur there). */
		const capturePointer = (element, pointerId) => {
			element.setPointerCapture?.(pointerId);
		};
		const releasePointer = (element, pointerId) => {
			element.releasePointerCapture?.(pointerId);
		};
		/** Whether the element holds the pointer (assumed true without the API). */
		const holdsPointer = (element, pointerId) => {
			return element.hasPointerCapture?.(pointerId) !== false;
		};
		function FreeWindow(props) {
			const { float, renderTab, getTabIcon, onRaise, onMove, onResize, onDock, onClose } = props;
			const rootRef = (0, react.useRef)(null);
			const dragRef = (0, react.useRef)(null);
			const dockTargetRef = (0, react.useRef)(null);
			const frameRef = (0, react.useRef)(null);
			const pendingRef = (0, react.useRef)(null);
			const [dragging, setDragging] = (0, react.useState)(null);
			const [menu, setMenu] = (0, react.useState)(null);
			(0, react.useEffect)(() => () => {
				if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
				dockTargetRef.current?.removeAttribute("data-dsh-float-dock-over");
			}, []);
			/** Apply the pending geometry to the DOM (one rAF per frame at most). */
			const scheduleApply = (geo) => {
				pendingRef.current = geo;
				if (frameRef.current !== null) return;
				frameRef.current = requestAnimationFrame(() => {
					frameRef.current = null;
					const pending = pendingRef.current;
					const drag = dragRef.current;
					const root = rootRef.current;
					if (pending === null || drag === null || root === null) return;
					drag.applied = pending;
					root.style.left = `${pending.x}px`;
					root.style.top = `${pending.y}px`;
					root.style.width = `${pending.w}px`;
					root.style.height = `${pending.h}px`;
				});
			};
			/** Flush the pending frame synchronously (the release path's last write). */
			const flushNow = () => {
				const pending = pendingRef.current;
				const drag = dragRef.current;
				const root = rootRef.current;
				if (pending === null || drag === null || root === null) return;
				if (frameRef.current !== null) {
					cancelAnimationFrame(frameRef.current);
					frameRef.current = null;
				}
				pendingRef.current = null;
				drag.applied = pending;
				root.style.left = `${pending.x}px`;
				root.style.top = `${pending.y}px`;
				root.style.width = `${pending.w}px`;
				root.style.height = `${pending.h}px`;
			};
			const clearDockHighlight = () => {
				dockTargetRef.current?.removeAttribute("data-dsh-float-dock-over");
				dockTargetRef.current = null;
			};
			/** Release a drag: `pane` (when set) docks instead of moving. */
			const finishDrag = (mode, geo, pane) => {
				const drag = dragRef.current;
				if (drag === null || drag.committed) return;
				drag.committed = true;
				dragRef.current = null;
				setDragging(null);
				const target = pane ?? dockTargetRef.current;
				clearDockHighlight();
				if (mode === "move" && target !== null) onDock(target.getAttribute("data-dsh-pane"));
				else if (mode === "move") onMove(geo.x, geo.y);
				else onResize(geo.w, geo.h);
			};
			/** Cancel-path settle (pointercancel / lostpointercapture): the last
			* APPLIED geometry is the user-visible truth — commit it, never roll back
			* (the panel drags' issue-#247 semantics). The mode comes from the ref —
			* the React `dragging` state can still be null when the cancel lands
			* before the pointerdown re-render commits. */
			const abortDrag = () => {
				const drag = dragRef.current;
				if (drag === null || drag.committed) return;
				flushNow();
				finishDrag(drag.mode, drag.applied, null);
			};
			const clampMove = (x, y) => {
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				return {
					x: Math.min(Math.max(x, 0), Math.max(0, vw - float.w)),
					y: Math.min(Math.max(y, 0), Math.max(0, vh - float.h)),
					w: float.w,
					h: float.h
				};
			};
			const clampResize = (w, h) => {
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				return {
					x: float.x,
					y: float.y,
					w: Math.round(Math.min(Math.max(w, 320), Math.max(320, vw - float.x))),
					h: Math.round(Math.min(Math.max(h, 200), Math.max(200, vh - float.y)))
				};
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: clsx(sidebar_module_css_default.floatWindow, dragging !== null && sidebar_module_css_default.floatWindowDragging),
				"data-dsh-float-window": true,
				"data-dsh-float-id": float.id,
				style: {
					left: float.x,
					top: float.y,
					width: float.w,
					height: float.h
				},
				onPointerDown: () => {
					onRaise();
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidebar_module_css_default.floatHeader,
						onPointerDown: (event) => {
							if (event.button !== 0) return;
							if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
							if (event.target instanceof Element && event.target.closest("button") !== null) return;
							event.preventDefault();
							capturePointer(event.currentTarget, event.pointerId);
							dragRef.current = {
								mode: "move",
								pointerX: event.clientX,
								pointerY: event.clientY,
								startX: float.x,
								startY: float.y,
								startW: float.w,
								startH: float.h,
								applied: {
									x: float.x,
									y: float.y,
									w: float.w,
									h: float.h
								},
								committed: false
							};
							setDragging("move");
						},
						onPointerMove: (event) => {
							const drag = dragRef.current;
							if (drag === null || !holdsPointer(event.currentTarget, event.pointerId)) return;
							const geo = clampMove(drag.startX + (event.clientX - drag.pointerX), drag.startY + (event.clientY - drag.pointerY));
							scheduleApply(geo);
							const target = paneAt(event.clientX, event.clientY);
							if (target !== dockTargetRef.current) {
								clearDockHighlight();
								if (target !== null) target.setAttribute("data-dsh-float-dock-over", "");
								dockTargetRef.current = target;
							}
						},
						onPointerUp: (event) => {
							if (dragRef.current === null || !holdsPointer(event.currentTarget, event.pointerId)) return;
							releasePointer(event.currentTarget, event.pointerId);
							flushNow();
							const geo = clampMove(dragRef.current.startX + (event.clientX - dragRef.current.pointerX), dragRef.current.startY + (event.clientY - dragRef.current.pointerY));
							finishDrag("move", geo, paneAt(event.clientX, event.clientY));
						},
						onPointerCancel: () => {
							abortDrag();
						},
						onLostPointerCapture: () => {
							abortDrag();
						},
						onContextMenu: (event) => {
							event.preventDefault();
							setMenu({
								x: event.clientX,
								y: event.clientY
							});
						},
						children: [
							getTabIcon?.(float.tab) ?? null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidebar_module_css_default.floatTitle,
								title: float.tab.title,
								children: float.tab.title
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.floatClose,
								"aria-label": t("close"),
								onClick: (event) => {
									event.stopPropagation();
									onClose();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillRegular, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menu !== null,
								onClose: () => {
									setMenu(null);
								},
								items: [{
									id: "dock",
									label: t("dockToSidebar")
								}, {
									id: "close",
									label: t("close")
								}],
								onSelect: (id) => {
									setMenu(null);
									if (id === "dock") onDock(null);
									else if (id === "close") onClose();
								},
								portal: true,
								align: "start",
								getAnchorRect: () => menu === null ? null : new DOMRect(menu.x, menu.y, 0, 0),
								anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.floatContent,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.paneTab,
							children: renderTab(float.tab, true, float.id)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.floatResize,
						onPointerDown: (event) => {
							if (event.button !== 0) return;
							if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
							event.preventDefault();
							capturePointer(event.currentTarget, event.pointerId);
							dragRef.current = {
								mode: "resize",
								pointerX: event.clientX,
								pointerY: event.clientY,
								startX: float.x,
								startY: float.y,
								startW: float.w,
								startH: float.h,
								applied: {
									x: float.x,
									y: float.y,
									w: float.w,
									h: float.h
								},
								committed: false
							};
							setDragging("resize");
						},
						onPointerMove: (event) => {
							const drag = dragRef.current;
							if (drag === null || !holdsPointer(event.currentTarget, event.pointerId)) return;
							scheduleApply(clampResize(drag.startW + (event.clientX - drag.pointerX), drag.startH + (event.clientY - drag.pointerY)));
						},
						onPointerUp: (event) => {
							if (dragRef.current === null || !holdsPointer(event.currentTarget, event.pointerId)) return;
							releasePointer(event.currentTarget, event.pointerId);
							flushNow();
							const geo = clampResize(dragRef.current.startW + (event.clientX - dragRef.current.pointerX), dragRef.current.startH + (event.clientY - dragRef.current.pointerY));
							finishDrag("resize", geo, null);
						},
						onPointerCancel: () => {
							abortDrag();
						},
						onLostPointerCapture: () => {
							abortDrag();
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/OrphanedTab.tsx
		function OrphanedTab(props) {
			const { tab } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidebar_module_css_default.editor,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebar_module_css_default.editorHeader,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: sidebar_module_css_default.editorTitle,
						title: tab.type,
						children: tab.title
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidebar_module_css_default.editorPlaceholder,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("pluginNotLoaded") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
						className: sidebar_module_css_default.orphanedType,
						children: tab.type
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/RenderBoundary.tsx
		/**
		* The generic render error boundary for the sidebar tree: a render error in
		* the wrapped subtree shows a dismissible error strip (retry re-renders the
		* children) instead of blanking the shell. Used at two scopes:
		*
		* - ROOT (index.tsx, `css.boundaryError`): last-resort containment for
		*   errors in the sidebar shell itself (Workbench, drag layout, …) — a full
		*   swap keeps the page alive.
		* - PER-TAB (Sidebar.tsx TabContent, `css.tabBoundaryError`): a crashing
		*   viewer/editor shows a strip inside ITS OWN pane; the toggle cluster, the
		*   other tabs, and the panel itself stay alive (issue #31 — a tab crash
		*   must never take down the whole sidebar).
		*
		* The className prop selects the strip's geometry: the root's full-height
		* fixed rail vs. the tab's pane-filling block.
		*/
		var RenderBoundary = class extends react.Component {
			state = { error: null };
			static getDerivedStateFromError(error) {
				return { error: error instanceof Error ? error.message : String(error) };
			}
			componentDidCatch(error, info) {
				console.error("[dsh-coding-sidebar] render error:", error, info.componentStack);
			}
			render() {
				if (this.state.error !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: this.props.className,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["dsh-coding-sidebar: ", this.state.error] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: sidebar_module_css_default.terminalRetry,
						onClick: () => {
							this.setState({ error: null });
						},
						children: t("terminalRetry")
					})]
				});
				return this.props.children;
			}
		};
		//#endregion
		//#region src/client/tab-content-memo.ts
		/** True when the cell may skip a re-render (all render-affecting fields
		*  unchanged). Callback/context identities are deliberately ignored: their
		*  captured dependencies are stable or covered by the compared fields
		*  (onReferenceFile → sessionId/cwd, onSubagentJump/onToggleDir → stable
		*  refs/closures, onOpenDiff → paneId). */
		function tabContentCompare(prev, next) {
			return prev.tab === next.tab && prev.paneId === next.paneId && prev.sessionId === next.sessionId && prev.cwd === next.cwd && prev.visible === next.visible && prev.expanded === next.expanded && prev.revealed === next.revealed && prev.localeRevision === next.localeRevision && prev.tabsVersion === next.tabsVersion && prev.effectiveTabId === next.effectiveTabId;
		}
		//#endregion
		//#region src/client/Sidebar.tsx
		/**
		* The sidebar shell: a panel mounted inside the unified panel host — a
		* fixed, viewport-sized containing block ([data-dsh-panel-host]) appended
		* to document.body — instead of an individual fixed-position element, so a
		* desktop shell's intermediate wrapper transforms can never hijack the
		* panel's fixed containing block (the core AppFrame owns the left sidebar /
		* center / details columns and has no right-side hole for plugins). The
		* panel hosts the workbench; a persistent toggle button at the top-right
		* corner opens/closes it, and its width drags from the left edge. The whole
		* layout lives in the per-session store, so switching conversations swaps
		* the sidebar.
		*
		* The shell binds the workbench actions to the store and dispatches tab
		* content to the views. New tabs come from the + menu (explorer / git /
		* terminal; editors open from the explorer). Tabs can also be dragged out
		* of the panel onto the conversation area as free windows.
		*
		* Narrow (mobile, <768px) viewports turn the panel into a full-width
		* drawer: the layout push is disabled (the drawer floats over the app
		* shell) and the width drag strip is not offered — a full-screen sheet has
		* nothing to drag.
		*/
		/** How many consecutive reconnect failures stop the agent-terminals push loop
		* (mirror of the terminal view's own cap; the loop restarts on session switch). */
		const FAILURE_LIMIT = 3;
		/**
		* Subagent auto-open debounce (ms). The host delivers a new child's origin
		* and its title in SEPARATE frames: a Side Chat thread's first visible
		* frame still shows a fallback title (no 'Side: ' prefix), so an immediate
		* 0→N decision mistakes it for a genuine subagent and pops the task page.
		* The trigger therefore re-evaluates against the live snapshot once the
		* title frame has had time to land.
		*/
		const AUTO_OPEN_DEBOUNCE_MS = 500;
		/**
		* OS file drags over the sidebar belong to the sidebar, not to the chat:
		* DSH's composer (InputBar) listens for file drags on the DOCUMENT and
		* answers with a full-screen "drop image here" mask plus image intake on
		* drop. Both panel-host render sites swallow the whole event quartet —
		* enter/over/leave/drop — so the region is a black hole to that document
		* listener. All four must be stopped: InputBar keeps an enter/leave depth
		* counter, and a leave that escapes without its matching enter unbalances
		* the count (this was the full-screen mask flickering over the sidebar).
		* The conversation column keeps DSH's native overlay and intake untouched;
		* gated on the 'Files' type so in-app drags (tab reorder, split zones)
		* propagate exactly as before.
		*/
		const swallowOsFileDrag = (event) => {
			if (!(event.dataTransfer?.types.includes("Files") ?? false)) return;
			event.preventDefault();
			event.stopPropagation();
		};
		/** The four drag events a file drag must never carry past the panel host. */
		const osFileDragShield = {
			onDragEnter: swallowOsFileDrag,
			onDragOver: swallowOsFileDrag,
			onDragLeave: swallowOsFileDrag,
			onDrop: swallowOsFileDrag
		};
		/**
		* Append one user-space stylesheet (preset or custom CSS) as a tagged
		* `<style>` element. The tag attribute carries the source identity so the
		* running configuration is inspectable in DevTools; the returned tag is
		* removed by the caller's effect cleanup.
		*/
		function injectUserCss(attr, id, cssText) {
			const tag = document.createElement("style");
			tag.setAttribute(attr, id);
			tag.textContent = cssText;
			document.head.appendChild(tag);
			return tag;
		}
		/** Render the content of one tab (dispatched by type). */
		const TabContent = (0, react.memo)(function TabContent(props) {
			const { tab, effectiveTabId, sessionId, cwd, expanded, revealed, onToggleDir, onReferenceFile, ctx, store, visible, onSubagentJump, onOpenDiff, onPathRenamed, onPathRemoved } = props;
			const scope = {
				sessionId,
				cwd
			};
			const descriptor = ctx.get("betterSidebar")?.getTab(tab.type);
			if (descriptor === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OrphanedTab, {
				ctx,
				store,
				scope,
				tab,
				visible
			});
			const componentTab = effectiveTabId !== void 0 ? {
				...tab,
				id: effectiveTabId
			} : tab;
			return (0, react.createElement)(RenderBoundary, { className: sidebar_module_css_default.tabBoundaryError }, (0, react.createElement)(descriptor.component, {
				ctx,
				store,
				scope,
				tab: componentTab,
				visible,
				expanded,
				revealed,
				onToggleDir,
				onReferenceFile,
				onOpenDiff,
				onSubagentJump
			}));
		}, tabContentCompare);
		/** The + menu options for the current state, driven by the tab registry.
		* Hidden tabs (editor/diff) never show; `available` returning false shows
		* a disabled row (e.g. terminal at capacity) instead of hiding the option.
		* Tabs the user disabled in the side card settings are filtered out
		* entirely — re-enabling them is the settings page's job. */
		function buildNewTabOptions(state, ctx, scope) {
			const service = ctx.get("betterSidebar");
			if (service === void 0) return [];
			return service.getTabs().filter((d) => !d.hidden && service.isTabEnabled(d.id)).sort((a, b) => (a.order ?? 100) - (b.order ?? 100)).map((d) => ({
				id: d.id,
				label: typeof d.title === "function" ? d.title() : d.title,
				disabled: !(d.available?.(ctx, scope, state) ?? true),
				icon: typeof d.icon === "function" ? d.icon(16) : d.icon
			}));
		}
		function Sidebar(props) {
			const { ctx, store } = props;
			const localeRevision = (0, react.useSyncExternalStore)((0, react.useMemo)(() => (callback) => ctx.locale.subscribe(callback), [ctx]), (0, react.useCallback)(() => ctx.locale.getSnapshot().active, [ctx]));
			const betterLocaleStore = typeof ctx.get === "function" ? ctx.get("betterLocale") : void 0;
			(0, react.useSyncExternalStore)((0, react.useMemo)(() => {
				const store = betterLocaleStore;
				if (store === void 0) return (_cb) => () => {};
				return (callback) => store.subscribe(callback);
			}, [betterLocaleStore]), (0, react.useMemo)(() => {
				const store = betterLocaleStore;
				if (store === void 0) return () => void 0;
				return () => store.active;
			}, [betterLocaleStore]));
			const [tabsVersion, setTabsVersion] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const service = ctx.get("betterSidebar");
				if (service === void 0) return;
				return service.subscribe(() => setTabsVersion((version) => version + 1));
			}, [ctx]);
			const viewport = useViewportSize();
			const narrow = isNarrowWidth(viewport.width);
			const [keyboardInset, setKeyboardInset] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const vv = window.visualViewport;
				if (vv === null || vv === void 0) return;
				let frame = null;
				const measure = () => {
					frame = null;
					const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
					setKeyboardInset(inset > 1 ? Math.round(inset) : 0);
				};
				const onResize = () => {
					if (frame === null) frame = requestAnimationFrame(measure);
				};
				vv.addEventListener("resize", onResize);
				vv.addEventListener("scroll", onResize);
				measure();
				return () => {
					vv.removeEventListener("resize", onResize);
					vv.removeEventListener("scroll", onResize);
					if (frame !== null) cancelAnimationFrame(frame);
				};
			}, []);
			const sessionList = (0, react.useSyncExternalStore)((0, react.useMemo)(() => (callback) => ctx.sessions.list.subscribe(callback), [ctx]), (0, react.useCallback)(() => ctx.sessions.list.getSnapshot(), [ctx]));
			const current = sessionList.current ?? (() => {
				for (const [id, summary] of Object.entries(sessionList.byId)) if ((summary.retainedBy?.mainView ?? 0) > 0) return id;
			})();
			const snapshot = (0, react.useSyncExternalStore)((0, react.useCallback)((callback) => store.subscribe(callback), [store]), (0, react.useCallback)(() => store.getSnapshot(), [store]));
			(0, react.useEffect)(() => {
				store.setSession(current);
			}, [current, store]);
			const state = snapshot.state;
			const sessionId = snapshot.sessionId;
			const summaryCwd = sessionId === void 0 ? void 0 : sessionList.byId[sessionId]?.cwd;
			const collapsed = state === void 0 || !state.panelOpen;
			(0, react.useEffect)(() => {
				if (collapsed) document.body.setAttribute("data-dsh-sidebar-collapsed", "");
				else document.body.removeAttribute("data-dsh-sidebar-collapsed");
				return () => {
					document.body.removeAttribute("data-dsh-sidebar-collapsed");
				};
			}, [collapsed]);
			const desktopEnv = parseDesktopEnv();
			const wco = (0, react.useSyncExternalStore)((0, react.useMemo)(() => subscribeWco, []), getWcoSnapshot);
			const scheme = snapshot.prefs.titleBarScheme;
			const preset = scheme === "preset" ? getShellPreset(snapshot.prefs.titleBarPresetId) : void 0;
			const titleBarStrip = computeTitleBarStrip(desktopEnv, wco, scheme, preset, snapshot.prefs.titleBarStripPx);
			const titleBarCompat = titleBarStrip > 0;
			(0, react.useEffect)(() => {
				const root = document.documentElement;
				if (titleBarCompat) {
					document.body.setAttribute("data-dsh-title-bar-compat", "");
					root.style.setProperty("--dsh-title-bar-strip", `${titleBarStrip}px`);
				} else {
					document.body.removeAttribute("data-dsh-title-bar-compat");
					root.style.removeProperty("--dsh-title-bar-strip");
				}
				return () => {
					document.body.removeAttribute("data-dsh-title-bar-compat");
					root.style.removeProperty("--dsh-title-bar-strip");
				};
			}, [titleBarCompat, titleBarStrip]);
			const presetCss = scheme === "preset" ? preset?.css ?? "" : "";
			const customCss = scheme === "custom" ? snapshot.prefs.customCss : "";
			(0, react.useEffect)(() => {
				const tags = [];
				if (presetCss !== "") tags.push(injectUserCss("data-dsh-preset-css", preset?.id ?? "", presetCss));
				if (customCss !== "") tags.push(injectUserCss("data-dsh-custom-css", "custom", customCss));
				return () => {
					for (const tag of tags) tag.remove();
				};
			}, [
				presetCss,
				customCss,
				preset?.id
			]);
			const [fetchedCwd, setFetchedCwd] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				setFetchedCwd(void 0);
				if (sessionId === void 0 || summaryCwd !== void 0) return;
				let cancelled = false;
				api.sessionCwd({ sessionId }).then((result) => {
					if (!cancelled) setFetchedCwd(result.cwd);
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, [sessionId, summaryCwd]);
			const cwd = summaryCwd ?? fetchedCwd;
			/**
			* Agent terminals push: subscribe to the host's live list of agent-owned
			* terminals for this session (created by the model through the
			* `terminal_create` tool). The host pushes a JSON array on every
			* create / close / exit; the sidebar reconciles the list into tabs
			* (id `agent:<uuid>`, title from the agent). A disconnected socket
			* retries with a short backoff so a refresh or transient drop reattaches
			* the same shell without losing the agent's work — capped like the
			* terminal view's own reconnect loop, so a refused endpoint never spins
			* forever (the next session switch restarts the loop).
			* While the terminal tab type is disabled in settings, pushes are
			* ignored (no auto-added tabs); re-enabling makes the next push converge.
			*/
			(0, react.useEffect)(() => {
				if (sessionId === void 0) return;
				let socket = null;
				let retry;
				let closed = false;
				let failures = 0;
				const connect = () => {
					if (closed) return;
					const url = new URL("/sidebar/ws/agent-terminals", location.origin);
					url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
					url.search = new URLSearchParams({ sessionId }).toString();
					socket = new WebSocket(url.toString());
					socket.onmessage = (event) => {
						if (typeof event.data !== "string") return;
						try {
							const list = JSON.parse(event.data);
							if (!Array.isArray(list)) return;
							store.reduce((s) => ctx.get("betterSidebar")?.isTabEnabled("terminal") === false ? s : reconcileAgentTerminals(s, list));
						} catch {}
					};
					socket.onclose = () => {
						if (closed) return;
						failures += 1;
						if (failures >= FAILURE_LIMIT) {
							console.error("[dsh-coding-sidebar] agent-terminals connection failed; stopping reconnect loop", sessionId);
							return;
						}
						retry = window.setTimeout(connect, 2e3);
					};
					socket.onerror = () => {
						socket?.close();
					};
				};
				connect();
				return () => {
					closed = true;
					window.clearTimeout(retry);
					socket?.close();
				};
			}, [sessionId, store]);
			/**
			* Agent opens push: subscribe to the host's `sidebar_open` requests for
			* this session (the model actively opens a file / folder / HTTP(S) page).
			* The host pushes one JSON request per open; the sidebar routes it to the
			* matching built-in tab: a file opens in the editor (per-path dedupe), a
			* folder opens a file window whose tree is rooted at the folder
			* (`meta.dir`), and a URL opens in the browser tab. A disconnected socket
			* retries with a short backoff (mirror of the agent-terminals loop): the
			* host queue keeps undelivered requests and replays them on the first
			* attach, so a refresh or a session switch lands the opens the model
			* queued while no view was connected.
			* While the side-card setting is off, pushes are ignored as a defensive
			* gate — the host already unregisters the tool and drains the queue.
			*/
			(0, react.useEffect)(() => {
				if (sessionId === void 0) return;
				let socket = null;
				let retry;
				let closed = false;
				let failures = 0;
				const connect = () => {
					if (closed) return;
					const url = new URL("/sidebar/ws/agent-opens", location.origin);
					url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
					url.search = new URLSearchParams({ sessionId }).toString();
					socket = new WebSocket(url.toString());
					socket.onmessage = (event) => {
						if (typeof event.data !== "string") return;
						try {
							const request = JSON.parse(event.data);
							if (request === null || typeof request !== "object") return;
							if (request.kind !== "file" && request.kind !== "folder" && request.kind !== "url") return;
							if (typeof request.target !== "string" || request.target === "") return;
							if (store.getPrefs().agentOpenTools !== true) return;
							const scope = { sessionId };
							const title = typeof request.title === "string" && request.title !== "" ? request.title : void 0;
							if (request.kind === "url") ctx.get("betterSidebar")?.openTab({
								type: "browser",
								url: request.target,
								title
							}, scope);
							else if (request.kind === "folder") ctx.get("betterSidebar")?.openTab({
								type: "editor",
								title,
								path: request.target,
								id: `editor:${request.target}`,
								meta: { dir: true }
							}, scope);
							else ctx.get("betterSidebar")?.openFile(scope, request.target, title);
						} catch {}
					};
					socket.onclose = () => {
						if (closed) return;
						failures += 1;
						if (failures >= FAILURE_LIMIT) {
							console.error("[dsh-coding-sidebar] agent-opens connection failed; stopping reconnect loop", sessionId);
							return;
						}
						retry = window.setTimeout(connect, 2e3);
					};
					socket.onerror = () => {
						socket?.close();
					};
				};
				connect();
				return () => {
					closed = true;
					window.clearTimeout(retry);
					socket?.close();
				};
			}, [sessionId, store]);
			/**
			* Subagent auto-activation: the moment the current conversation spawns its
			* FIRST direct subagent (a 0 → N transition on the list feed), the "auto
			* open" pref is on, and the Subagent tab type is enabled in settings,
			* focus the Subagent page (single-instance: an existing tab is focused,
			* never duplicated). On wide viewports the right panel also expands; on
			* narrow viewports background activity never forces the full-screen drawer
			* open over the chat.
			* Switching to a session that already has subagents never triggers — its
			* baseline starts at the current count — so a deliberate layout is never
			* fought.
			*
			* The decision is DEBOUNCED (AUTO_OPEN_DEBOUNCE_MS): a Side Chat thread
			* is also a subagent-origin child, and its 'Side: ' title lands one frame
			* after its origin — an immediate check would misread that first frame as
			* a new subagent and pop this page on every thread creation. The timer
			* re-evaluates the ORIGINAL baseline against the live snapshot; by then
			* the title filter (isSideThreadSummary) sees the settled label.
			*/
			const listBaselineRef = (0, react.useRef)(void 0);
			const autoOpenPendingRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const prev = listBaselineRef.current;
				listBaselineRef.current = sessionList;
				if (sessionId === void 0 || prev === void 0) return;
				if (autoOpenPendingRef.current !== null) return;
				if (!detectNewDirectSubagent(prev, sessionList, sessionId)) return;
				const baseline = prev;
				const timer = window.setTimeout(() => {
					autoOpenPendingRef.current = null;
					if (!detectNewDirectSubagent(baseline, ctx.sessions.list.getSnapshot(), sessionId)) return;
					if (!store.getPrefs().autoOpenSubagent) return;
					if (ctx.get("betterSidebar")?.isTabEnabled("subagent") === false) return;
					if (!isNarrowWidth(window.innerWidth)) store.reduce((s) => s.panelOpen ? s : togglePanel(s));
					store.reduce((s) => ({
						...s,
						activePane: firstLeaf(s.splits).id
					}));
					ctx.get("betterSidebar")?.openTab({
						type: "subagent",
						title: t("subagent")
					});
				}, AUTO_OPEN_DEBOUNCE_MS);
				autoOpenPendingRef.current = {
					baseline,
					timer
				};
			}, [
				sessionList,
				sessionId,
				store,
				ctx
			]);
			(0, react.useEffect)(() => () => {
				const pending = autoOpenPendingRef.current;
				if (pending !== null) window.clearTimeout(pending.timer);
				autoOpenPendingRef.current = null;
			}, [sessionId]);
			/**
			* Job auto-activation: the moment a NEW background job appears for the
			* current conversation (a job id the previous snapshot lacked), the
			* auto-open pref is on, and the Jobs tab type is enabled, focus the Jobs
			* page. The right panel expands only on wide viewports — background
			* activity never forces the narrow full-screen drawer open. Unlike the
			* subagent trigger (0 → N only), ANY new job id triggers: the agent may
			* start several jobs in one session, and each should surface. A fresh page
			* load never triggers — its baseline starts at the current roster.
			*
			* The baseline holds the JOB ROSTER, not the session list: 0.1.7 moved job
			* rows from the list snapshot (`jobsBySession`, removed) to the client jobs
			* service, so diffing list snapshots can no longer see a job appear.
			*/
			const jobsRows = useJobsRows(ctx, (0, react.useMemo)(() => sessionId === void 0 ? [] : [sessionId], [sessionId]));
			const jobBaselineRef = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				const prev = jobBaselineRef.current;
				jobBaselineRef.current = jobsRows;
				if (sessionId === void 0 || prev === void 0 || jobsRows === void 0) return;
				if (!detectNewJob(prev, jobsRows, sessionId)) return;
				if (!store.getPrefs().autoOpenJobs) return;
				if (ctx.get("betterSidebar")?.isTabEnabled("subagent") === false) return;
				if (!isNarrowWidth(window.innerWidth)) store.reduce((s) => s.panelOpen ? s : togglePanel(s));
				store.reduce((s) => ({
					...s,
					activePane: firstLeaf(s.splits).id
				}));
				ctx.get("betterSidebar")?.openTab({
					type: "subagent",
					title: t("subagent")
				});
			}, [
				jobsRows,
				sessionId,
				store,
				ctx
			]);
			/**
			* Topology jump-back: clicking a subagent node on the Subagent page calls
			* the official `openSubagent`, which switches the sidebar to that child
			* session's OWN layout (a fresh child session defaults to the explorer).
			* The README contract says the Subagent page must stay open with the jumped
			* node highlighted — so once the current session becomes the recorded jump
			* target, re-open the Subagent page on top of the child's layout (expanding
			* the panel first if it is collapsed). Only this explicit node click arms
			* the flag, so switching to a subagent session by any other means keeps
			* that session's own layout untouched.
			*/
			const subagentJumpRef = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				const pending = subagentJumpRef.current;
				if (pending === void 0 || sessionId !== pending) return;
				subagentJumpRef.current = void 0;
				store.reduce((s) => s.panelOpen ? s : togglePanel(s));
				store.reduce((s) => ({
					...s,
					activePane: firstLeaf(s.splits).id
				}));
				ctx.get("betterSidebar")?.openTab({
					type: "subagent",
					title: t("subagent")
				});
			}, [
				sessionId,
				store,
				ctx
			]);
			/**
			/**
			* Inline pinned terminals (v0.17.0+): pinned tabs from OTHER sessions
			* inject as VIRTUAL tabs into the first leaf of the right panel's split
			* tree. The virtual tabs have unique ids (prefixed with the home session)
			* and carry the home scope in meta. Clicking a virtual tab sets
			* `activePinnedTabId` — the augmented tree overrides the leaf's `active`
			* so the pinned tab's content renders in-place (TerminalView connects to
			* the home session's PTY via WS, no session jump).
			*
			* Closing/unpinning a virtual tab targets the HOME session via reduceFor
			* (which doesn't notify — targeted opens must not re-render the active
			* session). The `pinnedRevision` state bump forces the pinnedEntries
			* useMemo to recompute after such an action.
			*/
			const [activePinnedTabId, setActivePinnedTabId] = (0, react.useState)(null);
			const [pinnedRevision, setPinnedRevision] = (0, react.useState)(0);
			/**
			* Cross-session pinned-tab collection. Recomputed on every store notify,
			* session-list change, and pinned action (the revision bump covers
			* reduceFor updates that don't notify). Only tabs from OTHER sessions —
			* the viewer's own pinned tabs are already on its tab strip.
			*/
			const pinnedEntries = (0, react.useMemo)(() => {
				if (sessionId === void 0) return [];
				return collectPinnedTabs(store.getSessionStates(), {
					sessionId,
					cwd
				});
			}, [
				store,
				sessionId,
				cwd,
				snapshot,
				pinnedRevision
			]);
			/** Virtual SidebarTab objects for the pinned entries (stable references
			*  via useMemo so TabContent's memo comparator holds). */
			const pinnedVirtualTabs = (0, react.useMemo)(() => pinnedEntries.map(createPinnedVirtualTab), [pinnedEntries]);
			/** The right panel's split tree with pinned virtual tabs injected into the
			*  first leaf. When `activePinnedTabId` is set, that leaf's `active` is
			*  overridden so the pinned tab's content is visible. */
			const augmentedTree = (0, react.useMemo)(() => state === void 0 ? void 0 : injectPinnedIntoTree(state.splits, pinnedVirtualTabs, activePinnedTabId), [
				state,
				pinnedVirtualTabs,
				activePinnedTabId
			]);
			const centerColRef = (0, react.useRef)(null);
			const draggingRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				let disposed = false;
				const locate = () => {
					if (disposed) return;
					const col = document.querySelector("#root [data-slot=\"conversation\"]")?.parentElement;
					if (col === void 0 || !col.isConnected) {
						centerColRef.current = null;
						return;
					}
					centerColRef.current = col;
				};
				locate();
				let locateFrame = null;
				const scheduleLocate = () => {
					if (locateFrame !== null) return;
					if (draggingRef.current) return;
					locateFrame = requestAnimationFrame(() => {
						locateFrame = null;
						locate();
					});
				};
				const watcher = new MutationObserver(scheduleLocate);
				const root = document.getElementById("root");
				if (root !== null) watcher.observe(root, {
					childList: true,
					subtree: true
				});
				const htmlStyleWatcher = new MutationObserver(scheduleLocate);
				htmlStyleWatcher.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["style"]
				});
				const retry = window.setInterval(locate, 1500);
				return () => {
					disposed = true;
					if (locateFrame !== null) cancelAnimationFrame(locateFrame);
					window.clearInterval(retry);
					watcher.disconnect();
					htmlStyleWatcher.disconnect();
					centerColRef.current = null;
				};
			}, []);
			/**
			* Free windows — drag-out detection. The tab strips already drive HTML5
			* DnD (payload application/x-dsh-tab) with drops owned by the panes
			* (split/merge); this shell watches the DOCUMENT (capture) for the same
			* drag hovering OUTSIDE the panel host: while the pointer is over the
			* conversation column it arms the drop (preventDefault) and shows a hint
			* overlay there, and the drop floats the tab at the release point. Targets
			* inside the host are ignored here, so pane drops keep their behavior
			* untouched. Only OUR tab drags count (the body flag is the tab strip's;
			* OS file drags and any DSH drags pass through). Narrow viewports skip
			* the gesture — the merged drawer covers the conversation, leaving
			* nothing to drop onto (the tab context menu entry still floats tabs).
			*/
			const [floatHint, setFloatHint] = (0, react.useState)(null);
			const floatHintRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (narrow || sessionId === void 0) return;
				const inPanelHost = (target) => target instanceof Element && target.closest("[data-dsh-panel-host]") !== null;
				/** The conversation column's rect when the pointer is over it (and not
				*  over our own surfaces); null otherwise. */
				const overConversation = (event) => {
					if (inPanelHost(event.target)) return null;
					const col = centerColRef.current;
					if (col === null || !col.isConnected) return null;
					const rect = col.getBoundingClientRect();
					if (rect.width === 0 || rect.height === 0) return null;
					const { clientX: x, clientY: y } = event;
					if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
					return rect;
				};
				const onDragOver = (event) => {
					if (!document.body.hasAttribute("data-dsh-tab-dragging")) return;
					const rect = overConversation(event);
					if (rect !== null) {
						event.preventDefault();
						setFloatHint((prev) => {
							const next = {
								left: rect.left,
								top: rect.top,
								width: rect.width,
								height: rect.height
							};
							if (prev !== null && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height) return prev;
							return next;
						});
						floatHintRef.current = true;
					} else if (floatHintRef.current) {
						floatHintRef.current = false;
						setFloatHint(null);
					}
				};
				const onDrop = (event) => {
					if (!floatHintRef.current) return;
					floatHintRef.current = false;
					setFloatHint(null);
					if (overConversation(event) === null) return;
					event.preventDefault();
					event.stopPropagation();
					const payload = parseDrag(event.dataTransfer?.getData("application/x-dsh-tab") ?? "");
					if (payload === null) return;
					store.reduce((s) => floatTab(s, payload.tabId, event.clientX, event.clientY));
				};
				const clear = () => {
					if (!floatHintRef.current) return;
					floatHintRef.current = false;
					setFloatHint(null);
				};
				document.addEventListener("dragover", onDragOver, true);
				document.addEventListener("drop", onDrop, true);
				window.addEventListener("dragend", clear, true);
				window.addEventListener("blur", clear);
				return () => {
					document.removeEventListener("dragover", onDragOver, true);
					document.removeEventListener("drop", onDrop, true);
					window.removeEventListener("dragend", clear, true);
					window.removeEventListener("blur", clear);
				};
			}, [
				narrow,
				sessionId,
				store
			]);
			const panelRef = (0, react.useRef)(null);
			const widthDrag = (0, react.useRef)({
				startX: 0,
				startWidth: 0
			});
			const [draggingWidth, setDraggingWidth] = (0, react.useState)(false);
			const anyDragging = draggingWidth;
			(0, react.useEffect)(() => {
				draggingRef.current = anyDragging;
			}, [anyDragging]);
			const clampWidth = (width) => Math.min(Math.max(280, Math.round(width)), Math.max(280, window.innerWidth));
			/** Single writer for the layout-push variable: the app shell gives up
			*  the panel's width while open (0 while collapsed) through layout.css's
			*  margin. Every size change — drag frames and committed state — flows
			*  through here so the push never forks between paths. */
			const writeGeometry = (width) => {
				document.documentElement.style.setProperty("--dsh-sidebar-width", `${width}px`);
			};
			/** Last size a drag actually applied to the DOM (updated by applyDrag).
			*  When a pointer stream dies without any position info (issue #247: an
			*  ultra-fast flick whose release events carried no usable coordinates),
			*  the abort path adopts this instead of rolling back to the pre-drag
			*  value — the DOM's current size is the only truthful record left. */
			const lastDragSize = (0, react.useRef)(null);
			/** Apply a drag size to the DOM without touching React state or the
			*  store. The layout push rides the shared writer (writeGeometry). */
			const applyDrag = (width) => {
				lastDragSize.current = width;
				panelRef.current?.style.setProperty("width", `${width}px`);
				writeGeometry(width);
			};
			const dragFrame = (0, react.useRef)(null);
			const pendingDrag = (0, react.useRef)(null);
			const scheduleDrag = (width) => {
				pendingDrag.current = width;
				if (dragFrame.current !== null) return;
				dragFrame.current = requestAnimationFrame(() => {
					dragFrame.current = null;
					const pending = pendingDrag.current;
					if (pending !== null) {
						pendingDrag.current = null;
						applyDrag(pending);
					}
				});
			};
			/** Flush any pending drag write and stop scheduling (the store commit on
			*  pointer up applies the final clamped values). */
			const stopDragScheduling = () => {
				if (dragFrame.current !== null) {
					cancelAnimationFrame(dragFrame.current);
					dragFrame.current = null;
				}
				pendingDrag.current = null;
			};
			/**
			* Finalize a drag on pointer up: flush the LAST drag frame to the DOM
			* synchronously, then commit the SAME clamped value to the store. A fast
			* release cancels the rAF before it ran — without the flush the DOM would
			* sit at the pre-drag size until React re-renders with the committed
			* value, and a value that never made it into a move handler would never
			* be applied at all.
			*/
			const commitDrag = (width, reduce) => {
				stopDragScheduling();
				applyDrag(width);
				draggingRef.current = false;
				store.reduce(reduce);
			};
			/** Set once a drag's pointerup handler commits — premature capture loss
			*  (pointercancel / lostpointercapture without pointerup) must then be told
			*  apart from a normal release. */
			const dragCommitted = (0, react.useRef)(false);
			/**
			* Abort a drag whose pointer stream was interrupted (pointercancel, or
			* capture lost before pointerup): no pointerup will arrive, so without
			* this the dragging state would stick true and the DOM would sit at an
			* uncommitted size until the next re-render.
			*
			* A FAST release is the common trigger: browsers merge pointermove bursts,
			* and an ultra-fast flick can cancel the stream before ANY move lands.
			* The commit order is therefore: the LAST KNOWN dragged size (the rAF
			* pending value) first, then the interrupting event's own pointer
			* position (only pointercancel is trusted to carry coordinates —
			* lostpointercapture's coordinates are not guaranteed, so the handlers
			* pass the event only from pointercancel), and finally the size the drag
			* last APPLIED to the DOM (lastDragSize). A drag that produced none of
			* those (pure down+up at the same spot) commits the store's own size —
			* a no-op, never an explicit rollback (issue #247: v0.13.1 never reverted
			* an interrupted fast flick; the abort path added in the unified-host
			* refactor did, and that regression is what this ordering removes).
			*
			* Every commit path marks the drag committed, so the interrupt
			* double-fire (pointercancel → lostpointercapture) cannot commit once
			* and then roll the same drag back.
			*/
			const abortDrag = (reset, event) => {
				if (dragCommitted.current) return;
				const pending = pendingDrag.current;
				let width;
				if (pending !== null) width = pending;
				else if (event !== void 0) width = clampWidth(widthDrag.current.startWidth + (widthDrag.current.startX - event.clientX));
				if (width !== void 0) {
					dragCommitted.current = true;
					pendingDrag.current = null;
					if (dragFrame.current !== null) {
						cancelAnimationFrame(dragFrame.current);
						dragFrame.current = null;
					}
					applyDrag(width);
					draggingRef.current = false;
					store.reduce((s) => setWidth(s, width));
				} else {
					dragCommitted.current = true;
					stopDragScheduling();
					const adoptedWidth = layoutPushSize({
						narrow,
						panelOpen: state?.panelOpen === true,
						width: lastDragSize.current ?? state?.width ?? 0,
						viewportWidth: viewport.width
					});
					applyDrag(adoptedWidth);
					draggingRef.current = false;
					store.reduce((s) => setWidth(s, adoptedWidth));
				}
				reset();
			};
			(0, react.useEffect)(() => {
				writeGeometry(layoutPushSize({
					narrow,
					panelOpen: snapshot.state?.panelOpen === true,
					width: snapshot.state?.width ?? 0,
					viewportWidth: viewport.width
				}));
			}, [
				narrow,
				snapshot.state?.panelOpen,
				snapshot.state?.width,
				viewport.width
			]);
			(0, react.useEffect)(() => {
				return () => {
					document.documentElement.style.removeProperty("--dsh-sidebar-width");
				};
			}, []);
			(0, react.useEffect)(() => {
				if (anyDragging) document.body.setAttribute("data-dsh-sidebar-dragging", "");
				else document.body.removeAttribute("data-dsh-sidebar-dragging");
			}, [anyDragging]);
			const actions = (0, react.useMemo)(() => ({
				closeTab: (paneId, tabId) => {
					const current = store.getSnapshot().state;
					const tab = (current === void 0 ? void 0 : leafWithTab(current.splits, tabId))?.tabs.find((candidate) => candidate.id === tabId);
					ctx.get("betterSidebar")?.closeTab(tabId, sessionId === void 0 ? void 0 : {
						sessionId,
						cwd
					});
					if (tab?.type === "terminal") {
						if (isAgentTabId(tabId)) {
							const uuid = agentUuidOf(tabId);
							api.agentPtyClose(uuid).catch(() => {});
						} else if (sessionId !== void 0) api.ptyClose({
							sessionId,
							cwd
						}, tabId).catch(() => {});
					}
				},
				activateTab: (paneId, tabId) => {
					ctx.get("betterSidebar")?.activateTab(tabId, sessionId === void 0 ? void 0 : {
						sessionId,
						cwd
					});
				},
				focusPane: (paneId) => {
					store.reduce((s) => ({
						...s,
						activePane: paneId
					}));
				},
				moveTabToEdge: (payload, toPane, zone) => {
					store.reduce((s) => moveTabToEdge(s, payload.paneId, payload.tabId, toPane, zone));
				},
				moveTabBefore: (payload, toPane, beforeTabId) => {
					store.reduce((s) => {
						let index = -1;
						const source = leafWithTab(s.splits, beforeTabId);
						if (source !== void 0 && source.id === toPane) index = source.tabs.findIndex((tab) => tab.id === beforeTabId);
						return moveTab(s, payload.paneId, payload.tabId, toPane, index);
					});
				},
				resizeSplit: (splitId, index, deltaFrac) => {
					store.reduce((s) => resizeSplitIn(s, splitId, index, deltaFrac));
				},
				floatTab: (tabId) => {
					const col = centerColRef.current;
					const rect = col !== null && col.isConnected ? col.getBoundingClientRect() : null;
					const x = rect !== null ? (rect.left + rect.right) / 2 : window.innerWidth / 2;
					const y = rect !== null ? (rect.top + rect.bottom) / 2 : window.innerHeight / 2;
					store.reduce((s) => floatTab(s, tabId, x, y));
				},
				pinTab: (tabId, scope) => {
					store.reduce((s) => setTabPin(s, tabId, scope === null ? null : {
						scope,
						homeCwd: cwd
					}));
				}
			}), [
				store,
				sessionId,
				cwd
			]);
			/**
			* Wrap the base actions to intercept pinned VIRTUAL tab ids (injected from
			* other sessions). Regular tab ids pass through unchanged. Virtual ids are
			* detected by the `pinned:` prefix and routed to the HOME session via
			* reduceFor (which doesn't notify — the revision bump is the local signal).
			*/
			const wrappedActions = (0, react.useMemo)(() => {
				if (pinnedVirtualTabs.length === 0) return actions;
				const closePinnedInHome = (virtualId) => {
					const { homeSessionId, tabId: originalId } = parsePinnedVirtualId(virtualId);
					const vtab = pinnedVirtualTabs.find((t) => t.id === virtualId);
					const homeCwd = vtab !== void 0 ? getPinnedHomeScope(vtab)?.cwd : void 0;
					store.reduceFor(homeSessionId, (s) => {
						const leaf = leafWithTab(s.splits, originalId);
						if (leaf !== void 0) return closeTab(s, leaf.id, originalId);
						if (s.floats.some((f) => f.tab.id === originalId)) return closeFloatByTab(s, originalId);
						return s;
					});
					if (isAgentTabId(originalId)) api.agentPtyClose(agentUuidOf(originalId)).catch(() => {});
					else api.ptyClose({
						sessionId: homeSessionId,
						...homeCwd !== void 0 ? { cwd: homeCwd } : {}
					}, originalId).catch(() => {});
					if (activePinnedTabId === virtualId) setActivePinnedTabId(null);
					setPinnedRevision((v) => v + 1);
				};
				return {
					...actions,
					activateTab: (paneId, tabId) => {
						if (isPinnedVirtualId(tabId)) setActivePinnedTabId(tabId);
						else {
							setActivePinnedTabId(null);
							actions.activateTab(paneId, tabId);
						}
					},
					closeTab: (paneId, tabId) => {
						if (isPinnedVirtualId(tabId)) closePinnedInHome(tabId);
						else actions.closeTab(paneId, tabId);
					},
					moveTabBefore: (payload, toPane, beforeTabId) => {
						if (isPinnedVirtualId(payload.tabId)) return;
						if (isPinnedVirtualId(beforeTabId)) actions.moveTabToEdge(payload, toPane, "center");
						else actions.moveTabBefore(payload, toPane, beforeTabId);
					},
					moveTabToEdge: (payload, toPane, zone) => {
						if (isPinnedVirtualId(payload.tabId)) return;
						actions.moveTabToEdge(payload, toPane, zone);
					},
					floatTab: (tabId) => {
						if (isPinnedVirtualId(tabId)) return;
						actions.floatTab(tabId);
					},
					pinTab: (tabId, scope) => {
						if (isPinnedVirtualId(tabId)) {
							if (scope !== null) return;
							const { homeSessionId, tabId: originalId } = parsePinnedVirtualId(tabId);
							store.reduceFor(homeSessionId, (s) => setTabPin(s, originalId, null));
							if (activePinnedTabId === tabId) setActivePinnedTabId(null);
							setPinnedRevision((v) => v + 1);
						} else actions.pinTab?.(tabId, scope);
					}
				};
			}, [
				actions,
				pinnedVirtualTabs,
				activePinnedTabId,
				store
			]);
			/**
			* The explorer's @-reference button. Directories append the folder mention
			* (`@dir/`) as plain text so DSH's folder decoration and completion keep
			* working; files insert a structured chip like the native `@` picker, so
			* the whole reference stays one link instead of decorating only the
			* leading folder. Resolves the session-scope ctx and the conversation
			* input service at click time; a missing service or scope degrades to a
			* logged no-op, never a crash. Defined above the no-session early return
			* — a hook must never sit behind a conditional return (React counts hooks
			* per render).
			*/
			const referenceInChat = (0, react.useCallback)((path, isDir) => {
				if (sessionId === void 0) return;
				const rel = relativeTo(cwd ?? "", path);
				if (isDir) {
					appendToDraft(ctx, sessionId, `@${rel === "." ? "./" : `${rel}/`}`);
					return;
				}
				if (!insertFileReference(ctx, sessionId, rel)) appendToDraft(ctx, sessionId, `@${rel}`);
			}, [
				ctx,
				sessionId,
				cwd
			]);
			/** Tree-row rename reconciliation: retarget every open tab whose path was
			*  the renamed file (the editor content survives and later saves land on
			*  the new path; the title follows the new base name). */
			const onPathRenamed = (0, react.useCallback)((oldPath, newPath) => {
				const service = ctx.get("betterSidebar");
				if (service === void 0) return;
				const snapshot = store.getSnapshot().state;
				if (snapshot === void 0) return;
				for (const leaf of allLeaves(snapshot.splits)) for (const tab of leaf.tabs) if (tab.path === oldPath) service.updateTab(tab.id, {
					path: newPath,
					title: baseName$1(newPath)
				});
				for (const float of snapshot.floats) if (float.tab.path === oldPath) service.updateTab(float.tab.id, {
					path: newPath,
					title: baseName$1(newPath)
				});
			}, [ctx, store]);
			/** Tree-row delete reconciliation: close every open tab at or under the
			*  removed path (a stale tab's next save would fail against a missing
			*  path). Floating tabs are as open as docked ones. */
			const onPathRemoved = (0, react.useCallback)((target) => {
				const service = ctx.get("betterSidebar");
				if (service === void 0) return;
				const snapshot = store.getSnapshot().state;
				if (snapshot === void 0) return;
				const tabs = [];
				for (const leaf of allLeaves(snapshot.splits)) tabs.push(...leaf.tabs);
				for (const float of snapshot.floats) tabs.push(float.tab);
				for (const tab of tabs) {
					const path = tab.path;
					if (path !== void 0 && (path === target || isWithinWorkspace(target, path))) service.closeTab(tab.id);
				}
			}, [ctx, store]);
			if (state === void 0 || sessionId === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				"data-dsh-panel-host": true,
				...osFileDragShield,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: sidebar_module_css_default.toggleCluster,
					"data-dsh-toggle-cluster": true,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: t("noSession"),
						side: "bottom",
						delayMs: 500,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidebar_module_css_default.toggleButton,
							"aria-disabled": "true",
							"aria-label": t("noSession"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPanelRightOutline16, {})
						})
					})
				})
			});
			const onNewTab = (optionId) => {
				const service = ctx.get("betterSidebar");
				const descriptor = service?.getTab(optionId);
				if (service === void 0 || descriptor === void 0) return;
				const title = typeof descriptor.title === "function" ? descriptor.title() : descriptor.title;
				service.openTab({
					type: optionId,
					title
				}, {
					sessionId,
					cwd
				});
			};
			/**
			* The explorer's @-reference button: append `@<relative path>` to the
			* session's composer draft (space-separated). Resolves the session-scope
			* ctx and the conversation input service at click time; a missing service
			* or scope degrades to a logged no-op, never a crash.
			*/
			/** The tab icon from the tab-type registry (shared by every workbench). */
			const tabIconOf = (tab) => {
				if (tab.type === "editor" && tab.path !== void 0 && tab.meta?.dir !== true) return ctx.get("betterSidebar")?.fileIcon(tab.path, 14) ?? null;
				const descriptor = ctx.get("betterSidebar")?.getTab(tab.type);
				if (descriptor === void 0) return null;
				return typeof descriptor.icon === "function" ? descriptor.icon(14) : descriptor.icon;
			};
			/**
			* The tab badge from the tab-type registry: a count (99+ capped) or a
			* short text pill. A throwing badge is swallowed (no pill) — the tab
			* strip must never break because a plugin's badge computation failed.
			*/
			const tabBadgeOf = (tab) => {
				if (isAgentTabId(tab.id)) {
					if (state.agentWaits?.[agentUuidOf(tab.id)] !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: sidebar_module_css_default.tabBadge,
						children: "⏳"
					});
				}
				const descriptor = ctx.get("betterSidebar")?.getTab(tab.type);
				if (descriptor?.badge === void 0) return null;
				let value;
				try {
					value = descriptor.badge(ctx, {
						sessionId,
						cwd
					}, state);
				} catch (error) {
					console.error("[dsh-coding-sidebar] tab badge error:", error);
					return null;
				}
				if (value === null || value === void 0 || value === "") return null;
				const text = typeof value === "number" ? value > 99 ? "99+" : String(value) : String(value);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: sidebar_module_css_default.tabBadge,
					children: text
				});
			};
			/**
			* Render one tab's content. `active` (from the workbench) tells whether
			* this tab is the active one in its pane; combined with the panel's
			* open/closed state it gates live views (the Subagent topology pauses its
			* polling while the page is not actually visible). The pane id travels
			* with the tab so diff tabs can split below their source pane.
			*/
			const renderTab = (tab, active, paneId, placement = "top") => {
				const home = getPinnedHomeScope(tab);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabContent, {
					tab,
					effectiveTabId: home?.tabId,
					paneId,
					sessionId: home?.sessionId ?? sessionId,
					cwd: home?.cwd ?? cwd,
					expanded: state.expanded,
					revealed: state.revealed ?? [],
					onToggleDir: (path) => {
						store.reduce((s) => toggleExpanded(s, path));
					},
					onReferenceFile: referenceInChat,
					onPathRenamed,
					onPathRemoved,
					ctx,
					store,
					visible: placement === "float" ? true : state.panelOpen && active,
					onSubagentJump: (childSessionId) => {
						subagentJumpRef.current = childSessionId;
					},
					onOpenDiff: (diffTab) => {
						store.reduce((s) => openDiffTab(s, paneId, diffTab));
					},
					localeRevision,
					tabsVersion
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-dsh-panel-host": true,
				...osFileDragShield,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.toggleCluster,
						"data-dsh-toggle-cluster": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: state.panelOpen ? t("collapse") : t("expand"),
							side: "bottom",
							delayMs: 500,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidebar_module_css_default.toggleButton,
								"aria-label": state.panelOpen ? t("collapse") : t("expand"),
								onClick: () => {
									store.reduce(togglePanel);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPanelRightOutline16, {})
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: panelRef,
						className: clsx(sidebar_module_css_default.panel, !state.panelOpen && sidebar_module_css_default.panelHidden),
						"data-dsh-panel": true,
						style: {
							width: narrow ? "100vw" : Math.min(state.width, window.innerWidth),
							bottom: narrow && keyboardInset > 0 ? `${keyboardInset}px` : void 0
						},
						"data-dragging": anyDragging || void 0,
						children: [!narrow && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: clsx(sidebar_module_css_default.panelResize, draggingWidth && sidebar_module_css_default.panelResizeActive),
							onPointerDown: (event) => {
								event.preventDefault();
								event.currentTarget.setPointerCapture(event.pointerId);
								dragCommitted.current = false;
								widthDrag.current = {
									startX: event.clientX,
									startWidth: state.width
								};
								setDraggingWidth(true);
							},
							onPointerMove: (event) => {
								if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
								const { startX, startWidth } = widthDrag.current;
								scheduleDrag(clampWidth(startWidth + (startX - event.clientX)));
							},
							onPointerUp: (event) => {
								if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
								if (dragCommitted.current) return;
								dragCommitted.current = true;
								event.currentTarget.releasePointerCapture(event.pointerId);
								const { startX, startWidth } = widthDrag.current;
								const width = clampWidth(startWidth + (startX - event.clientX));
								commitDrag(width, (s) => setWidth(s, width));
								setDraggingWidth(false);
							},
							onPointerCancel: (event) => {
								abortDrag(() => setDraggingWidth(false), event);
							},
							onLostPointerCapture: () => {
								abortDrag(() => setDraggingWidth(false));
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: sidebar_module_css_default.panelBody,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Workbench, {
								state,
								tree: augmentedTree,
								newTabOptions: buildNewTabOptions(state, ctx, {
									sessionId,
									cwd
								}),
								actions: wrappedActions,
								onNewTab,
								renderTab,
								getTabIcon: tabIconOf,
								getTabBadge: tabBadgeOf
							})
						})]
					}),
					state.floats.map((float) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FreeWindow, {
						float,
						renderTab: (tab, active, paneId) => renderTab(tab, active, paneId, "float"),
						getTabIcon: tabIconOf,
						onRaise: () => {
							store.reduce((s) => raiseFloat(s, float.id));
						},
						onMove: (x, y) => {
							store.reduce((s) => moveFloat(s, float.id, x, y));
						},
						onResize: (w, h) => {
							store.reduce((s) => resizeFloat(s, float.id, w, h));
						},
						onDock: (paneId) => {
							store.reduce((s) => dockFloat(s, float.id, paneId ?? void 0));
						},
						onClose: () => {
							ctx.get("betterSidebar")?.closeTab(float.tab.id, sessionId === void 0 ? void 0 : {
								sessionId,
								cwd
							});
						}
					}, float.id)),
					floatHint !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidebar_module_css_default.floatDropHint,
						style: {
							left: floatHint.left,
							top: floatHint.top,
							width: floatHint.width,
							height: floatHint.height
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: sidebar_module_css_default.floatDropHintLabel,
							children: t("floatDropHint")
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/link-intercept.ts
		/**
		* Chat/GUI external-link interception: clicking an http(s) link that points
		* OUTSIDE the GUI (chat messages, tool rows, prose mentions) opens the
		* sidebar instead of a new browser tab. Gated by the caller through
		* `takeoverEnabled(url)` — the `browserInterceptLinks` master, the URL's
		* protocol flag (`browserInterceptHttp` / `browserInterceptHttps`) and the
		* target tab's enable switch — and a Ctrl/Cmd/Shift/Alt-modified click
		* always bypasses the takeover so the user can still force a real browser
		* tab.
		*
		* Only the GUI's OWN document is watched — links inside the browser tab's
		* sandboxed iframe live in another document and never bubble here (and
		* their clicks must keep working inside the sidebar).
		*/
		/** The pure decision: the URL to open in the sidebar, or null to let the
		*  click fall through. Extracted so the policy is unit-testable without a
		*  DOM. `anchorHref` must be the ABSOLUTE href (`<a>.href` already is).
		*  The protocol/same-origin policy lives HERE; the prefs gates (master +
		*  protocol flags + target enablement) live in the caller's
		*  `takeoverEnabled(url)` callback. */
		function shouldInterceptLink(anchorHref, selfOrigin) {
			let url;
			try {
				url = new URL(anchorHref);
			} catch {
				return null;
			}
			if (url.protocol !== "http:" && url.protocol !== "https:") return null;
			try {
				if (url.origin === new URL(selfOrigin).origin) return null;
			} catch {}
			return url.href;
		}
		/** Whether a left-click may be taken over (unmodified left click only). */
		function isPlainLeftClick(event) {
			return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
		}
		/**
		* Register the document-level click capture that funnels external links
		* into the sidebar. Returns the disposer (HMR-safe).
		*/
		function registerLinkInterception(opts) {
			const onClick = (event) => {
				if (!isPlainLeftClick(event)) return;
				if (event.defaultPrevented) return;
				const target = event.target;
				if (target === null || typeof target.closest !== "function") return;
				const anchor = target.closest("a[href]");
				if (anchor === null) return;
				const url = shouldInterceptLink(anchor.href, opts.selfOrigin);
				if (url === null) return;
				if (!opts.takeoverEnabled(new URL(url))) return;
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				opts.openInSidebar(url);
			};
			document.addEventListener("click", onClick, true);
			return () => {
				document.removeEventListener("click", onClick, true);
			};
		}
		//#endregion
		//#region src/client/ime-guard.ts
		/**
		* IME-composition key guard.
		*
		* While a Chinese/Japanese/Korean input method is composing (the user is
		* picking a candidate from the IME window), every pressed key BELONGS to the
		* input method: arrows move the candidate highlight, Enter/Space confirm the
		* composition, Escape cancels it. Page code must not process those keys —
		* a component that does (a number stepper calling preventDefault() on
		* ArrowUp/ArrowDown, a submit handler reacting to Enter, ...) silently
		* breaks the IME: candidates stop responding, the composition gets torn
		* apart, and only bare letters come out.
		*
		* This guard enforces that rule at the document boundary: a capture-phase
		* keydown/keyup listener that stops the event from propagating further
		* whenever a composition is in progress. Because it runs in the capture
		* phase on `document` — the outermost node — it fires BEFORE React's
		* delegated handlers (attached at the root container) and before any native
		* target/bubble listener, so an inlined third-party component (e.g. the
		* Univer office UI bundled into this plugin) can never intercept
		* composition keys. The browser's native IME processing is untouched:
		* stopPropagation only silences page JS, not the default action.
		*
		* The composition signal follows the DSH core convention (InputBar's IME
		* guard, issue #535): `isComposing` for modern engines, keyCode 229 as the
		* legacy signal engines emit without isComposing.
		*/
		/** The pure decision: is this keyboard event part of an IME composition? */
		function isImeComposition(event) {
			return event.isComposing || event.keyCode === 229;
		}
		/**
		* Register the document-level capture guard. Returns the disposer
		* (HMR-safe; call through `ctx.effect`).
		*/
		function registerImeGuard() {
			const onKey = (event) => {
				if (isImeComposition(event)) event.stopPropagation();
			};
			document.addEventListener("keydown", onKey, true);
			document.addEventListener("keyup", onKey, true);
			return () => {
				document.removeEventListener("keydown", onKey, true);
				document.removeEventListener("keyup", onKey, true);
			};
		}
		//#endregion
		//#region src/client/settings-nav-icon.ts
		/**
		* Mark this plugin's row in the DSH settings navigation so its bundled CSS
		* can replace the shell's fallback gear with the Side card glyph.
		*
		* DSH 0.1.x projects only `id`, `order`, and `label` from a
		* `settings.section` registration, then chooses icons inside the settings
		* shell from a closed list of built-in ids. Until that public contract grows
		* an icon field, the plugin identifies only its own localized row after the
		* dialog mounts. The marker owns no shell structure and is removed on fiber
		* disposal, so the adaptation remains HMR-safe.
		*/
		const SETTINGS_NAV_MARKER = "data-dsh-coding-sidebar-settings-nav";
		/**
		* Keep the marker on the settings-nav button whose visible text is this
		* plugin's current localized section label.
		* @param label - locale-aware label resolver used by the section registration.
		* @returns disposer that disconnects observation and removes owned markers.
		*/
		function registerSettingsNavIcon(label) {
			let disposed = false;
			const sync = () => {
				if (disposed) return;
				const currentLabel = label().trim();
				const buttons = document.querySelectorAll("[role=\"dialog\"] nav button");
				for (const button of buttons) if (currentLabel.length > 0 && button.textContent?.trim() === currentLabel) button.setAttribute(SETTINGS_NAV_MARKER, "");
				else button.removeAttribute(SETTINGS_NAV_MARKER);
			};
			sync();
			const observer = new MutationObserver(sync);
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true
			});
			return () => {
				disposed = true;
				observer.disconnect();
				document.querySelectorAll(`[${SETTINGS_NAV_MARKER}]`).forEach((element) => {
					element.removeAttribute(SETTINGS_NAV_MARKER);
				});
			};
		}
		//#endregion
		//#region src/client/channel-policy.ts
		/**
		* Channel policy for this plugin's settings-shell identity.
		*
		* The DSH channel coexists with the host's own right Sidebar: the settings
		* section keeps this plugin's own id and default priority. The QiLin channel
		* (the vendored/online-upgrade copy of this package) rewrites these constants
		* at sync time — the section takes over the stock `sidebar-right` settings
		* cell (same id, priority -1: the lower-priority entry wins the cell, so the
		* stock page and its nav row disappear while this plugin's page remains the
		* one sidebar settings page), and the displayed plugin name follows the
		* channel's package name.
		*/
		/** The name shown in the settings section's identity badge. */
		const PLUGIN_DISPLAY_NAME = "dsh-coding-sidebar";
		/** The `settings.section` list id this plugin registers under. */
		const SETTINGS_SECTION_ID = "dsh-coding-sidebar";
		//#endregion
		//#region src/client/SideCardSection.tsx
		/**
		* "Side card" settings section: the user-facing preferences for the sidebar
		* panel, rendered natively in the DSH Settings shell (nav label "Side card").
		*
		* The section is DECLARATIVE — it renders the enable/disable inventory from
		* the sidebar service's registries instead of hardcoding rows:
		*  - 常规: new conversations open the panel by default (a toggle row), the
		*    default panel width as a percent of the window (number input row), and
		*    the open-path interception toggle — the DSH settings-row recipe
		*    (title/desc left + control right, hairline separators).
		*  - 侧边栏内容: one SMALL CARD per REGISTERED tab type (built-ins and
		*    external plugins alike), laid out in a responsive grid that wraps
		*    several cards per row — icon chip + title + type id, clicked to toggle
		*    the switch persisted in `prefs.tabsEnabled[id]`.
		*  - 文件预览: one SMALL CARD per REGISTERED file viewer — icon chip + title
		*    + the extensions it covers, clicked to toggle `prefs.viewersEnabled[id]`.
		*
		* Every group lives in a container card (the DSH PluginCard recipe: l2
		* hairline, 16px radius, layer-3 fill) with a heading and an inventory count
		* badge (the settings catalogHeading recipe); the section opens with a
		* one-line intro (the DSH section heading+intro recipe).
		*
		* A card's on/off state is its VISUAL STATE: enabled = highlighted (brand
		* border + tinted fill + a compact switch knob at the card's far right),
		* disabled = neutral and dimmed. Features that declare
		* `settings.toggles` carry a labeled settings strip at the card's bottom
		* edge that opens a native Modal (wider than the primitive default) with
		* the related settings as title/desc + custom-switch rows and a Done
		* footer; the popup body scrolls internally when a feature declares many
		* rows (e.g. Terminal's six). The toggles themselves are custom
		* switches: a real checkbox (native semantics and focus) driving a styled
		* track/thumb.
		*
		* Writes ride the plugin's own fenced settings route (the host calls the
		* settings seam in-process — the DSH settings RPC domain does not serve
		* third-party namespaces to configuration clients); the shared SidebarStore
		* is refreshed on success so the very next brand-new session seeds from the
		* new values and the sidebar's consumption points (the + menu, derived
		* flows) re-render immediately. Any failure reverts the optimistic UI and
		* shows the wire error inline — a broken settings surface never crashes the
		* shell.
		*/
		/** Map one wire failure to the inline message (the conflict gets friendly copy). */
		function messageOf(error) {
			if (error instanceof Error && "code" in error && error.code === "settings-conflict") return `${t("settingsSaveFailed")} ${t("settingsConflict")}`;
			return `${t("settingsSaveFailed")} ${error instanceof Error ? error.message : String(error)}`;
		}
		/** Resolve an i18n-friendly string-or-function value. */
		function textOf(value) {
			if (value === void 0) return "";
			return typeof value === "function" ? value() : value;
		}
		/** Resolve a descriptor icon (ReactNode or size function). */
		function iconOf(icon, size) {
			if (icon === void 0) return null;
			return typeof icon === "function" ? icon(size) : icon;
		}
		/** Tab inventory order: hidden types (editor/diff) last, then + menu order. */
		function tabOrder(a, b) {
			if (a.hidden !== b.hidden) return a.hidden === true ? 1 : -1;
			return (a.order ?? 100) - (b.order ?? 100);
		}
		/**
		* The scheme dropdown's current value: the plain scheme, or `preset:<id>`
		* while a preset is active. Falls back to `auto` when the stored preset id
		* is no longer registered (the strip resolves to 0 then anyway).
		*/
		function titleBarSchemeValue(prefs) {
			if (prefs.titleBarScheme !== "preset") return prefs.titleBarScheme;
			const preset = getShellPreset(prefs.titleBarPresetId);
			return preset !== void 0 ? `preset:${preset.id}` : "auto";
		}
		/** Viewer inventory order: priority desc (the catch-all `code` comes last). */
		function viewerOrder(a, b) {
			return (b.priority ?? 0) - (a.priority ?? 0);
		}
		/** Whether a feature declares any secondary settings (gear button shows). */
		function hasSettings(feature) {
			const settings = feature.settings;
			return settings !== void 0 && ((settings.toggles?.length ?? 0) > 0 || (settings.pluginToggles?.length ?? 0) > 0 || settings.render !== void 0);
		}
		/** A feature's display name (viewers fall back to their id). */
		function featureNameOf(feature) {
			return textOf("title" in feature ? feature.title : void 0) || feature.id;
		}
		/**
		* Merge one plugin-owned setting into a pluginSettings map (pure, v0.12.0+).
		* Sequential merges are additive: each call spreads the map it was GIVEN,
		* so building from the latest optimistic map keeps earlier keys intact
		* (two same-tick writes must not drop each other).
		*/
		function mergePluginSetting(pluginSettings, descriptorId, key, value) {
			return {
				...pluginSettings,
				[descriptorId]: {
					...pluginSettings[descriptorId] ?? {},
					[key]: value
				}
			};
		}
		/**
		* Render a custom settings panel (`settings.render`) with error containment:
		* a throwing panel shows an inline error line instead of breaking the whole
		* settings page.
		*/
		function SettingsRender(props) {
			let content;
			try {
				content = props.render(props.renderProps);
			} catch (error) {
				content = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SideCardSection_module_css_default.error,
					role: "alert",
					children: [
						t("settingsSaveFailed"),
						" ",
						error instanceof Error ? error.message : String(error)
					]
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: content });
		}
		/**
		* The custom switch: a real checkbox (hidden, native semantics and focus)
		* driving a styled track/thumb. Used by the general toggle rows and the
		* secondary settings popup rows.
		*/
		function Switch(props) {
			const { checked, onChange, label } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: SideCardSection_module_css_default.switch,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: SideCardSection_module_css_default.switchInput,
					checked,
					"aria-label": label,
					onChange: (event) => {
						onChange(event.currentTarget.checked);
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SideCardSection_module_css_default.switchTrack,
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: SideCardSection_module_css_default.switchThumb })
				})]
			});
		}
		/**
		* The body of a feature's secondary settings popup: one row (title/desc +
		* control) per declared setting. Switches render the custom switch; text and
		* number rows render a free-form / numeric input committed on blur/Enter
		* (clamped to the declared min/max). Extracted so the rows are testable
		* without opening the Modal (the Modal portal renders only while open).
		*/
		function FeatureSettingsRows(props) {
			const { toggles, prefs, onToggle, onCommit, onSelectValue, valueSource } = props;
			const read = valueSource ?? ((key) => prefs[key]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: SideCardSection_module_css_default.popupRows,
				children: toggles.map((toggle) => {
					const title = textOf(toggle.title);
					if (toggle.type === "select") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectRow, {
						toggle,
						title,
						value: read(toggle.key),
						onSelectValue
					}, toggle.key);
					if ((toggle.type ?? "switch") === "switch") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideCardSection_module_css_default.popupRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SideCardSection_module_css_default.rowText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.title,
								children: title
							}), textOf(toggle.desc) !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.desc,
								children: textOf(toggle.desc)
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
							label: title,
							checked: read(toggle.key) === true,
							onChange: (next) => {
								onToggle(toggle, next);
							}
						})]
					}, toggle.key);
					const value = String(read(toggle.key) ?? "");
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TypedRow, {
						toggle,
						title,
						value,
						onCommit
					}, `${toggle.key}:${value}`);
				})
			});
		}
		/**
		* One text/number row: a controlled input whose draft is local state,
		* committed on blur/Enter through the parent's onCommit. The parent's
		* canonical return is adopted (clamped numbers, stored value for invalid
		* input); a `unit` suffix renders after the input (e.g. 'px').
		*/
		function TypedRow(props) {
			const { toggle, title, value, onCommit } = props;
			const [draft, setDraft] = (0, react.useState)(value);
			const commit = () => {
				const canonical = onCommit?.(toggle, draft) ?? draft;
				setDraft(canonical);
			};
			const number = toggle.type === "number";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SideCardSection_module_css_default.popupRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: SideCardSection_module_css_default.rowText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SideCardSection_module_css_default.title,
						children: title
					}), textOf(toggle.desc) !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SideCardSection_module_css_default.desc,
						children: textOf(toggle.desc)
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: SideCardSection_module_css_default.control,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						type: number ? "number" : "text",
						className: number ? SideCardSection_module_css_default.typedInputNumber : SideCardSection_module_css_default.typedInput,
						value: draft,
						min: toggle.min,
						max: toggle.max,
						step: 1,
						placeholder: toggle.placeholder,
						"aria-label": title,
						onChange: (event) => {
							setDraft(event.currentTarget.value);
						},
						onBlur: commit,
						onKeyDown: (event) => {
							if (event.key === "Enter") event.currentTarget.blur();
						}
					}), toggle.unit !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SideCardSection_module_css_default.suffix,
						children: toggle.unit
					})]
				})]
			});
		}
		/**
		* The multi-line custom-CSS input (scheme `custom`): a monospace textarea
		* whose draft is local state, committed on blur or Cmd/Ctrl+Enter through
		* the parent's handler. Keyed by the stored value so an external commit
		* remounts it with the canonical text (same pattern as TypedRow).
		*/
		function CssDraft(props) {
			const { value, onCommit, label, placeholder } = props;
			const [draft, setDraft] = (0, react.useState)(value);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
				className: SideCardSection_module_css_default.cssTextArea,
				rows: 6,
				value: draft,
				placeholder,
				"aria-label": label,
				spellCheck: false,
				onChange: (event) => {
					setDraft(event.currentTarget.value);
				},
				onBlur: () => {
					onCommit(draft);
				},
				onKeyDown: (event) => {
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.blur();
				}
			});
		}
		/**
		* The reusable dropdown — the primitives Menu, NOT a native <select>: a
		* closed anchor button (picked option text + chevron) opening one Menu item
		* per option (big-icon cards when any option carries an icon). Single-pick
		* commits the option's value and closes; `multi` toggles membership and
		* commits the picked values as an array (in options order), staying open.
		* Shared by the declarative select rows (SelectRow) and the title-bar
		* scheme dropdown on the General row.
		*/
		function SelectMenu(props) {
			const { label, value, options, multi, onSelect, placeholder } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const hasIcons = options.some((option) => option.icon !== void 0);
			const picked = multi ? Array.isArray(value) ? value : [] : [value];
			const selected = options.filter((option) => picked.includes(option.value));
			/** Commit one picked option (toggle semantics under multi). */
			const pick = (index) => {
				const option = options[index];
				if (option === void 0) return;
				if (!multi) {
					onSelect(option.value);
					setOpen(false);
					return;
				}
				const current = Array.isArray(value) ? [...value] : [];
				const at = current.indexOf(option.value);
				if (at >= 0) current.splice(at, 1);
				else current.push(option.value);
				onSelect(options.filter((o) => current.includes(o.value)).map((o) => o.value));
			};
			const anchor = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: SideCardSection_module_css_default.selectAnchor,
				"aria-label": label,
				"aria-haspopup": "listbox",
				"aria-expanded": open,
				onClick: () => {
					setOpen((now) => !now);
				},
				children: [
					!multi && hasIcons && selected[0] !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SideCardSection_module_css_default.selectAnchorIcon,
						children: iconOf(selected[0].icon, 16)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SideCardSection_module_css_default.selectAnchorText,
						children: selected.length === 0 ? placeholder ?? "—" : selected.map((option) => textOf(option.title)).join(", ")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 12 })
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				anchor,
				items: options.map((option, index) => ({
					id: String(index),
					label: hasIcons ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: SideCardSection_module_css_default.selectOption,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SideCardSection_module_css_default.selectOptionIcon,
							children: iconOf(option.icon, 24)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SideCardSection_module_css_default.selectOptionText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.title,
								children: textOf(option.title)
							}), textOf(option.desc) !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.desc,
								children: textOf(option.desc)
							})]
						})]
					}) : textOf(option.title)
				})),
				selectedId: !multi && selected[0] !== void 0 ? String(options.indexOf(selected[0])) : void 0,
				selectedIds: multi ? selected.map((option) => String(options.indexOf(option))) : void 0,
				onSelect: (id) => {
					pick(Number(id));
				},
				onClose: () => {
					setOpen(false);
				},
				portal: true
			});
		}
		/**
		* One select row: a dropdown over the toggle's declared `options` (the
		* shared SelectMenu). When any option carries an icon, the dropdown renders
		* big-icon option cards (icon + title + desc) and the closed anchor shows
		* the selected option's icon as well; without icons both are a single line
		* of text. Single-pick commits the option's value and closes; `multi`
		* toggles membership, commits the picked values as an array (in options
		* order), and stays open.
		*/
		function SelectRow(props) {
			const { toggle, title, value, onSelectValue } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SideCardSection_module_css_default.popupRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: SideCardSection_module_css_default.rowText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SideCardSection_module_css_default.title,
						children: title
					}), textOf(toggle.desc) !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SideCardSection_module_css_default.desc,
						children: textOf(toggle.desc)
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SideCardSection_module_css_default.control,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectMenu, {
						label: title,
						value,
						options: toggle.options ?? [],
						multi: toggle.multi === true,
						onSelect: (next) => {
							onSelectValue?.(toggle, next);
						}
					})
				})]
			});
		}
		/**
		* The secondary settings popup body of one feature (tab or viewer):
		* - the host-prefs `toggles` rows, then the plugin-owned `pluginToggles`
		*   rows (their values live in `pluginSettings[feature.id]`, projected onto
		*   the prefs face so the shared row renderer reads them);
		* - `settings.render` (custom panel) AFTER those rows when declared — the
		*   custom panel is an extension of the row list, not a replacement, so a
		*   feature can keep its declarative rows (e.g. the editor's
		*   open-behavior picker) and still ship a custom configuration area.
		*/
		function SettingsBody(props) {
			const { feature, prefs, store, service, onToggle, onCommit, onSelectValue, onPluginToggle, onPluginCommit, onPluginSelectValue, onPluginWrite, onClose } = props;
			const render = feature.settings?.render;
			const toggles = feature.settings?.toggles ?? [];
			const pluginToggles = feature.settings?.pluginToggles ?? [];
			if (render === void 0 && toggles.length === 0 && pluginToggles.length === 0) return null;
			const pluginBlob = prefs.pluginSettings[feature.id] ?? {};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [(toggles.length > 0 || pluginToggles.length > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SideCardSection_module_css_default.popupRows,
				children: [toggles.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FeatureSettingsRows, {
					toggles,
					prefs,
					onToggle,
					onCommit,
					onSelectValue
				}), pluginToggles.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FeatureSettingsRows, {
					toggles: pluginToggles,
					prefs,
					onToggle: onPluginToggle,
					onCommit: onPluginCommit,
					onSelectValue: onPluginSelectValue,
					valueSource: (key) => pluginBlob[key]
				})]
			}), render !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsRender, {
				render,
				renderProps: {
					store,
					service,
					prefs,
					pluginSettings: prefs.pluginSettings[feature.id] ?? {},
					updatePluginSetting: onPluginWrite,
					close: onClose
				}
			})] });
		}
		/**
		* Render the Side card preferences section.
		* @param props - composed slot props (runtime share + injected store/service).
		* @returns the section element tree.
		*/
		function SideCardSection({ store, service }) {
			const [prefs, setPrefs] = (0, react.useState)(() => store.getPrefs());
			const [widthDraft, setWidthDraft] = (0, react.useState)(String(store.getPrefs().defaultWidthPercent));
			const [error, setError] = (0, react.useState)(null);
			const [settingsFor, setSettingsFor] = (0, react.useState)(null);
			const [stripSettingsOpen, setStripSettingsOpen] = (0, react.useState)(false);
			const detectedEnv = (0, react.useMemo)(() => parseDesktopEnv(), []);
			const optimisticRef = (0, react.useRef)(prefs);
			(0, react.useEffect)(() => {
				optimisticRef.current = prefs;
			}, [prefs]);
			const [tabs, setTabs] = (0, react.useState)(() => [...service.getTabs()].sort(tabOrder));
			const [viewers, setViewers] = (0, react.useState)(() => [...service.getFileViewers()].sort(viewerOrder));
			(0, react.useEffect)(() => service.subscribe(() => {
				setTabs([...service.getTabs()].sort(tabOrder));
				setViewers([...service.getFileViewers()].sort(viewerOrder));
			}), [service]);
			const revisionRef = (0, react.useRef)(void 0);
			const dirtyRef = (0, react.useRef)(false);
			const inFlightRef = (0, react.useRef)(Promise.resolve());
			(0, react.useEffect)(() => {
				let cancelled = false;
				api.settingsGet().then((view) => {
					if (cancelled) return;
					revisionRef.current = view.revision;
					if (dirtyRef.current) return;
					const next = parsePrefs(view.value);
					setPrefs(next);
					setWidthDraft(String(next.defaultWidthPercent));
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, []);
			/** Persist one patch through the settings route (serialized, revision-guarded). */
			const commit = (patch) => {
				dirtyRef.current = true;
				const run = inFlightRef.current.then(async () => {
					const view = await api.settingsUpdate({ ...patch }, revisionRef.current);
					const next = parsePrefs(view.value);
					revisionRef.current = view.revision;
					store.setPrefs(next);
					return next;
				});
				inFlightRef.current = run.then(() => void 0, () => void 0);
				return run.then((next) => ({
					ok: true,
					prefs: next
				}), (caught) => {
					setError(messageOf(caught));
					return {
						ok: false,
						prefs
					};
				});
			};
			/** Settle one commit: success adopts the server values, failure reverts. */
			const applyOutcome = (previous, outcome) => {
				const settled = outcome.ok ? outcome.prefs : previous;
				setPrefs(settled);
				setWidthDraft(String(settled.defaultWidthPercent));
			};
			/** Optimistically apply one pref patch, then commit (revert on failure). */
			const applyPref = (patch) => {
				const previous = optimisticRef.current;
				const next = {
					...previous,
					...patch
				};
				optimisticRef.current = next;
				setPrefs(next);
				setError(null);
				commit(patch).then((outcome) => applyOutcome(previous, outcome));
			};
			const onToggle = (next) => {
				applyPref({ openByDefault: next });
			};
			/** Flip one per-tab enable switch (merge into the tabsEnabled map). */
			const onToggleTab = (id, next) => {
				applyPref({ tabsEnabled: {
					...optimisticRef.current.tabsEnabled,
					[id]: next
				} });
			};
			/** Flip one per-viewer enable switch (merge into the viewersEnabled map). */
			const onToggleViewer = (id, next) => {
				applyPref({ viewersEnabled: {
					...optimisticRef.current.viewersEnabled,
					[id]: next
				} });
			};
			/** Flip one declaratively-declared toggle (a SidebarPrefs boolean field). */
			const onToggleSetting = (toggle, next) => {
				applyPref({ [toggle.key]: next });
			};
			/** Commit one declaratively-declared select row (the option's value, or an
			*  array of values under `multi`). */
			const onSelectSetting = (toggle, next) => {
				applyPref({ [toggle.key]: next });
			};
			/**
			* Commit one declaratively-declared text/number row. Numbers are parsed
			* and clamped to the toggle's declared min/max (an unparsable input falls
			* back to the CURRENT stored value, mirroring the width row); text rows
			* persist as-is (empty is meaningful, e.g. the theme-default font).
			* Returns the canonical value the row should display.
			*/
			const onCommitSetting = (toggle, raw) => {
				if (toggle.type === "number") {
					const parsed = Number(raw);
					const fallback = String(prefs[toggle.key] ?? "");
					if (!Number.isFinite(parsed)) return fallback;
					let clamped = Math.round(parsed);
					if (toggle.min !== void 0) clamped = Math.max(toggle.min, clamped);
					if (toggle.max !== void 0) clamped = Math.min(toggle.max, clamped);
					applyPref({ [toggle.key]: clamped });
					return String(clamped);
				}
				applyPref({ [toggle.key]: raw });
				return raw;
			};
			/**
			* Pick the title-bar / shell compatibility scheme. Mirrors the legacy
			* `titleBarCompat` flag (true = anything but the conservative auto) so
			* documents stay readable by older plugin versions.
			*/
			/**
			* Pick the title-bar / shell compatibility scheme from the dropdown. The
			* option values are `auto` | `web` | `custom` | `preset:<id>`; selecting
			* a preset stores both the scheme and its id. Mirrors the legacy
			* `titleBarCompat` flag (true for preset/custom) so documents stay
			* readable by older plugin versions.
			*/
			const onSchemeSelect = (value) => {
				if (typeof value !== "string") return;
				if (value === "auto" || value === "web" || value === "custom") {
					applyPref({
						titleBarScheme: value,
						titleBarCompat: value === "custom"
					});
					return;
				}
				if (value.startsWith("preset:") && getShellPreset(value.slice(7)) !== void 0) applyPref({
					titleBarScheme: "preset",
					titleBarPresetId: value.slice(7),
					titleBarCompat: true
				});
			};
			/** Commit the free-form custom CSS (scheme `custom`). */
			const commitCustomCss = (raw) => {
				applyPref({ customCss: raw });
			};
			/** Persist one plugin-owned setting of one descriptor (merged into the pluginSettings blob). */
			const applyPluginSetting = (descriptorId, key, value) => {
				applyPref({ pluginSettings: mergePluginSetting(optimisticRef.current.pluginSettings, descriptorId, key, value) });
			};
			/** Flip one plugin-owned switch row (same row shape, plugin-scoped key). */
			const onPluginToggle = (descriptorId, toggle, next) => {
				applyPluginSetting(descriptorId, toggle.key, next);
			};
			/** Commit one plugin-owned text/number row (clamped like the host rows). */
			const onPluginCommitSetting = (descriptorId, toggle, raw) => {
				if (toggle.type === "number") {
					const parsed = Number(raw);
					const blob = prefs.pluginSettings[descriptorId] ?? {};
					const fallback = String(blob[toggle.key] ?? "");
					if (!Number.isFinite(parsed)) return fallback;
					let clamped = Math.round(parsed);
					if (toggle.min !== void 0) clamped = Math.max(toggle.min, clamped);
					if (toggle.max !== void 0) clamped = Math.min(toggle.max, clamped);
					applyPluginSetting(descriptorId, toggle.key, clamped);
					return String(clamped);
				}
				applyPluginSetting(descriptorId, toggle.key, raw);
				return raw;
			};
			const commitWidth = () => {
				const parsed = Number(widthDraft);
				if (!Number.isFinite(parsed)) {
					setWidthDraft(String(prefs.defaultWidthPercent));
					return;
				}
				const clamped = clampWidthPercent(parsed);
				const previous = prefs;
				setPrefs({
					...previous,
					defaultWidthPercent: clamped
				});
				setWidthDraft(String(clamped));
				setError(null);
				commit({ defaultWidthPercent: clamped }).then((outcome) => applyOutcome(previous, outcome));
			};
			/**
			* One SMALL toggle card for the responsive inventory grid: the card's main
			* area is the switch (click to flips, visual state IS the state), the icon
			* sits in a rounded chip, the check badge pins to the far right, and a
			* feature that declares related settings gets a labeled SETTINGS STRIP
			* across the card's bottom edge (gear icon + text) opening its settings
			* popup — discoverable at rest, not a hover-only ghost corner button.
			*/
			const renderCard = (props) => {
				const hasSettings = props.onOpenSettings !== void 0;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: clsx(SideCardSection_module_css_default.card, props.enabled && SideCardSection_module_css_default.cardOn),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: SideCardSection_module_css_default.cardMain,
						"aria-pressed": props.enabled,
						title: props.desc,
						onClick: () => {
							props.onToggle(!props.enabled);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SideCardSection_module_css_default.cardTop,
							children: [
								props.icon !== null && props.icon !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SideCardSection_module_css_default.cardIconChip,
									children: props.icon
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SideCardSection_module_css_default.cardTitle,
									children: props.title
								}),
								props.enabled && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SideCardSection_module_css_default.cardSwitch,
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.cardSwitchTrack,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: SideCardSection_module_css_default.cardSwitchThumb })
									})
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SideCardSection_module_css_default.cardDesc,
							children: props.desc
						})]
					}), hasSettings && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: SideCardSection_module_css_default.cardSettings,
						"aria-label": `${props.title} ${t("settingsPopup")}`,
						onClick: props.onOpenSettings,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineRegular, { size: 12 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settingsPopup") })]
					})]
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SideCardSection_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SideCardSection_module_css_default.intro,
						children: t("settingsIntro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideCardSection_module_css_default.versionBadge,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SideCardSection_module_css_default.versionBadgeName,
							children: PLUGIN_DISPLAY_NAME
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SideCardSection_module_css_default.versionBadgeTag,
							children: ["v", service.version]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideCardSection_module_css_default.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SideCardSection_module_css_default.groupHeading,
								children: t("settingsGeneralTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SideCardSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SideCardSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.title,
										children: t("settingsOpenTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.desc,
										children: t("settingsOpenDesc")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
									label: t("settingsOpenTitle"),
									checked: prefs.openByDefault,
									onChange: onToggle
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SideCardSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SideCardSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.title,
										children: t("settingsWidthTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.desc,
										children: t("settingsWidthDesc")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SideCardSection_module_css_default.control,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										type: "number",
										className: SideCardSection_module_css_default.percentInput,
										value: widthDraft,
										min: 20,
										max: 60,
										step: 1,
										"aria-label": t("settingsWidthTitle"),
										onChange: (event) => {
											setWidthDraft(event.currentTarget.value);
										},
										onBlur: commitWidth,
										onKeyDown: (event) => {
											if (event.key === "Enter") event.currentTarget.blur();
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.suffix,
										children: t("settingsWidthSuffix")
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SideCardSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SideCardSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.title,
										children: t("settingsOpenPathTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.desc,
										children: t("settingsOpenPathDesc")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
									label: t("settingsOpenPathTitle"),
									checked: prefs.interceptOpenPath,
									onChange: (next) => {
										applyPref({ interceptOpenPath: next });
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SideCardSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SideCardSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.title,
										children: t("settingsOpenToolsTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.desc,
										children: t("settingsOpenToolsDesc")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
									label: t("settingsOpenToolsTitle"),
									checked: prefs.agentOpenTools,
									onChange: (next) => {
										applyPref({ agentOpenTools: next });
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SideCardSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SideCardSection_module_css_default.rowText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.title,
										children: t("settingsTitleBarTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SideCardSection_module_css_default.desc,
										children: t("settingsTitleBarDesc")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SideCardSection_module_css_default.control,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectMenu, {
										label: t("settingsTitleBarTitle"),
										value: titleBarSchemeValue(prefs),
										options: [
											{
												value: "auto",
												title: t("settingsSchemeAutoTitle"),
												desc: t("settingsSchemeAutoDesc")
											},
											{
												value: "web",
												title: t("settingsSchemeWebTitle"),
												desc: t("settingsSchemeWebDesc")
											},
											...getShellPresets().map((preset) => ({
												value: `preset:${preset.id}`,
												title: preset.title,
												desc: preset.detect?.(detectedEnv) === true ? `${preset.desc}（${t("settingsSchemeDetectedSuffix")}）` : preset.desc
											})),
											{
												value: "custom",
												title: t("settingsSchemeCustomTitle"),
												desc: t("settingsSchemeCustomDesc")
											}
										],
										onSelect: onSchemeSelect
									}), prefs.titleBarScheme === "custom" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: SideCardSection_module_css_default.rowGear,
										"aria-label": `${t("settingsTitleBarTitle")} ${t("settingsPopup")}`,
										title: t("settingsPopup"),
										onClick: () => {
											setStripSettingsOpen(true);
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineRegular, { size: 14 })
									})]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideCardSection_module_css_default.group,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SideCardSection_module_css_default.groupHeading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settingsTabsTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.count,
								children: tabs.length
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SideCardSection_module_css_default.grid,
							children: tabs.map((tab) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: renderCard({
								title: textOf(tab.title),
								desc: tab.id,
								icon: iconOf(tab.icon, 16),
								enabled: prefs.tabsEnabled[tab.id] !== false,
								onToggle: (next) => {
									onToggleTab(tab.id, next);
								},
								onOpenSettings: prefs.tabsEnabled[tab.id] !== false && hasSettings(tab) ? () => {
									setSettingsFor(tab);
								} : void 0
							}) }, tab.id))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SideCardSection_module_css_default.group,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SideCardSection_module_css_default.groupHeading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settingsViewersTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SideCardSection_module_css_default.count,
								children: viewers.length
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SideCardSection_module_css_default.grid,
							children: viewers.map((viewer) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: renderCard({
								title: textOf(viewer.title) || viewer.id,
								desc: viewer.exts.length === 0 ? t("settingsViewerCatchAll") : viewer.exts.join(" · "),
								icon: iconOf(viewer.icon, 16),
								enabled: prefs.viewersEnabled[viewer.id] !== false,
								onToggle: (next) => {
									onToggleViewer(viewer.id, next);
								},
								onOpenSettings: prefs.viewersEnabled[viewer.id] !== false && hasSettings(viewer) ? () => {
									setSettingsFor(viewer);
								} : void 0
							}) }, viewer.id))
						})]
					}),
					settingsFor !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: true,
						onClose: () => {
							setSettingsFor(null);
						},
						title: featureNameOf(settingsFor),
						description: t("settingsPopupDesc", { feature: featureNameOf(settingsFor) }),
						closeLabel: t("close"),
						className: SideCardSection_module_css_default.popupDialog,
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SideCardSection_module_css_default.done,
							onClick: () => {
								setSettingsFor(null);
							},
							children: t("settingsDone")
						}),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsBody, {
							feature: settingsFor,
							prefs,
							onToggle: onToggleSetting,
							onCommit: onCommitSetting,
							onSelectValue: onSelectSetting,
							onPluginToggle: (toggle, next) => {
								onPluginToggle(settingsFor.id, toggle, next);
							},
							onPluginCommit: (toggle, raw) => onPluginCommitSetting(settingsFor.id, toggle, raw),
							onPluginSelectValue: (toggle, next) => {
								applyPluginSetting(settingsFor.id, toggle.key, next);
							},
							onPluginWrite: (key, value) => {
								applyPluginSetting(settingsFor.id, key, value);
							},
							onClose: () => {
								setSettingsFor(null);
							},
							store,
							service
						})
					}),
					stripSettingsOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: true,
						onClose: () => {
							setStripSettingsOpen(false);
						},
						title: t("settingsTitleBarTitle"),
						description: t("settingsPopupDesc", { feature: t("settingsTitleBarTitle") }),
						closeLabel: t("close"),
						className: SideCardSection_module_css_default.popupDialog,
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SideCardSection_module_css_default.done,
							onClick: () => {
								setStripSettingsOpen(false);
							},
							children: t("settingsDone")
						}),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SideCardSection_module_css_default.popupRows,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FeatureSettingsRows, {
								toggles: [{
									key: "titleBarStripPx",
									type: "number",
									title: () => t("settingsTitleBarStripTitle"),
									desc: () => t("settingsTitleBarStripDesc"),
									min: 0,
									max: 120,
									unit: "px"
								}],
								prefs,
								onToggle: onToggleSetting,
								onCommit: onCommitSetting
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CssDraft, {
								value: prefs.customCss,
								label: t("settingsCustomCssTitle"),
								placeholder: t("settingsCustomCssPlaceholder"),
								onCommit: commitCustomCss
							}, prefs.customCss)]
						})
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SideCardSection_module_css_default.error,
						role: "alert",
						children: error
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/libing/kk_Projects/dsh-coding-sidebar/src/client/layout.css.mjs
		const css = "/**\n * Layout push: when a panel is open it OCCUPIES the layout instead of\n * floating over it — the app shell (#root, the AppFrame three-column grid)\n * gives up space. Only the center column is flexible (1fr), so the right\n * panel's width squeeze (margin-right on #root) lands exactly on the\n * conversation output and the input bar, like a VSCode sidebar.\n *\n * The width rides `calc(100% - var(...))` instead of a bare margin on a\n * full-width box: some desktop shells (DSH Desktop, #208) set #root to\n * width:100%, where a margin would overflow the viewport additively —\n * the calc keeps the box at exactly 100% minus the push in every shell.\n * Width and margin transition in lockstep (same variable, same duration\n * and easing), so expand/collapse animates the content width exactly as\n * the bare-margin version did.\n *\n * The size rides the CSS variable updated by the Sidebar shell (0 while\n * collapsed); expand/collapse animates the margin and the panel slide on\n * the same theme duration. Drags disable the transition so the layout\n * tracks the pointer.\n */\n#root {\n  margin-right: var(--dsh-sidebar-width, 0px);\n  width: calc(100% - var(--dsh-sidebar-width, 0px));\n  transition:\n    margin-right var(--ds-transition-duration-slow) var(--ds-ease-in-out),\n    width var(--ds-transition-duration-slow) var(--ds-ease-in-out);\n}\n\n/* The AppFrame's center column, anchored by data attributes (see above).\n   Composite selector: DSH 0.1.x versions name the center grid item\n   `[data-pane=\"conversation\"]`, while rc.8-era shells put a\n   `[data-slot=\"conversation\"]` child inside it — both selectors resolve to\n   the SAME element on live pages (verified), and keeping both future-proofs\n   the rule against a host rename without touching shell-specific markup. */\n#root [data-dsh-frame] > [data-pane=\"conversation\"],\n#root :has(> [data-slot=\"conversation\"]) {\n  /* Grid/flex items default to min-height:auto. A long unbreakable token\n     (OAuth URL) then grows this column past the viewport and clips the\n     composer + left-rail Settings row. min-height:0 lets the cell shrink;\n     overflow-wrap lets the token wrap instead of forcing its intrinsic\n     size. The host's own descendants remain responsible for scrolling. */\n  min-height: 0;\n  overflow-wrap: anywhere;\n}\n\n/* When the sidebar is collapsed, the toggle button reclaims the top-right\n   corner. Push the DSH session header's right padding out so its right-aligned\n   utilities (the \"Session log\" download capsule) yield the corner instead of\n   hiding under the button. The header default right-pads 28px; the button\n   spans right 10→38px, so 46px clears it with an 8px gap. Anchor on\n   the header's slot host wrapper ([data-slot=\"conversation.session.header\"])\n   rather than a positional path: DSH 0.1.x nests the header several levels\n   under the center column. The Sidebar shell toggles the body attribute with\n   the panel open state. */\nbody[data-dsh-sidebar-collapsed] [data-slot=\"conversation.session.header\"] > header {\n  padding-right: 46px;\n}\n\nbody[data-dsh-sidebar-dragging] #root,\nbody[data-dsh-sidebar-dragging] #root [data-dsh-frame] > [data-pane=\"conversation\"],\nbody[data-dsh-sidebar-dragging] #root :has(> [data-slot=\"conversation\"]) {\n  transition: none;\n}\n\n/* DSH 0.1.x gives external settings sections a generic gear and exposes no\n   icon field in the settings.section contract. settings-nav-icon.ts marks\n   only this plugin's localized row; render the requested Lucide\n   gallery-horizontal-end SVG as a currentColor mask so it follows the native\n   nav hover/active colors without changing the shell's 16px icon rhythm. */\n[data-dsh-coding-sidebar-settings-nav] > svg:first-child {\n  display: none;\n}\n\n[data-dsh-coding-sidebar-settings-nav]::before {\n  content: '';\n  flex: none;\n  width: 16px;\n  height: 16px;\n  background: currentColor;\n  -webkit-mask: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 7v10'/%3E%3Cpath d='M6 5v14'/%3E%3Crect width='12' height='18' x='10' y='3' rx='2'/%3E%3C/svg%3E\") center / contain no-repeat;\n  mask: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 7v10'/%3E%3Cpath d='M6 5v14'/%3E%3Crect width='12' height='18' x='10' y='3' rx='2'/%3E%3C/svg%3E\") center / contain no-repeat;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  #root,\n  #root [data-dsh-frame] > [data-pane=\"conversation\"],\n  #root :has(> [data-slot=\"conversation\"]) {\n    transition: none;\n  }\n}\n";
		const tagId = "dsh-coding-sidebar/layout.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-coding-sidebar";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* Client half of dsh-coding-sidebar: resolves the user's "Side card"
		* preferences through the plugin's own fenced settings route, mounts the
		* right sidebar portal (inside an error boundary so a rendering failure
		* shows an error strip instead of a blank panel), registers the turn-tail
		* interception, and contributes the Side card settings section to the DSH
		* Settings shell. Requires the runtime's slots and sessions services; the
		* bundle itself is a module-table consumer only (react + ui-primitives +
		* xterm, all provided or inlined).
		*/
		/** Services required before mounting (provided by the client runtime; the
		*  locale service backs the sidebar's copy — see locales.ts). `modules`
		*  (rc.8+) is the client module system the chunk loader resolves its
		*  externals through — Cordis guards service access without inject.
		*  `remote` + `remote.session` pin this build to the 0.1.2-alpha.1+ carrier:
		*  the open-path interception wraps the session namespace, and the deep path
		*  is validated AS A WHOLE by the traceable service proxy (a bare ctx.get
		*  clears the first hop, then `cannot get property "remote.session" without
		*  inject` on the second). Cordis inject is all-required, so a carrier
		*  without these never mounts this plugin — same policy as `modules`. */
		const inject = [
			"slots",
			"sessions",
			"connection",
			"locale",
			"modules",
			"remote",
			"remote.session"
		];
		/**
		* Error boundary over the sidebar tree (root scope): a render error in the
		* sidebar SHELL itself must never blank the page silently — the shared
		* RenderBoundary shows a dismissible error strip and logs the stack. The
		* per-tab scope (Sidebar.tsx) catches viewer/editor crashes first; this root
		* boundary stays as the last resort for Workbench/shell errors.
		*/
		/**
		* Client plugin body.
		* @param ctx - the client cordis context (slots, sessions).
		*/
		function apply(ctx) {
			attachLocale(ctx.locale);
			ctx.effect(() => {
				const offZh = ctx.locale.register(LOCALE_NS, "zh", zh);
				const offEn = ctx.locale.register(LOCALE_NS, "en", en);
				return () => {
					offZh();
					offEn();
				};
			}, "dsh-coding-sidebar: dictionaries");
			ctx.inject(["uiWorkspace"], (scope) => {
				observeUiWorkspaceFace(scope.uiWorkspace);
			});
			console.info(`[dsh-coding-sidebar] client ${SIDEBAR_SERVICE_VERSION} booted (nav-seam v3: uiWorkspace capture)`);
			ctx.effect(() => {
				let dispose;
				let generation = 0;
				const sync = () => {
					generation += 1;
					dispose?.();
					dispose = void 0;
					const store = ctx.get("betterLocale");
					attachBetterLocale(store);
					if (store !== void 0) {
						const myGeneration = generation;
						loadChunk("locale").then((mod) => {
							if (myGeneration !== generation) return;
							dispose = store.register(LOCALE_NS, mod.localeDicts);
						}).catch(() => {});
					}
				};
				sync();
				const unsubscribe = ctx.locale.subscribe(sync);
				return () => {
					generation += 1;
					unsubscribe();
					dispose?.();
					attachBetterLocale(void 0);
				};
			}, "dsh-coding-sidebar: better-locale lazy integration");
			const sidebarStore = createSidebarStore();
			const service = createBetterSidebarService(sidebarStore);
			ctx.provide("betterSidebar", service);
			const fallbackTitle = t("terminal");
			let terminalTitle = fallbackTitle;
			api.shellGet().then(({ name }) => {
				terminalTitle = name;
				const snapshot = service.getSnapshot();
				if (snapshot.state === void 0) return;
				const tabs = allLeaves(snapshot.state.splits).flatMap((leaf) => leaf.tabs);
				for (const tab of tabs) if (tab.type === "terminal" && !isAgentTabId(tab.id) && tab.title === fallbackTitle) service.updateTab(tab.id, { title: name });
			}).catch(() => {});
			ctx.effect(() => registerBuiltins(ctx, service, { terminalTitle: () => terminalTitle }), "dsh-coding-sidebar: register built-in tabs and viewers");
			const fail = (phase, error) => {
				console.error(`[dsh-coding-sidebar] ${phase} error:`, error);
				try {
					const bar = document.createElement("div");
					bar.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483000;max-width:70vw;padding:8px 12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#f2a1a1;background:#1b1b22;border:1px solid #f2a1a1;border-radius:8px;white-space:pre-wrap";
					bar.textContent = `[dsh-coding-sidebar] ${phase} error: ${error instanceof Error ? error.message : String(error)}`;
					document.body.appendChild(bar);
				} catch {}
			};
			try {
				setChunkModuleSystem(ctx.modules);
				revalidateChunksOnReactivate();
				ctx.effect(() => {
					let disposed = false;
					let root;
					let host;
					let mounted = false;
					let bodyObserver;
					let hostCheckFrame = null;
					const unmount = () => {
						if (!mounted) return;
						mounted = false;
						bodyObserver?.disconnect();
						bodyObserver = void 0;
						if (hostCheckFrame !== null) {
							cancelAnimationFrame(hostCheckFrame);
							hostCheckFrame = null;
						}
						root?.unmount();
						root = void 0;
						host?.remove();
						host = void 0;
					};
					/** Re-attach the host if the page (a desktop shell wrapper, SPA
					*  navigation, …) ever removes it from <body>. Cheap: childList only,
					*  no subtree, no attribute filtering. */
					const guardAnchor = () => {
						if (bodyObserver !== void 0) return;
						bodyObserver = new MutationObserver(() => {
							if (host !== void 0 && !document.body.contains(host)) document.body.appendChild(host);
						});
						bodyObserver.observe(document.body, { childList: true });
					};
					/** One-shot geometry self-check: if the host page transforms
					*  <html>/<body> itself (exotic shells), a fixed panel host would
					*  track the transformed box instead of the viewport. Flip the
					*  degraded mode and pin the host to the viewport every frame until
					*  the ancestor transform is actually gone. The normal path (no
					*  page-level transform) never runs the sync loop. */
					const scheduleHostCheck = () => {
						hostCheckFrame ??= requestAnimationFrame(() => {
							hostCheckFrame = null;
							const layer = host?.querySelector("[data-dsh-panel-host]");
							if (layer === null || layer === void 0) return;
							const rect = layer.getBoundingClientRect();
							if (!(Math.abs(rect.left) > 8 || Math.abs(rect.top) > 8 || Math.abs(rect.width - window.innerWidth) > 8 || Math.abs(rect.height - window.innerHeight) > 8)) {
								layer.removeAttribute("data-dsh-panel-host-degraded");
								layer.style.transform = "";
								return;
							}
							layer.setAttribute("data-dsh-panel-host-degraded", "");
							console.warn("[dsh-coding-sidebar] panel host geometry mismatch — a page-level transform was detected; using degraded viewport sync");
							let applied = {
								x: 0,
								y: 0
							};
							const sync = () => {
								const r = layer.getBoundingClientRect();
								const rawLeft = r.left - applied.x;
								const rawTop = r.top - applied.y;
								if (Math.abs(rawLeft) <= 1 && Math.abs(rawTop) <= 1 && Math.abs(r.width - window.innerWidth) <= 1 && Math.abs(r.height - window.innerHeight) <= 1) {
									layer.removeAttribute("data-dsh-panel-host-degraded");
									layer.style.transform = "";
									return;
								}
								const next = {
									x: -rawLeft,
									y: -rawTop
								};
								if (next.x !== applied.x || next.y !== applied.y) {
									applied = next;
									layer.style.transform = `translate(${applied.x}px, ${applied.y}px)`;
								}
								hostCheckFrame = requestAnimationFrame(sync);
							};
							hostCheckFrame = requestAnimationFrame(sync);
						});
					};
					const mount = () => {
						if (mounted || disposed) return;
						try {
							host = document.createElement("div");
							host.setAttribute("data-dsh-better-sidebar", "");
							document.body.appendChild(host);
							root = (0, react_dom_client.createRoot)(host);
							root.render((0, react.createElement)(RenderBoundary, { className: sidebar_module_css_default.boundaryError }, (0, react.createElement)(Sidebar, {
								ctx,
								store: sidebarStore
							})));
							mounted = true;
							guardAnchor();
							scheduleHostCheck();
						} catch (error) {
							fail("mount", error);
						}
					};
					const sync = async () => {
						if (disposed) return;
						const prefs = await Promise.race([loadPrefs(api), new Promise((resolve) => {
							window.setTimeout(() => resolve(null), 2e3);
						})]);
						if (prefs !== null) sidebarStore.setPrefs(prefs);
						if (disposed) return;
						const suspended = await loadExternalDisable(api);
						if (disposed) return;
						sidebarStore.setSuspended(suspended);
						if (suspended) unmount();
						else mount();
					};
					sync();
					const offRemote = ctx.get("remote")?.$on?.("settings/document-updated", () => {
						sync();
					});
					return () => {
						disposed = true;
						offRemote?.();
						unmount();
					};
				}, "dsh-coding-sidebar: sidebar mount");
				ctx.effect(() => {
					try {
						return registerTurnTailInterception(ctx, sidebarStore);
					} catch (error) {
						fail("interception", error);
						return () => {};
					}
				}, "dsh-coding-sidebar: turn-tail interception");
				ctx.effect(() => {
					try {
						return registerOpenPathInterception(ctx, sidebarStore);
					} catch (error) {
						fail("interception", error);
						return () => {};
					}
				}, "dsh-coding-sidebar: open-path interception");
				ctx.effect(() => {
					try {
						const urlTargetOf = (url) => {
							const prefs = sidebarStore.getPrefs();
							return matchUrlTarget(service.getTabs().filter((tab) => prefs.tabsEnabled[tab.id] !== false), url)?.id;
						};
						return registerLinkInterception({
							takeoverEnabled: (url) => {
								if (sidebarStore.getSuspended()) return false;
								const prefs = sidebarStore.getPrefs();
								if (prefs.browserInterceptLinks === false) return false;
								if (!(url.protocol === "https:" ? prefs.browserInterceptHttps !== false : prefs.browserInterceptHttp !== false)) return false;
								return urlTargetOf(url) !== void 0 || prefs.tabsEnabled["browser"] !== false;
							},
							openInSidebar: (url) => {
								let title;
								try {
									title = new URL(url).hostname;
								} catch {}
								const type = urlTargetOf(new URL(url)) ?? "browser";
								ctx.get("betterSidebar")?.openTab({
									type,
									url,
									title
								});
							},
							selfOrigin: window.location.origin
						});
					} catch (error) {
						fail("interception", error);
						return () => {};
					}
				}, "dsh-coding-sidebar: link interception");
				ctx.effect(() => {
					try {
						return registerImeGuard();
					} catch (error) {
						fail("ime guard", error);
						return () => {};
					}
				}, "dsh-coding-sidebar: IME composition guard");
				ctx.effect(() => registerSettingsNavIcon(() => t("settingsNav")), "dsh-coding-sidebar: settings navigation icon");
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: SETTINGS_SECTION_ID,
					order: 100,
					priority: 0,
					label: () => t("settingsNav"),
					inject: () => ({
						store: sidebarStore,
						service
					})
				}, SideCardSection));
			} catch (error) {
				fail("load", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map