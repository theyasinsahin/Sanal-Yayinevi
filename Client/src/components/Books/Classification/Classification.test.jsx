import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClassificationFields, { emptyClassification } from './ClassificationFields';
import ClassificationSummary from './ClassificationSummary';
import ClassificationEditor from './ClassificationEditor';
import CreateBookPage from '../../../pages/CreateBookPage';
import { GET_CLASSIFICATION_OPTIONS, UPDATE_BOOK_CLASSIFICATION } from '../../../graphql/classification';
import { CREATE_BOOK_MUTATION } from '../../../graphql/mutations/book';

jest.mock('../../Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../ImageUpload', () => ({ onUploadSuccess }) => <button type="button" onClick={() => onUploadSuccess('https://example.test/cover.jpg')}>Kapak seç</button>);
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
test('creation sends the complete classification and navigates to the created work', async () => {
  const classification = { formatId: 'roman', genreIds: ['genre0'], tags: [], narrativeFeatureIds: [], targetAudienceId: null, contentWarningIds: [] };
  const result = jest.fn(() => ({ data: { createBook: { publicPath: '/kitap/new', id: 'new', title: 'Yeni Eser', description: 'Tanıtım', authorId: 'author', comments: [], chapters: [] } } }));
  render(<MockedProvider mocks={[mockOptions, { request: { query: CREATE_BOOK_MUTATION, variables: { title: 'Yeni Eser', description: 'Tanıtım', imageUrl: 'https://example.test/cover.jpg', classification } }, result }]}><MemoryRouter><Routes><Route path="/" element={<CreateBookPage />} /><Route path="/kitap/new" element={<p>Yeni eser açıldı</p>} /></Routes></MemoryRouter></MockedProvider>);
  await screen.findByText('Kurgu ve Hikâyeler');
  fireEvent.change(screen.getByLabelText(/Kitap Başlığı/), { target: { value: 'Yeni Eser' } });
  fireEvent.change(screen.getByLabelText('Açıklama'), { target: { value: 'Tanıtım' } });
  fireEvent.click(screen.getByText('Kapak seç'));
  fireEvent.change(screen.getByLabelText('Eser biçimi *'), { target: { value: 'roman' } });
  fireEvent.click(screen.getByLabelText('Fantastik'));
  fireEvent.click(screen.getByRole('button', { name: 'Kitabı Yayınla' }));
  expect(await screen.findByText('Yeni eser açıldı')).toBeInTheDocument();
  expect(result).toHaveBeenCalledTimes(1);
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
