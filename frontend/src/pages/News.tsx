import { useEffect, useState, useCallback } from 'react';

import client from '../api/client';
import {
  Newspaper, RefreshCw, ExternalLink, Clock, Tag,
  AlertCircle, Wifi, WifiOff, ChevronDown, X, Search, Pin
} from 'lucide-react';

interface Article {
  id: number;
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  summary: string | null;
  tags: string[];
  relevance_score: number;
  scraped_at: string;
}

interface NewsStatus {
  status: 'idle' | 'refreshing' | 'error';
  last_refreshed_at: string | null;
  error_message: string | null;
}

interface ScraperStatusUI {
  scraper_name: string;
  is_healthy: boolean;
  requires_maintenance: boolean;
  error_message: string | null;
}

const TAG_COLORS: Record<string, string> = {
  PSX:           'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Gold:          'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Silver:        'bg-slate-400/10 text-slate-300 border-slate-400/20',
  SBP:           'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Inflation:     'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Interest Rate': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  IMF:           'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CPEC:          'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Geopolitical:  'bg-red-500/10 text-red-400 border-red-500/20',
  'Money Market':'bg-emerald-600/10 text-emerald-500 border-emerald-600/20',
  Equity:        'bg-indigo-600/10 text-indigo-500 border-indigo-600/20',
  Pakistan:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Rupee:         'bg-emerald-700/10 text-emerald-600 border-emerald-700/20',
  Oil:           'bg-slate-700/10 text-slate-400 border-slate-700/20',
  Sanctions:     'bg-red-900/10 text-red-500 border-red-900/20',
  Forex:         'bg-sky-500/10 text-sky-400 border-sky-500/20',
  MUFAP:         'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Commodities:   'bg-amber-600/10 text-amber-500 border-amber-600/20',
};

const DEFAULT_TAG_CLASS = 'bg-white/5 text-slate-300 border-white/10';

