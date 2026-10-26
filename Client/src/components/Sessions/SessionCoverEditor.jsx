import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_SESSION_COVER } from '../../graphql/queries/session';
import { Button } from '../UI/Button';
import SessionCoverField from './SessionCoverField';
import { DEFAULT_SESSION_COVER } from './SessionCover';

export default function SessionCoverEditor({ session, onClose }) {
  const [cover, setCover] = useState(session.coverImageUrl === DEFAULT_SESSION_COVER ? '' : session.coverImageUrl || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [update, { loading }] = useMutation(UPDATE_SESSION_COVER);
  const save = async () => {
    setError('');
    try { await update({ variables: { sessionId: session.id, coverImageUrl: cover } }); onClose(); }
    catch (failure) { setError(failure.message || 'Kapak kaydedilemedi.'); }
  };
  return <section className="session-cover-editor" aria-label="Oturum kapağını düzenle">
    <SessionCoverField value={cover} onChange={setCover} onLoadingChange={setUploading} disabled={loading || uploading} />
    {error && <p className="ui-notice" role="alert">{error}</p>}
    <div className="session-cover-editor-actions">
      <Button variant="primary" disabled={uploading} isLoading={loading} onClick={save}>Kapağı kaydet</Button>
      <Button variant="ghost" disabled={loading} onClick={onClose}>İptal</Button>
    </div>
  </section>;
}
