import React, { Component, Suspense } from 'react';

export default class PageBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <main className="container" role="alert" style={{ padding: '4rem 1rem' }}>
      <h1>Sayfa yüklenemedi</h1>
      <p>Bağlantınızı kontrol edip sayfayı yeniden yükleyin.</p>
      <button className="ui-text-link" onClick={() => window.location.reload()}>Yeniden yükle</button>
    </main>;
    return <Suspense fallback={<main role="status" aria-live="polite" style={{ padding: '4rem 1rem', textAlign: 'center' }}>Sayfa yükleniyor...</main>}>
      {this.props.children}
    </Suspense>;
  }
}
