// ============================================================
// Scroll motion primitives for the marketing page.
//
// IntersectionObserver and a throttled scroll listener, no library. The
// landing page is the first thing anyone loads, so a motion dependency
// would be paid for by every visitor before they read a word.
//
// Every hook here returns something inert when the visitor has asked for
// reduced motion, so the page renders in its final state rather than in
// its starting one. A reveal animation that never fires must leave content
// visible, not hidden.
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * True once the element has scrolled into view, and true forever after.
 *
 * Deliberately one-way: re-hiding content when it leaves the viewport makes
 * a page feel unstable when someone scrolls back up.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; rootMargin?: string } = {},
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => prefersReducedMotion());

  const { threshold = 0.15, rootMargin = '0px 0px -40px 0px' } = options;

  useEffect(() => {
    if (prefersReducedMotion()) { setInView(true); return; }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}

/**
 * Whether the page has scrolled past a threshold. Drives the nav changing
 * from transparent-over-hero to solid.
 */
export function useScrolledPast(offset: number = 24): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setPast(window.scrollY > offset);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [offset]);

  return past;
}

/**
 * Progress through a tall section, 0 to 1, for scroll-pinned sequences.
 *
 * Returns 0 under `enabled: false`, which is how the mobile fallback works:
 * pinning a section and taking over the scroll is hostile on a phone, so
 * below the breakpoint the section renders as an ordinary stack instead.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>(
  enabled: boolean = true,
): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) { setProgress(0); return; }
    let frame = 0;

    const read = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Distance scrolled into the section, over the distance available
      // once the pinned viewport height is subtracted.
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) { setProgress(0); return; }
      const scrolled = -rect.top;
      setProgress(Math.min(1, Math.max(0, scrolled / travel)));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return [ref, progress];
}

/** Matches a media query, and keeps matching as the window changes. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * A looping timeline of steps, paused whenever it is off-screen.
 *
 * An animation running behind the fold burns battery to show nobody
 * anything. Under reduced motion it parks on the final step, so the hero
 * shows a finished result rather than an empty panel.
 */
export function useLoopingSteps<T extends HTMLElement = HTMLDivElement>(
  durations: number[],
): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const reduced = prefersReducedMotion();
  const [step, setStep] = useState(() => (reduced ? durations.length - 1 : 0));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  const advance = useCallback(() => {
    setStep((s) => (s + 1) % durations.length);
  }, [durations.length]);

  useEffect(() => {
    if (reduced || !visible) return;
    const wait = durations[step] ?? 800;
    const id = window.setTimeout(advance, wait);
    return () => window.clearTimeout(id);
  }, [step, visible, reduced, durations, advance]);

  return [ref, step];
}
