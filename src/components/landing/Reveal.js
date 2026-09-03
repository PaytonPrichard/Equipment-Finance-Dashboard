// ============================================================
// Reveal — fade and rise as content enters the viewport.
//
// Deliberately understated: 14px of travel over 600ms, no scale, no
// bounce. On a page selling a credit tool, motion that draws attention to
// itself reads as a startup landing page rather than as a product.
//
// Under reduced motion the content is simply visible. A reveal that never
// fires must never leave anything hidden.
// ============================================================

import React from 'react';
import { useInView } from '../../hooks/useReveal';

export default function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
  ...rest
}) {
  const [ref, inView] = useInView();

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : 'translateY(14px)',
        transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: inView ? 'auto' : 'opacity, transform',
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Staggers its children. Cards in a row should arrive in sequence rather
 * than as one block, which reads as considered instead of mechanical.
 */
export function RevealGroup({ children, className = '', step = 70, initial = 0 }) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, i) =>
        child ? (
          // h-full so the wrapper does not break grid stretch: without it the
          // real children stop being the grid items and cards in a row end up
          // at whatever height their own content happens to need.
          <Reveal delay={initial + i * step} className="h-full">
            {child}
          </Reveal>
        ) : child,
      )}
    </div>
  );
}
