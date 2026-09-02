import userResolvers from "./user.js";
import bookResolvers from "./book.js";
import chapterResolvers from "./chapter.js";
import transactionResolvers from "./transaction.js";
import commentResolvers from "./comment.js";
import genreResolvers from "./genre.js";
import quoteResolvers from "./quote.js";
import scoreResolvers from "./score.js";
import recommendationResolvers from "./recommendation.js";
import messageResolvers from "./message.js";
import sessionResolvers from "./session.js";
import commonResolvers from "./common.js";
import paragraphCommentResolvers from "./paragraphComment.js";
import bookmarkResolvers from "./bookmark.js";
import bookFollowResolvers from "./bookFollow.js";


// Tüm resolver modüllerini bir dizi içine koyup gönderiyoruz.
// schema.js içindeki mergeResolvers bunları otomatik birleştirecek.
export default [
    userResolvers,
    bookResolvers,
    chapterResolvers,
    transactionResolvers,
    commentResolvers,
    genreResolvers,
    quoteResolvers,
    scoreResolvers,
    recommendationResolvers,
    messageResolvers,
    sessionResolvers,
    commonResolvers,
    paragraphCommentResolvers,
    bookmarkResolvers,
    bookFollowResolvers
];