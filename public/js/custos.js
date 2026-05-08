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

  // === Modal "Todos os custos futuros" ===
  const futurosDlg = document.getElementById('modal-todos-futuros');
  if (futurosDlg) {
    const tbody = document.getElementById('future-tbody');
    const filterStatus = document.getElementById('future-filter-status');
    const filterCat = document.getElementById('future-filter-category');
    const filterScen = document.getElementById('future-filter-scenario');
    const filterSearch = document.getElementById('future-filter-search');
    const summary = document.getElementById('future-summary');
    let allCosts = [];
    let loaded = false;

    function todayYmd() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + dd;
    }

    function fmtDate(ymd) {
      if (!ymd) return '';
      const [y, m, d] = ymd.split('-');
      return d + '/' + m + '/' + y.slice(2);
    }

    function scenarioName(id) {
      if (id == null) return '—';
      const opt = filterScen.querySelector('option[value="' + id + '"]');
      return opt ? opt.textContent : '#' + id;
    }

    async function loadAll() {
      tbody.innerHTML = '<tr><td colspan="7" class="muted center">Carregando…</td></tr>';
      try {
        const res = await fetch('/api/costs?from=' + todayYmd() + '&to=2030-12-31');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        allCosts = await res.json();
        // categorias unicas
        const cats = [...new Set(allCosts.map((c) => c.category))].sort();
        filterCat.innerHTML = '<option value="">Todas</option>' +
          cats.map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>').join('');
        loaded = true;
        render();
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="muted center">Erro: ' + err.message + '</td></tr>';
      }
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function render() {
      if (!loaded) return;
      const status = filterStatus.value;
      const cat = filterCat.value;
      const scen = filterScen.value;
      const q = (filterSearch.value || '').trim().toLowerCase();
      let rows = allCosts.slice();
      if (status !== 'all') rows = rows.filter((c) => c.status === status);
      if (cat) rows = rows.filter((c) => c.category === cat);
      if (scen === 'null') rows = rows.filter((c) => c.scenario_id == null);
      else if (scen) rows = rows.filter((c) => String(c.scenario_id) === scen);
      if (q) rows = rows.filter((c) =>
        (c.category || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
      rows.sort((a, b) => a.date.localeCompare(b.date));

      const total = rows.reduce((acc, c) => acc + Number(c.amount || 0), 0);
      summary.textContent = rows.length + ' custos · ' + BRL.format(total);

      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="muted center">Nenhum custo encontrado com esses filtros.</td></tr>';
        return;
      }
      const canEdit = window.PERMS && window.PERMS.edit_cost === true;
      const canDelete = window.PERMS && window.PERMS.delete_cost === true;
      tbody.innerHTML = rows.map((c) => {
        const isAds = Number(c.is_ads) === 1;
        const statusBadge = c.status === 'paid'
          ? '<span class="badge action-create">PAGO</span>'
          : '<span class="badge action-update">A PAGAR</span>';
        const actions = [
          canEdit ? '<button type="button" class="btn-link" data-act="ed" data-id="' + c.id + '">editar</button>' : '',
          canEdit && c.status === 'planned' ? '<button type="button" class="btn-link pos" data-act="pay" data-id="' + c.id + '">marcar pago</button>' : '',
          canDelete ? '<button type="button" class="btn-link danger" data-act="rm" data-id="' + c.id + '">excluir</button>' : '',
        ].filter(Boolean).join(' ');
        return '<tr data-id="' + c.id + '">' +
          '<td>' + fmtDate(c.date) + '</td>' +
          '<td>' + escapeHtml(c.category) + (isAds ? ' <span class="badge action-update">ADS</span>' : '') + '</td>' +
          '<td class="muted">' + escapeHtml(c.description || '') + '</td>' +
          '<td class="num money">' + BRL.format(c.amount) + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td class="muted">' + escapeHtml(scenarioName(c.scenario_id)) + '</td>' +
          '<td>' + (actions || '<span class="muted">—</span>') + '</td>' +
          '</tr>';
      }).join('');

      tbody.querySelectorAll('[data-act="ed"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const c = allCosts.find((x) => x.id === id);
          if (!c) return;
          const dlg = document.getElementById('modal-edit-cost');
          const form = dlg.querySelector('form');
          form.dataset.endpoint = '/api/costs/' + c.id;
          loadIntoForm(form, c, ['date', 'amount', 'category', 'description', 'status']);
          futurosDlg.close();
          dlg.showModal();
        });
      });
      tbody.querySelectorAll('[data-act="pay"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.dataset.id);
          const c = allCosts.find((x) => x.id === id);
          if (!c) return;
          const newDate = prompt('Data do pagamento (YYYY-MM-DD)?', todayYmd());
          if (!newDate) return;
          try {
            const res = await fetch('/api/costs/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'paid', date: newDate }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
              return;
            }
            await loadAll();
            window.toast('Custo marcado como pago ✓');
          } catch (err) { window.toast('Erro: ' + err.message); }
        });
      });
      tbody.querySelectorAll('[data-act="rm"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este custo? Esta ação não pode ser desfeita.')) return;
          const id = Number(btn.dataset.id);
          try {
            const res = await fetch('/api/costs/' + id, { method: 'DELETE' });
            if (!res.ok && res.status !== 204) {
              const err = await res.json().catch(() => ({}));
              window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
              return;
            }
            allCosts = allCosts.filter((x) => x.id !== id);
            render();
            window.toast('Custo excluído');
          } catch (err) { window.toast('Erro: ' + err.message); }
        });
      });
    }

    [filterStatus, filterCat, filterScen].forEach((el) => el && el.addEventListener('change', render));
    if (filterSearch) filterSearch.addEventListener('input', render);

    futurosDlg.addEventListener('close', () => { /* nothing */ });
    // Trigger reload toda vez que abre (pra refletir mudanças feitas em outras telas)
    const triggerBtns = document.querySelectorAll('[data-modal="todos-futuros"]');
    triggerBtns.forEach((b) => b.addEventListener('click', () => { loadAll(); }));
  }

  function loadIntoForm(form, payload, fields) {
    for (const k of fields) {
      const el = form.elements[k];
      if (!el) continue;
      el.value = payload[k] == null ? '' : payload[k];
    }
  }

  function todayYmdGlobal() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDateShort(ymd) {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    return d + '/' + m + '/' + y.slice(2);
  }
  function escapeHtmlGlobal(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // === Modal Marcar como pago ===
  const markPaidDlg = document.getElementById('modal-mark-paid');
  if (markPaidDlg) {
    const form = document.getElementById('form-mark-paid');
    const listEl = document.getElementById('mark-paid-list');
    const summaryEl = document.getElementById('mark-paid-summary');
    let pendingCosts = [];

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action="mark-paid"]');
      if (!btn) return;
      e.preventDefault();
      const category = btn.dataset.category;
      const group = btn.dataset.group;
      const fromDate = btn.dataset.weekStart;
      const toDate = btn.dataset.weekEnd;

      summaryEl.textContent = `${category} · ${group} · carregando…`;
      listEl.innerHTML = '<p class="muted center" style="padding: 24px;">Carregando custos…</p>';
      form.elements.paid_date.value = todayYmdGlobal();
      markPaidDlg.showModal();

      const params = new URLSearchParams({ from: fromDate, to: toDate, status: 'planned' });
      try {
        const res = await fetch('/api/costs?' + params);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const all = await res.json();
        pendingCosts = all.filter((c) => c.category === category && Number(c.is_ads || 0) === 0);
      } catch (err) {
        listEl.innerHTML = '<p class="muted center" style="padding: 24px;">Erro: ' + escapeHtmlGlobal(err.message) + '</p>';
        return;
      }

      summaryEl.textContent = `${category} · ${group} · ${pendingCosts.length} custo(s) pendente(s)`;
      if (pendingCosts.length === 0) {
        listEl.innerHTML = '<p class="muted center" style="padding: 24px;">Nenhum custo pendente nesta semana.</p>';
        return;
      }
      listEl.innerHTML = pendingCosts.map((c) => `
        <label class="mark-paid-item">
          <input type="checkbox" name="cost_${c.id}" value="${c.id}" checked />
          <span class="mark-paid-item-date">${fmtDateShort(c.date)}</span>
          <span class="mark-paid-item-desc">${escapeHtmlGlobal(c.description || '—')}</span>
          <span class="mark-paid-item-amount">${BRL.format(Number(c.amount))}</span>
        </label>
      `).join('');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const paidDate = form.elements.paid_date.value;
      const checked = [...listEl.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => Number(cb.value));
      if (checked.length === 0) { window.toast('Selecione ao menos 1 custo'); return; }
      if (!paidDate) { window.toast('Informe a data'); return; }

      const btn = document.getElementById('btn-confirm-paid');
      btn.dataset.loading = '1';
      btn.disabled = true;
      try {
        await Promise.all(checked.map((id) =>
          fetch('/api/costs/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paid', date: paidDate }),
          }).then((r) => { if (!r.ok) throw new Error('Falha em #' + id); })
        ));
        window.toast(checked.length + ' custo(s) marcados como pagos ✓');
        markPaidDlg.close();
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        window.toast('Erro: ' + err.message);
      } finally {
        delete btn.dataset.loading;
        btn.disabled = false;
      }
    });
  }

  // === Receivables filter chips ===
  (function setupReceivablesFilters() {
    const chips = document.querySelectorAll('.receivables-filters .filter-chip');
    const rows = document.querySelectorAll('.receivables-table tbody tr');
    if (!chips.length || !rows.length) return;

    function todayYmdLocal() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function matchesFilter(date, filter) {
      if (filter === 'all') return true;
      const today = todayYmdLocal();
      if (filter === 'overdue') return date < today;
      const days = Math.round((Date.parse(date + 'T00:00:00') - Date.parse(today + 'T00:00:00')) / 86400000);
      if (filter === 'this-week') return days >= 0 && days <= 6;
      if (filter === 'next-7') return days >= 0 && days <= 7;
      if (filter === 'next-30') return days >= 0 && days <= 30;
      if (filter === 'next-60') return days >= 0 && days <= 60;
      return true;
    }

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        const filter = chip.dataset.filter;
        rows.forEach((row) => {
          if (!row.dataset.expectedDate) return;
          row.style.display = matchesFilter(row.dataset.expectedDate, filter) ? '' : 'none';
        });
      });
    });
  })();

  // === Reverter para 'a pagar' ===
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="revert-paid"]');
    if (!btn) return;
    e.preventDefault();
    const category = btn.dataset.category;
    const fromDate = btn.dataset.weekStart;
    const toDate = btn.dataset.weekEnd;
    const params = new URLSearchParams({ from: fromDate, to: toDate, status: 'paid' });
    let paidCosts = [];
    try {
      const res = await fetch('/api/costs?' + params);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const all = await res.json();
      paidCosts = all.filter((c) => c.category === category && Number(c.is_ads || 0) === 0);
    } catch (err) {
      window.toast('Erro: ' + err.message);
      return;
    }
    if (paidCosts.length === 0) { window.toast('Nenhum custo pago nessa célula'); return; }
    if (!confirm('Reverter ' + paidCosts.length + ' custo(s) de "pago" para "a pagar"?')) return;
    try {
      await Promise.all(paidCosts.map((c) =>
        fetch('/api/costs/' + c.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'planned' }),
        }).then((r) => { if (!r.ok) throw new Error('Falha em #' + c.id); })
      ));
      window.toast(paidCosts.length + ' custo(s) revertidos');
      setTimeout(() => location.reload(), 500);
    } catch (err) {
      window.toast('Erro: ' + err.message);
    }
  });
})();
