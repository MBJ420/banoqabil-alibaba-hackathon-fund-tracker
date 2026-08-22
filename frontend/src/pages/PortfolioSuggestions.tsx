import { useEffect, useState } from 'react';
import client from '../api/client';
import { 
  ShieldCheck, AlertTriangle, AlertCircle, Info, TrendingUp, Lightbulb, Zap 
} from 'lucide-react';

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

const SEVERITY_STYLES = {
  danger: 'bg-red-500/10 border-red-500/30 text-red-500',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
};

const SEVERITY_ICONS = {
  danger: <AlertTriangle size={20} />,
  warning: <AlertCircle size={20} />,
  info: <Info size={20} />,
  success: <ShieldCheck size={20} />,
};

export default function PortfolioSuggestions() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [outperformersData, setOutperformersData] = useState<OutperformersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="text-neon-purple" size={26} />
            Portfolio Suggestions
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            Rule-based health checks and performance comparisons based on your latest statements.
          </p>
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
