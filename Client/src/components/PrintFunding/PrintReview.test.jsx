import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrintApplication from '../../pages/PrintApplication';
import AdminPrintFunding from '../../pages/Admin/PrintFunding';
import { GET_BOOK_CARD } from '../../graphql/queries/book';
import * as api from '../../graphql/printFunding';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'author' } }) }));
jest.mock('../Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../Admin/AdminLayout', () => ({ __esModule: true, default: ({ children }) => <main>{children}</main> }));
const version = { __typename: 'BookPrintVersion', id: 'version', title: 'Basım Romanı', authorName: 'Yazar', wordCount: 50000, estimatedPages: 200, contentHash: 'server-sha256', specification: { dimension: '13.5x21', coverType: 'paperback', paperType: 'enzo', color: 'BW', printRun: 100, coverAssetId: 'asset', coverDpi: 300, bleedMm: 3, notes: '' }, declarations: { copyright: true, permissions: true, terms: true, termsVersion: 'print-sandbox-v1' } };
const application = { __typename: 'PrintApplication', id: 'application', bookId: 'book', authorId: 'author', revision: 2, state: 'PREPARING', tariffId: 'tariff', estimate: { totalMinor: 100000, label: 'ÖRNEK — matbaa teklifi değildir', tariffVersion: 'example-v1', components: { printingMinor: 100000 } }, verifiedQuote: null, approvedTargetMinor: 0, approvedUnitPriceMinor: 0, reviewNote: '', createdAt: '2026-10-27T10:00:00.000Z', updatedAt: '2026-10-27T10:00:00.000Z', version };
const tariff = { __typename: 'PrintTariff', id: 'tariff', version: 'example-v1', label: 'ÖRNEK SANDBOX', environment: 'SANDBOX', configuration: {}, policy: {} };
const workspace = app => ({ printPaymentMode: 'SANDBOX', printTariffs: [tariff], myPrintApplicationForBook: app, printOverview: { __typename: 'PrintOverview', bookId: 'book', digitalStatus: 'PUBLISHED', writingStatus: 'COMPLETED', interestCount: 4, interested: false, campaign: null } });
const book = { __typename: 'Book', id: 'book', publicPath: '/kitap/roman', title: 'Basım Romanı', description: 'Bir kitap.', imageUrl: '', pageCount: 200, publishDate: '2026-10-27T10:00:00.000Z', status: 'COMPLETED', kind: 'DIGITAL', printedAuthor: '', publisher: '', publicationYear: null, isbn: null, author: { __typename: 'User', id: 'author', username: 'author', fullName: 'Yazar', profilePicture: '' }, genre: null, stats: { __typename: 'BookStats', views: 0, likes: 0 }, commentCount: 0, currentFunding: 0, fundingTarget: 0, backerCount: 0 };

