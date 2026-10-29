import React, { useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { Button } from '../UI/Button';
import { API_URL } from '../../config/api';
import './printFunding.css';

export const money = minor => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format((minor || 0) / 100);
export function toMinor(value) {
  const input = String(value).replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(input)) throw new Error('Tutarı en fazla iki ondalık basamakla girin.');
  const [whole, fraction = ''] = input.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function checkoutKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  if (window.crypto?.getRandomValues) return Array.from(window.crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  throw new Error('Güvenli işlem anahtarı üretilemiyor. Güncel bir tarayıcı kullanın.');
}
export const statusNames = {
  PREPARING: 'Başvuru hazırlanıyor', SUBMITTED: 'İncelemede', REVISION_REQUESTED: 'Revizyon istendi', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi',
  ACTIVE: 'Kampanya açık', CLOSING: 'Kapanıyor / Uzlaştırılıyor', SUCCEEDED: 'Başarıyla tamamlandı', FAILED: 'Başarısız', CANCELLED: 'İptal edildi',
  REFUNDING: 'İadeler sürüyor', REFUND_PENDING: 'İade bekleniyor', REFUNDED: 'İade edildi', PENDING: 'Bekliyor', CREATED: 'Ödeme hazırlanıyor', CAPTURED: 'Test ödemesi doğrulandı',
  NOT_STARTED: 'Üretim başlamadı', PREPARATION: 'Basım hazırlığında', PRINTER_APPROVED: 'Matbaa onayladı', STARTED: 'Üretim başladı', PRINTING: 'Baskıda', PRINTED: 'Baskı tamamlandı',
  PACKAGING: 'Paketleniyor', SHIPPING: 'Dağıtımda', SHIPPED: 'Kargoya verildi', DELIVERED: 'Teslim edildi', COMPLETED: 'Tamamlandı', ISSUE: 'Sorun / Gecikme', AWAITING_PAYMENT: 'Ödeme bekleniyor', CONFIRMED: 'Ön sipariş onaylandı', PROCESSING: 'İşleniyor', HELD: 'Rezerve', CONSUMED: 'Kullanıldı', EXPIRED: 'Süresi doldu', RELEASED: 'Serbest bırakıldı',
};
export const Status = ({ value }) => <span className={`print-status print-status--${value?.toLowerCase()}`}>{statusNames[value] || value}</span>;
export function Feedback({ error, message }) { return <>{error && <p className="ui-notice ui-notice--error" role="alert">{error.message || error}</p>}{message && <p className="ui-notice" role="status">{message}</p>}</>; }
export function usePrintAction(refresh) {
  const client = useApolloClient(), lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function run(mutation, variables) {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await client.mutate({ mutation, variables }); setMessage('İşlem kaydedildi.');
      if (refresh) { try { await refresh(); } catch { setError('İşlem kaydedildi ancak güncel durum alınamadı. Sayfayı yenileyin.'); } }
      return result.data;
    } catch (failure) { setError(failure.message); return null; }
    finally { lock.current = false; setBusy(false); }
  }
  return { run, busy, error, setError, message };
}
export function Pager({ page, setPage, count }) { return <div className="print-actions"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Önceki</Button><span>Sayfa {page}</span><Button variant="outline" disabled={count < 20} onClick={() => setPage(page + 1)}>Sonraki</Button></div>; }
export function FileUpload({ label, value, onChange, disabled }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function upload(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('PDF en fazla 10 MB olmalı.');
      const response = await fetch(new URL('/api/print/assets', API_URL), { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent(file.name) }, body: file });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Dosya yüklenemedi.'); onChange(data.id);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <div className="print-file"><label>{label}<input type="file" accept="application/pdf,.pdf" onChange={upload} disabled={disabled || busy} /></label>{busy && <p role="status">Dosya yükleniyor…</p>}{value && <p>Özel dosya: <code>{value}</code></p>}<Feedback error={error} /></div>;
}
export function DownloadAsset({ id, children }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true); setError('');
    try {
      const response = await fetch(new URL(`/api/print/assets/${id}`, API_URL), { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!response.ok) throw new Error('Dosya indirilemedi veya erişim yetkiniz yok.');
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = 'baski-belgesi.pdf'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div><Button variant="outline" onClick={download} disabled={busy}>{children}</Button><Feedback error={error} /></div>;
}
export function CampaignCard({ campaign }) {
  const c = campaign;
  return <section className="print-panel"><div className="print-heading"><h3>{c.title}</h3><Status value={c.state} /></div>
    <p className="print-sandbox">SANDBOX · Gerçek para alınmaz</p>
    <progress aria-label="Kampanya ilerlemesi" max={c.targetMinor} value={c.acceptedMinor} />
    <p><strong>{money(c.acceptedMinor)}</strong> / {money(c.targetMinor)} · %{Number(c.progressPercent || 0).toFixed(1)}</p>
    <dl className="print-stats"><div><dt>Ödeme için ayrılan</dt><dd>{money(c.reservedMinor)}</dd></div><div><dt>Kabul edilebilir kalan</dt><dd>{money(c.availableMinor)}</dd></div><div><dt>Destekçi</dt><dd>{c.supporterCount}</dd></div><div><dt>Kitap satış fiyatı</dt><dd>{money(c.unitPriceMinor)}</dd></div></dl>
    <p>{new Date(c.startsAt).toLocaleDateString('tr-TR')} – {new Date(c.endsAt).toLocaleString('tr-TR')} · <Status value={c.productionState} /></p>
    {c.financeIssue && <Feedback error="Finansal uzlaştırma inceleme gerektiriyor; operasyon ekibine bildirildi." />}
    {c.updates?.length > 0 && <details><summary>Basım ve kampanya güncellemeleri</summary><ol className="print-timeline">{c.updates.map(update => <li key={update.id}><time>{new Date(update.createdAt).toLocaleString('tr-TR')}</time><p><Status value={update.state} /> {update.message}</p></li>)}</ol></details>}
  </section>;
}
export function CostBreakdown({ value }) {
  if (!value) return null;
  const labels = { printingMinor: 'Matbaa üretimi', shippingMinor: 'Kargo', packagingMinor: 'Paketleme', taxMinor: 'Vergi', providerFeeMinor: 'Ödeme giderleri', serviceMinor: 'Yayın hizmetleri', otherMinor: 'Diğer giderler', unitProductionMinor: 'Birim üretim', unitShippingMinor: 'Birim kargo', unitPackagingMinor: 'Birim paketleme', unitTaxMinor: 'Birim vergi', unitFeeMinor: 'Birim ödeme gideri', unitServiceMinor: 'Birim hizmet', unitMarginMinor: 'Satış payı' };
  return <dl className="print-stats">{Object.entries(value).map(([key, amount]) => <div key={key}><dt>{labels[key] || key}</dt><dd>{money(amount)}</dd></div>)}</dl>;
}
