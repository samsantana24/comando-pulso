const { ymd, parseYmd } = require('./weeks');

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function lastDayOfMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function expandRule(rule, { fromDate = null, toDate = null } = {}) {
  const start = parseYmd(rule.start_date);
  const end = rule.end_date ? parseYmd(rule.end_date) : null;
  const today = new Date();
  const horizonEnd = end || addMonths(today, 6);
  const rangeStart = fromDate ? parseYmd(fromDate) : start;
  const rangeEnd = toDate ? parseYmd(toDate) : horizonEnd;
  const occurrences = [];

  if (rule.pattern === 'monthly_day') {
    const day = Number(rule.pattern_value);
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= rangeEnd) {
      const last = lastDayOfMonth(cursor.getFullYear(), cursor.getMonth());
      const occDay = Math.min(day, last);
      const occ = new Date(cursor.getFullYear(), cursor.getMonth(), occDay);
      if (occ >= start && occ >= rangeStart && occ <= rangeEnd && occ <= horizonEnd) {
        occurrences.push(ymd(occ));
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else if (rule.pattern === 'every_n_weeks') {
    const n = Math.max(1, Number(rule.pattern_value));
    let cursor = new Date(start);
    let safety = 1000;
    while (cursor <= rangeEnd && safety-- > 0) {
      if (cursor >= rangeStart && cursor <= horizonEnd) {
        occurrences.push(ymd(cursor));
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7 * n);
    }
  }

  return occurrences;
}

module.exports = { expandRule };
