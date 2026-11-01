import { GraphQLError } from 'graphql';
import User from '../models/user.js';

export async function requireAdmin(context, session = null) {
  const id = context.user?._id || context.user?.id;
  const actor = id && await User.findOne({ _id: id, role: 'ADMIN', isActive: { $ne: false }, isDeleted: false }).session(session).exec();
  if (!actor) throw new GraphQLError('Bu işlem için aktif yönetici yetkisi gerekiyor.', { extensions: { code: 'FORBIDDEN' } });
  return actor;
}
