import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import PrintCheckout from '../../pages/PrintCheckout';
import FundingHistory from '../../pages/FundingHistory';
import BookFundingPanel from './BookFundingPanel';
import PaymentCard from './PaymentCard';
import { money, toMinor } from './shared';
import * as api from '../../graphql/printFunding';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'reader' } }) }));
jest.mock('../Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
const campaign = { id: 'campaign', bookId: 'book', authorId: 'author', applicationId: 'application', versionId: 'version', title: 'Test Romanı', environment: 'SANDBOX', state: 'ACTIVE', outcome: null, targetMinor: 100000, acceptedMinor: 0, reservedMinor: 0, availableMinor: 100000, unitPriceMinor: 20000, printRun: 10, soldQuantity: 0, reservedQuantity: 0, supporterCount: 0, progressPercent: 0, startsAt: '2026-10-27T10:00:00.000Z', endsAt: '2026-11-26T10:00:00.000Z', productionState: 'NOT_STARTED', previousProductionState: null, productionRevision: 0, financeIssue: '', policy: { maxOrderQuantity: 10, donationMinMinor: 5000, donationMaxMinor: 10000000, quickAmountsMinor: [5000, 10000, 25000, 50000] }, updates: [] };
const overview = (changes = {}) => ({ printPaymentMode: 'SANDBOX', printOverview: { bookId: 'book', digitalStatus: 'PUBLISHED', writingStatus: 'COMPLETED', interestCount: 12, interested: false, campaign, ...changes } });
const payment = { id: 'payment', campaignId: 'campaign', bookId: 'book', provider: 'SANDBOX', amountMinor: 5000, donationMinor: 5000, orderMinor: 0, quantity: 0, currency: 'TRY', state: 'PENDING', allocated: false, captured: false, createdAt: '2026-10-27T10:00:00.000Z', reservation: { state: 'HELD', expiresAt: '2026-10-27T10:15:00.000Z' }, order: null, refund: null };
campaign.__typename = 'FundingCampaign';
payment.__typename = 'FundingPayment'; payment.reservation.__typename = 'PrintPaymentReservation';
payment.issue = '';
payment.checkoutUrl = null;
const overviewMock = data => ({ request: { query: api.PRINT_OVERVIEW, variables: { bookId: 'book' } }, result: { data: { ...data, printOverview: { ...data.printOverview, __typename: 'PrintOverview' } } } });
function show(element, mocks, path = '/donate/book', currentPayment = payment) {
  const responses = [...mocks, { request: { query: api.MY_FUNDING_PAYMENT, variables: { id: 'payment' } }, result: { data: { myFundingPayment: currentPayment } } }];
  return render(<MockedProvider mocks={responses} addTypename={false}><MemoryRouter initialEntries={[path]}><Routes><Route path="/donate/:bookId" element={element} /><Route path="/funding-history" element={element} /></Routes></MemoryRouter></MockedProvider>);
}
beforeEach(() => { sessionStorage.clear(); Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'test-idempotency-00000001' } }); });

