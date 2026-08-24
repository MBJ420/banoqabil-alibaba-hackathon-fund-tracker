import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { Lock, User, Loader2 } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (localStorage.getItem('session_expired') === 'true') {
            localStorage.removeItem('session_expired');
            setSessionExpired(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError('Username and password are required.');
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);

            const response = await client.post('/token', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            console.log("Login Response:", response.data); // Debugging
            localStorage.setItem('token', response.data.access_token);
            // Also store username for future use
            localStorage.setItem('username', username);

            navigate('/');
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || err.message || 'Login failed';
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-midnight text-text-primary">
            <div className="w-full max-w-md p-8 space-y-6 bg-surface border border-white/10 rounded-2xl shadow-2xl relative z-10">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4 text-white">
                        <Lock size={24} />
                    </div>
                    <h2 className="text-3xl font-bold text-center tracking-tight text-white">FundTracker</h2>
                    <h3 className="text-sm text-center text-text-secondary mt-1 font-medium">Access your portfolio intelligence</h3>
                </div>

                {sessionExpired && (
                    <div className="p-3 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-sm">
                        Your session expired. Please sign in again.
                    </div>
                )}
                {error && <div className="p-3 text-danger bg-danger/10 border border-danger/20 rounded-xl text-center text-sm">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <User className="absolute top-3.5 left-3.5 text-text-secondary" size={18} />
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3 pl-10 bg-midnight rounded-xl border border-white/5 focus:outline-none focus:border-neon-purple transition-colors text-white placeholder-text-secondary/50"
                            required
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute top-3.5 left-3.5 text-text-secondary" size={18} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 pl-10 bg-midnight rounded-xl border border-white/5 focus:outline-none focus:border-neon-purple transition-colors text-white placeholder-text-secondary/50"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full p-3 font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading && <Loader2 size={18} className="animate-spin" />}
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
                <p className="text-center text-sm text-text-secondary">
                    Don't have an account? <Link to="/register" className="text-emerald-500 hover:text-emerald-400 transition-colors font-semibold">Register Account</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
