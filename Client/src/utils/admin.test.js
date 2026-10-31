import { adminDate, enumLabel, fieldValue, preview } from './admin';

test('admin field paths handle nested values and missing optional parents', () => {
  expect(fieldValue({ privacy: { public: false } }, 'privacy.public')).toBe(false);
  expect(fieldValue({}, 'privacy.public')).toBeUndefined();
});
test.each([null, '', 'not-a-date'])('invalid admin dates show the empty marker: %s', value => {
  expect(adminDate(value)).toBe('—');
});
test('admin dates accept both ISO dates and serialized milliseconds', () => {
  const date = new Date('2026-01-01T12:00:00Z');
  expect(adminDate(date.toISOString())).toBe(date.toLocaleString('tr-TR'));
  expect(adminDate(String(date.getTime()))).toBe(date.toLocaleString('tr-TR'));
});
test('admin previews preserve false/zero, summarize collections and cap long text', () => {
  expect(preview(false)).toBe('Hayır');
  expect(preview(true)).toBe('Evet');
  expect(preview(0)).toBe('0');
  expect(preview(null)).toBe('—');
  expect(preview(['a', 'b'])).toBe('2 kayıt');
  expect(preview({ title: 'Book' })).toBe('{"title":"Book"}');
  expect(preview('a'.repeat(200))).toHaveLength(180);
  expect(enumLabel('ADMIN')).toBe('Yönetici');
  expect(enumLabel('future-value')).toBe('future-value');
});
