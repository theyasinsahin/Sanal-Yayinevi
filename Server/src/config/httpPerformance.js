import compression from 'compression';
import { performance } from 'node:perf_hooks';

// Per-request compression; no shared response cache for authenticated GraphQL.
export const compressResponses = () => compression({ threshold: 1024, level: 4 });

export const operationTiming = {
  async requestDidStart() {
    const start = performance.now();
    return {
      async willSendResponse({ response }) {
        response.http?.headers.set('server-timing', `graphql;dur=${(performance.now() - start).toFixed(1)}`);
      },
    };
  },
};
