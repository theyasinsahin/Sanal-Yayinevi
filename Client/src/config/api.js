export function createApiConfig(apiUrl = 'http://localhost:5000', wsUrl) {
  const api = new URL(apiUrl);
  const websocket = new URL('/graphql', api);
  websocket.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    API_URL: apiUrl,
    WS_URL: wsUrl || websocket.href,
    GOOGLE_LOGIN_URI: new URL('/auth/google/callback', api).href,
  };
}

// Authentication and GraphQL must use the same environment's server.
export const { API_URL, WS_URL, GOOGLE_LOGIN_URI } = createApiConfig(
  process.env.REACT_APP_API_URL || undefined,
  process.env.REACT_APP_WS_URL,
);
