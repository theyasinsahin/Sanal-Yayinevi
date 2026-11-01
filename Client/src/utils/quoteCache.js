export function invalidateQuoteLists(cache) {
  for (const fieldName of ['getQuotesByUser', 'getQuotesByBook', 'getQuotesFeed', 'searchQuotes', 'checkQuoteExists']) {
    cache.evict({ id: 'ROOT_QUERY', fieldName });
  }
}
