import mongoose from 'mongoose';
import Book from '../models/book.js';
import BookClaim from '../models/bookClaim.js';
import User from '../models/user.js';
import Notification from '../models/notification.js';
import { normalizeIsbn } from '../utils/printedBooks.js';
import AdminAudit from '../models/adminAudit.js';
import { requireAdmin as requireCurrentAdmin } from '../utils/adminAccess.js';

export function requireUser(user) {
  if (!user || user.isDeleted || user.isActive === false) throw new Error('Giriş yapmalısınız.');
  return user._id || user.id;
}
export function requireAdmin(user) {
  requireUser(user);
  if (user.role !== 'ADMIN') throw new Error('Bu işlem için yönetici yetkisi gerekir.');
}
const text = (value, name, min, max) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new Error(`${name} ${min}–${max} karakter olmalıdır.`);
  return value.trim();
};
const webUrl = (value, required = false) => {
  if (!value && !required) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || value.length > 1500) throw new Error();
    return url.href;
  } catch { throw new Error('Bağlantılar geçerli bir https:// adresi olmalıdır.'); }
};
const reviewNote = (approve, note) => approve ? (note ? text(note, 'İnceleme notu', 1, 1000) : '') : text(note, 'Ret gerekçesi', 5, 1000);
const notice = (userId, title, message, bookId, session) => Notification.create([{ userId, type: 'BOOK_REVIEW', title, message, icon: '📚', meta: { bookId } }], { session });
async function notifyAdmins(bookId, title, session) {
  const admins = await User.find({ role: 'ADMIN', isDeleted: false, isActive: { $ne: false } }).session(session).select('_id');
  for (const admin of admins) await notice(admin._id, title, 'Basılı kitap yönetiminde yeni bir başvuru var.', bookId, session);
}

export async function submitPrintedBook(input, user) {
  const userId = requireUser(user);
  const isbn = input.isbn?.trim() ? normalizeIsbn(input.isbn) : undefined;
  if (!Number.isInteger(input.publicationYear) || input.publicationYear < 1400 || input.publicationYear > new Date().getFullYear()) throw new Error('Geçerli bir basım yılı girin.');
  if (!Number.isInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > 50000) throw new Error('Sayfa sayısı 1–50000 arasında olmalıdır.');
  const data = {
    kind: 'PRINTED', publicationStatus: 'PENDING', status: 'DRAFT', submittedBy: userId,
    ...(isbn ? { isbn } : {}), title: text(input.title, 'Kitap adı', 1, 200),
    printedAuthor: text(input.printedAuthor, 'Yazar adı', 2, 300), publisher: text(input.publisher, 'Yayınevi', 2, 200),
    description: text(input.description, 'Tanıtım', 20, 5000), publicationYear: input.publicationYear, pageCount: input.pageCount,
    imageUrl: webUrl(input.imageUrl), purchaseUrl: webUrl(input.purchaseUrl), publicationEvidenceUrl: webUrl(input.publicationEvidenceUrl, true),
  };
  await Book.init();
  try {
    return await mongoose.connection.transaction(async session => {
      let book = isbn ? await Book.findOne({ isbn, kind: 'PRINTED', publicationStatus: 'REJECTED', submittedBy: userId, isDeleted: false }).session(session) : null;
      if (book) {
        Object.assign(book, data, { reviewNote: '', reviewedBy: undefined, reviewedAt: undefined });
        await book.save({ session });
      } else {
        [book] = await Book.create([data], { session });
      }
      await notifyAdmins(book._id, 'Basılı kitap başvurusu', session);
      return book;
    });
  } catch (error) {
    if (error.code === 11000) throw new Error('Bu ISBN ile bir kitap zaten kayıtlı. Mevcut kitap için hak talebinde bulunabilirsiniz.');
    throw error;
  }
}

export async function getPrintedBooks({ page = 1, search = '' }) {
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('Geçersiz sayfa.');
  const searchText = text(search, 'Arama', 0, 150);
  const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter = { kind: 'PRINTED', publicationStatus: 'APPROVED', isDeleted: false };
  if (searchText) filter.$or = ['title', 'printedAuthor', 'isbn', 'publisher'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } }));
  if (searchText) {
    try { filter.$or.push({ isbn: normalizeIsbn(searchText) }); } catch { /* A title or author search is not an ISBN. */ }
  }
  const [books, total] = await Promise.all([Book.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 12).limit(12), Book.countDocuments(filter)]);
  return { books, total, page, totalPages: Math.max(1, Math.ceil(total / 12)) };
}

