// frontend stub for postprocess_orchestrator (backend-only)
export default function activate(host) {
  try { host.pushToast?.({ type: 'info', message: 'postprocess_orchestrator (frontend stub) 已加载', timeout: 1200 }); } catch (_) {}
  return () => {};
}


