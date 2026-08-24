// Consolidates the chaotic rainbow of news/category tag colors into four
// meaningful semantic families for a clean, editorial layout:
//   emerald  — monetary policy & Islamic finance
//   indigo   — PSX equities & capital markets
//   amber    — commodities & precious metals
//   rose     — inflation & macroeconomic risk
// Unknown tags fall back to a neutral slate pill.

type TagFamily = 'emerald' | 'indigo' | 'amber' | 'rose' | 'neutral';

const PILL =
  'px-2.5 py-1 rounded-full text-[11px] font-medium border';

const FAMILY_CLASS: Record<TagFamily, string> = {
  emerald: `bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ${PILL}`,
  indigo: `bg-indigo-500/10 text-indigo-400 border-indigo-500/20 ${PILL}`,
  amber: `bg-amber-500/10 text-amber-400 border-amber-500/20 ${PILL}`,
  rose: `bg-rose-500/10 text-rose-400 border-rose-500/20 ${PILL}`,
  neutral: `bg-white/5 text-slate-300 border-white/10 ${PILL}`,
};

const EMERALD_KW = [
  'monetary', 'policy', 'interest', 'sbp', 'islamic', 'shariah', 'riba',
  'profit', 'dividend', 'imf', 'cpec', 'mufap', 'money market', 'bank',
  'finance', 'fiscal', 'budget', 'tax', 'pakistan',
];
const INDIGO_KW = [
  'psx', 'kse', 'stock', 'equit', 'share', 'bourse', 'capital', 'market',
  'index', 'sehk', 'broker', 'mutual fund', 'fund',
];
const AMBER_KW = [
  'gold', 'silver', 'oil', 'commodit', 'metal', 'crude', 'platinum',
  'petroleum', 'gas', 'wheat', 'sugar',
];
const ROSE_KW = [
  'inflation', 'cpi', 'macro', 'deficit', 'geopolit', 'sanction', 'forex',
  'rupee', 'risk', 'recession', 'gdp', 'trade', 'tariff',
];

export function semanticTagClass(tag: string): string {
  const t = (tag || '').toLowerCase();
  const matches = (kw: string[]) => kw.some((k) => t.includes(k));
  if (matches(EMERALD_KW)) return FAMILY_CLASS.emerald;
  if (matches(INDIGO_KW)) return FAMILY_CLASS.indigo;
  if (matches(AMBER_KW)) return FAMILY_CLASS.amber;
  if (matches(ROSE_KW)) return FAMILY_CLASS.rose;
  return FAMILY_CLASS.neutral;
}
