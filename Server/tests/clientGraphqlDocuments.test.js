import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, validate } from 'graphql';
import schema from '../src/graphql/schema.js';

function files(path) { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]); }
const root = fileURLToPath(new URL('../../Client/src/', import.meta.url));
const sources = files(root).filter(path => /\.(js|jsx)$/.test(path) && !/\.test\./.test(path));
const documents = new Map();
for (const path of sources) {
  for (const [, name, raw] of readFileSync(path, 'utf8').matchAll(/(?:export )?const (\w+) = gql`([\s\S]*?)`/g)) {
    documents.set(name, raw);
  }
}
const expand = name => documents.get(name).replace(/\$\{([A-Z_]+)\}/g, (_, fragment) => expand(fragment));
test.each([...documents.keys()].filter(name => /\b(query|mutation|subscription)\b/.test(documents.get(name))))('client GraphQL operation %s matches the real server schema', name => {
  const ast = parse(expand(name));
  const seen = new Set();
  ast.definitions = ast.definitions.filter(definition => { const name = definition.name?.value; if (name && seen.has(name)) return false; seen.add(name); return true; });
  expect(validate(schema, ast).map(error => error.message)).toEqual([]);
});
