import { act, renderHook } from '@testing-library/react';
import { useQuery } from '@apollo/client';
import { useLiveScoreQuery } from './useLiveScoreQuery';
import { notifyScoreChanged } from '../utils/scoreUpdates';
jest.mock('@apollo/client', () => ({ useQuery: jest.fn() }));

test('a committed score update refreshes active queries immediately and cleans up listeners', () => {
  const refetch = jest.fn().mockResolvedValue({}); useQuery.mockReturnValue({ refetch });
  const hook = renderHook(() => useLiveScoreQuery('score-query'));
  act(() => notifyScoreChanged());
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(useQuery).toHaveBeenCalledWith('score-query', expect.objectContaining({ fetchPolicy: 'cache-and-network', pollInterval: 15000 }));
  hook.unmount(); act(() => notifyScoreChanged());
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('skipped queries do not fetch when score events arrive', () => {
  const refetch = jest.fn().mockResolvedValue({}); useQuery.mockReturnValue({ refetch });
  const hook = renderHook(() => useLiveScoreQuery('score-query', { skip: true }));
  act(() => notifyScoreChanged()); expect(refetch).not.toHaveBeenCalled(); hook.unmount();
});
