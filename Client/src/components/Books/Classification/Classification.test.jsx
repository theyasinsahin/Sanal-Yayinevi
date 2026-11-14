import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClassificationFields, { emptyClassification } from './ClassificationFields';
import ClassificationSummary from './ClassificationSummary';
import ClassificationEditor from './ClassificationEditor';
import CreateBookPage from '../../../pages/CreateBookPage';
import { GET_CLASSIFICATION_OPTIONS, UPDATE_BOOK_CLASSIFICATION } from '../../../graphql/classification';
import * as integrations from '../../../config/integrations';
import { CREATE_BOOK_MUTATION } from '../../../graphql/mutations/book';

jest.mock('../../../config/integrations', () => ({ __esModule: true, IMAGE_UPLOAD_ENABLED: true, DOCKER_DEV: false }));
jest.mock('../../Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../ImageUpload', () => ({ onUploadSuccess, onLoadingChange }) => <><button type="button" onClick={() => onUploadSuccess('https://example.test/cover.jpg')}>Kapak seç</button><button type="button" onClick={() => onLoadingChange(true)}>Yükleme başlat</button><button type="button" onClick={() => onLoadingChange(false)}>Yükleme bitir</button></>);
const term = (id, name) => ({ id, slug: id, name, isActive: true });
const options = { formats: [term('roman', 'Roman'), term('siir', 'Şiir')], genres: ['Fantastik', 'Gizem', 'Korku', 'Macera'].map((name, index) => ({ ...term(`genre${index}`, name), group: 'FICTION', hexColor: '#666666' })), narrativeFeatures: [term('seri-kurgu', 'Seri Kurgu')], targetAudiences: [term('genc', 'Genç')], contentWarnings: [term('siddet', 'Şiddet')] };
const mockOptions = { request: { query: GET_CLASSIFICATION_OPTIONS }, result: { data: { getClassificationOptions: options } } };
function Form() { const [value, setValue] = useState(emptyClassification); return <><ClassificationFields value={value} onChange={setValue} /><output data-testid="value">{JSON.stringify(value)}</output></>; }
test('grouped genres enforce three selections and format is never selected automatically', async () => {
  render(<MockedProvider mocks={[mockOptions]}><Form /></MockedProvider>);
  await screen.findByText('Kurgu ve Hikâyeler');
  expect(screen.getByLabelText('Eser biçimi *')).toHaveValue('');
  for (const name of ['Fantastik', 'Gizem', 'Korku']) fireEvent.click(screen.getByLabelText(name));
  expect(screen.getByLabelText('Macera')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Gizem türünü kaldır' }));
  expect(screen.getByLabelText('Macera')).not.toBeDisabled();
  fireEvent.click(screen.getByLabelText('Macera'));
  expect(JSON.parse(screen.getByTestId('value').textContent).genreIds).toHaveLength(3);
});
test('tag chips reject Turkish case/space duplicates and enforce eight tags', async () => {
  render(<MockedProvider mocks={[mockOptions]}><Form /></MockedProvider>);
  await screen.findByText('Kurgu ve Hikâyeler');
  const input = screen.getByLabelText('Etiket ara veya yeni etiket yaz');
  const add = name => { fireEvent.change(input, { target: { value: name } }); fireEvent.click(screen.getByRole('button', { name: 'Ekle' })); };
  add('İhanet ve Işık'); add('  ihanet   ve ışık  ');
  expect(screen.getByRole('alert')).toHaveTextContent('zaten');
  for (let i = 0; i < 7; i++) add(`Tema ${i}`);
  fireEvent.change(input, { target: { value: 'Dokuzuncu' } });
  expect(screen.getByRole('button', { name: 'Ekle' })).toBeDisabled();
  expect(JSON.parse(screen.getByTestId('value').textContent).tags).toHaveLength(8);
});
test('summary displays format, topics and separate audience/content warnings', () => {
  render(<ClassificationSummary book={{ format: options.formats[0], genres: options.genres.slice(0, 2), classificationTags: [term('buyu', 'Büyü')], narrativeFeatures: options.narrativeFeatures, targetAudience: options.targetAudiences[0], contentWarnings: options.contentWarnings, classificationStatus: 'COMPLETE' }} />);
  for (const text of ['Roman', 'Fantastik, Gizem', 'Büyü', 'Seri Kurgu', 'Genç', 'Şiddet']) expect(screen.getByText(text)).toBeInTheDocument();
});
test('creation saves a draft with complete classification and opens the writing dashboard', async () => {
  const classification = { formatId: 'roman', genreIds: ['genre0'], tags: [], narrativeFeatureIds: [], targetAudienceId: null, contentWarningIds: [] };
  const result = jest.fn(() => ({ data: { createBook: { publicPath: '/kitap/new', id: 'new', title: 'Yeni Eser', description: 'Tanıtım', authorId: 'author', comments: [], chapters: [] } } }));
  render(<MockedProvider mocks={[mockOptions, { request: { query: CREATE_BOOK_MUTATION, variables: { title: 'Yeni Eser', description: 'Tanıtım', imageUrl: 'https://example.test/cover.jpg', classification } }, result }]}><MemoryRouter><Routes><Route path="/" element={<CreateBookPage />} /><Route path="/dashboard/new" element={<p>Yeni eser açıldı</p>} /></Routes></MemoryRouter></MockedProvider>);
  await screen.findByText('Kurgu ve Hikâyeler');
  fireEvent.change(screen.getByLabelText(/Kitap Başlığı/), { target: { value: 'Yeni Eser' } });
  fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: 'Tanıtım' } });
  fireEvent.click(screen.getByText('Kapak seç'));
  fireEvent.change(screen.getByLabelText('Eser biçimi *'), { target: { value: 'roman' } });
  fireEvent.click(screen.getByLabelText('Fantastik'));
  fireEvent.click(screen.getByRole('button', { name: 'Taslak Olarak Kaydet' }));
  expect(await screen.findByText('Yeni eser açıldı')).toBeInTheDocument();
  expect(result).toHaveBeenCalledTimes(1);
});
test('missing fields are highlighted and validation moves focus to the first missing field', async () => {
  const scroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = jest.fn();
  try {
    render(<MockedProvider mocks={[mockOptions]}><MemoryRouter><CreateBookPage /></MemoryRouter></MockedProvider>);
    await screen.findByText('Kurgu ve Hikâyeler');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Taslak Olarak Kaydet' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Taslak Olarak Kaydet' }));
    expect(screen.getByRole('alert')).toHaveTextContent('eksik alanları tamamlayın');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kapak seç' })).toHaveFocus());
    // The invalid style belongs to the non-interactive field wrapper.
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('[data-field="imageUrl"]')).toHaveClass('create-field-invalid');
    expect(screen.getByLabelText(/Kitap Başlığı/)).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Bir eser biçimi seçin.' }));
    expect(screen.getByLabelText('Eser biçimi *')).toHaveFocus();
  } finally { HTMLElement.prototype.scrollIntoView = scroll; }
});
test('editing preserves unsaved selections across unrelated rerenders and saves the new classification', async () => {
  const book = { __typename: 'Book', id: 'book', format: options.formats[0], genres: [options.genres[0]], classificationTags: [], narrativeFeatures: [], targetAudience: null, contentWarnings: [], classificationStatus: 'COMPLETE' };
  const classification = { formatId: 'siir', genreIds: ['genre0'], tags: [], narrativeFeatureIds: [], targetAudienceId: null, contentWarningIds: [] };
  const saved = jest.fn(() => ({ data: { updateBookClassification: { ...book, format: options.formats[1] } } }));
  const wrapper = ({ children }) => <MockedProvider mocks={[mockOptions, { request: { query: UPDATE_BOOK_CLASSIFICATION, variables: { bookId: 'book', classification } }, result: saved }]}>{children}</MockedProvider>;
  const view = render(<ClassificationEditor book={book} />, { wrapper });
  fireEvent.click(screen.getByText('Sınıflandırmayı düzenle'));
  await screen.findByText('Kurgu ve Hikâyeler');
  fireEvent.change(screen.getByLabelText('Eser biçimi *'), { target: { value: 'siir' } });
  view.rerender(<ClassificationEditor book={{ ...book }} />);
  expect(screen.getByLabelText('Eser biçimi *')).toHaveValue('siir');
  fireEvent.click(screen.getByText('Sınıflandırmayı kaydet'));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
});

