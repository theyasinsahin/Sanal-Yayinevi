import * as Printed from '../../services/printedBookService.js';
import Book from '../../models/book.js';
import User from '../../models/user.js';
import BookClaim from '../../models/bookClaim.js';
import { canEditBookContent } from '../../utils/printedBooks.js';

const canReview = (book, user) => user && (user.role === 'ADMIN' || String(book.submittedBy) === String(user._id || user.id));
export default {
  Query: {
    getPrintedBooks: (_, args) => Printed.getPrintedBooks(args),
    lookupPrintedBook: (_, { isbn }, { user }) => Printed.lookupPrintedBook(isbn, user),
    getMyPrintedSubmissions: (_, args, { user }) => Printed.getMySubmissions(user),
    getPrintedBookReviews: (_, args, { user }) => Printed.getBookReviews(user),
    getBookClaimReviews: (_, args, { user }) => Printed.getClaimReviews(user),
  },
  Mutation: {
    submitPrintedBook: (_, { input }, { user }) => Printed.submitPrintedBook(input, user),
    reviewPrintedBook: (_, args, { user }) => Printed.reviewPrintedBook(args, user),
    requestBookClaim: (_, args, { user }) => Printed.requestBookClaim(args, user),
    reviewBookClaim: (_, args, { user }) => Printed.reviewBookClaim(args, user),
  },
  Book: {
    kind: book => book.kind || 'DIGITAL',
    canEditContent: (book, args, { user }) => canEditBookContent(book, user),
    publicationEvidenceUrl: (book, args, { user }) => canReview(book, user) ? book.publicationEvidenceUrl : null,
    reviewNote: (book, args, { user }) => canReview(book, user) ? book.reviewNote : null,
    // Apollo instrumentation can observe a result more than once. Return the
    // Promise from exec(), since observing a Mongoose Query reruns that query.
    submittedBy: (book, args, { user }) => book.kind === 'PRINTED' && book.submittedBy && canReview(book, user) ? User.findById(book.submittedBy).exec() : null,
    myClaim: (book, args, { user }) => book.kind === 'PRINTED' && user ? BookClaim.findOne({ bookId: book._id || book.id, claimantId: user._id || user.id }).sort({ createdAt: -1, _id: -1 }).exec() : null,
  },
  BookClaim: {
    book: claim => Book.findById(claim.bookId).exec(),
    claimant: claim => User.findById(claim.claimantId).exec(),
  },
};
