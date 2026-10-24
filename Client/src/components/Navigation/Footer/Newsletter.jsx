import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../UI/Button';
import { useMutation } from '@apollo/client';
import { SUBSCRIBE_NEWSLETTER } from '../../../graphql/mutations/community';

export default function Newsletter() {
  const [subscribeNewsletter] = useMutation(SUBSCRIBE_NEWSLETTER);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setResult(null);
    try {
      const response = await subscribeNewsletter({ variables: { input: { email: data.get('email'), consent: data.get('consent') === 'on', website: data.get('website') } } });
      setResult({ message: response.data.subscribeNewsletter.message }); form.reset();
    } catch (error) { setResult({ error: true, message: error.message }); }
    finally { setBusy(false); }
  }
  return <form className="newsletter-form" onSubmit={submit} aria-label="Bülten aboneliği">
    <label htmlFor="newsletter-email">E-posta adresiniz</label>
    <input id="newsletter-email" name="email" type="email" autoComplete="email" required maxLength={254} className="footer-input" />
    <div hidden><label>Web sitesi<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="newsletter-consent"><input name="consent" type="checkbox" required /> Betik gelişmelerini e-postayla almak istiyorum. Her zaman abonelikten çıkabilirim.</label>
    <Link to="/privacy">Verileriniz nasıl işlenir?</Link>
    <Button type="submit" isLoading={busy}>Abone Ol</Button>
    {result && <p role={result.error ? 'alert' : 'status'}>{result.message}</p>}
  </form>;
}
