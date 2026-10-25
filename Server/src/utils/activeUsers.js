import User from '../models/user.js';

export const inactiveUserIds = () => User.distinct('_id', { $or: [{ isDeleted: true }, { isActive: false }] });
