import User from "./User.js";
import Book from "./Book.js";
import Chapter from "./Chapter.js";
export default {
    ...User,
    ...Book,
    ...Chapter,
};