import { InMemoryCache, gql } from '@apollo/client';
import { invalidateQuoteLists } from './quoteCache';
import { notifyScoreChanged, SCORE_UPDATED_EVENT } from './scoreUpdates';

test('quote invalidation clears all list argument variants while preserving unrelated book data', () => {
  const cache = new InMemoryCache();
  const query = gql`query Lists { getQuotesByUser(userId:"a") { id } anotherUser:getQuotesByUser(userId:"b") { id } getQuotesByBook(bookId:"book") { id } getQuotesFeed { id } searchQuotes(query:"term") { id } checkQuoteExists(text:"quote",bookId:"book"){id} book { id title } }`;
  cache.writeQuery({ query, data: {
    getQuotesByUser: [], anotherUser: [], getQuotesByBook: [], getQuotesFeed: [], searchQuotes: [], checkQuoteExists: null,
    book: { __typename: 'Book', id: 'book', title: 'Keep me' },
  } });
  invalidateQuoteLists(cache);
  const root = cache.extract().ROOT_QUERY;
  expect(Object.keys(root).filter(key => /getQuotes|searchQuotes|checkQuoteExists/.test(key))).toEqual([]);
  expect(cache.extract()['Book:book'].title).toBe('Keep me');
  expect(root.book).toEqual({ __ref: 'Book:book' });
});
test('score changes broadcast to the live score listeners', () => {
  const listener = jest.fn();
  window.addEventListener(SCORE_UPDATED_EVENT, listener);
  try { notifyScoreChanged(); expect(listener).toHaveBeenCalledTimes(1); }
  finally { window.removeEventListener(SCORE_UPDATED_EVENT, listener); }
});
