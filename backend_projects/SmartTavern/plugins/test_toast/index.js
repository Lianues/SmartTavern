// frontend stub for test_toast (backend-registered postprocess unit)
export default function activate(host) {
  // 注册前端后处理事件：toast → showToast
  try {
    const bridge = (typeof window !== 'undefined') && (window.STPostprocessBridge || (window.STSandbox && window.STSandbox.PostprocessBridge));
    if (bridge && typeof bridge.on === 'function') {
      const getShowToast = () => {
        try {
          if (window.STSandbox && typeof window.STSandbox.showToast === 'function') return window.STSandbox.showToast;
          if (typeof window.showToast === 'function') return window.showToast;
          if (window.showToast && typeof window.showToast.info === 'function') {
            return (opts) => {
              const t = (opts && opts.type) || 'info';
              const fn = window.showToast[t] || window.showToast.info;
              return fn(opts?.message || String(opts || ''));
            };
          }
        } catch (_) {}
        return null;
      };

      const offToast = bridge.on('toast', 'toast', ({ data }) => {
        const showToast = getShowToast();
        if (!showToast) return;
        const type = String(data?.type || 'info').toLowerCase();
        const message = String(data?.message || '').trim();
        const timeout = Number.isFinite(data?.timeout) ? Number(data.timeout) : undefined;
        if (!message) return;
        try { showToast({ type, message, timeout }); } catch (_) {}
      });

      host.__disposers = host.__disposers || [];
      host.__disposers.push(offToast);
    }
  } catch (_) {}

  return () => {
    try { (host.__disposers || []).forEach(fn => { try { fn?.(); } catch (_) {} }); } catch (_) {}
  };
}


