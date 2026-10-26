import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { invalidateSession, tokenExpiresAt } from './authSession';

export function isAuthenticationError({ graphQLErrors, networkError }) {
  return graphQLErrors?.some(error =>
    error.extensions?.code === 'UNAUTHENTICATED' || error.message?.includes('jwt expired')
  ) || networkError?.statusCode === 401 || networkError?.status === 401 || networkError?.code === 4401;
}

export function createAuthLink() {
  const credentials = setContext((_, { headers }) => {
    let token = localStorage.getItem('token');
    if (token && tokenExpiresAt(token) <= Date.now()) {
      invalidateSession(token);
      token = null;
    }
    return { sessionToken: token, headers: { ...headers, authorization: token ? `Bearer ${token}` : '' } };
  });
  const errors = onError(({ operation, graphQLErrors, networkError }) => {
    if (isAuthenticationError({ graphQLErrors, networkError })) {
      invalidateSession(operation.getContext().sessionToken);
    }
  });
  return credentials.concat(errors);
}
