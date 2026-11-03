export function createApiConfig(apiUrl = 'http://localhost:5000', wsUrl, googleLoginUri) {
  const api = new URL(apiUrl);
  const websocket = new URL('/graphql', api);
  websocket.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    API_URL: apiUrl,
    WS_URL: wsUrl || websocket.href,
    GOOGLE_LOGIN_URI: googleLoginUri ? new URL(googleLoginUri).href : new URL('/auth/google/callback', api).href,
  };
}

// A same-origin auth proxy may forward Google form posts to the API while
// keeping Google's CSRF cookie on the frontend's domain.
export const { API_URL, WS_URL, GOOGLE_LOGIN_URI } = createApiConfig(
  process.env.REACT_APP_API_URL || undefined,
  process.env.REACT_APP_WS_URL,
  process.env.REACT_APP_GOOGLE_LOGIN_URI,
);
