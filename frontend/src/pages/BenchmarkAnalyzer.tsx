import { useEffect, useState } from 'react';
import client from '../api/client';
import { LineChart, TrendingUp, Scale, BadgeCheck, Info } from 'lucide-react';
import { useToast } from '../components/Toast';

// Illustrative benchmark cumulative returns (no live feed; static sample).
const BENCHMARKS: Record<string, Record<string, number>> = {
  'KSE-100': { '1m': 0.021, '6m': 0.123, '1y': 0.285, '3y': 0.71 },
  'KMI-30': { '1m': 0.018, '6m': 0.141, '1y': 0.312, '3y': 0.79 },
};
const PERIODS = ['1m', '6m', '1y', '3y'] as const;
const RISK_FREE = 0.12; // approx Pakistan risk-free
const BENCH_VOL: Record<string, number> = { 'KSE-100': 0.18, 'KMI-30': 0.21 };

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const Field = ({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-medium text-text-secondary">{label}</span>
    <div className="flex items-center rounded-xl bg-[var(--color-white-5)] border border-[var(--color-white-10)] focus-within:border-emerald-500/50 transition-colors">
      <input
        type="number"
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-transparent px-3 py-2.5 text-sm font-mono tabular-nums text-text-primary outline-none"
      />
      {suffix && <span className="pr-3 text-xs text-text-secondary">{suffix}</span>}
    </div>
  </label>
);

export default function BenchmarkAnalyzer() {
  const { toast } = useToast();
  const [expenseRatio, setExpenseRatio] = useState(2.5);
  const [portfolio, setPortfolio] = useState<Record<string, number>>({ '1m': 1.8, '6m': 14.2, '1y': 31.5, '3y': 82.0 });

  useEffect(() => {
    client
      .get('/dashboard/summary')
      .then((r) => {
        const d = r.data || {};
        if (d.total_gain_loss_pct) {
          const annual = (d.total_gain_loss_pct as number) / 100;
          setPortfolio((p) => ({ ...p, '1y': Math.round(annual * 1000) / 10 }));
        }
      })
      .catch(() => toast('Could not load portfolio summary; using sample returns.', 'warning'));
  }, [toast]);

  const sharpe = (ret: number, vol: number) => (ret / 100 - RISK_FREE) / vol;

  const rows = PERIODS.map((period) => {
    const benchRet = BENCHMARKS['KSE-100'][period] * 100;
    const portRet = portfolio[period];
    const alpha = portRet - benchRet;
    const netAlpha = alpha - expenseRatio;
    return { period, benchRet, portRet, alpha, netAlpha };
  });

  const avgNetAlpha = rows.reduce((s, r) => s + r.netAlpha, 0) / rows.length;
  const valueBadge =
    avgNetAlpha > 0
      ? { label: 'Great Value', tone: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' }
      : avgNetAlpha > -expenseRatio
        ? { label: 'Fair Value', tone: 'text-amber-400 border-amber-500/30 bg-amber-500/10' }
        : { label: 'Overpriced', tone: 'text-danger border-[var(--color-danger-30,#f8717133)] bg-danger/10' };

  const maxRet = Math.max(...rows.flatMap((r) => [r.benchRet, r.portRet, 0]));

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center shadow-sky-500/20">
            <LineChart className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">Benchmark Alpha & Fee Analyzer</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                KSE-100 Baseline • Simulation
              </span>
            </div>
            <p className="text-sm text-text-secondary">Compare your fund's returns against KSE-100 / KMI-30 and quantify fee drag.</p>
          </div>
        </div>

        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Field label="Fund Expense Ratio (TER)" value={expenseRatio} onChange={setExpenseRatio} suffix="%" />
            </div>
            {PERIODS.map((p) => (
              <div key={p}>
                <Field label={`Your Return (${p})`} value={portfolio[p]} onChange={(v) => setPortfolio((s) => ({ ...s, [p]: v }))} suffix="%" />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-sky-400" />
            <h3 className="text-lg font-bold">Performance vs Benchmark (KSE-100)</h3>
          </div>

          {/* Bar chart */}
          <div className="space-y-4 mb-6">
            {rows.map((r) => (
              <div key={r.period}>
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <span className="font-semibold">{r.period}</span>
                  <span>α {r.alpha >= 0 ? '+' : ''}{r.alpha.toFixed(1)}% · net {r.netAlpha >= 0 ? '+' : ''}{r.netAlpha.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-[10px] text-text-secondary">Fund</span>
                  <div className="flex-1 h-3 bg-[var(--color-white-5)] rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500" style={{ width: `${Math.max(0, (r.portRet / maxRet) * 100)}%` }} />
                  </div>
                  <span className="w-14 text-right text-xs font-mono text-text-primary">{fmtPct(r.portRet / 100)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-16 text-[10px] text-text-secondary">KSE-100</span>
                  <div className="flex-1 h-3 bg-[var(--color-white-5)] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, (r.benchRet / maxRet) * 100)}%` }} />
                  </div>
                  <span className="w-14 text-right text-xs font-mono text-text-primary">{fmtPct(r.benchRet / 100)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary text-xs uppercase tracking-wider">
                  <th className="text-left py-2">Period</th>
                  <th className="text-right py-2">Your Fund</th>
                  <th className="text-right py-2">KSE-100</th>
                  <th className="text-right py-2">Alpha</th>
                  <th className="text-right py-2">Net of Fees</th>
                  <th className="text-right py-2">Sharpe</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period} className="border-t border-[var(--color-white-5)]">
                    <td className="py-2 font-medium">{r.period}</td>
                    <td className="py-2 text-right font-mono">{fmtPct(r.portRet / 100)}</td>
                    <td className="py-2 text-right font-mono">{fmtPct(r.benchRet / 100)}</td>
                    <td className={`py-2 text-right font-mono ${r.alpha >= 0 ? 'text-emerald-400' : 'text-danger'}`}>{r.alpha >= 0 ? '+' : ''}{r.alpha.toFixed(1)}%</td>
                    <td className={`py-2 text-right font-mono ${r.netAlpha >= 0 ? 'text-emerald-400' : 'text-danger'}`}>{r.netAlpha >= 0 ? '+' : ''}{r.netAlpha.toFixed(1)}%</td>
                    <td className="py-2 text-right font-mono">{sharpe(r.portRet, BENCH_VOL['KSE-100']).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-5">
            <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">
              <Scale size={14} /> Value for Money
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border ${valueBadge.tone}`}>
              <BadgeCheck size={14} /> {valueBadge.label}
            </span>
          </div>
          <div className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Avg Net Alpha</p>
            <p className={`mt-1 text-xl font-bold font-mono ${avgNetAlpha >= 0 ? 'text-emerald-400' : 'text-danger'}`}>{avgNetAlpha >= 0 ? '+' : ''}{avgNetAlpha.toFixed(1)}%</p>
            <p className="text-xs text-text-secondary mt-0.5">After {expenseRatio}% annual fee drag</p>
          </div>
          <div className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Fee Drag (3y)</p>
            <p className="mt-1 text-xl font-bold font-mono text-danger">-{expenseRatio * 3}%</p>
            <p className="text-xs text-text-secondary mt-0.5">Cumulative TER impact vs benchmark</p>
          </div>
        </section>

        <div className="rounded-2xl border border-[var(--color-white-5)] bg-[var(--color-white-5)] p-5">
          <div className="flex items-start gap-2 text-xs text-text-secondary">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Benchmark returns (KSE-100 / KMI-30) are static illustrative samples, not a live MUFAP feed. Alpha is your
              return minus the benchmark; "net of fees" subtracts the fund's expense ratio (TER). Sharpe uses an assumed
              12% risk-free rate and benchmark volatility. Connect a daily index feed to productionize.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