test('author submits a fixed version for review without automatically opening funding', async () => {
  const submitted = { ...application, state: 'SUBMITTED', revision: 3 };
  const save = jest.fn(() => ({ data: { submitPrintApplication: submitted } }));
  render(<MockedProvider addTypename={false} mocks={[
    { request: { query: GET_BOOK_CARD, variables: { id: 'book' } }, result: { data: { getBookById: book } } },
    { request: { query: api.AUTHOR_PRINT_WORKSPACE, variables: { bookId: 'book' } }, result: { data: workspace(application) } },
    { request: { query: api.SUBMIT_PRINT_APPLICATION, variables: { applicationId: 'application', revision: 2 } }, result: save },
    { request: { query: api.AUTHOR_PRINT_WORKSPACE, variables: { bookId: 'book' } }, result: { data: workspace(submitted) } },
  ]}><MemoryRouter initialEntries={['/print/book']}><Routes><Route path="/print/:bookId" element={<PrintApplication />} /></Routes></MemoryRouter></MockedProvider>);
  expect(await screen.findByText('server-sha256')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Başvuruyu incelemeye gönder' }));
  expect(await screen.findByText('İncelemede')).toBeInTheDocument(); expect(save).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /kampanyasını aç/ })).not.toBeInTheDocument();
});
test('admin rejection sends the application ObjectId, not the book or fixed version id', async () => {
  const pending = { ...application, id: '6ae0bb8180e3999005b65cfc', bookId: '6a0ba4a51035fff1bfa50508', version: { ...version, id: '6ae0bb8180e3999005b65cfa' }, state: 'SUBMITTED' }, rejected = { ...pending, state: 'REJECTED', revision: 3, reviewNote: 'Kapak teknik ölçüleri uygun değil.' };
  const review = jest.fn(() => ({ data: { reviewPrintApplication: rejected } }));
  render(<MockedProvider addTypename={false} mocks={[
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [pending] } } },
    { request: { query: api.REVIEW_PRINT_APPLICATION, variables: { input: { applicationId: pending.id, revision: 2, decision: 'REJECTED', reason: 'Kapak teknik ölçüleri uygun değil.' } } }, result: review },
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [rejected] } } },
  ]}><MemoryRouter><AdminPrintFunding /></MemoryRouter></MockedProvider>);
  fireEvent.change(await screen.findByLabelText('Karar'), { target: { value: 'REJECTED' } });
  expect(screen.getByLabelText('İnceleme gerekçesi')).toBeRequired();
  fireEvent.change(screen.getByLabelText('İnceleme gerekçesi'), { target: { value: 'Kapak teknik ölçüleri uygun değil.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }));
  expect(await screen.findByText('Reddedildi')).toBeInTheDocument();
  await waitFor(() => expect(review).toHaveBeenCalledTimes(1)); expect(screen.getByText(/İnceleme gerekçesi: Kapak teknik/)).toBeInTheDocument();
});

test('admin can refresh an empty list and see a newly submitted application for review', async () => {
  render(<MockedProvider addTypename={false} mocks={[
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [] } } },
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [{ ...application, state: 'SUBMITTED' }] } } },
  ]}><MemoryRouter><AdminPrintFunding /></MemoryRouter></MockedProvider>);
  expect(await screen.findByText('Bu sayfada başvuru yok.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Başvuruları yenile' }));
  expect(await screen.findByText('İncelemede')).toBeInTheDocument();
  expect(screen.getByLabelText('Karar')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Onayla' })).toBeInTheDocument();
  expect(screen.queryByText('Bu sayfada başvuru yok.')).not.toBeInTheDocument();
});

test('approval waits for both uploaded PDFs and sends separate application and file ObjectIds', async () => {
  const pending = { ...application, id: '6ae0bb8180e3999005b65cfc', bookId: '6a0ba4a51035fff1bfa50508', version: { ...version, id: '6ae0bb8180e3999005b65cfa' }, state: 'SUBMITTED' };
  const layoutAssetId = '6ae0bb8180e3999005b65001', quoteAssetId = '6ae0bb8180e3999005b65002';
  const approved = { ...pending, state: 'APPROVED', revision: 3 };
  const review = jest.fn(() => ({ data: { reviewPrintApplication: approved } }));
  const input = { applicationId: pending.id, revision: 2, decision: 'APPROVED', reason: 'Dosyalar teknik olarak incelendi.', quote: {
    source: 'SANDBOX örnek matbaa teklifi', confirmedPages: 24, layoutAssetId, quoteAssetId, preflightConfirmed: true,
    components: { printingMinor: 100000, shippingMinor: 0, packagingMinor: 0, taxMinor: 0, providerFeeMinor: 0, serviceMinor: 0, otherMinor: 0 },
    sale: { unitProductionMinor: 1000, unitShippingMinor: 0, unitPackagingMinor: 0, unitTaxMinor: 0, unitFeeMinor: 0, unitServiceMinor: 0, unitMarginMinor: 1000 },
  } };
  const previousFetch = global.fetch;
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: layoutAssetId }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: quoteAssetId }) });
  try {
    render(<MockedProvider addTypename={false} mocks={[
      { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [pending] } } },
      { request: { query: api.REVIEW_PRINT_APPLICATION, variables: { input } }, result: review },
      { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [approved] } } },
    ]}><MemoryRouter><AdminPrintFunding /></MemoryRouter></MockedProvider>);
    fireEvent.change(await screen.findByLabelText('Karar'), { target: { value: 'APPROVED' } });
    for (const [label, value] of [['İnceleme gerekçesi', input.reason], ['Matbaa / yayınevi teklif referansı', input.quote.source], ['Mizanpajdan doğrulanmış kesin sayfa', '24'], ['Matbaa üretimi', '1000'], ['Birim üretim', '10'], ['Satış payı', '10']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByLabelText(/Son metni, mizanpaj/));
    fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Onay için son mizanpaj PDF dosyasını yükleyin');
    expect(review).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Onaylanacak son mizanpaj PDF'), { target: { files: [new File(['%PDF-1.4\n%%EOF'], 'layout.pdf', { type: 'application/pdf' })] } });
    await screen.findByText(layoutAssetId);
    fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Onay için matbaa teklif PDF dosyasını yükleyin');
    expect(review).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Matbaa teklif PDF'), { target: { files: [new File(['%PDF-1.4\n%%EOF'], 'quote.pdf', { type: 'application/pdf' })] } });
    await screen.findByText(quoteAssetId);
    fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }));
    expect(await screen.findByText('Onaylandı')).toBeInTheDocument();
    expect(review).toHaveBeenCalledTimes(1);
  } finally { global.fetch = previousFetch; }
});

