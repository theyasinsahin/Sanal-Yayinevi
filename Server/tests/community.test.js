import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'node:fs';
import { PubSub } from 'graphql-subscriptions';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Book from '../src/models/book.js';
import User from '../src/models/user.js';
import Subscription from '../src/models/newsletterSubscription.js';

const sendMail = jest.fn();
jest.unstable_mockModule('../src/config/smtp.js', () => ({ default: { sendMail }, contactRecipient: () => process.env.CONTACT_EMAIL || process.env.EMAIL_USER }));
// Other resolvers import pubsub from the entry point. Avoid booting the real server in tests.
jest.unstable_mockModule('../index.js', () => ({ pubsub: new PubSub() }));
const { default: resolvers } = await import('../src/graphql/resolvers/community.js');
const schema = makeExecutableSchema({ typeDefs: [readFileSync('src/graphql/typedefs/common.graphql', 'utf8'), readFileSync('src/graphql/typedefs/community.graphql', 'utf8')], resolvers });
let testNumber = 0;
beforeAll(async () => {
  await connect();
  Object.assign(process.env, { EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'test', CONTACT_EMAIL: 'contact@example.test', CLIENT_URL: 'http://localhost:3000' });
});
beforeEach(() => { testNumber++; });
afterEach(async () => { await clearDatabase(); sendMail.mockReset(); });
afterAll(closeDatabase);
const run = (source, variableValues) => graphql({ schema, source, variableValues, contextValue: { req: { ip: `test-${testNumber}` } } });
const authorsQuery = `query($page: Int, $pageSize: Int) { getAuthors(page: $page, pageSize: $pageSize) { total page totalPages pageSize authors { id username bookCount pageCount } } }`;
const contactMutation = `mutation($input: ContactMessageInput!) { sendContactMessage(input: $input) { code message } }`;
const subscribeMutation = `mutation($input: NewsletterSubscriptionInput!) { subscribeNewsletter(input: $input) { code message } }`;
const manageMutation = `mutation($token: String!, $action: NewsletterAction!) { manageNewsletter(token: $token, action: $action) { code message } }`;

test('community operations are registered in the application GraphQL schema', async () => {
  const { default: applicationSchema } = await import('../src/graphql/schema.js');
  const response = await graphql({ schema: applicationSchema, source: authorsQuery, variableValues: { page: 1, pageSize: 5 } });
  expect(response.errors).toBeUndefined();
  expect(response.data.getAuthors).toMatchObject({ total: 0, pageSize: 5, totalPages: 1, authors: [] });
  expect(applicationSchema.getMutationType().getFields()).toHaveProperty('subscribeNewsletter');
});

test('authors count actual public books, exclude private/inactive/orphan records and paginate', async () => {
  const users = await User.create(Array.from({ length: 27 }, (_, i) => ({ username: `writer${String(i).padStart(2, '0')}`, fullName: 'Writer', email: `a${i}@example.test`, password: 'hash', ...(i === 25 ? { privacySettings: { isProfilePublic: false } } : {}), ...(i === 26 ? { isActive: false } : {}) })));
  await Book.create(users.map(user => ({ title: 'Visible', authorId: user._id, status: 'WRITING', pageCount: 80 })));
  await Book.create([{ title: 'Second', authorId: users[0]._id, status: 'COMPLETED', pageCount: 120 }, { title: 'Draft', authorId: users[0]._id }, { title: 'Deleted', authorId: users[0]._id, status: 'WRITING', isDeleted: true }, { title: 'Orphan', status: 'WRITING' }]);
  const response = await run(authorsQuery, { page: 1, pageSize: 10 });
  expect(response.errors).toBeUndefined();
  const first = response.data.getAuthors;
  expect(first.total).toBe(25); expect(first.authors).toHaveLength(10); expect(first.authors[0].bookCount).toBe(2);
  expect(first.authors[0].email).toBeUndefined();
  expect(first.authors[0].pageCount).toBe(200); expect(first.totalPages).toBe(3);
  const second = await run(authorsQuery, { page: 3, pageSize: 10 }); expect(second.data.getAuthors.authors).toHaveLength(5);
  expect((await run(authorsQuery, { page: 0 })).errors[0].extensions.code).toBe('BAD_USER_INPUT');
});
test('contact validates, reports delivery failure and accepts only accepted mail', async () => {
  expect((await run(contactMutation, { input: { name: 'A', email: 'bad', subject: 'A', message: 'short' } })).errors[0].extensions.code).toBe('BAD_USER_INPUT');
  const body = { name: 'Test User', email: 'test@example.test', subject: 'Question', message: 'A valid message for Betik.' };
  sendMail.mockRejectedValueOnce(new Error('SMTP failure'));
  expect((await run(contactMutation, { input: body })).errors[0].extensions.code).toBe('INTERNAL_SERVER_ERROR');
  sendMail.mockResolvedValueOnce({ accepted: ['contact@example.test'] });
  expect((await run(contactMutation, { input: body })).data.sendContactMessage.code).toBe(200);
  expect(sendMail.mock.calls[1][0].replyTo).toBe(body.email);
  expect(sendMail.mock.calls[1][0].html).toContain('Okunmayı bekleyen bir mesaj.');
  expect(sendMail.mock.calls[1][0].text).toContain(body.message);
});
test('newsletter requires consent, confirms once, deduplicates and unsubscribes', async () => {
  expect((await run(subscribeMutation, { input: { email: 'reader@example.test', consent: false } })).errors[0].extensions.code).toBe('BAD_USER_INPUT');
  sendMail.mockResolvedValue({ accepted: ['reader@example.test'] });
  const body = { email: 'Reader@example.test', consent: true };
  expect((await run(subscribeMutation, { input: body })).data.subscribeNewsletter.code).toBe(200);
  const token = sendMail.mock.calls[0][0].text.match(/token=([a-f0-9]{64})/)[1];
  expect(sendMail.mock.calls[0][0].html).toContain(`token=${token}&amp;action=confirm`);
  expect(sendMail.mock.calls[0][0].html).toContain(`token=${token}&amp;action=unsubscribe`);
  let record = await Subscription.findOne(); expect(record.status).toBe('pending'); expect(record.tokenHash).not.toBe(token);
  expect((await run(manageMutation, { token, action: 'confirm' })).data.manageNewsletter.code).toBe(200);
  expect((await run(subscribeMutation, { input: body })).data.subscribeNewsletter.code).toBe(200); expect(await Subscription.countDocuments()).toBe(1); expect(sendMail).toHaveBeenCalledTimes(1);
  expect((await run(manageMutation, { token, action: 'unsubscribe' })).data.manageNewsletter.code).toBe(200);
  record = await Subscription.findOne(); expect(record.status).toBe('unsubscribed');
});
test('rate limiting bounds anonymous writes', async () => {
  let response;
  for (let i = 0; i < 11; i++) response = await run(contactMutation, { input: { name: 'A', email: 'bad', subject: 'A', message: 'short' } });
  expect(response.errors[0].extensions.code).toBe('TOO_MANY_REQUESTS');
});
