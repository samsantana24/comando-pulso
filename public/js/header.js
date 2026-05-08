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

  async function saveVisibleScenarios() {
    const ids = [];
    root.querySelectorAll('input[data-action="visible-toggle"]').forEach((cb) => {
      if (cb.checked && !cb.disabled) ids.push(Number(cb.dataset.id));
    });
    try {
      await postJson('/api/settings', { pedrra_visible_scenario_ids: JSON.stringify(ids) }, 'PUT');
    } catch (err) {
      alert('Erro ao salvar visíveis: ' + err.message);
    }
  }

  root.addEventListener('change', async (e) => {
    if (e.target.matches('input[data-action="visible-toggle"]')) {
      const checked = root.querySelectorAll('input[data-action="visible-toggle"]:checked:not(:disabled)').length;
      if (checked > 3) {
        e.target.checked = false;
        alert('Máximo 3 cenários adicionais visíveis no gráfico.');
        return;
      }
      await saveVisibleScenarios();
      if (window.location.pathname.startsWith('/pedrra')) {
        window.location.reload();
      }
    }
  });

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'visible-toggle') return;
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
