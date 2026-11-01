import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionCover, { DEFAULT_SESSION_COVER } from './SessionCover';

test.each(['', null, undefined, DEFAULT_SESSION_COVER])('absent or legacy cover %s leaves no image area', src => {
  const { container } = render(<SessionCover src={src} title="Session" />);
  expect(container).toBeEmptyDOMElement();
});

test('a broken photo disappears and a new photo can still be displayed', () => {
  const view = render(<SessionCover src="https://res.cloudinary.com/c/image/upload/broken.jpg" title="Session" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  view.rerender(<SessionCover src="https://res.cloudinary.com/c/image/upload/new.jpg" title="Session" />);
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://res.cloudinary.com/c/image/upload/new.jpg');
});
