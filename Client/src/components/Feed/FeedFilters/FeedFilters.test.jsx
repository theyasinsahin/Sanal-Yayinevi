import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Filters from './index';
import { useFilters } from '../../../context/FiltersContext';
jest.mock('../../../context/FiltersContext', () => ({ useFilters: jest.fn() }));

test('genres are plain Turkish labels even when older records contain emoji or icon URLs', () => {
  const updateFilters = jest.fn(); useFilters.mockReturnValue({ filters: { genre: 'Tümü', sortBy: 'newest' }, updateFilters });
  render(<Filters genres={[{ id: 'g', slug: 'roman', name: '📚 Roman', iconUrl: 'https://example.test/old-icon.png', hexColor: '#6366f1' }]} />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Roman' }));
  expect(updateFilters).toHaveBeenCalledWith('genre', 'roman');
  expect(screen.queryByText('📚')).not.toBeInTheDocument();
});
