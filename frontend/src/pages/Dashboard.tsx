import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import client from '../api/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { LogOut, LayoutDashboard, Database, TrendingUp, Zap, ArrowUpRight, Activity, Menu, Building2, Download, FileText, Sun, Moon, Calculator, Info, Search, UploadCloud, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, Newspaper, Brain, Lightbulb, X, Eye, EyeOff, PiggyBank, Receipt, LineChart } from 'lucide-react';
import StatementUploadModal from '../components/StatementUploadModal';
import { useToast } from '../components/Toast';

const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPKR = (amount: number | null | undefined): string =>
    `PKR ${(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toLacs = (amount: number): string =>
    `${(amount / 100000).toLocaleString(undefined, { maximumFractionDigits: 2 })} Lacs`;

const toCrores = (amount: number): string =>
    `${(amount / 10000000).toLocaleString(undefined, { maximumFractionDigits: 2 })} Crore`;

const Dashboard = () => {
    const [summary, setSummary] = useState<any>(null);
    const [allocation, setAllocation] = useState<any>(null);
    const [performance, setPerformance] = useState<any>(null);
    const [holdings, setHoldings] = useState<any[]>([]);
    const [selectedStatement, setSelectedStatement] = useState<any>(null);
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [isStatementDetailsOpen, setIsStatementDetailsOpen] = useState(false);
    const [isPdfSettingsOpen, setIsPdfSettingsOpen] = useState(false);
    const [bankConfigs, setBankConfigs] = useState<Record<string, boolean>>({}); // bank_name -> has_password
    const [pdfPasswordInputs, setPdfPasswordInputs] = useState<Record<string, string>>({});
    const [pdfPasswordVisible, setPdfPasswordVisible] = useState<Record<string, boolean>>({});
    const [pdfSaveStatus, setPdfSaveStatus] = useState<Record<string, string>>({}); // bank -> 'saving'|'saved'|''

    // Bank level Performance State
    const [bankPerformanceData, setBankPerformanceData] = useState<any[]>([]);
    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

    // Discovery Engine Filters
    const [fundSearchQuery, setFundSearchQuery] = useState("");
    const [selectedRiskFilter, setSelectedRiskFilter] = useState<string | null>(null);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [expandedFundId, setExpandedFundId] = useState<number | null>(null);

    const [isUploadingFMR, setIsUploadingFMR] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [selectedBank, setSelectedBank] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<number | null>(null);
    const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null);

    useEffect(() => {
        setSelectedPortfolio(null);
    }, [selectedBank]);
    const navigate = useNavigate();
    const location = useLocation();
    const currentPage = location.pathname; // "/", "/news", "/ai-news"
    const { toast } = useToast();

    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    });

    const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
    const [statements, setStatements] = useState<any[]>([]);
    const [isStatementHistoryModalOpen, setIsStatementHistoryModalOpen] = useState(false);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'light') {
            root.classList.add('light');
        } else {
            root.classList.remove('light');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) setIsSidebarOpen(false);
            else setIsSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            // Only fetch portfolio data while the dashboard home route is active.
            // Subpages render via React Router <Outlet />, so we must not fire
            // these calls (or surface their errors) when a subpage is mounted.
            if (currentPage !== '/') return;
            try {
                // Add a generous timeout so a slow (but alive) backend doesn't crash the dashboard
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Request timed out. The server may be busy — try again.")), 30000)
                );

                const params = new URLSearchParams();
                if (selectedBank) params.append('bank', selectedBank);
                if (selectedPortfolio) params.append('portfolio_account', selectedPortfolio);
                const q = params.toString() ? `?${params.toString()}` : '';

                const advancedParams = new URLSearchParams(params);
                if (timeRange) advancedParams.append('days', timeRange.toString());
                const advancedQ = advancedParams.toString() ? `?${advancedParams.toString()}` : '';

                const summaryReq = client.get(`/dashboard/summary${q}`);
                const allocReq = client.get(`/dashboard/allocation${advancedQ}`);
                const perfReq = client.get(`/dashboard/performance${advancedQ}`);
                const holdingsReq = client.get(`/dashboard/holdings${q}`);
                const statementsReq = client.get(`/dashboard/statement-history${q}`);

                const requests = [summaryReq, allocReq, perfReq, holdingsReq, statementsReq];

                if (selectedBank) {
                    requests.push(client.get(`/api/performance/bank/${selectedBank}`).catch(() => ({ data: [] })) as any);
                }

                const responses = await Promise.race([
                    Promise.all(requests),
                    timeoutPromise
                ]) as any;

                const [summaryRes, allocRes, perfRes, holdingsRes, statementsRes, bankPerfRes] = responses;

                setSummary(summaryRes.data);
                setHoldings(holdingsRes.data);
                setStatements(statementsRes.data);

                const pieData = allocRes.data.dates.map((name: string, index: number) => ({
                    name, value: allocRes.data.values[index]
                }));
                setAllocation(pieData);

                const lineData = perfRes.data.dates.map((date: string, index: number) => ({
                    date, value: perfRes.data.values[index]
                }));
                setPerformance(lineData);

                if (bankPerfRes && bankPerfRes.data) {
                    setBankPerformanceData(bankPerfRes.data);
                } else {
                    setBankPerformanceData([]);
                }

            } catch (err: any) {
                console.error("Dashboard fetch error:", err);
                if (err.response?.status === 401) {
                    navigate('/login');
                } else {
                    setError(err.message || "Failed to load dashboard data. Ensure backend is running.");
                }
            }
        };
        fetchData();
    }, [navigate, selectedBank, timeRange, selectedPortfolio, currentPage]);

    // Fetch bank PDF password configs on mount
    useEffect(() => {
        fetchBankConfigs();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const handleDeleteStatement = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this statement?')) return;
        try {
            await client.delete(`/dashboard/statements/${id}`);
            setStatements(statements.filter(s => s.id !== id));
        } catch (err: any) {
            alert("Failed to delete statement: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleFMRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        const formData = new FormData();
        formData.append("file", file);

        setIsUploadingFMR(true);
        try {
            const res = await client.post('/api/performance/upload-fmr', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast(res.data.message || "FMR processed successfully.", "success");
            // Refresh bank data if modal is open
            if (selectedBank) {
                const req = await client.get(`/api/performance/bank/${selectedBank}`);
                setBankPerformanceData(req.data);
            }
        } catch (err: any) {
            console.error(err);
            toast("Failed to upload FMR: " + (err.response?.data?.detail || err.message), "error");
        } finally {
            setIsUploadingFMR(false);
            e.target.value = ''; // reset input
        }
    };

    const fetchBankConfigs = async () => {
        try {
            const res = await client.get('/users/bank-config');
            const map: Record<string, boolean> = {};
            (res.data as any[]).forEach(c => { map[c.bank_name] = c.has_password; });
            setBankConfigs(map);
        } catch (err) {
            console.error('Failed to fetch bank configs', err);
        }
    };

    const savePdfPassword = async (bank: string) => {
        const pwd = pdfPasswordInputs[bank] || '';
        setPdfSaveStatus(s => ({ ...s, [bank]: 'saving' }));
        try {
            await client.post('/users/bank-config', { bank_name: bank, pdf_password: pwd });
            await fetchBankConfigs();
            setPdfSaveStatus(s => ({ ...s, [bank]: 'saved' }));
            setTimeout(() => setPdfSaveStatus(s => ({ ...s, [bank]: '' })), 2500);
        } catch (err: any) {
            toast('Failed to save password: ' + (err.response?.data?.detail || err.message), "error");
            setPdfSaveStatus(s => ({ ...s, [bank]: '' }));
        }
    };

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                if (current.direction === 'asc') return { key, direction: 'desc' };
                return null; // toggle off
            }
            return { key, direction: 'desc' }; // default to highest first
        });
    };

    const handleExportCSV = () => {
        if (holdings.length === 0) return;

        const headers = ["Bank", "Portfolio/Account", "Category", "Units", "NAV", "Investment Amount", "Market Value", "Gain/Loss", "Percentage Change"];
        let csv = headers.join(",") + "\n";

        holdings.forEach(h => {
            const row = [
                `"${h.bank}"`,
                `"${h.portfolio_account || 'Unknown'}"`,
                `"${h.category}"`,
                h.units,
                h.nav,
                h.investment_amount,
                h.market_value,
                h.gain_loss,
                h.percentage_change.toFixed(2) + "%"
            ];
            csv += row.join(",") + "\n";
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Portfolio-Data-${selectedBank || 'All'}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = async () => {
        const fileName = `Portfolio-Report-${selectedBank || 'All'}.pdf`;

        try {
            // @ts-ignore
            if (window.api && window.api.exportPDF) {
                // @ts-ignore
                const success = await window.api.exportPDF(fileName);
                if (success) {
                    toast("Success! Portfolio Report saved successfully.", "success");
                }
            } else {
                toast("Native PDF Export is not available in this environment.", "warning");
            }
        } catch (err: any) {
            console.error("PDF generation error:", err);
            toast("Error generating PDF: " + (err.message || err.toString()), "error");
        }
    };

    if (currentPage === '/' && error) return (
        <div className="flex items-center justify-center h-screen bg-midnight text-danger">
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="p-4 bg-danger/10 rounded-full">
                    <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold">Connection Error</h3>
                <p className="text-text-secondary max-w-md">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-6 py-2 bg-surface border border-[var(--color-white-10)] rounded-lg hover:bg-[var(--color-white-5)] transition-colors text-text-primary"
                >
                    Retry Connection
                </button>
                <button onClick={handleLogout} className="text-sm text-text-secondary underline hover:text-text-primary">
                    Back to Login
                </button>
            </div>
        </div>
    );

    if (currentPage === '/' && !summary) return (
        <div className="flex items-center justify-center h-screen bg-midnight text-emerald-500">
            <div className="flex flex-col items-center gap-4">
                <Activity className="w-12 h-12 animate-spin" />
                <span className="text-lg font-medium tracking-widest uppercase">Initializing Terminal...</span>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-midnight text-text-primary overflow-hidden font-sans selection:bg-emerald-500 selection:text-text-primary">

            {/* Sidebar Overlay for Mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 bg-surface border-r border-[var(--color-white-5)] flex flex-col transition-all duration-300 ease-in-out z-30
                ${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'}
            `}>
                <div className="p-4 flex items-center justify-between border-b border-[var(--color-white-5)] shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center shadow-lg shadow-gold/20 shrink-0">
                            <Activity className="text-white w-5 h-5" />
                        </div>
                        {isSidebarOpen && (
                            <div className="transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                                <h1 className="text-lg font-bold tracking-tight text-white leading-none">
                                    FundTracker
                                </h1>
                                <p className="text-[10px] text-text-secondary mt-0.5">Wealth Management</p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-1.5 rounded-lg bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] text-text-secondary hover:text-white transition-colors"
                        title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                    >
                        {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                </div>

                <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
                    <div className="mb-6">
                        <p className={`text-[10px] font-semibold text-text-secondary mb-2 px-3 tracking-wider ${!isSidebarOpen ? 'hidden' : 'block'}`}>OVERVIEW</p>
                        <NavItem
                            icon={<LayoutDashboard size={20} />}
                            label="Global Portfolio"
                            active={selectedBank === null && currentPage === '/'}
                            isOpen={isSidebarOpen}
                            onClick={() => { setSelectedBank(null); navigate('/'); }}
                        />
                    </div>

                    <div className="mb-6">
                        <p className={`text-[10px] font-semibold text-text-secondary mb-2 px-3 tracking-wider ${!isSidebarOpen ? 'hidden' : 'block'}`}>INSTITUTIONS</p>
                        <NavItem icon={<Building2 size={20} />} label="Meezan Bank" active={selectedBank === 'Meezan' && currentPage === '/'} isOpen={isSidebarOpen} onClick={() => { setSelectedBank('Meezan'); navigate('/'); }} />
                        <NavItem icon={<Building2 size={20} />} label="HBL" active={selectedBank === 'HBL' && currentPage === '/'} isOpen={isSidebarOpen} onClick={() => { setSelectedBank('HBL'); navigate('/'); }} />
                        <NavItem icon={<Building2 size={20} />} label="Atlas Funds" active={selectedBank === 'Atlas' && currentPage === '/'} isOpen={isSidebarOpen} onClick={() => { setSelectedBank('Atlas'); navigate('/'); }} />
                        <NavItem icon={<Building2 size={20} />} label="Faysal Funds" active={selectedBank === 'Faysal' && currentPage === '/'} isOpen={isSidebarOpen} onClick={() => { setSelectedBank('Faysal'); navigate('/'); }} />
                    </div>

                    {/* NEWS Section */}
                    <div className="mb-6">
                        <p className={`text-[10px] font-semibold text-text-secondary mb-2 px-3 tracking-wider ${!isSidebarOpen ? 'hidden' : 'block'}`}>MARKET INTEL</p>
                        <NavItem
                            icon={<Newspaper size={20} />}
                            label="Market News"
                            active={currentPage === '/news'}
                            isOpen={isSidebarOpen}
                            onClick={() => navigate('/news')}
                        />
                        <NavItem
                            icon={<Brain size={20} />}
                            label="AI News Insights"
                            active={currentPage === '/ai-news'}
                            isOpen={isSidebarOpen}
                            onClick={() => navigate('/ai-news')}
                        />
                        <NavItem
                            icon={<Lightbulb size={20} />}
                            label="Portfolio Suggestions"
                            active={currentPage === '/suggestions'}
                            isOpen={isSidebarOpen}
                            onClick={() => navigate('/suggestions')}
                        />
                    </div>

                    {/* PLANNER Section */}
                    <div className="mb-6">
                        <p className={`text-[10px] font-semibold text-text-secondary mb-2 px-3 tracking-wider ${!isSidebarOpen ? 'hidden' : 'block'}`}>PLANNER</p>
                        <NavItem
                            icon={<PiggyBank size={20} />}
                            label="Inflation & SIP"
                            active={currentPage === '/simulator'}
                            isOpen={isSidebarOpen}
                            onClick={() => navigate('/simulator')}
                        />
                        <NavItem
                            icon={<Receipt size={20} />}
                            label="Tax Optimizer"
                            active={currentPage === '/tax'}
                            isOpen={isSidebarOpen}
                            onClick={() => navigate('/tax')}
                        />
                        <NavItem
                            icon={<LineChart size={20} />}
                            label="Benchmark Alpha"
                            active={currentPage === '/benchmark'}
                            isOpen={isSidebarOpen}
                            onClick={() => navigate('/benchmark')}
                        />
                    </div>

                </nav>

                <div className="p-3 border-t border-[var(--color-white-5)]">
                    <button onClick={handleLogout} className={`flex items-center gap-3 text-text-secondary hover:text-white hover:bg-[var(--color-white-5)] p-3 rounded-xl transition-all w-full group ${!isSidebarOpen && 'justify-center'}`} title={!isSidebarOpen ? "Logout" : ""}>
                        <LogOut size={20} className="group-hover:text-danger transition-colors shrink-0" />
                        {isSidebarOpen && <span className="font-medium whitespace-nowrap">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

                {/* Portfolio content — only shown on the home ('/') route; subpages render via React Router <Outlet /> */}
                {currentPage === '/' ? (
                <>

                {/* Header */}
                <header className="px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-white-5)] bg-surface/50 backdrop-blur-xl sticky top-0 z-10">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] rounded-xl text-text-secondary hover:text-text-primary transition-colors"
                            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                        >
                            <Menu size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold tracking-tight text-text-primary">Portfolio Analytics</h2>
                                <button
                                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                    className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                                    title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                                >
                                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                </button>
                            </div>
                            <p className="text-text-secondary text-sm">Real-time performance metrics</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <HeaderButton
                            onClick={() => setIsCalculatorModalOpen(true)}
                            icon={<Calculator size={16} />}
                            label="Zakat Calc"
                        />
                        <HeaderButton
                            onClick={handleExportCSV}
                            icon={<Download size={16} />}
                            label="Export CSV"
                        />
                        <HeaderButton
                            onClick={handleExportPDF}
                            icon={<FileText size={16} />}
                            label="Export PDF"
                        />
                        <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/10">
                            {isUploadingFMR ? <Activity size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                            <span>{isUploadingFMR ? 'Uploading...' : 'Upload FMR'}</span>
                            <input type="file" accept=".pdf" className="hidden" onChange={handleFMRUpload} disabled={isUploadingFMR} />
                        </label>
                        <button
                            onClick={() => setIsStatementModalOpen(true)}
                            className="px-4 py-2 bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] text-text-primary rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <UploadCloud size={16} />
                            <span>Upload Statement</span>
                        </button>
                        {selectedBank && (
                            <HeaderButton
                                onClick={() => setIsPerformanceModalOpen(true)}
                                icon={<TrendingUp size={16} />}
                                label="Fund Performance"
                            />
                        )}
                        <HeaderButton
                            onClick={() => setIsPdfSettingsOpen(true)}
                            icon={<Database size={16} />}
                            label="PDF Passwords"
                        />
                    </div>
                </header>

                <StatementUploadModal isOpen={isStatementModalOpen} onClose={() => setIsStatementModalOpen(false)} />

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 hide-in-pdf">
                    <div className="max-w-7xl mx-auto space-y-8">

                        {/* Time Range Filter and Portfolio Filter */}
                        <div className="flex flex-wrap items-center gap-4 hide-in-pdf">
                            <div className="flex items-center gap-2 bg-surface p-1 rounded-xl w-max border border-[var(--color-white-5)]">
                                {[
                                    { label: '1M', value: 30 },
                                    { label: '3M', value: 90 },
                                    { label: '6M', value: 180 },
                                    { label: '1Y', value: 365 },
                                    { label: 'All', value: null }
                                ].map((t) => (
                                    <button
                                        key={t.label}
                                        onClick={() => setTimeRange(t.value)}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${timeRange === t.value ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'text-text-secondary hover:text-text-primary hover:bg-[var(--color-white-5)]'}`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            
                            {summary?.available_portfolios && summary.available_portfolios.length > 0 && (
                                <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-[var(--color-white-5)] overflow-x-auto max-w-full">
                                    <button
                                        onClick={() => setSelectedPortfolio(null)}
                                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${selectedPortfolio === null ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'text-text-secondary hover:text-text-primary hover:bg-[var(--color-white-5)]'}`}
                                    >
                                        All Portfolios
                                    </button>
                                    {summary.available_portfolios.map((p: string) => (
                                        <button
                                            key={p}
                                            onClick={() => setSelectedPortfolio(p)}
                                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${selectedPortfolio === p ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'text-text-secondary hover:text-text-primary hover:bg-[var(--color-white-5)]'}`}
                                        >
                                            Portfolio {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* KPI Grid — Hero Net Worth + secondary metrics */}
                        {(() => {
                            const nw = summary.total_net_worth || 0;
                            const invested = summary.total_invested || 0;
                            const gain = summary.total_gain_loss || 0;
                            const roi = invested > 0 ? (gain / invested) * 100 : 0;
                            return (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                                {/* Hero Net Worth card */}
                                <div className="lg:col-span-5 relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-xl shadow-emerald-500/20 border border-emerald-400/20 flex flex-col justify-between min-w-0">
                                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                                    <div className="relative flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-emerald-50/90">
                                            <Activity size={18} />
                                            <span className="text-xs font-semibold uppercase tracking-wider">Total Net Worth</span>
                                        </div>
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[10px] font-semibold text-emerald-50">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> MUFAP Live
                                        </span>
                                    </div>
                                    <p className="relative text-2xl sm:text-3xl xl:text-4xl font-bold font-mono tracking-tight tabular-nums truncate" title={formatPKR(nw)}>
                                        {formatPKR(nw)}
                                    </p>
                                    <div className="relative mt-3 flex flex-wrap items-center gap-3 text-sm">
                                        <span
                                            className="text-emerald-50/90 font-medium cursor-default"
                                            title={`${toCrores(nw)}  •  ${toLacs(nw)}`}
                                        >
                                            ≈ {toCrores(nw)}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roi >= 0 ? 'bg-white/15 text-emerald-50' : 'bg-red-500/30 text-red-100'}`}>
                                            {roi >= 0 ? '▲' : '▼'} {Math.abs(roi).toFixed(2)}% ROI
                                        </span>
                                    </div>
                                </div>

                                {/* 3 Secondary KPI Cards */}
                                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <KPICard
                                        title="Total Invested"
                                        value={formatPKR(invested)}
                                        subtitle={invested > 0 ? `≈ ${toCrores(invested)}` : undefined}
                                    />
                                    <KPICard
                                        title="Total Gain / Loss"
                                        value={formatPKR(gain)}
                                        subtitle={gain !== 0 ? `≈ ${toCrores(gain)}` : undefined}
                                        tone={gain >= 0 ? 'up' : 'down'}
                                        badge={gain >= 0 ? 'Profit' : 'Loss'}
                                    />
                                    <KPICard
                                        title="Top Performer"
                                        value={summary.top_performing_bank || '—'}
                                        badge="Best ROI"
                                        subtitle="Leading Asset Manager"
                                    />
                                </div>
                            </div>
                            );
                        })()}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Line Chart */}
                            <div className="lg:col-span-2 bg-surface border border-[var(--color-white-5)] rounded-2xl p-6 relative group flex flex-col">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 shrink-0">
                                    <TrendingUp size={20} className="text-emerald-500" />
                                    Portfolio Trajectory
                                </h3>
                                <div className="flex-1 w-full min-h-[300px]">
                                    {performance && performance.length > 0 ? (
                                        <ReactApexChart 
                                            options={{
                                                chart: {
                                                    type: 'area',
                                                    background: 'transparent',
                                                    toolbar: {
                                                        show: true,
                                                        tools: {
                                                            download: true,
                                                            selection: true,
                                                            zoom: true,
                                                            zoomin: true,
                                                            zoomout: true,
                                                            pan: true,
                                                            reset: true,
                                                        },
                                                        autoSelected: 'zoom',
                                                    },
                                                    zoom: { enabled: true, type: 'x', autoScaleYaxis: true },
                                                    animations: { enabled: true, easing: 'easeinout', speed: 800 },
                                                    selection: { enabled: true, stroke: { width: 1, dashArray: 3, color: '#10B981' } },
                                                },
                                                theme: { mode: theme },
                                                colors: ['#10B981'],
                                                fill: {
                                                    type: 'gradient',
                                                    gradient: {
                                                        shadeIntensity: 1,
                                                        opacityFrom: 0.3,
                                                        opacityTo: 0.02,
                                                        stops: [0, 90, 100]
                                                    }
                                                },
                                                dataLabels: { enabled: false },
                                                stroke: { curve: 'straight', width: 3 },
                                                markers: {
                                                    size: 0,
                                                    hover: { size: 6, sizeOffset: 3 },
                                                    colors: ['#10B981'],
                                                    strokeColors: theme === 'dark' ? '#1a1a2e' : '#ffffff',
                                                    strokeWidth: 2,
                                                },
                                                xaxis: {
                                                    type: 'datetime',
                                                    categories: performance.map((p: any) => p.date),
                                                    labels: { style: { colors: theme === 'dark' ? '#94A3B8' : '#64748B', fontFamily: 'Inter' } },
                                                    axisBorder: { show: false },
                                                    axisTicks: { show: false },
                                                    crosshairs: { show: true, stroke: { color: '#10B981', width: 1, dashArray: 3 } },
                                                },
                                                yaxis: {
                                                    labels: {
                                                        style: { colors: theme === 'dark' ? '#94A3B8' : '#64748B', fontFamily: 'Inter' },
                                                        formatter: (value) => `PKR ${(value / 1000).toFixed(0)}k`
                                                    }
                                                },
                                                grid: {
                                                    borderColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                                    strokeDashArray: 4,
                                                },
                                                tooltip: {
                                                    theme: theme,
                                                    x: { format: 'dd MMM yyyy' },
                                                    y: { formatter: (value) => `PKR ${value.toLocaleString()}` },
                                                    marker: { show: true },
                                                }
                                            } as ApexOptions} 
                                            series={[{
                                                name: 'Net Worth',
                                                data: performance.map((p: any) => p.value)
                                            }]} 
                                            type="area" 
                                            height="100%" 
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-text-secondary">
                                            No performance data available.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pie Chart */}
                            <div className="bg-surface border border-[var(--color-white-5)] rounded-xl p-6">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                    <Database size={20} className="text-emerald-500" />
                                    Asset Allocation
                                </h3>
                                <div className="h-[280px] w-full flex items-center justify-center relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={allocation}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={8}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {allocation?.map((_: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'][index % 6]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: theme === 'dark' ? '#141414' : '#FFFFFF', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                itemStyle={{ color: theme === 'dark' ? '#E2E8F0' : '#111827' }}
                                                formatter={(value: any, name: any) => [`${value}%`, name]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">Total</p>
                                        <p className="text-xl font-bold">100%</p>
                                    </div>
                                </div>
                                {/* Custom Legend */}
                                <div className="mt-6 space-y-2">
                                    {allocation?.map((entry: any, index: number) => (
                                        <div key={`legend-${index}`} className="flex items-center justify-between group cursor-default">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#FFFFFF', '#8B5CF6', '#EF4444'][index % 6] }} />
                                                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">{entry.name}</span>
                                            </div>
                                            <span className="text-xs font-mono font-bold text-text-primary">{entry.value}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Portfolio Repository (Grouped by Bank) */}
                        <div className="pb-8">
                            <div className="bg-surface border border-[var(--color-white-5)] rounded-xl p-6 flex flex-col">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 shrink-0">
                                    <FileText size={20} className="text-emerald-500" />
                                    Portfolio Repository
                                </h3>
                                
                                <div className="space-y-8">
                                    {(() => {
                                        // Group holdings by Bank
                                        const banks = Array.from(new Set(holdings.map(h => h.bank)));
                                        
                                        if (banks.length === 0) {
                                            return (
                                                <div className="py-12 text-center">
                                                    <p className="text-text-secondary">No statements found. Upload an FMR or PDF to begin tracking.</p>
                                                </div>
                                            );
                                        }

                                        return banks.map(bankName => {
                                            const bankHoldings = holdings.filter(h => h.bank === bankName);
                                            // Unique portfolios within this bank
                                            const portfolioNumbers = Array.from(new Set(bankHoldings.map(h => h.portfolio_account || 'Unknown Account')));
                                            
                                            return (
                                                <div key={bankName} className="space-y-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                                                        <h4 className="font-bold text-text-primary uppercase tracking-widest text-sm">{bankName}</h4>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap gap-3">
                                                        {portfolioNumbers.map(pNo => (
                                                            <button
                                                                key={pNo}
                                                                onClick={() => {
                                                                    const stmtHoldings = bankHoldings.filter(h => h.portfolio_account === pNo);
                                                                    setSelectedStatement({
                                                                        bank: bankName,
                                                                        portfolio: pNo,
                                                                        holdings: stmtHoldings
                                                                    });
                                                                    setIsStatementDetailsOpen(true);
                                                                }}
                                                                className="px-6 py-4 bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-2xl hover:bg-emerald-600/20 hover:border-emerald-500 transition-all group relative overflow-hidden flex flex-col items-start min-w-[200px]"
                                                            >
                                                                <span className="text-[10px] text-text-secondary group-hover:text-emerald-500 transition-colors uppercase font-bold tracking-tighter mb-1">Portfolio</span>
                                                                <span className="text-sm font-mono font-bold text-text-primary group-hover:text-white transition-colors">{pNo}</span>
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <ArrowUpRight size={16} className="text-emerald-500" />
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Recent Portfolio Updates */}
                        <div className="pb-12">
                            <div className="bg-surface border border-[var(--color-white-5)] rounded-xl overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-[var(--color-white-5)] flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Activity size={20} className="text-emerald-500" />
                                        Recent Portfolio Updates
                                    </h3>
                                    <button 
                                        onClick={() => setIsStatementHistoryModalOpen(true)}
                                        className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest"
                                    >
                                        View All History
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-[var(--color-white-5)] text-[10px] uppercase tracking-widest text-text-secondary font-bold">
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Institution</th>
                                                <th className="px-6 py-4">Action</th>
                                                <th className="px-6 py-4 text-right">Amount (PKR)</th>
                                                <th className="px-6 py-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-white-5)]">
                                            {(statements || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                                                        No statement history yet. Upload an FMR or statement PDF to begin tracking.
                                                    </td>
                                                </tr>
                                            ) : (
                                                statements.slice(0, 5).map((row: any, i: number) => (
                                                    <tr key={row.id ?? i} className="hover:bg-[var(--color-white-2)] transition-colors group">
                                                        <td className="px-6 py-4 text-xs font-mono text-text-secondary">{row.date}</td>
                                                        <td className="px-6 py-4 text-sm font-semibold text-text-primary">{row.bank}</td>
                                                        <td className="px-6 py-4 text-sm text-text-secondary">{row.action || "Statement Parsed"}</td>
                                                        <td className="px-6 py-4 text-right font-mono text-sm font-bold text-text-primary">
                                                            {formatCurrency(row.amount ?? row.total_value)}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-tighter border ${
                                                                row.status === 'VERIFIED' 
                                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                                                                    : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                            }`}>
                                                                {row.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* PDF Password Warning Banner — shown for Atlas when no password is set */}
                        {selectedBank?.toLowerCase() === 'atlas' && !bankConfigs['atlas'] && (
                            <div className="max-w-7xl mx-auto mb-8">
                                <div className="flex items-start gap-3 px-5 py-4 bg-warning/10 border border-warning/30 rounded-2xl">
                                    <div className="text-warning mt-0.5 shrink-0"><Zap size={18} /></div>
                                    <div className="flex-1">
                                        <p className="text-warning font-semibold text-sm">Atlas PDF statements may be password-protected</p>
                                        <p className="text-warning/70 text-xs mt-0.5">If your statements aren't updating, set your PDF password via the <span className="font-bold">PDF Passwords</span> button in the header.</p>
                                    </div>
                                    <button
                                        onClick={() => setIsPdfSettingsOpen(true)}
                                        className="text-xs text-warning border border-warning/40 px-3 py-1.5 rounded-lg hover:bg-warning/20 transition-colors shrink-0"
                                    >
                                        Set Password
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Statement History Modal */}
                {isStatementHistoryModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-surface border border-[var(--color-white-10)] rounded-3xl p-8 max-w-4xl w-full shadow-2xl relative max-h-[85vh] flex flex-col">
                            <button
                                onClick={() => setIsStatementHistoryModalOpen(false)}
                                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-white bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] rounded-full transition-colors"
                            >
                                <Zap size={16} className="rotate-45" /> {/* Close Icon Approximation */}
                            </button>

                            <div className="flex items-center gap-3 mb-6 shrink-0">
                                <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-2xl">
                                    <Activity size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-text-primary">Statement History Ledger</h2>
                                    <p className="text-sm text-text-secondary">View and manage all processed portfolio statements.</p>
                                </div>
                            </div>

                            <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-surface z-10">
                                        <tr className="bg-[var(--color-white-5)] text-[10px] uppercase tracking-widest text-text-secondary font-bold">
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Institution</th>
                                            <th className="px-6 py-4">Account Number</th>
                                            <th className="px-6 py-4">Action</th>
                                            <th className="px-6 py-4 text-right">Valuation (PKR)</th>
                                            <th className="px-6 py-4 text-center">Manage</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-white-5)]">
                                        {statements.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                                                    No statements found.
                                                </td>
                                            </tr>
                                        ) : (
                                            statements.map((row, i) => (
                                                <tr key={i} className="hover:bg-[var(--color-white-2)] transition-colors group">
                                                    <td className="px-6 py-4 text-xs font-mono text-text-secondary">{row.date}</td>
                                                    <td className="px-6 py-4 text-sm font-semibold text-text-primary">{row.bank}</td>
                                                    <td className="px-6 py-4 text-sm font-mono text-text-secondary">{row.account_number}</td>
                                                    <td className="px-6 py-4 text-sm text-text-secondary">{row.action}</td>
                                                    <td className="px-6 py-4 text-right font-mono text-sm font-bold text-text-primary">
                                                        {formatCurrency(row.amount)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center flex justify-center gap-2">
                                                        <button 
                                                            className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 px-3 py-1.5 rounded transition-colors"
                                                            onClick={() => handleDeleteStatement(row.id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Calculator Modal Overlay */}
                {isCalculatorModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-surface border border-[var(--color-white-10)] rounded-3xl p-8 max-w-lg w-full shadow-2xl relative">
                            <button
                                onClick={() => setIsCalculatorModalOpen(false)}
                                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-white bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] rounded-full transition-colors"
                            >
                                <X size={16} />
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-2xl">
                                    <Calculator size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">Zakat Calculator</h2>
                                    <p className="text-sm text-text-secondary">Estimated liabilities based on current Net Worth</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-[var(--color-white-5)] rounded-2xl flex justify-between items-center">
                                    <span className="text-text-secondary">Total Net Worth</span>
                                    <span className="font-bold text-lg">PKR {(summary.total_net_worth || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>

                                <div className="p-4 bg-[var(--color-white-5)] border border-accent-pink/20 rounded-2xl flex justify-between items-center group hover:border-accent-pink/50 transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-accent-pink font-semibold">Zakat Liability</span>
                                            <span className="text-xs px-2 py-0.5 bg-accent-pink/10 text-accent-pink rounded-md">2.5%</span>
                                        </div>
                                        <p className="text-xs text-text-secondary mt-1">Calculated on Total Net Worth</p>
                                    </div>
                                    <span className="font-bold text-lg text-accent-pink">
                                        - PKR {((summary.total_net_worth || 0) * 0.025).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="pt-4 mt-2 border-t border-[var(--color-white-10)] flex justify-between items-center">
                                    <span className="font-bold text-text-secondary">Post-Zakat Net Worth</span>
                                    {(() => {
                                        const zakat = (summary.total_net_worth || 0) * 0.025;
                                        const finalAmount = (summary.total_net_worth || 0) - zakat;
                                        return (
                                            <span className="font-bold text-2xl text-success">
                                                PKR {finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fund Performance Modal Overlay */}
                {isPerformanceModalOpen && selectedBank && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-surface border border-emerald-500/20 rounded-3xl p-6 md:p-8 max-w-5xl w-full h-[90vh] shadow-2xl relative flex flex-col">
                            <button
                                onClick={() => setIsPerformanceModalOpen(false)}
                                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-white bg-[var(--color-white-5)] hover:bg-danger/20 rounded-full transition-colors z-10"
                            >
                                <X size={16} />
                            </button>

                            <div className="flex items-center gap-3 mb-6 shrink-0 z-0">
                                <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-2xl">
                                    <TrendingUp size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                        {selectedBank} <span className="text-emerald-500">Fund Performances</span>
                                    </h2>
                                    <p className="text-sm text-text-secondary flex items-center gap-1">
                                        <Info size={14} /> MUFAP Verified Data
                                    </p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col gap-6">
                                {/* Search Bar & Filters */}
                                <div className="flex flex-col md:flex-row gap-4 shrink-0">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder={`Search ${selectedBank} funds...`}
                                            value={fundSearchQuery}
                                            onChange={(e) => setFundSearchQuery(e.target.value)}
                                            className="w-full bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-emerald-500 transition-colors"
                                        />
                                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary w-4 h-4" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                                            <Filter size={16} /> Filters:
                                        </div>
                                        <select
                                            value={selectedCategoryFilter || ""}
                                            onChange={e => setSelectedCategoryFilter(e.target.value || null)}
                                            className="bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 text-text-primary custom-select shadow-sm"
                                        >
                                            <option value="" className="bg-[#1a1625] text-white py-2">All Categories</option>
                                            <option value="Money Market" className="bg-[#1a1625] text-white py-2">Money Market</option>
                                            <option value="Income" className="bg-[#1a1625] text-white py-2">Income / Debt</option>
                                            <option value="Equity" className="bg-[#1a1625] text-white py-2">Equity / Stock</option>
                                        </select>
                                        <select
                                            value={selectedRiskFilter || ""}
                                            onChange={e => setSelectedRiskFilter(e.target.value || null)}
                                            className="bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 text-text-primary custom-select shadow-sm"
                                        >
                                            <option value="" className="bg-[#1a1625] text-white py-2">All Risk Profiles</option>
                                            <option value="Low" className="bg-[#1a1625] text-success py-2">Low Risk</option>
                                            <option value="Medium" className="bg-[#1a1625] text-warning py-2">Medium Risk</option>
                                            <option value="High" className="bg-[#1a1625] text-danger py-2">High Risk</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Table of Funds */}
                                <div className="bg-black/20 rounded-2xl border border-[var(--color-white-5)] overflow-hidden flex-1 flex flex-col">
                                    <div className="overflow-auto custom-scrollbar flex-1">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-[var(--color-white-5)] text-text-secondary text-xs uppercase tracking-wider bg-[var(--color-white-5)]">
                                                    <th className="py-3 px-4 font-semibold">Fund Name</th>
                                                    <th className="py-3 px-4 font-semibold hover:text-white cursor-pointer transition-colors" onClick={() => handleSort('nav')}>Latest NAV {sortConfig?.key === 'nav' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                                    <th className="py-3 px-4 font-semibold text-right hover:text-white cursor-pointer transition-colors" onClick={() => handleSort('return_1m')}>1 Month {sortConfig?.key === 'return_1m' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                                    <th className="py-3 px-4 font-semibold text-right hover:text-white cursor-pointer transition-colors" onClick={() => handleSort('return_6m')}>6 Month {sortConfig?.key === 'return_6m' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                                    <th className="py-3 px-4 font-semibold text-right hover:text-white cursor-pointer transition-colors" onClick={() => handleSort('return_1y')}>1 Year {sortConfig?.key === 'return_1y' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                                    <th className="py-3 px-4 font-semibold text-right hover:text-white cursor-pointer transition-colors" onClick={() => handleSort('return_ytd')}>YTD {sortConfig?.key === 'return_ytd' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    let filteredFunds = bankPerformanceData.filter(f =>
                                                        f.fund_name.toLowerCase().includes(fundSearchQuery.toLowerCase()) ||
                                                        f.short_name?.toLowerCase().includes(fundSearchQuery.toLowerCase())
                                                    );

                                                    if (selectedRiskFilter) {
                                                        filteredFunds = filteredFunds.filter(f => f.risk_profile?.toLowerCase().includes(selectedRiskFilter.toLowerCase()));
                                                    }
                                                    if (selectedCategoryFilter) {
                                                        filteredFunds = filteredFunds.filter(f =>
                                                            f.fund_type?.toLowerCase().includes(selectedCategoryFilter.toLowerCase()) ||
                                                            f.category?.toLowerCase().includes(selectedCategoryFilter.toLowerCase())
                                                        );
                                                    }

                                                    if (sortConfig) {
                                                        filteredFunds.sort((a, b) => {
                                                            const aVal = sortConfig.key === 'nav' ? (a.latest_nav || -999) : (a.metrics?.[sortConfig.key] || -999);
                                                            const bVal = sortConfig.key === 'nav' ? (b.latest_nav || -999) : (b.metrics?.[sortConfig.key] || -999);
                                                            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                                                            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                                                            return 0;
                                                        });
                                                    }

                                                    if (bankPerformanceData.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={6} className="py-8 text-center text-text-secondary">
                                                                    No daily performance data available for {selectedBank}. This might mean the scraper hasn't run yet or no funds matched.
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    if (filteredFunds.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={6} className="py-8 text-center text-text-secondary">
                                                                    No funds found matching "{fundSearchQuery}".
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return filteredFunds.map((fund: any) => (
                                                        <React.Fragment key={fund.fund_id}>
                                                            <tr
                                                                onClick={() => setExpandedFundId(expandedFundId === fund.fund_id ? null : fund.fund_id)}
                                                                className="border-b border-[var(--color-white-5)] hover:bg-[var(--color-white-5)] transition-colors cursor-pointer group"
                                                            >
                                                                <td className="py-3 px-4 text-text-primary flex md:items-center items-start gap-3">
                                                                    <div className="mt-1 md:mt-0 shrink-0">
                                                                        {expandedFundId === fund.fund_id ? <ChevronUp size={16} className="text-emerald-500" /> : <ChevronDown size={16} className="text-text-secondary group-hover:text-emerald-500 transition-colors" />}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-semibold group-hover:text-emerald-500 transition-colors line-clamp-2 md:line-clamp-none">
                                                                            {fund.fund_name} {fund.short_name && <span className="text-text-secondary text-xs font-normal ml-2 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">{fund.short_name}</span>}
                                                                        </p>
                                                                        {(fund.fund_type || fund.risk_profile) && (
                                                                            <div className="flex flex-wrap gap-2 mt-1.5">
                                                                                {fund.fund_type && fund.fund_type !== "Unknown" && <span className="text-[10px] bg-[var(--color-white-10)] text-text-primary px-2 py-0.5 rounded-full border border-[var(--color-white-10)]">{fund.fund_type}</span>}
                                                                                {fund.risk_profile && fund.risk_profile !== "Unknown" && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${fund.risk_profile === 'High' ? 'bg-danger/10 text-danger border border-danger/20' : fund.risk_profile.includes('Mod') || fund.risk_profile === 'Medium' ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-success/10 text-success border border-success/20'}`}>{fund.risk_profile} Risk</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-4 font-mono">PKR {fund.latest_nav?.toFixed(4) || '---'}</td>

                                                                {/* 1M Return */}
                                                                <td className={`py-3 px-4 text-right font-medium ${fund.metrics?.return_1m >= 0 ? 'text-success' : 'text-danger'}`}>
                                                                    {fund.metrics?.return_1m}%
                                                                </td>

                                                                {/* 6M Return */}
                                                                <td className={`py-3 px-4 text-right font-medium ${fund.metrics?.return_6m >= 0 ? 'text-success' : 'text-danger'}`}>
                                                                    {fund.metrics?.return_6m}%
                                                                </td>

                                                                {/* 1Y Return */}
                                                                <td className={`py-3 px-4 text-right font-medium ${fund.metrics?.return_1y >= 0 ? 'text-success' : 'text-danger'}`}>
                                                                    {fund.metrics?.return_1y}%
                                                                </td>

                                                                {/* YTD Return */}
                                                                <td className={`py-3 px-4 text-right font-medium ${fund.metrics?.return_ytd >= 0 ? 'text-success' : 'text-danger'}`}>
                                                                    {fund.metrics?.return_ytd}%
                                                                </td>
                                                            </tr>
                                                            {expandedFundId === fund.fund_id && (
                                                                <tr className="bg-black/40 relative">
                                                                    <td colSpan={6} className="p-6 md:pl-12">
                                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                                                                        <div className="flex items-start gap-4 max-w-4xl">
                                                                            <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-2xl shrink-0 hidden md:block">
                                                                                <Database size={24} />
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="text-sm font-bold text-text-primary mb-2 tracking-wide uppercase flex items-center gap-2">
                                                                                    Fund Asset Allocation Dashboard
                                                                                </h4>
                                                                                <p className="text-sm text-text-secondary leading-relaxed tracking-wide">
                                                                                    {fund.asset_allocation && fund.asset_allocation !== "Unknown" ? fund.asset_allocation : "Asset allocation details are currently empty. Upload the latest FMR PDF for this bank via the Upload FMR button in the header to intelligently extract this data."}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Statement Details Modal Overlay */}
                {isStatementDetailsOpen && selectedStatement && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                        <div className="bg-surface border border-emerald-500/20 rounded-3xl p-6 md:p-8 max-w-5xl w-full h-[85vh] shadow-2xl relative flex flex-col">
                            <button
                                onClick={() => setIsStatementDetailsOpen(false)}
                                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-white bg-[var(--color-white-5)] hover:bg-danger/20 rounded-full transition-colors z-10"
                            >
                                <X size={16} />
                            </button>

                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-2xl">
                                        <FileText size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold tracking-tight">Statement Details</h2>
                                        <p className="text-sm text-text-secondary">Viewing latest holdings for Portfolio: <span className="font-mono text-emerald-500">{selectedStatement.portfolio}</span></p>
                                    </div>
                                </div>
                                <div className="hidden md:block px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">{selectedStatement.bank}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-[var(--color-white-5)] text-text-secondary text-xs uppercase tracking-wider">
                                            <th className="py-4 font-semibold">Fund Name</th>
                                            <th className="py-4 font-semibold">Category</th>
                                            <th className="py-4 font-semibold text-right">Units</th>
                                            <th className="py-4 font-semibold text-right">NAV</th>
                                            <th className="py-4 font-semibold text-right">Market Value</th>
                                            <th className="py-4 font-semibold text-right">Gain / Loss</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedStatement.holdings.map((h: any, idx: number) => (
                                            <tr key={idx} className="border-b border-[var(--color-white-5)] hover:bg-[var(--color-white-2)] transition-colors group">
                                                <td className="py-4">
                                                    <p className="font-semibold text-text-primary group-hover:text-emerald-500 transition-colors">{h.fund_name}</p>
                                                </td>
                                                <td className="py-4 text-xs">
                                                    <span className="px-2 py-1 bg-[var(--color-white-5)] rounded-md border border-[var(--color-white-10)]">{h.category}</span>
                                                </td>
                                                <td className="py-4 text-right font-mono text-sm">{h.units.toLocaleString()}</td>
                                                <td className="py-4 text-right font-mono text-sm">PKR {h.nav.toFixed(4)}</td>
                                                <td className="py-4 text-right font-bold text-text-primary">
                                                    PKR {h.market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-4 text-right">
                                                    {h.gain_loss !== 0 ? (
                                                        <>
                                                            <p className={`font-bold ${h.gain_loss >= 0 ? 'text-success' : 'text-danger'}`}>
                                                                {h.gain_loss >= 0 ? '+' : ''}PKR {h.gain_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </p>
                                                            <p className={`text-[10px] ${h.gain_loss >= 0 ? 'text-success/80' : 'text-danger/80'}`}>
                                                                {h.percentage_change.toFixed(2)}%
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <span className="text-text-secondary text-xs italic">Not Provided</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* PDF Password Settings Modal */}
                {isPdfSettingsOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                        <div className="bg-surface border border-warning/20 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
                            <button
                                onClick={() => setIsPdfSettingsOpen(false)}
                                className="absolute top-4 right-4 p-2 text-text-secondary hover:text-white bg-[var(--color-white-5)] hover:bg-danger/20 rounded-full transition-colors"
                            >
                                <X size={16} />
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-warning/20 text-warning rounded-2xl">
                                    <Database size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">PDF Password Settings</h2>
                                    <p className="text-sm text-text-secondary">Set passwords for encrypted bank statements. Saved securely in your account.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {(['atlas', 'meezan', 'hbl', 'faysal'] as const).map(bank => (
                                    <div key={bank} className="p-4 bg-[var(--color-white-5)] border border-[var(--color-white-10)] rounded-2xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold capitalize text-text-primary">{bank}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                                    bankConfigs[bank]
                                                        ? 'bg-success/10 text-success border-success/20'
                                                        : 'bg-[var(--color-white-10)] text-text-secondary border-[var(--color-white-10)]'
                                                }`}>
                                                    {bankConfigs[bank] ? '✓ Password Set' : 'Not configured'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type={pdfPasswordVisible[bank] ? 'text' : 'password'}
                                                    placeholder={bankConfigs[bank] ? 'Enter new password to update...' : 'Enter PDF password...'}
                                                    value={pdfPasswordInputs[bank] || ''}
                                                    onChange={e => setPdfPasswordInputs(p => ({ ...p, [bank]: e.target.value }))}
                                                    className="w-full bg-black/20 border border-[var(--color-white-10)] rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-warning/50 transition-colors pr-10"
                                                    onKeyDown={e => e.key === 'Enter' && savePdfPassword(bank)}
                                                />
                                                <button
                                                    type="button"
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                                                    onClick={() => setPdfPasswordVisible(p => ({ ...p, [bank]: !p[bank] }))}
                                                >
                                                    {pdfPasswordVisible[bank] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => savePdfPassword(bank)}
                                                disabled={pdfSaveStatus[bank] === 'saving'}
                                                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                                                    pdfSaveStatus[bank] === 'saved'
                                                        ? 'bg-success/20 text-success border border-success/30'
                                                        : 'bg-warning/20 hover:bg-warning/30 text-warning border border-warning/30'
                                                }`}
                                            >
                                                {pdfSaveStatus[bank] === 'saving' ? 'Saving...' : pdfSaveStatus[bank] === 'saved' ? '✓ Saved' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <p className="text-xs text-text-secondary mt-5 text-center">
                                Passwords are stored in your Fund Tracker database only. After saving, existing PDFs in your folder will be re-scanned automatically.
                            </p>
                        </div>
                    </div>
                )}
            </>
                ) : (
                    <Outlet />
                )}
            </main>
        </div>
    );
};


const HeaderButton = ({ onClick, icon, label }: { onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button
        onClick={onClick}
        className="px-4 py-2 bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] border border-[var(--color-white-10)] rounded-lg text-text-primary text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
    >
        {icon}
        <span className="hidden lg:inline">{label}</span>
    </button>
);

const NavItem = ({ icon, label, active, isOpen, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-200 group
      ${active
                ? 'bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 font-semibold'
                : 'text-text-secondary hover:bg-[var(--color-white-5)] hover:text-white'
            }
      ${!isOpen && 'justify-center'}
    `}
        title={!isOpen ? label : ''}
    >
        <span className={`${active ? 'text-emerald-500' : 'text-text-secondary group-hover:text-white'} transition-colors`}>
            {icon}
        </span>
        {isOpen && <span className="whitespace-nowrap">{label}</span>}
    </button>
);

const KPICard = ({ title, value, subtitle, badge, tone, className }: any) => (
    <div className={`bg-surface border border-[var(--color-white-5)] rounded-2xl p-5 hover:border-[var(--color-white-10)] transition-all shadow-sm group relative flex flex-col justify-between overflow-hidden min-w-0 ${className || ''}`}>
        <div className="flex justify-between items-start gap-2 mb-1">
            <h3 className="text-text-secondary text-[11px] font-semibold uppercase tracking-wider truncate" title={title}>{title}</h3>
            {badge && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap shrink-0">
                    {badge}
                </span>
            )}
        </div>
        <p className={`mt-1 text-base sm:text-lg xl:text-xl font-bold font-mono tabular-nums tracking-tight truncate ${tone === 'down' ? 'text-danger' : tone === 'up' ? 'text-success' : 'text-text-primary'}`} title={value}>
            {value}
        </p>
        {subtitle ? (
            <p className="text-xs text-text-secondary mt-1 font-medium truncate" title={subtitle}>{subtitle}</p>
        ) : <div className="h-4" />}
    </div>
);

export default Dashboard;
