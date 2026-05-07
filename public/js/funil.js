(function () {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    for (const s of sdrs) {
      realizadasFromSDRs += s.capacity_per_week * (s.conversion_pct / 100);
    }
    const avgSdrShow = sdrs.length > 0
      ? sdrs.reduce((a, s) => a + s.conversion_pct, 0) / sdrs.length
      : 70;
    const realizadasFromRebarba = rebarba * (avgSdrShow / 100);
    const callsRealizadas = realizadasFromSDRs + realizadasFromRebarba;

    const avgCloser = closers.length > 0
      ? closers.reduce((a, c) => a + c.conversion_pct, 0) / closers.length
      : 25;

    const vendasCall = Math.floor(callsRealizadas * (avgCloser / 100));
    const vendasForecast = Math.floor(callsRealizadas * (forecastBonus / 100));
    const receitaBruta = vendasCall * ticket;
    const receitaLiquida = receitaBruta * (1 - taxa / 100);

    document.getElementById('leads_gerados').textContent = String(leads);
    document.getElementById('calls_agendadas').textContent = String(Math.floor(totalAgendadas));
    document.getElementById('calls_realizadas').textContent = String(Math.floor(callsRealizadas));
    document.getElementById('vendas_call').textContent = String(vendasCall);
    document.getElementById('vendas_forecast').textContent = '+' + vendasForecast;
    document.getElementById('receita_bruta').textContent = BRL.format(receitaBruta);
    document.getElementById('receita_liquida').textContent = BRL.format(receitaLiquida);
  }

  document.addEventListener('input', (e) => {
    if (e.target.matches('input[type="number"]')) recompute();
  });

  recompute();

  document.getElementById('save-funnel').addEventListener('click', async () => {
    const sdrs = readSDRsRows();
    const closers = readClosersRows();
    const payload = {
      ads_per_week: num('ads_per_week'),
      cpl: num('cpl'),
      rebarba_sb_per_week: num('rebarba_sb_per_week'),
      forecast_bonus_pct: num('forecast_bonus_pct'),
      ticket_avg: num('ticket_avg'),
      payment_tax_pct: num('payment_tax_pct'),
      show_rate_pct: sdrs.length > 0
        ? sdrs.reduce((a, s) => a + s.conversion_pct, 0) / sdrs.length
        : 70,
      call_to_sale_pct: closers.length > 0
        ? closers.reduce((a, c) => a + c.conversion_pct, 0) / closers.length
        : 25,
      team_performance: [...sdrs, ...closers].map((p) => ({
        team_member_id: p.id,
        capacity_per_week: p.capacity_per_week,
        conversion_pct: p.conversion_pct,
      })),
    };
    const btn = document.getElementById('save-funnel');
    btn.disabled = true;
    try {
      const res = await fetch('/api/funnel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Erro: ' + (err.error || ('HTTP ' + res.status)));
        return;
      }
      btn.textContent = '✔ Salvo';
      setTimeout(() => { btn.textContent = btn.dataset.label || btn.textContent; }, 1200);
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });

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

  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(modalForm));
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, role: data.role }),
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

  document.querySelectorAll('[data-remove-member]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!window.confirm('Remover esta pessoa do time?')) return;
      try {
        const res = await fetch('/api/team/' + id, { method: 'DELETE' });
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
  });
})();
