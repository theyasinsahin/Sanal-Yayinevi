import React, { useId } from 'react';

const amount = minor => `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)} TL`;
const percent = value => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value);

export default function BookFundingProgress({ funding }) {
  const labelId = useId();
  const open = funding?.isOpen && new Date(funding.endsAt) > new Date();
  if (!funding || funding.targetMinor <= 0 || (!open && !funding.goalReached)) return null;
  return <div className="book-funding-progress">
    <div className="book-funding-labels"><span id={labelId}>{funding.goalReached ? 'Hedef tamamlandı' : 'Desteğe açık'}</span>
      {funding.environment === 'SANDBOX' && <span className="book-funding-test">Test kampanyası</span>}
    </div>
    <progress aria-labelledby={labelId} max={100} value={funding.progressPercent} />
    <p><strong>{amount(funding.acceptedMinor)}</strong> / {amount(funding.targetMinor)} hedef</p>
    <p className="book-funding-percent">Tamamlanma: %{percent(funding.progressPercent)}</p>
    {funding.goalReached && funding.state !== 'SUCCEEDED' && <p className="book-funding-percent">Kampanya sonucu doğrulanıyor.</p>}
  </div>;
}
