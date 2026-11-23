import { useInView } from 'react-intersection-observer';

/**
 * Kaydırınca beliren içerik için ref ve sınıf adı döndürür.
 * Stil index.css'teki `.reveal` / `.is-revealed` kurallarından gelir;
 * `prefers-reduced-motion` açıkken içerik doğrudan görünür.
 * IntersectionObserver olmayan ortamlarda (eski tarayıcı, test) içerik
 * görünür kabul edilir, böylece hiçbir şey gizli kalmaz.
 *
 * Kullanım:
 *   const reveal = useReveal();
 *   <section ref={reveal.ref} className={`how ${reveal.className}`} style={reveal.style(120)} />
 */
export function useReveal({ once = true, rootMargin = '0px 0px -12% 0px', threshold = 0.12 } = {}) {
  const { ref, inView } = useInView({
    triggerOnce: once,
    rootMargin,
    threshold,
    fallbackInView: true,
  });

  return {
    ref,
    inView,
    className: inView ? 'reveal is-revealed' : 'reveal',
    style: (delayMs = 0) => ({ '--reveal-delay': `${delayMs}ms` }),
  };
}

export default useReveal;
