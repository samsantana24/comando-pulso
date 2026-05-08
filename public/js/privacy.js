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

  const MONEY_SELECTOR = '.kpi-card-value, .amount, .num, [data-money], td.amount, .total, .subtotal';
  const MONEY_REGEX = /R\$\s*[\d.,•]+/;

  // Marca via seletor estrito — chamado em mutações (cheap)
  function tagBySelector() {
    document.querySelectorAll(MONEY_SELECTOR).forEach((el) => {
      if (!el.classList.contains('money')) el.classList.add('money');
    });
  }

  // Sweep completo via regex — caro, só rodar uma vez no boot
  function autoTagFullSweep() {
    tagBySelector();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
      if (n.children.length === 0 && n.textContent && MONEY_REGEX.test(n.textContent)) {
        if (!n.classList.contains('money')) n.classList.add('money');
      }
    }
  }

  // Debounce: agenda re-tag após 200ms de quietude do DOM
  let debounceTimer = null;
  function scheduleTag() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      tagBySelector();
    }, 200);
  }

  function init() {
    apply(isHidden());
    autoTagFullSweep();
    const btn = document.getElementById('privacy-toggle');
    if (btn) btn.addEventListener('click', toggle);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        toggle();
      }
    });
    // Mutações pós-boot usam seletor restrito + debounce, não tree walk
    const obs = new MutationObserver(scheduleTag);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
