import { pubsub } from '../config/pubsub.js';
export async function publishScoreUpdate(userId) {
  await pubsub.publish(`SCORE_UPDATED:${userId}`, { myScoreUpdated: true });
  await pubsub.publish('LEADERBOARD_UPDATED', { leaderboardUpdated: true });
}
