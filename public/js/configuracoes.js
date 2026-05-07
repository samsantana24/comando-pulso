(function () {
  const formSettings = document.getElementById('form-settings');
  const status = document.getElementById('settings-status');

  formSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formSettings));
    const payload = {
      initial_cash_brl: data.initial_cash_brl,
      include_initial_cash: data.include_initial_cash ? '1' : '0',
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
        if (!window.confirm(`Remover ${name}?`)) return;
        const res = await fetch('/api/team/' + id, { method: 'DELETE' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.location.reload();
      }
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });
})();
