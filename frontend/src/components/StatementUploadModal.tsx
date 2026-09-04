import React, { useState } from 'react';
import client from '../api/client';
import { X, UploadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const BANKS = ['Meezan', 'HBL', 'Atlas', 'Faysal'];

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const StatementUploadModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [bank, setBank] = useState<string>('Meezan');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);

    if (!isOpen) return null;

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setResult(null);
        try {
            const formData = new FormData();
            formData.append('bank', bank.toLowerCase());
            formData.append('file', file);
            const res = await client.post('/api/statements/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = res.data;
            if (data.status === 'error') {
                setResult({ type: 'error', message: data.message || 'Failed to parse statement.' });
            } else {
                setResult({
                    type: 'success',
                    message: data.message || 'Statement processed.',
                    details: `${data.holdings_count} holdings • Total PKR ${(data.total_market_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                });
                setFile(null);
            }
        } catch (err: any) {
            setResult({ type: 'error', message: err.response?.data?.detail || 'Upload failed.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface border border-[var(--color-white-10)] rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] rounded-full transition-colors"
                >
                    <X size={16} />
                </button>

                <h2 className="text-xl font-bold mb-1">Upload Statement</h2>
                <p className="text-sm text-text-secondary mb-6">Select your bank and drop your PDF statement.</p>

                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Institution</label>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    {BANKS.map((b) => (
                        <button
                            key={b}
                            onClick={() => setBank(b)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                                bank === b
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[var(--color-white-5)] text-text-secondary hover:text-text-primary'
                            }`}
                        >
                            {b}
                        </button>
                    ))}
                </div>

                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">PDF Statement</label>
                <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:cursor-pointer mb-6"
                />

                {result && (
                    <div
                        className={`mb-4 flex items-start gap-2 p-3 rounded-xl ${
                            result.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-danger/10 text-danger'
                        }`}
                    >
                        {result.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
                        <div>
                            <p className="text-sm font-medium">{result.message}</p>
                            {result.details && <p className="text-xs opacity-80 mt-0.5">{result.details}</p>}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary">
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                        {loading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StatementUploadModal;
