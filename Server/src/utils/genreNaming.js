export const cleanGenreName = value => String(value || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
export const genreSlug = value => cleanGenreName(value).toLocaleLowerCase('tr-TR')
  .replace(/[çğıöşü]/g, char => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[char]))
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normalizeGenre(values, creating = false) {
  const result = { ...values };
  if (creating || 'name' in result) {
    result.name = cleanGenreName(result.name);
    if (result.name.length < 2 || result.name.length > 80) throw new Error('Tür adı 2–80 karakter olmalı.');
  }
  if (creating || 'slug' in result) {
    result.slug = genreSlug(result.slug || result.name);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug) || result.slug.length > 80) throw new Error('Geçerli bir URL adı girin.');
  }
  if (creating && !result.hexColor) result.hexColor = '#6366f1';
  if ('hexColor' in result && !/^#[0-9a-f]{6}$/i.test(result.hexColor)) throw new Error('Renk #RRGGBB biçiminde olmalı.');
  result.iconUrl = '';
  return result;
}
