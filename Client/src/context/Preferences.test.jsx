import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { ReadingPreferencesProvider, useReadingPreferences } from './ReadingPreferencesContext';
import { FiltersProvider, useFilters } from './FiltersContext';
import { ToastProvider, useToast } from './ToastContext';
jest.mock('@mui/icons-material', () => require('../../test-support/icons.cjs'));

beforeEach(() => localStorage.clear());
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); document.documentElement.style.removeProperty('--reading-font-size'); });
test.each([['lg', 'lg', '20px'], ['invalid', 'md', '18px']])('reading preferences restore a saved size %s or fall back to the default', (saved, expected, pixels) => {
  localStorage.setItem('app_font_size', saved);
  const { result } = renderHook(useReadingPreferences, { wrapper: ReadingPreferencesProvider });
  expect(result.current.fontSize).toBe(expected);
  expect(document.documentElement.style.getPropertyValue('--reading-font-size')).toBe(pixels);
  expect(document.documentElement.lang).toBe('tr');
});
test('valid font size changes persist and unsupported values leave the reader unchanged', () => {
  const { result } = renderHook(useReadingPreferences, { wrapper: ReadingPreferencesProvider });
  act(() => result.current.saveFontSize('sm'));
  expect(result.current.fontSize).toBe('sm');
  expect(localStorage.getItem('app_font_size')).toBe('sm');
  act(() => result.current.saveFontSize('huge'));
  expect(result.current.fontSize).toBe('sm');
});
test('unavailable browser storage still allows the reader to initialize', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
  const { result } = renderHook(useReadingPreferences, { wrapper: ReadingPreferencesProvider });
  expect(result.current.fontSize).toBe('md');
});
test('catalog filter updates keep previous search and classification selections', () => {
  const { result } = renderHook(useFilters, { wrapper: FiltersProvider });
  act(() => { result.current.updateFilters('search', 'forest'); result.current.updateFilters('classification', { genres: ['gizem'] }); });
  act(() => result.current.updateFilters('sortBy', 'popular'));
  expect(result.current.filters).toEqual({ search: 'forest', classification: { genres: ['gizem'] }, sortBy: 'popular' });
});
test('notifications coexist and each disappears on its own timer', () => {
  jest.useFakeTimers();
  function Trigger() {
    const { showToast } = useToast();
    return <button onClick={() => { showToast('First', 'success', 1000); showToast('Second', 'info', 2000); }}>Notify</button>;
  }
  render(<ToastProvider><Trigger /></ToastProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
  expect(screen.getByText('First')).toBeInTheDocument();
  expect(screen.getByText('Second')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1100));
  expect(screen.queryByText('First')).not.toBeInTheDocument();
  expect(screen.getByText('Second')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.queryByText('Second')).not.toBeInTheDocument();
});
