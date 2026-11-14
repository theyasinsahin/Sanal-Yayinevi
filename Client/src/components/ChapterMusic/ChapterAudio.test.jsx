import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ChapterAudio from './ChapterAudio';

test('requires manual playback, supports looping, and stops and resets on unmount', () => {
  const pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const load = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const { unmount } = render(<ChapterAudio music={{ url: 'https://example.com/song.mp3', title: 'Song' }} />);
  const audio = screen.getByLabelText('Bölüm müziğini dinle');
  expect(audio).toHaveAttribute('preload', 'none');
  expect(audio.autoplay).toBe(false);
  fireEvent.click(screen.getByLabelText('Tekrarla'));
  expect(audio.loop).toBe(true);
  audio.currentTime = 20;
  unmount();
  expect(pause).toHaveBeenCalled();
  expect(audio.currentTime).toBe(0);
  expect(audio).not.toHaveAttribute('src');
  pause.mockRestore(); load.mockRestore();
});
