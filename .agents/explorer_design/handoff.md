# Visual Design & UI Quality Audit Report: Pakistan Fund Tracker
**Agent D (Visual Design & UI Quality Assessor) — Hackathon Readiness Audit**
**Date**: 2026-08-22  
**Target Codebase**: `frontend/src/` (`Dashboard.tsx`, `News.tsx`, `AINews.tsx`, `PortfolioSuggestions.tsx`, `Login.tsx`, `Register.tsx`, `index.css`, `App.css`, `index.html`)

---

## 1. Observation

A direct static inspection of the frontend codebase (`frontend/src/` and configuration files) revealed multiple concrete design flaws, vibecoded artifacts, leftover AI prompts, theme inconsistencies, and missed opportunities for Pakistani fintech branding:

### 1.1 Verbatim Code Observations & Vibecoded Artifacts

| File & Line | Code Observation | Direct Issue |
|---|---|---|
| `frontend/src/App.css:1-43` | `#root { max-width: 1280px; ... } .logo { ... } @keyframes logo-spin ...` | 100% untouched default Vite starter boilerplate left in repository. |
| `frontend/index.html:5-7` | `<link rel="icon" type="image/svg+xml" href="/vite.svg" /> <title>Fund Tracker</title>` | Default Vite icon and generic title shown in browser tab/Electron titlebar. No web fonts imported. |
| `frontend/src/index.css:20` | `--color-neon-purple: #10B981; /* Shifted to Emerald for consistency with photos */` | Prompt drift artifact where AI generated purple UI tokens and patched it with an alias rather than refactoring design tokens. |
| `frontend/src/index.css:106-107` | `@media print { div[class*="bg-surface"] { background-color: #121223 !important; } }` | Hardcoded dark purple (`#121223`) print style left over from generic template. |
| `Dashboard.tsx:813, 869, 1071, 1146` | `<button ...><Zap size={16} className="rotate-45" /> {/* Close Icon Approximation */}</button>` | **Four separate modals** use a 45-degree rotated lightning bolt (`Zap`) with an explicit code comment admitting it is a crude fake close icon because AI did not import `X`. |
| `AINews.tsx:423` | `<Zap size={13} className="rotate-45" />` | Rotated `Zap` used as a delete/close icon for World Context items. |
| `Dashboard.tsx:1034` | `<div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>` | Hardcoded purple glow (`rgba(139,92,246,0.5)`) on an emerald green bar in the expanded fund row. |
| `Dashboard.tsx:831-842` | `border border-accent-pink/20 ... text-accent-pink` | Zakat liability calculation modal styled in neon hot pink, visually dissonant with Islamic financial conventions. |
| `Dashboard.tsx:908-921` | `<option value="" className="bg-[#1a1625] text-white py-2">` | Hardcoded dark purple dropdown option backgrounds that break in Light mode. |
| `Dashboard.tsx:927, 1032` | `className="bg-black/20 ..."` & `className="bg-black/40 ..."` | Hardcoded black transparencies that create dark dirty patches when switching to Light theme. |
| `PortfolioSuggestions.tsx:166, 209` | `bg-black/20` and `bg-black/30` | Hardcoded dark overlays causing poor contrast in Light theme. |
| `PortfolioSuggestions.tsx:97, 123, 153, 176, 195` | `text-neon-purple`, `bg-neon-purple`, `border-neon-purple/30` | Lingering purple color tokens spread across suggestions page. |
| `Dashboard.tsx:754-758` | Hardcoded mock history: `{ date: '2023-11-24', bank: 'Meezan Bank', ... }` | Static fake 2023 transactions displayed under "Recent Portfolio Updates" rather than dynamic statement logs. |
| `Dashboard.tsx:1251-1262` | `const KPICard = ({ title, value, subtitle }: any) => ...` | 4 identical gray box cards with zero visual hierarchy, no delta badges, and no sparkline cues. |
| `Dashboard.tsx:636` | `fill={['#3B82F6', '#10B981', '#F59E0B', '#FFFFFF', '#8B5CF6', '#EF4444'][index % 6]}` | Asset allocation pie chart uses pure `#FFFFFF` as slice 4, making it invisible in Light mode. |
| `News.tsx:34-53` | 18 disparate tag colors (`bg-indigo-500`, `bg-rose-500`, `bg-cyan-500`, `bg-sky-500`, etc.) | Uncurated rainbow palette creating visual noise and clutter. |
| `AINews.tsx:42-45` | `ASSET_ICONS = { 'PSX Stocks': '📈', Gold: '🪙', Silver: '🥈', 'Money Market': '💵', 'Income Funds': '🏦' }` | Raw system emojis that render inconsistently across Windows, Mac, and Linux platforms. |

