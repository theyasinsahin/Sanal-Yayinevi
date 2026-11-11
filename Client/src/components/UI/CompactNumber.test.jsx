import React from 'react';
import { render, screen } from '@testing-library/react';
import CompactNumber from './CompactNumber';

test('abbreviates visually while a button and its tooltip expose the exact total', () => {
  render(<button><CompactNumber value={21530} label="beğeni" /></button>);
  expect(screen.getByText('21,5 B')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByTitle('21.530 beğeni')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '21.530 beğeni' })).toBeInTheDocument();
});

test('live updates preserve the exact total when the visible abbreviation stays the same', () => {
  const { rerender } = render(<CompactNumber value={21530} />);
  rerender(<CompactNumber value={21531} />);
  expect(screen.getByText('21,5 B')).toBeInTheDocument();
  expect(screen.getByTitle('21.531')).toBeInTheDocument();
});
