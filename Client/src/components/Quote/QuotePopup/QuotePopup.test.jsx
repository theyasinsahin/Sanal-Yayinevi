import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useLazyQuery, useMutation } from '@apollo/client';
import { CREATE_QUOTE_MUTATION, REPOST_QUOTE_MUTATION } from '../../../graphql/mutations/quote';
import QuotePopup from './index';

jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useLazyQuery: jest.fn(), useMutation: jest.fn() }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'reader' } }) }));
jest.mock('@mui/icons-material', () => ({ Check: () => null, Close: () => null, Repeat: () => null }));
let check, create, repost;
const text = 'Kitaptan seçilen anlamlı bir cümle.';
beforeEach(() => {
  check = jest.fn().mockResolvedValue({ data: { checkQuoteExists: { exists: false, quote: null } } });
  create = jest.fn().mockResolvedValue({ data: { createQuote: { id: 'quote' } } });
  repost = jest.fn().mockResolvedValue({ data: {} });
  useLazyQuery.mockReturnValue([check]);
  useMutation.mockImplementation(query => [query === CREATE_QUOTE_MUTATION ? create : repost, { loading: false }]);
  jest.spyOn(window, 'getSelection').mockReturnValue({ toString: () => text, rangeCount: 1, removeAllRanges: jest.fn(), getRangeAt: () => ({ startOffset: 2, endOffset: 34, getBoundingClientRect: () => ({ left: 20, width: 60, top: 100 }) }) });
});
afterEach(() => jest.restoreAllMocks());
async function select() {
  render(<MemoryRouter><QuotePopup bookId="book" chapterId="chapter" chapterTitle="Bölüm" chapterIndex={0} /></MemoryRouter>);
  fireEvent.mouseUp(document.body);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Kaydet' })).toBeEnabled());
}

test.each(['PUBLIC', 'PRIVATE'])('digital selection saves with %s visibility and preserves source offsets', async visibility => {
  await select();
  fireEvent.change(screen.getByLabelText('Alıntı görünürlüğü'), { target: { value: visibility } });
  const button = screen.getByRole('button', { name: visibility === 'PRIVATE' ? 'Özel olarak kaydet' : 'Kaydet' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Alıntı notu'), { target: { value: 'Kişisel not' } });
  fireEvent.click(button);
  await waitFor(() => expect(create).toHaveBeenCalledWith({ variables: { text, note: 'Kişisel not', bookId: 'book', chapterId: 'chapter', chapterTitle: 'Bölüm', chapterIndex: 0, location: { startOffset: 2, endOffset: 34 }, isSpoiler: false, visibility } }));
  expect(repost).not.toHaveBeenCalled();
});

test('a public duplicate can be saved as a private personal copy instead of reposted', async () => {
  await select();
  check.mockImplementation(({ variables }) => Promise.resolve({ data: { checkQuoteExists: { exists: variables.visibility === 'PUBLIC', quote: variables.visibility === 'PUBLIC' ? { id: 'public', user: { id: 'other', username: 'other' } } : null } } }));
  fireEvent.change(screen.getByLabelText('Alıntı görünürlüğü'), { target: { value: 'PUBLIC' } });
  expect(await screen.findByRole('button', { name: 'Yeniden paylaş' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Alıntı görünürlüğü'), { target: { value: 'PRIVATE' } });
  const save = await screen.findByRole('button', { name: 'Özel olarak kaydet' });
  await waitFor(() => expect(save).toBeEnabled()); fireEvent.click(save);
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ variables: expect.objectContaining({ visibility: 'PRIVATE' }) })));
  expect(repost).not.toHaveBeenCalled();
});

test('a failed duplicate check disables submission until retry succeeds', async () => {
  check.mockRejectedValueOnce(new Error('offline'));
  render(<MemoryRouter><QuotePopup bookId="book" chapterId="chapter" /></MemoryRouter>);
  fireEvent.mouseUp(document.body);
  expect(await screen.findByRole('alert')).toHaveTextContent('kontrol edilemedi');
  expect(screen.getByRole('button', { name: 'Kaydet' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden kontrol et' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Kaydet' })).toBeEnabled());
});

test('popup stays below the navbar and fits the available height after resizing', async () => {
  const originalHeight = window.innerHeight;
  const navbar = document.createElement('nav');
  navbar.className = 'navigation-bar';
  document.body.appendChild(navbar);
  let navbarBottom = 80;
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this === navbar) return { bottom: navbarBottom };
    return { width: 340, height: Math.min(420, parseFloat(this.style.maxHeight) || 420) };
  });
  try {
    window.innerHeight = 400;
    await select();
    const popup = screen.getByRole('dialog', { name: 'Alıntı kaydet' });
    expect(parseFloat(popup.style.top)).toBeGreaterThanOrEqual(88);
    expect(parseFloat(popup.style.top) + popup.getBoundingClientRect().height).toBeLessThanOrEqual(392);
    navbarBottom = 100;
    window.innerHeight = 320;
    fireEvent(window, new Event('resize'));
    expect(parseFloat(popup.style.top)).toBeGreaterThanOrEqual(108);
    expect(parseFloat(popup.style.top) + popup.getBoundingClientRect().height).toBeLessThanOrEqual(312);
  } finally {
    navbar.remove(); window.innerHeight = originalHeight;
  }
});
