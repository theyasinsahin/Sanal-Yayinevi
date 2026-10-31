import formatError from '../src/utils/formatError.js';

const formatted = { message: 'Failure', locations: [{ line: 1, column: 2 }], path: ['operation'], extensions: { code: 'INTERNAL_SERVER_ERROR', traceId: 'test' } };
test('validation errors expose individual field messages with a bad-input code', () => {
  const result = formatError(formatted, { message: 'Validation', originalError: { name: 'ValidationError', errors: { email: { message: 'Invalid email' }, title: { message: 'Title required' } } } });
  expect(result).toMatchObject({ path: formatted.path, locations: formatted.locations, extensions: { code: 'BAD_USER_INPUT', details: ['Invalid email', 'Title required'] } });
});
test('duplicate key errors identify the conflicting field without echoing its private value', () => {
  const result = formatError(formatted, { message: 'Duplicate', originalError: { code: 11000, keyValue: { email: 'private@example.test' } } });
  expect(result.extensions).toEqual({ code: 'BAD_USER_INPUT', argumentName: 'email' });
  expect(JSON.stringify(result)).not.toContain('private@example.test');
});
test.each(['Giriş yapmalısınız.', 'Unauthorized request'])('authentication errors retain metadata and produce an unauthenticated code: %s', message => {
  expect(formatError(formatted, { message })).toEqual({ ...formatted, extensions: { ...formatted.extensions, code: 'UNAUTHENTICATED' } });
});
test('domain errors preserve their existing code and message', () => {
  const domain = { ...formatted, message: 'Not found', extensions: { code: 'NOT_FOUND' } };
  expect(formatError(domain, { message: 'Not found' })).toBe(domain);
});