test('an invalid application id is not replaced with a book or version id', async () => {
  render(<MockedProvider addTypename={false} mocks={[
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [{ ...application, id: 'undefined', state: 'SUBMITTED' }] } } },
  ]}><MemoryRouter><AdminPrintFunding /></MemoryRouter></MockedProvider>);
  fireEvent.change(await screen.findByLabelText('Karar'), { target: { value: 'REJECTED' } });
  fireEvent.change(screen.getByLabelText('İnceleme gerekçesi'), { target: { value: 'Teknik dosya revize edilmeli.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Başvuru kimliği alınamadı. Başvuru listesini yenileyin.');
});

test('admin opens an approved campaign as a separate action without enabling payments', async () => {
  const approved = { ...application, id: '6ae0bb8180e3999005b65cfc', state: 'APPROVED' };
  const campaign = { id: '6ae0bb8180e3999005b65003', bookId: 'book', authorId: 'author', applicationId: approved.id, versionId: version.id, title: version.title, environment: 'SANDBOX', state: 'ACTIVE', outcome: null, targetMinor: 100000, acceptedMinor: 0, reservedMinor: 0, availableMinor: 100000, unitPriceMinor: 50000, printRun: 100, soldQuantity: 0, reservedQuantity: 0, supporterCount: 0, progressPercent: 0, startsAt: '2026-10-29T10:00:00Z', endsAt: '2026-11-28T10:00:00Z', productionState: 'NOT_STARTED', previousProductionState: null, productionRevision: 0, financeIssue: '', policy: {}, updates: [] };
  const opened = jest.fn(() => ({ data: { openFundingCampaign: campaign } }));
  render(<MockedProvider addTypename={false} mocks={[
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [approved] } } },
    { request: { query: api.OPEN_FUNDING_CAMPAIGN, variables: { input: { applicationId: approved.id, revision: approved.revision, days: 30 } } }, result: opened },
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [{ ...approved, revision: 3 }] } } },
  ]}><MemoryRouter><AdminPrintFunding /></MemoryRouter></MockedProvider>);
  expect(await screen.findByText(/Kampanyayı oluşturmak ödeme sistemini etkinleştirmez/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Onaylı sürüm, hedef ve satış fiyatıyla/));
  fireEvent.click(screen.getByRole('button', { name: 'Onaylı sandbox kampanyasını aç' }));
  await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByLabelText(/Onaylı sürüm, hedef ve satış fiyatıyla/)).not.toBeChecked());
});
