import { act, render } from '@testing-library/react';
import { useSubscription } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import ScoreUpdates from './ScoreUpdates';
import { SCORE_UPDATED_EVENT } from '../../utils/scoreUpdates';
jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useSubscription: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));

test('a personal score subscription refreshes observers and reconnects after account changes', () => {
  useAuth.mockReturnValue({ user: { id: 'reader' } });
  const updated = jest.fn(), reconnect = jest.fn();
  window.addEventListener(SCORE_UPDATED_EVENT, updated);
  const view = render(<ScoreUpdates reconnect={reconnect} />);
  act(() => useSubscription.mock.calls.at(-1)[1].onData());
  expect(updated).toHaveBeenCalledTimes(1);
  useAuth.mockReturnValue({ user: { id: 'other' } });
  view.rerender(<ScoreUpdates reconnect={reconnect} />);
  expect(reconnect).toHaveBeenCalledTimes(1);
  view.unmount(); window.removeEventListener(SCORE_UPDATED_EVENT, updated);
});

test('anonymous visitors do not subscribe to private score updates', () => {
  useAuth.mockReturnValue({ user: null });
  const view = render(<ScoreUpdates />);
  expect(useSubscription.mock.calls.at(-1)[1].skip).toBe(true);
  view.unmount();
});
