import { API_URL } from '../../config/api';
import { sessionToken } from '../../utils/authSession';

export function validateMusicFile(file) {
  if (!file || !/\.mp3$/i.test(file.name) || (file.type && !['audio/mpeg', 'audio/mp3'].includes(file.type))) {
    throw new Error('Lütfen tek bir MP3 dosyası seçin.');
  }
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error('MP3 dosyası en fazla 15 MiB olabilir.');
}

export function readMusicDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    let timer;
    const finish = error => {
      clearTimeout(timer);
      const duration = audio.duration;
      audio.onloadedmetadata = null; audio.onerror = null;
      audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(duration);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > 600
      ? new Error('MP3 süresi en fazla 10 dakika olmalıdır.') : null);
    audio.onerror = () => finish(new Error('MP3 dosyası okunamadı.'));
    timer = setTimeout(() => finish(new Error('MP3 süresi okunamadı.')), 15000);
    audio.src = url;
  });
}

export async function changeChapterMusic(chapterId, file, title) {
  const token = sessionToken();
  if (!token) throw new Error('Müzik düzenlemek için giriş yapmalısınız.');
  const headers = { Authorization: `Bearer ${token}` };
  if (file) {
    headers['Content-Type'] = 'audio/mpeg';
    headers['x-music-rights'] = 'confirmed';
    if (title.trim()) headers['x-music-title'] = encodeURIComponent(title.trim());
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${API_URL}/api/chapters/${encodeURIComponent(chapterId)}/music`, {
      method: file ? 'POST' : 'DELETE', headers, signal: controller.signal, ...(file ? { body: file } : {}),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      throw new Error(typeof details?.message === 'string' ? details.message
        : typeof details?.error === 'string' ? details.error : 'Müzik kaydedilemedi. Lütfen tekrar deneyin.');
    }
    const result = await response.json();
    return result.music;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Müzik isteği zaman aşımına uğradı. Lütfen tekrar deneyin.');
    throw error;
  } finally { clearTimeout(timer); }
}
