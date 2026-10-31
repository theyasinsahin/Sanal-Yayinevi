import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MessageBubble from './index';
jest.mock('@mui/icons-material', () => require('../../../../test-support/icons.cjs'));

const mockDelete = jest.fn();
jest.mock('../../../hooks/useMessages', () => ({ useDeleteMessage: () => ({ deleteMessage: mockDelete, deleting: false }) }));
const base = { id: 'message', type: 'TEXT', content: 'Message content', createdAt: '2026-01-01T12:00:00Z', sender: { fullName: 'Reader Writer', username: 'reader' } };
const show = (message = base, isOwn = false) => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<MessageBubble message={message} isOwn={isOwn} conversationId="conversation" />} /><Route path="/kitap/canonical" element={<h1>Book destination</h1>} /><Route path="/yazar/author" element={<h1>Author destination</h1>} /></Routes></MemoryRouter>);
beforeEach(() => mockDelete.mockReset().mockResolvedValue({}));
afterEach(() => jest.restoreAllMocks());

test('received text renders as text and offers no sender-only delete action', () => {
  show({ ...base, content: '<script>alert(1)</script>' });
  expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  // Inspect structural markup that has no independent accessible control.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector('script')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Mesaj seçenekleri' })).not.toBeInTheDocument();
});
test('the sender can delete their message from the options menu', async () => {
  show(base, true);
  fireEvent.click(screen.getByRole('button', { name: 'Mesaj seçenekleri' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sil' }));
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('message'));
  expect(screen.queryByRole('button', { name: 'Sil' })).not.toBeInTheDocument();
});
test('a failed deletion preserves the visible message', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockDelete.mockRejectedValue(new Error('Offline'));
  show(base, true);
  fireEvent.click(screen.getByRole('button', { name: 'Mesaj seçenekleri' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sil' }));
  await waitFor(() => expect(console.error).toHaveBeenCalled());
  expect(screen.getByText('Message content')).toBeInTheDocument();
});
test('a book attachment opens its canonical route', async () => {
  show({ ...base, type: 'BOOK', attachedBook: { id: 'book', title: 'Attached book', publicPath: '/kitap/canonical' } });
  fireEvent.click(screen.getByText('Attached book'));
  expect(await screen.findByRole('heading', { name: 'Book destination' })).toBeInTheDocument();
});
test('clicking an attached book author opens the profile without triggering book navigation', async () => {
  show({ ...base, type: 'BOOK', attachedBook: { id: 'book', title: 'Attached book', publicPath: '/kitap/canonical', author: { id: 'a', username: 'author', fullName: 'Author' } } });
  fireEvent.click(screen.getByRole('link', { name: 'Author' }));
  expect(await screen.findByRole('heading', { name: 'Author destination' })).toBeInTheDocument();
});
test('quote attachments truncate long previews and link to the source book', async () => {
  show({ ...base, type: 'QUOTE', attachedQuote: { text: 'a'.repeat(250), chapterTitle: 'Chapter', book: { id: 'book', title: 'Quoted book', publicPath: '/kitap/canonical' } } });
  expect(screen.getByText(`"${'a'.repeat(200)}..."`)).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Quoted book/));
  expect(await screen.findByRole('heading', { name: 'Book destination' })).toBeInTheDocument();
});
test.each(['BOOK', 'QUOTE'])('unavailable %s attachments leave the remaining message readable', type => {
  show({ ...base, type });
  expect(screen.getByText('Message content')).toBeInTheDocument();
  // Inspect structural markup that has no independent accessible control.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector('.bubble-book-card, .bubble-quote-card')).toBeNull();
});
