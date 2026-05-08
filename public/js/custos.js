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
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
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
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
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
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      }
    });
  });

  // === Editar Ads de uma semana específica ===
  function openEditAdsWeek(weekStart, currentAmount, weekId) {
    const dlg = document.getElementById('modal-edit-ads-week');
    if (!dlg) return;
    const ctx = document.getElementById('edit-ads-context');
    const preview = document.getElementById('edit-ads-preview');
    dlg.querySelector('input[name="week_start_date"]').value = weekStart;
    dlg.querySelector('input[name="total_amount"]').value = currentAmount;
    if (ctx) ctx.textContent = 'Semana ' + (weekId || '') + ' iniciada em ' + weekStart;
    if (preview) preview.textContent = 'Diário: ' + BRL.format(Number(currentAmount) / 7);
    const totalInput = dlg.querySelector('input[name="total_amount"]');
    totalInput.oninput = () => {
      const v = Number(totalInput.value || 0);
      if (preview) preview.textContent = 'Diário: ' + BRL.format(v / 7);
    };
    dlg.showModal();
  }

  document.querySelectorAll('[data-action="edit-ads-week"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openEditAdsWeek(btn.dataset.weekStart, btn.dataset.amount, btn.dataset.weekId);
    });
  });

  const editAdsForm = document.getElementById('form-edit-ads-week');
  if (editAdsForm) {
    editAdsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(editAdsForm));
      try {
        const res = await fetch('/api/ads-week', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            week_start_date: data.week_start_date,
            total_amount: Number(data.total_amount),
            scenario_id: data.scenario_id || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      }
    });
  }

  document.querySelectorAll('[data-action="delete-ads-week"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const amount = Number(btn.dataset.amount || 0);
      const weekId = btn.dataset.weekId || '';
      if (!confirm('Remover ' + BRL.format(amount) + ' em Ads da semana ' + weekId + '? Esta ação apaga os 7 lançamentos diários.')) return;
      try {
        const url = '/api/ads-week?week_start_date=' + encodeURIComponent(btn.dataset.weekStart);
        const res = await fetch(url, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}));
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      }
    });
  });

  // === Histórico de Ads ===
  const historyTbody = document.getElementById('ads-history-tbody');
  if (historyTbody) {
    (async () => {
      try {
        const res = await fetch('/api/ads-week');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) {
          historyTbody.innerHTML = '<tr><td colspan="5" class="muted center">Nenhum investimento em Ads lançado.</td></tr>';
          return;
        }
        const sorted = rows.slice().sort((a, b) => b.sun.localeCompare(a.sun));
        const canEdit = window.PERMS && window.PERMS.edit_ads === true;
        const canDelete = window.PERMS && window.PERMS.delete_ads === true;
        historyTbody.innerHTML = sorted.map((r) => {
          const daily = r.total / 7;
          const actions = [
            canEdit ? `<button type="button" class="btn-link" data-act="ed" data-ws="${r.sun}" data-wi="${r.week_id}" data-am="${r.total}">editar</button>` : '',
            canDelete ? `<button type="button" class="btn-link danger" data-act="rm" data-ws="${r.sun}" data-wi="${r.week_id}" data-am="${r.total}">remover</button>` : '',
          ].filter(Boolean).join(' ');
          return `<tr>
            <td><strong>${r.week_id}</strong></td>
            <td class="muted">${r.label}</td>
            <td class="num money">${BRL.format(r.total)}</td>
            <td class="num muted money">${BRL.format(daily)}</td>
            <td>${actions || '<span class="muted">—</span>'}</td>
          </tr>`;
        }).join('');
        historyTbody.querySelectorAll('[data-act="ed"]').forEach((btn) => {
          btn.addEventListener('click', () => openEditAdsWeek(btn.dataset.ws, btn.dataset.am, btn.dataset.wi));
        });
        historyTbody.querySelectorAll('[data-act="rm"]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!confirm('Remover ' + BRL.format(Number(btn.dataset.am)) + ' em Ads da semana ' + btn.dataset.wi + '?')) return;
            try {
              const r = await fetch('/api/ads-week?week_start_date=' + encodeURIComponent(btn.dataset.ws), { method: 'DELETE' });
              if (!r.ok && r.status !== 204) {
                const err = await r.json().catch(() => ({}));
                window.toast('Erro: ' + (err.error || ('HTTP ' + r.status)));
                return;
              }
              window.location.reload();
            } catch (err) { window.toast('Erro: ' + err.message); }
          });
        });
      } catch (err) {
        historyTbody.innerHTML = '<tr><td colspan="5" class="muted center">Erro ao carregar histórico: ' + err.message + '</td></tr>';
      }
    })();
  }
})();
