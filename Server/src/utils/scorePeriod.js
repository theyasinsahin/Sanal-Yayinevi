export function getPeriodStart(period, now = new Date()) {
  if (!['daily', 'weekly', 'monthly'].includes(period)) return null;
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  const wallTime = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
  const offset = wallTime - Math.floor(now.getTime() / 1000) * 1000;
  const start = new Date(Date.UTC(fields.year, fields.month - 1, period === 'monthly' ? 1 : fields.day));
  if (period === 'weekly') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return new Date(start.getTime() - offset);
}
