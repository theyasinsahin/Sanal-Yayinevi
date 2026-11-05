import { formatCount, formatExactCount } from './formatCount';

// CLDR uses a nonbreaking space between the number and the suffix.
test.each([
  [0, '0'], [1, '1'], [999, '999'], [1000, '1 B'],
  [1049, '1 B'], [1050, '1,1 B'], [9999, '10 B'],
  [21530, '21,5 B'], [25300, '25,3 B'], [25000, '25 B'],
  [99949, '99,9 B'], [99950, '100 B'],
  [999949, '999,9 B'], [999950, '1 Mn'], [1000000, '1 Mn'],
  [1250000, '1,3 Mn'], [999949999, '999,9 Mn'], [999950000, '1 Mr'],
  [1000000000, '1 Mr'], [2147483647, '2,1 Mr'],
  [1000000000000, '1 Tn'],
])('formats %s as %s', (value, expected) => {
  expect(formatCount(value).replace(/\u00a0/g, ' ')).toBe(expected);
});

test.each([undefined, null, NaN, Infinity, -Infinity, -1, '21530', {}, true])('invalid count %p renders zero', value => {
  expect(formatCount(value)).toBe('0');
  expect(formatExactCount(value)).toBe('0');
});

test('normalizes fractional counts and keeps the unrounded total available', () => {
  expect(formatCount(999.9)).toBe('999');
  expect(formatExactCount(21530)).toBe('21.530');
  expect(formatExactCount(999950)).toBe('999.950');
});
