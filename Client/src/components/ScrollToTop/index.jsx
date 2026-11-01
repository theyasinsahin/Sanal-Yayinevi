import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const catalogPaths = new Set(['/feed', '/printed-books']);

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map());

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const saved = positions.current.get(location.key);
    const target = navigationType === 'POP' && catalogPaths.has(location.pathname) ? saved : null;
    let restoring = Boolean(target);
    let observer;
    let timeout;
    const stopRestoring = () => {
      restoring = false;
      observer?.disconnect();
      clearTimeout(timeout);
    };
    const remember = () => {
      if (restoring || !catalogPaths.has(location.pathname)) return;
      positions.current.set(location.key, { x: window.scrollX, y: window.scrollY });
      if (positions.current.size > 100) positions.current.delete(positions.current.keys().next().value);
    };
    const restore = () => {
      if (!restoring) return;
      window.scrollTo({ left: target.x, top: target.y, behavior: 'instant' });
      if (document.documentElement.scrollHeight - window.innerHeight >= target.y) stopRestoring();
    };
    if (target) {
      // Wait for lazy routes and query results to make the list tall enough.
      observer = new ResizeObserver(restore);
      observer.observe(document.body);
      timeout = setTimeout(stopRestoring, 10000);
      restore();
    } else {
      window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      remember();
    }
    window.addEventListener('scroll', remember, { passive: true });
    // User input takes precedence over pending restoration.
    window.addEventListener('wheel', stopRestoring, { passive: true });
    window.addEventListener('touchstart', stopRestoring, { passive: true });
    window.addEventListener('keydown', stopRestoring);
    return () => {
      stopRestoring();
      window.removeEventListener('scroll', remember);
      window.removeEventListener('wheel', stopRestoring);
      window.removeEventListener('touchstart', stopRestoring);
      window.removeEventListener('keydown', stopRestoring);
    };
  }, [location.key, location.pathname, navigationType]);

  return null;
}