function timeAgo(isoStr: string | null): string {
  if (!isoStr) return 'Unknown date';
  const dt = new Date(isoStr);
  const diff = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ALL_TAGS = [
  'PSX', 'Gold', 'Silver', 'SBP', 'Inflation', 'Interest Rate',
  'IMF', 'CPEC', 'Geopolitical', 'Money Market', 'Pakistan', 'Rupee', 'Oil', 'Forex',
];

export default function News() {
  const [articles, setArticles]   = useState<Article[]>([]);
  const [status, setStatus]       = useState<NewsStatus | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [scrapers, setScrapers]     = useState<ScraperStatusUI[]>([]);
  const [pinningId, setPinningId]   = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await client.get('/news/status');
      setStatus(res.data);
      try {
        const sr = await client.get('/news/scrapers/status');
        setScrapers(sr.data);
      } catch (e) { console.error(e); }
      return res.data.status;
    } catch { return 'error'; }
  }, []);

  const fetchArticles = useCallback(async () => {
    try {
      const params: any = {};
      if (activeTag) params.tag = activeTag;
      const res = await client.get('/news/feed', { params });
      setArticles(res.data);
    } catch (e) {
      console.error('Failed to fetch articles', e);
    }
  }, [activeTag]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchStatus();
      await fetchArticles();
      setLoading(false);
    };
    init();
  }, []);

  // Re-fetch articles when tag changes
  useEffect(() => {
    if (!loading) fetchArticles();
  }, [activeTag]);

  // Poll status when refreshing
  useEffect(() => {
    if (!refreshing) return;
    const interval = setInterval(async () => {
      const s = await fetchStatus();
      if (s !== 'refreshing') {
        setRefreshing(false);
        await fetchArticles();
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshing]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await client.post('/news/refresh?force=true');
      await fetchStatus();
    } catch (e) {
      console.error('Refresh trigger failed', e);
      setRefreshing(false);
    }
  };

  // Client-side search filter
  const filteredArticles = articles.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      (a.summary || '').toLowerCase().includes(q) ||
      a.source.toLowerCase().includes(q)
    );
  });

  const handlePin = async (id: number) => {
    if (pinningId) return;
    setPinningId(id);
    try {
      await client.post(`/news/context/pin/${id}`);
      // Notify user visually that it worked (you can expand this with a toast system later)
      alert("Article successfully pinned to your AI World Context!");
    } catch (e) {
      console.error("Failed to pin", e);
      alert("Failed to pin article. See console.");
    }
    setPinningId(null);
  };

  const isStale = status?.last_refreshed_at
    ? (Date.now() - new Date(status.last_refreshed_at).getTime()) > 6 * 60 * 60 * 1000
    : true;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Newspaper className="text-emerald-500" size={26} />
              Market News
            </h2>
            <p className="text-text-secondary text-sm mt-1">
              {status?.last_refreshed_at
                ? `Last updated ${timeAgo(status.last_refreshed_at)}`
                : 'No data yet — click Refresh to fetch news'}
            </p>
          </div>
          <button
            id="news-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh News'}
          </button>
        </div>

        {/* Stale banner */}
        {isStale && !refreshing && status && (
          <div className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl text-warning text-sm">
            <WifiOff size={16} className="shrink-0" />
            <span>Data may be outdated (older than 6 hours). Click <strong>Refresh News</strong> to fetch the latest.</span>
          </div>
        )}

        {/* Scraper Maintenance Warnings */}
        {scrapers.filter(s => s.requires_maintenance).length > 0 && (
          <div className="flex flex-col gap-2 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle size={16} /> Data Sources Require Maintenance
            </div>
            <ul className="list-disc pl-8 space-y-1 text-xs opacity-90">
              {scrapers.filter(s => s.requires_maintenance).map(s => (
                <li key={s.scraper_name}>
                  <strong>{s.scraper_name}</strong>: {s.error_message || "Failing or using AI Fallback."}
                </li>
              ))}
            </ul>
            <p className="text-xs opacity-80 mt-1">
              *The UI and logic may continue working via GenAI fallbacks, but updating the scraper code is recommended to conserve tokens.
            </p>
          </div>
        )}

        {/* Refreshing banner */}
        {refreshing && (
          <div className="flex items-center gap-3 px-4 py-3 bg-electric-blue/10 border border-electric-blue/30 rounded-xl text-electric-blue text-sm">
            <Wifi size={16} className="shrink-0 animate-pulse" />
            <span>Fetching latest news and running AI analysis… This may take 30–60 seconds.</span>
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

        {/* Search + Tag Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input
              id="news-search-input"
              type="text"
              placeholder="Search headlines, sources…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-neon-purple transition-colors"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-4 h-4" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Tag pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${activeTag === null ? 'bg-neon-purple text-white border-neon-purple' : 'bg-white/5 text-text-secondary border-white/10 hover:border-white/30'}`}
            >
              All
            </button>
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${activeTag === tag ? (TAG_COLORS[tag] || DEFAULT_TAG_CLASS) + ' !opacity-100' : 'bg-white/5 text-text-secondary border-white/10 hover:border-white/30'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Article count */}
        {!loading && (
          <p className="text-xs text-text-secondary">
            Showing <span className="text-text-primary font-semibold">{filteredArticles.length}</span> article{filteredArticles.length !== 1 ? 's' : ''}
            {activeTag ? ` tagged "${activeTag}"` : ''}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </p>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-surface border border-white/5 rounded-2xl p-5 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
                <div className="h-3 bg-white/5 rounded w-1/3 mb-4" />
                <div className="h-3 bg-white/5 rounded w-full mb-2" />
                <div className="h-3 bg-white/5 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        {/* No articles */}
        {!loading && filteredArticles.length === 0 && (
          <div className="py-20 text-center">
            <Newspaper className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-40" />
            <p className="text-text-secondary">No articles found.</p>
            {!status?.last_refreshed_at && (
              <p className="text-text-secondary text-sm mt-2">Click <strong className="text-neon-purple">Refresh News</strong> to fetch the latest Pakistan market news.</p>
            )}
          </div>
        )}

        {/* Article cards */}
        {!loading && (
          <div className="space-y-4">
            {filteredArticles.map(article => {
              const isExpanded = expandedId === article.id;
              const hasSummary = article.summary && article.summary.length > 10;
              return (
                <article
                  key={article.id}
                  className="bg-surface border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all group relative overflow-hidden"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-neon-purple/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />

                  <div className="flex items-center justify-between gap-2 text-xs text-text-secondary mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neon-purple/80">{article.source}</span>
                      <span>·</span>
                      <Clock size={11} />
                      <span>{timeAgo(article.published_at)}</span>
                    </div>
                    <button
                      onClick={() => handlePin(article.id)}
                      disabled={pinningId === article.id}
                      title="Pin to World Context"
                      className="p-1.5 hover:bg-white/10 rounded border border-transparent hover:border-white/10 text-text-secondary hover:text-white transition-all disabled:opacity-50"
                    >
                      <Pin size={13} className={pinningId === article.id ? "animate-pulse text-neon-purple" : ""} />
                    </button>
                  </div>

                  {/* Headline */}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/link flex items-start gap-2"
                  >
                    <h3 className="text-base font-semibold text-text-primary group-hover/link:text-neon-purple transition-colors leading-snug flex-1">
                      {article.title}
                    </h3>
                    <ExternalLink size={14} className="text-text-secondary group-hover/link:text-neon-purple transition-colors mt-1 shrink-0" />
                  </a>

                  {/* Summary (collapsed/expanded) */}
                  {hasSummary && (
                    <div className="mt-3">
                      <p className={`text-sm text-text-secondary leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {article.summary}
                      </p>
                      {(article.summary || '').length > 120 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : article.id)}
                          className="mt-1 text-xs text-neon-purple/70 hover:text-neon-purple flex items-center gap-1 transition-colors"
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                          <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {article.tags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setActiveTag(tag)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all hover:opacity-80 ${TAG_COLORS[tag] || DEFAULT_TAG_CLASS}`}
                        >
                          <Tag size={9} />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
