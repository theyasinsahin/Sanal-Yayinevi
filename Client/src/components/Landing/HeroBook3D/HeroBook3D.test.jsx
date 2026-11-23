import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeroBook3D, { canRenderWebGL } from './index';
import { useBookFeed } from '../../../hooks/useBookFeed';

jest.mock('../../../hooks/useBookFeed', () => ({ useBookFeed: jest.fn() }));
// WebGL sahnesi jsdom'da çizilemez; yüklenirse test bunu yakalar
jest.mock('./Book3DScene', () => () => <div data-testid="webgl-scene" />);

const book = (id, title, imageUrl = `https://res.cloudinary.com/demo/image/upload/${id}.jpg`) => ({
  id, title, imageUrl, publicPath: `/kitap/${id}`, author: { fullName: `${title} Yazarı` },
});

const show = books => {
  useBookFeed.mockReturnValue({ books });
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HeroBook3D /></MemoryRouter>);
};

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); useBookFeed.mockReset(); });

test('requests the same popular page as the featured shelf so the cache is shared', () => {
  show([]);
  expect(useBookFeed).toHaveBeenCalledWith({ sortBy: 'popular' }, true, { limit: 10 });
});

test('jsdom has no WebGL, so the CSS book is used and three.js is never loaded', () => {
  expect(canRenderWebGL()).toBe(false);
  show([book('a', 'Rüzgâr')]);
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.queryByTestId('webgl-scene')).not.toBeInTheDocument();
  expect(screen.getByTestId('hero-book-fallback')).toBeInTheDocument();
});

test('the featured book links to its page with a descriptive name', () => {
  show([book('a', 'Rüzgâr'), book('b', 'Deniz')]);
  expect(screen.getByRole('link', { name: 'Öne çıkan kitabı aç: Rüzgâr' })).toHaveAttribute('href', '/kitap/a');
  expect(screen.getByText('Rüzgâr Yazarı')).toBeInTheDocument();
});

test('books with covers come first and the shelf is limited to five', () => {
  show([
    book('no-cover', 'Kapaksız', ''),
    ...['1', '2', '3', '4', '5', '6'].map(id => book(id, `Kitap ${id}`)),
  ]);
  expect(screen.getByRole('link', { name: 'Öne çıkan kitabı aç: Kitap 1' })).toBeInTheDocument();
  expect(screen.getByText('01 / 05')).toBeInTheDocument();
});

test('previous and next buttons move through the shelf and wrap around', () => {
  show([book('a', 'Rüzgâr'), book('b', 'Deniz'), book('c', 'Toprak')]);
  fireEvent.click(screen.getByRole('button', { name: 'Sonraki kitap' }));
  expect(screen.getByRole('link', { name: 'Öne çıkan kitabı aç: Deniz' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Önceki kitap' }));
  fireEvent.click(screen.getByRole('button', { name: 'Önceki kitap' }));
  expect(screen.getByRole('link', { name: 'Öne çıkan kitabı aç: Toprak' })).toBeInTheDocument();
});

test('books advance automatically and the rotation can be paused', () => {
  show([book('a', 'Rüzgâr'), book('b', 'Deniz')]);
  act(() => { jest.advanceTimersByTime(6600); });
  expect(screen.getByRole('link', { name: 'Öne çıkan kitabı aç: Deniz' })).toBeInTheDocument();

  const pause = screen.getByRole('button', { name: 'Kitap geçişini durdur' });
  fireEvent.click(pause);
  expect(screen.getByRole('button', { name: 'Kitap geçişini başlat' })).toHaveAttribute('aria-pressed', 'true');
  act(() => { jest.advanceTimersByTime(20000); });
  expect(screen.getByRole('link', { name: 'Öne çıkan kitabı aç: Deniz' })).toBeInTheDocument();
});

test('a single book shows no rotation controls and no books shows only the placeholder book', () => {
  const { unmount } = show([book('a', 'Rüzgâr')]);
  expect(screen.queryByRole('button', { name: 'Sonraki kitap' })).not.toBeInTheDocument();
  unmount();
  show([]);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  const cover = within(screen.getByTestId('hero-book-fallback')).getByRole('img', { hidden: true });
  expect(cover).toHaveAttribute('src', '/images/book-placeholder.svg');
});
