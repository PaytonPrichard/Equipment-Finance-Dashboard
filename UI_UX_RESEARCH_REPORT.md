# UI/UX Research Report: Dark-Themed ABL Deal Screening Dashboard

**Date**: March 2026
**Target Users**: Private credit analysts screening equipment finance / ABL deals
**Current Stack**: React + Tailwind CSS, dark theme with Slate color system

---

## Table of Contents

1. [Color System Recommendations](#1-color-system-recommendations)
2. [Typography Recommendations](#2-typography-recommendations)
3. [Layout & Spacing Recommendations](#3-layout--spacing-recommendations)
4. [Component-Specific Design Patterns](#4-component-specific-design-patterns)
5. [Behavioral Science Insights](#5-behavioral-science-insights)
6. [Accessibility & Readability](#6-accessibility--readability)
7. [Prioritized UI Changes](#7-prioritized-ui-changes)
8. [Sources](#8-sources)

---

## 1. Color System Recommendations

### 1.1 Current State Assessment

Your current palette is already well-structured using Tailwind's Slate scale with a `#0b1120` base background, glass-morphism cards at `rgba(15, 23, 42, 0.6)`, and blue (`#3b82f6`) as the primary accent. This is a solid foundation. The recommendations below are refinements, not a wholesale replacement.

### 1.2 Background Layer System (Elevation Model)

Professional financial platforms use a layered elevation model where each surface level gets slightly lighter. This mirrors how Stripe (`#14171D` base), Linear (`#0F0F10` base), and the Bloomberg Terminal approach dark interfaces.

**Recommended Background Scale:**

| Token               | Hex        | Usage                                       |
|----------------------|-----------|----------------------------------------------|
| `--bg-base`          | `#0A0F1A` | Page background (deepest layer)              |
| `--bg-surface`       | `#0F172A` | Primary content areas (slate-900)            |
| `--bg-card`          | `#1E293B` | Cards, panels, modals (slate-800)            |
| `--bg-card-hover`    | `#243147` | Card hover state                             |
| `--bg-elevated`      | `#334155` | Popovers, dropdowns, tooltips (slate-700)    |
| `--bg-input`         | `#0F172A` | Form inputs (matches surface)                |
| `--bg-input-focus`   | `#172033` | Input focus state (slightly warmer)          |

**Rationale**: Your current `#0b1120` is excellent. It is darker than Tailwind's slate-900 (`#0F172A`) which gives the card layer (`#0F172A`) visible but not jarring separation. This 3-4 layer elevation model is exactly what Stripe, Vercel's Geist, and Linear use.

### 1.3 Border System

| Token                | Value                              | Usage                         |
|-----------------------|------------------------------------|-------------------------------|
| `--border-subtle`     | `rgba(148, 163, 184, 0.06)`       | Default card/section borders  |
| `--border-default`    | `rgba(148, 163, 184, 0.10)`       | Input borders, dividers       |
| `--border-hover`      | `rgba(148, 163, 184, 0.16)`       | Interactive element hover     |
| `--border-focus`      | `rgba(59, 130, 246, 0.50)`        | Focus rings (blue accent)     |
| `--border-active`     | `rgba(59, 130, 246, 0.30)`        | Active/selected state         |

**What to change**: Your current borders at `0.08` opacity are slightly too invisible for card edges. Consider `0.06` for ambient borders but `0.10` for input fields where the boundary needs to be clear. This matches the Stripe dark mode approach where `colorBorder: #2B3039` provides subtle but present boundaries.

### 1.4 Text Color Hierarchy

| Token               | Hex        | Tailwind     | Usage                              |
|----------------------|-----------|--------------|-------------------------------------|
| `--text-primary`     | `#F1F5F9` | slate-100    | Headings, primary values            |
| `--text-secondary`   | `#CBD5E1` | slate-300    | Body text, descriptions             |
| `--text-tertiary`    | `#94A3B8` | slate-400    | Supporting labels                   |
| `--text-muted`       | `#64748B` | slate-500    | Placeholder text, metadata          |
| `--text-faint`       | `#475569` | slate-600    | Disabled states, subtle hints       |
| `--text-ghost`       | `#334155` | slate-700    | Decorative/structural text          |

**What to change**: Your current text hierarchy is well-implemented. The main improvement would be ensuring metric values (DSCR, Leverage, LTV) consistently use `#F1F5F9` (slate-100) rather than the status color for the primary number, with the status color used for the status badge only. This follows the Bloomberg principle of making raw data neutral and letting the user form their own judgment before seeing the colored assessment.

### 1.5 Primary Accent Color

| Token               | Hex        | Usage                                    |
|----------------------|-----------|-------------------------------------------|
| `--accent`           | `#3B82F6` | Primary actions, active tabs, focus rings |
| `--accent-hover`     | `#60A5FA` | Hover state for primary actions           |
| `--accent-muted`     | `rgba(59, 130, 246, 0.12)` | Active tab backgrounds         |
| `--accent-subtle`    | `rgba(59, 130, 246, 0.06)` | Hover backgrounds              |

**Validation**: Blue as primary accent is correct for financial software. Research from fintech trust studies shows blue conveys stability and security, which is why Bloomberg (`#0068ff`), Stripe (`#0085FF`), PitchBook, and virtually every serious financial platform leads with blue. Your `#3B82F6` is the right choice.

### 1.6 Semantic Status Colors (Risk Indicators)

This is the most critical color decision for a deal screening tool. Based on behavioral science research on how color affects financial decision-making:

**Risk Score / Deal Quality:**

| Status     | Primary Hex | Background               | Border                   | Text Class    |
|------------|------------|--------------------------|--------------------------|---------------|
| Excellent  | `#10B981`  | `rgba(16, 185, 129, 0.08)` | `rgba(16, 185, 129, 0.15)` | emerald-400 |
| Good       | `#14B8A6`  | `rgba(20, 184, 166, 0.08)` | `rgba(20, 184, 166, 0.15)` | teal-400    |
| Adequate   | `#F59E0B`  | `rgba(245, 158, 11, 0.08)` | `rgba(245, 158, 11, 0.15)` | amber-400   |
| Weak       | `#EF4444`  | `rgba(239, 68, 68, 0.08)`  | `rgba(239, 68, 68, 0.15)` | rose-400    |

**Critical behavioral insight**: Research from the University of Kansas (published in Management Science) found that displaying financial losses in red causes investors to require approximately 25% higher risk premium. For a deal screening tool, this is actually desirable -- you WANT analysts to be more cautious about weak deals. However, be aware that excessive red can trigger avoidance behavior where analysts skip reviewing the deal entirely rather than engaging with it. Recommendation: Use red/rose for the status badge and border tint, but keep the actual metric VALUE (e.g., "0.95x") in neutral white/slate so the analyst reads the number before processing the emotional color signal.

**System Status Colors (non-risk):**

| Purpose    | Hex        | Usage                                    |
|------------|-----------|-------------------------------------------|
| Success    | `#10B981`  | Save confirmations, completed actions     |
| Warning    | `#F59E0B`  | SOFR alerts, approaching thresholds       |
| Danger     | `#EF4444`  | Errors, failed operations, delete actions |
| Info       | `#3B82F6`  | Informational banners, tips               |

### 1.7 Data Visualization Colors

For charts (radar, sensitivity, stress test), use a sequential palette that works on dark backgrounds:

| Purpose             | Hex        | Notes                                |
|----------------------|-----------|---------------------------------------|
| Chart primary        | `#3B82F6` | Primary data series                   |
| Chart secondary      | `#8B5CF6` | Second data series (purple)           |
| Chart tertiary       | `#06B6D4` | Third data series (cyan)              |
| Chart quaternary     | `#F59E0B` | Fourth data series (amber)            |
| Chart grid lines     | `rgba(148, 163, 184, 0.06)` | Nearly invisible       |
| Chart axis labels    | `#64748B` | Muted for background role             |

### 1.8 Platform Comparison Summary

| Platform                | Base BG     | Surface     | Accent     | Approach                      |
|--------------------------|------------|-------------|-----------|-------------------------------|
| Bloomberg Terminal        | `#000000`  | `#1a1a1a`  | `#FFA028` | Maximum density, amber accent  |
| Stripe (dark)            | `#14171D`  | `#1B1E25`  | `#0085FF` | Clean navy, blue accent        |
| Linear                   | `#0F0F10`  | `#151516`  | varies     | True black, minimal chrome     |
| Vercel/Geist             | `#000000`  | `#111111`  | `#0070F3` | Pure black, blue accent        |
| Your current             | `#0B1120`  | `#0F172A`  | `#3B82F6` | Blue-tinted dark, blue accent  |
| **Recommended (keep)**   | `#0A0F1A`  | `#0F172A`  | `#3B82F6` | Refined current approach       |

**Verdict**: Your blue-tinted dark approach is correct for a financial tool. Pure black (Linear, Vercel) works for dev tools but feels cold for financial analysis. The slight blue warmth in your backgrounds signals professionalism and trust. Do NOT switch to pure black.

---

## 2. Typography Recommendations

### 2.1 Font Stack

**Recommended stack (current is mostly correct):**

```css
/* Primary UI font */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Numeric/financial data */
--font-mono: 'JetBrains Mono', 'SF Mono', 'IBM Plex Mono', 'Fira Code', monospace;

/* Headings (optional upgrade) */
--font-display: 'Inter Display', 'Inter', -apple-system, sans-serif;
```

**Why Inter**: Inter defaults to tabular figures, meaning all numerals share the same width. This is critical for financial dashboards where numbers in columns must align vertically. The tall x-height keeps text legible at 11px, which matters for data-dense layouts. Linear, Vercel, GitHub, and most modern SaaS products use Inter.

**Why JetBrains Mono for financial figures**: Your current approach of using `font-mono` for metric values (DSCR, percentages, currency) is correct. JetBrains Mono has excellent character differentiation between `0`/`O`, `1`/`l`/`I` which prevents misreading financial data. It was designed to reduce eye strain during extended reading sessions, which maps well to analyst workflows.

**Optional upgrade -- Inter Display**: Linear recently adopted Inter Display for headings, which adds more visual weight and expression to section headers while maintaining the Inter family consistency. This is a subtle but worthwhile upgrade for the company name display and section headers.

### 2.2 Type Scale

| Token            | Size   | Weight  | Line Height | Usage                                     |
|-------------------|--------|---------|-------------|-------------------------------------------|
| `text-display`    | 24px   | 800     | 1.2         | Company name on deal view                  |
| `text-heading`    | 18px   | 700     | 1.3         | Section titles                             |
| `text-subheading` | 15px   | 700     | 1.3         | Card titles, app name in header            |
| `text-body`       | 14px   | 400     | 1.5         | Body text, descriptions                    |
| `text-small`      | 13px   | 400     | 1.4         | Table cells, secondary content             |
| `text-caption`    | 11px   | 600     | 1.4         | Labels, pill text, metadata                |
| `text-micro`      | 10px   | 600     | 1.3         | Section labels (uppercase tracking)        |
| `text-nano`       | 9px    | 700     | 1.2         | Badges, status indicators                  |

**What to change**: Your current `text-[10px]` uppercase tracking labels are well-done. The main improvement opportunity is in the metric card values -- your current `text-2xl` (24px) is good, but ensure these always use `font-variant-numeric: tabular-nums` to prevent layout shifts when values change.

### 2.3 Numeric Display Rules

```css
/* Apply to all financial figures */
.financial-value {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
  letter-spacing: -0.01em;  /* Slight tightening for mono at large sizes */
}

/* Currency values */
.currency {
  font-variant-numeric: tabular-nums;
  /* Right-align in tables, left-align in cards */
}

/* Percentage values */
.percentage {
  font-variant-numeric: tabular-nums;
  /* Always include the % symbol, never truncate decimals inconsistently */
}
```

**Key rule from data visualization research**: In tables, right-align all numeric columns so decimal points stack vertically. In metric cards, left-align or center-align is fine since each card contains a single value.

---

## 3. Layout & Spacing Recommendations

### 3.1 Grid System

Your current `max-w-[1600px]` with `px-6` padding is appropriate. Financial dashboards need wide viewports for data density.

**Recommended grid gaps:**

| Context                    | Gap    | Notes                                    |
|----------------------------|--------|------------------------------------------|
| Between major sections     | 32px   | `gap-8` -- current value, correct        |
| Between cards in a grid    | 12px   | `gap-3` -- current value, correct        |
| Between form fields        | 16px   | `gap-4`                                  |
| Inside card padding        | 20px   | `p-5` -- current value, correct          |
| Metric card padding        | 16px   | `p-4` -- current value, correct          |
| Between label and input    | 8px    | `mb-2` -- current value, correct         |

### 3.2 Information Density Levels

Based on the UI density research (Matt Strom-Awn's framework applied to your tool):

**Visual Density**: Medium-high. Your 5-column metric card grid is appropriately dense for credit analysts. Do NOT reduce to 3 columns thinking it will be "cleaner" -- analysts want to see DSCR, Leverage, LTV, Term/Life, and Rev. Concentration simultaneously.

**Information Density**: High and correct. Every pixel is delivering value. The Tufte "data-ink ratio" principle says maximize the data relative to non-data elements, and your metric cards do this well.

**Temporal Density**: This is your biggest opportunity. Bloomberg Terminal's dominance comes from loading data with zero latency. Ensure all metric calculations happen synchronously (which they do via `useMemo`), and add skeleton loading states for async operations (Supabase fetches) rather than spinners.

### 3.3 Spacing Refinements

| Area                        | Current        | Recommended     | Reason                       |
|-----------------------------|----------------|-----------------|------------------------------|
| Header height               | ~56px          | 52px            | Reclaim vertical space       |
| SOFR bar height             | ~32px          | 28px            | Minimal information, shrink  |
| Toolbar bar height          | ~44px          | 40px            | Tighter toolbar              |
| Section nav pills           | `px-2.5 py-1`  | `px-3 py-1`    | Slightly wider touch targets |
| Form section gap            | varies          | Consistent 24px | Visual rhythm                |

### 3.4 Sticky Positioning Strategy

Your current approach of making the header sticky (`sticky top-0`) and the form sticky (`sticky top-16`) is correct. Recommendation: Add a subtle shadow to the sticky header when scrolled to indicate elevation:

```css
header.scrolled {
  box-shadow: 0 1px 0 rgba(148, 163, 184, 0.06),
              0 4px 12px rgba(0, 0, 0, 0.15);
}
```

---

## 4. Component-Specific Design Patterns

### 4.1 Risk Score Gauge

**Current**: Circular arc gauge with needle, score labels, and color segments. This is the right choice.

**Validation from research**: Circular/radial gauges are the most effective for single-score displays because they leverage the mental model of speedometers and analog instruments. Research recommends 1-4 segments maximum (you have 4: Weak/Borderline/Moderate/Strong -- correct).

**Specific improvements:**

1. **Reduce segment opacity**: Your segment colors at `0.08` opacity are appropriately subtle. Keep them.
2. **Add a numerical context band**: Below the score number, add a line like "72nd percentile of screened deals" to provide anchoring context.
3. **Animate on entry**: Your `0.8s cubic-bezier` animation is excellent. Keep the needle sweep.
4. **Consider adding micro-ticks**: Add thin ticks at 25, 50, 75 (you already do this -- good). Consider adding labels "25", "50", "75" below the ticks for analysts who are new to the scoring model.

**What NOT to change**: Do not replace the gauge with a simple number or progress bar. The circular gauge provides the emotional weight that a raw number lacks, and it serves as the visual anchor for the entire deal assessment.

### 4.2 Metric Cards (DSCR, Leverage, LTV, etc.)

**Current design is strong**. The 4-status color system (excellent/good/adequate/weak) with subtle background tinting is professional.

**Improvements:**

1. **Threshold context line**: Your `threshold` prop showing "Min 1.25x / Target 1.50x+" is excellent. Make this slightly more prominent -- increase from `text-[10px] text-slate-600` to `text-[10px] text-slate-500` so it is readable without squinting.
2. **Sparkline addition (future)**: Consider adding a 30-day mini sparkline for metrics that change over time (if you add deal version tracking).
3. **Comparison anchor**: Show industry median next to the value. "DSCR: 1.82x (median: 1.45x)" provides anchoring context that helps analysts calibrate their assessment.
4. **Icon indicators**: Add an up/down arrow icon when comparing to a benchmark, rather than relying solely on color to communicate "good vs bad."

### 4.3 Data Tables (Historical Deals, Batch Screening)

**Recommended specifications:**

| Property              | Value                                      |
|-----------------------|--------------------------------------------|
| Row height            | 44px (compact) / 52px (comfortable)        |
| Header height         | 40px                                       |
| Cell font size        | 13px                                       |
| Header font size      | 10px uppercase, 600 weight                 |
| Cell line height      | 1.4                                        |
| Row separator         | `1px solid rgba(148, 163, 184, 0.06)`      |
| Hover state           | `rgba(59, 130, 246, 0.04)` background      |
| Selected row          | `rgba(59, 130, 246, 0.08)` background      |
| Zebra striping        | NOT recommended -- use separators instead   |
| Numeric alignment     | Right-aligned, monospace                    |
| Text alignment        | Left-aligned                               |
| Sticky header         | Yes, with `backdrop-filter: blur(8px)`     |

**Zebra striping verdict**: Research from Pencil & Paper's enterprise data table analysis found that zebra striping "creates challenges differentiating disabled, hover, focused, and active states" and results in "excessive visual noise." For your dark theme, use thin 1px line dividers with very low opacity instead. This matches Linear and Stripe's approach.

### 4.4 Deal Pipeline / Kanban Board

**Best practices from financial CRM research:**

1. **Column headers**: Show aggregate value (total deal value and count) in each stage header.
2. **Deal cards**: Show company name, score badge, deal size, and days-in-stage. Keep cards compact (120-140px height).
3. **Velocity indicators**: Add a subtle colored bar showing how long a deal has been in the current stage relative to average.
4. **Win probability**: If you implement ML scoring, show a small probability indicator on each card.
5. **Drag affordance**: Use a subtle grip handle on the left edge. Keep the card body clickable for detail view.
6. **Column colors**: Use very subtle background tinting per stage -- NOT full color. A 2-3% opacity tint of the stage color is sufficient.

### 4.5 Form Design (Deal Entry -- 15+ Fields)

**Your current form is well-structured**. The main recommendations:

1. **Section grouping**: Your form already groups fields logically. Add collapsible sections with headers: "Borrower Profile", "Financial Data", "Equipment Details", "Deal Structure". Default all sections open for power users, but allow collapsing for repeat entry when only one section changes.

2. **Smart defaults**: Pre-populate fields based on industry selection. When an analyst selects "Construction" and "Heavy Machinery", auto-fill useful life at 10 years and suggest EFA financing type. You already have `EQUIPMENT_DEFAULTS` -- make these more aggressive.

3. **Tab-through optimization**: Ensure the tab order follows the logical flow of deal analysis: Company > Industry > Revenue > EBITDA > Debt > Equipment > Cost > Term. Test that an analyst can enter a complete deal using only keyboard.

4. **Inline validation timing**: Use "late" inline validation (onBlur) rather than onChange. Let analysts type freely, then validate when they leave the field. This prevents the frustrating experience of seeing errors while still typing a number.

5. **Currency input formatting**: Your current approach of formatting on input is correct. Consider adding thousand separators as the user types (you already do this with `toLocaleString()`).

6. **Single-column layout**: Your current single-column form layout in the left panel is correct per UX research -- single-column layouts reduce cognitive load by 15-20% versus multi-column for sequential data entry.

---

## 5. Behavioral Science Insights

### 5.1 Anchoring Effects in Risk Scoring

**The problem**: The first number an analyst sees becomes their "anchor" for evaluating all subsequent information. If the composite risk score (displayed prominently in the gauge) is the first thing they see, it anchors their perception of the individual metrics.

**Recommendation**: Display the composite score AFTER the individual metrics, not before. Structure the results as: Executive Summary > Individual Metrics > Composite Score > Recommendation. This forces analysts to form their own preliminary assessment before seeing the model's aggregate judgment.

**Current state**: Your layout shows the gauge and radar chart before the individual metric cards, which means the composite score anchors the analyst's reading of DSCR, Leverage, etc. Consider swapping the order: Metrics first, then Score.

**Counter-argument**: Experienced analysts may prefer score-first as a triage signal (quickly deciding whether to read further). Consider making this order configurable in user preferences.

### 5.2 Color and Financial Decision-Making

**Key research finding** (University of Kansas, Management Science journal): "Investors who view potential financial losses in red, compared to other colors, may require about a 25% higher risk premium."

**Implications for your dashboard:**
- Red on a "Weak" deal score WILL make analysts more risk-averse toward that deal. This is appropriate for a screening tool where false positives (approving bad deals) are more costly than false negatives (rejecting borderline deals).
- However, be cautious with amber/yellow for "Adequate" deals. Research shows yellow triggers caution but not avoidance, which is the correct behavioral response for borderline deals.
- Do NOT use red for the numeric value itself (e.g., "0.95x DSCR" in red). Instead, display the number in neutral white and use red only for the status badge. This lets the analyst process the data rationally before the emotional color signal registers.

### 5.3 Progressive Disclosure for Complex Financial Data

**Pattern**: Show the essential screening result (score + top 3 metrics) immediately. Hide supporting detail (stress test, amortization schedule, sensitivity analysis, comparable deals) behind clear but accessible expansion points.

**Your current implementation**: You use a section navigation bar with scroll-to anchors. This is a valid approach, but consider these enhancements:

1. **Collapse by default**: Sections like Amortization Schedule, Industry Benchmarks, and Sensitivity Charts are reference material, not primary screening output. Start them collapsed with a clear "Show Amortization Schedule" button.
2. **Progressive loading**: For expensive computations (comparable deals search, sensitivity matrix), show a skeleton state and load asynchronously rather than computing everything upfront.
3. **Depth levels**: Primary (always visible): Score, Metrics, Recommendation. Secondary (visible but condensed): Stress Test, Structure. Tertiary (collapsed): Amortization, Benchmarks, Sensitivity, Weights, Checklist.

### 5.4 Decision Fatigue Reduction

**The problem**: Analysts screening multiple deals per day experience decision fatigue, leading to either rubber-stamping approvals or defaulting to rejection.

**Recommendations:**
1. **Clear call-to-action**: Your recommendation component should have a single, prominent action: "Move to Pipeline as [Proceed/Watch/Decline]". Reduce the number of choices at the decision point.
2. **Comparison context**: Show how this deal compares to the last 3 deals the analyst screened (not just the model's historical dataset). Recency bias is inevitable -- harness it by making the comparison explicit.
3. **Session summary**: When an analyst has screened 5+ deals in a session, show a summary ribbon: "Screened 5 deals today: 2 Proceed, 1 Watch, 2 Declined. Avg score: 62."

### 5.5 Trust Signals for Analyst Adoption

**Why analysts trust (or distrust) model output:**

1. **Transparency of methodology**: Your ScoringWeights component is excellent for trust-building. Analysts need to see HOW the score was computed to trust it. Consider showing the weight and contribution of each factor directly on the score gauge (e.g., "DSCR contributed 28/100 points").

2. **Ability to challenge**: Your What-If panel serves this purpose -- analysts can test "what if EBITDA were 10% lower?" and see how the score changes. This sense of control builds trust. Make the What-If panel more prominent.

3. **Data sourcing visibility**: Your SOFR rate indicator with source badge ("live" / "cached" / "fallback") is an excellent trust signal. Apply the same pattern to any data the model uses. Always show data freshness dates.

4. **Consistency with manual analysis**: Ensure the model's risk assessment is explainable in terms analysts already use. "DSCR of 1.15x is below the 1.25x minimum" is a statement any credit analyst would make manually. The model should speak in this language.

5. **Acknowledge uncertainty**: Where the model is extrapolating or where data is thin, say so explicitly. "Limited comparable deals in Marine sector -- benchmark confidence is low" is more trustworthy than presenting thin data with false precision.

### 5.6 The "Bloomberg Effect" -- Why Dense, Dark Works

**Research insight**: Bloomberg Terminal users prefer dense, dark interfaces not just for aesthetic reasons but for functional ones:

1. **Reduced eye strain**: Dark backgrounds with light text produce less screen glare in office environments, enabling longer sustained focus sessions.
2. **Data prominence**: On dark backgrounds, data (numbers, charts, colors) stands out more vividly because the background recedes. This is the opposite of light themes where decorative elements (borders, shadows, gradients) compete for attention.
3. **Professional identity signaling**: Dense, dark interfaces signal expertise. Bloomberg users report satisfaction from "handling complicated systems" -- the complexity itself is a feature, not a bug, for professional users.
4. **Temporal efficiency**: Bloomberg's Terminal loads screens instantaneously, which is its actual superpower. Dense layout + zero latency = maximum temporal density (value delivered per second of analyst time).

**Implication for your dashboard**: Do NOT simplify the interface to look like a consumer fintech app (Ramp, Mercury). Your users are credit analysts who WANT to see DSCR, Leverage, LTV, Term/Life, and Rev. Concentration all at once. The density is the feature. Instead, focus on making the density ORGANIZED through clear visual hierarchy, consistent spacing, and logical grouping.

---

## 6. Accessibility & Readability

### 6.1 WCAG Contrast Requirements

| Standard    | Ratio  | Application                                    |
|-------------|--------|------------------------------------------------|
| WCAG AA     | 4.5:1  | Normal text (under 18px or 14px bold)           |
| WCAG AA     | 3:1    | Large text (18px+ or 14px+ bold), UI components |
| WCAG AAA    | 7:1    | Enhanced contrast for normal text               |

**Your current contrast audit:**

| Element                    | Colors                     | Approx Ratio | Pass? |
|----------------------------|----------------------------|-------------|-------|
| Primary text on base       | `#F1F5F9` on `#0B1120`    | ~15:1       | AAA   |
| Secondary text on base     | `#CBD5E1` on `#0B1120`    | ~10:1       | AAA   |
| Muted text on base         | `#64748B` on `#0B1120`    | ~3.8:1      | AA Large only |
| Faint text on base         | `#475569` on `#0B1120`    | ~2.5:1      | FAIL  |
| Placeholder text           | `#475569` on `#0F172A`    | ~2.2:1      | FAIL  |

**Action items:**
- Your `text-slate-600` (`#475569`) used for thresholds, metadata, and placeholders fails WCAG AA. Upgrade to `text-slate-500` (`#64748B`) minimum for any text that conveys information (not purely decorative).
- Your `text-[10px]` uppercase labels at `text-slate-600` are doubly problematic: small size + low contrast. Upgrade these to `text-slate-500` at minimum.
- Consider `text-slate-500` (`#64748B`) as your minimum readable text color on dark backgrounds.

### 6.2 Color-Blind Safe Palette

**The problem**: 8% of men have some form of color vision deficiency. Red-green color blindness (deuteranopia/protanopia) is the most common, making your emerald/rose distinction invisible to ~5% of male users.

**Recommended approach** (do not rely on color alone):

1. **Pair colors with icons**: Your flag component already uses a warning icon. Extend this: use a checkmark icon for "Excellent", an arrow-up for "Good", a dash for "Adequate", and an X or down-arrow for "Weak".

2. **Use text labels consistently**: Your MetricCard already shows text labels ("Excellent", "Good", "Adequate", "Weak"). Ensure these are always visible, never hidden.

3. **Adjust the palette for maximum differentiation**:

| Status    | Primary       | Alt for CVD      | Icon            |
|-----------|---------------|------------------|-----------------|
| Excellent | `#10B981`     | Works -- high brightness | Checkmark  |
| Good      | `#14B8A6`     | Swap to `#06B6D4` (cyan) | Arrow-up  |
| Adequate  | `#F59E0B`     | Works -- high brightness | Minus/dash |
| Weak      | `#EF4444`     | Works -- distinguishable | X / alert  |

**Key change**: Replace teal-400 (`#2DD4BF`) for "Good" status with cyan-500 (`#06B6D4`). Teal and emerald are too close for deuteranopic users. Cyan provides better differentiation while maintaining the cool-positive semantic association.

4. **IBM's color-blind safe palette** as reference: `#648FFF`, `#785EF0`, `#DC267F`, `#FE6100`, `#FFB000`. These five colors are distinguishable across all common forms of color vision deficiency.

### 6.3 Minimum Font Size Rules

| Context                    | Minimum Size | Weight  | Notes                         |
|----------------------------|-------------|---------|-------------------------------|
| Body text                  | 14px        | 400     |                               |
| Table cells                | 13px        | 400     | 12px acceptable with Source Sans 3 |
| Labels and captions        | 11px        | 600     | Must be at least semibold     |
| Badges and tags            | 10px        | 700     | Bold compensates for size     |
| Micro labels (uppercase)   | 10px        | 600-700 | Tracking-wider helps          |
| Absolute minimum           | 9px         | 700     | Only for non-essential badges |

**Your current usage**: You use `text-[9px]` for some badge text (SOFR source badge, score circle badges). This is at the absolute minimum. Ensure these are always bold (700+) and have adequate contrast.

---

## 7. Prioritized UI Changes

### Priority 1: Quick Wins (1-2 hours each)

1. **Fix contrast failures**: Upgrade all informational `text-slate-600` instances to `text-slate-500`. This affects threshold text in MetricCards, metadata timestamps, and form labels. Estimated ~20 instances across components.

2. **Add `font-variant-numeric: tabular-nums`** to all financial value displays. Add a `.tabular-nums` utility class or apply it via the `font-mono` class override. This prevents layout shifts when values change.

3. **Neutral metric values**: Change metric card primary values from status-colored text (`text-emerald-400`, `text-rose-400`) to neutral `text-slate-100`, and move the color to the status badge only. This addresses the behavioral science finding about red distorting numerical processing.

4. **Add icons to status indicators**: Alongside the color status badges in MetricCards, add small icons (checkmark, arrow-up, minus, alert-triangle) so status is not communicated by color alone.

### Priority 2: Medium-Effort Improvements (half day each)

5. **Replace teal with cyan for "Good" status**: Change the "Good" status color from teal-400 to cyan-500 across all components for better color-blind differentiation.

6. **Collapse secondary sections by default**: Make Amortization Schedule, Industry Benchmarks, Sensitivity Chart, Scoring Weights, and Due Diligence Checklist collapsed by default with clear expand triggers. Keep Score, Metrics, Stress Test, and Recommendation always visible.

7. **Add comparison context to metric cards**: Show the industry median or target value inline. E.g., "1.82x" with a small "med: 1.45x" below it, giving the analyst an immediate benchmark anchor.

8. **Implement skeleton loading**: Replace the "Loading..." text spinner with skeleton screens for the initial auth/data load. Show card outlines with pulsing placeholder bars.

### Priority 3: Larger Improvements (1-2 days each)

9. **Reorder results layout**: Test moving the composite score gauge BELOW the individual metric cards (Metrics first, Score second) to reduce anchoring bias. This is the single most impactful behavioral change.

10. **Form section collapsibility**: Add collapsible section headers to the DealInputForm ("Borrower Profile", "Financial Data", "Equipment Details", "Deal Structure") with all sections open by default but individually collapsible.

11. **Pipeline board enhancements**: Add deal value aggregates per column, days-in-stage indicators, and velocity color coding to the kanban board.

12. **Data table density toggle**: Add a compact/comfortable density toggle to the Historical Deals table and Batch Screening results. Compact = 40px rows, Comfortable = 52px rows.

### Priority 4: Strategic Improvements (multi-day)

13. **Score transparency overlay**: Add a clickable "How was this scored?" overlay on the risk gauge that shows each factor's weight and contribution to the total score as a stacked horizontal bar.

14. **Session analytics ribbon**: Show a persistent bottom bar with "Deals screened today: N | Avg score: XX | Pass rate: YY%" to combat decision fatigue through context.

15. **Keyboard shortcuts**: Add Bloomberg-style keyboard shortcuts for power users: `Cmd+N` for new deal, `Cmd+S` to save, `Cmd+E` to export, number keys `1-5` to load example deals. Show a shortcut guide on `?` keypress.

16. **Theme customization**: Allow analysts to adjust contrast level (following Linear's approach) and choose between blue-tinted dark (current) and true dark (#0a0a0a base) themes.

---

## 8. Sources

### Color & Design Systems
- [Bloomberg Terminal Color Accessibility](https://www.bloomberg.com/ux/2021/10/14/designing-the-terminal-for-color-accessibility/)
- [Bloomberg Brand Colors on Mobbin](https://mobbin.com/colors/brand/bloomberg)
- [Bloomberg Color Palette](https://www.color-hex.com/color-palette/111776)
- [LSEG Refinitiv Element Framework (Halo Design System)](https://github.com/Refinitiv/refinitiv-ui)
- [Stripe Dark Mode Documentation](https://docs.stripe.com/connect/embedded-appearance-support-dark-mode)
- [Vercel Geist Design System Colors](https://vercel.com/geist/colors)
- [Geist Design System Introduction](https://vercel.com/geist/introduction)
- [Geist Colors npm Package](https://github.com/ephraimduncan/geist-colors)
- [Linear UI Redesign (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear Custom Themes](https://linear.app/changelog/2020-12-04-themes)
- [Linear Style Themes](https://linear.style/)
- [shadcn/ui Colors](https://ui.shadcn.com/colors)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/colors)

### Financial Dashboard Design
- [Best Color Palettes for Financial Dashboards -- Phoenix Strategy Group](https://www.phoenixstrategy.group/blog/best-color-palettes-for-financial-dashboards)
- [Color Theory in Finance Dashboard Design -- Extej Agency](https://medium.com/@extej/the-role-of-color-theory-in-finance-dashboard-design-d2942aec9fff)
- [Effective Dashboard Color Schemes -- insightsoftware](https://insightsoftware.com/blog/effective-color-schemes-for-analytics-dashboards/)
- [Dark UI Design Principles -- Toptal](https://www.toptal.com/designers/ui/dark-ui-design)
- [Dark Mode UI/UX Design Best Practices -- Inkbot Design](https://inkbotdesign.com/dark-mode/)
- [Fintech SaaS Landing Pages Design Patterns](https://designrevision.com/blog/fintech-saas-landing-pages)

### Typography & Data Display
- [Inter Font Complete Review & Guide](https://www.etienneaubertbonn.com/inter-font/)
- [Best Fonts for Dense Dashboards -- FontAlternatives](https://fontalternatives.com/blog/best-fonts-dense-dashboards/)
- [Best Fonts for Financial Reporting -- Inforiver](https://inforiver.com/blog/general/best-fonts-financial-reporting/)
- [Fonts for Data Visualization -- Datawrapper](https://www.datawrapper.de/blog/fonts-for-data-visualization)
- [Typography Basics for Data Dashboards -- Datafloq](https://datafloq.com/typography-basics-for-data-dashboards/)
- [Web Typography: Tables -- A List Apart](https://alistapart.com/article/web-typography-tables/)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/)

### Data Tables & Components
- [Enterprise Data Tables UX Patterns -- Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- [Data Table Design Best Practices -- UX Design World](https://uxdworld.com/data-table-design-best-practices/)
- [Guide to Designing Data Tables -- Figma / Medium](https://medium.com/design-with-figma/the-ultimate-guide-to-designing-data-tables-7db29713a85a)
- [Table Design UX -- Eleken](https://www.eleken.co/blog-posts/table-design-ux)
- [Gauge Chart UI Element -- UIKits](https://www.uinkits.com/components/gauge-chart-ui-element)
- [How to Use Gauge Elements in UI Design](https://www.uinkits.com/blog/how-to-use-gauge-elements-in-ui-design)
- [Form Design for Complex Applications -- Andrew Coyle](https://coyleandrew.medium.com/form-design-for-complex-applications-d8a1d025eba6)
- [How to Design UI Forms in 2026 -- IxDF](https://ixdf.org/literature/article/ui-form-design)

### Behavioral Science & Psychology
- [Color Red Influences Investor Behavior -- University of Kansas](https://business.ku.edu/news/article/2021/03/29/color-red-influences-investor-behavior-financial-research-reveals)
- [Visual Finance 101: Red Color -- SMU Cox School of Business](https://www.smu.edu/cox/coxtoday-magazine/2020-12-09-visual-finance-101)
- [Risky Business: How Colour Affects Investment -- RBC](https://www6.royalbank.com/en/di/hubs/ideas-and-motivation/article/seeing-red-the-colours-of-investing/jmlcpz14)
- [Color Psychology in Market Data Visualization -- Bookmap](https://bookmap.com/blog/the-role-of-color-psychology-in-market-data-visualization)
- [Progressive Disclosure -- NN/g](https://www.nngroup.com/articles/progressive-disclosure/)
- [Progressive Disclosure Examples -- Userpilot](https://userpilot.com/blog/progressive-disclosure-examples/)
- [Progressive Disclosure in SaaS UX -- Lollypop Design](https://lollypop.design/blog/2025/may/progressive-disclosure/)
- [Decision Frames: Cognitive Biases and UX -- NN/g](https://www.nngroup.com/articles/decision-framing-cognitive-bias-ux-pros/)
- [UI Density -- Matt Strom-Awn](https://mattstromawn.com/writing/ui-density/)
- [Bloomberg UX: Concealing Complexity](https://www.bloomberg.com/company/stories/how-bloomberg-terminal-ux-designers-conceal-complexity/)
- [Bloomberg Terminal -- Wikipedia](https://en.wikipedia.org/wiki/Bloomberg_Terminal)

### Trust & Credibility
- [FinTech UX Design Patterns for Trust -- Phenomenon Studio](https://phenomenonstudio.com/article/fintech-ux-design-patterns-that-build-trust-and-credibility/)
- [Building Trust Through Design for Financial Services -- Optimal Workshop](https://www.optimalworkshop.com/blog/building-trust-through-design-for-financial-services-ux)
- [Designing Trust in Finance & Insurance -- MindSing](https://www.mindsing.com/blog/design-experience/designing-trust-finance-insurance/)
- [Fintech UI Examples for Trust -- Eleken](https://www.eleken.co/blog-posts/trusted-fintech-ui-examples)

### Accessibility
- [WCAG Color Contrast Accessibility Guide 2025](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2.1 Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Color Contrast for Accessibility -- WebAbility](https://www.webability.io/blog/color-contrast-for-accessibility)
- [Color Blind Friendly Palettes -- Visme](https://visme.co/blog/color-blind-friendly-palette/)
- [Color Blind Friendly Palettes -- Venngage](https://venngage.com/blog/color-blind-friendly-palette/)
- [IBM Design Library Color Blind Safe Palette](https://www.color-hex.com/color-palette/1044488)
- [Coloring for Colorblindness -- David Math Logic](https://davidmathlogic.com/colorblind/)

### CRM & Pipeline Design
- [SaaS CRM Design Trends 2025 -- Eseospace](https://eseospace.com/blog/saas-crm-design-trends-for-2025/)
- [PipeDrive Finance CRM Design -- Ron Design Lab](https://rondesignlab.com/cases/pipedrive-finance-crm-ui-ux-design)
- [Kanban Board Sales Pipelines -- Pipeline CRM](https://pipelinecrm.com/blog/kanban-sales-pipelines/)
