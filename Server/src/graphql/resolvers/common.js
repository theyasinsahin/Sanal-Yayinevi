export default {
  Query: {
    healthCheck: () => "Server is up and running!",
  },
  Mutation: {
    ping: () => "Pong!",
  }
};