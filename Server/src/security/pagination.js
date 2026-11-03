import { badInput } from './graphqlSecurity.js';
export function paginate(query, { limit = 100, offset = 0 } = {}) {
  limit ??= 100; offset ??= 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw badInput('Liste boyutu 1–100, başlangıcı 0–10000 arasında olmalı.');
  return query.skip(offset).limit(limit);
}
