// Packets retain their sequence number until the server acknowledges them.
export class ReadingTracker {
  constructor({ userId, bookId, chapter, start, report, storage, onStatus = () => {}, now = Date.now }) {
    Object.assign(this, { userId, bookId, chapter, startRequest: start, report, storage, onStatus, now });
    this.prefix = `betik:reading:${userId}:${bookId}:`;
    this.queueMs = 0; this.sequence = 0; this.pending = null;
    this.waiters = [];
    this.lastTick = now(); this.lastActivity = now(); this.stopped = false;
  }
  key() { return this.prefix + this.sessionId; }
  persist() {
    if (!this.sessionId) return;
    try { this.storage.setItem(this.key(), JSON.stringify({ sessionId: this.sessionId, sequence: this.sequence, pending: this.pending, queueMs: this.queueMs, savedAt: this.now() })); } catch { /* Browser storage is optional. */ }
  }
  async open() {
    const keys = [];
    try { for (let i = 0; i < this.storage.length; i++) { const key = this.storage.key(i); if (key?.startsWith(this.prefix)) keys.push(key); } } catch { /* Browser storage is optional. */ }
    for (const key of keys) {
      try {
        const old = JSON.parse(this.storage.getItem(key));
        if (this.now() - old.savedAt < 120000) {
          let sequence = old.sequence;
          if (old.pending) { await this.report(old.pending, false); sequence = old.pending.sequence; }
          const seconds = Math.min(60, Math.floor(old.queueMs / 1000));
          if (seconds) await this.report({ sessionId: old.sessionId, sequence: sequence + 1, seconds, chapterId: this.chapter() }, false);
        }
        this.storage.removeItem(key);
      } catch (error) {
        if (!error.terminal) { this.onStatus('error'); return; }
        try { this.storage.removeItem(key); } catch { /* Optional persistence. */ }
      }
    }
    if (this.stopped) return;
    try {
      this.sessionId = await this.startRequest(this.bookId, this.chapter());
      this.lastTick = this.now(); this.lastActivity = this.now();
      this.lastConfirmedAt = this.now();
      this.onStatus('tracking');
    } catch { this.onStatus('error'); }
  }
  activity() {
    this.lastActivity = this.now();
    if (this.sessionId && this.now() - this.lastConfirmedAt >= 110000) this.flush();
  }
  tick(visible) {
    const now = this.now();
    const elapsed = now - this.lastTick;
    if (this.sessionId && !this.stopped && visible && now - this.lastConfirmedAt < 120000 && now - this.lastActivity <= 120000 && elapsed >= 0 && elapsed <= 2000) {
      this.queueMs += elapsed;
      this.persist();
    }
    this.lastTick = now;
  }
  async flush(keepalive = false) {
    if (!keepalive && !this.sending && this.sessionId && !this.pending && this.queueMs < 1000 && this.now() - this.lastActivity < 120000 && this.now() - this.lastConfirmedAt >= 110000) {
      try { this.storage.removeItem(this.key()); } catch { /* Optional persistence. */ }
      this.sessionId = null; this.sequence = 0; this.queueMs = 0;
    }
    if (!this.sessionId) { if (!keepalive && !this.stopped && !this.opening && this.now() - this.lastActivity < 120000) { this.opening = this.open().finally(() => { this.opening = null; }); await this.opening; } return; }
    if (this.sending) {
      // Replay an in-flight packet on page close; the sequence prevents duplicates.
      if (keepalive && this.pending) this.report(this.pending, true).catch(() => {});
      return new Promise(resolve => this.waiters.push(resolve));
    }
    this.sending = true;
    try {
      while (this.pending || this.queueMs >= 1000) {
        if (!this.pending) {
          const seconds = Math.min(60, Math.floor(this.queueMs / 1000));
          this.queueMs -= seconds * 1000;
          this.pending = { sessionId: this.sessionId, sequence: this.sequence + 1, seconds, chapterId: this.chapter() };
        }
        this.persist(); this.onStatus('saving');
        const result = await this.report(this.pending, keepalive);
        if (result.acceptedSeconds > 0) this.lastConfirmedAt = this.now();
        this.sequence = this.pending.sequence; this.pending = null;
        this.persist();
      }
      this.onStatus('tracking');
    } catch (error) {
      this.onStatus(error.replaced ? 'paused' : 'error');
      if (error.terminal) {
        try { this.storage.removeItem(this.key()); } catch { /* Optional persistence. */ }
        this.sessionId = null; this.pending = null; this.queueMs = 0; this.sequence = 0;
        if (error.replaced) this.stopped = true;
      }
    } finally { this.sending = false; this.waiters.splice(0).forEach(resolve => resolve()); }
  }
  async stop() { this.stopped = true; if (this.opening) await this.opening; this.persist(); return this.flush(true); }
}
