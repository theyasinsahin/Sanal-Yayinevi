import { join } from 'path';
import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import GraphQLJSON from 'graphql-type-json';
import resolvers from './resolvers/index.js'; // Resolver index dosyan

// TypeDefs'leri yükle
const typeDefs = mergeTypeDefs(
  loadFilesSync(join(process.cwd(), 'src/graphql/**/*.graphql')) 
  // Not: "process.cwd()" ile tam yolu garantiye aldık.
);

// Schema oluştur
const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    ...mergeResolvers(resolvers),
    JSON: GraphQLJSON,
  },
});

export default schema;