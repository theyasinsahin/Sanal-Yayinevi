import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import Filters from './index';
import { useFilters } from '../../../context/FiltersContext';
import { GET_CLASSIFICATION_OPTIONS } from '../../../graphql/classification';
jest.mock('../../../context/FiltersContext', () => ({ useFilters: jest.fn() }));

test('format and topic filters use separate stable codes from the API', async () => {
  const updateFilters = jest.fn(); useFilters.mockReturnValue({ filters: { classification: null, sortBy: 'newest' }, updateFilters });
  render(<MockedProvider mocks={[{ request: { query: GET_CLASSIFICATION_OPTIONS }, result: { data: { getClassificationOptions: { formats: [{ id: 'f', slug: 'roman', name: 'Roman', isActive: true }], genres: [{ id: 'g', slug: 'fantastik', name: 'Fantastik', group: 'FICTION', isActive: true, hexColor: '#666666' }], narrativeFeatures: [], targetAudiences: [], contentWarnings: [] } } } }]}><Filters /></MockedProvider>);
  await screen.findByRole('option', { name: 'Roman' });
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'roman' } });
  expect(updateFilters).toHaveBeenCalledWith('classification', { formats: ['roman'] });
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'fantastik' } });
  expect(updateFilters).toHaveBeenCalledWith('classification', { genres: ['fantastik'] });
  fireEvent.click(screen.getByRole('radio', { name: 'Desteği açık kitaplar' }));
  expect(updateFilters).toHaveBeenCalledWith('funding', 'ACTIVE');
  fireEvent.click(screen.getByRole('radio', { name: 'Hedefini tamamlayan kitaplar' }));
  expect(updateFilters).toHaveBeenCalledWith('funding', 'FUNDED');
  fireEvent.click(screen.getByRole('radio', { name: 'Hedefe en yakın' }));
  expect(updateFilters).toHaveBeenCalledWith('sortBy', 'closestToTarget');
});
