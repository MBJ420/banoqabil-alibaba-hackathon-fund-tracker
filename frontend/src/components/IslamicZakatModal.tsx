import React, { useState, useMemo } from 'react';
import {
  X,
  Scale,
  BookOpen,
  ShieldCheck,
  Calculator,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Info,
  Printer,
  Sparkles,
  Coins,
  FileText,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface HoldingItem {
  fund_name: string;
  bank?: string;
  category?: string;
  market_value: number;
  units?: number;
  nav?: number;
}

interface IslamicZakatModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdings: HoldingItem[];
  totalNetWorth: number;
}

export const IslamicZakatModal: React.FC<IslamicZakatModalProps> = ({
  isOpen,
  onClose,
  holdings,
  totalNetWorth,
}) => {
  const { isUrdu, t } = useLanguage();

  // Active Tab: 'calculator' | 'derivations' | 'sources'
  const [activeTab, setActiveTab] = useState<'calculator' | 'derivations' | 'sources'>('calculator');

  // Nisab configuration state
  const [nisabStandard, setNisabStandard] = useState<'silver' | 'gold'>('silver');
  const [silverPricePerTola, setSilverPricePerTola] = useState<number>(3330); // ~PKR 285/g * 11.66g/tola = ~PKR 3,330/tola
  const [goldPricePerTola, setGoldPricePerTola] = useState<number>(295000); // Current Pakistan gold rate per tola
  const [useCustomNisab, setUseCustomNisab] = useState<boolean>(false);
  const [customNisabPKR, setCustomNisabPKR] = useState<number>(175000);

  // Calendar basis: 'lunar' (2.5% Hijri default) vs 'solar' (2.577% Gregorian)
  const [calendarBasis, setCalendarBasis] = useState<'lunar' | 'solar'>('lunar');

  // Equity Zakatable Working Capital Ratio (Default: 28% prudent ceiling)
  const [equityRatio, setEquityRatio] = useState<number>(28);

  // Demo sample holdings if user has zero statements uploaded
  const [showDemoHoldings, setShowDemoHoldings] = useState<boolean>(false);

  // Derived Nisab Threshold (PKR)
  const currentNisabThreshold = useMemo(() => {
    if (useCustomNisab) return customNisabPKR;
    if (nisabStandard === 'silver') {
      return 52.5 * silverPricePerTola;
    } else {
      return 7.5 * goldPricePerTola;
    }
  }, [useCustomNisab, customNisabPKR, nisabStandard, silverPricePerTola, goldPricePerTola]);

  // Determine active holdings list
  const activeHoldings: HoldingItem[] = useMemo(() => {
    if (holdings && holdings.length > 0 && !showDemoHoldings) {
      return holdings;
    }
    if (showDemoHoldings || !holdings || holdings.length === 0) {
      return [
        { fund_name: 'Meezan Islamic Fund', bank: 'Meezan Bank', category: 'Equity', market_value: 500000 },
        { fund_name: 'Meezan Cash Fund', bank: 'Meezan Bank', category: 'Money Market', market_value: 300000 },
        { fund_name: 'Al Meezan Mutual Fund', bank: 'Meezan Bank', category: 'Balanced', market_value: 200000 },
        { fund_name: 'Meezan Sovereign Fund', bank: 'Meezan Bank', category: 'Income', market_value: 250000 },
        { fund_name: 'Meezan Tahaffuz Pension Fund (Equity)', bank: 'Meezan Bank', category: 'Pension Equity', market_value: 150000 },
      ];
    }
    return [];
  }, [holdings, showDemoHoldings]);

  // Portfolio total value
  const totalPortfolioValue = useMemo(() => {
    if (activeHoldings.length === 0) return totalNetWorth || 0;
    return activeHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0);
  }, [activeHoldings, totalNetWorth]);

  // Is portfolio Sahib-e-Nisab?
  const isSahibNisab = totalPortfolioValue >= currentNisabThreshold;

  // Applicable Zakat rate
  const zakatRate = calendarBasis === 'lunar' ? 0.025 : 0.02577;

  // Helper to categorize fund and return zakatable ratio
  // LOGIC:
  // - Money Market / Cash: 100%
  // - Income / Debt / Sukuk: 100%
  // - Balanced / Asset Allocation: 70% Cash (100%) + 30% Equity (equityRatio)
  // - Equity / Stock: equityRatio (default 28% prudent ceiling)
  const getFundZakatableRatio = (fund: HoldingItem): { ratio: number; categoryType: string } => {
    const cat = (fund.category || '').toLowerCase();
    const name = (fund.fund_name || '').toLowerCase();

    // 1. Money Market / Cash -> 100%
    if (cat.includes('money market') || cat.includes('cash') || name.includes('cash fund') || name.includes('money market')) {
      return {
        ratio: 100,
        categoryType: 'Money Market'
      };
    }

    // 2. Income / Debt / Sukuk / Sovereign -> 100%
    if (
      cat.includes('income') || cat.includes('debt') || cat.includes('sovereign') ||
      cat.includes('sukuk') || name.includes('income') || name.includes('sovereign') || name.includes('sukuk')
    ) {
      return {
        ratio: 100,
        categoryType: 'Income / Debt'
      };
    }

    // 3. Balanced / Asset Allocation -> 70% Cash (100%) + 30% Equity (equityRatio)
    if (
      cat.includes('balanced') || cat.includes('asset allocation') ||
      name.includes('balanced') || name.includes('asset allocation')
    ) {
      const blendedRatio = Math.round((70 * 1.0) + (30 * (equityRatio / 100)));
      return {
        ratio: blendedRatio,
        categoryType: 'Balanced'
      };
    }

    // 4. Equity / Stock Funds -> equityRatio (Default 28% prudent ceiling)
    if (
      cat.includes('equity') || cat.includes('stock') || cat.includes('index') ||
      name.includes('equity') || name.includes('stock') || name.includes('index')
    ) {
      return {
        ratio: equityRatio,
        categoryType: 'Equity'
      };
    }

    // Default fallback -> 100%
    return {
      ratio: 100,
      categoryType: 'Other'
    };
  };

  // Fund Breakdown with Zakatable Base and Zakat Due
  const fundCalculations = useMemo(() => {
    return activeHoldings.map((h) => {
      const { ratio, categoryType } = getFundZakatableRatio(h);
      const zakatableBase = (h.market_value * ratio) / 100;
      const zakatDue = isSahibNisab ? zakatableBase * zakatRate : 0;
      return {
        ...h,
        categoryType,
        ratio,
        zakatableBase,
        zakatDue,
      };
    });
  }, [activeHoldings, equityRatio, zakatRate, isSahibNisab]);

  // Aggregate Figures
  const totalZakatableBase = useMemo(() => {
    return fundCalculations.reduce((sum, item) => sum + item.zakatableBase, 0);
  }, [fundCalculations]);

  const totalZakatDue = useMemo(() => {
    if (!isSahibNisab) return 0;
    return fundCalculations.reduce((sum, item) => sum + item.zakatDue, 0);
  }, [fundCalculations, isSahibNisab]);

  const postZakatWealth = totalPortfolioValue - totalZakatDue;

  // Print Certificate Handler
  const handlePrintCertificate = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 md:p-6">
      {/* Modal Container: Fixed-height flex container so tabs and header remain pinned at top */}
      <div className="bg-[#0b1512] text-[#f1f5f3] border border-emerald-500/30 rounded-3xl w-full max-w-5xl h-[92vh] max-h-[900px] shadow-2xl flex flex-col relative overflow-hidden">

        {/* Decorative Hilal Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500 z-20" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-32 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />

        {/* 1. PINNED HEADER (Never scrolls away) */}
        <div className="p-5 md:p-6 border-b border-emerald-500/20 bg-[#0c1a14] flex items-start justify-between relative z-10 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-950 border border-emerald-500/40 text-emerald-400 rounded-2xl shadow-inner shadow-emerald-500/20">
              <Scale size={26} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  {t('zakat_modal_title', 'Shariah Zakat & Wealth Purification Terminal')}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                  AAOIFI No. 35
                </span>
              </div>
              <p className="text-xs md:text-sm text-emerald-200/70 mt-0.5">
                {t('zakat_modal_subtitle', 'Calculated in compliance with AAOIFI Standard No. 35 & SBP Nisab guidelines')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-emerald-300/60 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 rounded-full border border-emerald-500/20 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. PINNED HIGH-CONTRAST SEGMENTED TABS (Always visible, cannot scroll away) */}
        <div className="px-5 md:px-6 py-3 border-b border-emerald-500/20 bg-[#0d1e17] shrink-0">
          <div className="grid grid-cols-3 gap-2 bg-black/50 p-1.5 rounded-2xl border border-emerald-500/30">
            {/* Tab 1 Button */}
            <button
              type="button"
              onClick={() => setActiveTab('calculator')}
              className={`py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'calculator'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-900/50 border border-emerald-400/40'
                  : 'text-emerald-300/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Calculator size={16} className={activeTab === 'calculator' ? 'text-amber-300' : 'text-emerald-400'} />
              <span className="truncate">1. {t('tab_calculator', 'Calculator & Portfolio')}</span>
            </button>

            {/* Tab 2 Button */}
            <button
              type="button"
              onClick={() => setActiveTab('derivations')}
              className={`py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'derivations'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-900/50 border border-emerald-400/40'
                  : 'text-emerald-300/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen size={16} className={activeTab === 'derivations' ? 'text-amber-300' : 'text-emerald-400'} />
              <span className="truncate">2. {t('tab_derivations', 'Religious & Financial Derivations')}</span>
            </button>

            {/* Tab 3 Button */}
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'sources'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-900/50 border border-emerald-400/40'
                  : 'text-emerald-300/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck size={16} className={activeTab === 'sources' ? 'text-amber-300' : 'text-emerald-400'} />
              <span className="truncate">3. {t('tab_sources', 'Sources & Fiqh Disclaimers')}</span>
            </button>
          </div>
        </div>

        {/* 3. SCROLLABLE INNER BODY (Only this section scrolls) */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">

          {/* ========================================================================= */}
          {/* TAB 1: CALCULATOR & PORTFOLIO BREAKDOWN */}
          {/* ========================================================================= */}
          {activeTab === 'calculator' && (
            <div className="space-y-6">

              {/* 1. Nisab Configuration & Live Verification Card */}
              <div className="bg-gradient-to-br from-[#12231c] to-[#0d1a15] border border-emerald-500/30 rounded-2xl p-4 md:p-5 shadow-lg space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                  <div className="flex items-center gap-2.5">
                    <Coins size={20} className="text-amber-400" />
                    <h3 className="text-base font-bold text-white">
                      {t('nisab_config', 'Nisab Threshold Configuration')}
                    </h3>
                  </div>

                  {/* Sahib-e-Nisab Status Badge */}
                  <div className="flex items-center gap-2">
                    {isSahibNisab ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        {t('sahib_e_nisab', 'Sahib-e-Nisab (Zakat Obligatory)')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        <Info size={14} className="text-sky-400" />
                        {t('below_nisab', 'Below Nisab (Zakat Due: PKR 0.00)')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Real-time Market Notice Warning */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300">
                      {isUrdu ? 'Zaroori Notice: ' : 'Market Notice: '}
                    </span>
                    {t(
                      'market_disclaimer',
                      'Gold and silver market prices do not update automatically in real-time. Please adjust the rate below to match today\'s local Sarafa Bazar / SBP notification.'
                    )}
                  </div>
                </div>

                {/* Nisab Standard Switcher & Price Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Standard Switcher */}
                  <div className="space-y-1.5">
                    <label className="text-emerald-300/80 font-medium">Nisab Standard</label>
                    <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-1 rounded-xl border border-emerald-500/20">
                      <button
                        type="button"
                        onClick={() => { setNisabStandard('silver'); setUseCustomNisab(false); }}
                        className={`py-1.5 px-2 rounded-lg font-medium transition-all ${
                          nisabStandard === 'silver' && !useCustomNisab
                            ? 'bg-emerald-600 text-white shadow'
                            : 'text-emerald-300/70 hover:text-white'
                        }`}
                      >
                        Silver (52.5 Tola)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNisabStandard('gold'); setUseCustomNisab(false); }}
                        className={`py-1.5 px-2 rounded-lg font-medium transition-all ${
                          nisabStandard === 'gold' && !useCustomNisab
                            ? 'bg-amber-600 text-white shadow'
                            : 'text-emerald-300/70 hover:text-white'
                        }`}
                      >
                        Gold (7.5 Tola)
                      </button>
                    </div>
                  </div>

                  {/* Metal Price Input */}
                  <div className="space-y-1.5">
                    <label className="text-emerald-300/80 font-medium">
                      {nisabStandard === 'silver' ? 'Silver Price (PKR / Tola)' : 'Gold Price (PKR / Tola)'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={useCustomNisab}
                        value={nisabStandard === 'silver' ? silverPricePerTola : goldPricePerTola}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (nisabStandard === 'silver') setSilverPricePerTola(val);
                          else setGoldPricePerTola(val);
                        }}
                        className="w-full bg-black/50 border border-emerald-500/30 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400 disabled:opacity-50"
                      />
                      <span className="absolute right-3 top-2 text-[10px] text-emerald-400/60 uppercase">PKR</span>
                    </div>
                  </div>

                  {/* Calculated Nisab Threshold Display / Custom Override */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-emerald-300/80 font-medium">Nisab Threshold (PKR)</label>
                      <button
                        type="button"
                        onClick={() => setUseCustomNisab(!useCustomNisab)}
                        className="text-[10px] text-amber-400 hover:underline"
                      >
                        {useCustomNisab ? 'Use Formula' : 'Enter Exact PKR'}
                      </button>
                    </div>
                    {useCustomNisab ? (
                      <input
                        type="number"
                        value={customNisabPKR}
                        onChange={(e) => setCustomNisabPKR(Number(e.target.value))}
                        className="w-full bg-black/50 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-400"
                      />
                    ) : (
                      <div className="w-full bg-black/30 border border-emerald-500/20 rounded-xl px-3 py-2 text-amber-300 font-bold font-mono text-xs flex justify-between items-center">
                        <span>PKR {Math.round(currentNisabThreshold).toLocaleString()}</span>
                        <span className="text-[10px] text-emerald-400 font-normal">
                          {nisabStandard === 'silver' ? '52.5 Tola Chandi' : '7.5 Tola Sona'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!isSahibNisab && (
                  <p className="text-[11px] text-sky-300/80 italic">
                    ℹ️ Note: Your tracked mutual fund wealth (PKR {Math.round(totalPortfolioValue).toLocaleString()}) is below the active Nisab threshold (PKR {Math.round(currentNisabThreshold).toLocaleString()}). If you have other personal savings or gold outside this platform that brings your total liquid wealth above Nisab, you may evaluate this calculation as a reference.
                  </p>
                )}
              </div>

              {/* 2. Controls Bar: Calendar Year & Equity Working Capital Slider */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Calendar Basis (Hijri Lunar 2.5% Default vs Gregorian Solar 2.577%) */}
                <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-emerald-200 flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-400" />
                      {t('calendar_basis', 'Calculation Basis')}
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {calendarBasis === 'lunar' ? '2.500%' : '2.577%'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-emerald-500/20 text-xs">
                    <button
                      type="button"
                      onClick={() => setCalendarBasis('lunar')}
                      className={`py-2 px-3 rounded-lg font-medium text-left transition-all cursor-pointer ${
                        calendarBasis === 'lunar'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-emerald-300/70 hover:text-white'
                      }`}
                    >
                      <div className="font-bold">Hijri Lunar (2.5%)</div>
                      <div className="text-[10px] opacity-80">Default • 354 Days</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarBasis('solar')}
                      className={`py-2 px-3 rounded-lg font-medium text-left transition-all cursor-pointer ${
                        calendarBasis === 'solar'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-emerald-300/70 hover:text-white'
                      }`}
                    >
                      <div className="font-bold">Gregorian Solar (2.577%)</div>
                      <div className="text-[10px] opacity-80">Fiscal / 365 Days</div>
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-300/60">
                    * Classical Fiqh mandates 2.5% per lunar year. If calculating on a 365-day Gregorian fiscal calendar, 2.577% compensates for the 11-day calendar variance.
                  </p>
                </div>

                {/* Equity Ratio Slider (28% Prudent Ceiling Default) */}
                <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-emerald-200 flex items-center gap-2">
                      <Sliders size={14} className="text-amber-400" />
                      {t('equity_zakatable_ratio', 'Equity Working Capital Ratio')}
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/30">
                      {equityRatio}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={equityRatio}
                    onChange={(e) => setEquityRatio(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEquityRatio(28)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                        equityRatio === 28
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                          : 'bg-black/30 text-emerald-300/70 border-emerald-500/20 hover:text-white'
                      }`}
                    >
                      28% Prudent Ceiling (Ihtiyat)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEquityRatio(100)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                        equityRatio === 100
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                          : 'bg-black/30 text-emerald-300/70 border-emerald-500/20 hover:text-white'
                      }`}
                    >
                      100% Full Market Value
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-300/60">
                    * PSX KMI-30 working capital ranges between 22% and 28%. We set 28% as default to guarantee no underpayment.
                  </p>
                </div>
              </div>

              {/* 3. Fund-by-Fund Zakatability Table */}
              <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl overflow-hidden shadow-lg">
                <div className="p-4 border-b border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Fund-by-Fund Portfolio Breakdown</h3>
                    <p className="text-xs text-emerald-300/60">Asset class specific zakatability weights applied</p>
                  </div>
                  {(!holdings || holdings.length === 0) && (
                    <button
                      onClick={() => setShowDemoHoldings(!showDemoHoldings)}
                      className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 px-3 py-1.5 rounded-xl hover:bg-amber-400/20 transition-colors cursor-pointer"
                    >
                      {showDemoHoldings ? 'Hide Sample Portfolio' : 'Load Sample Portfolio'}
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-emerald-950/60 text-emerald-300/80 border-b border-emerald-500/20">
                        <th className="py-3 px-4 font-semibold">Fund Name & Category</th>
                        <th className="py-3 px-4 font-semibold text-right">Market Value</th>
                        <th className="py-3 px-4 font-semibold text-center">Zakatable %</th>
                        <th className="py-3 px-4 font-semibold text-right">Zakatable Base</th>
                        <th className="py-3 px-4 font-semibold text-right">Zakat Due ({calendarBasis === 'lunar' ? '2.5%' : '2.577%'})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-500/10">
                      {fundCalculations.map((fund, idx) => (
                        <tr key={idx} className="hover:bg-emerald-900/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{fund.fund_name}</div>
                            <div className="text-[11px] text-emerald-300/60 flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded bg-black/40 border border-emerald-500/20 text-emerald-300 text-[10px]">
                                {fund.categoryType}
                              </span>
                              {fund.bank && <span>• {fund.bank}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-white font-medium">
                            PKR {Math.round(fund.market_value).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              fund.ratio === 100
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            }`}>
                              {fund.ratio}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-200">
                            PKR {Math.round(fund.zakatableBase).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                            {isSahibNisab ? `PKR ${Math.round(fund.zakatDue).toLocaleString()}` : 'PKR 0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Financial Summary KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] text-emerald-300/70 uppercase tracking-wider font-semibold">
                    Total Portfolio
                  </span>
                  <div className="text-base md:text-lg font-bold font-mono text-white">
                    PKR {Math.round(totalPortfolioValue).toLocaleString()}
                  </div>
                </div>

                <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] text-emerald-300/70 uppercase tracking-wider font-semibold">
                    {t('total_zakatable_base', 'Zakatable Base')}
                  </span>
                  <div className="text-base md:text-lg font-bold font-mono text-emerald-300">
                    PKR {Math.round(totalZakatableBase).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-400/60 block">
                    After exempt fixed assets
                  </span>
                </div>

                <div className="bg-gradient-to-br from-amber-950/40 to-emerald-950/40 border border-amber-500/40 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] text-amber-300 uppercase tracking-wider font-bold flex items-center justify-between">
                    <span>{t('total_zakat_due', 'Total Zakat Due')}</span>
                    <span className="text-[10px] font-mono">{calendarBasis === 'lunar' ? '2.5%' : '2.577%'}</span>
                  </span>
                  <div className="text-base md:text-xl font-extrabold font-mono text-amber-400">
                    PKR {Math.round(totalZakatDue).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-amber-200/60 block">
                    {isSahibNisab ? 'Compulsory religious liability' : 'Below Nisab threshold'}
                  </span>
                </div>

                <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] text-emerald-300/70 uppercase tracking-wider font-semibold">
                    {t('post_zakat_net_worth', 'Post-Zakat Net Worth')}
                  </span>
                  <div className="text-base md:text-lg font-bold font-mono text-white">
                    PKR {Math.round(postZakatWealth).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-400/60 block">Purified capital remaining</span>
                </div>
              </div>

              {/* 5. RELIGIOUS PRUDENCE (IHTIYAT) DISCLOSURE GUARANTEE */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-amber-500/10 border border-amber-500/40 rounded-2xl flex items-start gap-3 shadow-md">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5 border border-amber-500/30">
                  <Scale size={20} />
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-amber-300 flex items-center gap-2 text-sm">
                    {isUrdu ? 'Ihtiyat aur Zimadari ki Wazahat (Religious Prudence)' : 'Disclosure of Religious Prudence (Ihtiyat Guarantee)'}
                  </h4>
                  <p className="text-emerald-100/90 leading-relaxed text-xs">
                    {isUrdu
                      ? 'Tamam parameters, sarmaye ki taqseem aur working capital ratios ko jaan boojh kar zyada aur behtar satah par rakha gaya hai (maslan Equities par 28% prudent ceiling, Income/Cash par 100%, aur Balanced funds par 70% cash hissa) taake aapki ada kardah Zakat kisi bhi soorat 1 rupiya bhi kam na ho aur farz bila-shuba mukammal ada ho.'
                      : 'All parameters, asset classifications, and working capital ratios have been deliberately taken higher and greater (including 28% prudent equity ceiling, 100% on income/cash, and a conservative 70% cash / 30% equity allocation on balanced funds) to guarantee that your calculated Zakat liability is safely more than due, and dare not be even 1 Rupee less than your divine obligation.'}
                  </p>
                </div>
              </div>

              {/* 6. Section 60 Tax Certificate Export & Forward Tab Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl">
                <div className="space-y-0.5 text-xs text-emerald-200/80">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <FileText size={15} className="text-amber-400" />
                    FBR Tax Exemption under Section 60
                  </div>
                  <p className="text-[11px] text-emerald-300/60">
                    Zakat paid is an official deductible allowance from your total taxable income under Section 60 of the Income Tax Ordinance, 2001.
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handlePrintCertificate}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold text-xs shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
                  >
                    <Printer size={15} />
                    {t('export_tax_certificate', 'Export Tax Certificate')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('derivations')}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    <span>Read Derivations</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: RELIGIOUS & FINANCIAL DERIVATION */}
          {/* ========================================================================= */}
          {activeTab === 'derivations' && (
            <div className="space-y-6 text-xs text-emerald-100/90 leading-relaxed">
              {/* Introduction Banner */}
              <div className="p-4 bg-gradient-to-br from-emerald-950/60 to-[#12231c] border border-emerald-500/30 rounded-2xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1.5">
                  <BookOpen size={18} className="text-amber-400" />
                  The Islamic Jurisprudence & Financial Derivation of Zakat on Mutual Funds
                </h3>
                <p className="text-emerald-200/70">
                  Mutual funds are collective investment schemes where investors hold undivided fractional shares in a diversified portfolio of assets. Under classical Shariah law, the calculation of Zakat depends entirely on the nature of the underlying assets.
                </p>
              </div>

              {/* Section 1: Amwal al-Tijarah vs Amwal al-Qunyah */}
              <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  1. The Foundational Principle: Amwal al-Tijarah vs. Amwal al-Qunyah
                </h4>
                <p>
                  By unanimous consensus (Ijma') of Islamic jurists, personal capital assets, productive machinery, factories, buildings, tools of trade, and operational fixed assets (termed <strong className="text-white">Amwal al-Qunyah</strong>) are <strong className="text-emerald-400">strictly exempt from Zakat</strong>.
                </p>
                <div className="p-3 bg-black/30 border-l-2 border-amber-400 rounded-r-xl text-[11px] font-mono text-emerald-200">
                  "There is no charity (Zakat) due upon a Muslim regarding his horse or his servant." — Sahih al-Bukhari (1463)
                </div>
                <p>
                  In contrast, goods held for sale or circulating merchandise (<strong className="text-white">Amwal al-Tijarah</strong>), trade inventory, raw materials, cash in bank accounts, and trade receivables are <strong className="text-amber-300">100% subject to Zakat</strong>.
                </p>
                <p>
                  When a joint-stock company operates (such as Engro, Lucky Cement, Hubco, or OGDC), it owns both fixed assets (cement kilns, chemical plants, oil drilling equipment, land) and circulating assets (cash, trade inventory, accounts receivable). Taxing the entire market capitalization of the company would improperly impose Zakat on exempt industrial machinery.
                </p>
              </div>

              {/* Section 2: AAOIFI Shariah Standard No. 35 */}
              <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  2. AAOIFI Shariah Standard No. 35: The Net Current Assets (Working Capital) Method
                </h4>
                <p>
                  The Accounting and Auditing Organization for Islamic Financial Institutions (AAOIFI), in <strong className="text-white">Shariah Standard No. 35 (Zakat)</strong>, stipulates that for long-term equity investors, Zakat is assessed exclusively on the <strong className="text-white">Net Zakatable Assets (Working Capital)</strong> of the company:
                </p>
                <div className="p-3 bg-black/40 border border-emerald-500/30 rounded-xl space-y-1 font-mono text-center text-amber-300 text-xs">
                  <div>Zakatable Working Capital = (Current Assets - Short-Term Operational Liabilities)</div>
                  <div className="text-[11px] text-emerald-300">Zakatable Ratio = Zakatable Working Capital ÷ Total Market Capitalization</div>
                </div>
                <p>
                  Because an open-end mutual fund holds these company shares on behalf of unitholders, the unitholder is responsible for paying Zakat on the proportional net working capital of the underlying portfolio.
                </p>
              </div>

              {/* Section 3: Empirical KMI-30 Band and the 28% Prudent Ceiling */}
              <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  3. Why 28% is the Prudent Upper Ceiling for PSX KMI-30 Equities
                </h4>
                <p>
                  Direct daily balance-sheet auditing of 30+ underlying companies is practically impossible for retail investors. Empirical research across Pakistan Stock Exchange (PSX) KMI-30 Shariah-compliant constituent firms shows:
                </p>
                <ul className="list-disc list-inside space-y-1 text-emerald-200/80 ml-2">
                  <li><strong className="text-white">Asset-Heavy Companies</strong> (Cement, Oil & Gas, Power Generation): Working capital typically constitutes 15% to 22% of total assets.</li>
                  <li><strong className="text-white">Commercial & Tech Companies</strong> (Fertilizer distribution, IT, Consumer Goods): Working capital constitutes 24% to 32%.</li>
                  <li><strong className="text-white">KMI-30 Weighted Aggregate Band:</strong> The index average empirically hovers between <strong className="text-amber-300">22% and 28%</strong>.</li>
                </ul>

                <div className="p-3.5 bg-emerald-950/40 border border-amber-500/30 rounded-xl space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Scale size={15} className="text-amber-400" />
                    The Jurisprudential Principle of Ihtiyat (Caution)
                  </div>
                  <p className="text-emerald-200/90 text-[11px] leading-relaxed">
                    In Islamic jurisprudence, in matters of obligatory worship (Fara'idh), if there is mathematical estimation, the jurists mandate taking the <strong className="text-amber-300">upper boundary</strong> (*Ihtiyat*) to guarantee complete discharge of divine liability (*Bara'at al-Dhimmah*). Underpaying by even 1 PKR leaves an unpaid obligation, while any excess acts as voluntary charity (Sadaqah). Therefore, <strong className="text-white">28%</strong> is programmed as the default prudent ceiling.
                  </p>
                </div>
              </div>

              {/* Section 4: 100% on Money Market and Income/Debt Funds */}
              <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  4. Why Money Market & Income/Debt Funds are 100% Zakatable
                </h4>
                <p>
                  Unlike equity funds, Money Market and Income funds do not own factories or real estate. They hold:
                </p>
                <ul className="list-disc list-inside space-y-1 text-emerald-200/80 ml-2">
                  <li>Bank term deposits & call accounts (pure cash / Nuqud)</li>
                  <li>Treasury Bills and Sovereign instruments (liquid financial claims)</li>
                  <li>Corporate Sukuk and Islamic commercial paper (debt receivables / Duyun)</li>
                </ul>
                <p>
                  Under Shariah rules, debts owed to an individual that are expected to be recovered, as well as bank placements, are treated as <strong className="text-white">100% monetary wealth</strong>. Therefore, no working-capital reduction applies; they are zakatable at <strong className="text-emerald-400">100% of their market value</strong>.
                </p>
              </div>

              {/* Navigation buttons at bottom of Tab 2 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('calculator')}
                  className="px-4 py-2 rounded-xl bg-black/40 hover:bg-white/5 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Calculator</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('sources')}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>View Sources & Disclaimers</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: AUTHORITATIVE SOURCES & FIQH DISCLAIMERS */}
          {/* ========================================================================= */}
          {activeTab === 'sources' && (
            <div className="space-y-6 text-xs text-emerald-100/90 leading-relaxed">

              {/* Authoritative Primary Sources */}
              <div className="space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-amber-400" />
                  Authoritative Primary Scholarly Sources
                </h3>
                <p className="text-emerald-200/70">
                  The methodology and ratios in this terminal are grounded in verifiable resolutions and standards published by leading global and Pakistani Shariah authorities:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Source 1 */}
                  <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">AAOIFI Shariah Standard No. 35</span>
                      <span className="text-[10px] text-amber-400 font-mono">Bahrain</span>
                    </div>
                    <p className="text-emerald-300/70 text-[11px]">
                      <em>Subject: Zakat on Shares & Investment Funds (Section 4/1 & 4/2).</em> Stipulates the Net Current Assets / Working Capital deduction method for long-term equity holdings.
                    </p>
                  </div>

                  {/* Source 2 */}
                  <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">OIC Islamic Fiqh Academy</span>
                      <span className="text-[10px] text-amber-400 font-mono">Resolution 120 (13/3)</span>
                    </div>
                    <p className="text-emerald-300/70 text-[11px]">
                      <em>Subject: Zakat on Corporate Equities.</em> Confirmed that long-term investors pay Zakat on circulating working capital, exempting factory equipment and infrastructure.
                    </p>
                  </div>

                  {/* Source 3 */}
                  <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Al Meezan Shariah Board</span>
                      <span className="text-[10px] text-amber-400 font-mono">Pakistan</span>
                    </div>
                    <p className="text-emerald-300/70 text-[11px]">
                      Led by Dr. Muhammad Imran Ashraf Usmani & Justice (R) Mufti Muhammad Taqi Usmani. Annually computes and publishes fund-by-fund Zakat factors for Pakistani mutual funds.
                    </p>
                  </div>

                  {/* Source 4 */}
                  <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">National Zakat Foundation (NZF)</span>
                      <span className="text-[10px] text-amber-400 font-mono">Global Standard</span>
                    </div>
                    <p className="text-emerald-300/70 text-[11px]">
                      <em>Subject: Zakat on Stocks & Shares.</em> Establishes the 25%–30% proxy rule for retail investors where individual company balance sheets cannot be individually audited.
                    </p>
                  </div>

                  {/* Source 5 */}
                  <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-4 space-y-1.5 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">State Bank of Pakistan & Ministry of Religious Affairs</span>
                      <span className="text-[10px] text-amber-400 font-mono">Statutory Ordinance</span>
                    </div>
                    <p className="text-emerald-300/70 text-[11px]">
                      <em>Zakat & Ushr Ordinance, 1980 (XVIII of 1980).</em> Regulates the annual notification of Nisab, deduction of Zakat on the 1st of Ramadan, and statutory exemption declarations (Form CZ-50).
                    </p>
                  </div>
                </div>
              </div>

              {/* Jurisprudential (Fiqh) Disclaimers */}
              <div className="bg-gradient-to-br from-amber-950/20 to-[#12231c] border border-amber-500/30 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <AlertTriangle size={17} className="text-amber-400" />
                  Sensitive Disclaimers Regarding Makatib-e-Fikr (Schools of Thought)
                </h3>

                <div className="space-y-2 text-[11px] text-emerald-200/80">
                  <p>
                    <strong className="text-white">1. Differences Across Makatib-e-Fikr:</strong> While this calculator adheres to the majority contemporary consensus of the OIC Fiqh Academy and AAOIFI, differences exist across schools of thought:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-3 text-emerald-300/80">
                    <li><strong className="text-white">Silver Nisab vs. Gold Nisab:</strong> The Hanafi school strongly recommends Silver Nisab (52.5 tolas) for mixed commercial and monetary assets because it is most beneficial to the poor (<em>Anfa' lil-Fuqara</em>). Shafi'i, Maliki, and Hanbali traditions provide allowances for Gold Nisab (7.5 tolas). Both standards are configurable in this tool.</li>
                    <li><strong className="text-white">Day Trading Intent:</strong> If you purchased mutual fund units purely for short-term speculative trading (day trading / capital flipping) with no intent of holding for dividends, certain classical jurists mandate treating 100% of the market value as trade merchandise (Urud al-Tijarah). Use the "100% Full Market Value" button if this aligns with your holding intent.</li>
                    <li><strong className="text-white">Ja'fari Jurisprudence:</strong> Followers of Fiqh-e-Ja'faria have distinct criteria regarding commercial assets and Khums. Shia investors should consult their respective <em>Marja' Taqlid</em> for tailored guidance.</li>
                  </ul>

                  <p className="pt-1">
                    <strong className="text-white">2. Advisory to Consult Personal Scholar:</strong> This software serves as an advanced educational and mathematical decision-support instrument. It does not replace a personalized legal-religious opinion (Fatwa). For complex estates, inheritance distribution, family trusts, or debt-deduction intricacies, please consult your trusted qualified Mufti.
                  </p>
                </div>
              </div>

              {/* Form CZ-50 Guidance */}
              <div className="bg-[#12231c] border border-emerald-500/20 rounded-2xl p-5 space-y-2.5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText size={16} className="text-emerald-400" />
                  Statutory Form CZ-50 Exemption (Pakistan Banking & AMC Regulation)
                </h4>
                <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                  Under the Zakat & Ushr Ordinance, 1980, Pakistani banks and Asset Management Companies (AMCs) are mandated to automatically deduct 2.5% compulsory Zakat from bank accounts and mutual fund units on the 1st of Ramadan.
                </p>
                <div className="p-3 bg-black/30 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300">
                  💡 <strong className="text-white">How to avoid double-deduction:</strong> If you wish to calculate and disburse your Zakat independently according to the working-capital method, you must submit an attested <strong className="text-amber-300">Declaration of Exemption (Form CZ-50)</strong> on PKR 50 stamp paper to your AMC (Meezan, HBL, Atlas, Faysal) at least 30 days before Ramadan.
                </div>
              </div>

              {/* Navigation buttons at bottom of Tab 3 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('derivations')}
                  className="px-4 py-2 rounded-xl bg-black/40 hover:bg-white/5 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Derivations</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('calculator')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Calculator size={14} />
                  <span>Back to Calculator</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* 4. PINNED FOOTER (Never scrolls away) */}
        <div className="p-4 md:p-5 border-t border-emerald-500/20 bg-[#0c1a14] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-emerald-300/70">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>Islamic Zakat Engine v2.0 • AAOIFI Shariah Standard 35 Compliant</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-500/40 text-white font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* Hidden Printable Section 60 Tax Exemption Certificate (Shown only during window.print()) */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 z-[9999] font-sans text-xs">
        <div className="max-w-3xl mx-auto space-y-6 border border-gray-400 p-8 rounded">
          {/* Certificate Header */}
          <div className="text-center border-b pb-4 space-y-1">
            <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">
              Certificate of Shariah Zakat Calculation
            </h1>
            <p className="text-xs text-gray-600">
              Tax Deductible Allowance under Section 60 of the Income Tax Ordinance, 2001 (Pakistan)
            </p>
            <p className="text-[10px] text-gray-500">
              Generated by Pakistan Fund Tracker • Compliant with AAOIFI Shariah Standard No. 35
            </p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4 text-xs">
            <div>
              <div><strong>Date of Calculation:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div><strong>Accounting Basis:</strong> {calendarBasis === 'lunar' ? 'Hijri Lunar Year (2.500%)' : 'Gregorian Solar Year (2.577%)'}</div>
              <div><strong>Nisab Benchmark:</strong> {nisabStandard === 'silver' ? 'Silver Standard (52.5 Tola)' : 'Gold Standard (7.5 Tola)'}</div>
            </div>
            <div className="text-right">
              <div><strong>Active Nisab Threshold:</strong> PKR {Math.round(currentNisabThreshold).toLocaleString()}</div>
              <div><strong>Equity Working Capital Ratio:</strong> {equityRatio}% (Prudent Ceiling)</div>
              <div><strong>Nisab Status:</strong> {isSahibNisab ? 'Sahib-e-Nisab (Eligible)' : 'Below Nisab'}</div>
            </div>
          </div>

          {/* Holdings Summary Table */}
          <div>
            <h2 className="font-bold text-sm mb-2">Portfolio Zakat Breakdown</h2>
            <table className="w-full border-collapse border border-gray-300 text-left text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2">Fund Name</th>
                  <th className="border border-gray-300 p-2">Category</th>
                  <th className="border border-gray-300 p-2 text-right">Market Value (PKR)</th>
                  <th className="border border-gray-300 p-2 text-center">Zakatable %</th>
                  <th className="border border-gray-300 p-2 text-right">Zakatable Base (PKR)</th>
                  <th className="border border-gray-300 p-2 text-right">Zakat Due (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {fundCalculations.map((f, i) => (
                  <tr key={i}>
                    <td className="border border-gray-300 p-2">{f.fund_name}</td>
                    <td className="border border-gray-300 p-2">{f.categoryType}</td>
                    <td className="border border-gray-300 p-2 text-right">{Math.round(f.market_value).toLocaleString()}</td>
                    <td className="border border-gray-300 p-2 text-center">{f.ratio}%</td>
                    <td className="border border-gray-300 p-2 text-right">{Math.round(f.zakatableBase).toLocaleString()}</td>
                    <td className="border border-gray-300 p-2 text-right font-bold">{Math.round(f.zakatDue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand Totals */}
          <div className="bg-gray-50 border p-4 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Total Portfolio Gross Market Value:</span>
              <span className="font-bold font-mono">PKR {Math.round(totalPortfolioValue).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Net Zakatable Base:</span>
              <span className="font-bold font-mono">PKR {Math.round(totalZakatableBase).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t pt-2 text-gray-900">
              <span>Total Zakat Due & Deductible under Section 60:</span>
              <span className="font-mono">PKR {Math.round(totalZakatDue).toLocaleString()}</span>
            </div>
          </div>

          {/* Statutory Tax Declaration */}
          <div className="text-[10px] text-gray-600 border-t pt-3 space-y-1">
            <p>
              <strong>Statutory Declaration:</strong> This certificate records the voluntary Shariah Zakat calculation on open-end mutual fund and voluntary pension scheme (VPS) holdings under the Working Capital methodology prescribed by AAOIFI Shariah Standard No. 35.
            </p>
            <p>
              Under Section 60 of the Income Tax Ordinance, 2001, any amount paid as Zakat under the Zakat and Ushr Ordinance, 1980 is admissible as a straight deduction from the taxpayer's total taxable income for the tax year.
            </p>
          </div>

          {/* Signature Lines */}
          <div className="grid grid-cols-2 pt-8 text-xs">
            <div>
              <div className="border-t border-gray-400 w-48 pt-1">Investor Signature</div>
            </div>
            <div className="text-right">
              <div className="border-t border-gray-400 w-48 ml-auto pt-1">Verified / Stamp</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default IslamicZakatModal;
