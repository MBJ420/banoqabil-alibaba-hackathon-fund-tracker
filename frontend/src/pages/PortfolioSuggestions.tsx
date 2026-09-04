import { useEffect, useState } from 'react';
import client from '../api/client';
import { 
  ShieldCheck, AlertTriangle, AlertCircle, Info, TrendingUp, Lightbulb, Zap, HelpCircle,
  BrainCircuit, Sparkles, CheckCircle2, ChevronRight, RefreshCw
} from 'lucide-react';
import FeatureInfoModal, { type FeatureGuideContent } from '../components/FeatureInfoModal';

const SUGGESTIONS_GUIDE: FeatureGuideContent = {
  title: 'Portfolio Health & Suggestions',
  subtitle: 'Algorithmic risk diagnostics and peer fund comparison across Pakistan mutual funds',
  badge: 'Rule Engine & Scoring',
  overview: 'This module analyzes your overall mutual fund portfolio health, checks for dangerous asset concentration, and algorithmically scans 185+ live funds from MUFAP to identify top-performing peer funds that could replace underperforming holdings.',
  howToUse: [
    'Review your Overall Health Status badge (Optimal, Moderate, or Action Required).',
    'Read Health Diagnostic Alerts: Identifies over-exposure to single banks, high cash drag, or lack of Shariah compliance.',
    'Inspect "Top Outperforming Peer Funds": Compares your currently held funds against top-ranked peer funds in the same category over 1M, 6M, and 1Y periods.'
  ],
  mathExplanation: [
    {
      formulaName: 'Composite Performance Scoring',
      formula: 'Score = (0.20 × R_1m) + (0.30 × R_6m) + (0.50 × R_1y)',
      description: 'Weights long-term 1-year returns highest (50%) to prevent short-term market noise from distorting fund quality.'
    },
    {
      formulaName: 'Outperformance Gap',
      formula: 'Gap = Peer_Score - User_Fund_Score',
      description: 'Calculates the exact percentage alpha you could gain by reallocating to the category leader.'
    }
  ],
  proTips: [
    'Diversification Rule: No single asset management company (AMC) should hold more than 50% of your total net worth.',
    'Review performance consistency across all three timeframes (1M, 6M, 1Y) before switching funds.'
  ],
  disclaimer: 'Suggestions are generated algorithmically based on historical MUFAP returns and do not constitute certified investment advisory.'
};

interface HealthAlert {
  id: string;
  title: string;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'danger';
  data: any;
}

interface HealthCheckResponse {
  alerts: HealthAlert[];
  overall_health: 'success' | 'info' | 'warning' | 'danger';
}

interface OutperformerData {
  rank: number;
  fund_name: string;
  bank: string;
  fund_type: string;
  composite_score: number;
  gap: number;
  data_source: string;
  breakdown: {
    '1m': { user: number | null; peer: number | null };
    '6m': { user: number | null; peer: number | null };
    '1y': { user: number | null; peer: number | null };
  };
}

interface OutperformerResult {
  user_fund: string;
  user_fund_short: string | null;
  user_fund_type: string;
  user_composite_score: number;
  user_data_source: string;
  no_significant_underperformance: boolean;
  top_outperformers: OutperformerData[];
}

interface OutperformersResponse {
  results: OutperformerResult[];
}

// ── AI Diagnostic Interfaces ──────────────────────────────────────────────────

interface DiagRecommendation {
  priority: number;
  type: string;
  title: string;
  detail: string;
  suggested_allocation_pct?: number | null;
}

interface AIDiagnosticResponse {
  risk_score: number;
  risk_label: string;
  risk_color: 'success' | 'info' | 'warning' | 'danger';
  summary: string;
  recommendations: DiagRecommendation[];
  strengths: string[];
  disclaimer: string;
  ai_provider: string;
  ai_model: string;
}

const SEVERITY_STYLES = {
  danger: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
};

const SEVERITY_ICONS = {
  danger: <AlertTriangle size={20} />,
  warning: <AlertCircle size={20} />,
  info: <Info size={20} />,
  success: <ShieldCheck size={20} />,
};

