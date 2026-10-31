import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import BookCard from './index';
jest.mock('@mui/icons-material', () => require('../../../../test-support/icons.cjs'));

jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
const book = { id: 'book', kind: 'DIGITAL', title: 'Forest', description: 'A book description', publicPath: '/kitap/forest', pageCount: 30, status: 'WRITING', author: { id: 'author', username: 'author', fullName: 'Author' }, stats: { likes: 2, views: 1500 } };
function Destination() { const location = useLocation(); return <h1>{location.pathname} {location.state?.catalogReturn}</h1>; }
const show = props => render(<MockedProvider mocks={[]}><MemoryRouter initialEntries={['/feed?search=forest']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/feed" element={<BookCard {...props} />} /><Route path="/kitap/forest" element={<Destination />} /><Route path="/yazar/author" element={<Destination />} /></Routes></MemoryRouter></MockedProvider>);

test('opening a book preserves the originating catalog URL for return navigation', () => {
  show({ book }); fireEvent.click(screen.getByText('Forest'));
  expect(screen.getByRole('heading')).toHaveTextContent('/kitap/forest /feed?search=forest');
});
test('author links open the profile without also opening the book', () => {
  show({ book }); fireEvent.click(screen.getByRole('link', { name: 'Author' }));
  expect(screen.getByRole('heading')).toHaveTextContent('/yazar/author');
});
test('missing or failed cover images use the shared placeholder', () => {
  show({ book });
  const image = screen.getByRole('img', { name: 'Forest' });
  expect(image).toHaveAttribute('src', '/images/book-placeholder.svg');
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/images/book-placeholder.svg');
});
test('metadata provides reading time and popularity while long descriptions are capped', () => {
  show({ book: { ...book, description: 'a'.repeat(150) } });
  expect(screen.getByText('~10 dk okuma')).toBeInTheDocument();
  expect(screen.getByText('Popüler')).toBeInTheDocument();
  expect(screen.getByText(`${'a'.repeat(120)}...`)).toBeInTheDocument();
});
test('unresolved books render no broken card and skeletons render before data is available', () => {
  const { rerender } = render(<MockedProvider mocks={[]}><MemoryRouter><BookCard /></MemoryRouter></MockedProvider>);
  // Inspect structural markup that has no independent accessible control.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector('.book-card')).toBeNull();
  rerender(<MockedProvider mocks={[]}><MemoryRouter><BookCard skeleton /></MemoryRouter></MockedProvider>);
  // Inspect structural markup that has no independent accessible control.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector('.book-card.skeleton')).toBeInTheDocument();
});