test('currency conversion rejects fractions beyond kuruş and never rounds an entered amount', () => {
  expect(toMinor('19,99')).toBe(1999); expect(toMinor('0.01')).toBe(1); expect(toMinor('500')).toBe(50000);
  for (const value of ['1.001', '-1', '1e3', 'NaN', '']) expect(() => toMinor(value)).toThrow();
});
test('donation checkout sends only intent, locks duplicate clicks and clearly shows sandbox payment', async () => {
  const created = jest.fn(() => ({ data: { startPrintCheckout: payment } }));
  show(<PrintCheckout />, [overviewMock(overview()), overviewMock(overview()), { request: { query: api.START_PRINT_CHECKOUT, variables: { input: { campaignId: 'campaign', idempotencyKey: 'test-idempotency-00000001', quantity: 0, donationMinor: 5000 } } }, result: created, delay: 25 }]);
  expect(await screen.findByText('Sepet')).toBeInTheDocument();
  expect(screen.getByText(/Karşılıksız destek fiziksel kitap hakkı vermez/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Sepetin tam bedeline/));
  const submit = screen.getByRole('button', { name: 'Test ödeme rezervasyonu oluştur' }); fireEvent.click(submit); fireEvent.click(submit);
  expect(await screen.findByText('payment')).toBeInTheDocument(); expect(created).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Test ödemesini başarılı sonuçlandır' })).toBeInTheDocument();
  expect(screen.queryByText('Ön sipariş onaylandı')).not.toBeInTheDocument();
});
test('mixed cart sends quantity and extra support, requires delivery consent and uses server total', async () => {
  const address = { fullName: 'Test Alıcı', phone: '05555555555', city: 'İstanbul', district: 'Kadıköy', postalCode: '34700', line: 'Test teslimat açık adresi', consent: true };
  const response = { ...payment, amountMinor: 45000, donationMinor: 5000, orderMinor: 40000, quantity: 2 };
  const created = jest.fn(() => ({ data: { startPrintCheckout: response } }));
  show(<PrintCheckout />, [overviewMock(overview()), overviewMock(overview()), { request: { query: api.START_PRINT_CHECKOUT, variables: { input: { campaignId: 'campaign', idempotencyKey: 'test-idempotency-00000001', quantity: 2, donationMinor: 5000, shippingAddress: address } } }, result: created }], '/donate/book', response);
  fireEvent.change(await screen.findByLabelText('Fiziksel kitap adedi'), { target: { value: '2' } });
  for (const [label, field] of [['Alıcı adı soyadı', 'fullName'], ['Telefon', 'phone'], ['İl', 'city'], ['İlçe', 'district'], ['Posta kodu', 'postalCode'], ['Açık adres', 'line']]) fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: address[field] } });
  fireEvent.click(screen.getByLabelText(/Teslimat bilgilerimin/)); fireEvent.click(screen.getByLabelText(/Sepetin tam bedeline/));
  expect(screen.getByText(`Sepet toplamı: ${money(45000)}`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Test ödeme rezervasyonu oluştur' }));
  expect(await screen.findByText('payment')).toBeInTheDocument(); expect(created).toHaveBeenCalledTimes(1);
});
test.each(['ACTIVE', 'CLOSING'])('disabled payments prevent checkout even when campaign state is %s', async state => {
  show(<PrintCheckout />, [overviewMock({ ...overview(), printPaymentMode: 'DISABLED', printOverview: { ...overview().printOverview, campaign: { ...campaign, state } } })]);
  expect(await screen.findByText(/Ödemeler kapalı/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Test ödeme rezervasyonu oluştur' })).toBeDisabled();
});

test('an active campaign with disabled payments shows its progress without offering checkout', async () => {
  show(<BookFundingPanel bookId="book" />, [overviewMock({ ...overview(), printPaymentMode: 'DISABLED' })]);
  expect(await screen.findByText('Kampanya oluşturuldu. Ödemeler ve ön sipariş işlemleri kapalıdır.')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Kampanya ilerlemesi' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Destek ve ön sipariş seçenekleri/ })).not.toBeInTheDocument();
});
test('a lost checkout response retains the same operation key and prevents cart changes', async () => {
  const request = { query: api.START_PRINT_CHECKOUT, variables: { input: { campaignId: 'campaign', idempotencyKey: 'test-idempotency-00000001', quantity: 0, donationMinor: 5000 } } };
  show(<PrintCheckout />, [overviewMock(overview()), overviewMock(overview()), { request, error: new Error('Yanıt kayboldu') }, { request, result: { data: { startPrintCheckout: payment } } }]);
  fireEvent.click(await screen.findByLabelText(/Sepetin tam bedeline/)); fireEvent.click(screen.getByRole('button', { name: 'Test ödeme rezervasyonu oluştur' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Yanıt kayboldu');
  expect(screen.getByLabelText('Fiziksel kitap adedi')).toBeDisabled(); fireEvent.click(screen.getByRole('button', { name: 'Aynı işlemi güvenle yeniden sorgula' }));
  expect(await screen.findByText('payment')).toBeInTheDocument();
});

test('iyzico sandbox enables funding and provides only the hosted test-card checkout', async () => {
  const hosted = { ...payment, provider: 'IYZICO_SANDBOX', checkoutUrl: 'https://sandbox-cpp.iyzipay.com/?token=test-token' };
  const data = { ...overview(), printPaymentMode: 'IYZICO_SANDBOX' };
  show(<PrintCheckout />, [overviewMock(data), overviewMock(data), {
    request: { query: api.START_PRINT_CHECKOUT, variables: { input: { campaignId: 'campaign', idempotencyKey: 'test-idempotency-00000001', quantity: 0, donationMinor: 5000 } } },
    result: { data: { startPrintCheckout: hosted } },
  }], '/donate/book', hosted);
  fireEvent.click(await screen.findByLabelText(/Sepetin tam bedeline/));
  fireEvent.click(screen.getByRole('button', { name: 'iyzico test ödemesine geç' }));
  expect(await screen.findByRole('link', { name: 'iyzico ile test kartıyla öde' })).toHaveAttribute('href', hosted.checkoutUrl);
  expect(screen.queryByRole('button', { name: 'Test ödemesini başarılı sonuçlandır' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Başarısız ödeme dene' })).not.toBeInTheDocument();
});

test('iyzico sandbox campaigns expose the support link', async () => {
  show(<BookFundingPanel bookId="book" />, [overviewMock({ ...overview(), printPaymentMode: 'IYZICO_SANDBOX' })]);
  expect(await screen.findByRole('link', { name: /Destek ve ön sipariş seçenekleri/ })).toHaveAttribute('href', '/donate/book');
});

test.each(['DISABLED', 'SANDBOX'])('an existing iyzico checkout does not expose a payment or simulation action in %s mode', mode => {
  const hosted = { ...payment, provider: 'IYZICO_SANDBOX', checkoutUrl: 'https://sandbox-cpp.iyzipay.com/?token=test-token' };
  show(<PaymentCard payment={hosted} mode={mode} refresh={jest.fn()} />, []);
  expect(screen.queryByRole('link', { name: 'iyzico ile test kartıyla öde' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Test ödemesini başarılı sonuçlandır' })).not.toBeInTheDocument();
});
test('history renders refund failure and shipment tracking from server records', async () => {
  const paid = { ...payment, state: 'REFUND_PENDING', captured: true, refund: { __typename: 'FundingRefund', id: 'refund', paymentId: 'payment', amountMinor: 5000, reason: 'CAMPAIGN_UNSUCCESSFUL', state: 'FAILED', attempts: 2, lastError: 'PROVIDER_OR_DATABASE_ERROR', retryAt: null, providerRefundId: null }, order: { __typename: 'PrintPreOrder', id: 'order', paymentId: 'payment', campaignId: 'campaign', quantity: 1, unitPriceMinor: 20000, totalMinor: 20000, state: 'SHIPPED', previousState: null, revision: 3, carrier: 'Test Kargo', trackingNumber: 'TEST-123', createdAt: payment.createdAt } };
  show(<FundingHistory />, [{ request: { query: api.MY_FUNDING_HISTORY, variables: { page: 1 } }, result: { data: { printPaymentMode: 'SANDBOX', myFundingPayments: [paid] } } }], '/funding-history');
  expect(await screen.findByText(/Test Kargo · Takip: TEST-123/)).toBeInTheDocument(); expect(screen.getByRole('alert')).toHaveTextContent('İade henüz tamamlanamadı');
  expect(screen.queryByRole('button', { name: 'Test ödemesini başarılı sonuçlandır' })).not.toBeInTheDocument();
});
test('free print interest is visibly separate from support and toggles through its own mutation', async () => {
  const changed = jest.fn(() => ({ data: { setPrintInterest: true } }));
  show(<BookFundingPanel bookId="book" />, [overviewMock(overview({ campaign: null })), { request: { query: api.SET_PRINT_INTEREST, variables: { bookId: 'book', interested: true } }, result: changed }, overviewMock(overview({ campaign: null, interested: true, interestCount: 13 }))]);
  fireEvent.click(await screen.findByRole('button', { name: 'Basılmasını istiyorum' }));
  expect(await screen.findByRole('button', { name: 'Basım ilgimi geri çek' })).toBeInTheDocument(); expect(changed).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/13 okur/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Basım ilgimi geri çek' })).toBeEnabled());
});
