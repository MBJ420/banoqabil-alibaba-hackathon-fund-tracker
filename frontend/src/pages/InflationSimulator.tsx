import { useEffect, useState } from 'react';
import client from '../api/client';
import { PiggyBank, TrendingUp, ShieldCheck, Target, Info } from 'lucide-react';
import { useToast } from '../components/Toast';

// Representative State Bank of Pakistan CPI history (annual %, illustrative
// averages). Real SBP figures vary by source; these convey the ordering of
// Pakistan's inflation regime for the simulator.
const CPI_HISTORY: { year: number; cpi: number }[] = [
  { year: 2015, cpi: 4.5 },
  { year: 2016, cpi: 2.9 },
  { year: 2017, cpi: 3.9 },
  { year: 2018, cpi: 5.2 },
  { year: 2019, cpi: 6.8 },
  { year: 2020, cpi: 8.6 },
  { year: 2021, cpi: 9.5 },
  { year: 2022, cpi: 12.2 },
  { year: 2023, cpi: 29.0 },
  { year: 2024, cpi: 23.4 },
];
const AVG_CPI = CPI_HISTORY.reduce((s, d) => s + d.cpi, 0) / CPI_HISTORY.length;
const RECENT_AVG_CPI =
  CPI_HISTORY.slice(-5).reduce((s, d) => s + d.cpi, 0) / 5;

