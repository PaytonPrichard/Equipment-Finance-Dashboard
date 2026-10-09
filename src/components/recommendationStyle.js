// Recommendation tone to classes. Kept in the component layer so the
// recommendation logic in src/lib/recommendation.ts stays free of Tailwind.
// A score-only recommendation (tone 'score' or none) keeps the classes its
// module supplied.

const TONE_CLASSES = {
  pass: {
    bgClass: 'bg-emerald-500/10 border-emerald-500/30',
    textClass: 'text-emerald-700',
    badgeBg: 'bg-emerald-500/20',
  },
  flag: {
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    textClass: 'text-amber-700',
    badgeBg: 'bg-amber-500/20',
  },
  fail: {
    bgClass: 'bg-rose-500/10 border-rose-500/30',
    textClass: 'text-rose-700',
    badgeBg: 'bg-rose-500/20',
  },
};

export function recommendationStyle(rec) {
  if (rec?.tone && TONE_CLASSES[rec.tone]) {
    // A PASS keeps its score colour (strong vs moderate under a custom policy).
    if (rec.tone === 'pass' && rec.bgClass) {
      return { bgClass: rec.bgClass, textClass: rec.textClass, badgeBg: rec.badgeBg };
    }
    return TONE_CLASSES[rec.tone];
  }
  return { bgClass: rec?.bgClass || '', textClass: rec?.textClass || '', badgeBg: rec?.badgeBg || '' };
}
