import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_BOOK_CLASSIFICATION } from '../../../graphql/classification';
import ClassificationFields, { classificationFromBook, classificationInput, classificationError } from './ClassificationFields';
import { Button } from '../../UI/Button';

export default function ClassificationEditor({ book }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => classificationFromBook(book));
  const [error, setError] = useState('');
  const [save, { loading }] = useMutation(UPDATE_BOOK_CLASSIFICATION);
  const submit = async () => {
    const invalid = classificationError(value);
    if (invalid) { setError(invalid); return; }
    try { await save({ variables: { bookId: book.id, classification: classificationInput(value) } }); setOpen(false); setError(''); }
    catch (failure) { setError(failure.message); }
  };
  if (!open) return <Button type="button" variant="outline" onClick={() => { setValue(classificationFromBook(book)); setError(''); setOpen(true); }}>Sınıflandırmayı düzenle</Button>;
  return <section className="classification-editor" aria-label="Sınıflandırmayı düzenle">
    <ClassificationFields value={value} onChange={setValue} existing={book} disabled={loading} />
    {error && <p role="alert">{error}</p>}
    <div className="classification-actions"><Button type="button" onClick={submit} isLoading={loading}>Sınıflandırmayı kaydet</Button><Button type="button" variant="ghost" disabled={loading} onClick={() => setOpen(false)}>İptal</Button></div>
  </section>;
}
