import { changeChapterMusic, readMusicDuration, validateMusicFile } from './api';
import { API_URL } from '../../config/api';

beforeEach(() => { localStorage.setItem('token', 'app-token'); global.fetch = jest.fn(); });
afterEach(() => { localStorage.clear(); jest.restoreAllMocks(); delete global.fetch; });

test('accepts only nonempty MP3 files within 15 MiB', () => {
  expect(() => validateMusicFile({ name: 'song.mp3', type: 'audio/mpeg', size: 15 * 1024 * 1024 })).not.toThrow();
  for (const file of [
    { name: 'song.wav', type: 'audio/wav', size: 10 },
    { name: 'song.mp3', type: 'audio/mpeg', size: 0 },
    { name: 'song.mp3', type: 'audio/mpeg', size: 15 * 1024 * 1024 + 1 },
  ]) expect(() => validateMusicFile(file)).toThrow();
});

test('uploads binary MP3 with app authentication and encoded title', async () => {
  const file = new File(['mp3'], 'song.mp3', { type: 'audio/mpeg' });
  const music = { url: 'https://example.com/song.mp3' };
  fetch.mockResolvedValue({ ok: true, json: async () => ({ music }) });
  await expect(changeChapterMusic('chapter/1', file, 'Şarkı')).resolves.toEqual(music);
  expect(fetch).toHaveBeenCalledWith(`${API_URL}/api/chapters/chapter%2F1/music`, {
    method: 'POST', body: file, signal: expect.any(AbortSignal), headers: { Authorization: 'Bearer app-token', 'Content-Type': 'audio/mpeg',
      'x-music-rights': 'confirmed', 'x-music-title': encodeURIComponent('Şarkı') },
  });
});

test('deletes music and reports failed requests', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ music: null }) }).mockResolvedValueOnce({ ok: false });
  await expect(changeChapterMusic('chapter', null, '')).resolves.toBeNull();
  expect(fetch).toHaveBeenCalledWith(`${API_URL}/api/chapters/chapter/music`, {
    method: 'DELETE', signal: expect.any(AbortSignal), headers: { Authorization: 'Bearer app-token' },
  });
  await expect(changeChapterMusic('chapter', null, '')).rejects.toThrow();
});


test('missing authentication prevents a network request', async () => {
  localStorage.clear();
  await expect(changeChapterMusic('chapter', null, '')).rejects.toThrow('giriş');
  expect(fetch).not.toHaveBeenCalled();
});

describe('MP3 metadata validation', () => {
  let audio;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  beforeEach(() => {
    jest.useFakeTimers();
    audio = document.createElement('audio');
    jest.spyOn(audio, 'load').mockImplementation(() => {});
    const createElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation(tag => tag === 'audio' ? audio : createElement(tag));
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:music-preview');
    URL.revokeObjectURL = jest.fn();
  });
  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    jest.useRealTimers();
  });

  test('accepts the exact 600 second duration limit', async () => {
    const result = readMusicDuration(new File(['music'], 'song.mp3'));
    Object.defineProperty(audio, 'duration', { configurable: true, value: 600 });
    audio.onloadedmetadata();
    await expect(result).resolves.toBe(600);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:music-preview');
    expect(audio).not.toHaveAttribute('src');
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each([600.1, Infinity, NaN, 0])('validates duration %s and releases the temporary source', async duration => {
    const result = readMusicDuration(new File(['music'], 'song.mp3'));
    Object.defineProperty(audio, 'duration', { configurable: true, value: duration });
    audio.onloadedmetadata();
    await expect(result).rejects.toThrow('10 dakika');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:music-preview');
    expect(audio).not.toHaveAttribute('src');
    expect(audio.onloadedmetadata).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(['decode error', 'timeout'])('rejects %s and releases the temporary source', async failure => {
    const result = readMusicDuration(new File(['music'], 'song.mp3'));
    if (failure === 'timeout') jest.advanceTimersByTime(15000);
    else audio.onerror();
    await expect(result).rejects.toThrow('okunamadı');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:music-preview');
    expect(audio).not.toHaveAttribute('src');
  });
});


test.each([
  [503, 'Chapter music is disabled.'],
  [503, 'Music storage is not configured.'],
  [413, 'MP3 exceeds the upload limit.'],
  [409, 'Chapter music is already being updated.'],
])('surfaces server JSON message for status %s', async (status, message) => {
  fetch.mockResolvedValue({ ok: false, status, json: async () => ({ message }) });
  await expect(changeChapterMusic('chapter', null, '')).rejects.toThrow(message);
});

test('non-JSON errors use the fallback message', async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => { throw new Error('HTML response'); } });
  await expect(changeChapterMusic('chapter', null, '')).rejects.toThrow('Müzik kaydedilemedi');
});

test('times out a hanging request with AbortController and clears its timer', async () => {
  jest.useFakeTimers();
  try {
    let signal;
    fetch.mockImplementation((url, options) => new Promise((resolve, reject) => {
      signal = options.signal;
      signal.addEventListener('abort', () => {
        const error = new Error('Aborted'); error.name = 'AbortError'; reject(error);
      });
    }));
    const result = changeChapterMusic('chapter', null, '');
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(120000);
    await expect(result).rejects.toThrow('zaman aşımına');
    expect(signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