---

## 2. Logic Chain

1. **Premise 1: Hackathon Competitive Context**:
   In the Bano Qabil x Alibaba Cloud Hackathon (Financial Inclusion track), almost every team will use LLMs (Claude, GPT, Gemini) to generate frontend code. Generic AI prompts invariably produce identical dashboards: pitch-black `#0B0B0B` background, a single blurry circular background glow, identical rounded cards with `border-white/10`, and random neon green/purple highlights.
2. **Premise 2: First-Impression Evaluation**:
   Judges evaluate UI quality within the first 15 seconds of a demo. Obvious AI hallmarks—such as rotated `Zap` lightning bolts acting as close buttons (`Dashboard.tsx:813`), default Vite favicons (`index.html`), neon pink Zakat boxes (`Dashboard.tsx:831`), and unstyled Light Mode bugs—signal carelessness and a lack of authentic craftsmanship.
3. **Premise 3: Domain Relevance (Pakistani Wealth & Mutual Funds)**:
   Pakistani mutual fund investors and financial institutions (Meezan Bank, HBL Asset Management, Atlas, Faysal, CDC, MUFAP) operate in a prestigious, trust-driven domain. The design must project institutional credibility:
   - **Emerald Green (`#006644` / `#059669`) & Hilal Gold (`#D97706` / `#F59E0B`)** reflect national and Islamic financial prosperity.
   - **Shariah compliance indicators** are essential, as Islamic funds represent >60% of mutual fund AUM in Pakistan.
   - **Pakistani denomination context (Lacs / Crores alongside PKR Millions)** provides immediate cognitive clarity for local users.
   - **High-contrast financial data tables** with `tabular-nums` alignment ensure professional readability.
4. **Inference & Strategy**:
   By fixing design token fragmentation, replacing amateurish AI shortcuts with production-grade components, and injecting a distinct Pakistani sovereign wealth aesthetic, the app will instantly stand out from generic AI-generated submissions and earn top marks for UI polish and local domain relevance.

---

## 3. Caveats

- **Scope Limit**: This audit is restricted to frontend visual design, component architecture, CSS tokens, and user experience styling. Backend API schemas and database models are assumed functional.
- **Tailwind Version**: The project uses modern Tailwind CSS v4 (`@tailwindcss/postcss: ^4.2.0`) with `@theme` blocks in `src/index.css`. All proposed CSS variables must conform to Tailwind v4 CSS variable integration.
- **Performance Budget**: Enhancements must rely on lightweight CSS gradients, SVG icons, and existing dependencies (`lucide-react`, `recharts`, `react-apexcharts`, `framer-motion`) without bloating bundle size.

---

## 4. Conclusion & Component-Level Action Plan

The UI assessment identifies three main pillars of improvement:
1. **Design System & Theme Unification** (eliminating prompt drift, fixing light/dark theme variables, loading proper typography).
2. **Elimination of Vibecoded Shortcuts** (fixing fake icons, Vite boilerplate, hardcoded mock data, and broken modals).
3. **Pakistani-Finance Visual Identity** (Hero Net Worth card with Crore/Lac tooltips, Shariah badges, bank branding, dignified Islamic Zakat UI, institutional table layouts).

Below are the concrete, high-impact component-level code specifications ready for immediate developer implementation.

---

### Actionable Component Refactoring Specifications

#### 1. Brand Tokens & Typography System (`frontend/src/index.css` & `frontend/index.html`)

**File**: `frontend/index.html`  
Add Google Fonts (`Plus Jakarta Sans` for headings, `Inter` for body, `JetBrains Mono` for financial figures):
```html
<!-- Replace line 5-7 in index.html -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
<title>FundTracker Pakistan — Mutual Fund & Wealth Intelligence</title>
```

