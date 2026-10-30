import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import PrintedBooks from './index';
import PrintedBookDetail from '../../components/Books/PrintedBookDetail';
import AdminPrintedBooks from '../Admin/PrintedBooks';
import { useAuth } from '../../context/AuthContext';
import { GET_PRINTED_BOOKS, GET_MY_PRINTED_SUBMISSIONS, LOOKUP_PRINTED_BOOK, SUBMIT_PRINTED_BOOK, REQUEST_BOOK_CLAIM, CREATE_PRINTED_QUOTE, GET_PRINTED_REVIEWS, REVIEW_PRINTED_BOOK } from '../../graphql/printedBooks';
import { GET_QUOTES_BY_BOOK } from '../../graphql/queries/quote';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/Admin/AdminLayout', () => ({ __esModule: true, default: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/Quote/QuoteCard', () => ({ __esModule: true, default: ({ quote }) => <blockquote>{quote.text}</blockquote> }));
jest.mock('../../components/Comments/CommentList', () => ({ __esModule: true, default: () => <div>Comments list</div> }));
jest.mock('../../components/Books/PrintedReadingEditor', () => () => <section>Reading editor</section>);

const book = { id: 'printed', title: 'Raflardaki Kitap', printedAuthor: 'Bir Yazar', publisher: 'Yayınevi', publicationYear: 2020, isbn: '9780140328721', imageUrl: '', pageCount: 200, description: 'Basılı eser için uzun bir tanıtım metni.', kind: 'PRINTED', publicationStatus: 'APPROVED', authorId: null, author: null, canEditContent: false, purchaseUrl: 'https://example.test/buy', chapters: [], myClaim: null };
const catalog = books => ({ request: { query: GET_PRINTED_BOOKS, variables: { page: 1, search: '' } }, result: { data: { getPrintedBooks: { books, total: books.length, page: 1, totalPages: 1 } } } });
const mine = () => ({ request: { query: GET_MY_PRINTED_SUBMISSIONS }, result: { data: { getMyPrintedSubmissions: [] } } });
const quotes = () => ({ request: { query: GET_QUOTES_BY_BOOK, variables: { bookId: book.id } }, result: { data: { getQuotesByBook: [] } } });
const show = (element, mocks = []) => render(<MockedProvider mocks={mocks} addTypename={false}><MemoryRouter>{element}</MemoryRouter></MockedProvider>);
const detail = overrides => <PrintedBookDetail book={{ ...book, ...overrides }} comments={[]} currentUserId="reader" commentText="" onCommentChange={jest.fn()} onCommentSubmit={jest.fn()} refresh={jest.fn()} />;
beforeEach(() => { useAuth.mockReturnValue({ user: { id: 'reader' }, ensureSession: () => ({ id: 'reader' }) }); });

test('approved print editions have a separate catalog card and do not show funding controls', async () => {
  useAuth.mockReturnValue({ user: null });
  show(<PrintedBooks />, [catalog([book])]);
  expect(await screen.findByRole('heading', { name: book.title })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Kitabı incele/ })).toHaveAttribute('href', '/book-detail/printed');
  expect(screen.getByText(book.printedAuthor)).toBeInTheDocument();
  expect(screen.queryByText(/Fonlama/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Kitap eklemek için giriş yapın' })).toHaveAttribute('href', '/login');
});

