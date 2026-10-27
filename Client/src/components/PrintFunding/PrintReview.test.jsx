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
test('admin rejection requires a reason and keeps the decision separate from funding', async () => {
  const pending = { ...application, state: 'SUBMITTED' }, rejected = { ...pending, state: 'REJECTED', revision: 3, reviewNote: 'Kapak teknik ölçüleri uygun değil.' };
  const review = jest.fn(() => ({ data: { reviewPrintApplication: rejected } }));
  render(<MockedProvider addTypename={false} mocks={[
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [pending] } } },
    { request: { query: api.REVIEW_PRINT_APPLICATION, variables: { input: { applicationId: 'application', revision: 2, decision: 'REJECTED', reason: 'Kapak teknik ölçüleri uygun değil.' } } }, result: review },
    { request: { query: api.ADMIN_PRINT_APPLICATIONS, variables: { page: 1 } }, result: { data: { adminPrintApplications: [rejected] } } },
  ]}><MemoryRouter><AdminPrintFunding /></MemoryRouter></MockedProvider>);
  fireEvent.change(await screen.findByLabelText('Karar'), { target: { value: 'REJECTED' } });
  expect(screen.getByLabelText('İnceleme gerekçesi')).toBeRequired();
  fireEvent.change(screen.getByLabelText('İnceleme gerekçesi'), { target: { value: 'Kapak teknik ölçüleri uygun değil.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kararı kaydet' }));
  expect(await screen.findByText('Reddedildi')).toBeInTheDocument();
  await waitFor(() => expect(review).toHaveBeenCalledTimes(1)); expect(screen.getByText(/İnceleme gerekçesi: Kapak teknik/)).toBeInTheDocument();
});
