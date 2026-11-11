import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Kind, parse, visit } from 'graphql';

// Read the shipped client documents instead of duplicating their selection sets
// in fixtures. Include the __typename fields Apollo adds on the wire.
const clientRequire = createRequire(new URL('../../Client/package.json', import.meta.url));
const { addTypenameToDocument } = clientRequire('@apollo/client/utilities');
const definitions = new Map();
function readDocuments(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = new URL(entry.name, directory);
    if (entry.isDirectory()) readDocuments(new URL(`${entry.name}/`, directory));
    else if (entry.name.endsWith('.js')) {
      for (const match of readFileSync(file, 'utf8').matchAll(/gql`([\s\S]*?)`/g)) {
        for (const definition of parse(match[1].replace(/\$\{[^}]+\}/g, '')).definitions) {
          if (definition.name) definitions.set(definition.name.value, definition);
        }
      }
    }
  }
}
readDocuments(new URL('../../Client/src/graphql/', import.meta.url));

export function clientOperation(name) {
  const operation = definitions.get(name);
  if (operation?.kind !== Kind.OPERATION_DEFINITION) throw new Error(`Client operation not found: ${name}`);
  const selected = new Map([[name, operation]]);
  const collect = definition => visit(definition, {
    FragmentSpread(node) {
      const fragment = definitions.get(node.name.value);
      if (!fragment) throw new Error(`Client fragment not found: ${node.name.value}`);
      if (!selected.has(node.name.value)) { selected.set(node.name.value, fragment); collect(fragment); }
    },
  });
  collect(operation);
  return addTypenameToDocument({ kind: Kind.DOCUMENT, definitions: [...selected.values()] });
}
