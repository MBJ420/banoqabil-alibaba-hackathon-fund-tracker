import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useToast } from './Toast';
import {
  X,
  Database,
  Calendar,
  Building2,
  Trash2,
  Edit3,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface HoldingItem {
  index?: number;
  fund_name: string;
  category: string;
  market_value: number;
  gain_loss?: number;
  units?: number;
  nav?: number;
  percent_change?: number;
}

interface StatementRecord {
  id: number;
  portfolio_id: number;
  date: string;
  created_at: string | null;
  bank: string;
  account_number: string;
  holder_name: string;
  file_path: string | null;
  is_manual: boolean;
  summary: {
    total_market_value: number;
    total_gain_loss: number;
    total_investment: number;
  };
  holdings: HoldingItem[];
  holdings_count: number;
}

interface MetaInfo {
  institutions: string[];
  categories: string[];
  existing_accounts: { id: number; account_number: string; bank: string; holder_name: string }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

interface PendingAction {
  type: 'UPDATE_STATEMENT' | 'DELETE_STATEMENT' | 'DELETE_HOLDING' | 'CREATE_MANUAL';
  title: string;
  description: string;
  details?: string;
  execute: () => Promise<void>;
}

const DEFAULT_CATEGORIES = [
  'Money Market',
  'Equity',
  'Islamic Income',
  'Debt Market',
  'Gold',
  'Commodities',
  'Other',
];

const DEFAULT_BANKS = ['Meezan', 'HBL', 'Atlas', 'Faysal'];

export const PortfolioDataManagerModal: React.FC<Props> = ({ isOpen, onClose, onDataChanged }) => {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'ledger' | 'manual'>('ledger');
  const [statements, setStatements] = useState<StatementRecord[]>([]);
  const [meta, setMeta] = useState<MetaInfo>({
    institutions: DEFAULT_BANKS,
    categories: DEFAULT_CATEGORIES,
    existing_accounts: [],
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankFilter, setSelectedBankFilter] = useState('ALL');

  // Expanded statement ID in ledger
  const [expandedStatementId, setExpandedStatementId] = useState<number | null>(null);

  // Statement currently being edited (draft state)
  const [editingStatementId, setEditingStatementId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{
    date: string;
    bank: string;
    account_number: string;
    holdings: HoldingItem[];
  } | null>(null);

  // Manual entry form state
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualBank, setManualBank] = useState('Meezan');
  const [manualAccount, setManualAccount] = useState('MANUAL-001');
  const [manualHoldings, setManualHoldings] = useState<HoldingItem[]>([
    { fund_name: '', category: 'Money Market', market_value: 0, gain_loss: 0 },
  ]);

  // Confirmation warning modal state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deletePhysicalFile, setDeletePhysicalFile] = useState(true);

  // Fetch statements and metadata
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stmtsRes, metaRes] = await Promise.all([
        client.get('/api/statements/manage'),
        client.get('/api/statements/meta').catch(() => ({
          data: { institutions: DEFAULT_BANKS, categories: DEFAULT_CATEGORIES, existing_accounts: [] },
        })),
      ]);
      setStatements(stmtsRes.data || []);
      setMeta(metaRes.data);
    } catch (err: any) {
      toast('Failed to load portfolio statements: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  if (!isOpen) return null;

  // Format currency
  const formatPKR = (val: number) => {
    return 'PKR ' + (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Filtered statements
  const filteredStatements = statements.filter((s) => {
    const matchesBank = selectedBankFilter === 'ALL' || s.bank.toLowerCase() === selectedBankFilter.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      s.bank.toLowerCase().includes(q) ||
      s.account_number.toLowerCase().includes(q) ||
      s.date.includes(q) ||
      s.holdings.some((h) => h.fund_name.toLowerCase().includes(q) || h.category.toLowerCase().includes(q));
    return matchesBank && matchesSearch;
  });

  // Start editing a statement
  const handleStartEdit = (stmt: StatementRecord) => {
    setEditingStatementId(stmt.id);
    setExpandedStatementId(stmt.id);
    setEditDraft({
      date: stmt.date,
      bank: stmt.bank,
      account_number: stmt.account_number,
      holdings: stmt.holdings.map((h) => ({ ...h })),
    });
  };

  const handleCancelEdit = () => {
    setEditingStatementId(null);
    setEditDraft(null);
  };

  // Holding field change in draft
  const handleEditHoldingField = (index: number, field: keyof HoldingItem, val: any) => {
    if (!editDraft) return;
    const updated = [...editDraft.holdings];
    updated[index] = { ...updated[index], [field]: val };
    setEditDraft({ ...editDraft, holdings: updated });
  };

  // Add new holding to draft
  const handleAddHoldingToDraft = () => {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      holdings: [
        ...editDraft.holdings,
        { fund_name: '', category: 'Money Market', market_value: 0, gain_loss: 0 },
      ],
    });
  };

  // Remove holding row from draft
  const handleRemoveHoldingFromDraft = (index: number) => {
    if (!editDraft) return;
    if (editDraft.holdings.length <= 1) {
      toast('A statement must contain at least one fund. To remove all, delete the statement instead.', 'warning');
      return;
    }
    const updated = editDraft.holdings.filter((_, i) => i !== index);
    setEditDraft({ ...editDraft, holdings: updated });
  };

  // ── SAVE EDITS WITH CONFIRMATION ──────────────────────────────────────────
  const requestSaveStatementEdits = () => {
    if (!editDraft || !editingStatementId) return;

    if (!editDraft.date) {
      toast('Please enter a valid statement date.', 'error');
      return;
    }
    for (const h of editDraft.holdings) {
      if (!h.fund_name.trim()) {
        toast('All holdings must have a fund name.', 'error');
        return;
      }
      if (isNaN(Number(h.market_value)) || Number(h.market_value) < 0) {
        toast('Market value must be a valid positive number.', 'error');
        return;
      }
    }

    const currentTotal = editDraft.holdings.reduce((sum, h) => sum + Number(h.market_value || 0), 0);

    setPendingAction({
      type: 'UPDATE_STATEMENT',
      title: 'Confirm Statement Ledger Update',
      description: `You are modifying historical financial data for ${editDraft.bank} on date ${editDraft.date}.`,
      details: `Updated Valuation: ${formatPKR(currentTotal)} across ${editDraft.holdings.length} funds. Finalizing this change will immediately recalculate your Net Worth, Category Allocations, and Performance Charts.`,
      execute: async () => {
        const payload = {
          date: editDraft.date,
          bank: editDraft.bank,
          account_number: editDraft.account_number,
          holdings: editDraft.holdings.map((h) => ({
            fund_name: h.fund_name,
            category: h.category,
            market_value: Number(h.market_value),
            gain_loss: Number(h.gain_loss || 0),
            units: Number(h.units || 0),
            nav: Number(h.nav || 0),
          })),
        };
        await client.put(`/api/statements/${editingStatementId}`, payload);
        toast('Statement ledger updated successfully!', 'success');
        setEditingStatementId(null);
        setEditDraft(null);
        await fetchData();
        onDataChanged?.();
      },
    });
  };

  // ── DELETE STATEMENT WITH CONFIRMATION ────────────────────────────────────
  const requestDeleteStatement = (stmt: StatementRecord) => {
    const isManual = stmt.is_manual;
    setPendingAction({
      type: 'DELETE_STATEMENT',
      title: 'Confirm Statement Deletion',
      description: `Are you sure you want to permanently delete the statement from ${stmt.bank} dated ${stmt.date}?`,
      details: `This statement holds ${stmt.holdings_count} funds totaling ${formatPKR(
        stmt.summary.total_market_value
      )}. Deleting it will immediately remove it from your historical timeline and recalculate your Net Worth.`,
      execute: async () => {
        const deleteFileParam = !isManual && deletePhysicalFile;
        await client.delete(`/api/statements/${stmt.id}?delete_file=${deleteFileParam}`);
        toast(`Statement from ${stmt.bank} (${stmt.date}) deleted.`, 'success');
        if (editingStatementId === stmt.id) {
          setEditingStatementId(null);
          setEditDraft(null);
        }
        await fetchData();
        onDataChanged?.();
      },
    });
  };

  // ── DELETE SINGLE HOLDING WITH CONFIRMATION ───────────────────────────────
  const requestDeleteHolding = (stmt: StatementRecord, holdingIdx: number, holdingName: string) => {
    if (stmt.holdings_count <= 1) {
      toast('This is the only fund in this statement. Please delete the entire statement instead.', 'warning');
      return;
    }

    setPendingAction({
      type: 'DELETE_HOLDING',
      title: 'Confirm Fund Holding Removal',
      description: `Are you sure you want to remove '${holdingName}' from ${stmt.bank} statement (${stmt.date})?`,
      details: `The statement's total valuation will be reduced accordingly and all portfolio allocations will refresh.`,
      execute: async () => {
        await client.delete(`/api/statements/${stmt.id}/holdings/${holdingIdx}`);
        toast(`Removed '${holdingName}' successfully.`, 'success');
        await fetchData();
        onDataChanged?.();
      },
    });
  };

  // ── MANUAL MONTH ENTRY ───────────────────────────────────────────────────
  const handleAddManualHoldingRow = () => {
    setManualHoldings([
      ...manualHoldings,
      { fund_name: '', category: 'Money Market', market_value: 0, gain_loss: 0 },
    ]);
  };

  const handleRemoveManualHoldingRow = (idx: number) => {
    if (manualHoldings.length <= 1) return;
    setManualHoldings(manualHoldings.filter((_, i) => i !== idx));
  };

  const handleManualHoldingChange = (idx: number, field: keyof HoldingItem, val: any) => {
    const updated = [...manualHoldings];
    updated[idx] = { ...updated[idx], [field]: val };
    setManualHoldings(updated);
  };

  const requestCreateManualStatement = () => {
    if (!manualDate) {
      toast('Please enter a statement date.', 'error');
      return;
    }
    if (!manualBank.trim()) {
      toast('Please select or specify an institution.', 'error');
      return;
    }
    for (const h of manualHoldings) {
      if (!h.fund_name.trim()) {
        toast('Please enter a fund name for all rows.', 'error');
        return;
      }
      if (isNaN(Number(h.market_value)) || Number(h.market_value) < 0) {
        toast('Market value must be a valid positive number.', 'error');
        return;
      }
    }

    const totalVal = manualHoldings.reduce((sum, h) => sum + Number(h.market_value || 0), 0);

    setPendingAction({
      type: 'CREATE_MANUAL',
      title: 'Confirm Manual Month Entry',
      description: `Record manual portfolio entry for ${manualBank} on ${manualDate}.`,
      details: `Adding ${manualHoldings.length} fund(s) totaling ${formatPKR(
        totalVal
      )}. This will be saved to your local database ledger and incorporated into your charts, net worth, and tax calculations.`,
      execute: async () => {
        const payload = {
          date: manualDate,
          bank: manualBank.trim(),
          account_number: manualAccount.trim() || 'MANUAL-001',
          holdings: manualHoldings.map((h) => ({
            fund_name: h.fund_name.trim(),
            category: h.category,
            market_value: Number(h.market_value),
            gain_loss: Number(h.gain_loss || 0),
            units: Number(h.units || 0),
            nav: Number(h.nav || 0),
          })),
        };
        await client.post('/api/statements/manual', payload);
        toast(`Manual entry for ${manualDate} created successfully!`, 'success');
        setManualHoldings([{ fund_name: '', category: 'Money Market', market_value: 0, gain_loss: 0 }]);
        setActiveTab('ledger');
        await fetchData();
        onDataChanged?.();
      },
    });
  };

  // Execute confirmed action
  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setConfirming(true);
    try {
      await pendingAction.execute();
      setPendingAction(null);
    } catch (err: any) {
      toast('Operation failed: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6">
      <div className="bg-surface border border-[var(--color-white-10)] rounded-3xl w-full max-w-5xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-white-10)] flex items-center justify-between shrink-0 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-500 rounded-2xl border border-emerald-500/30 shadow-md shadow-emerald-500/10">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-text-primary tracking-tight">Portfolio Data Manager</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Database Ledger GUI
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Inspect, edit parsed statement records, delete incorrect data, or manually record monthly figures.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation & Refresh */}
        <div className="px-6 pt-4 pb-2 border-b border-[var(--color-white-5)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-surface/25">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'ledger'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                  : 'bg-[var(--color-white-5)] text-text-secondary hover:text-text-primary hover:bg-[var(--color-white-10)]'
              }`}
            >
              <Layers size={14} />
              <span>Statements & Holdings Ledger</span>
              <span className="ml-1 px-1.5 py-0.2 bg-black/20 text-text-secondary rounded-full text-[10px]">
                {statements.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'manual'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                  : 'bg-[var(--color-white-5)] text-text-secondary hover:text-text-primary hover:bg-[var(--color-white-10)]'
              }`}
            >
              <Plus size={14} />
              <span>Manual Month Entry</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1 text-text-secondary hover:text-text-primary p-1.5 rounded-lg bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] transition-colors"
              title="Refresh ledger"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto flex-1 p-6 custom-scrollbar space-y-6">
          {/* TAB 1: LEDGER VIEW */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by fund name, category, bank, or date (e.g. 2026-02)..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-emerald-500/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Filter size={14} className="text-text-secondary" />
                  <select
                    value={selectedBankFilter}
                    onChange={(e) => setSelectedBankFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="ALL" className="bg-[#0f172a]">All Institutions</option>
                    {meta.institutions.map((b) => (
                      <option key={b} value={b} className="bg-[#0f172a]">{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Statement List */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-secondary">
                  <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="text-xs">Loading portfolio ledger...</p>
                </div>
              ) : filteredStatements.length === 0 ? (
                <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center text-text-secondary space-y-3">
                  <Database size={36} className="mx-auto text-text-secondary/40" />
                  <p className="text-sm font-semibold text-white">No statements found</p>
                  <p className="text-xs max-w-sm mx-auto">
                    {searchQuery || selectedBankFilter !== 'ALL'
                      ? 'Try clearing your search filters to view your statements.'
                      : 'You have not imported any statements yet. Upload a PDF statement or use "Manual Month Entry" above to add your holdings.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStatements.map((stmt) => {
                    const isEditing = editingStatementId === stmt.id;
                    const isExpanded = expandedStatementId === stmt.id || isEditing;

                    return (
                      <div
                        key={stmt.id}
                        className={`border rounded-2xl transition-all overflow-hidden ${
                          isEditing
                            ? 'border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-900/10'
                            : 'border-white/5 bg-surface/40 hover:border-white/10'
                        }`}
                      >
                        {/* Statement Summary Card Header */}
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="p-2.5 bg-white/5 rounded-xl text-emerald-400 border border-white/5 shrink-0 mt-1 sm:mt-0">
                              <Building2 size={20} />
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-white">{stmt.bank}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-text-secondary border border-white/5">
                                  {stmt.account_number}
                                </span>
                                {stmt.is_manual ? (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Manual Entry
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    PDF Parsed
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                                <span className="flex items-center gap-1 font-mono">
                                  <Calendar size={12} />
                                  {stmt.date}
                                </span>
                                <span>•</span>
                                <span>{stmt.holdings_count} funds</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="text-left sm:text-right">
                              <p className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                                Total Valuation
                              </p>
                              <p className="text-base font-bold font-mono text-emerald-400">
                                {formatPKR(stmt.summary.total_market_value)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleStartEdit(stmt)}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-text-secondary hover:text-emerald-400 border border-white/5 transition-colors"
                                    title="Edit statement data"
                                  >
                                    <Edit3 size={15} />
                                  </button>

                                  <button
                                    onClick={() => requestDeleteStatement(stmt)}
                                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                                    title="Delete entire statement"
                                  >
                                    <Trash2 size={15} />
                                  </button>

                                  <button
                                    onClick={() =>
                                      setExpandedStatementId(isExpanded ? null : stmt.id)
                                    }
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                  >
                                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                  </button>
                                </>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-semibold transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={requestSaveStatementEdits}
                                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-md shadow-emerald-900/30 flex items-center gap-1.5"
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>Save Changes</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Holdings Table / Editor */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 border-t border-[var(--color-white-5)] bg-surface-highlight/30 space-y-4">
                            {isEditing && editDraft ? (
                              /* ── EDIT MODE ── */
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[var(--color-white-5)] rounded-xl border border-[var(--color-white-10)]">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                                      Statement Date
                                    </label>
                                    <input
                                      type="date"
                                      value={editDraft.date}
                                      onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })}
                                      className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                                      Institution
                                    </label>
                                    <input
                                      type="text"
                                      value={editDraft.bank}
                                      onChange={(e) => setEditDraft({ ...editDraft, bank: e.target.value })}
                                      className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                                      Account / Folio Number
                                    </label>
                                    <input
                                      type="text"
                                      value={editDraft.account_number}
                                      onChange={(e) =>
                                        setEditDraft({ ...editDraft, account_number: e.target.value })
                                      }
                                      className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                                      Holdings in this statement
                                    </p>
                                    <button
                                      onClick={handleAddHoldingToDraft}
                                      className="text-xs text-emerald-500 hover:text-emerald-600 flex items-center gap-1 font-semibold"
                                    >
                                      <Plus size={13} />
                                      <span>Add Fund</span>
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    {editDraft.holdings.map((h, hIdx) => (
                                      <div
                                        key={hIdx}
                                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-[var(--color-white-5)] rounded-xl border border-[var(--color-white-10)] items-center"
                                      >
                                        <div className="sm:col-span-4">
                                          <label className="block text-[9px] text-text-secondary uppercase mb-0.5">
                                            Fund Name
                                          </label>
                                          <input
                                            type="text"
                                            value={h.fund_name}
                                            onChange={(e) =>
                                              handleEditHoldingField(hIdx, 'fund_name', e.target.value)
                                            }
                                            placeholder="e.g. Meezan Cash Fund"
                                            className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                                          />
                                        </div>

                                        <div className="sm:col-span-3">
                                          <label className="block text-[9px] text-text-secondary uppercase mb-0.5">
                                            Category
                                          </label>
                                          <select
                                            value={h.category}
                                            onChange={(e) =>
                                              handleEditHoldingField(hIdx, 'category', e.target.value)
                                            }
                                            className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                                          >
                                            {meta.categories.map((cat) => (
                                              <option key={cat} value={cat} className="bg-surface text-text-primary">
                                                {cat}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="sm:col-span-3">
                                          <label className="block text-[9px] text-text-secondary uppercase mb-0.5">
                                            Market Value (PKR)
                                          </label>
                                          <input
                                            type="number"
                                            value={h.market_value}
                                            onChange={(e) =>
                                              handleEditHoldingField(
                                                hIdx,
                                                'market_value',
                                                parseFloat(e.target.value) || 0
                                              )
                                            }
                                            className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-emerald-500"
                                          />
                                        </div>

                                        <div className="sm:col-span-2 flex items-center justify-between gap-2">
                                          <div className="flex-1">
                                            <label className="block text-[9px] text-text-secondary uppercase mb-0.5">
                                              Gain/Loss (PKR)
                                            </label>
                                            <input
                                              type="number"
                                              value={h.gain_loss || 0}
                                              onChange={(e) =>
                                                handleEditHoldingField(
                                                  hIdx,
                                                  'gain_loss',
                                                  parseFloat(e.target.value) || 0
                                                )
                                              }
                                              className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-emerald-500"
                                            />
                                          </div>
                                          <button
                                            onClick={() => handleRemoveHoldingFromDraft(hIdx)}
                                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors mt-3"
                                            title="Delete holding"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* ── READ-ONLY EXPANDED VIEW ── */
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-[10px] text-text-secondary uppercase tracking-wider border-b border-white/10 pb-2">
                                      <th className="pb-2 font-semibold">Fund Name</th>
                                      <th className="pb-2 font-semibold">Category</th>
                                      <th className="pb-2 font-semibold text-right">Market Value</th>
                                      <th className="pb-2 font-semibold text-right">Gain / Loss</th>
                                      <th className="pb-2 text-center font-semibold">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5 font-mono">
                                    {stmt.holdings.map((h, hIdx) => {
                                      const isPos = (h.gain_loss || 0) >= 0;
                                      return (
                                        <tr key={hIdx} className="hover:bg-white/3">
                                          <td className="py-2.5 font-sans font-medium text-white">{h.fund_name}</td>
                                          <td className="py-2.5 font-sans">
                                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-text-secondary border border-white/5 text-[10px]">
                                              {h.category}
                                            </span>
                                          </td>
                                          <td className="py-2.5 text-right text-emerald-400 font-bold font-mono whitespace-nowrap">
                                            {formatPKR(h.market_value)}
                                          </td>
                                          <td
                                            className={`py-2.5 text-right font-mono whitespace-nowrap ${
                                              isPos ? 'text-emerald-400' : 'text-red-400'
                                            }`}
                                          >
                                            {isPos ? '+' : ''}
                                            {formatPKR(h.gain_loss || 0)}
                                          </td>
                                          <td className="py-2.5 text-center">
                                            <button
                                              onClick={() =>
                                                requestDeleteHolding(stmt, hIdx, h.fund_name)
                                              }
                                              className="p-1 text-text-secondary hover:text-red-400 transition-colors"
                                              title="Delete individual holding"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL MONTH ENTRY */}
          {activeTab === 'manual' && (
            <div className="max-w-2xl mx-auto space-y-6 bg-surface/30 border border-white/5 rounded-2xl p-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus size={18} className="text-emerald-400" />
                  Record Manual Month Statement
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  If you missed a statement or want to track custom/manual investments, simply provide the fund type and invested amount.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Institution / Bank
                  </label>
                  <select
                    value={manualBank}
                    onChange={(e) => setManualBank(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {meta.institutions.map((b) => (
                      <option key={b} value={b} className="bg-[#0f172a]">
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Statement Date
                  </label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Account / Folio Number
                  </label>
                  <input
                    type="text"
                    value={manualAccount}
                    onChange={(e) => setManualAccount(e.target.value)}
                    placeholder="e.g. MANUAL-001"
                    className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Holdings Rows */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-[var(--color-white-10)] pb-2">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Fund Holdings for this Month
                  </h4>
                  <button
                    onClick={handleAddManualHoldingRow}
                    className="text-xs text-emerald-500 hover:text-emerald-600 font-semibold flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Add Another Fund</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {manualHoldings.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-[var(--color-white-5)] rounded-xl border border-[var(--color-white-10)] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                          Fund #{idx + 1}
                        </span>
                        {manualHoldings.length > 1 && (
                          <button
                            onClick={() => handleRemoveManualHoldingRow(idx)}
                            className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                            Fund Type / Category *
                          </label>
                          <select
                            value={row.category}
                            onChange={(e) => handleManualHoldingChange(idx, 'category', e.target.value)}
                            className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                          >
                            {meta.categories.map((c) => (
                              <option key={c} value={c} className="bg-surface text-text-primary">
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                            Fund Name *
                          </label>
                          <input
                            type="text"
                            value={row.fund_name}
                            onChange={(e) => handleManualHoldingChange(idx, 'fund_name', e.target.value)}
                            placeholder="e.g. Meezan Cash Fund"
                            className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                            Value Invested / Market Value (PKR) *
                          </label>
                          <input
                            type="number"
                            value={row.market_value || ''}
                            onChange={(e) =>
                              handleManualHoldingChange(idx, 'market_value', parseFloat(e.target.value) || 0)
                            }
                            placeholder="e.g. 150000"
                            className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                            Gain / Loss to Date (PKR) (Optional)
                          </label>
                          <input
                            type="number"
                            value={row.gain_loss || ''}
                            onChange={(e) =>
                              handleManualHoldingChange(idx, 'gain_loss', parseFloat(e.target.value) || 0)
                            }
                            placeholder="e.g. 12000 (defaults to 0)"
                            className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t border-[var(--color-white-5)]">
                <button
                  onClick={requestCreateManualStatement}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2"
                >
                  <span>Review & Save Month Entry</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── SAFETY CONFIRMATION WARNING MODAL ────────────────────────────── */}
        {pendingAction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
            <div className="bg-surface border border-amber-500/30 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary tracking-tight">{pendingAction.title}</h3>
                  <p className="text-xs text-amber-500 font-medium mt-0.5">Safety Confirmation Warning</p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-2 text-xs">
                <p className="text-text-primary leading-relaxed font-medium">{pendingAction.description}</p>
                {pendingAction.details && (
                  <p className="text-text-secondary leading-relaxed pt-1 border-t border-white/5">
                    {pendingAction.details}
                  </p>
                )}
              </div>

              {/* Physical file checkbox for statement deletion */}
              {pendingAction.type === 'DELETE_STATEMENT' && (
                <label className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deletePhysicalFile}
                    onChange={(e) => setDeletePhysicalFile(e.target.checked)}
                    className="rounded bg-[var(--color-white-10)] border-[var(--color-white-20)] text-emerald-500 focus:ring-0"
                  />
                  <span>Also delete source PDF file from disk if present</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setPendingAction(null)}
                  disabled={confirming}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] transition-colors"
                >
                  Cancel / Keep Editing
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={confirming}
                  className={`px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md flex items-center gap-2 ${
                    pendingAction.type === 'DELETE_STATEMENT' || pendingAction.type === 'DELETE_HOLDING'
                      ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                  }`}
                >
                  {confirming ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <span>Confirm & Finalize</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioDataManagerModal;
