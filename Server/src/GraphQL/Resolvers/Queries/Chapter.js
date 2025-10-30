export default {
    getChaptersByBookId: async (_, { bookId }, { Chapter }) => {
        try {
            const chapters = await Chapter.find({ bookId }).populate('authorId', 'username');
            return chapters;
        } catch (error) {
            throw new Error("Error fetching chapters: " + error.message);
        }
    },

    getChapterById: async (_, { id }, { Chapter }) => {
        try {
            const chapter = await Chapter.findById(id).populate('authorId', 'username');
            if (!chapter) {
                throw new Error("Chapter not found");
            }
            return chapter;
        } catch (error) {
            throw new Error("Error fetching chapter: " + error.message);
        }
    },

    getAllChapters: async (_, __, { Chapter }) => {
        try {
            const chapters = await Chapter.find().populate('authorId', 'username');
            return chapters;
        } catch (error) {
            throw new Error("Error fetching all chapters: " + error.message);
        }
    },

    getChaptersByAuthorId: async (_, { authorId }, { Chapter }) => {
        try {
            const chapters = await Chapter.find({ authorId }).populate('authorId', 'username');
            return chapters;
        } catch (error) {
            throw new Error("Error fetching chapters by author: " + error.message);
        }
    }
}