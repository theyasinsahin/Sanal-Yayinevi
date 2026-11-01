import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { GET_RECOMMENDATIONS, GET_USER_PREFERENCE, SAVE_USER_PREFERENCE, MARK_CHAPTER_AS_READ, useRecommendations, useUserPreference, useMarkChapterAsRead } from './useRecommendations';
jest.mock('@mui/icons-material', () => require('../../test-support/icons.cjs'));

let mockUser;
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
beforeEach(() => { mockUser = { id: 'reader' }; });
const wrapper = mocks => ({ children }) => <MockedProvider mocks={mocks}>{children}</MockedProvider>;
const recommendation = score => ({ __typename: 'RecommendationResult', score, reason: 'For you', book: null });
const page = (limit, offset, values) => ({ request: { query: GET_RECOMMENDATIONS, variables: { limit, offset } }, result: { data: { getRecommendations: values.map(recommendation) } } });

test('guests do not send protected recommendation or preference requests', async () => {
  mockUser = null;
  const { result } = renderHook(() => ({ recommendations: useRecommendations(), preference: useUserPreference() }), { wrapper: wrapper([]) });
  expect(result.current.recommendations.recommendations).toEqual([]);
  expect(result.current.recommendations.loading).toBe(false);
  expect(result.current.recommendations.loadMore()).toBeUndefined();
  await expect(result.current.preference.savePreference(['genre'])).rejects.toThrow();
});
test('disabled recommendations remain idle for authenticated users', () => {
  const { result } = renderHook(() => useRecommendations(10, 0, false), { wrapper: wrapper([]) });
  expect(result.current.loading).toBe(false);
  expect(result.current.recommendations).toEqual([]);
});
test('recommendations load further results from the current count', async () => {
  const { result } = renderHook(() => useRecommendations(2), { wrapper: wrapper([page(2, 0, [1, 2]), page(2, 2, [3])]) });
  await waitFor(() => expect(result.current.recommendations).toHaveLength(2));
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.recommendations.map(item => item.score)).toEqual([1, 2, 3]));
});
test('recommendation failures are exposed to the caller', async () => {
  const { result } = renderHook(() => useRecommendations(), { wrapper: wrapper([{ request: { query: GET_RECOMMENDATIONS, variables: { limit: 10, offset: 0 } }, error: new Error('Offline') }]) });
  await waitFor(() => expect(result.current.error?.message).toBe('Offline'));
  expect(result.current.recommendations).toEqual([]);
});
test('saved preferences refresh both onboarding and recommendations', async () => {
  const preference = { __typename: 'UserPreference', id: 'pref', onboardingCompleted: true, preferredGenres: [] };
  const save = jest.fn(() => ({ data: { saveUserPreference: preference } }));
  const mocks = [
    { request: { query: GET_USER_PREFERENCE }, result: { data: { getUserPreference: null } } },
    { request: { query: SAVE_USER_PREFERENCE, variables: { genreIds: ['genre'] } }, result: save },
    { request: { query: GET_USER_PREFERENCE }, result: { data: { getUserPreference: preference } } },
    page(10, 0, []),
  ];
  const { result } = renderHook(useUserPreference, { wrapper: wrapper(mocks) });
  await waitFor(() => expect(result.current.preferenceLoading).toBe(false));
  expect(result.current.onboardingCompleted).toBe(false);
  await act(async () => { await result.current.savePreference(['genre']); });
  expect(result.current.onboardingCompleted).toBe(true);
  expect(save).toHaveBeenCalledTimes(1);
});
test('chapter completion sends the selected book and chapter IDs', async () => {
  const complete = jest.fn(() => ({ data: { markChapterAsRead: { __typename: 'ReadingHistory', id: 'h', completedChapters: ['chapter'], isCompleted: true, lastReadAt: '2026-01-01' } } }));
  const { result } = renderHook(useMarkChapterAsRead, { wrapper: wrapper([{ request: { query: MARK_CHAPTER_AS_READ, variables: { bookId: 'book', chapterId: 'chapter' } }, result: complete }]) });
  await act(async () => { await result.current.markAsRead('book', 'chapter'); });
  expect(complete).toHaveBeenCalledTimes(1);
});
