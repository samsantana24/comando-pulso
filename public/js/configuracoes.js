(function () {
  const formSettings = document.getElementById('form-settings');
  const status = document.getElementById('settings-status');

  formSettings.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formSettings));
    const payload = {
      initial_cash_brl: data.initial_cash_brl,
      include_initial_cash: data.include_initial_cash ? '1' : '0',
      include_ads_in_runway: data.include_ads_in_runway ? '1' : '0',
      include_receivables_in_projection: data.include_receivables_in_projection ? '1' : '0',
      default_payment_tax_pct: data.default_payment_tax_pct,
    };
    status.textContent = 'salvando…';
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        status.textContent = 'erro: ' + (err.error || res.status);
        return;
      }
      status.textContent = '✔ salvo';
      setTimeout(() => (status.textContent = ''), 2000);
    } catch (err) {
      status.textContent = 'erro: ' + err.message;
    }
  });

  const formAdd = document.getElementById('form-team-add');
  formAdd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formAdd));
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, role: data.role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.toast('Erro: ' + (err.error || res.status));
        return;
      }
      window.location.reload();
    } catch (err) {
      window.toast('Erro: ' + err.message);
    }
  });

  document.getElementById('team-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    try {
      if (action === 'toggle') {
        const isActive = btn.dataset.active === '1';
        const res = await fetch('/api/team/' + id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !isActive }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.location.reload();
      } else if (action === 'remove') {
        const name = btn.dataset.name || '';
        if (!window.confirm('Remover ' + name + '?')) return;
        const res = await fetch('/api/team/' + id, { method: 'DELETE' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.location.reload();
      }
    } catch (err) {
      window.toast('Erro: ' + err.message);
    }
  });

  const catModal = document.getElementById('modal-category');
  const catForm = document.getElementById('form-category');
  const catTitle = document.getElementById('modal-cat-title');

  document.getElementById('btn-new-category').addEventListener('click', () => {
    catTitle.textContent = 'Nova categoria';
    catForm.reset();
    catForm.elements.id.value = '';
    catModal.showModal();
  });

  catModal.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => catModal.close());
  });

  catForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(catForm));
    const isEdit = !!data.id;
    const url = isEdit ? '/api/categories/' + data.id : '/api/categories';
    const method = isEdit ? 'PATCH' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, group_name: data.group_name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.toast('Erro: ' + (err.error || res.status));
        return;
      }
      window.location.reload();
    } catch (err) {
      window.toast('Erro: ' + err.message);
    }
  });

  document.getElementById('cat-groups').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'edit-category') {
      catTitle.textContent = 'Editar categoria';
      catForm.elements.id.value = id;
      catForm.elements.name.value = btn.dataset.name || '';
      catForm.elements.group_name.value = btn.dataset.group || '';
      catModal.showModal();
      return;
    }

    if (action === 'delete-category') {
      const name = btn.dataset.name || '';
      if (!window.confirm('Excluir a categoria "' + name + '"?')) return;
      try {
        let res = await fetch('/api/categories/' + id, { method: 'DELETE' });
        if (res.status === 400) {
          const err = await res.json().catch(() => ({}));
          if (err.code !== 'HAS_COSTS' && !err.costs_count) {
            window.toast('Erro: ' + (err.error || res.status));
            return;
          }
          const moveTo = window.prompt(
            'Esta categoria tem ' + err.costs_count + ' custo(s) associado(s). Para excluir, digite o NOME da categoria pra onde mover esses custos:'
          );
          if (!moveTo || !moveTo.trim()) return;
          res = await fetch('/api/categories/' + id + '?move_to=' + encodeURIComponent(moveTo.trim()), { method: 'DELETE' });
          if (!res.ok && res.status !== 204) {
            const err2 = await res.json().catch(() => ({}));
            window.toast('Erro: ' + (err2.error || res.status));
            return;
          }
        } else if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}));
          window.toast('Erro: ' + (err.error || res.status));
          return;
        }
        window.location.reload();
      } catch (err) {
        window.toast('Erro: ' + err.message);
      }
    }
  });

  const permsPanel = document.getElementById('permissions-panel');
  if (permsPanel) {
    initPermissionsPanel();
  }

  function initPermissionsPanel() {
    const groupsContainer = document.getElementById('permissions-groups');
    const summaryOn = document.getElementById('perm-count-on');
    const summaryTotal = document.getElementById('perm-count-total');
    const status = document.getElementById('permissions-status');
    const search = document.getElementById('perm-search');
    const saveBtn = document.getElementById('btn-save-perms');
    const presetBtns = permsPanel.querySelectorAll('[data-preset]');
    const tabs = permsPanel.querySelectorAll('.role-tab');

    const GROUP_ICONS = {
      'Navegação': '⊞',
      'Vendas': '●',
      'Custos': '▣',
      'Ads': '★',
      'Recebíveis': '◆',
      'Visualização': '◉',
    };

    let currentRole = 'financeiro';
    let items = [];
    let dirty = false;

    async function load(role) {
      groupsContainer.innerHTML = '<p class="muted center">Carregando permissões…</p>';
      try {
        const res = await fetch('/api/permissions?role=' + encodeURIComponent(role));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        items = data.items || [];
        currentRole = data.role || role;
        dirty = false;
        render();
      } catch (err) {
        groupsContainer.innerHTML = '<p class="muted center">Erro ao carregar: ' + err.message + '</p>';
      }
    }

    function render() {
      const filter = (search.value || '').trim().toLowerCase();
      const grouped = {};
      for (const it of items) {
        if (!grouped[it.group]) grouped[it.group] = [];
        grouped[it.group].push(it);
      }
      const order = ['Navegação', 'Vendas', 'Custos', 'Ads', 'Recebíveis', 'Visualização'];
      const html = [];
      let totalShown = 0;
      let onShown = 0;
      for (const grp of order) {
        if (!grouped[grp]) continue;
        const filtered = grouped[grp].filter((p) =>
          !filter || p.label.toLowerCase().includes(filter) || p.key.toLowerCase().includes(filter)
        );
        if (filtered.length === 0) continue;
        const onCount = filtered.filter((p) => p.allowed).length;
        totalShown += filtered.length;
        onShown += onCount;
        const groupAllOn = filtered.every((p) => p.allowed);
        html.push(`<div class="perm-group" data-group="${escapeHtml(grp)}">`);
        html.push('<div class="perm-group-head">');
        html.push(`<h3><span class="perm-group-icon">${GROUP_ICONS[grp] || '·'}</span>${escapeHtml(grp)}</h3>`);
        html.push('<div class="perm-group-meta">');
        html.push(`<span><strong>${onCount}</strong> / ${filtered.length}</span>`);
        html.push(`<label class="toggle"><input type="checkbox" data-group-toggle="${escapeHtml(grp)}" ${groupAllOn ? 'checked' : ''} /><span class="toggle-slider"></span></label>`);
        html.push('</div></div>');
        html.push('<div class="perm-group-body">');
        for (const p of filtered) {
          html.push('<div class="perm-row">');
          html.push('<div class="perm-row-label">');
          html.push(escapeHtml(p.label));
          html.push(`<span class="perm-row-key">${escapeHtml(p.key)}</span>`);
          html.push('</div>');
          html.push(`<label class="toggle"><input type="checkbox" data-perm-key="${escapeHtml(p.key)}" ${p.allowed ? 'checked' : ''} /><span class="toggle-slider"></span></label>`);
          html.push('</div>');
        }
        html.push('</div></div>');
      }
      if (totalShown === 0) {
        groupsContainer.innerHTML = '<p class="muted center">Nenhuma permissão corresponde ao filtro.</p>';
      } else {
        groupsContainer.innerHTML = html.join('');
      }
      const totalAll = items.length;
      const onAll = items.filter((p) => p.allowed).length;
      summaryOn.textContent = onAll;
      summaryTotal.textContent = totalAll;
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function setStatus(text, cls) {
      status.textContent = text;
      status.className = 'permissions-status ' + (cls || '');
    }

    groupsContainer.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('input[data-perm-key]')) {
        const key = t.dataset.permKey;
        const it = items.find((x) => x.key === key);
        if (it) it.allowed = t.checked;
        dirty = true;
        render();
      } else if (t.matches('input[data-group-toggle]')) {
        const grp = t.dataset.groupToggle;
        items.forEach((it) => {
          if (it.group === grp) it.allowed = t.checked;
        });
        dirty = true;
        render();
      }
    });

    search.addEventListener('input', render);

    saveBtn.addEventListener('click', async () => {
      setStatus('salvando…', 'is-saving');
      try {
        const res = await fetch('/api/permissions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: currentRole,
            updates: items.map((it) => ({ key: it.key, allowed: it.allowed })),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setStatus('erro: ' + (err.error || res.status), 'is-error');
          return;
        }
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        setStatus('salvo às ' + hh + ':' + mm, 'is-saved');
        dirty = false;
      } catch (err) {
        setStatus('erro: ' + err.message, 'is-error');
      }
    });

    presetBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const preset = btn.dataset.preset;
        const labels = {
          'default': 'voltar a Rachel ao padrão do sistema',
          'all-on': 'LIBERAR TODAS as permissões para a Rachel',
          'all-off': 'BLOQUEAR todas as permissões (Rachel mantém só acesso à aba de Custos)',
        };
        if (preset === 'all-on' || preset === 'all-off') {
          if (!confirm('Confirmar: ' + labels[preset] + '?')) return;
        } else {
          if (!confirm('Aplicar preset: ' + labels[preset] + '?')) return;
        }
        setStatus('aplicando preset…', 'is-saving');
        try {
          const res = await fetch('/api/permissions/preset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: currentRole, preset }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setStatus('erro: ' + (err.error || res.status), 'is-error');
            return;
          }
          const data = await res.json();
          items = data.items || [];
          dirty = false;
          render();
          setStatus('preset aplicado ✓', 'is-saved');
        } catch (err) {
          setStatus('erro: ' + err.message, 'is-error');
        }
      });
    });

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        if (dirty && !confirm('Há mudanças não salvas. Trocar de role mesmo assim?')) return;
        tabs.forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        load(tab.dataset.role);
      });
    });

    load(currentRole);
  }
})();
