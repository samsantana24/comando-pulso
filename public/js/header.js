(function () {
  const root = document.querySelector('[data-component="scenario-picker"]');
  if (!root) return;

  const toggle = root.querySelector('[data-toggle]');
  const menu = root.querySelector('[data-menu]');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) menu.hidden = true;
  });

  async function postJson(url, payload, method = 'POST') {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (payload !== undefined) opts.body = JSON.stringify(payload);
    const res = await fetch(url, opts);
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    return res.status === 204 ? null : res.json();
  }

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const currentName = btn.dataset.name || '';

    try {
      if (action === 'activate') {
        await postJson('/api/scenarios/' + id + '/activate');
        window.location.reload();
        return;
      }
      if (action === 'new') {
        const name = window.prompt('Nome do novo cenário:', '');
        if (!name || !name.trim()) return;
        await postJson('/api/scenarios', { name: name.trim() });
        window.location.reload();
        return;
      }
      if (action === 'rename') {
        const name = window.prompt('Novo nome:', currentName);
        if (!name || !name.trim() || name.trim() === currentName) return;
        await postJson('/api/scenarios/' + id, { name: name.trim() }, 'PATCH');
        window.location.reload();
        return;
      }
      if (action === 'duplicate') {
        const name = window.prompt('Nome do cenário duplicado:', currentName + ' (cópia)');
        if (!name || !name.trim()) return;
        await postJson('/api/scenarios/' + id + '/duplicate', { name: name.trim() });
        window.location.reload();
        return;
      }
      if (action === 'delete') {
        if (!window.confirm(`Excluir o cenário "${currentName}"? Custos e funil hipotéticos vinculados a ele serão removidos.`)) return;
        await postJson('/api/scenarios/' + id, undefined, 'DELETE');
        window.location.reload();
        return;
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });
})();
