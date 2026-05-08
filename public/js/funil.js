(function () {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const SAVE_DEBOUNCE_MS = 800;

  let saveTimer = null;
  let inFlight = false;
  let pendingAfter = false;
  const saveStatus = document.getElementById('save-status');
  const saveBtn = document.getElementById('save-funnel');
  if (saveBtn) saveBtn.dataset.label = saveBtn.textContent.trim();

  function num(id) { const el = document.getElementById(id); return el ? Number(el.value) || 0 : 0; }

  function readSDRsRows() {
    return Array.from(document.querySelectorAll('#sdrs-table tr[data-member-id]')).map((row) => ({
      id: Number(row.dataset.memberId),
      role: 'sdr',
      capacity_per_week: Number(row.querySelector('[data-perf="capacity_per_week"]').value) || 0,
      conversion_pct: Number(row.querySelector('[data-perf="conversion_pct"]').value) || 0,
    }));
  }
  function readClosersRows() {
    return Array.from(document.querySelectorAll('#closers-table tr[data-member-id]')).map((row) => ({
      id: Number(row.dataset.memberId),
      role: 'closer',
      capacity_per_week: 0,
      conversion_pct: Number(row.querySelector('[data-perf="conversion_pct"]').value) || 0,
    }));
  }

  function recompute() {
    const ads = num('ads_per_week');
    const cpl = num('cpl');
    const rebarba = num('rebarba_sb_per_week');
    const ticket = num('ticket_avg');
    const taxa = num('payment_tax_pct');
    const forecastBonus = num('forecast_bonus_pct');

    const sdrs = readSDRsRows();
    const closers = readClosersRows();

    const leads = cpl > 0 ? Math.floor(ads / cpl) : 0;
    const totalAgendadas = sdrs.reduce((acc, s) => acc + s.capacity_per_week, 0) + rebarba;

    let realizadasFromSDRs = 0;
    for (const s of sdrs) realizadasFromSDRs += s.capacity_per_week * (s.conversion_pct / 100);
    const avgSdrShow = sdrs.length > 0 ? sdrs.reduce((a, s) => a + s.conversion_pct, 0) / sdrs.length : 70;
    const realizadasFromRebarba = rebarba * (avgSdrShow / 100);
    const callsRealizadas = realizadasFromSDRs + realizadasFromRebarba;

    const avgCloser = closers.length > 0 ? closers.reduce((a, c) => a + c.conversion_pct, 0) / closers.length : 25;
    const vendasCall = Math.floor(callsRealizadas * (avgCloser / 100));
    const vendasForecast = Math.floor(callsRealizadas * (forecastBonus / 100));
    const vendasTotais = vendasCall + vendasForecast;
    const receitaBruta = vendasTotais * ticket;
    const receitaLiquida = receitaBruta * (1 - taxa / 100);

    document.getElementById('leads_gerados').textContent = String(leads);
    document.getElementById('calls_agendadas').textContent = String(Math.floor(totalAgendadas));
    document.getElementById('calls_realizadas').textContent = String(Math.floor(callsRealizadas));
    document.getElementById('vendas_call').textContent = String(vendasCall);
    document.getElementById('vendas_forecast').textContent = '+' + vendasForecast;
    document.getElementById('receita_bruta').textContent = BRL.format(receitaBruta);
    document.getElementById('receita_liquida').textContent = BRL.format(receitaLiquida);
  }

  function buildPayload() {
    const sdrs = readSDRsRows();
    const closers = readClosersRows();
    return {
      ads_per_week: num('ads_per_week'),
      cpl: num('cpl'),
      rebarba_sb_per_week: num('rebarba_sb_per_week'),
      forecast_bonus_pct: num('forecast_bonus_pct'),
      ticket_avg: num('ticket_avg'),
      payment_tax_pct: num('payment_tax_pct'),
      show_rate_pct: sdrs.length > 0 ? sdrs.reduce((a, s) => a + s.conversion_pct, 0) / sdrs.length : 70,
      call_to_sale_pct: closers.length > 0 ? closers.reduce((a, c) => a + c.conversion_pct, 0) / closers.length : 25,
      team_performance: [...sdrs, ...closers].map((p) => ({
        team_member_id: p.id,
        capacity_per_week: p.capacity_per_week,
        conversion_pct: p.conversion_pct,
      })),
    };
  }

  function setStatus(state, text) {
    if (!saveStatus) return;
    saveStatus.dataset.state = state;
    saveStatus.textContent = text;
  }

  function pad2(n) { return ('0' + n).slice(-2); }
  function nowHHMM() {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  async function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (inFlight) { pendingAfter = true; return; }
    inFlight = true;
    setStatus('saving', 'salvando…');
    try {
      const res = await fetch('/api/funnel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus('error', 'erro: ' + (err.error || ('HTTP ' + res.status)));
        return;
      }
      setStatus('saved', 'salvo às ' + nowHHMM());
    } catch (err) {
      setStatus('error', 'erro: ' + err.message);
    } finally {
      inFlight = false;
      if (pendingAfter) { pendingAfter = false; flushSave(); }
    }
  }

  function scheduleSave() {
    setStatus('pending', 'alterações pendentes…');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; flushSave(); }, SAVE_DEBOUNCE_MS);
  }

  document.addEventListener('input', (e) => {
    if (e.target.matches('input[type="number"]')) {
      recompute();
      scheduleSave();
    }
  });

  recompute();

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      await flushSave();
      saveBtn.disabled = false;
    });
  }

  const modal = document.getElementById('modal-add-member');
  const modalForm = document.getElementById('form-add-member');
  const modalTitle = document.getElementById('modal-add-title');

  document.querySelectorAll('[data-add-member]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = btn.dataset.role;
      modalForm.elements.role.value = role;
      modalForm.elements.name.value = '';
      modalTitle.textContent = role === 'sdr' ? 'Adicionar SDR' : 'Adicionar Closer';
      modal.showModal();
    });
  });
  modal.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => modal.close());
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function appendMemberRow(member) {
    const isSdr = member.role === 'sdr';
    const tableId = isSdr ? 'sdrs-table' : 'closers-table';
    const tbody = document.querySelector('#' + tableId + ' tbody');
    const emptyCell = tbody.querySelector('td[colspan]');
    if (emptyCell) emptyCell.closest('tr').remove();

    const tr = document.createElement('tr');
    tr.dataset.memberId = String(member.id);
    tr.dataset.role = member.role;
    if (isSdr) {
      tr.innerHTML =
        '<td>' + escapeHtml(member.name) + '</td>' +
        '<td class="num"><input type="number" min="0" step="1" value="0" data-perf="capacity_per_week" /></td>' +
        '<td class="num"><input type="number" min="0" max="100" step="1" value="70" data-perf="conversion_pct" /></td>' +
        '<td><button type="button" class="btn-link danger" data-remove-member data-id="' + member.id + '">remover</button></td>';
    } else {
      tr.innerHTML =
        '<td>' + escapeHtml(member.name) + '</td>' +
        '<td class="num"><input type="number" min="0" max="100" step="1" value="25" data-perf="conversion_pct" /></td>' +
        '<td><button type="button" class="btn-link danger" data-remove-member data-id="' + member.id + '">remover</button></td>';
    }
    tbody.appendChild(tr);
    bindRemoveButton(tr.querySelector('[data-remove-member]'));
    const firstInput = tr.querySelector('input[type="number"]');
    if (firstInput) firstInput.focus();
  }

  function ensureEmptyRowIfNeeded(role) {
    const tableId = role === 'sdr' ? 'sdrs-table' : 'closers-table';
    const tbody = document.querySelector('#' + tableId + ' tbody');
    if (tbody.querySelector('tr[data-member-id]')) return;
    const colspan = role === 'sdr' ? 4 : 3;
    const text = role === 'sdr' ? 'Nenhum SDR ativo. Adicione acima.' : 'Nenhum Closer ativo. Adicione acima.';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="' + colspan + '" class="muted center">' + text + '</td>';
    tbody.appendChild(tr);
  }

  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(modalForm));
    const submitBtn = modalForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, role: data.role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
        return;
      }
      const created = await res.json();
      appendMemberRow(created);
      modal.close();
      recompute();
      scheduleSave();
    } catch (err) {
      window.toast('Erro: ' + err.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  function bindRemoveButton(btn) {
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const row = btn.closest('tr');
      const role = row ? row.dataset.role : null;
      if (!window.confirm('Remover esta pessoa do time?')) return;
      try {
        const res = await fetch('/api/team/' + id, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        if (row) row.remove();
        if (role) ensureEmptyRowIfNeeded(role);
        recompute();
        scheduleSave();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      }
    });
  }

  document.querySelectorAll('[data-remove-member]').forEach(bindRemoveButton);
})();
