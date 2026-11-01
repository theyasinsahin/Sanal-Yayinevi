import React from 'react';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PublicContentRoute, { RESOLVE_PUBLIC_ROUTE } from './PublicContentRoute';

jest.mock('../../pages/NotFoundPage', () => () => <div>İçerik bulunamadı</div>);
const Content = ({ resolvedId, resolvedChapterId }) => {
  const location = useLocation();
  return <div data-testid="content">{JSON.stringify({ id: resolvedId, chapter: resolvedChapterId, url: location.pathname + location.search + location.hash })}</div>;
};
const show = (start, routes, mocks) => render(<MockedProvider mocks={mocks} addTypename={false}>
  <MemoryRouter initialEntries={[start]}><Routes>{routes.map(([path, props]) => <Route key={path} path={path} element={<PublicContentRoute {...props}><Content /></PublicContentRoute>} />)}</Routes></MemoryRouter>
</MockedProvider>);
const lookup = (variables, route) => ({ request: { query: RESOLVE_PUBLIC_ROUTE, variables }, result: { data: { resolvePublicRoute: route } } });

test('legacy profile IDs replace the address with a username and retain query/hash', async () => {
  const route = { id: 'user-1', path: '/yazar/deniz', chapterId: null };
  show('/user/user-1?tab=books#kitaplar', [['/user/:userId', { type: 'PROFILE', legacy: true }], ['/yazar/:username', { type: 'PROFILE' }]], [
    lookup({ type: 'PROFILE', reference: 'user-1', legacy: true, chapter: null }, route),
    lookup({ type: 'PROFILE', reference: 'deniz', legacy: false, chapter: null }, route),
  ]);
  expect(await screen.findByTestId('content')).toHaveTextContent('"id":"user-1"');
  expect(screen.getByTestId('content')).toHaveTextContent('/yazar/deniz?tab=books#kitaplar');
});

test('legacy chapter links use a readable chapter URL while reader operations receive IDs', async () => {
  const route = { id: 'book-1', path: '/kitap/roman-deniz/bolum/ilk-bolum', chapterId: 'chapter-2' };
  show('/book-reader/book-1?chapter=chapter-2&mode=chapter', [['/book-reader/:bookId', { type: 'BOOK', legacy: true, reader: true }], ['/kitap/:slug/bolum/:chapterSlug', { type: 'BOOK', reader: true }]], [
    lookup({ type: 'BOOK', reference: 'book-1', legacy: true, chapter: 'chapter-2' }, route),
    lookup({ type: 'BOOK', reference: 'roman-deniz', legacy: false, chapter: 'ilk-bolum' }, route),
  ]);
  expect(await screen.findByTestId('content')).toHaveTextContent('"chapter":"chapter-2"');
  expect(screen.getByTestId('content')).toHaveTextContent('/kitap/roman-deniz/bolum/ilk-bolum?mode=chapter');
  expect(document.querySelector('link[rel="canonical"]').href).toBe('http://localhost/kitap/roman-deniz/bolum/ilk-bolum');
});

test('book reader aliases lead to /oku without turning a slug into a database ID', async () => {
  const route = { id: 'book-1', path: '/kitap/roman-deniz', chapterId: null };
  show('/book-reader/book-1', [['/book-reader/:bookId', { type: 'BOOK', legacy: true, reader: true }], ['/kitap/:slug/oku', { type: 'BOOK', reader: true }]], [
    lookup({ type: 'BOOK', reference: 'book-1', legacy: true, chapter: null }, route),
    lookup({ type: 'BOOK', reference: 'roman-deniz', legacy: false, chapter: null }, route),
  ]);
  expect(await screen.findByTestId('content')).toHaveTextContent('"id":"book-1"');
  expect(screen.getByTestId('content')).toHaveTextContent('/kitap/roman-deniz/oku');
});

test('unknown URLs show a missing content page without rendering the resource', async () => {
  show('/kitap/yok', [['/kitap/:slug', { type: 'BOOK' }]], [lookup({ type: 'BOOK', reference: 'yok', legacy: false, chapter: null }, null)]);
  expect(await screen.findByText('İçerik bulunamadı')).toBeInTheDocument();
  expect(screen.queryByTestId('content')).not.toBeInTheDocument();
});
