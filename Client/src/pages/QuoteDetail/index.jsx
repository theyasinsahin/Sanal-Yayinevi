import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import QuoteCard from '../../components/Quote/QuoteCard';
import { GET_QUOTE_BY_ID } from '../../graphql/queries/quote';
import './QuoteDetail.css';

export default function QuoteDetail() {
  const { quoteId } = useParams();
  const { data, loading, error } = useQuery(GET_QUOTE_BY_ID, { variables: { id: quoteId }, fetchPolicy: 'network-only' });
  return <MainLayout><div className="quote-detail-page"><Container maxWidth="3xl">
    <Link className="ui-text-link" to="/quotes">← Alıntılara dön</Link>
    <h1>Kitaptan bir satır</h1>
    {loading ? <p role="status">Alıntı yükleniyor…</p> : error ? <p className="ui-notice ui-notice--error" role="alert">Alıntı yüklenemedi. Lütfen yeniden deneyin.</p> : data?.getQuoteById ? <QuoteCard quote={data.getQuoteById} /> : <p className="ui-notice">Bu alıntı artık mevcut değil veya herkese açık değil.</p>}
  </Container></div></MainLayout>;
}