test('ISBN lookup fills metadata but preserves manual submission when the provider has no record', async () => {
  show(<PrintedBooks />, [catalog([]), mine(), { request: { query: LOOKUP_PRINTED_BOOK, variables: { isbn: book.isbn } }, result: { data: { lookupPrintedBook: { isbn: book.isbn, found: false, title: null, printedAuthor: null, publisher: null, publicationYear: null, pageCount: null, imageUrl: null } } } }]);
  fireEvent.click(screen.getByRole('button', { name: 'Basılı kitap ekle' }));
  fireEvent.change(screen.getByLabelText('ISBN (varsa)'), { target: { value: book.isbn } });
  fireEvent.click(screen.getByRole('button', { name: 'ISBN ile bul' }));
  expect(await screen.findByText(/elle girerek başvurabilirsiniz/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Betik onayına gönder' })).toBeEnabled();
});

test('losing the session closes the submission form and it stays closed after another login', async () => {
  const mocks = [catalog([]), mine(), mine()];
  const element = () => <MockedProvider mocks={mocks} addTypename={false}><MemoryRouter><PrintedBooks /></MemoryRouter></MockedProvider>;
  const view = render(element());
  fireEvent.click(screen.getByRole('button', { name: 'Basılı kitap ekle' }));
  expect(screen.getByRole('heading', { name: 'Basılı kitap başvurusu' })).toBeInTheDocument();
  useAuth.mockReturnValue({ user: null });
  view.rerender(element());
  expect(screen.queryByRole('heading', { name: 'Basılı kitap başvurusu' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Kitap eklemek için giriş yapın' })).toBeInTheDocument();
  useAuth.mockReturnValue({ user: { id: 'other' }, ensureSession: () => ({ id: 'other' }) });
  view.rerender(element());
  expect(screen.queryByRole('heading', { name: 'Basılı kitap başvurusu' })).not.toBeInTheDocument();
  await screen.findByText('Raflarımız ilk eserlerini bekliyor');
});

test('submission does not reach the server when credentials disappear just before sending', async () => {
  const ensureSession = jest.fn().mockReturnValue(null);
  useAuth.mockReturnValue({ user: { id: 'reader' }, ensureSession });
  show(<PrintedBooks />, [catalog([]), mine()]);
  fireEvent.click(screen.getByRole('button', { name: 'Basılı kitap ekle' }));
  fireEvent.submit(screen.getByRole('button', { name: 'Betik onayına gönder' }).closest('form'));
  expect(ensureSession).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await screen.findByText('Raflarımız ilk eserlerini bekliyor');
});

test('manual submissions are sent for review and do not appear as approved books immediately', async () => {
  const input = { isbn: '', title: book.title, printedAuthor: book.printedAuthor, publisher: book.publisher, publicationYear: 2020, pageCount: 200, description: book.description, imageUrl: '', purchaseUrl: '', publicationEvidenceUrl: 'https://example.test/catalog' };
  show(<PrintedBooks />, [catalog([]), mine(), mine(), { request: { query: SUBMIT_PRINTED_BOOK, variables: { input } }, result: { data: { submitPrintedBook: { id: 'pending', title: book.title, publicationStatus: 'PENDING' } } } }]);
  fireEvent.click(screen.getByRole('button', { name: 'Basılı kitap ekle' }));
  for (const [label, value] of [['Kitap adı', book.title], ['Kitapta yazan yazar adı', book.printedAuthor], ['Yayınevi / Basım adı', book.publisher], ['Bu baskının yılı', '2020'], ['Basılı sayfa sayısı', '200'], ['Kitap tanıtımı', book.description], ['Baskıyı doğrulayan yayınevi veya katalog bağlantısı', input.publicationEvidenceUrl]]) {
    fireEvent.change(screen.getByLabelText(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Betik onayına gönder' }));
  expect(await screen.findByText(/Başvurunuz Betik'e iletildi/)).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: book.title })).not.toBeInTheDocument();
});

test('printed details allow discussion but withhold all author editing before claim approval', async () => {
  show(detail(), [quotes()]);
  expect(screen.queryByRole('link', { name: 'Bölüm ekle / düzenle' })).not.toBeInTheDocument();
  expect(screen.getByText(/Hak talebinde bulunun/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Yorum gönder' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Satın alma sayfası/ })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(await screen.findByText('Bu kitaptan henüz bir alıntı paylaşılmadı.')).toBeInTheDocument();
});

test('pending submissions have neither public discussion nor claim/edit controls', () => {
  show(detail({ publicationStatus: 'PENDING' }));
  expect(screen.getByRole('status')).toHaveTextContent('incelemesinde');
  expect(screen.queryByText('Okur yorumları')).not.toBeInTheDocument();
  expect(screen.queryByText(/Hak talebinde bulunun/)).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Satın alma/ })).not.toBeInTheDocument();
});

test('pending rights claims show their status instead of offering duplicate submission', async () => {
  show(detail({ myClaim: { id: 'claim', status: 'PENDING', reviewNote: '' } }), [quotes()]);
  expect(screen.getByText(/Yazar hak talebiniz inceleniyor/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Hak talebini gönder' })).not.toBeInTheDocument();
  await screen.findByText('Bu kitaptan henüz bir alıntı paylaşılmadı.');
});

test('approved author access exposes the chapter editor while retaining the print interface', async () => {
  show(detail({ authorId: 'reader', canEditContent: true }), [quotes()]);
  expect(screen.getByRole('link', { name: 'Bölüm ekle / düzenle' })).toHaveAttribute('href', '/dashboard/printed');
  expect(screen.getByText('Basılı eser')).toBeInTheDocument();
  await screen.findByText('Bu kitaptan henüz bir alıntı paylaşılmadı.');
});

test('claim evidence is submitted without granting content access locally', async () => {
  const evidence = 'Kitabın yazarı ve dijital yayın haklarının sahibiyim.';
  const refresh = jest.fn();
  show(<PrintedBookDetail book={book} comments={[]} refresh={refresh} />, [quotes(), { request: { query: REQUEST_BOOK_CLAIM, variables: { bookId: book.id, evidence, evidenceUrl: '' } }, result: { data: { requestBookClaim: { id: 'claim', status: 'PENDING', reviewNote: '' } } } }]);
  fireEvent.change(screen.getByLabelText(/Hak talebi açıklaması/), { target: { value: evidence } });
  fireEvent.click(screen.getByRole('button', { name: 'Hak talebini gönder', hidden: true }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(screen.queryByRole('link', { name: 'Bölüm ekle / düzenle' })).not.toBeInTheDocument();
});

test.each(['PUBLIC', 'PRIVATE'])('printed quote posts the source page with %s visibility without inventing a chapter', async visibility => {
  const text = 'Kitaptan paylaşılacak kısa bir alıntı.';
  show(detail(), [quotes(), quotes(), { request: { query: CREATE_PRINTED_QUOTE, variables: { bookId: book.id, text, pageNumber: 12, note: '', isSpoiler: false, visibility } }, result: { data: { createQuote: { id: 'quote', text, pageNumber: 12, visibility } } } }]);
  fireEvent.change(screen.getByLabelText(/Kısa alıntı/), { target: { value: text } });
  fireEvent.change(screen.getByLabelText(/Basılı kitaptaki sayfa numarası/), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Alıntı görünürlüğü'), { target: { value: visibility } });
  fireEvent.click(screen.getByRole('button', { name: visibility === 'PRIVATE' ? 'Özel olarak kaydet' : 'Alıntıyı paylaş', hidden: true }));
  expect(await screen.findByText(visibility === 'PRIVATE' ? 'Alıntınız yalnızca sizin görebileceğiniz şekilde kaydedildi.' : 'Alıntınız paylaşıldı.')).toBeInTheDocument();
});

test('admin review requires a rejection reason and approval removes the pending item after refetch', async () => {
  const pending = { ...book, submittedBy: { id: 'reader', username: 'reader', fullName: 'Reader' }, publicationEvidenceUrl: 'https://example.test/evidence' };
  const reviews = value => ({ request: { query: GET_PRINTED_REVIEWS }, result: { data: { getPrintedBookReviews: value, getBookClaimReviews: [] } } });
  show(<AdminPrintedBooks />, [reviews([pending]), reviews([]), { request: { query: REVIEW_PRINTED_BOOK, variables: { bookId: book.id, approve: true, note: '' } }, result: { data: { reviewPrintedBook: { id: book.id, publicationStatus: 'APPROVED', reviewNote: '' } } } }]);
  fireEvent.click(await screen.findByRole('button', { name: 'Reddet' }));
  expect(screen.getByRole('alert')).toHaveTextContent('gerekçe');
  fireEvent.click(screen.getByRole('button', { name: 'Onayla' }));
  expect(await screen.findByText('Bekleyen kitap başvurusu yok.')).toBeInTheDocument();
});
