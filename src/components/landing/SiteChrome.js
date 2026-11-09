// ============================================================
// SiteChrome — what the landing page and the Methodology page share:
// the putty ground, the nav, the white sheet and the footer.
//
// There is no router. The two pages are separate documents as far as the
// browser is concerned, so the nav uses ordinary links. On the landing page
// the section links also scroll smoothly, through onSection.
// ============================================================

import React from 'react';
import TrancheLogo from '../TrancheLogo';
import { useScrolledPast } from '../../hooks/useReveal';

export const GOLD = '#D4A843';
// Warm putty. Biased toward the gold rather than a neutral grey, so the
// margin around the sheet reads as chosen rather than as unpainted.
export const GROUND = '#E3DED2';
export const CREAM = '#FAF8F2';
export const RULE = '#e5e0d4';

const NAV_ITEMS = [
  { id: 'product', label: 'Product', href: '/#product' },
  { id: 'methodology', label: 'Methodology', href: '/methodology' },
  { id: 'pricing', label: 'Pricing', href: '/#pricing' },
];

/**
 * `current` is the nav id to underline. `onSection(id)` is given by the
 * landing page: return true from it to keep the browser from following the
 * link, because the section is on this page and was scrolled to instead.
 */
export function SiteNav({ current, onSection, onGetStarted, onSignIn }) {
  const scrolled = useScrolledPast(24);

  return (
    // Fixed height. Shrinking the bar on scroll moved everything under it,
    // scroll anchoring moved the page back, and the bar grew again: the page
    // bounced near the threshold. Only paint changes on scroll, never size.
    <nav
      className="sticky top-0 z-50 transition-shadow duration-300"
      style={{ backgroundColor: GROUND, boxShadow: scrolled ? '0 1px 0 rgba(22,21,15,0.08)' : 'none' }}
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 text-xl font-extrabold text-gray-900 tracking-tight">
          <TrancheLogo size={32} />
          Tranche
        </a>
        <div className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive = current === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => { if (onSection && onSection(item.id)) e.preventDefault(); }}
                aria-current={isActive ? 'true' : undefined}
                className={`relative text-[15px] transition-colors ${isActive ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {item.label}
                {/* The underline is what reads as "you are here"; it grows
                    from the centre so the transition has a direction. */}
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-1.5 h-[2px] rounded-full origin-center transition-transform duration-300"
                  style={{ backgroundColor: GOLD, transform: `scaleX(${isActive ? 1 : 0})` }}
                />
              </a>
            );
          })}
          {/* Demo leaves the page, so it is never "current". */}
          <a href="/?demo=1" className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">Demo</a>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={onSignIn} className="px-3 py-2 rounded-lg text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">Sign in</button>
          <button onClick={onGetStarted} className="px-4 sm:px-5 py-2.5 rounded-lg text-[15px] font-semibold text-white hover:opacity-90 transition-all whitespace-nowrap" style={{ backgroundColor: GOLD }}>Request a trial</button>
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t" style={{ backgroundColor: CREAM, borderColor: RULE }}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-8 py-8 flex items-center justify-between gap-4 flex-wrap">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-700 tracking-tight">
          <TrancheLogo size={20} framed={false} />
          Tranche
        </span>
        <div className="flex items-center gap-5 flex-wrap">
          <a href="/methodology" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Methodology</a>
          <a href="/privacy.html" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Privacy</a>
          <a href="/terms.html" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Terms</a>
          <a href="mailto:team@gettranche.app" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Contact</a>
          <span className="text-xs text-gray-400">&copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}

/** Ground, nav, the sheet everything sits on, and the footer. */
export default function SiteShell({ children, ...nav }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: GROUND }}>
      <SiteNav {...nav} />
      <div className="px-3 sm:px-5 xl:px-7 2xl:px-9 pb-3 sm:pb-5 xl:pb-7 2xl:pb-9">
        <div
          className="bg-white rounded-[20px] sm:rounded-[28px] overflow-clip"
          style={{
            // Layered rather than one blur: a hairline to define the edge
            // against the putty, a tight shadow for contact, and two wide
            // soft ones for lift. Tinted warm (22,21,15) instead of black,
            // so the shadow belongs to this ground rather than sitting on it.
            boxShadow:
              '0 0 0 1px rgba(22,21,15,0.075), 0 1px 2px rgba(22,21,15,0.05), 0 10px 30px -4px rgba(22,21,15,0.07), 0 44px 88px -32px rgba(22,21,15,0.16)',
          }}
        >
          {children}
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