const fmtPKR = (n: number) =>
  `PKR ${(Math.round(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const lumpGrowth = (pv: number, annual: number, years: number) =>
  pv * Math.pow(1 + annual / 100, years);

const sipFutureValue = (monthly: number, annual: number, years: number) => {
  const r = annual / 100 / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
};

const inflate = (nominal: number, inflation: number, years: number) =>
  nominal / Math.pow(1 + inflation / 100, years);

const GOALS = [
  { label: 'Hajj Pilgrimage', amount: 1_200_000 },
  { label: 'Child Education', amount: 8_000_000 },
  { label: 'Retirement', amount: 20_000_000 },
];

const Field = ({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-medium text-text-secondary">{label}</span>
    <div className="flex items-center rounded-xl bg-[var(--color-white-5)] border border-[var(--color-white-10)] focus-within:border-emerald-500/50 transition-colors">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-transparent px-3 py-2.5 text-sm font-mono tabular-nums text-text-primary outline-none"
      />
      {suffix && <span className="pr-3 text-xs text-text-secondary">{suffix}</span>}
    </div>
  </label>
);

const Stat = ({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'bad';
}) => (
  <div className="bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-xl p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
    <p
      className={`mt-1 text-xl font-bold font-mono tabular-nums ${
        tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-danger' : 'text-text-primary'
      }`}
    >
      {value}
    </p>
    {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
  </div>
);

export default function InflationSimulator() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [currentValue, setCurrentValue] = useState(500_000);
  const [expReturn, setExpReturn] = useState(12);
  const [inflation, setInflation] = useState(Number(RECENT_AVG_CPI.toFixed(1)));
  const [horizon, setHorizon] = useState(10);

  const [sipMonthly, setSipMonthly] = useState(10_000);
  const [sipYears, setSipYears] = useState(15);
  const [goal, setGoal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/dashboard/summary')
      .then((r) => {
        if (cancelled) return;
        const d = r.data || {};
        if (d.total_net_worth) setCurrentValue(Math.round(d.total_net_worth));
        if (d.total_invested && d.total_gain_loss) {
          const r2 = (d.total_gain_loss / d.total_invested) * 100;
          if (Number.isFinite(r2) && d.total_invested > 0) setExpReturn(Math.round(r2 * 10) / 10);
        }
      })
      .catch(() => {
        if (!cancelled) toast('Could not load portfolio summary; using sample values.', 'warning');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const nominalFV = lumpGrowth(currentValue, expReturn, horizon);
  const realFV = inflate(nominalFV, inflation, horizon);
  const annualRealReturn = (Math.pow(1 + expReturn / 100, 1) / Math.pow(1 + inflation / 100, 1) - 1) * 100;

  const sipNominal = sipFutureValue(sipMonthly, expReturn, sipYears);
  const sipReal = inflate(sipNominal, inflation, sipYears);

  const beating = annualRealReturn > 0;
  const goalMet = goal != null && sipNominal >= goal;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-amber-500/20">
              <PiggyBank className="text-white w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">Inflation Hedge & SIP Simulator</h2>
              <p className="text-sm text-text-secondary">
                See whether your investments preserve purchasing power and plan disciplined wealth building.
              </p>
            </div>
          </div>
        </div>

        {/* Inflation vs Investment */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-emerald-400" />
            <h3 className="text-lg font-bold">Inflation vs Investment</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Field label="Current Portfolio" value={currentValue} onChange={setCurrentValue} suffix="PKR" step={10000} />
            <Field label="Expected Return" value={expReturn} onChange={setExpReturn} suffix="% / yr" step={0.5} />
            <Field label="Inflation (CPI)" value={inflation} onChange={setInflation} suffix="% / yr" step={0.5} />
            <Field label="Horizon" value={horizon} onChange={setHorizon} suffix="years" step={1} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label={`Nominal in ${horizon}y`} value={fmtPKR(nominalFV)} sub="Before inflation" />
            <Stat
              label={`Real Value in ${horizon}y`}
              value={fmtPKR(realFV)}
              sub={`≈ ${fmtPKR(realFV / 100000)} Crore`}
              tone={realFV >= currentValue ? 'good' : 'bad'}
            />
            <Stat
              label="Real Return / yr"
              value={(annualRealReturn >= 0 ? '+' : '') + fmtPct(annualRealReturn)}
              sub={beating ? 'Beating inflation' : 'Losing to inflation'}
              tone={beating ? 'good' : 'bad'}
            />
          </div>
        </section>

        {/* Goal-Based SIP Planner */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Target size={18} className="text-emerald-400" />
            <h3 className="text-lg font-bold">Goal-Based SIP Planner</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <Field label="Monthly SIP" value={sipMonthly} onChange={setSipMonthly} suffix="PKR" step={1000} />
            <Field label="SIP Duration" value={sipYears} onChange={setSipYears} suffix="years" step={1} />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Life Goal Target</span>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.label}
                    onClick={() => setGoal(goal === g.amount ? null : g.amount)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      goal === g.amount
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-[var(--color-white-5)] text-text-secondary border-[var(--color-white-10)] hover:border-white/30'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
                {goal != null && (
                  <button
                    onClick={() => setGoal(null)}
                    className="px-3 py-2 rounded-xl text-xs text-text-secondary underline hover:text-text-primary"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
          {goal != null && (
            <p className="text-sm text-text-secondary mb-4">
              Target: <span className="font-mono text-text-primary">{fmtPKR(goal)}</span> —{' '}
              {goalMet ? (
                <span className="text-emerald-400 font-semibold">your plan meets this goal ✓</span>
              ) : (
                <span className="text-warning font-semibold">short by {fmtPKR(goal - sipNominal)} nominal</span>
              )}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Stat label={`Projected SIP Value (${sipYears}y)`} value={fmtPKR(sipNominal)} sub="Nominal" tone="good" />
            <Stat label="Real (Inflation-Adj.)" value={fmtPKR(sipReal)} sub={`≈ ${fmtPKR(sipReal / 100000)} Crore`} />
          </div>
        </section>

        {/* Inflation-Beating Scorecard */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h3 className="text-lg font-bold">Inflation-Beating Scorecard</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              className={`rounded-xl p-4 border ${
                beating ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-danger/10 border-danger/20'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Wealth Preservation</p>
              <p className={`mt-1 text-lg font-bold ${beating ? 'text-emerald-400' : 'text-danger'}`}>
                {beating ? 'PASS' : 'AT RISK'}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Real return {beating ? 'positive' : 'negative'} vs CPI {fmtPct(inflation)}.
              </p>
            </div>
            <div
              className={`rounded-xl p-4 border ${
                beating ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-danger/10 border-danger/20'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Purchasing Power</p>
              <p className={`mt-1 text-lg font-bold ${realFV >= currentValue ? 'text-emerald-400' : 'text-danger'}`}>
                {realFV >= currentValue ? 'GROWING' : 'ERODING'}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Real value {fmtPKR(realFV)} vs {fmtPKR(currentValue)} today.
              </p>
            </div>
            <div className="rounded-xl p-4 border border-[var(--color-white-10)] bg-[var(--color-white-5)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Verdict</p>
              <p className={`mt-1 text-lg font-bold ${beating ? 'text-emerald-400' : 'text-warning'}`}>
                {beating ? 'Hedged' : 'Not Hedged'}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                {beating
                  ? 'Holdings outpace inflation — wealth is preserved.'
                  : 'Consider higher-return or inflation-indexed assets.'}
              </p>
            </div>
          </div>
        </section>

        {/* CPI context */}
        <section className="rounded-2xl border border-[var(--color-white-5)] bg-[var(--color-white-5)] p-5">
          <div className="flex items-start gap-2 text-xs text-text-secondary">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Inflation assumption defaults to Pakistan's recent 5-year average CPI of {fmtPct(RECENT_AVG_CPI)} (10-yr avg{' '}
              {fmtPct(AVG_CPI)}). Adjust it to model different regimes. Historical context:
              {CPI_HISTORY.slice(-5).map((d) => (
                <span key={d.year} className="ml-1.5 font-mono">
                  {d.year}:{d.cpi}%
                </span>
              ))}
            </p>
          </div>
        </section>

        {loading && (
          <p className="text-center text-xs text-text-secondary">Loading portfolio summary…</p>
        )}
      </div>
    </div>
  );
}
