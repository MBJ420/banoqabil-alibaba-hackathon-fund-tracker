import { useEffect, useState } from 'react';
import client from '../api/client';
import { Receipt, TrendingUp, Landmark, Download, Info, HelpCircle } from 'lucide-react';
import { useToast } from '../components/Toast';
import FeatureInfoModal, { type FeatureGuideContent } from '../components/FeatureInfoModal';

const TAX_GUIDE: FeatureGuideContent = {
  title: 'Capital Gains & Tax Optimizer',
  subtitle: 'FBR Section 37A Capital Gains Tax & Section 63 VPS Pension Tax Rebates in Pakistan',
  badge: 'FBR Tax Law Model',
  overview: 'This optimizer estimates your Pakistan Federal Board of Revenue (FBR) capital gains tax liability on mutual fund redemptions, reveals the tax-saving power of holding funds beyond 12 months, and calculates your Section 63 tax rebate when investing in Voluntary Pension Schemes (VPS).',
  howToUse: [
    'Toggle your Taxpayer Status (Active Filer vs Non-Filer) — Non-Filers incur a 100% tax surcharge (30% vs 15%).',
    'Review Realized Gains: Add or edit redeemed fund transactions with Cost Price, Sale Price, and Holding Period (months).',
    'Review Unrealized Holdings: Shows what you would owe if you liquidated today, and warns you if holding a few more weeks eliminates your tax.',
    'Enter your Annual Taxable Income & VPS Contribution to see your instant Section 63 direct tax rebate.',
    'Click "Download FBR Annexure" to export an organized text report of your calculations.'
  ],
  mathExplanation: [
    {
      formulaName: 'Section 37A Capital Gains Tax (Holding Period Tiering)',
      formula: 'CGT = (Months >= 12) ? 0% : (IsFiler ? Gain × 15% : Gain × 30%)',
      description: 'Under Pakistan tax law, long-term capital gains on listed securities held for 12 months or longer are exempt from CGT.'
    },
    {
      formulaName: 'Section 63 Voluntary Pension Scheme (VPS) Tax Credit',
      formula: 'VPS_Credit = Min(20% × Contribution, 20% × Taxable_Income, PKR 200,000)',
      description: 'A direct credit against your total tax liability for investing in SECP-registered pension funds (e.g. Meezan Tahaffuz Pension Fund).'
    },
    {
      formulaName: 'Net Effective Tax Payable',
      formula: 'Net_Tax = Max(0, Realized_CGT - VPS_Rebate)',
      description: 'Your final capital gains tax liability after subtracting your claimable VPS pension rebate.'
    }
  ],
  proTips: [
    'Tax Timing Optimization: If you have held a mutual fund for 10 or 11 months with large profits, waiting just 1–2 months to cross the 12-month mark saves you 15% to 30% in taxes completely legally!',
    'Active Filer status is essential: Non-filers pay double the tax rate on mutual fund gains and dividend distributions.'
  ],
  disclaimer: 'Tax calculations are for estimation and planning purposes per FBR Section 37A and 63. Real tax deductions depend on Asset Management Company withholding tax (WHT) certificates and your annual wealth statement filing.'
};

// Illustrative Pakistan CGT model (Income Tax Ordinance, Section 37A).
// Listed-security long-term gains (>12 months) are exempt; short-term gains
// are taxed, with non-filers facing an additional surcharge. Verify against
// current FBR rates before production use.
const SHORT_TERM_FILER = 0.15;
const NON_FILER_SURCHARGE = 0.15;
const VPS_REBATE_RATE = 0.2;
const VPS_REBATE_CAP = 200_000;

type Row = { id: number; name: string; cost: number; value: number; months: number };

const cgtFor = (gain: number, months: number, isFiler: boolean) => {
  if (gain <= 0) return 0;
  if (months >= 12) return 0; // long-term listed securities exempt
  const rate = isFiler ? SHORT_TERM_FILER : SHORT_TERM_FILER + NON_FILER_SURCHARGE;
  return gain * rate;
};