export async function lookupPrintedBook(isbnValue, user) {
  requireUser(user);
  const isbn = normalizeIsbn(isbnValue);
  try {
    const options = () => ({ signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'Betik/1.0 (ISBN catalog lookup)' } });
    const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, options());
    if (!response.ok) throw new Error();
    const match = await response.json();
    if (!match.title) return { isbn, found: false };
    const authors = await Promise.all((match.authors || []).slice(0, 3).map(async author => {
      if (!/^\/authors\/OL\d+A$/.test(author.key)) return '';
      try { const result = await fetch(`https://openlibrary.org${author.key}.json`, options()); return result.ok ? (await result.json()).name || '' : ''; } catch { return ''; }
    }));
    const year = String(match.publish_date || '').match(/\b(?:1[4-9]\d{2}|20\d{2})\b/);
    const cover = match.covers?.find(id => Number.isInteger(id) && id > 0);
    return { isbn, found: true, title: String(match.title).slice(0, 200), printedAuthor: authors.filter(Boolean).join(', ').slice(0, 300), publisher: String(match.publishers?.[0] || '').slice(0, 200), publicationYear: year ? Number(year[0]) : null, pageCount: Number.isInteger(match.number_of_pages) ? match.number_of_pages : null, imageUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg` : '' };
  } catch { return { isbn, found: false }; }
}

export async function reviewPrintedBook({ bookId, approve, note }, user) {
  requireAdmin(user);
  const review = reviewNote(approve, note);
  await AdminAudit.init();
  return mongoose.connection.transaction(async session => {
    const actor = await requireCurrentAdmin({ user }, session);
    const book = await Book.findOneAndUpdate({ _id: bookId, kind: 'PRINTED', publicationStatus: 'PENDING', isDeleted: false }, { publicationStatus: approve ? 'APPROVED' : 'REJECTED', status: approve ? 'PUBLISHED' : 'DRAFT', reviewNote: review, reviewedBy: requireUser(user), reviewedAt: new Date() }, { new: true, session });
    if (!book) throw new Error('Bekleyen kitap başvurusu bulunamadı veya zaten incelendi.');
    await notice(book.submittedBy, approve ? 'Kitabın kataloğa eklendi' : 'Kitap başvurusu sonuçlandı', `${book.title}: ${approve ? 'Yayımlandı.' : review}`, book._id, session);
    await AdminAudit.create([{ actorId: actor._id, resource: 'Book', recordId: book.id, action: approve ? 'APPROVE' : 'REJECT', reason: (review || 'Basılı kitap başvurusu onaylandı.').slice(0, 500), fields: ['publicationStatus', 'status', 'reviewNote', 'reviewedBy', 'reviewedAt'] }], { session });
    return book;
  });
}

export async function requestBookClaim({ bookId, evidence, evidenceUrl }, user) {
  const claimantId = requireUser(user);
  const details = text(evidence, 'Hak talebi açıklaması', 20, 3000);
  const url = webUrl(evidenceUrl);
  await BookClaim.init();
  try {
    return await mongoose.connection.transaction(async session => {
      const book = await Book.findOneAndUpdate({ _id: bookId, kind: 'PRINTED', publicationStatus: 'APPROVED', isDeleted: false, authorId: null }, { $inc: { claimVersion: 1 } }, { new: true, session });
      if (!book) throw new Error('Kitap henüz yayımlanmamış veya yazar yetkisi zaten onaylanmış.');
      const [claim] = await BookClaim.create([{ bookId, claimantId, evidence: details, evidenceUrl: url }], { session });
      await notifyAdmins(bookId, 'Yazar hak talebi', session);
      return claim;
    });
  } catch (error) {
    if (error.code === 11000) throw new Error('Bu kitap için zaten bekleyen bir hak talebiniz var.');
    throw error;
  }
}

export async function reviewBookClaim({ claimId, approve, note }, user) {
  requireAdmin(user);
  const review = reviewNote(approve, note);
  await AdminAudit.init();
  return mongoose.connection.transaction(async session => {
    const actor = await requireCurrentAdmin({ user }, session);
    const claim = await BookClaim.findOne({ _id: claimId, status: 'PENDING' }).session(session);
    if (!claim) throw new Error('Bekleyen hak talebi bulunamadı veya zaten incelendi.');
    if (approve) {
      const claimant = await User.findOne({ _id: claim.claimantId, isDeleted: false, isActive: { $ne: false } }).session(session);
      if (!claimant) throw new Error('Talep sahibi aktif değil.');
      const book = await Book.findOneAndUpdate({ _id: claim.bookId, kind: 'PRINTED', publicationStatus: 'APPROVED', isDeleted: false, authorId: null }, { authorId: claim.claimantId }, { new: true, session });
      if (!book) throw new Error('Kitabın yazar yetkisi zaten verilmiş veya kitap yayında değil.');
      await User.updateOne({ _id: claim.claimantId }, { $addToSet: { usersBooks: book._id } }, { session });
      await AdminAudit.create([{ actorId: actor._id, resource: 'Book', recordId: book.id, action: 'ASSIGN_AUTHOR', reason: (review || 'Yazar hak talebi onaylandı.').slice(0, 500), fields: ['authorId'] }], { session });
      await BookClaim.updateMany({ bookId: book._id, status: 'PENDING', _id: { $ne: claim._id } }, { status: 'REJECTED', reviewNote: 'Başka bir hak talebi onaylandı.', reviewedBy: requireUser(user), reviewedAt: new Date() }, { session });
    }
    Object.assign(claim, { status: approve ? 'APPROVED' : 'REJECTED', reviewNote: review, reviewedBy: requireUser(user), reviewedAt: new Date() });
    await claim.save({ session });
    await notice(claim.claimantId, 'Yazar hak talebi sonuçlandı', approve ? 'Yazar yetkin onaylandı. Artık kitabına bölüm ekleyebilirsin.' : review, claim.bookId, session);
    await AdminAudit.create([{ actorId: actor._id, resource: 'BookClaim', recordId: claim.id, action: approve ? 'APPROVE' : 'REJECT', reason: (review || 'Yazar hak talebi onaylandı.').slice(0, 500), fields: ['status', 'reviewNote', 'reviewedBy', 'reviewedAt'] }], { session });
    return claim;
  });
}

export async function getMySubmissions(user) {
  return Book.find({ kind: 'PRINTED', submittedBy: requireUser(user), isDeleted: false }).sort({ createdAt: -1 }).limit(100);
}
export async function getBookReviews(user) {
  await requireCurrentAdmin({ user });
  return Book.find({ kind: 'PRINTED', publicationStatus: 'PENDING', isDeleted: false }).sort({ createdAt: 1 }).limit(100);
}
export async function getClaimReviews(user) {
  await requireCurrentAdmin({ user });
  return BookClaim.find({ status: 'PENDING' }).sort({ createdAt: 1 }).limit(100);
}
