import User from '../models/user.js';
import Notification from '../models/notification.js';

export async function notifyUser(userId, preference, notification, actorId) {
  if (!userId || String(userId) === String(actorId)) return null;
  const user = await User.findOne({ _id: userId, isDeleted: false, isActive: { $ne: false } });
  if (!user || user.notificationSettings?.[preference] === false) return null;
  return Notification.create({ userId, ...notification });
}
