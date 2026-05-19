function pad2(n) { return String(n).padStart(2, '0'); }

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeek(date) {
  const d = typeof date === 'string' ? parseYmd(date) : new Date(date);
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

function weekRangeFromDate(date) {
  const sun = startOfWeek(date);
  const sat = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
  return { sun, sat };
}

function weekIdFromSunday(sunday) {
  const year = sunday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  const firstSundayDate = jan1Day === 0 ? 1 : 1 + (7 - jan1Day);
  const firstSunday = new Date(year, 0, firstSundayDate);
  const days = Math.round((sunday - firstSunday) / 86400000);
  const weekNum = Math.floor(days / 7) + 1;
  return `${year}-W${pad2(Math.max(1, weekNum))}`;
}

const MONTH_NAMES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthAnchorFromSunday(sunday) {
  return `${sunday.getFullYear()}-${pad2(sunday.getMonth() + 1)}`;
}

function weekLabel(sun, sat) {
  const sunDay = pad2(sun.getDate());
  const satDay = pad2(sat.getDate());
  const monthSun = MONTH_NAMES_PT[sun.getMonth()];
  if (sun.getMonth() === sat.getMonth()) {
    return `${sunDay}–${satDay}/${monthSun}`;
  }
  const monthSat = MONTH_NAMES_PT[sat.getMonth()];
  return `${sunDay}/${monthSun}–${satDay}/${monthSat}`;
}

function getWeeks({ pastWeeks = 1, futureWeeks = 2, anchor = null } = {}) {
  const today = anchor
    ? (typeof anchor === 'string' ? parseYmd(anchor) : new Date(anchor))
    : new Date();
  const { sun: thisSun } = weekRangeFromDate(today);
  const weeks = [];
  for (let i = -pastWeeks; i <= futureWeeks; i++) {
    const sun = new Date(thisSun.getFullYear(), thisSun.getMonth(), thisSun.getDate() + i * 7);
    const sat = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
    weeks.push({
      week_id: weekIdFromSunday(sun),
      sun: ymd(sun),
      sat: ymd(sat),
      month_anchor: monthAnchorFromSunday(sun),
      label: weekLabel(sun, sat),
      offset: i,
      is_current: i === 0,
      is_past: i < 0,
      is_future: i > 0,
    });
  }
  return weeks;
}

function getWeeksFromTotal(totalWeeks, anchor = null) {
  const t = Math.max(1, Math.min(20, Number(totalWeeks) || 4));
  let pastWeeks, futureWeeks;
  if (t <= 1) { pastWeeks = 0; futureWeeks = 0; }
  else if (t === 2) { pastWeeks = 0; futureWeeks = 1; }
  else { pastWeeks = 1; futureWeeks = t - 2; }
  return getWeeks({ pastWeeks, futureWeeks, anchor });
}

function todayYmd() { return ymd(new Date()); }

function getWeeksBetween(fromYmd, toYmd) {
  const fromSun = weekRangeFromDate(fromYmd).sun;
  const toSun = weekRangeFromDate(toYmd).sun;
  const weeks = [];
  let cursor = new Date(fromSun);
  let i = 0;
  const todaySun = weekRangeFromDate(new Date()).sun;
  while (cursor <= toSun) {
    const sun = new Date(cursor);
    const sat = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
    const diff = Math.round((sun - todaySun) / (7 * 24 * 60 * 60 * 1000));
    weeks.push({
      week_id: weekIdFromSunday(sun),
      sun: ymd(sun),
      sat: ymd(sat),
      month_anchor: monthAnchorFromSunday(sun),
      label: weekLabel(sun, sat),
      offset: diff,
      is_current: diff === 0,
      is_past: diff < 0,
      is_future: diff > 0,
    });
    cursor.setDate(cursor.getDate() + 7);
    i++;
    if (i > 520) break;
  }
  return weeks;
}

module.exports = {
  ymd, parseYmd, startOfWeek, weekRangeFromDate, weekIdFromSunday,
  monthAnchorFromSunday, weekLabel, getWeeks, getWeeksFromTotal, getWeeksBetween, todayYmd,
};
