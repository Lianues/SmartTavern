// SmartTavern Theme Runtime - Sandbox Client (v1)
// Runs inside a tightly sandboxed iframe. Bridges with host via postMessage.
// Security: Keep minimal. No DOM or network access unless future permissions are explicitly granted.
// Status: Skeleton. Currently only responds to 'ping'.

(function () {
  'use strict';

  // Post helper
  function post(type, payload, target = window.parent) {
    try {
      target.postMessage({ __stSandbox: { type, payload } }, '*');
    } catch (e) {
      // ignore
    }
  }

  // Generate simple ids only if we later need request/response. For now, reply-only.
  function handleMessage(ev) {
    const data = ev.data;
    if (!data || !data.__stSandbox) return;
    const msg = data.__stSandbox;
    const { id, type, payload } = msg;

    // Minimal RPC response helper
    function reply(okPayload) {
      try {
        window.parent.postMessage({ __stSandbox: { id, type, payload: okPayload } }, '*');
      } catch (_) {}
    }
    function fail(errorMessage) {
      try {
        window.parent.postMessage({ __stSandbox: { id, type, error: errorMessage || 'error' } }, '*');
      } catch (_) {}
    }

    try {
      if (type === 'ping') {
        reply({ ok: true, t: Date.now(), echo: payload || null });
        return;
      }

      // Unknown message types are safely ignored/fail-closed
      fail('unsupported');
    } catch (e) {
      fail(e && e.message ? e.message : 'exception');
    }
  }

  // Init
  window.addEventListener('message', handleMessage);
  // Optional: announce ready
  post('ready', { t: Date.now() });
})();