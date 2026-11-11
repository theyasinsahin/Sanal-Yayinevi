import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import PersonalFoxes from './index';
import { foxScene } from './FoxDecorations';

let mockUser, mockLoading;
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: mockLoading }) }));
beforeEach(() => {
  mockUser = { id: 'viewer', username: 'kolelkaa' }; mockLoading = false;
  jest.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function () { return this.hidden ? [] : [{ width: 300, height: 60 }]; });
});
afterEach(() => jest.restoreAllMocks());

function Pages() {
  return <><Routes>
    <Route path="/" element={<main><h1 className="hero-title">Bir hikâye</h1><Link to="/yazar/kolelkaa">Profil</Link></main>} />
    <Route path="/yazar/:username" element={<main className="profile-header-card"><h2>Bir yazar</h2></main>} />
  </Routes><footer><div className="footer-brand">Betik</div></footer><PersonalFoxes /></>;
}
const show = (path = '/') => render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Pages /></MemoryRouter>);

test.each([
  null, { id: 'other', username: 'someone' }, { id: 'other', username: 'Kolelkaa' },
  { id: 'other', username: 'KOLELKAA' }, { id: 'other', username: 'kolelkaa ' },
  { id: 'other', username: ' kolelkaa' }, { username: 'kolelkaa' },
  { id: 'other', fullName: 'kolelkaa', username: 'reader' },
])('only the exact signed-in username enables decorations: %j', user => {
  mockUser = user; show('/yazar/kolelkaa');
  expect(screen.queryByAltText('')).not.toBeInTheDocument();
  expect(screen.getByRole('heading')).not.toHaveClass('personal-fox-anchor');
});

test('session loading never briefly displays the private decorations', () => {
  mockLoading = true; show();
  expect(screen.queryByAltText('')).not.toBeInTheDocument();
});

test('the eligible viewer sees both supplied assets in decorative, non-interactive slots', async () => {
  show();
  await waitFor(() => expect(screen.getAllByAltText('')).toHaveLength(2));
  expect(screen.getByRole('heading', { name: 'Bir hikâye' })).toHaveClass('personal-fox-anchor--welcome');
  const assets = screen.getAllByAltText('');
  expect(assets.map(item => item.getAttribute('src')).sort()).toEqual(['/images/fox/plane-fox.png', '/images/fox/standing-fox.png']);
  for (const image of assets) {
    expect(image).toHaveAttribute('draggable', 'false');
    // The decorative wrapper is intentionally excluded from accessible role queries.
    // eslint-disable-next-line testing-library/no-node-access
    expect(image.parentElement).toHaveAttribute('aria-hidden', 'true');
  }
});

test('navigation moves the decoration to the new page without accumulating images', async () => {
  show();
  await screen.findAllByAltText('');
  fireEvent.click(screen.getByRole('link', { name: 'Profil' }));
  await waitFor(() => expect(screen.getByRole('main')).toHaveClass('personal-fox-peek-anchor'));
  expect(screen.getByRole('heading', { name: 'Bir yazar' })).not.toHaveClass('personal-fox-anchor');
  expect(screen.getAllByAltText('')).toHaveLength(2);
});

test('sign-out and switching to another account remove every decoration and reserved space', async () => {
  const view = show();
  await screen.findAllByAltText('');
  mockUser = { id: 'another', username: 'reader' };
  view.rerender(<MemoryRouter><Pages /></MemoryRouter>);
  expect(screen.queryByAltText('')).not.toBeInTheDocument();
  expect(screen.getByRole('heading')).not.toHaveClass('personal-fox-anchor');
  mockUser = null;
  view.rerender(<MemoryRouter><Pages /></MemoryRouter>);
  expect(screen.queryByAltText('')).not.toBeInTheDocument();
});

test('the profile gets an additional plane only when its left gutter has enough space', async () => {
  const previousWidth = window.innerWidth;
  window.innerWidth = 1920;
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 320 });
  show('/yazar/kolelkaa');
  await waitFor(() => expect(screen.getAllByAltText('')).toHaveLength(3));
  expect(screen.getAllByAltText('').filter(image => image.getAttribute('src').endsWith('plane-fox.png'))).toHaveLength(2);
  window.innerWidth = 393;
  fireEvent(window, new Event('resize'));
  await waitFor(() => expect(screen.getAllByAltText('')).toHaveLength(2));
  window.innerWidth = previousWidth;
});

test('a heading delivered after a query gets its accent without a reload', async () => {
  function DelayedPage() {
    const [ready, setReady] = useState(false);
    return <><main>{ready ? <h1>Yeni sayfa</h1> : <p>Yükleniyor</p>}<button onClick={() => setReady(true)}>Yükle</button></main><PersonalFoxes /></>;
  }
  render(<MemoryRouter><DelayedPage /></MemoryRouter>);
  expect(screen.queryByAltText('')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yükle' }));
  await waitFor(() => expect(screen.getByRole('heading')).toHaveClass('personal-fox-anchor'));
  expect(await screen.findAllByAltText('')).toHaveLength(1);
});

test.each([
  ['/dashboard/book', 'writer'], ['/book-reader/book', 'reader'], ['/kitap/a/oku', 'reader'],
  ['/kitap/a/bolum/b', 'reader'], ['/messages/conversation', 'messages'], ['/kitap/a', 'bookmark'],
  ['/feed', 'discovery'], ['/quotes', 'conversation'], ['/print/book', 'journey'],
  ['/admin/users', 'desk'], ['/privacy', 'postcard'], ['/missing', 'postcard'],
])('%s uses the appropriate unobtrusive placement', (path, kind) => {
  expect(foxScene(path).kind).toBe(kind);
});
