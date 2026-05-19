(function () {
  const bootstrap = window.FUNNEL_BOOTSTRAP || null;
  const init = window.FUNNEL_EVOLUTIVE_INIT || null;

  // === Event delegation no document (sempre roda, modo evolutivo ou estático) ===
  // Robusto contra qualquer race condition de DOM ready / ordem de script.
  document.addEventListener('click', async (ev) => {
    const enableBtn = ev.target.closest('#btn-enable-evolutive');
    const disableBtn = ev.target.closest('#btn-disable-evolutive');
    if (!enableBtn && !disableBtn) return;
    ev.preventDefault();

    if (enableBtn) {
      const sel = document.getElementById('weeks-count');
      const weeks = sel ? Number(sel.value) || 12 : 12;
      const scenarioId = enableBtn.dataset.scenarioId || (bootstrap && bootstrap.scenarioId);
      if (!scenarioId) {
        const msg = 'Erro: cenário não identificado';
        if (window.toast) window.toast(msg); else alert(msg);
        return;
      }
      if (enableBtn.disabled) return;
      enableBtn.disabled = true;
      try {
        const res = await fetch('/api/funnel/evolutive/' + scenarioId + '/enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weeks }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = 'Erro: ' + (err.error || ('HTTP ' + res.status));
          if (window.toast) window.toast(msg); else alert(msg);
          enableBtn.disabled = false;
          return;
        }
        if (window.toast) window.toast('Modo evolutivo ativado · ' + weeks + ' semanas ✓');
        setTimeout(() => location.reload(), 400);
      } catch (err) {
        const msg = 'Erro: ' + err.message;
        if (window.toast) window.toast(msg); else alert(msg);
        enableBtn.disabled = false;
      }
      return;
    }

    if (disableBtn) {
      const scenarioId = disableBtn.dataset.scenarioId || (bootstrap && bootstrap.scenarioId);
      if (!scenarioId) return;
      if (!confirm('Voltar ao modo estático? A timeline configurada é preservada e volta a aparecer se você reativar.')) return;
      if (disableBtn.disabled) return;
      disableBtn.disabled = true;
      try {
        const res = await fetch('/api/funnel/evolutive/' + scenarioId + '/disable', { method: 'POST' });
        if (!res.ok) {
          const msg = 'Erro ao voltar ao modo estático';
          if (window.toast) window.toast(msg); else alert(msg);
          disableBtn.disabled = false;
          return;
        }
        if (window.toast) window.toast('Voltou ao modo estático');
        setTimeout(() => location.reload(), 400);
      } catch (err) {
        const msg = 'Erro: ' + err.message;
        if (window.toast) window.toast(msg); else alert(msg);
        disableBtn.disabled = false;
      }
    }
  });

  // Se não estamos em modo evolutivo, não há timeline pra inicializar — sai aqui.
  if (!init) return;

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const SAVE_DEBOUNCE_MS = 1500;

  const tableEl = document.getElementById('funnel-timeline');
  if (!tableEl) return;
  const scenarioId = init.scenarioId;
  const weeksCount = init.weeksCount;
  const teamRoster = init.team || [];

  const statusEl = document.getElementById('evo-save-status');
  const saveBtn = document.getElementById('btn-save-timeline');
  const startDateInput = document.getElementById('evolutive-start-date');
  const resetStartBtn = document.getElementById('btn-reset-start-date');
  let saveTimer = null;
  let inFlight = false;
  let pendingAfter = false;

  async function persistStartDate(value) {
    try {
      const res = await fetch('/api/funnel/evolutive/' + scenarioId + '/start-date', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: value || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (window.toast) window.toast('Erro ao salvar semana inicial: ' + (err.error || res.status));
        return;
      }
      if (window.toast) window.toast(value ? '✓ Semana inicial salva: ' + value : '✓ Semana inicial: automático');
    } catch (e) {
      if (window.toast) window.toast('Erro: ' + e.message);
    }
  }

  if (startDateInput) {
    startDateInput.addEventListener('change', () => {
      persistStartDate(startDateInput.value);
    });
  }
  if (resetStartBtn) {
    resetStartBtn.addEventListener('click', async () => {
      if (startDateInput) startDateInput.value = '';
      await persistStartDate(null);
    });
  }

  function pad2(n) { return ('0' + n).slice(-2); }
  function nowHHMM() {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function setStatus(state, text) {
    if (!statusEl) return;
    statusEl.dataset.state = state;
    statusEl.textContent = text;
  }

  function readWeekRow(weekIndex) {
    const row = {
      week_index: weekIndex,
      ads_per_week: 0, cpl: 0, rebarba_sb_per_week: 0,
      show_rate_pct: 0, call_to_sale_pct: 0, forecast_bonus_pct: 0,
      ticket_avg: 0, payment_tax_pct: 0,
    };
    tableEl.querySelectorAll('input[data-week="' + weekIndex + '"][data-param]').forEach((inp) => {
      row[inp.dataset.param] = Number(inp.value) || 0;
    });
    return row;
  }

  function readAllWeekly() {
    const out = [];
    for (let i = 1; i <= weeksCount; i++) out.push(readWeekRow(i));
    return out;
  }

  function readTeamWeek(memberId, weekIndex) {
    const cell = tableEl.querySelector('tr[data-member-id="' + memberId + '"] td[data-week="' + weekIndex + '"]');
    if (!cell) return null;
    const cap = cell.querySelector('input[data-team-week="capacity"]');
    const conv = cell.querySelector('input[data-team-week="conversion"]');
    const active = cell.querySelector('input[data-team-week="active"]');
    return {
      team_member_id: memberId,
      week_index: weekIndex,
      capacity_per_week: cap ? (Number(cap.value) || 0) : 0,
      conversion_pct: conv ? (Number(conv.value) || 0) : 0,
      active: active ? (Number(active.value) === 1 ? 1 : 0) : 1,
    };
  }

  function readAllTeamWeekly() {
    const out = [];
    for (const m of teamRoster) {
      for (let i = 1; i <= weeksCount; i++) {
        const t = readTeamWeek(m.id, i);
        if (t) out.push(t);
      }
    }
    return out;
  }

  function teamForWeek(weekIndex) {
    return teamRoster.map((m) => {
      const t = readTeamWeek(m.id, weekIndex);
      return t ? { ...t, role: m.role } : { team_member_id: m.id, week_index: weekIndex, capacity_per_week: 0, conversion_pct: 0, active: 1, role: m.role };
    });
  }

  function computeWeekProjection(week, teamThisWeek) {
    const activeSdrs = teamThisWeek.filter((t) => t.role === 'sdr' && t.active === 1);
    const activeClosers = teamThisWeek.filter((t) => t.role === 'closer' && t.active === 1);

    const totalSdrCapacity = activeSdrs.reduce((acc, t) => acc + Number(t.capacity_per_week || 0), 0);
    const avgShowRate = activeSdrs.length > 0
      ? activeSdrs.reduce((acc, t) => acc + Number(t.conversion_pct || 0), 0) / activeSdrs.length
      : (Number(week.show_rate_pct) || 0);

    const leads = (Number(week.cpl) || 0) > 0 ? (Number(week.ads_per_week) || 0) / Number(week.cpl) : 0;
    const totalLeads = leads + Number(week.rebarba_sb_per_week || 0);
    const callsAgendadas = activeSdrs.length > 0 ? Math.min(totalLeads, totalSdrCapacity) : totalLeads;
    const realizedFromCapacity = activeSdrs.reduce((acc, t) => acc + Number(t.capacity_per_week || 0) * (Number(t.conversion_pct || 0) / 100), 0);
    const callsRealizadas = activeSdrs.length > 0
      ? realizedFromCapacity + Number(week.rebarba_sb_per_week || 0) * (avgShowRate / 100)
      : callsAgendadas * (avgShowRate / 100);

    const avgConv = activeClosers.length > 0
      ? activeClosers.reduce((acc, t) => acc + Number(t.conversion_pct || 0), 0) / activeClosers.length
      : (Number(week.call_to_sale_pct) || 0);

    const vendasCall = Math.floor(callsRealizadas * (avgConv / 100));
    const vendasForecast = Math.floor(callsRealizadas * ((Number(week.forecast_bonus_pct) || 0) / 100));
    const vendasTotal = vendasCall + vendasForecast;
    const receitaBruta = vendasTotal * (Number(week.ticket_avg) || 0);
    const receitaLiquida = receitaBruta * (1 - (Number(week.payment_tax_pct) || 0) / 100);

    return { receitaBruta, receitaLiquida, vendasTotal, callsAgendadas, callsRealizadas };
  }

  function recompute() {
    for (let i = 1; i <= weeksCount; i++) {
      const week = readWeekRow(i);
      const tp = teamForWeek(i);
      const proj = computeWeekProjection(week, tp);
      const cellLiq = tableEl.querySelector('tr.result-row[data-result="receita_liquida"] td[data-week="' + i + '"]');
      if (cellLiq) cellLiq.textContent = BRL.format(proj.receitaLiquida);
      const cellReu = tableEl.querySelector('tr.result-row[data-result="reunioes_realizadas"] td[data-week="' + i + '"]');
      if (cellReu) cellReu.textContent = String(Math.floor(Number(proj.callsRealizadas) || 0));
    }
  }

  async function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (inFlight) { pendingAfter = true; return; }
    inFlight = true;
    setStatus('saving', 'salvando…');
    try {
      const body = { funnel_weekly: readAllWeekly(), team_weekly: readAllTeamWeekly() };
      const res = await fetch('/api/funnel/evolutive/' + scenarioId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  tableEl.addEventListener('input', (e) => {
    if (e.target.matches('input[type="number"]')) {
      recompute();
      scheduleSave();
    }
  });

  tableEl.addEventListener('click', (e) => {
    const tog = e.target.closest('[data-toggle-active]');
    if (!tog) return;
    const cell = tog.closest('td.week-cell');
    if (!cell) return;
    const hidden = cell.querySelector('input[data-team-week="active"]');
    const isActive = hidden && Number(hidden.value) === 1;
    if (hidden) hidden.value = isActive ? '0' : '1';
    cell.classList.toggle('inactive', isActive);
    tog.classList.toggle('is-active', !isActive);
    recompute();
    scheduleSave();
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      await flushSave();
      saveBtn.disabled = false;
    });
  }

  // === Apply curve (depende de timeline existir) ===
  const applyCurveBtn = document.getElementById('btn-apply-curve');
  if (applyCurveBtn) {
    applyCurveBtn.addEventListener('click', () => {
      const dlg = document.getElementById('modal-apply-curve');
      if (dlg) dlg.showModal();
    });
  }
  const curveDlg = document.getElementById('modal-apply-curve');
  if (curveDlg) {
    curveDlg.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', () => curveDlg.close()));
    const curveForm = document.getElementById('form-apply-curve');
    curveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(curveForm));
      try {
        const res = await fetch('/api/funnel/evolutive/' + scenarioId + '/apply-curve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plateau_week: Number(data.plateau_week) || 0,
            growth: {
              ads_pct: Number(data.ads_pct) || 0,
              cpl_pct: Number(data.cpl_pct) || 0,
              show_rate_pp: Number(data.show_rate_pp) || 0,
              conv_pp: Number(data.conv_pp) || 0,
            },
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.toast('Curva aplicada ✓');
        curveDlg.close();
        setTimeout(() => location.reload(), 400);
      } catch (err) {
        window.toast('Erro: ' + err.message);
      }
    });
  }

  // initial
  recompute();
  setStatus('idle', 'salvo');
})();
