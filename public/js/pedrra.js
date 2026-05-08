(function () {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    let cum = startCash;
    for (const w of seriesRef) {
      const ads = Number(w.ads_paid || 0) + Number(w.ads_planned || 0);
      let delta;
      if (w.is_past || w.is_current) {
        delta = Number(w.sales_real || 0) - Number(w.costs_paid || 0) - Number(w.ads_paid || 0);
      } else {
        delta = Number(w.sales_projected || 0) - Number(w.costs_planned || 0) - Number(w.ads_planned || 0);
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
        c.strokeStyle = 'rgba(45, 212, 191, 0.6)';
        c.setLineDash([4, 4]);
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x, yScale.top);
        c.lineTo(x, yScale.bottom);
        c.stroke();
        c.fillStyle = 'rgba(45, 212, 191, 0.9)';
        c.font = '11px -apple-system, sans-serif';
        c.fillText('hoje', x + 4, yScale.top + 12);
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
            backgroundColor: 'rgba(239, 68, 68, 0.45)',
            borderColor: 'rgba(239, 68, 68, 0.9)',
            borderWidth: 1,
            yAxisID: 'y2',
            stack: 'spend',
          },
          {
            label: 'Ads',
            type: 'bar',
            data: adsBars,
            backgroundColor: 'rgba(245, 158, 11, 0.55)',
            borderColor: 'rgba(245, 158, 11, 0.9)',
            borderWidth: 1,
            yAxisID: 'y2',
            stack: 'spend',
          },
          {
            label: 'Caixa real',
            type: 'line',
            data: realCash,
            borderColor: scenarioColor,
            backgroundColor: 'rgba(45, 212, 191, 0.10)',
            tension: 0.18,
            spanGaps: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            yAxisID: 'y',
          },
          {
            label: 'Caixa proj. · ' + scenarioName,
            type: 'line',
            data: projCash,
            borderColor: '#94A3B8',
            borderDash: [6, 4],
            backgroundColor: 'rgba(148, 163, 184, 0.04)',
            tension: 0.18,
            spanGaps: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            yAxisID: 'y',
          },
          ...buildExtraScenarioDatasets(),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            position: 'left',
            ticks: { color: '#94A3B8', callback: (v) => BRL.format(v) },
            grid: { color: 'rgba(148, 163, 184, 0.10)' },
            title: { display: true, text: 'Caixa', color: '#94A3B8', font: { size: 11 } },
          },
          y2: {
            position: 'right',
            ticks: { color: '#FBBF24', callback: (v) => BRL.format(v) },
            grid: { display: false },
            title: { display: true, text: 'Custos / Ads', color: '#FBBF24', font: { size: 11 } },
          },
          x: { ticks: { color: '#94A3B8' }, grid: { display: false } },
        },
        plugins: {
          legend: { labels: { color: '#F1F5F9' } },
          tooltip: {
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

  async function loadWindow() {
    const past = document.getElementById('past-weeks').value;
    const future = document.getElementById('future-weeks').value;
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
  loadVisibleScenarioSeries(1, 2).then(render);
})();
