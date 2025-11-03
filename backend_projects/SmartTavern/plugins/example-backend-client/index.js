// Example frontend plugin calling backend plugin APIs
// Path: backend_projects/SmartTavern/plugins/example-backend-client/index.js

export default function activate(host) {
  const base =
    (typeof window !== 'undefined' && (window.ST_BACKEND_BASE || localStorage.getItem('st.backend_base'))) ||
    ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : null) ||
    'http://localhost:8050';

  // Event handlers
  async function callEcho(text) {
    try {
      const res = await fetch(`${base}/api/plugins/smarttavern/example_backend/echo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      host.pushToast?.({ type: 'success', message: `Echo: ${String(data?.echo ?? '')}`, timeout: 1800 });
      host.appendMessage?.({ role: 'system', content: `Echo result: ${String(data?.echo ?? '')}` });
    } catch (e) {
      host.pushToast?.({ type: 'error', message: `Echo failed: ${e}`, timeout: 2000 });
    }
  }

  async function callInfo() {
    try {
      const res = await fetch(`${base}/api/plugins/smarttavern/example_backend/info`, {
        method: 'GET'
      });
      const data = await res.json();
      host.pushToast?.({ type: 'info', message: `Plugin: ${String(data?.plugin ?? '')}`, timeout: 1800 });
      host.appendMessage?.({ role: 'system', content: `Project=${String(data?.project ?? '')}, Plugin=${String(data?.plugin ?? '')}` });
    } catch (e) {
      host.pushToast?.({ type: 'error', message: `Info failed: ${e}`, timeout: 2000 });
    }
  }

  // Register Home button
  const disposeBtn = host.registerHomeButton?.({
    id: 'example.backend.client',
    label: 'Example Backend',
    icon: 'server',
    order: 85,
    actionId: 'plugin.example_backend.open'
  });

  // Subscribe events
  const offOpen = host.events.on?.('plugin.example_backend.open', async () => {
    const text = window.prompt('Enter text for echo:', 'hello');
    if (text != null) {
      await callEcho(text);
    }
  });

  const offEcho = host.events.on?.('plugin.example_backend.echo', async (payload) => {
    await callEcho(String(payload?.text ?? 'hello'));
  });

  const offInfo = host.events.on?.('plugin.example_backend.info', async () => {
    await callInfo();
  });

  // Return disposer
  return () => {
    try {
      disposeBtn?.();
      offOpen?.();
      offEcho?.();
      offInfo?.();
    } catch (_) {}
  };
}

// Usage notes:
// - Add manifest.json in the same folder with:
//   { "entries": ["index.js"] }
// - The plugin will be loaded by the runtime loader and expose:
//   - Home button "Example Backend"
//   - Actions:
//     - 'plugin.example_backend.echo'  payload: { text }
//     - 'plugin.example_backend.info'  no payload
// - Requires backend APIs registered under /api/plugins/smarttavern/example_backend/*