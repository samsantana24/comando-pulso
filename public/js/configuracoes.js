(function () {
  const formSettings = document.getElementById('form-settings');
  const status = document.getElementById('settings-status');

  formSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formSettings));
    const payload = {
      initial_cash_brl: data.initial_cash_brl,
      include_initial_cash: data.include_initial_cash ? '1' : '0',
      include_ads_in_runway: data.include_ads_in_runway ? '1' : '0',
      include_receivables_in_projection: data.include_receivables_in_projection ? '1' : '0',
      default_payment_tax_pct: data.default_payment_tax_pct,
    };
    status.textContent = 'salvando…';
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        status.textContent = 'erro: ' + (err.error || res.status);
        return;
      }
      status.textContent = '✔ salvo';
      setTimeout(() => (status.textContent = ''), 2000);
    } catch (err) {
      status.textContent = 'erro: ' + err.message;
    }
  });

  const formAdd = document.getElementById('form-team-add');
  formAdd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formAdd));
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, role: data.role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Erro: ' + (err.error || res.status));
        return;
      }
      window.location.reload();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });

  document.getElementById('team-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    try {
      if (action === 'toggle') {
        const isActive = btn.dataset.active === '1';
        const res = await fetch('/api/team/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !isActive }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.location.reload();
      } else if (action === 'remove') {
        const name = btn.dataset.name || '';
        if (!window.confirm('Remover ' + name + '?')) return;
        const res = await fetch('/api/team/' + id, { method: 'DELETE' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.location.reload();
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });

  const catModal = document.getElementById('modal-category');
  const catForm = document.getElementById('form-category');
  const catTitle = document.getElementById('modal-cat-title');

  document.getElementById('btn-new-category').addEventListener('click', () => {
    catTitle.textContent = 'Nova categoria';
    catForm.reset();
    catForm.elements.id.value = '';
    catModal.showModal();
  });

  catModal.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => catModal.close());
  });

  catForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(catForm));
    const isEdit = !!data.id;
    const url = isEdit ? '/api/categories/' + data.id : '/api/categories';
    const method = isEdit ? 'PATCH' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, group_name: data.group_name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Erro: ' + (err.error || res.status));
        return;
      }
      window.location.reload();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });

  document.getElementById('cat-groups').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'edit-category') {
      catTitle.textContent = 'Editar categoria';
      catForm.elements.id.value = id;
      catForm.elements.name.value = btn.dataset.name || '';
      catForm.elements.group_name.value = btn.dataset.group || '';
      catModal.showModal();
      return;
    }

    if (action === 'delete-category') {
      const name = btn.dataset.name || '';
      if (!window.confirm('Excluir a categoria "' + name + '"?')) return;
      try {
        let res = await fetch('/api/categories/' + id, { method: 'DELETE' });
        if (res.status === 400) {
          const err = await res.json().catch(() => ({}));
          if (err.code !== 'HAS_COSTS' && !err.costs_count) {
            alert('Erro: ' + (err.error || res.status));
            return;
          }
          const moveTo = window.prompt(
            'Esta categoria tem ' + err.costs_count + ' custo(s) associado(s). Para excluir, digite o NOME da categoria pra onde mover esses custos:'
          );
          if (!moveTo || !moveTo.trim()) return;
          res = await fetch('/api/categories/' + id + '?move_to=' + encodeURIComponent(moveTo.trim()), { method: 'DELETE' });
          if (!res.ok && res.status !== 204) {
            const err2 = await res.json().catch(() => ({}));
            alert('Erro: ' + (err2.error || res.status));
            return;
          }
        } else if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}));
          alert('Erro: ' + (err.error || res.status));
          return;
        }
        window.location.reload();
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    }
  });
})();
