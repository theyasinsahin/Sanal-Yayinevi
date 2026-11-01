import { gql, useSubscription } from '@apollo/client';
import { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notifyScoreChanged } from '../../utils/scoreUpdates';
const MY_SCORE_UPDATED = gql`subscription MyScoreUpdated { myScoreUpdated }`;
export const LEADERBOARD_UPDATED = gql`subscription LeaderboardUpdated { leaderboardUpdated }`;
export default function ScoreUpdates({ reconnect }) {
  const { user } = useAuth();
  const previous = useRef(user?.id);
  useEffect(() => {
    if (previous.current !== user?.id) reconnect?.();
    previous.current = user?.id;
  }, [user?.id, reconnect]);
  useSubscription(MY_SCORE_UPDATED, { skip: !user, onData: notifyScoreChanged });
  return null;
}