**File**: `frontend/src/index.css`  
Replace lines 1–55 with a clean, cohesive Pakistani-Finance token architecture:
```css
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Plus Jakarta Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Pakistani Sovereign Theme Palette */
  --color-pakistan-green: #006644;
  --color-emerald-primary: #059669;
  --color-emerald-light: #10B981;
  --color-gold-accent: #D97706;
  --color-gold-light: #F59E0B;
  --color-shariah-teal: #0D9488;

  /* Semantic Theme Tokens */
  --color-midnight: var(--theme-midnight);
  --color-surface: var(--theme-surface);
  --color-surface-elevated: var(--theme-surface-elevated);
  --color-surface-highlight: var(--theme-highlight);
  --color-border-subtle: var(--theme-border-subtle);
  --color-border-hover: var(--theme-border-hover);
  --color-text-primary: var(--theme-text-primary);
  --color-text-secondary: var(--theme-text-secondary);
  --color-text-muted: var(--theme-text-muted);

  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #F43F5E;
}

@layer base {
  :root {
    /* Institutional Dark Slate (Deep Nocturne with subtle emerald tint) */
    --theme-midnight: #0A0F14;
    --theme-surface: #111822;
    --theme-surface-elevated: #16202E;
    --theme-highlight: #1E2B3D;
    --theme-border-subtle: rgba(255, 255, 255, 0.08);
    --theme-border-hover: rgba(16, 185, 129, 0.35);
    --theme-text-primary: #F8FAFC;
    --theme-text-secondary: #94A3B8;
    --theme-text-muted: #64748B;
  }

  .light {
    /* Ivory Pearl Light Mode */
    --theme-midnight: #F6F8FA;
    --theme-surface: #FFFFFF;
    --theme-surface-elevated: #F1F5F9;
    --theme-highlight: #E2E8F0;
    --theme-border-subtle: rgba(0, 0, 0, 0.08);
    --theme-border-hover: rgba(5, 150, 105, 0.4);
    --theme-text-primary: #0F172A;
    --theme-text-secondary: #475569;
    --theme-text-muted: #94A3B8;
  }

  body {
    @apply bg-midnight text-text-primary antialiased font-sans;
    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  }
}
```

---

#### 2. Hero KPI Cards & Visual Hierarchy Overhaul (`Dashboard.tsx:505-523`)

**Problem**: Four identical plain gray cards where "Net Worth" looks no different from "Top Performer".  
**Enhancement**: Create an asymmetric Hero Net Worth card that commands visual authority, formats numbers with Crore/Lac indicators, and displays clean trend badges.

