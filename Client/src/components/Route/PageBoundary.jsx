import React, { Component, Suspense } from 'react';
import './PageBoundary.css';

// Sayfa yüklenirken sayfaları çevrilen küçük bir kitap gösterilir
const PageLoading = () => (
  <main className="page-boundary" role="status" aria-live="polite">
    <span className="page-loader" aria-hidden="true">
      <span className="page-loader__page" />
      <span className="page-loader__page" />
      <span className="page-loader__page" />
    </span>
    <p className="page-boundary__text">Sayfa yükleniyor...</p>
  </main>
);

export default class PageBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <main className="page-boundary page-boundary--error" role="alert">
      <p className="eyebrow">Bir aksilik oldu</p>
      <h1>Sayfa yüklenemedi</h1>
      <p className="page-boundary__text">Bağlantınızı kontrol edip sayfayı yeniden yükleyin.</p>
      <button type="button" className="btn btn-primary btn-medium" onClick={() => window.location.reload()}>Yeniden yükle</button>
    </main>;
    return <Suspense fallback={<PageLoading />}>
      {this.props.children}
    </Suspense>;
  }
}
