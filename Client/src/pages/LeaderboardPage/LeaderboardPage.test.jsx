import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import LeaderboardPage from './index';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

let mockUser, mockEntries, mockRank;
const mockLiveQuery = jest.fn();
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../hooks/useLiveScoreQuery', () => ({ useLiveScoreQuery: (...args) => mockLiveQuery(...args) }));
beforeEach(() => {
  mockUser = { id: 'reader' }; mockRank = { rank: 12, points: 30 };
  mockEntries = [{ rank: 1, points: 1500, user: { id: 'first', username: 'first', fullName: 'First Reader', profilePicture: '' } }];
  mockLiveQuery.mockReset().mockImplementation(query => ({ data: query.definitions.some(d => d.name?.value === 'GetUserRank') ? { getUserRank: mockRank } : { getLeaderboard: mockEntries }, loading: false }));
});
const show = () => render(<MockedProvider mocks={[]}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LeaderboardPage /></MemoryRouter></MockedProvider>);

test('leaderboard profiles use public paths and a reader outside the leaders sees their own rank', () => {
  show();
  expect(screen.getAllByRole('link').every(link => link.getAttribute('href') === '/yazar/first')).toBe(true);
  expect(screen.getByText('Senin sıran')).toBeInTheDocument();
  expect(screen.getByText('#12')).toBeInTheDocument();
  expect(screen.getAllByText('999+ puan').length).toBeGreaterThan(0);
});
test('period tabs request the selected period for both rankings', () => {
  show(); fireEvent.click(screen.getByRole('button', { name: 'Haftalık' }));
  expect(mockLiveQuery.mock.calls.some(([, options]) => options.variables?.period === 'weekly')).toBe(true);
});
test('the reader own rank is not duplicated when they already appear in the leaderboard', () => {
  mockEntries[0].user.id = 'reader'; show();
  expect(screen.queryByText('Senin sıran')).not.toBeInTheDocument();
  // Inspect structural markup that has no independent accessible control.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector('.leaderboard-row.is-me')).toBeInTheDocument();
});
