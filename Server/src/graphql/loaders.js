import DataLoader from 'dataloader';
import User from '../models/user.js';
import Genre from '../models/genre.js';
import Comment from '../models/comment.js';
import { inactiveUserIds } from '../utils/activeUsers.js';

export function createLoaders() {
  let inactive;
  const inactiveIds = () => inactive ||= Promise.resolve(inactiveUserIds());
  const byId = Model => new DataLoader(async ids => {
    const records = await Model.find({ _id: { $in: ids }, ...(Model === User ? { isDeleted: false, isActive: { $ne: false } } : {}) }).exec();
    const map = new Map(records.map(record => [String(record._id), record]));
    return ids.map(id => map.get(String(id)) || null);
  }, { cacheKeyFn: String, maxBatchSize: 100 });
  return {
    users: byId(User), genres: byId(Genre), inactiveIds,
    commentCounts: new DataLoader(async ids => {
      const counts = await Comment.aggregate([
        { $match: { bookId: { $in: ids.map(id => new Comment.base.Types.ObjectId(String(id))) }, isDeleted: false, userId: { $nin: await inactiveIds() } } },
        { $group: { _id: '$bookId', count: { $sum: 1 } } },
      ]).exec();
      const map = new Map(counts.map(record => [String(record._id), record.count]));
      return ids.map(id => map.get(String(id)) || 0);
    }, { cacheKeyFn: String, maxBatchSize: 100 }),
  };
}
export const getLoaders = context => context.loaders ||= createLoaders();

export function selectedFields(info) {
  const fields = new Set(), visited = new Set();
  const collect = selectionSet => selectionSet?.selections.forEach(selection => {
    if (selection.kind === 'Field') fields.add(selection.name.value);
    if (selection.kind === 'InlineFragment') collect(selection.selectionSet);
    if (selection.kind === 'FragmentSpread' && !visited.has(selection.name.value)) {
      visited.add(selection.name.value); collect(info.fragments[selection.name.value]?.selectionSet);
    }
  });
  info.fieldNodes.forEach(node => collect(node.selectionSet));
  return fields;
}
