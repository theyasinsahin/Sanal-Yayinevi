const compactFormatter = new Intl.NumberFormat('tr-TR', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

const exactFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

// Counts are nonnegative integers. Do not coerce missing or malformed API data.
const normalizeCount = value => (
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
);

// Intl handles the Turkish suffixes and carries rounding into the next unit.
export const formatCount = value => compactFormatter.format(normalizeCount(value));
export const formatExactCount = value => exactFormatter.format(normalizeCount(value));
