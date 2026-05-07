(function () {
  function openModalById(id) {
    const dlg = document.getElementById(id);
    if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
  }

  document.querySelectorAll('[data-modal]').forEach((btn) => {
    btn.addEventListener('click', () => openModalById('modal-' + btn.dataset.modal));
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dlg = btn.closest('dialog');
      if (dlg) dlg.close();
    });
  });

  function payloadFromForm(form) {
    const data = Object.fromEntries(new FormData(form));
    for (const [k, v] of Object.entries(data)) {
      if (v === '') data[k] = null;
    }
    if ('is_recurring' in data) {
      data.is_recurring = data.is_recurring === 'true' || data.is_recurring === true;
    }
    return data;
  }

  document.querySelectorAll('form.api-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = form.dataset.endpoint;
      const method = form.dataset.method || 'POST';
      if (!url) {
        alert('Endpoint não definido. Recarregue a página.');
        return;
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadFromForm(form)),
        });
        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}));
          alert('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        alert('Erro: ' + err.message);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });

  function loadIntoForm(form, payload, fields) {
    for (const k of fields) {
      const el = form.elements[k];
      if (!el) continue;
      el.value = payload[k] == null ? '' : payload[k];
    }
  }

  document.querySelectorAll('[data-action="edit-sale"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payload = JSON.parse(btn.dataset.payload);
      const dlg = document.getElementById('modal-edit-sale');
      const form = dlg.querySelector('form');
      form.dataset.endpoint = '/api/sales/' + payload.id;
      loadIntoForm(form, payload, ['date', 'gross_amount', 'net_amount', 'client_name', 'closer_id', 'payment_method', 'notes']);
      dlg.showModal();
    });
  });

  document.querySelectorAll('[data-action="edit-cost"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payload = JSON.parse(btn.dataset.payload);
      const dlg = document.getElementById('modal-edit-cost');
      const form = dlg.querySelector('form');
      form.dataset.endpoint = '/api/costs/' + payload.id;
      loadIntoForm(form, payload, ['date', 'amount', 'category', 'description', 'status']);
      dlg.showModal();
    });
  });

  document.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Confirma a exclusão? Esta ação não pode ser desfeita.')) return;
      try {
        const res = await fetch(btn.dataset.url, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}));
          alert('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    });
  });

  const recPattern = document.querySelector('select[name="recurrence_pattern"]');
  if (recPattern) {
    const valueInput = document.querySelector('input[name="recurrence_value"]');
    const valueLabel = document.getElementById('recurrence-value-label');
    function update() {
      if (recPattern.value === 'monthly_day') {
        valueLabel.textContent = 'Dia do mês (1-31)';
        valueInput.min = 1; valueInput.max = 31;
        if (Number(valueInput.value) < 1 || Number(valueInput.value) > 31) valueInput.value = 5;
      } else {
        valueLabel.textContent = 'A cada N semanas';
        valueInput.min = 1; valueInput.max = 52;
        if (Number(valueInput.value) < 1) valueInput.value = 4;
      }
    }
    recPattern.addEventListener('change', update);
    update();
  }
})();
