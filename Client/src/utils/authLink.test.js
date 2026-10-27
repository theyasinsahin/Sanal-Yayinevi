import { ApolloLink, Observable, execute, gql } from '@apollo/client';
import { createAuthLink } from './authLink';
import { AUTH_SESSION_CHANGED } from './authSession';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';

const query = gql`query TestSession { me { id } }`;
const token = id => `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, userId: id }))}.signature`;
const request = link => new Promise(resolve => execute(link, { query }).subscribe({ next: resolve, error: resolve }));
beforeEach(() => localStorage.clear());

test.each(['graphql', 'http', 'websocket'])('%s authentication errors clear all session data and publish the change', async kind => {
  localStorage.setItem('token', token('reader')); localStorage.setItem('user', '{}'); localStorage.setItem('userId', 'reader');
  const changed = jest.fn(); window.addEventListener(AUTH_SESSION_CHANGED, changed);
  const terminal = new ApolloLink(() => new Observable(observer => {
    if (kind === 'graphql') { observer.next({ errors: [{ message: 'Login required', extensions: { code: 'UNAUTHENTICATED' } }] }); observer.complete(); }
    else observer.error(kind === 'http' ? { statusCode: 401 } : { code: 4401 });
  }));
  await request(createAuthLink().concat(terminal));
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('user')).toBeNull();
  expect(localStorage.getItem('userId')).toBeNull();
  expect(changed).toHaveBeenCalledTimes(1);
  window.removeEventListener(AUTH_SESSION_CHANGED, changed);
});

test('an old request rejection does not clear a newer login', async () => {
  localStorage.setItem('token', token('old'));
  const nextToken = token('new');
  const terminal = new ApolloLink(() => new Observable(observer => {
    localStorage.setItem('token', nextToken);
    observer.next({ errors: [{ message: 'Login required', extensions: { code: 'UNAUTHENTICATED' } }] }); observer.complete();
  }));
  await request(createAuthLink().concat(terminal));
  expect(localStorage.getItem('token')).toBe(nextToken);
});

test.each([403, 500])('HTTP %s does not log out the user', async statusCode => {
  const value = token('reader'); localStorage.setItem('token', value);
  await request(createAuthLink().concat(new ApolloLink(() => new Observable(observer => observer.error({ statusCode })))));
  expect(localStorage.getItem('token')).toBe(value);
});

test.each([4401, 4403, 1006])('real GraphQLWsLink close event %s invalidates only rejected authentication', async code => {
  const value = token('reader'); localStorage.setItem('token', value);
  const transport = new GraphQLWsLink({ subscribe(operation, sink) {
    sink.error({ code, reason: 'Connection closed' });
    return () => {};
  } });
  await request(createAuthLink().concat(transport));
  expect(localStorage.getItem('token')).toBe(code === 4401 ? null : value);
});

test('expired credentials are removed before a public request is forwarded', async () => {
  const expired = `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 10 }))}.signature`;
  localStorage.setItem('token', expired); localStorage.setItem('userId', 'reader'); localStorage.setItem('user', '{}');
  const terminal = new ApolloLink(operation => new Observable(observer => {
    expect(operation.getContext().headers.authorization).toBe('');
    observer.next({ data: { me: null } }); observer.complete();
  }));
  await request(createAuthLink().concat(terminal));
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('userId')).toBeNull();
  expect(localStorage.getItem('user')).toBeNull();
});
