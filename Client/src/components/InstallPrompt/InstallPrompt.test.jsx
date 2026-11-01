import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InstallPrompt from './index';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

const key = 'betik_install_prompt_dismissed_at';
const originalMatchMedia = window.matchMedia;
afterAll(() => { window.matchMedia = originalMatchMedia; });
const installEvent = outcome => {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = jest.fn();
  event.userChoice = Promise.resolve({ outcome });
  return event;
};
beforeEach(() => {
  localStorage.clear();
  window.matchMedia = jest.fn(() => ({ matches: false }));
  jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chrome Android');
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('Android install banner waits for a browser install opportunity and prompts only on user action', async () => {
  render(<InstallPrompt />);
  expect(screen.queryByRole('button', { name: /Kur/ })).not.toBeInTheDocument();
  const event = installEvent('accepted');
  act(() => { window.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true);
  expect(event.prompt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Kur/ }));
  await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole('button', { name: /Kur/ })).not.toBeInTheDocument());
});
test('installed apps never show an installation banner', () => {
  window.matchMedia.mockReturnValue({ matches: true });
  render(<InstallPrompt />);
  act(() => window.dispatchEvent(installEvent('accepted')));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('a recent dismissal suppresses the banner for seven days', () => {
  localStorage.setItem(key, String(Date.now() - 86400000));
  render(<InstallPrompt />);
  act(() => window.dispatchEvent(installEvent('accepted')));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('an expired dismissal allows a new prompt and appinstalled closes it', () => {
  localStorage.setItem(key, String(Date.now() - 8 * 86400000));
  render(<InstallPrompt />);
  act(() => window.dispatchEvent(installEvent('dismissed')));
  expect(screen.getByRole('button', { name: /Kur/ })).toBeInTheDocument();
  act(() => window.dispatchEvent(new Event('appinstalled')));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('iOS instructions are offered after a delay and timers are cancelled on unmount', () => {
  jest.useFakeTimers();
  jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
  const { unmount } = render(<InstallPrompt />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(2500));
  fireEvent.click(screen.getByRole('button', { name: 'Nasıl Eklenir?' }));
  expect(screen.getByText(/Ana Ekrana Ekle/)).toBeInTheDocument();
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
