import { publisherCatalog } from '../../services/publisherService.js';

export default {
  Query: { publisherCatalog: (_, args, context) => publisherCatalog(context, args) },
};
