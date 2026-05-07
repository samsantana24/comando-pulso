const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function formatBrl(value) {
  return BRL.format(Number(value || 0));
}

function formatDateShort(ymdStr) {
  if (!ymdStr) return '—';
  const [y, m, d] = String(ymdStr).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

const PAYMENT_METHOD_LABELS = {
  pix: 'Pix',
  cartao_avista: 'Cartão à vista',
  cartao_2x: 'Cartão 2x',
  cartao_6x: 'Cartão 6x',
  cartao_12x: 'Cartão 12x',
  outro: 'Outro',
};

function formatPaymentMethod(code) {
  return PAYMENT_METHOD_LABELS[code] || code || '';
}

module.exports = { formatBrl, formatDateShort, formatPaymentMethod, PAYMENT_METHOD_LABELS };