const fmtPKR = (n: number) =>
  `PKR ${(Math.round(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const Field = ({
  label,
  value,
  onChange,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-medium text-text-secondary">{label}</span>
    <div className="flex items-center rounded-xl bg-[var(--color-white-5)] border border-[var(--color-white-10)] focus-within:border-emerald-500/50 transition-colors">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-transparent px-3 py-2.5 text-sm font-mono tabular-nums text-text-primary outline-none"
      />
      {suffix && <span className="pr-3 text-xs text-text-secondary">{suffix}</span>}
    </div>
  </label>
);

const Stat = ({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'good' | 'bad' }) => (
  <div className="bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-xl p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
    <p className={`mt-1 text-xl font-bold font-mono tabular-nums ${tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-danger' : 'text-text-primary'}`}>{value}</p>
    {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
  </div>
);

let rowSeq = 1;

export default function TaxOptimizer() {
  const { toast } = useToast();

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isFiler, setIsFiler] = useState(true);
  const [rows, setRows] = useState<Row[]>([{ id: rowSeq++, name: 'Equity Fund Sale', cost: 100_000, value: 140_000, months: 8 }]);

  const [unrealCost, setUnrealCost] = useState(500_000);
  const [unrealValue, setUnrealValue] = useState(620_000);
  const [unrealMonths, setUnrealMonths] = useState(18);

  const [taxableIncome, setTaxableIncome] = useState(1_500_000);
  const [vpsContribution, setVpsContribution] = useState(200_000);

  useEffect(() => {
    client
      .get('/dashboard/summary')
      .then((r) => {
        const d = r.data || {};
        if (d.total_invested) setUnrealCost(Math.round(d.total_invested));
        if (d.total_invested && d.total_gain_loss) setUnrealValue(Math.round(d.total_invested + d.total_gain_loss));
      })
      .catch(() => toast('Could not load portfolio summary; using sample values.', 'warning'));
  }, [toast]);

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const realizedGain = rows.reduce((s, r) => s + (r.value - r.cost), 0);
  const realizedCGT = rows.reduce((s, r) => s + cgtFor(r.value - r.cost, r.months, isFiler), 0);

  const unrealGain = unrealValue - unrealCost;
  const unrealizedCGT = cgtFor(unrealGain, unrealMonths, isFiler);

  const vpsRebate = Math.min(VPS_REBATE_RATE * vpsContribution, VPS_REBATE_RATE * taxableIncome, VPS_REBATE_CAP);
  const effectiveTaxBefore = realizedCGT;
  const effectiveTaxAfter = Math.max(0, realizedCGT - vpsRebate);

  const downloadAnnexure = () => {
    const lines = [
      'FBR CAPITAL GAINS & VPS REBATE ANNEXURE (ILLUSTRATIVE)',
      '========================================================',
      `Taxpayer status      : ${isFiler ? 'Active Filer' : 'Non-Filer'}`,
      '',
      'REALIZED CAPITAL GAINS',
      ...rows.map(
        (r) =>
          `- ${r.name}: cost ${fmtPKR(r.cost)}, value ${fmtPKR(r.value)}, held ${r.months}mo, CGT ${fmtPKR(cgtFor(r.value - r.cost, r.months, isFiler))}`
      ),
      `Total realized gain  : ${fmtPKR(realizedGain)}`,
      `Total realized CGT   : ${fmtPKR(realizedCGT)}`,
      '',
      'UNREALIZED (if liquidated today)',
      `Unrealized gain      : ${fmtPKR(unrealGain)}`,
      `Potential CGT        : ${fmtPKR(unrealizedCGT)}`,
      '',
      'VPS TAX REBATE (SECTION 63)',
      `Taxable income       : ${fmtPKR(taxableIncome)}`,
      `VPS contribution     : ${fmtPKR(vpsContribution)}`,
      `Rebate claimable     : ${fmtPKR(vpsRebate)}`,
      '',
      `NET CGT AFTER REBATE : ${fmtPKR(effectiveTaxAfter)}`,
      '',
      'NOTE: Rates are illustrative per Section 37A / 63. Verify with current FBR rules.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tax-annexure.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <FeatureInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        content={TAX_GUIDE}
      />
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center shadow-emerald-500/20 shrink-0">
              <Receipt className="text-white w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-text-primary">Capital Gains & Tax Optimizer</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  FBR Sec 37A/63 Model • Simulation
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                Model Pakistan CGT by holding period and filer status, and quantify VPS tax rebates.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInfoOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-[var(--color-white-10)] hover:border-emerald-500/50 text-xs font-semibold text-text-secondary hover:text-emerald-400 transition-all shadow-sm shrink-0"
            title="Learn how this feature works"
          >
            <HelpCircle size={15} className="text-emerald-400" />
            <span>How it Works & Guide</span>
          </button>
        </div>

        {/* Filer status */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">Taxpayer status:</span>
          {[
            { label: 'Active Filer', val: true },
            { label: 'Non-Filer', val: false },
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => setIsFiler(o.val)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                isFiler === o.val
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-[var(--color-white-5)] text-text-secondary border-[var(--color-white-10)] hover:border-white/30'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Realized gains */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-400" />
              <h3 className="text-lg font-bold">Realized Capital Gains</h3>
            </div>
            <button
              onClick={() => setRows((rs) => [...rs, { id: rowSeq++, name: 'New Sale', cost: 0, value: 0, months: 6 }])}
              className="px-3 py-1.5 rounded-xl text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              + Add Sale
            </button>
          </div>
          <div className="space-y-3">
            {rows.map((r) => {
              const gain = r.value - r.cost;
              const tax = cgtFor(gain, r.months, isFiler);
              return (
                <div key={r.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <Field label="Asset" value={0} onChange={() => {}} />
                    <input
                      value={r.name}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      className="mt-1 w-full bg-transparent px-3 py-2 text-sm text-text-primary outline-none border border-[var(--color-white-10)] rounded-xl"
                    />
                  </div>
                  <div className="md:col-span-2"><Field label="Cost" value={r.cost} onChange={(v) => updateRow(r.id, { cost: v })} suffix="PKR" step={1000} /></div>
                  <div className="md:col-span-2"><Field label="Value" value={r.value} onChange={(v) => updateRow(r.id, { value: v })} suffix="PKR" step={1000} /></div>
                  <div className="md:col-span-2"><Field label="Held (mo)" value={r.months} onChange={(v) => updateRow(r.id, { months: v })} suffix="mo" /></div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-text-secondary">CGT</p>
                    <p className={`mt-2 text-sm font-bold font-mono tabular-nums ${tax > 0 ? 'text-danger' : 'text-emerald-400'}`}>{fmtPKR(tax)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <Stat label="Realized Gain" value={fmtPKR(realizedGain)} />
            <Stat label="Realized CGT" value={fmtPKR(realizedCGT)} tone={realizedCGT > 0 ? 'bad' : 'good'} />
            <Stat label="Effective Rate" value={realizedGain > 0 ? fmtPct(realizedCGT / realizedGain) : '0%'} />
          </div>
        </section>

        {/* Unrealized */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Landmark size={18} className="text-emerald-400" />
            <h3 className="text-lg font-bold">Unrealized Gains (if liquidated)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <Field label="Cost Basis" value={unrealCost} onChange={setUnrealCost} suffix="PKR" step={1000} />
            <Field label="Current Value" value={unrealValue} onChange={setUnrealValue} suffix="PKR" step={1000} />
            <Field label="Holding Period" value={unrealMonths} onChange={setUnrealMonths} suffix="months" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Unrealized Gain" value={fmtPKR(unrealGain)} />
            <Stat label="Potential CGT" value={fmtPKR(unrealizedCGT)} tone={unrealizedCGT > 0 ? 'bad' : 'good'} sub={unrealMonths >= 12 ? 'Long-term exempt' : 'Short-term taxed'} />
            <Stat label="After-Tax Value" value={fmtPKR(unrealValue - unrealizedCGT)} />
          </div>
        </section>

        {/* VPS rebate */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Download size={18} className="text-emerald-400" />
            <h3 className="text-lg font-bold">VPS Tax Rebate Calculator (Section 63)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Field label="Annual Taxable Income" value={taxableIncome} onChange={setTaxableIncome} suffix="PKR" step={50000} />
            <Field label="Annual VPS Contribution" value={vpsContribution} onChange={setVpsContribution} suffix="PKR" step={10000} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Rebate Claimable" value={fmtPKR(vpsRebate)} sub={`Max ${fmtPKR(VPS_REBATE_CAP)}`} tone="good" />
            <Stat label="CGT Before Rebate" value={fmtPKR(effectiveTaxBefore)} tone={effectiveTaxBefore > 0 ? 'bad' : 'good'} />
            <Stat label="CGT After Rebate" value={fmtPKR(effectiveTaxAfter)} tone={effectiveTaxAfter > 0 ? 'bad' : 'good'} />
          </div>
        </section>

        <button
          onClick={downloadAnnexure}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-emerald-500/10"
        >
          <Download size={16} /> Download Tax Annexure
        </button>

        <div className="rounded-2xl border border-[var(--color-white-5)] bg-[var(--color-white-5)] p-5">
          <div className="flex items-start gap-2 text-xs text-text-secondary">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              Capital gains tax rates and VPS rebate limits are illustrative (Section 37A / 63). Long-term listed-security
              gains (&gt;12 months) are treated as exempt; non-filers incur an additional surcharge. Verify all figures
              against current FBR regulations before filing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
