// Static contract check: extracts every GraphQL operation from the Flutter
// sources and validates it against the backend's real type definitions
// (Server/src/graphql/typedefs/*.graphql) with graphql-js.
//
// Usage: node validate_graphql_documents.cjs <Server dir with node_modules> <repo Server/src/graphql/typedefs> <Client/mobile/lib>
const fs = require('fs');
const path = require('path');
const [, , serverRoot, typedefDir, libDir] = process.argv;
const req = name => require(path.join(serverRoot, 'node_modules', name));
const { parse, validate, buildASTSchema, specifiedRules, NoUnusedFragmentsRule } = req('graphql');
const { mergeTypeDefs } = req('@graphql-tools/merge');

const typeDefs = fs.readdirSync(typedefDir).filter(f => f.endsWith('.graphql')).map(f => fs.readFileSync(path.join(typedefDir, f), 'utf8'));
const schema = buildASTSchema(mergeTypeDefs(typeDefs), { assumeValidSDL: true });

const files = [];
(function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.dart') && files.push(path.join(dir, e.name)); })(libDir);

// Dart string literals: r'''…''', '''…''', r'…', '…' (double quotes are not used for documents).
const literal = /(r?)'''([\s\S]*?)'''|(r?)'((?:[^'\\\n]|\\.)*)'/g;
const strings = [];
const consts = {};
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const m of source.matchAll(literal)) {
    const raw = (m[1] ?? m[3]) === 'r';
    const body = m[2] ?? m[4];
    strings.push({ file, raw, body, index: m.index });
  }
  // const name = <adjacent string literals>;
  for (const m of source.matchAll(/^const (?:String )?(\w+) =\s*((?:r?'''[\s\S]*?'''|r?'(?:[^'\\\n]|\\.)*'|\s)+);/gm)) {
    const parts = [...m[2].matchAll(literal)].map(p => ({ raw: (p[1] ?? p[3]) === 'r', body: p[2] ?? p[4] }));
    consts[m[1]] = parts;
  }
}
const resolved = {};
function resolveConst(name, seen = new Set()) {
  if (resolved[name] !== undefined) return resolved[name];
  if (!consts[name] || seen.has(name)) return null;
  seen.add(name);
  const text = consts[name].map(p => resolveBody(p, seen)).join('');
  return (resolved[name] = text.includes('\u0000') ? null : text);
}
function resolveBody({ raw, body }, seen = new Set()) {
  if (raw) return body;
  return body
    .replace(/\\\$/g, '\u0001')
    .replace(/\$\{([^}]*)\}|\$(\w+)/g, (_, expr, ident) => {
      const name = ident ?? (/^\w+$/.test(expr) ? expr : null);
      const value = name ? resolveConst(name, seen) : null;
      return value ?? '\u0000';
    })
    .replace(/\u0001/g, '$')
    .replace(/\\'/g, "'").replace(/\\n/g, '\n');
}

let checked = 0, failed = 0; const skipped = [];
const seenDocs = new Set();
// Operations may be built from adjacent literals: join consecutive strings of one file that follow each other closely.
for (const s of strings) {
  let text = resolveBody(s).trim();
  if (!/^(query|mutation|subscription)\b/.test(text) || !text.includes('{')) continue;
  const where = `${path.relative(libDir, s.file)}:${fs.readFileSync(s.file, 'utf8').slice(0, s.index).split('\n').length}`;
  if (text.includes('\u0000')) { skipped.push(`${where}  ${text.slice(0, 60).replace(/\s+/g, ' ')}`); continue; }
  if (seenDocs.has(text)) continue; seenDocs.add(text);
  checked++;
  try {
    const errors = validate(schema, parse(text), specifiedRules.filter(rule => rule !== NoUnusedFragmentsRule));
    if (errors.length) { failed++; console.log(`FAIL ${where}\n  ${errors.map(e => e.message).join('\n  ')}`); }
  } catch (error) { failed++; console.log(`PARSE ${where}\n  ${error.message}\n  ${text.slice(0, 200)}`); }
}
console.log(`\nvalidated ${checked} documents, ${failed} failed, ${skipped.length} skipped (dynamic interpolation):`);
skipped.forEach(s => console.log('  skipped ' + s));
process.exit(failed ? 1 : 0);
