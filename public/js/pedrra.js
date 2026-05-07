(function () {
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const initial = window.PEDRRA_INITIAL;
  const ctx = document.getElementById('cashflow-chart').getContext('2d');
  let chart = null;
  let cashAtStart = initial.cashAtStart;
  let projection = cloneSeries(initial.series);
  const scenarioColor = (initial.activeScenario && initial.activeScenario.color) || '#2DD4BF';
  const scenarioName = (initial.activeScenario && initial.activeScenario.name) || 'sem cenário';

  function cloneSeries(arr) {
    return arr.map((s) => ({ ...s }));
  }

  function recompute() {
    let cum = cashAtStart;
    for (const w of projection) {
      const delta = (w.is_past || w.is_current)
        ? Number(w.sales_real || 0) - Number(w.costs_paid || 0)
        : Number(w.sales_projected || 0) - Number(w.costs_planned || 0);
      w.week_delta = delta;
      cum += delta;
      w.cash_after = cum;
    }
  }

  function buildDatasets() {
    const labels = projection.map((w) => w.label);
    const realData = projection.map((w) => (w.is_past || w.is_current) ? w.cash_after : null);
    const projData = projection.map((w) => (w.is_future || w.is_current) ? w.cash_after : null);
    const todayIdx = projection.findIndex((w) => w.is_current);
    return { labels, realData, projData, todayIdx };
  }

  function render() {
    const { labels, realData, projData, todayIdx } = buildDatasets();
    if (chart) chart.destroy();

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

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Caixa real',
            data: realData,
            borderColor: scenarioColor,
            backgroundColor: 'rgba(45, 212, 191, 0.10)',
            tension: 0.18,
            spanGaps: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
          },
          {
            label: 'Caixa projetado · ' + scenarioName,
            data: projData,
            borderColor: '#94A3B8',
            borderDash: [6, 4],
            backgroundColor: 'rgba(148, 163, 184, 0.04)',
            tension: 0.18,
            spanGaps: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            ticks: {
              color: '#94A3B8',
              callback: (v) => BRL.format(v).replace(/ /g, ' '),
            },
            grid: { color: 'rgba(148, 163, 184, 0.10)' },
          },
          x: {
            ticks: { color: '#94A3B8' },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { labels: { color: '#F1F5F9' } },
          tooltip: {
            callbacks: {
              label: (item) => item.dataset.label + ': ' + BRL.format(item.parsed.y),
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
      const deltaClass = w.week_delta >= 0 ? 'pos' : 'neg';
      tr.innerHTML = `
        <td>${w.label} <span class="muted">${w.week_id}</span></td>
        <td class="num sales-cell">${salesCell}</td>
        <td class="num">${costsCell}</td>
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
          const { realData, projData } = buildDatasets();
          chart.data.datasets[0].data = realData;
          chart.data.datasets[1].data = projData;
          chart.update('none');
        }
        const row = inp.closest('tr');
        const delta = w.week_delta;
        row.children[3].textContent = BRL.format(delta);
        row.children[3].className = 'num ' + (delta >= 0 ? 'pos' : 'neg');
        row.children[4].textContent = BRL.format(w.cash_after);
      });
    });
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
      render();
      status.textContent = '';
    } catch (err) {
      status.textContent = 'Erro: ' + err.message;
    }
  }

  document.getElementById('past-weeks').addEventListener('change', loadWindow);
  document.getElementById('future-weeks').addEventListener('change', loadWindow);

  recompute();
  render();
})();
