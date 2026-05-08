const MIN_DATE = '2025-01-01';
const MAX_DATE = '2030-12-31';

function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isDateInRange(s) {
  if (!isYmd(s)) return false;
  return s >= MIN_DATE && s <= MAX_DATE;
}

function isPositive(n) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0;
}

function isNonNegative(n) {
  const x = Number(n);
  return Number.isFinite(x) && x >= 0;
}

module.exports = {
  MIN_DATE,
  MAX_DATE,
  isYmd,
  isDateInRange,
  isPositive,
  isNonNegative,
};
