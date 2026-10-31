import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { MainLayout } from '../../components/Layout/MainLayout';
import { MY_FUNDING_HISTORY } from '../../graphql/printFunding';
import { Feedback, Pager } from '../../components/PrintFunding/shared';
import PaymentCard from '../../components/PrintFunding/PaymentCard';
import './FundingHistory.css';


export default function FundingHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(MY_FUNDING_HISTORY, { variables: { page }, fetchPolicy: 'network-only', pollInterval: 15000, skipPollAttempt: () => document.visibilityState === 'hidden' });
  return <MainLayout>
    <div className="print-page funding-history-page">
    <Link to="/profile">← Profilime dön</Link><h1>Desteklerim ve ön siparişlerim</h1>
    <p className="print-sandbox">Bu ekrandaki işlemler SANDBOX test kayıtlarıdır. Geçmiş canlı işlem kayıtları bunlarla birleştirilmez.</p>
    {loading && <p role="status">İşlemler yükleniyor…</p>}<Feedback error={error} />
    {data?.myFundingPayments.map(payment => <PaymentCard key={payment.id} payment={payment} mode={data.printPaymentMode} refresh={refetch} />)}
    {data?.myFundingPayments.length === 0 && <p>Henüz destek veya ön sipariş işleminiz yok.</p>}
    <Pager page={page} setPage={setPage} count={data?.myFundingPayments.length || 0} />
  </div></MainLayout>;
}
