export function createApiConfig(apiUrl = 'http://localhost:5000', wsUrl, googleLoginUri, websiteOrigin) {
  const api = new URL(apiUrl);
  let website;
  try { website = new URL(websiteOrigin); } catch { /* Native/file origins have no public website URL. */ }
  // GIS creates its CSRF cookie on the website. On Vercel the matching proxy
  // must receive the form POST, even if an old build variable names Render.
  const useWebsiteCallback = website?.protocol === 'https:' && website.hostname.endsWith('.vercel.app');
  const websocket = new URL('/graphql', api);
  websocket.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    API_URL: apiUrl,
    WS_URL: wsUrl || websocket.href,
    GOOGLE_LOGIN_URI: useWebsiteCallback ? new URL('/auth/google/callback', website).href
      : googleLoginUri ? new URL(googleLoginUri).href : new URL('/auth/google/callback', api).href,
  };
}

// A same-origin auth proxy may forward Google form posts to the API while
// keeping Google's CSRF cookie on the frontend's domain.
export const { API_URL, WS_URL, GOOGLE_LOGIN_URI } = createApiConfig(
  process.env.REACT_APP_API_URL || undefined,
  process.env.REACT_APP_WS_URL,
  process.env.REACT_APP_GOOGLE_LOGIN_URI,
  typeof window === 'undefined' ? undefined : window.location.origin,
);
