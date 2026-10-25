import WritingActivity from '../models/writingActivity.js';

// Weeks start on Monday at 00:00 in Turkey (UTC+3).
export function writingWeekStart(now = new Date()) {
  const local = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const day = (local.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day) - 3 * 60 * 60 * 1000);
}

export function countWords(html = '') {
  const text = (html || '').replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|#160);/g, ' ').replace(/&[^;]+;/g, ' ');
  return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export async function recordWriting(userId, chapterId, before, after) {
  const words = Math.max(0, countWords(after) - countWords(before));
  if (!words) return;
  await WritingActivity.updateOne(
    { userId, chapterId, weekStart: writingWeekStart() },
    { $inc: { words } }, { upsert: true },
  );
}

export async function weeklyWords(userId) {
  const entries = await WritingActivity.find({ userId, weekStart: writingWeekStart() });
  return entries.reduce((sum, entry) => sum + entry.words, 0);
}
