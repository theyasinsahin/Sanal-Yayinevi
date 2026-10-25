export const SCORE_UPDATED_EVENT = 'betik:score-updated';
export const notifyScoreChanged = () => window.dispatchEvent(new Event(SCORE_UPDATED_EVENT));
