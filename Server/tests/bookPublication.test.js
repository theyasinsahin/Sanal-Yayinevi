import { jest } from '@jest/globals';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import { updateDigitalStatus } from '../src/services/print/applicationService.js';

jest.setTimeout(30000);
let user, book;
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
beforeEach(async () => {
  user = await User.create({ username: 'author', fullName: 'Author', email: 'author@example.test', password: 'hash' });
  book = await Book.create({ title: 'Taslak', authorId: user._id, status: 'DRAFT' });
});
const changeStatus = status => updateDigitalStatus({ user }, { bookId: book.id, status });

test.each(['WRITING', 'PUBLISHED', 'COMPLETED'])('a book with no chapters cannot enter %s', async status => {
  await expect(changeStatus(status)).rejects.toThrow('en az bir bölüme metin');
  expect((await Book.findById(book.id)).status).toBe('DRAFT');
});

test.each(['', ' \n\t', '<p><br></p>', '<p>&nbsp;&#160;&#xA0;&#8203;&ZeroWidthSpace;</p>', '<script>hidden text</script>'])('empty markup cannot make a book visible: %s', async content => {
  await Chapter.create({ bookId: book.id, authorId: user.id, title: 'Bölüm', content });
  await expect(changeStatus('WRITING')).rejects.toThrow('en az bir bölüme metin');
  expect((await Book.findById(book.id)).status).toBe('DRAFT');
});

test('deleted chapter content cannot publish a book, while a saved chapter permits the full lifecycle', async () => {
  const chapter = await Chapter.create({ bookId: book.id, authorId: user.id, title: 'Bölüm', content: '<p>Bir hikâye.</p>', isDeleted: true });
  await expect(changeStatus('PUBLISHED')).rejects.toThrow('en az bir bölüme metin');
  await Chapter.updateOne({ _id: chapter.id }, { isDeleted: false });
  expect((await changeStatus('WRITING')).digitalStatus).toBe('PUBLISHED');
  expect((await changeStatus('COMPLETED')).writingStatus).toBe('COMPLETED');
  expect((await changeStatus('DRAFT')).digitalStatus).toBe('DRAFT');
  expect((await changeStatus('PUBLISHED')).digitalStatus).toBe('PUBLISHED');
});
