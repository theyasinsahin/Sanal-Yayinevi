export const fieldValue = (values, name) => name.split('.').reduce((result, part) => result?.[part], values);
export function adminDate(value) {
  if (!value) return '—';
  const date = new Date(typeof value === 'string' && /^\d{10,}$/.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('tr-TR');
}
export const enumLabel = value => ({ ADMIN: 'Yönetici', PUBLISHER: 'Yayınevi sahibi', USER: 'Kullanıcı', DRAFT: 'Taslak', WRITING: 'Yazılıyor', COMPLETED: 'Tamamlandı', FUNDING: 'Fonlanıyor', FUNDED: 'Fonlandı', PUBLISHED: 'Yayımlandı', PENDING: 'Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', SUCCESS: 'Başarılı', FAILED: 'Başarısız', REFUNDED: 'İade edildi', DIGITAL: 'Dijital', PRINTED: 'Basılı', OPEN: 'Herkese açık', PRIVATE: 'Özel', FOLLOWERS_ONLY: 'Takipçilere açık', pending: 'Onay bekliyor', active: 'Aktif', unsubscribed: 'Abonelik iptal edildi' }[value] || value);
export function preview(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (Array.isArray(value)) return `${value.length} kayıt`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).slice(0, 180);
}
