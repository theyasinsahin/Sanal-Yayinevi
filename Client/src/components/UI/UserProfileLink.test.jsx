import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserProfileLink from './UserProfileLink';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

test('a profile link follows the canonical route without triggering a parent card click', () => {
  const parentClick = jest.fn(), linkClick = jest.fn();
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><div onClick={parentClick}><UserProfileLink user={{ username: 'reader', publicPath: '/yazar/reader' }} onClick={linkClick}>Reader</UserProfileLink></div></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Reader' })).toHaveAttribute('href', '/yazar/reader');
  fireEvent.click(screen.getByRole('link', { name: 'Reader' }));
  expect(linkClick).toHaveBeenCalledTimes(1);
  expect(parentClick).not.toHaveBeenCalled();
});
test('missing user references render readable text without a broken profile link', () => {
  render(<UserProfileLink user={null}>Deleted user</UserProfileLink>);
  expect(screen.getByText('Deleted user')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
