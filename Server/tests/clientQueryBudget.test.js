import { Kind, specifiedRules, validate } from 'graphql';
import schema from '../src/graphql/schema.js';
import { GRAPHQL_LIMITS, checkDocument, queryBudgetRule } from '../src/security/graphqlSecurity.js';
import { clientOperation } from './clientOperations.js';

test.each(['Me', 'GetUserById', 'GetProfileSavedBooks', 'GetQuotesByUser', 'GetFollowedBooks', 'GetUserScore', 'GetUserBadges'])(
  'the actual post-login client document passes schema validation and the existing budget: %s', name => {
    const document = clientOperation(name);
    expect(validate(schema, document, [...specifiedRules, queryBudgetRule])).toEqual([]);
    expect(() => checkDocument(schema, document, { id: '000000000000000000000001', userId: '000000000000000000000001' })).not.toThrow();
  },
);

test('combining both full book lists reproduces the original rejection without increasing the budget', () => {
  const profile = clientOperation('GetUserById');
  const library = clientOperation('GetProfileSavedBooks');
  const libraryRoot = library.definitions.find(definition => definition.kind === Kind.OPERATION_DEFINITION).selectionSet.selections[0];
  const savedBooks = libraryRoot.selectionSet.selections.find(field => field.name.value === 'savedBooks');
  const combined = { ...profile, definitions: profile.definitions.map(definition => {
    if (definition.kind !== Kind.OPERATION_DEFINITION) return definition;
    const root = definition.selectionSet.selections[0];
    return { ...definition, selectionSet: { ...definition.selectionSet, selections: [
      { ...root, selectionSet: { ...root.selectionSet, selections: [...root.selectionSet.selections, savedBooks] } },
    ] } };
  }) };
  expect(GRAPHQL_LIMITS.cost).toBe(20000);
  expect(() => checkDocument(schema, combined)).toThrow('Sorgu derinlik veya işlem bütçesini aşıyor.');
  expect(validate(schema, combined, [queryBudgetRule])).not.toHaveLength(0);
});
