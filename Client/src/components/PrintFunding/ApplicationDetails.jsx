import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { PRINT_APPLICATION_DETAIL } from '../../graphql/printFunding';
import { CostBreakdown, DownloadAsset, Feedback, money, Status } from './shared';

export default function ApplicationDetails({ application, showContent = false }) {
  const [expanded, setExpanded] = useState(showContent);
  const { data, loading, error } = useQuery(PRINT_APPLICATION_DETAIL, { variables: { id: application.id }, skip: !expanded, fetchPolicy: 'network-only' });
  const version = application.version, quote = application.verifiedQuote;
  return <>
    <p>{version.authorName} · {version.wordCount.toLocaleString('tr-TR')} kelime · tahmini {version.estimatedPages} sayfa</p>
    <p className="print-muted">Kesin sayfa sayısı seçilen boyut, yazı tipi, mizanpaj ve matbaa ön kontrolünden sonra doğrulanır. Editör sayfa sayısı baskı sayfası değildir.</p>
    <p>Sabitleştirilmiş sürüm: <code>{version.id}</code><br />SHA-256: <code>{version.contentHash}</code></p>
    <DownloadAsset id={version.specification.coverAssetId}>Kapak PDF dosyasını indir</DownloadAsset>
    <details><summary>Baskı özellikleri ve beyanlar</summary><pre>{JSON.stringify({ specification: version.specification, declarations: version.declarations }, null, 2)}</pre></details>
    <details><summary>Tahmini maliyet: {money(application.estimate.totalMinor)}</summary><p className="print-sandbox">{application.estimate.label} · {application.estimate.tariffVersion}</p><CostBreakdown value={application.estimate.components} /></details>
    {quote && <details open><summary>Doğrulanmış teklif ve onaylı hedef</summary><p>{quote.source} · {quote.confirmedPages} kesin sayfa</p><CostBreakdown value={quote.components} /><p>Onaylı hedef: <strong>{money(application.approvedTargetMinor)}</strong></p><p>Onaylı birim satış fiyatı: <strong>{money(application.approvedUnitPriceMinor)}</strong></p><CostBreakdown value={quote.sale} /><div className="print-actions"><DownloadAsset id={quote.layoutAssetId}>Mizanpaj PDF</DownloadAsset><DownloadAsset id={quote.quoteAssetId}>Matbaa teklif PDF</DownloadAsset></div></details>}
    {application.reviewNote && <p className="ui-notice">İnceleme gerekçesi: {application.reviewNote}</p>}
    <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary>Son metin, önceki sürümler ve başvuru geçmişi</summary>
      {loading && <p role="status">Sürümler yükleniyor…</p>}<Feedback error={error} />
      {data?.printApplicationVersions?.map(item => <details key={item.id}><summary>{new Date(item.createdAt).toLocaleString('tr-TR')} · {item.id}</summary><p>SHA-256: <code>{item.contentHash}</code></p>{item.chapters.map(chapter => <div key={chapter.sourceId}><h4>{chapter.title}</h4><pre>{chapter.content}</pre></div>)}</details>)}
      <ol className="print-timeline">{data?.printApplicationHistory?.map(item => <li key={item.id}><time>{new Date(item.createdAt).toLocaleString('tr-TR')}</time><p>{item.action} <Status value={item.to} /> {item.reason}</p></li>)}</ol>
    </details>
  </>;
}
