import { useEffect, useState } from 'react';
import client from '../api/client';
import { Receipt, TrendingUp, Landmark, Download, Info, HelpCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '../components/Toast';
import FeatureInfoModal, { type FeatureGuideContent } from '../components/FeatureInfoModal';

const TAX_GUIDE: FeatureGuideContent = {
  title: 'How Mutual Fund Tax Works in Pakistan',
  subtitle: 'Simple explanation of FBR tax rules for Pakistani investors (Finance Act 2024)',
  badge: 'FBR Tax Guide 2024-25',
  overview: 'In Pakistan, mutual funds are taxed on profits only. This tool helps you understand: (1) what tax you owe on your profits, (2) how losses save you money, and (3) how putting money in a retirement pension fund cuts your salary income tax.',
  howToUse: [
    'Choose Filer or Non-Filer: Filers pay 15% tax on profits. Non-Filers are penalized with double tax (30%).',
    'Withdrawn Funds (Profit & Loss): Enter funds you sold. If you made a loss on one fund, it cancels out your profit from another so you pay less tax overall.',
    'Cash Out Calculator: See how much cash actually lands in your bank account after tax if you withdraw your current funds today.',
    'Pension Tax Discount: If you invest in an approved Pension Fund (like Meezan Tahaffuz Pension Fund), see how much money you save on your annual salary tax.',
    'Download Tax Summary: Get a clean document to hand to your tax filer / accountant or keep for your records.'
  ],
  mathExplanation: [
    {
      formulaName: 'Tax is Only on Profit (Not Your Original Money)',
      formula: 'Tax = Profit × (Filer: 15% | Non-Filer: 30%)',
      description: 'You only pay tax on the profit you earned, never on your original investment. For example, if you put in Rs 100,000 and it grew to Rs 120,000, tax is charged only on the Rs 20,000 profit.'
    },
    {
      formulaName: 'Losses Cancel Out Profits (Tax Loss Offsetting)',
      formula: 'Taxable Profit = Total Profits - Total Losses',
      description: 'Under FBR rules, if Fund A made Rs 50,000 profit and Fund B lost Rs 20,000 in the same year, you only pay tax on the remaining Rs 30,000. Losses reduce your tax.'
    },
    {
      formulaName: 'Pension Fund Tax Discount (Section 63)',
      formula: 'Tax Discount = (Your Salary Tax ÷ Your Salary) × Pension Investment',
      description: 'The government gives you a direct cashback / rebate on your salary income tax if you save money in SECP-approved pension funds (e.g. Meezan MTPF, HBL Islamic Pension).'
    },
    {
      formulaName: '50% Tax-Free Cash at Retirement',
      formula: 'Tax-Free Cash = 50% of Total Pension Balance',
      description: 'When you reach retirement age (60 to 70), you can legally withdraw half of your accumulated pension balance completely tax-free.'
    }
  ],
  proTips: [
    'Always be an Active Filer: Being on the FBR Active Taxpayer List cuts your tax in half (15% instead of 30%).',
    'Cancel Profits with Losses before June 30: If you have a fund that lost money, selling it before the fiscal year ends (June 30) lowers your net taxable profit for that year.',
    'Use Pension Funds to Slash Salary Tax: If you pay heavy income tax on your salary, investing in a pension fund is one of the only legal ways to get a direct tax discount in Pakistan.'
  ],
  disclaimer: 'Calculations are based on the Pakistan Income Tax Ordinance (Finance Act 2024). Actual tax deducted upon withdrawal is handled by the fund management company (AMC).'
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
                <h2 className="text-2xl font-bold tracking-tight text-text-primary">Mutual Fund Tax Calculator</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Pakistan Tax Rules (2024-25)
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                Calculate tax on your mutual fund profits, offset your losses, and check your pension tax discount.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInfoOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-[var(--color-white-10)] hover:border-emerald-500/50 text-xs font-semibold text-text-secondary hover:text-emerald-400 transition-all shadow-sm shrink-0 cursor-pointer"
            title="Learn how mutual fund taxes work in simple terms"
          >
            <HelpCircle size={15} className="text-emerald-400" />
            <span>How Tax Works (Simple Guide)</span>
          </button>
        </div>

        {/* Filer Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface border border-[var(--color-white-5)] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-primary">Are you an Active Tax Filer?</span>
            <div className="flex gap-2">
              <button
                onClick={() => setIsFiler(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isFiler
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                    : 'bg-[var(--color-white-5)] text-text-secondary border-[var(--color-white-10)] hover:border-white/30'
                }`}
              >
                Yes, Active Filer (15% Tax)
              </button>
              <button
                onClick={() => setIsFiler(false)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  !isFiler
                    ? 'bg-danger/20 text-danger border-danger/40 shadow-sm'
                    : 'bg-[var(--color-white-5)] text-text-secondary border-[var(--color-white-10)] hover:border-white/30'
                }`}
              >
                No, Non-Filer (30% Double Tax)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium">
            {isFiler ? (
              <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                <ShieldCheck size={14} /> Filer Benefit: You save 50% on tax by being an Active Filer
              </span>
            ) : (
              <span className="text-danger flex items-center gap-1.5 bg-danger/10 px-3 py-1 rounded-lg border border-danger/20">
                <AlertCircle size={14} /> Non-Filer Penalty: You pay double tax (30%) on profits
              </span>
            )}
          </div>
        </div>

        {/* Section 1: Withdrawn Funds (Profit & Loss Calculator) */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                <h3 className="text-lg font-bold">Withdrawn Funds (Profits & Losses)</h3>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Enter funds you already sold. If you suffered a loss on one fund, it automatically cancels out profit from another so you pay less tax.
              </p>
            </div>
            <button
              onClick={() =>
                setRows((rs) => [
                  ...rs,
                  { id: rowSeq++, name: 'Sold Fund', cost: 100_000, value: 120_000 },
                ])
              }
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shrink-0"
            >
              + Add Withdrawn Fund
            </button>
          </div>

          <div className="space-y-3">
            {rows.map((r) => {
              const diff = r.value - r.cost;
              const isProfit = diff >= 0;
              return (
                <div key={r.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-xl bg-[var(--color-white-2)] border border-[var(--color-white-5)]">
                  <div className="md:col-span-5">
                    <span className="text-xs font-medium text-text-secondary">Fund Name</span>
                    <input
                      value={r.name}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      className="mt-1 w-full bg-transparent px-3 py-2 text-sm text-text-primary outline-none border border-[var(--color-white-10)] rounded-xl focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Original Investment" value={r.cost} onChange={(v) => updateRow(r.id, { cost: v })} suffix="PKR" step={5000} />
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Amount Withdrawn" value={r.value} onChange={(v) => updateRow(r.id, { value: v })} suffix="PKR" step={5000} />
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-text-secondary">Your Profit / (Loss)</p>
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
            <Stat label="Total Profits" value={fmtPKR(grossRealizedGains)} tone="good" />
            <Stat label="Losses Deducted" value={fmtPKR(grossRealizedLosses)} sub="Cancels out profit" tone={grossRealizedLosses > 0 ? 'good' : 'default'} />
            <Stat label="Net Taxable Profit" value={fmtPKR(netTaxableRealizedGain)} sub="Tax applies to this amount only" />
            <Stat
              label={`Tax You Pay (${fmtPct(cgtRate)})`}
              value={fmtPKR(realizedCGT)}
              sub={isFiler ? `You saved ${fmtPKR(filerBenefit)} by being a Filer!` : 'Double tax penalty applies'}
              tone={realizedCGT > 0 ? 'bad' : 'good'}
            />
          </div>
        </section>

        {/* Section 2: If You Cash Out Today (Withdrawal Calculator) */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Landmark size={18} className="text-emerald-400" />
              <h3 className="text-lg font-bold">If You Cash Out Today (Withdrawal Calculator)</h3>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Shows how much tax will be deducted and the exact cash that lands in your bank if you sell your active funds today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Total Money You Invested" value={unrealCost} onChange={setUnrealCost} suffix="PKR" step={25000} />
            <Field label="Current Value of Funds Today" value={unrealValue} onChange={setUnrealValue} suffix="PKR" step={25000} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Total Profit So Far" value={fmtPKR(unrealGain)} tone="good" sub="Paper profit on active funds" />
            <Stat
              label={`Estimated Tax Deducted (${fmtPct(cgtRate)})`}
              value={fmtPKR(unrealizedCGT)}
              tone={unrealizedCGT > 0 ? 'bad' : 'good'}
              sub={isFiler ? '15% tax on profit for Filers' : '30% double tax for Non-Filers'}
            />
            <Stat label="Cash Landing in Your Bank" value={fmtPKR(unrealValue - unrealizedCGT)} sub="Your investment + profit minus tax" />
          </div>

          <div className="flex items-start gap-2 text-xs text-text-secondary bg-[var(--color-white-2)] border border-[var(--color-white-5)] rounded-xl p-3">
            <Info size={14} className="mt-0.5 text-emerald-400 shrink-0" />
            <p>
              <strong>Good to know:</strong> Under Pakistani law (Finance Act 2024), tax is 15% on your profit (for Filers) regardless of how long you kept the money. (The old 1-year tax-free exemption no longer applies).
            </p>
          </div>
        </section>

        {/* Section 3: Retirement Pension Tax Discount */}
        <section className="bg-surface border border-[var(--color-white-5)] rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-emerald-400" />
              <h3 className="text-lg font-bold">Retirement Pension Tax Discount (Save on Salary Tax)</h3>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Government incentive: If you put savings into an approved Pakistani Pension Fund (e.g. Meezan Tahaffuz Pension Fund or HBL Islamic Pension Fund), you get a direct cashback/discount on your annual salary tax!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Your Annual Salary / Income" value={taxableIncome} onChange={setTaxableIncome} suffix="PKR" step={50000} />
            <Field label="Money Put in Pension Fund This Year" value={vpsContribution} onChange={setVpsContribution} suffix="PKR" step={10000} />
            <Field label="Your Age (Years)" value={investorAge} onChange={setInvestorAge} suffix="yrs" step={1} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Stat label="Normal Annual Salary Tax" value={fmtPKR(baselineSalaryTax)} sub={`Avg Rate: ${fmtPct(averageTaxRate)}`} />
            <Stat label="Max Pension Eligible for Discount" value={fmtPKR(maxEligibleVpsContribution)} sub={`Allowed up to ${(vpsCapPct * 100).toFixed(0)}% of income`} />
            <Stat label="Tax You Save (Discount)" value={fmtPKR(vpsTaxRebate)} tone="good" sub="Directly deducted from your tax bill" />
            <Stat label="Reduced Tax You Pay" value={fmtPKR(netSalaryTaxAfterVps)} tone={netSalaryTaxAfterVps > 0 ? 'bad' : 'good'} sub="Final salary tax after pension discount" />
          </div>

          <div className="flex items-start gap-2 text-xs text-text-secondary bg-[var(--color-white-2)] border border-[var(--color-white-5)] rounded-xl p-3">
            <ShieldCheck size={14} className="mt-0.5 text-emerald-400 shrink-0" />
            <p>
              <strong>Retirement Bonus:</strong> When you reach retirement age (60+), up to <strong>50% of your accumulated pension can be withdrawn completely tax-free</strong>.
            </p>
          </div>
        </section>

        {/* Action Button & Disclaimer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <button
            onClick={downloadAnnexure}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-md shadow-emerald-900/30 cursor-pointer"
          >
            <Download size={16} /> Download Tax Summary (.txt)
          </button>

          <span className="text-xs text-text-secondary">
            Calculations based on Pakistan FBR Income Tax Ordinance (Finance Act 2024).
          </span>
        </div>
      </div>
    </div>
  );
}