export default function PortfolioSuggestions() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [outperformersData, setOutperformersData] = useState<OutperformersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI Diagnostic state — not auto-run, triggered by user
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagData, setDiagData] = useState<AIDiagnosticResponse | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [healthRes, outperfRes] = await Promise.all([
          client.get('/dashboard/health-check'),
          client.get('/dashboard/fund-outperformers'),
        ]);
        setHealthData(healthRes.data);
        setOutperformersData(outperfRes.data);
      } catch (err: any) {
        console.error("Failed to load suggestions", err);
        setError(err.response?.data?.detail || err.message || "Failed to load suggestions.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const runDiagnostic = async () => {
    setDiagLoading(true);
    setDiagError(null);
    setDiagData(null);
    try {
      const res = await client.post('/dashboard/ai-diagnostic');
      setDiagData(res.data);
    } catch (err: any) {
      setDiagError(err.response?.data?.detail || err.message || 'AI diagnostic failed.');
    } finally {
      setDiagLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
      <FeatureInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        content={SUGGESTIONS_GUIDE}
      />
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Lightbulb className="text-emerald-400" size={26} />
              Portfolio Suggestions
            </h2>
            <p className="text-text-secondary text-sm mt-1">
              Rule-based health checks and performance comparisons based on your latest statements.
            </p>
          </div>
          <button
            onClick={() => setIsInfoOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-[var(--color-white-10)] hover:border-emerald-500/50 text-xs font-semibold text-text-secondary hover:text-emerald-400 transition-all shadow-sm self-start sm:self-auto shrink-0"
            title="Learn how this feature works"
          >
            <HelpCircle size={15} className="text-emerald-400" />
            <span>How it Works & Guide</span>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger flex items-start gap-3">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-32 bg-surface animate-pulse rounded-2xl border border-white/5" />
            <div className="h-64 bg-surface animate-pulse rounded-2xl border border-white/5" />
          </div>
        ) : (
          <>
            {/* Diversification Risk Section */}
            <section className="bg-surface border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ShieldCheck size={20} className="text-neon-purple" />
                Diversification & Risk Health
              </h3>
              
              {healthData?.alerts.length === 0 ? (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${SEVERITY_STYLES.success}`}>
                  <div className="shrink-0 mt-0.5">{SEVERITY_ICONS.success}</div>
                  <div>
                    <h4 className="font-semibold text-white">Portfolio Balanced</h4>
                    <p className="text-sm opacity-90 mt-1">Your asset allocation shows no immediate concentration risks.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {healthData?.alerts.map((alert) => (
                    <div key={alert.id} className={`p-4 rounded-xl border flex items-start gap-3 ${SEVERITY_STYLES[alert.severity]}`}>
                      <div className="shrink-0 mt-0.5">{SEVERITY_ICONS[alert.severity]}</div>
                      <div>
                        <h4 className="font-semibold text-white">{alert.title}</h4>
                        <p className="text-sm opacity-90 mt-1">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── AI Portfolio Diagnostic Section ────────────────────────── */}
            <section className="bg-surface border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              {/* Subtle AI glow background */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-transparent pointer-events-none rounded-2xl" />

              <div className="relative">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <BrainCircuit size={20} className="text-violet-400" />
                      AI Portfolio Diagnostic
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                        <Sparkles size={9} />
                        Alibaba Cloud · {diagData ? diagData.ai_model : 'Qwen'}
                      </span>
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">
                      Contextual risk analysis using your % allocations and live macro intelligence. No amounts or personal data are shared.
                    </p>
                  </div>
                  <button
                    onClick={runDiagnostic}
                    disabled={diagLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all shadow-lg shadow-violet-900/30 shrink-0 self-start sm:self-auto"
                  >
                    {diagLoading
                      ? <><RefreshCw size={13} className="animate-spin" /> Analyzing…</>
                      : diagData
                        ? <><RefreshCw size={13} /> Re-run Diagnostic</>
                        : <><BrainCircuit size={13} /> Run AI Diagnostic</>
                    }
                  </button>
                </div>

                {/* Loading State */}
                {diagLoading && (
                  <div className="flex flex-col items-center gap-3 py-10 text-text-secondary">
                    <div className="w-10 h-10 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin" />
                    <p className="text-sm">Qwen 2.5 is analyzing your portfolio structure and macro context…</p>
                  </div>
                )}

                {/* Error State */}
                {diagError && !diagLoading && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-start gap-3 text-sm">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <p>{diagError}</p>
                  </div>
                )}

                {/* Empty / prompt state */}
                {!diagLoading && !diagData && !diagError && (
                  <div className="flex flex-col items-center gap-2 py-10 text-text-secondary border border-dashed border-white/10 rounded-xl">
                    <BrainCircuit size={30} className="text-violet-500/40" />
                    <p className="text-sm">Click <strong className="text-violet-400">Run AI Diagnostic</strong> to generate your personalized risk analysis.</p>
                    <p className="text-xs opacity-60">Uses live macro context from the AI News module.</p>
                  </div>
                )}

                {/* Result Card */}
                {diagData && !diagLoading && (() => {
                  const scoreColor = {
                    success: 'text-emerald-400',
                    info:    'text-blue-400',
                    warning: 'text-yellow-400',
                    danger:  'text-red-400',
                  }[diagData.risk_color];
                  const scoreBg = {
                    success: 'bg-emerald-500/10 border-emerald-500/30',
                    info:    'bg-blue-500/10 border-blue-500/30',
                    warning: 'bg-yellow-500/10 border-yellow-500/30',
                    danger:  'bg-red-500/10 border-red-500/30',
                  }[diagData.risk_color];

                  return (
                    <div className="space-y-5">
                      {/* Risk Score + Summary Row */}
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Score Gauge */}
                        <div className={`flex flex-col items-center justify-center p-5 rounded-2xl border shrink-0 min-w-[120px] ${scoreBg}`}>
                          <span className={`text-4xl font-black tabular-nums ${scoreColor}`}>{diagData.risk_score}</span>
                          <span className="text-[10px] text-text-secondary mt-1 uppercase tracking-widest">/ 100</span>
                          <span className={`text-xs font-bold mt-2 ${scoreColor}`}>{diagData.risk_label}</span>
                        </div>
                        {/* Summary */}
                        <div className="flex-1 flex flex-col justify-center bg-black/20 rounded-2xl border border-white/5 p-4">
                          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1 font-semibold">AI Analysis</p>
                          <p className="text-sm text-white/90 leading-relaxed">{diagData.summary}</p>
                        </div>
                      </div>

                      {/* Strengths */}
                      {diagData.strengths.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {diagData.strengths.map((s, i) => (
                            <span key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
                              <CheckCircle2 size={11} />
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Recommendations */}
                      {diagData.recommendations.length > 0 && (
                        <div>
                          <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold mb-3">Rebalancing Recommendations</p>
                          <div className="space-y-3">
                            {diagData.recommendations.map((rec, i) => {
                              const typeColor: Record<string, string> = {
                                rebalance:       'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
                                diversify:       'text-blue-400 bg-blue-500/10 border-blue-500/30',
                                reduce_risk:     'text-red-400 bg-red-500/10 border-red-500/30',
                                increase_growth: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                                tax_note:        'text-violet-400 bg-violet-500/10 border-violet-500/30',
                              };
                              const typeLabel: Record<string, string> = {
                                rebalance: 'Rebalance', diversify: 'Diversify',
                                reduce_risk: 'Reduce Risk', increase_growth: 'Growth Opportunity', tax_note: 'Tax Note',
                              };
                              const cls = typeColor[rec.type] ?? 'text-text-secondary bg-white/5 border-white/10';
                              return (
                                <div key={i} className="flex gap-3 bg-black/20 rounded-xl border border-white/5 p-4">
                                  <div className={`text-xs font-bold px-2 py-0.5 rounded-md border h-fit shrink-0 mt-0.5 ${cls}`}>
                                    {rec.priority}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <p className="font-semibold text-sm text-white">{rec.title}</p>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>
                                        {typeLabel[rec.type] ?? rec.type}
                                      </span>
                                    </div>
                                    <p className="text-xs text-text-secondary leading-relaxed">{rec.detail}</p>
                                    {rec.suggested_allocation_pct != null && (
                                      <div className="flex items-center gap-1.5 mt-2 text-xs text-violet-300">
                                        <ChevronRight size={11} />
                                        Suggested target: <strong>{rec.suggested_allocation_pct}%</strong>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <p className="text-[10px] text-text-secondary/60 italic pt-1">{diagData.disclaimer}</p>
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* Outperformance Intelligence Section */}
            <section className="bg-surface border border-white/5 rounded-2xl p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp size={20} className="text-neon-purple" />
                  Fund Outperformance Intelligence
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Comparing your funds against peer funds of the EXACT same type. Shows up to 3 better performers if the gap is significant.
                </p>
              </div>

              {outperformersData?.results.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-6">No trackable funds found in your portfolio to compare.</p>
              ) : (
                <div className="space-y-6">
                  {outperformersData?.results.map((res, idx) => (
                    <div key={idx} className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                      {/* User Fund Header */}
                      <div className="p-4 bg-white/5 border-b border-white/10 flex flex-wrap justify-between items-center gap-4">
                        <div>
                          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Your Fund</p>
                          <h4 className="font-bold text-white flex items-center gap-2">
                            {res.user_fund} 
                            {res.user_fund_short && <span className="text-xs text-text-secondary bg-white/10 px-2 py-0.5 rounded-full">{res.user_fund_short}</span>}
                          </h4>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] px-2 py-0.5 bg-neon-purple/20 text-neon-purple border border-neon-purple/30 rounded-md">{res.user_fund_type}</span>
                            <span className="text-[10px] text-text-secondary">Average Return: {res.user_composite_score}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Peer List */}
                      <div className="p-4">
                        {res.no_significant_underperformance ? (
                          <div className="flex items-center gap-2 text-success text-sm py-2">
                            <ShieldCheck size={16} /> No significant underperforming gap found against peer funds.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {res.top_outperformers.map((peer, pIdx) => (
                              <div key={pIdx} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-neon-purple/30 transition-colors">
                                <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-black bg-neon-purple px-1.5 py-0.5 rounded">#{peer.rank}</span>
                                      <h5 className="font-bold text-white">{peer.fund_name}</h5>
                                    </div>
                                    <p className="text-xs text-text-secondary mt-1">{peer.bank} • {peer.fund_type} • Outperforms by <strong className="text-success">+{peer.gap}%</strong> gap</p>
                                  </div>
                                </div>
                                
                                {/* 1M, 6M, 1Y Table */}
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                  {['1m', '6m', '1y'].map((period) => {
                                    const pUser = peer.breakdown[period as keyof typeof peer.breakdown].user;
                                    const pPeer = peer.breakdown[period as keyof typeof peer.breakdown].peer;
                                    const periodLabel = period.toUpperCase();
                                    return (
                                      <div key={period} className="bg-black/30 rounded-lg p-3 text-center flex flex-col justify-center">
                                        <div className="text-[10px] text-text-secondary mb-2 uppercase tracking-wide font-semibold">{periodLabel}</div>
                                        <div className="flex flex-col gap-1 items-center text-xs">
                                          <div className="text-text-secondary">Your Fund: {pUser !== null ? `${pUser}%` : '--'}</div>
                                          <div className={`font-semibold ${pPeer !== null && pUser !== null && pPeer > pUser ? 'text-success' : 'text-white'}`}>Peer: {pPeer !== null ? `${pPeer}%` : '--'}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                
                                {/* Data Source Warning */}
                                {peer.data_source === 'mufap_only' && (
                                  <div className="mt-3 flex items-start gap-2 text-[10px] text-warning/80 bg-warning/5 p-2 rounded border border-warning/10">
                                    <Zap size={12} className="shrink-0 mt-0.5" />
                                    <span>Using MUFAP data only. Upload latest FMR PDF for more comprehensive figures.</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
