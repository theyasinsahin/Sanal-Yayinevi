import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FiltersProvider, useFilters } from './index';

function Probe() {
  const { filters, updateFilters } = useFilters();
  return <><output>{JSON.stringify(filters)}</output>
    <button onClick={() => updateFilters('sortBy', 'closestToTarget')}>Closest</button>
    <button onClick={() => updateFilters('funding', 'FUNDED')}>Funded</button>
    <button onClick={() => updateFilters('funding', 'ALL')}>All</button>
    <button onClick={() => updateFilters('search', 'İpek')}>Search</button>
  </>;
}
const show = () => render(<FiltersProvider><Probe /></FiltersProvider>);
const selected = () => JSON.parse(screen.getByRole('status').textContent);

test('closest sorting automatically selects open campaigns while keeping search', () => {
  show(); fireEvent.click(screen.getByText('Search')); fireEvent.click(screen.getByText('Closest'));
  expect(selected()).toMatchObject({ sortBy: 'closestToTarget', funding: 'ACTIVE', search: 'İpek' });
});

test.each(['Funded', 'All'])('switching to %s clears the incompatible closest sort', label => {
  show(); fireEvent.click(screen.getByText('Closest')); fireEvent.click(screen.getByText(label));
  expect(selected()).toMatchObject({ sortBy: 'newest', funding: label === 'Funded' ? 'FUNDED' : 'ALL' });
});
