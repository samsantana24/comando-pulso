(function () {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const receiveModal = document.getElementById('modal-receive');
  const receiveForm = document.getElementById('form-receive');
  const receivePreview = document.getElementById('receive-preview');

  if (receiveModal && receiveForm) {
    document.querySelectorAll('[data-action="receive-receivable"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const payload = JSON.parse(btn.dataset.payload);
        receiveForm.elements.id.value = payload.id;
        receiveForm.elements.received_date.value = (new Date()).toISOString().slice(0, 10);
        receiveForm.elements.net_amount.value = payload.expected_amount;
        if (receivePreview) {
          receivePreview.textContent =
            'Recebível #' + payload.id + ' · esperado: ' + BRL.format(payload.expected_amount) +
            (payload.client_name ? ' · ' + payload.client_name : '');
        }
        receiveModal.showModal();
      });
    });

    receiveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(receiveForm));
      try {
        const res = await fetch('/api/receivables/' + data.id + '/mark-received', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            received_date: data.received_date,
            net_amount: Number(data.net_amount),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        alert('Erro: ' + err.message);
      }
    });
  }

  document.querySelectorAll('[data-action="delete-receivable"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Cancelar este recebível?')) return;
      try {
        const res = await fetch('/api/receivables/' + btn.dataset.id, { method: 'DELETE' });
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
})();
