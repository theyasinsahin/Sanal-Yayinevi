import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChapterMusicEditor from './ChapterMusicEditor';
import { changeChapterMusic, readMusicDuration } from './api';

jest.mock('./api', () => ({
  validateMusicFile: jest.fn(), readMusicDuration: jest.fn(), changeChapterMusic: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test('requires rights confirmation and preserves the request chapter across selection changes', async () => {
  let finish;
  changeChapterMusic.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  readMusicDuration.mockResolvedValue(30);
  const onChange = jest.fn();
  const { rerender } = render(<ChapterMusicEditor key="a" chapterId="a" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('MP3 dosyası'), { target: { files: [new File(['music'], 'song.mp3')] } });
  expect(screen.getByRole('button', { name: 'Müziği yükle' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Müziği yükle' }));
  await waitFor(() => expect(changeChapterMusic).toHaveBeenCalledWith('a', expect.any(File), ''));
  rerender(<ChapterMusicEditor key="b" chapterId="b" onChange={onChange} />);
  const music = { url: 'https://example.com/song.mp3' };
  finish(music);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('a', music));
});

test('shows upload errors and keeps the selected file for retry', async () => {
  readMusicDuration.mockRejectedValue(new Error('MP3 süresi en fazla 10 dakika olmalıdır.'));
  render(<ChapterMusicEditor chapterId="a" onChange={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('MP3 dosyası'), { target: { files: [new File(['music'], 'song.mp3')] } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Müziği yükle' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('10 dakika');
  expect(changeChapterMusic).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Müziği yükle' })).toBeEnabled();
});

test('removes existing music without requiring a new rights confirmation', async () => {
  changeChapterMusic.mockResolvedValue(null);
  const onChange = jest.fn();
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const { unmount } = render(<ChapterMusicEditor chapterId="a" music={{ url: 'https://example.com/song.mp3' }} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Müziği kaldır' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('a', null));
  expect(changeChapterMusic).toHaveBeenCalledWith('a', null, '');
  expect(readMusicDuration).not.toHaveBeenCalled();
  unmount();
  jest.restoreAllMocks();
});

test('failed removal retains the preview and allows retry', async () => {
  changeChapterMusic.mockRejectedValue(new Error('Bağlantı kesildi.'));
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  const onChange = jest.fn();
  const { unmount } = render(<ChapterMusicEditor chapterId="a" music={{ url: 'https://example.com/song.mp3' }} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Müziği kaldır' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantı kesildi.');
  expect(screen.getByLabelText('Bölüm müziğini dinle')).toHaveAttribute('src', 'https://example.com/song.mp3');
  expect(screen.getByRole('button', { name: 'Müziği kaldır' })).toBeEnabled();
  expect(onChange).not.toHaveBeenCalled();
  unmount();
  jest.restoreAllMocks();
});

test('limits the title to the backend limit', () => {
  render(<ChapterMusicEditor chapterId="a" onChange={jest.fn()} />);
  expect(screen.getByLabelText('Müzik başlığı (isteğe bağlı)')).toHaveAttribute('maxlength', '160');
});

test('a completed upload for an unmounted editor leaves the next editor untouched', async () => {
  let finish;
  readMusicDuration.mockResolvedValue(30);
  changeChapterMusic.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const onChange = jest.fn();
  const { rerender } = render(<ChapterMusicEditor key="a" chapterId="a" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('MP3 dosyası'), { target: { files: [new File(['music'], 'old.mp3')] } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Müziği yükle' }));
  await waitFor(() => expect(changeChapterMusic).toHaveBeenCalled());
  rerender(<ChapterMusicEditor key="b" chapterId="b" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Müzik başlığı (isteğe bağlı)'), { target: { value: 'Yeni bölüm' } });
  finish({ url: 'https://example.com/old.mp3' });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('a', { url: 'https://example.com/old.mp3' }));
  expect(screen.getByLabelText('Müzik başlığı (isteğe bağlı)')).toHaveValue('Yeni bölüm');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('successful upload publishes the preview, resets consent, and supports removal', async () => {
  readMusicDuration.mockResolvedValue(45);
  const music = { url: 'https://example.com/new.mp3', title: 'Yeni müzik', duration: 45, publicId: 'music' };
  changeChapterMusic.mockResolvedValueOnce(music).mockResolvedValueOnce(null);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  function Editor() {
    const [currentMusic, setCurrentMusic] = React.useState(null);
    return <ChapterMusicEditor chapterId="chapter" music={currentMusic} onChange={(id, next) => setCurrentMusic(next)} />;
  }
  const { unmount } = render(<Editor />);
  const file = new File(['music'], 'new.mp3', { type: 'audio/mpeg' });
  fireEvent.change(screen.getByLabelText('MP3 dosyası'), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText('Müzik başlığı (isteğe bağlı)'), { target: { value: 'Yeni müzik' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Müziği yükle' }));
  expect(await screen.findByLabelText('Bölüm müziğini dinle')).toHaveAttribute('src', music.url);
  expect(changeChapterMusic).toHaveBeenNthCalledWith(1, 'chapter', file, 'Yeni müzik');
  expect(screen.getByLabelText('Müzik başlığı (isteğe bağlı)')).toHaveValue('');
  expect(screen.getByLabelText('Bu müziği paylaşmak için gerekli haklara ve izinlere sahibim.')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Müziği yükle' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Müziği kaldır' }));
  await waitFor(() => expect(screen.queryByLabelText('Bölüm müziğini dinle')).not.toBeInTheDocument());
  expect(changeChapterMusic).toHaveBeenNthCalledWith(2, 'chapter', null, '');
  unmount();
  jest.restoreAllMocks();
});
