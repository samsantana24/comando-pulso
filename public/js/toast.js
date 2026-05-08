(function () {
  function ensureRoot() {
    let r = document.getElementById('toast-root');
    if (!r) {
      r = document.createElement('div');
      r.id = 'toast-root';
      r.className = 'toast-root';
      document.body.appendChild(r);
    }
    return r;
  }

  window.toast = function (msg, type, durationMs) {
    if (!type) {
      const txt = String(msg);
      if (/^erro/i.test(txt)) type = 'error';
      else if (/^aviso|^atenç/i.test(txt)) type = 'warn';
      else if (/^✔|^salvo|^ok/i.test(txt)) type = 'success';
      else type = 'info';
    }
    durationMs = durationMs || 3500;
    const root = ensureRoot();
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<span class="toast-msg"></span><button class="toast-close" aria-label="fechar">×</button>';
    el.querySelector('.toast-msg').textContent = String(msg);
    el.querySelector('.toast-close').onclick = () => el.remove();
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-in'));
    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, durationMs);
  };

  window.toastError = (msg, ms) => window.toast(msg, 'error', ms);
  window.toastSuccess = (msg, ms) => window.toast(msg, 'success', ms);
  window.toastWarn = (msg, ms) => window.toast(msg, 'warn', ms);
})();
