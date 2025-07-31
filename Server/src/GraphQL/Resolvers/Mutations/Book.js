import { authenticateUser } from "../../../utils/auth.js";
export default {
    createBook: async (_, { title, genre, description }, { Book, User, req }) => {
        const user = await authenticateUser(req, User);
        try {
            const newBook = new Book({
                title,
                genre,
                description,
                authorId: user._id,
            });
            return await newBook.save();
        } catch (error) {
            console.error("Error creating book:", error);
            throw new Error("Failed to create book");
        }
    },
}