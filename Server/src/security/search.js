import { badInput } from './graphqlSecurity.js';
export function literalSearch(value) {
  if (typeof value !== 'string' || value.length > 120) throw badInput('Arama en fazla 120 karakter olmalı.');
  return value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
