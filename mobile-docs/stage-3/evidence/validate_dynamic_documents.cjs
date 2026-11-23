// Validates every variant of the two GraphQL documents the Flutter app builds
// at run time (skipped by validate_graphql_documents.cjs), expanded exactly as
// the Dart code builds them, against the server's type definitions.
// Usage: node validate_dynamic_documents.cjs <Server dir with node_modules> <typedefs dir>
const fs = require('fs'), path = require('path');
const [, , serverRoot, typedefDir] = process.argv;
const req = n => require(path.join(serverRoot, 'node_modules', n));
const { parse, validate, buildASTSchema } = req('graphql');
const { mergeTypeDefs } = req('@graphql-tools/merge');
const schema = buildASTSchema(mergeTypeDefs(fs.readdirSync(typedefDir).filter(f => f.endsWith('.graphql')).map(f => fs.readFileSync(path.join(typedefDir, f), 'utf8'))), { assumeValidSDL: true });
const userFields = 'id username fullName profilePicture';
const followAction = 'code message followStatus request { id status }';
const docs = {};
// profile_screen.dart _FollowButton: (field, argument) per follow status
for (const field of ['requestFollowUser', 'cancelFollowRequest', 'unfollowUser']) docs[`FollowAction/${field}`] = `mutation FollowAction($id: ID!) { ${field}(targetId: $id) { ${followAction} } }`;
// profile_screen.dart removeFollower (static, checked for completeness)
docs['RemoveFollower'] = `mutation RemoveFollower($followerId: ID!) { removeFollower(followerId: $followerId) { ${followAction} } }`;
// leaderboard_screen.dart _load: guest and signed-in variants
for (const me of [null, 'x']) docs[`Leaderboard/${me ? 'member' : 'guest'}`] = `query Leaderboard($period: String${me == null ? '' : ', $userId: ID!'}) {
  getLeaderboard(period: $period) { rank points user { ${userFields} } }
  ${me == null ? '' : 'getUserRank(userId: $userId, period: $period) { rank points }'}
}`;
let failed = 0;
for (const [name, text] of Object.entries(docs)) {
  const errors = validate(schema, parse(text));
  console.log(`${errors.length ? 'FAIL' : 'ok  '} ${name}${errors.length ? ' — ' + errors.map(e => e.message).join('; ') : ''}`);
  failed += errors.length ? 1 : 0;
}
console.log(`\n${Object.keys(docs).length} variants, ${failed} failed`);
process.exit(failed ? 1 : 0);
