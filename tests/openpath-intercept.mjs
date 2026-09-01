const REMOTE_OPEN_RESULT = { ok: true, value: { opened: true } };
function isFolderRevealPath(path) {
  if (path === "." || path === "./") return true;
  const trimmed = path.replace(/[\\/]+$/, "");
  return trimmed === "." || /[\\/]\.$/.test(trimmed);
}
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
function wrapRemoteOpenPath(session, deps) {
  const desc = Object.getOwnPropertyDescriptor(session, "openWorkspacePath");
  if (desc?.get === void 0) return () => {
  };
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
export {
  isFolderRevealPath,
  wrapOpenPath,
  wrapRemoteOpenPath
};
