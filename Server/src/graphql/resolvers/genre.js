import * as genreService from '../../services/genreService.js';
import { requireAdmin } from '../../utils/adminAccess.js';
import { getAdminRecord, saveAdminRecord } from '../../services/adminService.js';
import Genre from '../../models/genre.js';

async function save(context, id, changes) {
  const { iconUrl, ...supported } = changes;
  const previous = id ? await getAdminRecord(context, { resource: 'Genre', id }) : null;
  const result = await saveAdminRecord(context, { resource: 'Genre', id, revision: previous?.revision, changes: supported, reason: 'Tür yönetimi işlemi (uyumlu tür API).' });
  return Genre.findById(result.id).exec();
}
export default {
  Query: {
    getAllGenres: async (_, { includeInactive }, context) => {
      if (includeInactive) await requireAdmin(context);
      return genreService.getAllGenres(includeInactive);
    },
    getGenreBySlug: (_, { slug }) => genreService.getGenreBySlug(slug),
  },
  Mutation: {
    createGenre: (_, args, context) => save(context, null, args),
    updateGenre: (_, { id, ...updates }, context) => save(context, id, updates),
    deleteGenre: (_, { id }, context) => save(context, id, { isActive: false }),
  },
  Genre: { iconUrl: () => '' },
};
