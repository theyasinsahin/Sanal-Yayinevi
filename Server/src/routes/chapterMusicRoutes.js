import express from 'express';
import mongoose from 'mongoose';
import Chapter from '../models/chapter.js';
import Book from '../models/book.js';
import User from '../models/user.js';
import { authenticateUser } from '../utils/auth.js';
import { assertContentAccess } from '../utils/printedBooks.js';
import { consumeRate } from '../security/rateLimit.js';
import { MAX_MUSIC_BYTES, musicError, musicConfiguration, musicTitle, uploadMusic, cleanupMusic } from '../services/chapterMusic.js';

const router = express.Router();
let activeUploads = 0;
const respond = (error, res) => {
  const rateLimited = error.extensions?.code === 'RATE_LIMITED';
  const status = error.status || (rateLimited ? 429 : 500);
  if (status === 429) res.set('Retry-After', '60');
  res.status(status).json({ error: rateLimited ? 'RATE_LIMITED' : error.code || 'MUSIC_UNAVAILABLE', message: status === 500 ? 'Müzik işlemi tamamlanamadı.' : error.message });
};

async function authorizedChapter(req) {
  const chapter = await Chapter.findOne({ _id: req.params.id, isDeleted: false }).lean();
  const book = chapter && await Book.findOne({ _id: chapter.bookId, isDeleted: false }).lean();
  if (!chapter || !book) throw musicError(404, 'CHAPTER_NOT_FOUND', 'Bölüm bulunamadı.');
  try { assertContentAccess(book, req.musicUser); } catch { throw musicError(403, 'FORBIDDEN', 'Bu bölümün müziğini değiştirme yetkiniz yok.'); }
  return chapter;
}

async function prepare(req, res, next) {
  res.set('Cache-Control', 'no-store');
  try {
    req.musicUser = await authenticateUser(req, User);
    if (!req.musicUser) throw musicError(401, 'UNAUTHENTICATED', 'Giriş yapmalısınız.');
    req.musicConfig = musicConfiguration();
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw musicError(400, 'INVALID_CHAPTER_ID', 'Bölüm kimliği geçersiz.');
    await consumeRate('chapter-music', String(req.musicUser._id), 10, 60000);
    req.musicChapter = await authorizedChapter(req);
    next();
  } catch (error) { respond(error, res); }
}

function reserveUpload(req, res, next) {
  try {
    if (req.get('x-music-rights') !== 'confirmed') throw musicError(400, 'MUSIC_RIGHTS_REQUIRED', 'Müzik kullanım haklarını onaylayın.');
    if (!req.is('audio/mpeg')) throw musicError(415, 'UNSUPPORTED_MUSIC_TYPE', 'Content-Type audio/mpeg olmalıdır.');
    req.musicTitle = musicTitle(req.get('x-music-title'));
    if (Number(req.get('content-length')) > MAX_MUSIC_BYTES) throw musicError(413, 'MUSIC_TOO_LARGE', 'Müzik dosyası 15 MiB sınırını aşıyor.');
    if (activeUploads >= 4) throw musicError(503, 'MUSIC_BUSY', 'Müzik servisi meşgul. Daha sonra tekrar deneyin.');
    activeUploads++;
    let released = false;
    req.releaseMusicUpload = () => { if (!released) { released = true; activeUploads--; } };
    // Retain the slot through provider processing even if the caller disconnects.
    next();
  } catch (error) { respond(error, res); }
}

async function persistMusic(req, music) {
  await authorizedChapter(req); // Recheck ownership/deletion after the network operation.
  const previous = req.musicChapter;
  const filter = { _id: previous._id, isDeleted: false, musicVersion: previous.musicVersion ?? null };
  const updated = await Chapter.findOneAndUpdate(filter, {
    ...(music ? { $set: { music } } : { $unset: { music: 1 } }), $inc: { musicVersion: 1 },
  }, { new: true, runValidators: true }).lean();
  if (!updated) throw musicError(409, 'MUSIC_CONFLICT', 'Bölüm müziği değişti. Yenileyip tekrar deneyin.');
}

router.post('/:id/music', prepare, reserveUpload,
  express.raw({ type: 'audio/mpeg', limit: MAX_MUSIC_BYTES, inflate: false }), async (req, res) => {
    let music;
    try {
      music = await uploadMusic(req.body, req.musicTitle, req.musicConfig);
      await persistMusic(req, music);
    } catch (error) {
      if (music) await cleanupMusic(music.publicId, req.musicConfig);
      respond(error, res);
      return;
    } finally { req.releaseMusicUpload(); }
    res.status(200).json({ music });
    await cleanupMusic(req.musicChapter.music?.publicId, req.musicConfig);
  });
router.delete('/:id/music', prepare, async (req, res) => {
  try {
    await persistMusic(req, null);
    res.json({ music: null });
    await cleanupMusic(req.musicChapter.music?.publicId, req.musicConfig);
  } catch (error) { respond(error, res); }
});
router.use((error, req, res, _next) => {
  req.releaseMusicUpload?.();
  if (error.type === 'entity.too.large') error = musicError(413, 'MUSIC_TOO_LARGE', 'Müzik dosyası 15 MiB sınırını aşıyor.');
  else if (error.type === 'encoding.unsupported') error = musicError(415, 'UNSUPPORTED_ENCODING', 'Sıkıştırılmış istek gövdesi desteklenmiyor.');
  respond(error, res);
});
export default router;
