import { GraphQLError, Kind, defaultFieldResolver, getNamedType, isListType, isNonNullType, valueFromASTUntyped } from 'graphql';
import { limitOperation } from './rateLimit.js';
import { canReadBook } from '../utils/bookAccess.js';
import { getLoaders } from '../graphql/loaders.js';

export const badInput = message => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
export const GRAPHQL_LIMITS = Object.freeze({ depth: 12, fields: 400, aliases: 40, cost: 20000, queryBytes: 65536, inputBytes: 1048576 });
const listType = type => isListType(isNonNullType(type) ? type.ofType : type);

// Iterative expansion counts repeated fragment spreads and aliases rather than
// trusting a shallow AST depth. It stops before an exponential expansion.
export function checkDocument(schema, document, variables = {}) {
  const fragments = new Map(document.definitions.filter(node => node.kind === Kind.FRAGMENT_DEFINITION).map(node => [node.name.value, node]));
  for (const operation of document.definitions.filter(node => node.kind === Kind.OPERATION_DEFINITION)) {
    const root = operation.operation === 'query' ? schema.getQueryType() : operation.operation === 'mutation' ? schema.getMutationType() : schema.getSubscriptionType();
    const stack = [{ set: operation.selectionSet, type: root, depth: 0, weight: 1, path: new Set() }];
    let fields = 0, aliases = 0, cost = 0;
    while (stack.length) {
      const { set, type, depth, weight, path } = stack.pop();
      for (const node of set?.selections || []) {
        if (node.kind === Kind.FRAGMENT_SPREAD) {
          if (path.has(node.name.value)) throw badInput('Döngüsel sorgu parçası kullanılamaz.');
          const fragment = fragments.get(node.name.value);
          if (fragment) stack.push({ set: fragment.selectionSet, type: schema.getType(fragment.typeCondition.name.value), depth, weight, path: new Set([...path, node.name.value]) });
          continue;
        }
        if (node.kind === Kind.INLINE_FRAGMENT) { stack.push({ set: node.selectionSet, type: node.typeCondition ? schema.getType(node.typeCondition.name.value) : type, depth, weight, path }); continue; }
        fields++; if (node.alias) aliases++;
        cost += weight;
        if (depth + 1 > GRAPHQL_LIMITS.depth || fields > GRAPHQL_LIMITS.fields || aliases > GRAPHQL_LIMITS.aliases || cost > GRAPHQL_LIMITS.cost) throw badInput('Sorgu derinlik veya işlem bütçesini aşıyor.');
        const field = type?.getFields?.()[node.name.value];
        let multiplier = 1;
        if (field && listType(field.type)) {
          const limit = node.arguments?.find(arg => ['limit', 'first'].includes(arg.name.value));
          const count = limit ? valueFromASTUntyped(limit.value, variables) : undefined;
          if (count != null && (!Number.isInteger(count) || count < 1 || count > 100)) throw badInput('Liste boyutu 1–100 arasında olmalı.');
          multiplier = count || 20;
        }
        if (node.selectionSet) stack.push({ set: node.selectionSet, type: field && getNamedType(field.type), depth: depth + 1, weight: weight * multiplier, path });
      }
    }
  }
}

export function queryBudgetRule(context) {
  return { Document(node) { try { checkDocument(context.getSchema(), node); } catch (error) { context.reportError(error); } } };
}
export function checkInputs(value, key = '', depth = 0) {
  if (depth > 12) throw badInput('İstek girdileri fazla iç içe.');
  if (typeof value === 'string') {
    const maximum = key === 'content' ? 500000 : ['token', 'credential', 'newPassword', 'password', 'currentPassword'].includes(key) ? 8192 : 20000;
    if (value.length > maximum) throw badInput('Metin izin verilen uzunluğu aşıyor.');
  } else if (Array.isArray(value)) {
    if (value.length > 500) throw badInput('Girdi listesi çok uzun.');
    value.forEach(item => checkInputs(item, key, depth + 1));
  } else if (value && typeof value === 'object') {
    for (const [name, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(name)) throw badInput('Geçersiz girdi alanı.');
      if (['limit', 'first'].includes(name) && item != null && (!Number.isInteger(item) || item < 1 || item > 100)) throw badInput('Liste boyutu 1–100 arasında olmalı.');
      if (name === 'offset' && item != null && (!Number.isInteger(item) || item < 0 || item > 10000)) throw badInput('Liste başlangıcı 0–10000 arasında olmalı.');
      checkInputs(item, name, depth + 1);
    }
  }
}

export function secureRootFields(schema) {
  for (const [type, mutation] of [[schema.getQueryType(), false], [schema.getMutationType(), true]]) {
    for (const field of Object.values(type?.getFields() || {})) {
      const resolve = field.resolve || defaultFieldResolver;
      field.resolve = async (parent, args, context, info) => {
        context ||= {};
        checkInputs(args);
        // Also covers GraphQL-over-WebSocket and aliases, not only HTTP requests.
        await limitOperation(context, field.name, args, mutation);
        return resolve(parent, args, context, info);
      };
    }
  }
  // Protect nested Book references even when populated/aggregated with only a
  // title. Root lookup checks alone cannot prevent attachment/reference leaks.
  for (const field of Object.values(schema.getType('Book')?.getFields() || {})) {
    const resolve = field.resolve || defaultFieldResolver;
    field.resolve = async (parent, args, context, info) => {
      const book = parent.status != null && parent.isDeleted != null ? parent : await getLoaders(context).books.load(parent._id || parent.id || parent);
      if (!canReadBook(book, context.user)) throw new GraphQLError('Kitap erişilebilir değil.', { extensions: { code: 'FORBIDDEN' } });
      if (book.kind !== 'PRINTED' && book.authorId && !await getLoaders(context).users.load(book.authorId)) throw new GraphQLError('Kitap erişilebilir değil.', { extensions: { code: 'FORBIDDEN' } });
      return resolve(parent, args, context, info);
    };
  }
  return schema;
}

export const graphqlSecurityPlugin = {
  async requestDidStart({ request }) {
    if (Buffer.byteLength(request.query || '') > GRAPHQL_LIMITS.queryBytes || Buffer.byteLength(JSON.stringify(request.variables || {})) > GRAPHQL_LIMITS.inputBytes) throw badInput('Sorgu veya girdi boyutu çok büyük.');
    return { async didResolveOperation({ schema, document, request }) { checkDocument(schema, document, request.variables); checkInputs(request.variables); } };
  },
};
