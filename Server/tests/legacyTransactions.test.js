import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import mongoose from 'mongoose';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Transaction from '../src/models/transaction.js';
import * as transactions from '../src/services/transactionService.js';

jest.setTimeout(30000);
let reader, other, admin, book;
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
beforeEach(async () => {
  [reader, other, admin] = await User.create(['reader', 'other', 'admin'].map(username => ({ username, fullName: username, email: `${username}@test.com`, password: 'hash', role: username === 'admin' ? 'ADMIN' : 'USER' })));
  book = await Book.create({ title: 'Legacy Book', authorId: reader.id, status: 'WRITING' });
  await Transaction.create([
    { userId: reader.id, bookId: book.id, amount: 10, status: 'SUCCESS', createdAt: new Date('2025-01-01') },
    { userId: reader.id, bookId: book.id, amount: 20, status: 'SUCCESS', createdAt: new Date('2025-01-02') },
    { userId: other.id, bookId: book.id, amount: 30, status: 'FAILED' },
    { userId: other.id, bookId: book.id, amount: 40, status: 'REFUNDED' },
    { userId: new mongoose.Types.ObjectId(), bookId: book.id, amount: 50, status: 'SUCCESS' },
  ]);
});
const run = (source, user) => graphql({ schema, source, variableValues: { id: book.id }, contextValue: { user, User, Book } });

test('legacy payment initialization stays disabled without creating or modifying transactions', async () => {
  await expect(transactions.createPaymentForm()).rejects.toThrow();
  const response = await run('mutation($id:ID!){initializePayment(bookId:$id,amount:20){token}}', reader);
  expect(response.errors).toBeDefined();
  expect(await Transaction.countDocuments()).toBe(5);
});
test('successful transaction queries exclude failed/refunded payments and return newest first', async () => {
  const records = await transactions.findSuccessfulTransactionsByBookId(book.id);
  expect(records.map(record => record.amount)).toEqual([50, 20, 10]);
  expect((await transactions.findTransactionsByUserId(reader.id)).map(record => record.amount)).toEqual([20, 10]);
});
test('backers are deduplicated and transactions belonging to missing users are omitted', async () => {
  expect((await transactions.findBackersByBookId(book.id)).map(user => user.id)).toEqual([reader.id]);
});
test('a reader can inspect only their own legacy payment history', async () => {
  const response = await run('{getMyTransactions{amount status user{id} book{id title}}}', reader);
  expect(response.errors).toBeUndefined();
  expect(response.data.getMyTransactions.map(item => item.amount)).toEqual([20, 10]);
  expect(response.data.getMyTransactions[0]).toMatchObject({ user: { id: reader.id }, book: { id: book.id, title: 'Legacy Book' } });
  expect((await run('{getMyTransactions{amount}}')).errors).toBeDefined();
});
test('public and ordinary users cannot inspect book/all transactions or backer identities', async () => {
  for (const user of [undefined, reader]) {
    expect((await run('query($id:ID!){getBookTransactions(bookId:$id){amount}}', user)).errors).toBeDefined();
    expect((await run('{getAllTransactions{amount}}', user)).errors).toBeDefined();
    expect((await run('query($id:ID!){getBookBackers(bookId:$id){id}}', user)).data.getBookBackers).toEqual([]);
  }
});
test('admin access is rechecked against the database rather than trusting a stale role in context', async () => {
  expect((await run('{getAllTransactions{amount}}', admin)).data.getAllTransactions).toHaveLength(5);
  await User.updateOne({ _id: admin.id }, { role: 'USER' });
  expect((await run('{getAllTransactions{amount}}', admin)).errors).toBeDefined();
});
