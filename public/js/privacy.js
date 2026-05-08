(function () {
  const KEY = 'comando:hideValues';

  function isHidden() {
    try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; }
  }

  function apply(hidden) {
    document.body.classList.toggle('values-hidden', hidden);
    const btn = document.getElementById('privacy-toggle');
    if (btn) {
      btn.classList.toggle('is-active', hidden);
      const lbl = btn.querySelector('.privacy-label');
      if (lbl) lbl.textContent = hidden ? 'Mostrar' : 'Ocultar';
    }
    // Notifica componentes (ex: Chart.js) pra re-renderizar se necessário
    document.dispatchEvent(new CustomEvent('privacy:changed', { detail: { hidden } }));
  }

  function toggle() {
    const next = !isHidden();
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch (_) {}
    apply(next);
  }

  // Auto-marca elementos com texto BRL como .money
  function autoTagMoney() {
    const re = /R\$\s*[\d.,•]+/;
    const candidates = document.querySelectorAll('.kpi-card-value, .amount, .num, .total, .subtotal, [data-money]');
    candidates.forEach((el) => {
      if (!el.classList.contains('money')) el.classList.add('money');
    });
    // Sweep extra: qualquer leaf node com "R$" vira .money se não estiver dentro de input/textarea
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
      if (n.children.length === 0 && n.textContent && re.test(n.textContent)) {
        if (!n.classList.contains('money')) n.classList.add('money');
      }
    }
  }

  function init() {
    apply(isHidden());
    autoTagMoney();
    const btn = document.getElementById('privacy-toggle');
    if (btn) btn.addEventListener('click', toggle);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        toggle();
      }
    });
    // Re-tag após mutações grandes (ex: tabela atualizada via fetch)
    const obs = new MutationObserver(() => autoTagMoney());
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
