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
      if (!url) { window.toast('Endpoint não definido. Recarregue.'); return; }
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
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
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

  const adsForm = document.getElementById('form-ads');
  if (adsForm) {
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
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      }
    });
  }

  const vendaForm = document.getElementById('form-venda');
  if (vendaForm) {
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
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // === Custo parcelado: pré-visualização dinâmica + submit ===
  const formParcelado = document.getElementById('form-custo-parcelado');
  if (formParcelado) {
    const totalInput = formParcelado.querySelector('input[name="total_amount"]');
    const countInput = formParcelado.querySelector('input[name="installments_count"]');
    const firstDateInput = formParcelado.querySelector('input[name="first_date"]');
    const freqSelect = formParcelado.querySelector('select[name="frequency"]');
    const list = document.getElementById('parcel-list');
    const sumCheck = document.getElementById('parcel-sum-check');
    const submitBtn = document.getElementById('btn-submit-parcelado');

    let parcels = [];

    function addMonths(ymd, n) {
      const [y, m, d] = ymd.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1 + n, d));
      const yy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      return yy + '-' + mm + '-' + dd;
    }
    function addDays(ymd, n) {
      const [y, m, d] = ymd.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + n));
      return dt.toISOString().slice(0, 10);
    }

    function generateDates(firstDate, count, freq) {
      const out = [];
      for (let i = 0; i < count; i++) {
        if (freq === 'monthly') out.push(addMonths(firstDate, i));
        else if (freq === 'biweekly') out.push(addDays(firstDate, i * 14));
        else if (freq === 'weekly') out.push(addDays(firstDate, i * 7));
        else out.push(addDays(firstDate, i));
      }
      return out;
    }

    function distributeAmount(total, count) {
      if (count <= 0) return [];
      const cents = Math.round(total * 100);
      const base = Math.floor(cents / count);
      const remainder = cents - base * count;
      const arr = new Array(count).fill(base);
      arr[count - 1] += remainder;
      return arr.map((c) => c / 100);
    }

    function regenerate() {
      const total = Number(totalInput.value) || 0;
      const count = Math.max(2, Math.min(36, Number(countInput.value) || 2));
      const firstDate = firstDateInput.value;
      const freq = freqSelect.value;
      if (!firstDate || total <= 0) {
        parcels = [];
        list.innerHTML = '<li class="muted">Preencha valor total, nº de parcelas e data da 1ª.</li>';
        sumCheck.textContent = '';
        if (submitBtn) submitBtn.textContent = 'Criar parcelas';
        return;
      }
      const dates = generateDates(firstDate, count, freq);
      const amounts = distributeAmount(total, count);
      parcels = dates.map((date, i) => ({ date, amount: amounts[i] }));
      renderList();
      updateSumCheck();
      if (submitBtn) submitBtn.textContent = 'Criar ' + count + ' parcelas';
    }

    function renderList() {
      list.innerHTML = parcels.map((p, i) => {
        const idx = i + 1;
        const total = parcels.length;
        return '<li class="parcel-item">' +
          '<span class="parcel-num">Parcela ' + idx + '/' + total + '</span>' +
          '<input type="date" class="parcel-date-input" value="' + p.date + '" data-idx="' + i + '" min="2025-01-01" max="2030-12-31" />' +
          '<span class="parcel-amount">' + BRL.format(p.amount) + '</span>' +
          '</li>';
      }).join('');
      list.querySelectorAll('.parcel-date-input').forEach((inp) => {
        inp.addEventListener('change', () => {
          const i = Number(inp.dataset.idx);
          if (parcels[i]) parcels[i].date = inp.value;
        });
      });
    }

    function updateSumCheck() {
      const total = Number(totalInput.value) || 0;
      const sum = parcels.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const diff = Math.abs(sum - total);
      if (diff < 0.005) {
        sumCheck.textContent = 'Soma das parcelas: ' + BRL.format(sum) + ' ✓';
        sumCheck.className = 'parcel-sum-check ok';
      } else {
        sumCheck.textContent = 'Soma: ' + BRL.format(sum) + ' (esperado ' + BRL.format(total) + ')';
        sumCheck.className = 'parcel-sum-check err';
      }
    }

    [totalInput, countInput, firstDateInput, freqSelect].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', regenerate);
      el.addEventListener('change', regenerate);
    });

    formParcelado.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!parcels || parcels.length < 2) {
        window.toast('Preencha os campos para gerar as parcelas');
        return;
      }
      const data = Object.fromEntries(new FormData(formParcelado));
      const payload = {
        category: data.category,
        description: data.description || null,
        total_amount: Number(data.total_amount),
        installments: parcels.map((p) => ({ date: p.date, amount: Number(p.amount) })),
        scenario_id: data.scenario_id || null,
      };
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = await fetch('/api/costs/installments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          window.toast('Erro: ' + (err.error || ('HTTP ' + res.status)));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    regenerate();
  }

  // === Modal Export (XLSX/CSV) ===
  (function setupExportModal() {
    const dlg = document.getElementById('modal-export');
    if (!dlg) return;
    const form = document.getElementById('form-export');
    const fromInput = form.elements.from;
    const toInput = form.elements.to;
    const presets = dlg.querySelectorAll('[data-preset]');

    function setRange(fromYmd, toYmd) {
      fromInput.value = fromYmd;
      toInput.value = toYmd;
    }
    function todayYmd() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function applyPreset(name) {
      const t = new Date();
      const today = todayYmd();
      if (name === 'this-week') {
        const day = t.getDay();
        const sun = new Date(t.getTime() - day * 86400000);
        const sat = new Date(sun.getTime() + 6 * 86400000);
        setRange(sun.toISOString().slice(0, 10), sat.toISOString().slice(0, 10));
      } else if (name === 'this-month') {
        const first = new Date(t.getFullYear(), t.getMonth(), 1);
        setRange(first.toISOString().slice(0, 10), today);
      } else if (name === 'last-30') {
        const start = new Date(t.getTime() - 30 * 86400000);
        setRange(start.toISOString().slice(0, 10), today);
      } else if (name === 'quarter') {
        const m = t.getMonth();
        const startQ = new Date(t.getFullYear(), Math.floor(m / 3) * 3, 1);
        setRange(startQ.toISOString().slice(0, 10), today);
      } else if (name === 'year') {
        setRange(t.getFullYear() + '-01-01', t.getFullYear() + '-12-31');
      }
    }
    presets.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        presets.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        applyPreset(btn.dataset.preset);
      });
    });
    applyPreset('year');

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-modal="export"]');
      if (!trigger) return;
      const dft = trigger.dataset.exportDefault;
      // reset to all checked first
      form.elements.include_sales.checked = true;
      form.elements.include_costs.checked = true;
      form.elements.include_ads.checked = true;
      form.elements.include_receivables.checked = true;
      if (dft === 'receivables') {
        form.elements.include_sales.checked = false;
        form.elements.include_costs.checked = false;
        form.elements.include_ads.checked = false;
        form.elements.include_receivables.checked = true;
      }
      dlg.showModal();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-export-submit');
      submitBtn.dataset.loading = '1';
      submitBtn.disabled = true;
      try {
        const body = {
          format: form.elements.format.value,
          from: form.elements.from.value,
          to: form.elements.to.value,
          include: {
            sales: form.elements.include_sales.checked,
            costs: form.elements.include_costs.checked,
            ads: form.elements.include_ads.checked,
            receivables: form.elements.include_receivables.checked,
          },
        };
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Falha no export');
        }
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') || '';
        const filenameMatch = cd.match(/filename="(.+?)"/);
        const filename = filenameMatch ? filenameMatch[1] : 'export';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        window.toast('Exportação concluída ✓');
        dlg.close();
      } catch (err) {
        window.toast('Falha no export: ' + err.message);
      } finally {
        delete submitBtn.dataset.loading;
        submitBtn.disabled = false;
      }
    });
  })();
})();