```tsx
// Proposed Component Replacement in Dashboard.tsx
function PortfolioKPIGrid({ summary }: { summary: any }) {
  const netWorth = summary?.total_net_worth || 0;
  const invested = summary?.total_invested || 0;
  const gainLoss = summary?.total_gain_loss || 0;
  const gainPercent = invested > 0 ? (gainLoss / invested) * 100 : 0;
  const isPositive = gainLoss >= 0;

  // Pakistani Denomination Formatter (Lacs / Crores)
  const formatPakistaniDenomination = (num: number) => {
    if (num >= 10000000) return `(${(num / 10000000).toFixed(2)} Crore PKR)`;
    if (num >= 100000) return `(${(num / 100000).toFixed(2)} Lac PKR)`;
    return '';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Hero Card: Net Worth (Spans 2 columns on tablet/desktop) */}
      <div className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-emerald-950/40 via-surface to-surface border border-emerald-500/30 rounded-2xl p-6 shadow-xl shadow-emerald-950/20 group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total Net Worth</span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">Consolidated portfolio valuation</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full">
            Live MUFAP NAV
          </span>
        </div>

        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono text-text-muted">PKR</span>
            <span className="text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-white">
              {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-xs font-medium text-emerald-400/80 mt-1 font-mono">
            {formatPakistaniDenomination(netWorth)}
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary">Total Invested:</span>
            <span className="font-mono font-semibold text-text-primary">PKR {invested.toLocaleString()}</span>
          </div>
          <div className={`flex items-center gap-1 font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>
            {isPositive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
            <span>{isPositive ? '+' : ''}{gainPercent.toFixed(2)}% ROI</span>
          </div>
        </div>
      </div>

      {/* Card 2: Total Unrealized Gain/Loss */}
      <div className="bg-surface border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between transition-all">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Unrealized Gain / Loss</span>
          <div className="mt-3">
            <span className="text-xs font-mono text-text-muted">PKR</span>
            <p className={`text-2xl font-bold font-mono tracking-tight mt-0.5 ${isPositive ? 'text-success' : 'text-danger'}`}>
              {isPositive ? '+' : ''}{gainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-text-secondary">
          <span>Overall Return</span>
          <span className={`px-2 py-0.5 rounded font-mono font-bold ${isPositive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {isPositive ? '+' : ''}{gainPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Card 3: Top Performer with Bank Badging */}
      <div className="bg-surface border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between transition-all">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Top Institution</span>
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold rounded-md">
              BEST ROI
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xl font-bold text-text-primary tracking-tight">
              {summary?.top_performing_bank || 'Meezan Bank'}
            </p>
            <p className="text-xs text-text-secondary mt-1">Leading fund asset manager</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-text-muted">
          <span>Asset Class</span>
          <span className="text-emerald-400 font-medium">Islamic Income / Equity</span>
        </div>
      </div>
    </div>
  );
}
```

---

#### 3. Islamic Zakat Calculator Refactor (`Dashboard.tsx:804-859`)

**Problem**: Uses jarring hot pink styling (`text-accent-pink`, `border-accent-pink/20`), fake rotated `Zap` close icon, and lacks Islamic financial context (Nisab threshold, Lunar year basis).  
**Enhancement**: Redesign into a dignified Islamic wealth purification module with gold/emerald accents, Nisab guide, and clean `<X />` dismiss button.

```tsx
// Dignified Islamic Zakat Modal Component
import { Calculator, X, ShieldCheck, Info } from 'lucide-react';

function ZakatCalculatorModal({ isOpen, onClose, netWorth }: { isOpen: boolean; onClose: () => void; netWorth: number }) {
  if (!isOpen) return null;

  // Approximate Silver Nisab (52.5 Tola of Silver ~ PKR 145,000 as of 2026)
  const silverNisabPKR = 145000;
  const isNisabEligible = netWorth >= silverNisabPKR;
  const zakatPayable = isNisabEligible ? netWorth * 0.025 : 0;
  const postZakatNetWorth = netWorth - zakatPayable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-emerald-500/30 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden">
        {/* Subtle Islamic Gold/Emerald Accent Header Glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Proper Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-text-secondary hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Calculator size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Zakat Calculator</h2>
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold rounded-md">
                2.5% LUNAR
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">Shariah-compliant annual wealth purification estimate</p>
          </div>
        </div>

        {/* Nisab Status Card */}
        <div className="mb-4 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
          <ShieldCheck size={16} className="shrink-0 text-emerald-400" />
          <span>
            {isNisabEligible 
              ? `Portfolio exceeds Silver Nisab (~PKR ${silverNisabPKR.toLocaleString()}). Zakat is applicable.`
              : `Portfolio is below Nisab threshold. No Zakat due.`}
          </span>
        </div>

        <div className="space-y-3">
          <div className="p-4 bg-white/5 rounded-xl flex justify-between items-center">
            <span className="text-xs text-text-secondary">Zakatable Net Worth</span>
            <span className="font-mono font-bold text-sm text-text-primary">
              PKR {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold text-amber-400">Zakat Due (2.5%)</span>
              <p className="text-[10px] text-text-muted mt-0.5">Calculated on eligible holdings</p>
            </div>
            <span className="font-mono font-bold text-base text-amber-400">
              - PKR {zakatPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-between items-center">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Post-Zakat Wealth</span>
            <span className="font-mono font-bold text-xl text-emerald-400">
              PKR {postZakatNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="mt-5 p-3 bg-white/3 rounded-xl flex items-start gap-2 text-[11px] text-text-muted">
          <Info size={14} className="shrink-0 mt-0.5 text-text-secondary" />
          <p>
            For equity funds, mutual fund companies (e.g. Meezan, Al-Ameen) calculate Zakat on the fund's non-exempt net assets. Consult your fund manager report for exact per-unit deduction.
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

#### 4. Branded Pakistani Institution Sidebar & Nav (`Dashboard.tsx:311-381`)

**Problem**: Meezan, HBL, Atlas, and Faysal are styled with identical generic `Building2` icons and plain gray text.  
**Enhancement**: Give each institution its distinct visual identity chip and subtitle:

```tsx
// Pakistani Institution Navigation Items with Identity Badges
const INSTITUTIONS = [
  { id: 'Meezan', name: 'Meezan Bank', sub: 'Islamic Pioneer', color: 'border-l-emerald-500 text-emerald-400' },
  { id: 'HBL', name: 'HBL Funds', sub: 'Asset Management', color: 'border-l-teal-500 text-teal-400' },
  { id: 'Atlas', name: 'Atlas Funds', sub: 'Mutual Funds Ltd', color: 'border-l-blue-500 text-blue-400' },
  { id: 'Faysal', name: 'Faysal Funds', sub: 'Islamic Financial', color: 'border-l-amber-500 text-amber-400' },
];

{INSTITUTIONS.map(inst => (
  <button
    key={inst.id}
    onClick={() => { setSelectedBank(inst.id); navigate('/'); }}
    className={`w-full flex items-center justify-between p-2.5 rounded-xl border-l-2 transition-all group ${
      selectedBank === inst.id && currentPage === '/'
        ? 'bg-emerald-500/10 border-emerald-400 text-white font-semibold shadow-sm'
        : 'border-transparent text-text-secondary hover:bg-white/5 hover:text-white'
    }`}
  >
    <div className="flex items-center gap-2.5 text-left">
      <div className={`w-2 h-2 rounded-full ${selectedBank === inst.id ? 'bg-emerald-400' : 'bg-white/20 group-hover:bg-white/40'}`} />
      <div>
        <p className="text-sm font-semibold leading-tight">{inst.name}</p>
        <p className="text-[10px] text-text-muted">{inst.sub}</p>
      </div>
    </div>
    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-text-muted transition-opacity" />
  </button>
))}
```

---

#### 5. Shariah & Risk Badge Component (`Dashboard.tsx`, `PortfolioSuggestions.tsx`)

**Problem**: Funds have plain string badges like "Equity" or "High" with no distinct Shariah indicator.  
**Enhancement**: Add a standardized financial badge component:

```tsx
// Shariah and Financial Category Tag Component
export function ShariahBadge({ fundName, fundType }: { fundName: string; fundType?: string }) {
  const isShariah = 
    fundName.toLowerCase().includes('islamic') || 
    fundName.toLowerCase().includes('meezan') || 
    fundName.toLowerCase().includes('al-ameen') ||
    fundName.toLowerCase().includes('faysal islamic') ||
    fundName.toLowerCase().includes('shariah');

  return isShariah ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md">
      <span>🌙</span>
      <span>Shariah Compliant</span>
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 bg-white/5 border border-white/10 text-text-muted text-[10px] font-medium rounded-md">
      Conventional
    </span>
  );
}
```

---

#### 6. AI Asset Glyph & News Header Refactor (`AINews.tsx:40-45` & `News.tsx:34-53`)

**Problem**: Raw system emojis render inconsistently across OS environments; 18 rainbow tag colors in `News.tsx` cause visual clutter.  
**Enhancement**: Replace emojis with Lucide financial vector glyphs and consolidate tag pill styles into 4 semantic color families.

```tsx
// Consolidated Tag Color Palette for News.tsx
const TAG_FAMILIES: Record<string, string> = {
  // Islamic & Monetary Policy (Emerald / Green)
  'SBP': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Money Market': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Pakistan': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Rupee': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',

  // Capital Markets & Stocks (Blue / Indigo)
  'PSX': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Equity': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'MUFAP': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Forex': 'bg-sky-500/10 text-sky-400 border-sky-500/20',

  // Commodities & Gold (Gold / Amber)
  'Gold': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Silver': 'bg-slate-400/10 text-slate-300 border-slate-400/20',
  'Commodities': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Oil': 'bg-orange-500/10 text-orange-400 border-orange-500/20',

  // Macro & Risk Factors (Rose / Red)
  'Inflation': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Interest Rate': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Geopolitical': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'IMF': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};
```

---

## 5. Verification Method

To independently verify these UI and visual design improvements:

1. **Vite Clean Build & Lint Verification**:
   ```bash
   cd frontend
   npm run build
   ```
   Ensures no missing imports, broken JSX tags, or TypeScript errors.

2. **Visual Inspection Checklist**:
   - [ ] Check `index.html` titlebar in Electron/Browser: Verify custom title and no default Vite icon.
   - [ ] Check modal close buttons: Confirm all 4 modals (`Zakat Calc`, `Fund Performance`, `Statement Details`, `PDF Passwords`) display a crisp `<X />` icon without rotated `Zap` icons.
   - [ ] Toggle Light/Dark mode (`Sun`/`Moon` button): Confirm that dropdown options (`Dashboard.tsx:908`), expanded table rows, and suggestion cards remain 100% legible without black muddy boxes or invisible white text.
   - [ ] Inspect Hero KPI Net Worth card: Confirm presence of Crore/Lac subtitle, font-mono tabular digits, and distinct visual prominence over secondary cards.
   - [ ] Check Zakat modal: Confirm gold/emerald styling with Nisab calculation instead of hot pink.
   - [ ] Verify Asset Allocation chart in Light mode: Confirm slice colors do not contain pure `#FFFFFF`.

3. **Invalidation Conditions**:
   - If any page reverts to hardcoded `#1a1625` or `#0B0B0B` instead of CSS theme variables.
   - If `Zap` rotated icon is reintroduced anywhere as an approximation of a close icon.
