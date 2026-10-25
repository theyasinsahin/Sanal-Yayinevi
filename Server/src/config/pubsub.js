import { PubSub } from 'graphql-subscriptions';

// Services must not import the entry point, which also starts the HTTP server.
export const pubsub = new PubSub();
