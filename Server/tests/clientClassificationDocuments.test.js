import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, validate } from 'graphql';
import schema from '../src/graphql/schema.js';

function files(path) { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]); }
const root = fileURLToPath(new URL('../../Client/src/', import.meta.url));
const sources = [...files(join(root, 'graphql')), join(root, 'hooks/useRecommendations.js')].filter(path => path.endsWith('.js'));
const documents = new Map();
const integrated = new Set();
for (const path of sources) {
  for (const [, name, raw] of readFileSync(path, 'utf8').matchAll(/(?:export )?const (\w+) = gql`([\s\S]*?)`/g)) {
    documents.set(name, raw);
    if (/WorkClassificationFields|Classification|BookFeed|createBook|PRINT_APPLICATION_FIELDS/.test(raw)) integrated.add(name);
  }
}
const expand = name => documents.get(name).replace(/\$\{([A-Z_]+)\}/g, (_, fragment) => expand(fragment));
test.each([...integrated].filter(name => /\b(query|mutation|subscription)\b/.test(documents.get(name))))('classification-integrated GraphQL document %s matches the real server schema', name => {
  const ast = parse(expand(name));
  const seen = new Set();
  ast.definitions = ast.definitions.filter(definition => { const name = definition.name?.value; if (name && seen.has(name)) return false; seen.add(name); return true; });
  expect(validate(schema, ast).map(error => error.message)).toEqual([]);
});
