import { GraphQLError, parse, validate, specifiedRules, getOperationAST } from 'graphql';
import { authenticateUser, verifyAccessToken } from '../utils/auth.js';
import { createLoaders } from '../graphql/loaders.js';
import { checkDocument, checkInputs, GRAPHQL_LIMITS } from './graphqlSecurity.js';
import { consumeRate } from './rateLimit.js';
import formatError from '../utils/formatError.js';

export function websocketOptions(schema, models) {
  return {
    schema, connectionInitWaitTimeout: 5000,
    async onSubscribe(ctx, id, payload) {
      try {
        if (Object.keys(ctx.subscriptions).length > 5 || Buffer.byteLength(payload.query || '') > GRAPHQL_LIMITS.queryBytes || Buffer.byteLength(JSON.stringify(payload.variables || {})) > GRAPHQL_LIMITS.inputBytes) throw new Error('Sınır aşıldı.');
        await consumeRate('ws-operation', ctx.extra.request.ip || ctx.extra.request.socket.remoteAddress || 'unknown', 60, 60000);
        const document = parse(payload.query, { maxTokens: 10000 });
        checkDocument(schema, document, payload.variables); checkInputs(payload.variables);
        const operation = getOperationAST(document, payload.operationName);
        if (!operation || operation.operation !== 'subscription') throw new Error('Yalnız abonelik desteklenir.');
        const errors = validate(schema, document, specifiedRules, { maxErrors: 20 });
        if (errors.length) return errors;
        const authorization = ctx.connectionParams?.authorization;
        let user = null, authExpiresAt;
        if (authorization) {
          if (typeof authorization !== 'string') throw new Error('Geçersiz oturum.');
          const claims = verifyAccessToken(authorization.replace(/^Bearer /, ''));
          authExpiresAt = Math.min(claims.exp ? claims.exp * 1000 : Infinity, (claims.iat + 86400) * 1000);
          user = await authenticateUser({ headers: { authorization } }, models.User);
          if (!user) throw new Error('Geçersiz oturum.');
        }
        const contextValue = { ...models, user, authExpiresAt, socketRequest: ctx.extra.request, currentUserId: user?._id || null, loaders: createLoaders() };
        return { schema, document, operationName: payload.operationName, variableValues: payload.variables, contextValue };
      } catch {
        return [new GraphQLError('Abonelik isteği veya oturumu geçersiz.', { extensions: { code: 'BAD_REQUEST' } })];
      }
    },
    async onOperation(ctx, id, payload, args, result) {
      if (!result?.[Symbol.asyncIterator]) return;
      const context = args.contextValue;
      return (async function* () {
        for await (const value of result) {
          if (context.user) {
            if (context.authExpiresAt <= Date.now()) return;
            const active = await models.User.findOne({ _id: context.user._id, isDeleted: false, isActive: { $ne: false } }).select('-password');
            if (!active || (active.authVersion ?? 0) !== (context.user.authVersion ?? 0)) return;
            context.user = active;
          }
          yield value;
        }
      })();
    },
    onNext(ctx, id, payload, args, result) {
      if (result.errors) return { ...result, errors: result.errors.map(error => formatError(error.toJSON(), error)) };
    },
  };
}
