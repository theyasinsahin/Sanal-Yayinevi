import userResolvers from "./user.js";
import bookResolvers from "./book.js";
import chapterResolvers from "./chapter.js";
import transactionResolvers from "./transaction.js";
import commentResolvers from "./comment.js";

// Tüm resolver modüllerini bir dizi içine koyup gönderiyoruz.
// schema.js içindeki mergeResolvers bunları otomatik birleştirecek.
export default [
    userResolvers,
    bookResolvers,
    chapterResolvers,
    transactionResolvers,
    commentResolvers
];