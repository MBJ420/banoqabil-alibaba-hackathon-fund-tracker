import { useEffect, useState } from 'react';
import client from '../api/client';
import { Receipt, TrendingUp, Landmark, Download, Info, HelpCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '../components/Toast';
import FeatureInfoModal, { type FeatureGuideContent } from '../components/FeatureInfoModal';

const TAX_GUIDE: FeatureGuideContent = {
  title: 'Pakistan Capital Gains & Tax Optimizer',
  subtitle: 'Income Tax Ordinance 2001 (Updated per Finance Act 2024) • Section 37A & Section 63',
  badge: 'FBR Finance Act 2024 Compliance',
  overview: 'This optimizer accurately reflects current Pakistan Federal Board of Revenue (FBR) regulations under the Finance Act 2024. It models Section 37A Capital Gains Tax (CGT) on mutual fund redemptions, Section 37A(5) capital loss offsetting, and calculates authentic Section 63 tax credits for Voluntary Pension Schemes (VPS).',
  howToUse: [
    'Toggle your Taxpayer Status (Active Filer vs Non-Filer) — Non-Filers face an immediate 100% tax penalty (30% vs 15%).',
    'Review Realized Gains & Losses: Add redemption transactions. Capital losses legally offset capital gains within the same tax year (Section 37A(5)).',
    'Review Unrealized Portfolio Gains: View estimated tax withholding if you liquidate your current active holdings today.',
    'Calculate Section 63 VPS Rebate: Enter your taxable income and pension contribution (e.g. Meezan Tahaffuz Pension Fund) to see your direct income tax deduction using official FBR salary slabs.',
    'Export FBR Annexure: Download a formatted text statement for your annual tax return planning.'
  ],
  mathExplanation: [
    {
      formulaName: 'Section 37A Capital Gains Tax on Mutual Funds (Finance Act 2024)',
      formula: 'CGT = Net_Capital_Gain × (IsFiler ? 15% : 30%)',
      description: 'Under current FBR law, mutual fund redemptions are subject to a flat 15% withholding for Active Filers and 30% for Non-Filers. The legacy 12-month 0% exemption was abolished in recent Finance Acts.'
    },
    {
      formulaName: 'Section 37A(5) Capital Loss Offsetting',
      formula: 'Net_Capital_Gain = Max(0, Total_Gains - Total_Losses)',
      description: 'Capital losses incurred on mutual funds or listed securities in a tax year can legally offset capital gains realized in the same fiscal year (July 1 – June 30).'
    },
    {
      formulaName: 'Section 63 Voluntary Pension Scheme (VPS) Tax Credit',
      formula: 'Tax_Credit = (Tax_Liability / Taxable_Income) × Min(Contribution, Cap% × Taxable_Income)',
      description: 'A direct credit against your annual income tax for contributing to SECP-approved pension schemes (e.g. MTPF, HBL-IPF). Standard cap is 20% of taxable income (increasing up to 50% for individuals over age 40).'
    },
    {
      formulaName: 'Section 156A Retirement Exemption',
      formula: 'Tax_Free_Lump_Sum = 50% × Accumulated_Pension_Balance',
      description: 'Upon reaching retirement age (60–70), an investor can legally withdraw up to 50% of their accumulated pension balance completely tax-free.'
    }
  ],
  proTips: [
    'Active Filer (ATL) Status is Critical: Filers pay 15% on mutual fund gains; Non-Filers pay 30%. Being on the FBR Active Taxpayer List saves you 50% on all investment taxes.',
    'Tax Loss Harvesting Before June 30: If you have underperforming funds, realizing the loss before June 30 allows you to reduce your taxable capital gains on winning funds.',
    'Maximize Section 63 VPS: Investing in Meezan or HBL Islamic Pension Funds directly reduces your annual income tax bracket while growing your retirement nest egg tax-deferred.'
  ],
  disclaimer: 'Tax calculations are derived from the Income Tax Ordinance 2001 (Finance Act 2024) and are intended for estimation and planning. Actual tax withheld by Asset Management Companies (AMCs) depends on their official withholding certificates and your year-end FBR Iris declaration.'
};

// Current FBR Rates under Finance Act 2024
const CGT_FILER_RATE = 0.15; // 15% for Active Tax Filers
const CGT_NON_FILER_RATE = 0.30; // 30% for Non-Filers (100% punitive surcharge)

// Official FBR 2024-25 Salaried Tax Slabs (Finance Act 2024)
export const calculatePakistanSalaryTax = (income: number): number => {
  if (income <= 600_000) return 0;
  if (income <= 1_200_000) return (income - 600_000) * 0.05;
  if (income <= 2_200_000) return 30_000 + (income - 1_200_000) * 0.15;
  if (income <= 3_200_000) return 180_000 + (income - 2_200_000) * 0.25;
  if (income <= 4_100_000) return 430_000 + (income - 3_200_000) * 0.30;
  return 700_000 + (income - 4_100_000) * 0.35;
};

type Row = { id: number; name: string; cost: number; value: number };


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
    <p className={`mt-1 text-xl font-bold font-mono tabular-nums break-words ${tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-danger' : 'text-text-primary'}`}>{value}</p>
    {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
  </div>
);

let rowSeq = 1;

export default function TaxOptimizer() {
  const { toast } = useToast();

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isFiler, setIsFiler] = useState(true);

  // Realized transactions (both gains and loss harvesting)
  const [rows, setRows] = useState<Row[]>([
    { id: rowSeq++, name: 'Equity Fund Redemption (Gain)', cost: 100_000, value: 140_000 },
    { id: rowSeq++, name: 'Income Fund Redemption (Offsetting Loss)', cost: 60_000, value: 50_000 },
  ]);

  // Unrealized portfolio holdings (synced from active dashboard)
  const [unrealCost, setUnrealCost] = useState(500_000);
  const [unrealValue, setUnrealValue] = useState(620_000);

  // Section 63 VPS Pension
  const [taxableIncome, setTaxableIncome] = useState(1_800_000);
  const [vpsContribution, setVpsContribution] = useState(250_000);
  const [investorAge, setInvestorAge] = useState(35);

  useEffect(() => {
    client
      .get('/dashboard/summary')
      .then((r) => {
        const d = r.data || {};
        if (d.total_invested) setUnrealCost(Math.round(d.total_invested));
        if (d.total_net_worth) setUnrealValue(Math.round(d.total_net_worth));
      })
      .catch(() => toast('Could not load portfolio summary; using default baseline.', 'warning'));
  }, [toast]);

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Section 37A Capital Gain & Loss Calculations
  const grossRealizedGains = rows
    .filter((r) => r.value > r.cost)
    .reduce((s, r) => s + (r.value - r.cost), 0);

  const grossRealizedLosses = rows
    .filter((r) => r.cost > r.value)
    .reduce((s, r) => s + (r.cost - r.value), 0);

  // Section 37A(5) Loss Offsetting
  const netTaxableRealizedGain = Math.max(0, grossRealizedGains - grossRealizedLosses);
  const cgtRate = isFiler ? CGT_FILER_RATE : CGT_NON_FILER_RATE;
  const realizedCGT = netTaxableRealizedGain * cgtRate;
  const taxSavedByLossOffsetting = Math.min(grossRealizedGains, grossRealizedLosses) * cgtRate;
  const filerBenefit = netTaxableRealizedGain * (CGT_NON_FILER_RATE - CGT_FILER_RATE);

  // Unrealized Portfolio
  const unrealGain = Math.max(0, unrealValue - unrealCost);
  const unrealizedCGT = unrealGain * cgtRate;

  // Section 63 VPS Pension Tax Rebate
  // Cap is 20% + 2% per year above age 40, max 50%
  const ageBonusPct = investorAge > 40 ? Math.min(0.30, (investorAge - 40) * 0.02) : 0;
  const vpsCapPct = 0.20 + ageBonusPct;
  const maxEligibleVpsContribution = taxableIncome * vpsCapPct;
  const eligibleVpsContribution = Math.min(vpsContribution, maxEligibleVpsContribution);

  const baselineSalaryTax = calculatePakistanSalaryTax(taxableIncome);
  const averageTaxRate = taxableIncome > 0 ? baselineSalaryTax / taxableIncome : 0;
  const vpsTaxRebate = isFiler ? eligibleVpsContribution * averageTaxRate : 0;
  const netSalaryTaxAfterVps = Math.max(0, baselineSalaryTax - vpsTaxRebate);

  const downloadAnnexure = () => {
    const lines = [
      '========================================================================',
      '   FBR CAPITAL GAINS & SECTION 63 VPS TAX REPORT (FINANCE ACT 2024)',
      '   Pakistan Mutual Fund Wealth Management Platform',
      '========================================================================',
      `Date Generated        : ${new Date().toLocaleDateString('en-GB')}`,
      `Taxpayer Status       : ${isFiler ? 'Active Taxpayer (ATL Filer)' : 'Non-Filer (Subject to 100% Surcharge)'}`,
      `FBR Applicable CGT    : ${fmtPct(cgtRate)}`,
      '',
      '------------------------------------------------------------------------',
      '1. SECTION 37A REALIZED CAPITAL GAINS & LOSS HARVESTING',
      '------------------------------------------------------------------------',
      ...rows.map((r) => {
        const diff = r.value - r.cost;
        return `- ${r.name}: Cost ${fmtPKR(r.cost)}, Sale ${fmtPKR(r.value)} -> ${diff >= 0 ? 'Gain ' + fmtPKR(diff) : 'Loss ' + fmtPKR(Math.abs(diff))}`;
      }),
      '',
      `Gross Realized Gains   : ${fmtPKR(grossRealizedGains)}`,
      `Gross Realized Losses  : ${fmtPKR(grossRealizedLosses)}`,
      `Loss Set-Off (Sec 37A) : -${fmtPKR(Math.min(grossRealizedGains, grossRealizedLosses))}`,
      `Net Taxable Gain       : ${fmtPKR(netTaxableRealizedGain)}`,
      `Realized CGT Payable   : ${fmtPKR(realizedCGT)}`,
      `Tax Saved via Offsets  : ${fmtPKR(taxSavedByLossOffsetting)}`,
      `Filer ATL Tax Savings  : ${fmtPKR(filerBenefit)} (Saved vs Non-Filer rate)`,
      '',
      '------------------------------------------------------------------------',
      '2. UNREALIZED HOLDINGS (ESTIMATED TAX IF REDEEMED TODAY)',
      '------------------------------------------------------------------------',
      `Current Cost Basis     : ${fmtPKR(unrealCost)}`,
      `Current Market Value   : ${fmtPKR(unrealValue)}`,
      `Unrealized Gain        : ${fmtPKR(unrealGain)}`,
      `Estimated CGT at Exit  : ${fmtPKR(unrealizedCGT)} (${fmtPct(cgtRate)})`,
      `Net Liquidation Value  : ${fmtPKR(unrealValue - unrealizedCGT)}`,
      '',
      '------------------------------------------------------------------------',
      '3. SECTION 63 VOLUNTARY PENSION SCHEME (VPS) TAX REBATE',
      '------------------------------------------------------------------------',
      `Annual Taxable Income  : ${fmtPKR(taxableIncome)}`,
      `Investor Age           : ${investorAge} years (VPS Cap: ${(vpsCapPct * 100).toFixed(0)}%)`,
      `VPS Contribution Paid  : ${fmtPKR(vpsContribution)} (SECP Pension Funds)`,
      `FBR Annual Salary Tax  : ${fmtPKR(baselineSalaryTax)}`,
      `Average Tax Rate       : ${fmtPct(averageTaxRate)}`,
      `Direct VPS Tax Rebate  : -${fmtPKR(vpsTaxRebate)}`,
      `Net Annual Income Tax  : ${fmtPKR(netSalaryTaxAfterVps)}`,
      '',
      '------------------------------------------------------------------------',
      'STATUTORY COMPLIANCE NOTICE:',
      '- Rates conform to First Schedule Division VII and Section 63 of Income Tax Ordinance 2001.',
      '- Note: Holding mutual funds beyond 12 months does NOT grant a 0% exemption under Finance Act 2024.',
      '- Section 156A: Upon retirement age (60+), 50% of accumulated VPS pension funds are 100% TAX FREE.',
      '========================================================================',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FBR-Tax-Report-2024-${isFiler ? 'Filer' : 'NonFiler'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('FBR Tax Report downloaded successfully.', 'success');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <FeatureInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        content={TAX_GUIDE}
      />
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center shadow-emerald-500/20 shrink-0">
              <Receipt className="text-white w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-text-primary">Capital Gains & Tax Optimizer</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  FBR Finance Act 2024 Code
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                Accurate Pakistan FBR mutual fund taxation: 15% Filer CGT, loss offsetting, and Section 63 pension rebates.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInfoOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-[var(--color-white-10)] hover:border-emerald-500/50 text-xs font-semibold text-text-secondary hover:text-emerald-400 transition-all shadow-sm shrink-0 cursor-pointer"
            title="Learn how Pakistani mutual fund tax law works"
          >
            <HelpCircle size={15} className="text-emerald-400" />
            <span>FBR Tax Law Guide</span>
          </button>
        </div>

        {/* Filer Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface border border-[var(--color-white-5)] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-primary">FBR Taxpayer Status:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setIsFiler(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isFiler
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                    : 'bg-[var(--color-white-5)] text-text-secondary border-[var(--color-white-10)] hover:border-white/30'
                }`}
              >
                Active Filer (15% CGT)
              </button>
              <button
                onClick={() => setIsFiler(false)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  !isFiler
                    ? 'bg-danger/20 text-danger border-danger/40 shadow-sm'
                    : 'bg-[var(--color-white-5)] text-text-secondary border-[var(--color-white-10)] hover:border-white/30'
                }`}
              >
                Non-Filer (30% CGT)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium">
            {isFiler ? (
              <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                <ShieldCheck size={14} /> Filer Advantage: 50% Tax Reduction Applied
              </span>
            ) : (
              <span className="text-danger flex items-center gap-1.5 bg-danger/10 px-3 py-1 rounded-lg border border-danger/20">
                <AlertCircle size={14} /> 100% Non-Filer Punitive Tax Surcharge Enforced
              </span>
            )}
          </div>
        </div>

        {/* Section 1: Realized Gains & Loss Offsetting */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                <h3 className="text-lg font-bold">Realized Capital Gains & Loss Harvesting</h3>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Under FBR Section 37A(5), capital losses in a fiscal year legally offset capital gains to lower your tax liability.
              </p>
            </div>
            <button
              onClick={() =>
                setRows((rs) => [
                  ...rs,
                  { id: rowSeq++, name: 'Fund Redemption', cost: 100_000, value: 120_000 },
                ])
              }
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shrink-0"
            >
              + Add Transaction
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((r) => {
              const diff = r.value - r.cost;
              const isProfit = diff >= 0;
              return (
                <div key={r.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-xl bg-[var(--color-white-2)] border border-[var(--color-white-5)]">
                  <div className="md:col-span-5">
                    <span className="text-xs font-medium text-text-secondary">Fund / Transaction Name</span>
                    <input
                      value={r.name}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      className="mt-1 w-full bg-transparent px-3 py-2 text-sm text-text-primary outline-none border border-[var(--color-white-10)] rounded-xl focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Cost (PKR)" value={r.cost} onChange={(v) => updateRow(r.id, { cost: v })} suffix="PKR" step={5000} />
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Sale Value (PKR)" value={r.value} onChange={(v) => updateRow(r.id, { value: v })} suffix="PKR" step={5000} />
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-text-secondary">Net Gain / (Loss)</p>
                    <p className={`mt-2 text-sm font-bold font-mono tabular-nums ${isProfit ? 'text-emerald-400' : 'text-danger'}`}>
                      {isProfit ? '+' : ''}{fmtPKR(diff)}
                    </p>
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                      className="p-2 text-xs text-text-secondary hover:text-danger rounded-lg transition-colors cursor-pointer"
                      title="Remove transaction"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Realized Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <Stat label="Gross Gains" value={fmtPKR(grossRealizedGains)} tone="good" />
            <Stat label="Losses Harvested" value={fmtPKR(grossRealizedLosses)} sub="Offsets Gains (Sec 37A)" tone={grossRealizedLosses > 0 ? 'good' : 'default'} />
            <Stat label="Net Taxable Gain" value={fmtPKR(netTaxableRealizedGain)} />
            <Stat
              label={`CGT Payable (${fmtPct(cgtRate)})`}
              value={fmtPKR(realizedCGT)}
              sub={isFiler ? `Saved ${fmtPKR(filerBenefit)} vs Non-Filer` : 'Double tax penalty applies'}
              tone={realizedCGT > 0 ? 'bad' : 'good'}
            />
          </div>
        </section>

        {/* Section 2: Unrealized Portfolio Exit Simulation */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Landmark size={18} className="text-emerald-400" />
              <h3 className="text-lg font-bold">Unrealized Portfolio Gains (Liquidation Simulation)</h3>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Estimated tax withheld if you redeem your active mutual fund portfolio today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Portfolio Cost Basis" value={unrealCost} onChange={setUnrealCost} suffix="PKR" step={25000} />
            <Field label="Current Market Value" value={unrealValue} onChange={setUnrealValue} suffix="PKR" step={25000} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Unrealized Profit" value={fmtPKR(unrealGain)} tone="good" />
            <Stat
              label={`Estimated CGT at Exit (${fmtPct(cgtRate)})`}
              value={fmtPKR(unrealizedCGT)}
              tone={unrealizedCGT > 0 ? 'bad' : 'good'}
              sub={isFiler ? 'Flat 15% under Finance Act 2024' : '30% Non-Filer rate'}
            />
            <Stat label="Net After-Tax Proceeds" value={fmtPKR(unrealValue - unrealizedCGT)} />
          </div>

          <div className="flex items-start gap-2 text-xs text-text-secondary bg-[var(--color-white-2)] border border-[var(--color-white-5)] rounded-xl p-3">
            <Info size={14} className="mt-0.5 text-emerald-400 shrink-0" />
            <p>
              <strong>FBR Statutory Notice:</strong> Under Finance Act 2024, holding mutual funds beyond 12 months no longer exempts gains from CGT. Both short-term and long-term redemptions are subject to 15% withholding for Filers.
            </p>
          </div>
        </section>

        {/* Section 3: Section 63 VPS Pension Tax Credit */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-emerald-400" />
              <h3 className="text-lg font-bold">Section 63 Voluntary Pension Scheme (VPS) Tax Credit</h3>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Genuine Pakistani tax deduction: Contributing to SECP-approved pension schemes (e.g. Meezan Tahaffuz Pension Fund - MTPF, HBL Islamic Pension Fund) directly reduces your annual income tax.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Annual Taxable Income" value={taxableIncome} onChange={setTaxableIncome} suffix="PKR" step={50000} />
            <Field label="Annual VPS Contribution" value={vpsContribution} onChange={setVpsContribution} suffix="PKR" step={10000} />
            <Field label="Investor Age (Years)" value={investorAge} onChange={setInvestorAge} suffix="yrs" step={1} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Stat label="Salary Tax (FBR Slabs)" value={fmtPKR(baselineSalaryTax)} sub={`Avg Rate: ${fmtPct(averageTaxRate)}`} />
            <Stat label="Max VPS Allowed" value={fmtPKR(maxEligibleVpsContribution)} sub={`Cap: ${(vpsCapPct * 100).toFixed(0)}% of income`} />
            <Stat label="Direct Tax Rebate" value={fmtPKR(vpsTaxRebate)} tone="good" sub="Subtracted from income tax" />
            <Stat label="Net Annual Tax Payable" value={fmtPKR(netSalaryTaxAfterVps)} tone={netSalaryTaxAfterVps > 0 ? 'bad' : 'good'} />
          </div>

          <div className="flex items-start gap-2 text-xs text-text-secondary bg-[var(--color-white-2)] border border-[var(--color-white-5)] rounded-xl p-3">
            <ShieldCheck size={14} className="mt-0.5 text-emerald-400 shrink-0" />
            <p>
              <strong>Section 156A Retirement Benefit:</strong> When you reach retirement age (60–70), up to <strong>50% of your accumulated VPS balance is 100% tax-free</strong> upon withdrawal.
            </p>
          </div>
        </section>

        {/* Action Button & Disclaimer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            onClick={downloadAnnexure}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-md shadow-emerald-900/30 cursor-pointer"
          >
            <Download size={16} /> Download FBR Tax Annexure (.txt)
          </button>

          <span className="text-xs text-text-secondary">
            Compliant with FBR Income Tax Ordinance 2001 (Finance Act 2024).
          </span>
        </div>
      </div>
    </div>
  );
}