const existingBook = { id: 'book', format: options.formats[0], genres: [options.genres[0]] };
function showWorkflow(workflow, mocks) {
  render(<MockedProvider mocks={mocks}><MemoryRouter>{workflow === 'create' ? <CreateBookPage /> : <ClassificationEditor book={existingBook} />}</MemoryRouter></MockedProvider>);
  if (workflow === 'edit') fireEvent.click(screen.getByText('Sınıflandırmayı düzenle'));
  return { submit: screen.getByRole('button', { name: workflow === 'create' ? 'Taslak Olarak Kaydet' : 'Sınıflandırmayı kaydet' }) };
}
test.each(['create', 'edit'])('%s waits for mandatory options while loading', async workflow => {
  const { submit } = showWorkflow(workflow, [{ ...mockOptions, delay: 100 }]);
  expect(screen.getByRole('status')).toHaveTextContent('yükleniyor');
  expect(submit).toBeDisabled();
  expect(screen.getByLabelText('Eser biçimi *')).toBeDisabled();
  await waitFor(() => expect(submit).toBeEnabled());
});
test.each(['create', 'edit'])('%s explains missing required data and recovers after retry', async workflow => {
  const empty = { ...options, formats: [], genres: [] };
  const { submit } = showWorkflow(workflow, [{ ...mockOptions, result: { data: { getClassificationOptions: empty } } }, mockOptions]);
  expect(await screen.findByRole('alert')).toHaveTextContent('eser biçimleri ve tür ve konular');
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
  await waitFor(() => expect(submit).toBeEnabled());
});
test.each(['create', 'edit'])('%s blocks failed options and supports retry', async workflow => {
  const { submit } = showWorkflow(workflow, [{ request: mockOptions.request, error: new Error('offline') }, mockOptions]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Seçenekler yüklenemedi');
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
  await waitFor(() => expect(submit).toBeEnabled());
});
test.each(['formats', 'genres'])('missing %s alone blocks mandatory classification', async key => {
  const { submit } = showWorkflow('create', [{ ...mockOptions, result: { data: { getClassificationOptions: { ...options, [key]: [] } } } }]);
  expect(await screen.findByRole('alert')).toHaveTextContent('henüz hazır değil');
  expect(submit).toBeDisabled();
});

test('disabled cover integration explains the blocker and prevents creation', async () => {
  integrations.IMAGE_UPLOAD_ENABLED = false;
  try {
    const { submit } = showWorkflow('create', [mockOptions]);
    await screen.findByText('Kurgu ve Hikâyeler');
    expect(screen.getByRole('alert')).toHaveTextContent('Kapak yükleme bu ortamda devre dışı');
    expect(submit).toBeDisabled();
  } finally { integrations.IMAGE_UPLOAD_ENABLED = true; }
});
test('creation waits for the cover upload to finish', async () => {
  const { submit } = showWorkflow('create', [mockOptions]);
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Yükleme başlat' }));
  expect(screen.getByRole('status')).toHaveTextContent('Kapak yükleniyor');
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Yükleme bitir' }));
  expect(submit).toBeEnabled();
});
test('inactive mandatory selections must be replaced before editing can save', async () => {
  const { submit } = showWorkflow('edit', [{ ...mockOptions, result: { data: { getClassificationOptions: { ...options, formats: [options.formats[1]] } } } }]);
  expect(await screen.findByRole('alert')).toHaveTextContent('artık kullanılamıyor');
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Eser biçimi *'), { target: { value: 'siir' } });
  await waitFor(() => expect(submit).toBeEnabled());
});

test.each([false, true])('Docker creates a book with a local cover when Cloudinary enabled=%s', async cloudEnabled => {
  integrations.DOCKER_DEV = true;
  integrations.IMAGE_UPLOAD_ENABLED = cloudEnabled;
  const imageUrl = new URL('/images/development-book-cover.svg', window.location.origin).href;
  const scroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = jest.fn();
  const classification = { formatId: 'roman', genreIds: ['genre0'], tags: [], narrativeFeatureIds: [], targetAudienceId: null, contentWarningIds: [] };
  const result = jest.fn(() => ({ data: { createBook: { publicPath: '/kitap/new', id: 'new', title: 'Yerel Kitap', description: 'Tanıtım', authorId: 'author', comments: [], chapters: [] } } }));
  try {
    render(<MockedProvider mocks={[mockOptions, { request: { query: CREATE_BOOK_MUTATION, variables: { title: 'Yerel Kitap', description: 'Tanıtım', imageUrl, classification } }, result }]}><MemoryRouter><Routes><Route path="/" element={<CreateBookPage />} /><Route path="/dashboard/new" element={<p>Yerel kitap açıldı</p>} /></Routes></MemoryRouter></MockedProvider>);
    await screen.findByText('Kurgu ve Hikâyeler');
    fireEvent.change(screen.getByLabelText(/Kitap Başlığı/), { target: { value: 'Yerel Kitap' } });
    fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: 'Tanıtım' } });
    fireEvent.change(screen.getByLabelText('Eser biçimi *'), { target: { value: 'roman' } });
    fireEvent.click(screen.getByLabelText('Fantastik'));
    // A local cover is an explicit choice; mandatory cover validation still runs.
    fireEvent.click(screen.getByRole('button', { name: 'Taslak Olarak Kaydet' }));
    expect(screen.getByRole('button', { name: 'Kapak resmi yüklemek zorunludur.' })).toBeInTheDocument();
    expect(result).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kapak seç' })).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Yerel örnek kapağı kullan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Taslak Olarak Kaydet' }));
    expect(await screen.findByText('Yerel kitap açıldı')).toBeInTheDocument();
    expect(result).toHaveBeenCalledTimes(1);
  } finally {
    HTMLElement.prototype.scrollIntoView = scroll;
    integrations.DOCKER_DEV = false;
    integrations.IMAGE_UPLOAD_ENABLED = true;
  }
});
test('production does not offer the development cover', async () => {
  showWorkflow('create', [mockOptions]);
  await screen.findByText('Kurgu ve Hikâyeler');
  expect(screen.queryByRole('button', { name: 'Yerel örnek kapağı kullan' })).not.toBeInTheDocument();
});
