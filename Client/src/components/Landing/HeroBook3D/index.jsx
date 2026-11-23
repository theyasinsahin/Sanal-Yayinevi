import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { FiChevronLeft, FiChevronRight, FiPause, FiPlay } from 'react-icons/fi';
import { Book3D } from '../../UI/Book3D';
import { bookPath } from '../../../utils/publicPaths';
import { getOptimizedImage } from '../../../utils/ImageUtils';
import { useBookFeed } from '../../../hooks/useBookFeed';
import './HeroBook3D.css';

// three.js yalnızca uygun cihazlarda, tarayıcı boşta kalınca yüklenir
const Book3DScene = lazy(() => import('./Book3DScene'));

const ADVANCE_MS = 6500;
const MAX_BOOKS = 5;
// FeaturedBooks'un ilk sorgusuyla aynı değişkenler: Apollo önbelleği paylaşılır
const POPULAR = { sortBy: 'popular' };
const FEED_OPTIONS = { limit: 10 };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// WebGL var mı ve cihaz 3D'yi kaldırır mı? Değilse CSS 3D kitap kullanılır.
export function canRenderWebGL() {
  if (typeof window === 'undefined' || !window.WebGLRenderingContext) return false;
  if (prefersReducedMotion()) return false;
  if (navigator.connection?.saveData) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const authorName = book => book?.author?.fullName || book?.author?.username || book?.printedAuthor || '';
const coverOf = book => (book?.imageUrl ? getOptimizedImage(book.imageUrl, 480, 720) : '');

const HeroBook3D = () => {
  const { books } = useBookFeed(POPULAR, true, FEED_OPTIONS);
  const navigate = useNavigate();
  const { ref, inView } = useInView({ threshold: 0.05, fallbackInView: true });
  const [webgl] = useState(canRenderWebGL);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [sceneWanted, setSceneWanted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(reducedMotion);
  const [hovered, setHovered] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  // Kapağı olan kitaplar öne alınır; en fazla 5 kitap döner
  const shelf = useMemo(() => {
    const withCover = books.filter(book => book.imageUrl);
    return (withCover.length ? withCover : books).slice(0, MAX_BOOKS);
  }, [books]);
  const book = shelf[index % Math.max(shelf.length, 1)];

  useEffect(() => { setIndex(0); }, [shelf]);

  // Sekme gizliyken hiçbir şey çizilmez
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  // Sahne kodu, sayfa ilk boyandıktan sonra boşta yüklenir (LCP başlık kalır)
  useEffect(() => {
    if (!webgl) return undefined;
    const start = () => setSceneWanted(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 400);
    return () => clearTimeout(id);
  }, [webgl]);

  const step = useCallback(delta => {
    if (shelf.length < 2) return;
    setIndex(current => (current + delta + shelf.length) % shelf.length);
  }, [shelf.length]);

  // Otomatik ilerleme: duraklatılmışken, üzerine gelinmişken veya görünmezken durur
  const running = !paused && !hovered && inView && pageVisible && shelf.length > 1;
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => step(1), ADVANCE_MS);
    return () => clearInterval(id);
  }, [running, step]);

  const open = useCallback(() => { if (book) navigate(bookPath(book)); }, [book, navigate]);
  const markReady = useCallback(() => setSceneReady(true), []);
  const title = book?.title || 'Betik';
  const author = authorName(book);

  return (
    <div
      ref={ref}
      className={`hero-book${sceneReady ? ' is-webgl' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="hero-book-stage">
        <span className="hero-book-halo" aria-hidden="true" />

        {/* CSS kitap: WebGL hazır olana kadar ve desteklenmeyen cihazlarda */}
        <div className="hero-book-fallback" aria-hidden="true" data-testid="hero-book-fallback">
          <Book3D
            key={book?.id || 'placeholder'}
            src={coverOf(book)}
            alt=""
            size="xl"
            float={!reducedMotion}
            loading="eager"
            className="hero-book-css"
          />
        </div>

        {sceneWanted && (
          <Suspense fallback={null}>
            <Book3DScene
              coverUrl={coverOf(book)}
              flipKey={book?.id || ''}
              active={inView && pageVisible}
              onActivate={open}
              onReady={markReady}
            />
          </Suspense>
        )}
      </div>

      {/* Künye alanı baştan ayrılır: veri gelince başlık kaymaz */}
      <div className="hero-book-caption-slot">
      {book && (
        <div className="hero-book-caption">
          <p className="hero-book-eyebrow">Okurların seçtiği</p>
          <p className="hero-book-title" aria-live="polite">
            <Link to={bookPath(book)} aria-label={`Öne çıkan kitabı aç: ${title}`}>{title}</Link>
          </p>
          {author && <p className="hero-book-author">{author}</p>}

          {shelf.length > 1 && (
            <div className="hero-book-controls">
              <button type="button" onClick={() => step(-1)} aria-label="Önceki kitap">
                <FiChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPaused(value => !value)}
                aria-label={paused ? 'Kitap geçişini başlat' : 'Kitap geçişini durdur'}
                aria-pressed={paused}
              >
                {paused ? <FiPlay aria-hidden="true" /> : <FiPause aria-hidden="true" />}
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Sonraki kitap">
                <FiChevronRight aria-hidden="true" />
              </button>
              <span className="hero-book-count" aria-hidden="true">
                {String(index + 1).padStart(2, '0')} / {String(shelf.length).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default HeroBook3D;
