import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Link, useNavigate, useLocation } from 'react-router-dom';
import ScrollToTop from './index';
import CatalogBackLink from '../Books/CatalogBackLink';
import PrintedBookCard from '../Books/PrintedBookCard';

let resized;
let height;
let disconnected;
function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  return <><Link to="/kitap/example">Book</Link><Link to="/feed">Discover</Link><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(1)}>Forward</button>
    <PrintedBookCard book={{ id: 'example', publicPath: '/kitap/example', title: 'Printed example' }} />
    <CatalogBackLink to="/printed-books">Return to catalog</CatalogBackLink>
    <output data-testid="location">{location.pathname}{location.search}</output>
  </>;
}
function show(path) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ScrollToTop /><Navigation /></MemoryRouter>);
}
beforeEach(() => {
  height = 6000;
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => height });
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
  Object.defineProperty(window, 'scrollX', { configurable: true, writable: true, value: 0 });
  window.scrollTo = jest.fn(({ top, left }) => { window.scrollY = top; window.scrollX = left; });
  disconnected = jest.fn();
  global.ResizeObserver = jest.fn(callback => { resized = callback; return { observe: jest.fn(), disconnect: disconnected }; });
});

test.each(['/feed', '/printed-books?page=3&search=novel'])('returning to %s restores the previous list position', path => {
  show(path);
  window.scrollY = 1600;
  fireEvent.scroll(window);
  fireEvent.click(screen.getByText('Book'));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 0, behavior: 'instant' });
  fireEvent.click(screen.getByText('Back'));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 1600, behavior: 'instant' });
});

test('restoration waits for delayed catalog content and stops once the saved position fits', () => {
  show('/feed');
  window.scrollY = 3000;
  fireEvent.scroll(window);
  fireEvent.click(screen.getByText('Book'));
  height = 500;
  fireEvent.click(screen.getByText('Back'));
  window.scrollTo.mockClear();
  height = 6000;
  resized();
  expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 3000, behavior: 'instant' });
  expect(disconnected).toHaveBeenCalled();
});

test('new catalog visits start at the top and have independent history positions', () => {
  show('/feed');
  window.scrollY = 1500; fireEvent.scroll(window);
  fireEvent.click(screen.getByText('Book'));
  fireEvent.click(screen.getByText('Discover'));
  expect(window.scrollY).toBe(0);
  window.scrollY = 700; fireEvent.scroll(window);
  fireEvent.click(screen.getByText('Back'));
  fireEvent.click(screen.getByText('Back'));
  expect(window.scrollY).toBe(1500);
  fireEvent.click(screen.getByText('Forward'));
  fireEvent.click(screen.getByText('Forward'));
  expect(window.scrollY).toBe(700);
});

test('the detail return link restores the actual printed catalog history entry, search and page', () => {
  show('/printed-books?page=3&search=novel');
  window.scrollY = 1800; fireEvent.scroll(window);
  fireEvent.click(screen.getByRole('link', { name: /Printed example/ }));
  expect(screen.getByTestId('location')).toHaveTextContent('/kitap/example');
  fireEvent.click(screen.getByText('Return to catalog'));
  expect(screen.getByTestId('location')).toHaveTextContent('/printed-books?page=3&search=novel');
  expect(window.scrollY).toBe(1800);
});

test('a directly opened book offers a normal catalog link', () => {
  show('/kitap/example');
  fireEvent.click(screen.getByText('Return to catalog'));
  expect(screen.getByTestId('location')).toHaveTextContent('/printed-books');
  expect(window.scrollY).toBe(0);
});

test('user scrolling cancels restoration while catalog content is loading', () => {
  show('/feed');
  window.scrollY = 3000; fireEvent.scroll(window);
  fireEvent.click(screen.getByText('Book'));
  height = 500;
  fireEvent.click(screen.getByText('Back'));
  fireEvent.wheel(window);
  window.scrollTo.mockClear();
  height = 6000;
  resized();
  expect(window.scrollTo).not.toHaveBeenCalled();
});
