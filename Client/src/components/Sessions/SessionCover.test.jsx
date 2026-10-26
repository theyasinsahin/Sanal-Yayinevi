import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionCover, { DEFAULT_SESSION_COVER } from './SessionCover';
test('a broken custom photo falls back without retrying an unavailable default forever', () => {
  const view = render(<SessionCover src="https://res.cloudinary.com/c/image/upload/broken.jpg" title="Etkinlik" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img')).toHaveAttribute('src', DEFAULT_SESSION_COVER);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img')).toHaveAttribute('src', DEFAULT_SESSION_COVER);
  view.rerender(<SessionCover src="https://res.cloudinary.com/c/image/upload/new.jpg" title="Etkinlik" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://res.cloudinary.com/c/image/upload/new.jpg');
});
