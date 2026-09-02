import { useEffect, useState, useCallback, type ReactNode } from 'react';
import client from '../api/client';
import { semanticTagClass } from '../utils/tagFamily';
import {
  Brain, RefreshCw, TrendingUp, TrendingDown, Minus,
  Globe, ChevronDown, ChevronUp, AlertCircle, Sparkles,
  BarChart2, Clock, Zap, X, Coins, Banknote, Landmark, HelpCircle
} from 'lucide-react';
import FeatureInfoModal, { type FeatureGuideContent } from '../components/FeatureInfoModal';

const AI_NEWS_GUIDE: FeatureGuideContent = {
  title: 'AI Market Intelligence',
  subtitle: 'How Gemini AI extracts macro insights from Dawn & Business Recorder for mutual fund categories',
  badge: 'Gemini AI Macro Pipeline',
  overview: 'This intelligence module scans real-time Pakistani financial news, identifies macro catalysts (State Bank policy rates, IMF tranche approvals, commodity price shifts), and uses a 2-pass AI pipeline to predict directional impacts across Equity, Income, Money Market, and Gold mutual funds.',
  howToUse: [
    'View Short-Term (1-3 weeks), Medium-Term (1-3 months), and Long-Term (6-12 months) sentiment pills.',
    'Click on any asset card (e.g. PSX Stocks or Gold) to expand Gemini\'s detailed reasoning.',
    'Check "Active Market Drivers" at the bottom to see specific macro catalysts currently pinned by AI.',
    'Click "Refresh Analysis" to trigger a live re-analysis of today\'s breaking headlines.'
  ],
  mathExplanation: [
    {
      formulaName: 'Sentiment Scoring & Normalization',
      formula: 'Impact_Score ∈ [-1.0 (Strongly Bearish), 0.0 (Neutral), +1.0 (Strongly Bullish)]',
      description: 'Scores quantify directional conviction across asset classes based on macro monetary policy.'
    },
    {
      formulaName: 'Time-Horizon Decay Weights',
      formula: 'Aggregate_Impact = (w_short × S) + (w_med × M) + (w_long × L)',
      description: 'Differentiates transient noise (e.g. daily rupee fluctuation) from structural macroeconomic shifts.'
    }
  ],
  proTips: [
    'Interest Rate Inversion: When the State Bank cuts policy rates, Equity funds typically surge while Money Market yields drop.',
    'Use AI insights as macro situational awareness, not instant buy/sell signals.'
  ],
  disclaimer: 'AI sentiment predictions are generated probabilistically using Large Language Models and do not constitute financial advice or guaranteed market performance.'
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImpactTier {
  score: number;
  direction: 'Bullish' | 'Bearish' | 'Neutral';
  reason: string;
}

interface AssetPrediction {
  short: ImpactTier;
  medium: ImpactTier;
  long: ImpactTier;
  reasoning: string;
}

interface AIProviderInfo {
  provider: string;
  model: string;
  is_alibaba_cloud: boolean;
  engine: string;
  status: string;
}

interface PredictionResponse {
  generated_at: string | null;
  predictions: Record<string, AssetPrediction>;
  ai_provider?: AIProviderInfo;
}

interface WorldContextEntry {
  id: number;
  fact: string;
  category: string | null;
  is_active: boolean;
  added_at: string;
  impact_scores: Record<string, { direction: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_ORDER = ['PSX Stocks (Equity Funds)', 'Money Market', 'Income Funds', 'Gold', 'Silver'];

const ASSET_ICONS: Record<string, ReactNode> = {
  'PSX Stocks (Equity Funds)': <TrendingUp size={22} className="text-emerald-400" />,
  Gold: <Coins size={22} className="text-amber-400" />,
  Silver: <Coins size={22} className="text-slate-300" />,
  'Money Market': <Banknote size={22} className="text-sky-400" />,
  'Income Funds': <Landmark size={22} className="text-indigo-400" />,
};

// Semantic category colors are provided by ../utils/tagFamily.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const isPositive = score > 0;
  const isNegative = score < 0;

  const color =
    isPositive ? 'text-emerald-400' :
    isNegative ? 'text-red-400'     : 'text-slate-400';

  const Icon =
    isPositive ? TrendingUp  :
    isNegative ? TrendingDown : Minus;

  const prefix = isPositive ? '+' : isNegative ? '-' : '±';

  const bgColor =
    isPositive ? 'bg-emerald-500/10 border-emerald-500/20' :
    isNegative ? 'bg-red-500/10 border-red-500/20'         :
                 'bg-white/5 border-white/10';

  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-sm font-bold ${bgColor} ${color}`}>
      <Icon size={13} />
      <span>{prefix}{Math.abs(score)}/10</span>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const isPositive = score > 0;
  const isNegative = score < 0;
  
  const barColor =
    isPositive ? 'bg-emerald-500' :
    isNegative ? 'bg-red-500'     : 'bg-slate-500';
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
        style={{ width: `${Math.abs(score) * 10}%` }}
      />
    </div>
  );
}

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return 'Not yet';
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Asset Row Component ──────────────────────────────────────────────────────

function AssetRow({ assetClass, data }: { assetClass: string; data: AssetPrediction }) {
  const [expanded, setExpanded] = useState(false);
  const icon = ASSET_ICONS[assetClass] ?? <BarChart2 size={22} className="text-text-secondary" />;

  const tiers = [
    { label: 'Short', key: 'short', horizon: 'Short-term (days)', value: data.short },
    { label: 'Medium', key: 'medium', horizon: 'Medium-term (1-3 months)', value: data.medium },
    { label: 'Long', key: 'long', horizon: 'Long-term (1+ year)', value: data.long },
  ];

  // Overall signal = tier with the highest magnitude of impact
  const maxAbsScore = Math.max(
    Math.abs(data.short?.score || 0),
    Math.abs(data.medium?.score || 0),
    Math.abs(data.long?.score || 0)
  );
  const dominantTier = tiers.find(t => Math.abs(t.value?.score || 0) === maxAbsScore)?.value;

  return (
    <div className="bg-surface border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden transition-all group">
      {/* Summary row */}
      <button
        id={`asset-row-${assetClass.replace(/\s+/g, '-').toLowerCase()}`}
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/3 transition-colors"
      >
        <span className="shrink-0 flex items-center">{icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-text-primary text-sm">{assetClass}</span>
            {dominantTier && (
              <ScoreBadge score={dominantTier.score} />
            )}
          </div>
          {/* 3 mini score bars */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {tiers.map(({ label, value }) => value && (
              <div key={label} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-secondary">{label}</span>
                  <span className={`text-xs font-semibold ${
                    value.score > 0 ? 'text-emerald-400' :
                    value.score < 0 ? 'text-red-400' : 'text-slate-400'
                  }`}>{Math.abs(value.score)}/10</span>
                </div>
                <ScoreBar score={value.score} />
              </div>
            ))}
          </div>
        </div>

        <div className="text-text-secondary shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-4 bg-white/2">
          {tiers.map(({ key, horizon, value }) => value && (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{horizon}</span>
                <ScoreBadge score={value.score} />
              </div>
              <ScoreBar score={value.score} />
              <p className="text-sm text-text-secondary leading-relaxed">{value.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function AINews() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [worldContext, setWorldContext] = useState<WorldContextEntry[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [predRes, ctxRes, statusRes] = await Promise.all([
        client.get('/news/prediction'),
        client.get('/news/context'),
        client.get('/news/status'),
      ]);
      setPredictions(predRes.data);
      setWorldContext(ctxRes.data);
      setStatus(statusRes.data);
    } catch (e) {
      console.error('Failed to fetch AI news data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Sync refreshing state if server is analyzing on initial load
  useEffect(() => {
    if (status?.ai_status === 'analyzing' && !refreshing) {
      setRefreshing(true);
    }
  }, [status?.ai_status]);

  // Poll status when refreshing
  useEffect(() => {
    if (!refreshing) return;
    const interval = setInterval(async () => {
      try {
        const res = await client.get('/news/status');
        const s = res.data.ai_status;
        setStatus(res.data);
        if (s !== 'analyzing') {
          setRefreshing(false);
          await fetchAll();
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll status', err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshing, fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await client.post('/news/refresh-ai?force=true');
    } catch (e) { 
      setRefreshing(false);
      console.error('Failed to refresh news', e);
    }
  };


  const handleDeactivateContext = async (id: number) => {
    try {
      await client.delete(`/news/context/${id}`);
      setWorldContext(prev => prev.filter(e => e.id !== id));
    } catch (e) { console.error('Failed to deactivate context entry', e); }
  };

  const hasPredictions = predictions && Object.keys(predictions.predictions).length > 0;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
      <FeatureInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        content={AI_NEWS_GUIDE}
      />
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Brain className="text-emerald-500" size={26} />
                AI Market Analysis
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                <Sparkles size={11} />
                {predictions?.ai_provider?.is_alibaba_cloud
                  ? `Alibaba Cloud Model Studio (${predictions.ai_provider.model})`
                  : 'Alibaba Cloud Qwen 2.5 / Gemini'}
              </span>
            </div>
            <p className="text-text-secondary text-sm mt-1">
              Powered by {predictions?.ai_provider?.provider || 'Alibaba Cloud Qwen 2.5'} · {predictions?.generated_at ? `Analyzed ${timeAgo(predictions.generated_at)}` : 'No analysis yet'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsInfoOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-[var(--color-white-10)] hover:border-emerald-500/50 text-xs font-semibold text-text-secondary hover:text-emerald-400 transition-all shadow-sm"
              title="Learn how this feature works"
            >
              <HelpCircle size={15} className="text-emerald-400" />
              <span>How it Works</span>
            </button>
            <button
              id="ai-news-refresh-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Analyzing…' : 'Refresh Analysis'}
            </button>
          </div>
        </div>

        {/* Refreshing banner */}
        {refreshing && (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-sm">
            <Sparkles size={16} className="shrink-0 animate-pulse" />
            <span>Alibaba Cloud Qwen 2.5 is analyzing today's news. Running 2-pass AI pipeline… This takes 15–30 seconds.</span>
          </div>
        )}

        {/* Error banner */}
        {status?.status === 'error' && (
          <div className="flex items-start gap-3 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Last refresh failed</p>
              {status.error_message && <p className="text-danger/70 text-xs mt-0.5">{status.error_message}</p>}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface border border-white/5 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-white/10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-1/4" />
                    <div className="h-2 bg-white/5 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No predictions */}
        {!loading && !hasPredictions && (
          <div className="py-20 text-center">
            <Brain className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-40" />
            <p className="text-text-secondary">No AI analysis yet.</p>
            <p className="text-text-secondary text-sm mt-2">Click <strong className="text-neon-purple">Refresh Analysis</strong> to fetch news and run the AI pipeline.</p>
          </div>
        )}

        {/* Panel A — Asset Impact Scores */}
        {!loading && hasPredictions && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={18} className="text-electric-blue" />
              <h3 className="font-bold text-text-primary">Asset Impact Scores</h3>
              <span className="text-xs text-text-secondary ml-1">Click any row to expand reasoning</span>
            </div>
            <div className="space-y-3">
              {ASSET_ORDER.map(asset => {
                const data = predictions!.predictions[asset];
                if (!data) return null;
                return <AssetRow key={asset} assetClass={asset} data={data} />;
              })}
              {/* Any extra assets not in order */}
              {Object.entries(predictions!.predictions)
                .filter(([k]) => !ASSET_ORDER.includes(k))
                .map(([asset, data]) => (
                  <AssetRow key={asset} assetClass={asset} data={data} />
                ))}
            </div>
          </section>
        )}

        {/* Panel B — World Context */}
        {!loading && (
          <section>
            <button
              id="world-context-toggle"
              onClick={() => setContextExpanded(e => !e)}
              className="w-full flex items-center gap-2 mb-4 group"
            >
              <Globe size={18} className="text-emerald-500" />
              <h3 className="font-bold text-text-primary flex-1 text-left">
                Persistent World Context
                <span className="ml-2 text-xs text-text-secondary font-normal">
                  ({worldContext.length} active events)
                </span>
              </h3>
              {contextExpanded ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
            </button>

            {contextExpanded && (
              <>
                {worldContext.length === 0 ? (
                  <div className="text-center py-10">
                    <Globe className="w-10 h-10 text-text-secondary mx-auto mb-3 opacity-30" />
                    <p className="text-text-secondary text-sm">No active world context entries yet.</p>
                    <p className="text-text-secondary text-xs mt-1">Gemini will populate this after the first AI analysis run.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {worldContext.map(entry => {
                      const catColor = semanticTagClass(entry.category || '');
                      return (
                        <div
                          key={entry.id}
                          className="bg-surface border border-white/5 rounded-2xl p-4 flex items-start gap-3 group hover:border-white/10 transition-all"
                        >
                          <div className="pt-0.5 shrink-0">
                            <Zap size={14} className="text-neon-purple" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {entry.category && (
                                <span className={catColor}>
                                  {entry.category}
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-xs text-text-secondary">
                                <Clock size={10} />
                                {timeAgo(entry.added_at)}
                              </span>
                            </div>
                            <p className="text-sm text-text-primary leading-relaxed">{entry.fact}</p>
                            {/* Impact indicators */}
                            {entry.impact_scores && Object.keys(entry.impact_scores).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {Object.entries(entry.impact_scores).map(([asset, val]) => {
                                  const dir = val.direction;
                                  const dirClass =
                                    dir === 'Bullish' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                    dir === 'Bearish' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                                         'text-slate-400 bg-white/5 border-white/10';
                                  return (
                                    <span key={asset} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${dirClass}`}>
                                      {asset}: {dir}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeactivateContext(entry.id)}
                            title="Mark as resolved"
                            className="shrink-0 p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Methodology note */}
        {!loading && (
          <div className="flex items-start gap-3 px-4 py-3 bg-white/3 border border-white/5 rounded-xl text-xs text-text-secondary">
            <Sparkles size={14} className="text-neon-purple shrink-0 mt-0.5" />
            <p>
              Analysis is generated by <strong className="text-text-primary">Gemini AI</strong> using a 2-pass pipeline:
              first updating long-term World Context, then scoring each asset across short, medium, and long time horizons.
              Sources include Dawn Business, Business Recorder, Reuters, NewsData.io, Alpha Vantage, and Trading Economics.
              <strong className="text-warning"> Not financial advice.</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
