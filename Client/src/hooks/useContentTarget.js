import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function useContentTarget(id) {
  const ref = useRef(null);
  const { hash, key } = useLocation();
  useEffect(() => {
    if (hash !== `#${id}`) return undefined;
    const frame = requestAnimationFrame(() => {
      ref.current?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
      ref.current?.focus?.({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, key, id]);
  return ref;
}
