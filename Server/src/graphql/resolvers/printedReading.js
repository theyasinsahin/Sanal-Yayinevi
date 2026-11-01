import * as readings from '../../services/printedReadingService.js';
import Book from '../../models/book.js';

export default {
  Query: {
    myPrintedBookReading: (_, { bookId }, context) => readings.myPrintedReading(context, bookId),
    getPrintedReadings: (_, args, context) => readings.getPrintedReadings(context, args),
  },
  Mutation: {
    savePrintedBookReading: (_, args, context) => readings.savePrintedReading(context, args),
    removePrintedBookReading: (_, { bookId }, context) => readings.removePrintedReading(context, bookId),
  },
  PrintedBookReading: {
    id: record => String(record._id || record.id),
    userId: record => String(record.userId),
    book: record => record.book ? { ...record.book, id: String(record.book._id) } : Book.findById(record.bookId).exec(),
  },
};
