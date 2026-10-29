import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../UI/Button';
import { PRINT_OVERVIEW, SET_PRINT_INTEREST } from '../../graphql/printFunding';
import { CampaignCard, Feedback, usePrintAction } from './shared';

export default function BookFundingPanel({ bookId }) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useQuery(PRINT_OVERVIEW, { variables: { bookId }, fetchPolicy: 'cache-and-network', pollInterval: 30000, skipPollAttempt: () => document.visibilityState === 'hidden' });
  const action = usePrintAction(refetch), overview = data?.printOverview;
  return <div>{loading && !overview && <p role="status">Basım bilgileri yükleniyor…</p>}<Feedback error={error || action.error} />
    {overview && <><section className="print-panel"><h3>Bu kitabın basılmasını istiyorum</h3><p>{overview.interestCount} okur basılı kitabı görmek istiyor. Bu ücretsiz ilgi bildirimi ödeme veya teslimat hakkı oluşturmaz.</p>
      {user ? <Button variant="outline" disabled={action.busy || overview.digitalStatus !== 'PUBLISHED'} onClick={() => action.run(SET_PRINT_INTEREST, { bookId, interested: !overview.interested })}>{overview.interested ? 'Basım ilgimi geri çek' : 'Basılmasını istiyorum'}</Button> : <Link to="/login">İlgi bildirmek için giriş yap</Link>}
    </section>{overview.campaign ? <><CampaignCard campaign={overview.campaign} />{overview.campaign.state === 'ACTIVE' && (['SANDBOX', 'IYZICO_SANDBOX'].includes(data.printPaymentMode) ? <Link to={`/donate/${bookId}`}>Destek ve ön sipariş seçenekleri →</Link> : <p className="ui-notice">Kampanya oluşturuldu. Ödemeler ve ön sipariş işlemleri kapalıdır.</p>)}</> : <p className="ui-notice">Bu kitap için henüz onaylı basım kampanyası yok.</p>}</>}
  </div>;
}
