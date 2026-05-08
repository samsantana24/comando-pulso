(function () {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    if ('is_recurring' in data) data.is_recurring = data.is_recurring === 'true' || data.is_recurring === true;
    return data;
  }

  document.querySelectorAll('form.api-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = form.dataset.endpoint;
      const method = form.dataset.method || 'POST';
      if (!url) { alert('Endpoint não definido. Recarregue.'); return; }
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

  // === Modal Ads ===
  const adsForm = document.getElementById('form-ads');
  const adsPreview = document.getElementById('ads-preview');
  function updateAdsPreview() {
    const total = Number(adsForm.elements.total_amount.value) || 0;
    if (total > 0) {
      adsPreview.textContent = 'Será dividido em ' + BRL.format(total / 7) + ' por dia (7 dias).';
    } else {
      adsPreview.textContent = '';
    }
  }
  adsForm.elements.total_amount.addEventListener('input', updateAdsPreview);
  adsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(adsForm));
    const payload = {
      week_start_date: data.week_start_date,
      total_amount: Number(data.total_amount),
      scenario_id: data.scenario_id ? Number(data.scenario_id) : null,
    };
    try {
      const res = await fetch('/api/ads-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  // === Modal Venda com toggle parcelada ===
  const vendaForm = document.getElementById('form-venda');
  const vendaModeRadios = vendaForm.querySelectorAll('input[name="venda_mode"]');
  const installmentsBlock = document.getElementById('installments-block');
  const installmentsTbody = document.getElementById('installments-tbody');
  const installmentsSummary = document.getElementById('installments-summary');
  let installments = [];

  function renderInstallments() {
    installmentsTbody.innerHTML = '';
    installments.forEach((inst, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="date" value="' + (inst.expected_date || '') + '" data-idx="' + idx + '" data-field="expected_date" required /></td>' +
        '<td class="num"><input type="number" min="0" step="0.01" value="' + (inst.expected_amount || '') + '" data-idx="' + idx + '" data-field="expected_amount" required /></td>' +
        '<td><select data-idx="' + idx + '" data-field="payment_method">' +
          '<option value="">—</option>' +
          ['pix','cartao_avista','cartao_2x','cartao_6x','cartao_12x','outro'].map((m) =>
            '<option value="' + m + '" ' + (inst.payment_method === m ? 'selected' : '') + '>' + m + '</option>'
          ).join('') +
        '</select></td>' +
        '<td><button type="button" class="btn-link danger" data-remove="' + idx + '">remover</button></td>';
      installmentsTbody.appendChild(tr);
    });
    updateInstallmentsSummary();
  }

  function updateInstallmentsSummary() {
    const totalParcelas = installments.reduce((acc, i) => acc + (Number(i.expected_amount) || 0), 0);
    const hoje = Number(vendaForm.elements.net_amount.value) || 0;
    const total = hoje + totalParcelas;
    installmentsSummary.textContent =
      'Hoje: ' + BRL.format(hoje) +
      ' · ' + installments.length + ' parcela(s): ' + BRL.format(totalParcelas) +
      ' · Total da venda: ' + BRL.format(total);
  }

  installmentsTbody.addEventListener('input', (e) => {
    const idx = Number(e.target.dataset.idx);
    const field = e.target.dataset.field;
    if (field === undefined || isNaN(idx)) return;
    installments[idx][field] = e.target.value;
    updateInstallmentsSummary();
  });
  installmentsTbody.addEventListener('click', (e) => {
    if (e.target.dataset.remove !== undefined) {
      const idx = Number(e.target.dataset.remove);
      installments.splice(idx, 1);
      renderInstallments();
    }
  });

  document.getElementById('btn-add-installment').addEventListener('click', () => {
    const baseDate = vendaForm.elements.date.value || new Date().toISOString().slice(0, 10);
    const next = new Date(baseDate);
    next.setMonth(next.getMonth() + (installments.length + 1));
    const isoNext = next.toISOString().slice(0, 10);
    installments.push({ expected_date: isoNext, expected_amount: '', payment_method: 'cartao_avista' });
    renderInstallments();
  });

  vendaModeRadios.forEach((r) => {
    r.addEventListener('change', () => {
      if (r.value === 'installments' && r.checked) {
        installmentsBlock.hidden = false;
        if (installments.length === 0) {
          document.getElementById('btn-add-installment').click();
        }
      } else if (r.value === 'paid' && r.checked) {
        installmentsBlock.hidden = true;
      }
    });
  });
  vendaForm.elements.net_amount.addEventListener('input', updateInstallmentsSummary);

  vendaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(vendaForm));
    const isInstallments = data.venda_mode === 'installments';
    const submitBtn = vendaForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      let res;
      if (isInstallments) {
        const payload = {
          date: data.date,
          gross_amount: Number(data.gross_amount),
          net_amount: Number(data.net_amount),
          client_name: data.client_name || null,
          closer_id: data.closer_id ? Number(data.closer_id) : null,
          payment_method: data.payment_method || null,
          notes: data.notes || null,
          installments: installments.map((i) => ({
            expected_date: i.expected_date,
            expected_amount: Number(i.expected_amount),
            payment_method: i.payment_method || null,
          })),
        };
        res = await fetch('/api/receivables/sale-with-installments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const payload = {
          date: data.date,
          gross_amount: Number(data.gross_amount),
          net_amount: Number(data.net_amount),
          client_name: data.client_name || null,
          closer_id: data.closer_id ? Number(data.closer_id) : null,
          payment_method: data.payment_method || null,
          notes: data.notes || null,
        };
        res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
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

  // === Recebíveis ===
  const receiveModal = document.getElementById('modal-receive');
  const receiveForm = document.getElementById('form-receive');
  const receivePreview = document.getElementById('receive-preview');

  document.querySelectorAll('[data-action="receive-receivable"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payload = JSON.parse(btn.dataset.payload);
      receiveForm.elements.id.value = payload.id;
      receiveForm.elements.received_date.value = (new Date()).toISOString().slice(0, 10);
      receiveForm.elements.net_amount.value = payload.expected_amount;
      receivePreview.textContent =
        'Recebível #' + payload.id + ' · esperado: ' + BRL.format(payload.expected_amount) +
        (payload.client_name ? ' · ' + payload.client_name : '');
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
