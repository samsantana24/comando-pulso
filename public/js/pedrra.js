(function () {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  function formatBrlSmart(value) {
    return Math.abs(value) >= 100000
      ? BRL_COMPACT.format(value)
      : BRL.format(value);
  }

  function animateCountUp(element, finalValue, duration = 800) {
    const start = 0;
    const startTime = performance.now();
    const isCurrency = element.dataset.format === 'brl';
    const useCompact = element.dataset.compact === '1';
    const formatter = useCompact
      ? formatBrlSmart
      : (isCurrency ? (v) => BRL.format(v) : (v) => Math.round(v).toString());
    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (finalValue - start) * eased;
      element.textContent = formatter(current);
      if (progress < 1) requestAnimationFrame(frame);
      else element.textContent = formatter(finalValue);
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('.kpi-card-value[data-final-value]').forEach((el) => {
    const v = Number(el.dataset.finalValue) || 0;
    animateCountUp(el, v);
  });

  const initial = window.PEDRRA_INITIAL;
  const ctx = document.getElementById('cashflow-chart').getContext('2d');
  let chart = null;
  let cashAtStart = initial.cashAtStart;
  let projection = cloneSeries(initial.series);
  let extraScenarios = []; // [{ id, name, color, series: [...] }]

  const scenarioColor = (initial.activeScenario && initial.activeScenario.color) || '#2DD4BF';
  const scenarioName = (initial.activeScenario && initial.activeScenario.name) || 'sem cenário';

  function cloneSeries(arr) { return arr.map((s) => ({ ...s })); }

  function recompute(seriesRef = projection, startCash = cashAtStart) {
    const includeReceivables = !!initial.includeReceivablesInProjection;
    let cum = startCash;
    for (const w of seriesRef) {
      let delta;
      if (w.is_past || w.is_current) {
        delta = Number(w.sales_real || 0) - Number(w.costs_paid || 0) - Number(w.ads_paid || 0);
      } else {
        const recvContrib = includeReceivables ? Number(w.receivables_projected || 0) : 0;
        delta = Number(w.sales_projected || 0) + recvContrib - Number(w.costs_planned || 0) - Number(w.ads_planned || 0);
      }
      w.week_delta = delta;
      cum += delta;
      w.cash_after = cum;
    }
  }

  function buildLabelsAndData() {
    const labels = projection.map((w) => w.label);
    const realCash = projection.map((w) => (w.is_past || w.is_current) ? w.cash_after : null);
    const projCash = projection.map((w) => (w.is_future || w.is_current) ? w.cash_after : null);
    const costsBars = projection.map((w) =>
      (w.is_past || w.is_current) ? Number(w.costs_paid || 0) : Number(w.costs_planned || 0)
    );
    const adsBars = projection.map((w) =>
      (w.is_past || w.is_current) ? Number(w.ads_paid || 0) : Number(w.ads_planned || 0)
    );
    const todayIdx = projection.findIndex((w) => w.is_current);
    return { labels, realCash, projCash, costsBars, adsBars, todayIdx };
  }

  function buildExtraScenarioDatasets() {
    return extraScenarios.map((s) => ({
      label: 'Caixa proj. · ' + s.name,
      data: s.series.map((w) => (w.is_future || w.is_current) ? w.cash_after : null),
      borderColor: s.color,
      borderDash: [3, 3],
      backgroundColor: 'transparent',
      tension: 0.18,
      spanGaps: true,
      pointRadius: 3,
      borderWidth: 1.5,
      yAxisID: 'y',
    }));
  }

  const CHART_COLORS = {
    cash:        '#FF2E5A',
    cashFill:    'rgba(255, 46, 90, 0.08)',
    costs:       'rgba(255, 46, 90, 0.40)',
    costsBorder: 'rgba(255, 46, 90, 0.65)',
    ads:         'rgba(255, 165, 0, 0.45)',
    adsBorder:   'rgba(255, 165, 0, 0.75)',
    grid:        'rgba(255, 255, 255, 0.04)',
    axis:        '#5A5A5A',
    axisLabel:   '#8A8A8A',
  };

  function formatBrlCompact(v) {
    if (Math.abs(v) >= 1000000) return 'R$ ' + (v / 1000000).toFixed(1) + 'M';
    if (Math.abs(v) >= 1000) return 'R$ ' + Math.round(v / 1000) + 'k';
    return 'R$ ' + Math.round(v);
  }

  function render() {
    const { labels, realCash, projCash, costsBars, adsBars, todayIdx } = buildLabelsAndData();

    const todayMarkerPlugin = {
      id: 'todayMarker',
      afterDraw(chart) {
        if (todayIdx < 0) return;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        const x = xScale.getPixelForValue(todayIdx);
        const c = chart.ctx;
        c.save();
        c.strokeStyle = 'rgba(255, 46, 90, 0.8)';
        c.shadowColor = 'rgba(255, 46, 90, 0.6)';
        c.shadowBlur = 8;
        c.setLineDash([4, 4]);
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x, yScale.top);
        c.lineTo(x, yScale.bottom);
        c.stroke();
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(255, 46, 90, 0.95)';
        c.font = '700 11px Inter, -apple-system, sans-serif';
        c.fillText('HOJE', x + 6, yScale.top + 14);
        c.restore();
      },
    };

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Custos',
            type: 'bar',
            data: costsBars,
            backgroundColor: CHART_COLORS.costs,
            borderColor: CHART_COLORS.costsBorder,
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y1',
            order: 3,
          },
          {
            label: 'Ads',
            type: 'bar',
            data: adsBars,
            backgroundColor: CHART_COLORS.ads,
            borderColor: CHART_COLORS.adsBorder,
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y1',
            order: 4,
          },
          {
            label: 'Caixa',
            type: 'line',
            data: realCash,
            borderColor: CHART_COLORS.cash,
            backgroundColor: CHART_COLORS.cashFill,
            borderWidth: 2.5,
            tension: 0.35,
            spanGaps: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: CHART_COLORS.cash,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            fill: 'origin',
            yAxisID: 'y',
            order: 1,
          },
          {
            label: 'Caixa proj. · ' + scenarioName,
            type: 'line',
            data: projCash,
            borderColor: CHART_COLORS.cash,
            borderDash: [6, 5],
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.35,
            spanGaps: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            yAxisID: 'y',
            order: 2,
          },
          ...buildExtraScenarioDatasets(),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { display: false, color: CHART_COLORS.grid },
            ticks: {
              color: CHART_COLORS.axisLabel,
              font: { family: 'Inter', size: 11, weight: '600' },
            },
            border: { color: CHART_COLORS.grid },
          },
          y: {
            position: 'left',
            grid: { color: CHART_COLORS.grid, drawBorder: false, drawTicks: false },
            ticks: {
              color: CHART_COLORS.axisLabel,
              font: { family: 'Inter', size: 11, weight: '500' },
              callback: (v) => formatBrlCompact(v),
              padding: 8,
            },
            border: { display: false },
          },
          y1: {
            position: 'right',
            display: false,
            grid: { display: false },
            beginAtZero: true,
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#C5C5C5',
              font: { family: 'Inter', size: 12, weight: '600' },
              usePointStyle: true,
              padding: 16,
              boxWidth: 8,
              boxHeight: 8,
            },
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(14, 14, 15, 0.95)',
            titleColor: '#fff',
            titleFont: { family: 'Inter', size: 12, weight: '800' },
            bodyColor: '#C5C5C5',
            bodyFont: { family: 'Inter', size: 12, weight: '500' },
            footerColor: '#8A8A8A',
            footerFont: { family: 'Inter', size: 11, weight: '500' },
            padding: 14,
            cornerRadius: 10,
            borderColor: 'rgba(255, 46, 90, 0.4)',
            borderWidth: 1,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 6,
            caretSize: 6,
            callbacks: {
              title: (items) => {
                if (!items[0]) return '';
                const idx = items[0].dataIndex;
                const w = projection[idx];
                return w.label + ' · ' + w.week_id;
              },
              label: (item) => item.dataset.label + ': ' + BRL.format(item.parsed.y),
              afterBody: (items) => {
                if (!items[0]) return '';
                const idx = items[0].dataIndex;
                const w = projection[idx];
                const lines = [];
                if (Array.isArray(w.top_costs) && w.top_costs.length > 0) {
                  lines.push('');
                  lines.push('Top custos da semana:');
                  for (const t of w.top_costs) {
                    lines.push('• ' + t.category + ' · ' + BRL.format(t.total));
                  }
                }
                return lines;
              },
            },
          },
        },
      },
      plugins: [todayMarkerPlugin],
    });

    renderTable();
  }

  function renderTable() {
    const tbody = document.querySelector('#projection-table tbody');
    tbody.innerHTML = '';
    for (const w of projection) {
      const tr = document.createElement('tr');
      tr.className = w.is_past ? 'past' : (w.is_current ? 'current' : 'future');
      const salesCell = w.is_future
        ? `<input type="number" min="0" step="100" value="${Math.round(w.sales_projected)}" data-week="${w.week_id}" />`
        : BRL.format(w.sales_real);
      const costsCell = (w.is_past || w.is_current) ? BRL.format(w.costs_paid) : BRL.format(w.costs_planned);
      const adsCell = (w.is_past || w.is_current) ? BRL.format(w.ads_paid) : BRL.format(w.ads_planned);
      const deltaClass = w.week_delta >= 0 ? 'pos' : 'neg';
      tr.innerHTML = `
        <td>${w.label} <span class="muted">${w.week_id}</span></td>
        <td class="num sales-cell">${salesCell}</td>
        <td class="num">${costsCell}</td>
        <td class="num ads-cell">${adsCell}</td>
        <td class="num ${deltaClass}">${BRL.format(w.week_delta)}</td>
        <td class="num">${BRL.format(w.cash_after)}</td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('input[data-week]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const w = projection.find((x) => x.week_id === inp.dataset.week);
        if (!w) return;
        w.sales_projected = Number(inp.value) || 0;
        recompute();
        if (chart) {
          const { realCash, projCash, costsBars, adsBars } = buildLabelsAndData();
          // Custos and Ads não mudam com edits de venda; só caixa
          chart.data.datasets[2].data = realCash;
          chart.data.datasets[3].data = projCash;
          chart.update('none');
        }
        const row = inp.closest('tr');
        const delta = w.week_delta;
        row.children[4].textContent = BRL.format(delta);
        row.children[4].className = 'num ' + (delta >= 0 ? 'pos' : 'neg');
        row.children[5].textContent = BRL.format(w.cash_after);
      });
    });
  }

  async function loadVisibleScenarioSeries(past, future) {
    extraScenarios = [];
    const visibleIds = (initial.visibleScenarioIds || [])
      .filter((id) => initial.activeScenario ? id !== initial.activeScenario.id : true)
      .slice(0, 3);
    if (visibleIds.length === 0) return;
    for (const id of visibleIds) {
      try {
        const res = await fetch(`/api/cashflow?past=${past}&future=${future}&scenario_id=${id}`);
        if (!res.ok) continue;
        const data = await res.json();
        // Recompute the series with same logic
        const sc = cloneSeries(data.series);
        recompute(sc, data.cash_at_start);
        // Encontra o cenário no header dropdown pra pegar nome/cor
        let name = '#' + id;
        let color = '#94A3B8';
        const items = document.querySelectorAll('.scenario-item[data-id]');
        for (const it of items) {
          if (Number(it.dataset.id) === id) {
            const nameEl = it.querySelector('.scenario-name');
            const dotEl = it.querySelector('.scenario-dot');
            if (nameEl) name = nameEl.textContent.trim();
            if (dotEl) {
              const m = dotEl.style.background;
              if (m) color = m;
            }
            break;
          }
        }
        extraScenarios.push({ id, name, color, series: sc });
      } catch (_) { /* ignora */ }
    }
  }

  const PEDRRA_PREFS_KEY = 'pedrra:windowPrefs';

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PEDRRA_PREFS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && typeof obj.past === 'string' && typeof obj.future === 'string') return obj;
      return null;
    } catch (_) { return null; }
  }

  function savePrefs(past, future) {
    try {
      localStorage.setItem(PEDRRA_PREFS_KEY, JSON.stringify({ past: String(past), future: String(future) }));
    } catch (_) { /* ignora quota/privacy */ }
  }

  function applyPrefsToSelects() {
    const prefs = loadPrefs();
    if (!prefs) return null;
    const pastSel = document.getElementById('past-weeks');
    const futureSel = document.getElementById('future-weeks');
    if (pastSel && [...pastSel.options].some(o => o.value === prefs.past)) pastSel.value = prefs.past;
    if (futureSel && [...futureSel.options].some(o => o.value === prefs.future)) futureSel.value = prefs.future;
    return prefs;
  }

  async function loadWindow() {
    const past = document.getElementById('past-weeks').value;
    const future = document.getElementById('future-weeks').value;
    savePrefs(past, future);
    const status = document.getElementById('chart-status');
    status.textContent = 'carregando…';
    try {
      const res = await fetch(`/api/cashflow?past=${past}&future=${future}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const fresh = await res.json();
      cashAtStart = fresh.cash_at_start;
      projection = cloneSeries(fresh.series);
      recompute();
      await loadVisibleScenarioSeries(past, future);
      render();
      status.textContent = '';
    } catch (err) {
      status.textContent = 'erro: ' + err.message;
    }
  }

  document.getElementById('past-weeks').addEventListener('change', loadWindow);
  document.getElementById('future-weeks').addEventListener('change', loadWindow);

  recompute();

  function applyPrivacyToChart(hidden) {
    if (!chart) return;
    chart.options.scales.y.ticks.callback = hidden
      ? () => '••••'
      : (v) => formatBrlCompact(v);
    chart.options.plugins.tooltip.callbacks.label = hidden
      ? (item) => item.dataset.label + ': ••••'
      : (item) => item.dataset.label + ': ' + BRL.format(item.parsed.y);
    chart.options.plugins.tooltip.callbacks.afterBody = hidden
      ? () => ''
      : (items) => {
          if (!items[0]) return '';
          const idx = items[0].dataIndex;
          const w = projection[idx];
          const lines = [];
          if (Array.isArray(w.top_costs) && w.top_costs.length > 0) {
            lines.push('');
            lines.push('Top custos da semana:');
            for (const t of w.top_costs) {
              lines.push('• ' + t.category + ' · ' + BRL.format(t.total));
            }
          }
          return lines;
        };
    chart.update('none');
  }

  document.addEventListener('privacy:changed', (e) => {
    applyPrivacyToChart(!!(e.detail && e.detail.hidden));
  });

  const restored = applyPrefsToSelects();
  const ready = restored ? loadWindow() : loadVisibleScenarioSeries(1, 2).then(render);
  Promise.resolve(ready).then(() => {
    if (document.body.classList.contains('values-hidden')) applyPrivacyToChart(true);
  });
})();
