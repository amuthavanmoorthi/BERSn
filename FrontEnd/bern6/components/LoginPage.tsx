import React, { useState } from 'react';

interface LoginPageProps {
    onLogin: (username: string, password: string) => void;
    lang: 'zh' | 'en';
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, lang }) => {
    const t = lang === 'zh';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setTimeout(() => {
            onLogin(username, password);
            setIsLoading(false);
        }, 800);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--color-bg)' }}>
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Floating clouds */}
                <div className="absolute top-10 left-10 w-32 h-16 bg-white/40 rounded-full blur-xl animate-pulse" />
                <div className="absolute top-20 right-20 w-40 h-20 bg-white/30 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-5 left-1/3 w-24 h-12 bg-white/50 rounded-full blur-lg animate-pulse" style={{ animationDelay: '0.5s' }} />

                {/* Gradient orbs */}
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-gradient-to-br from-emerald-300/30 to-cyan-300/30 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-gradient-to-tr from-blue-300/20 to-emerald-300/20 rounded-full blur-3xl" />
            </div>

            {/* Main container */}
            <div className="relative w-full max-w-6xl backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex min-h-[600px]" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>

                {/* Left side - Illustrated Scene */}
                <div className="hidden lg:flex w-1/2 relative bg-gradient-to-b from-sky-100/80 to-emerald-100/80 flex-col items-center justify-center p-8 overflow-hidden">

                    {/* Floating Icons */}
                    <div className="absolute top-8 left-8 flex gap-4">
                        {/* Solar Panel Icon */}
                        <div className="w-14 h-14 bg-white/80 rounded-2xl shadow-lg flex items-center justify-center animate-bounce" style={{ animationDuration: '3s' }}>
                            <svg className="w-8 h-8 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zm0 2v6h6V4H4zm8 0v6h6V4h-6zm-8 8v6h6v-6H4zm8 0v6h6v-6h-6z" />
                            </svg>
                        </div>
                        {/* Lightning Icon */}
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-xl shadow-lg flex items-center justify-center animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }}>
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                        </div>
                    </div>

                    <div className="absolute top-8 right-8 flex gap-4">
                        {/* Leaf Icon */}
                        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl shadow-lg flex items-center justify-center animate-bounce" style={{ animationDuration: '2.8s', animationDelay: '0.5s' }}>
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
                            </svg>
                        </div>
                        {/* Gear Icon */}
                        <div className="w-14 h-14 bg-white/80 rounded-2xl shadow-lg flex items-center justify-center animate-bounce" style={{ animationDuration: '3.2s', animationDelay: '0.7s' }}>
                            <svg className="w-8 h-8 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 15.5A3.5 3.5 0 118.5 12 3.5 3.5 0 0112 15.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63a.5.5 0 00.12-.64l-2-3.46a.5.5 0 00-.61-.22l-2.49 1a7.28 7.28 0 00-1.69-.98l-.37-2.65A.5.5 0 0014 2h-4a.5.5 0 00-.5.42l-.37 2.65a7.13 7.13 0 00-1.69.98l-2.49-1a.5.5 0 00-.61.22l-2 3.46a.5.5 0 00.12.64L4.57 11a7 7 0 000 1.94l-2.11 1.63a.5.5 0 00-.12.64l2 3.46a.5.5 0 00.61.22l2.49-1a7.28 7.28 0 001.69.98l.37 2.65a.5.5 0 00.5.42h4a.5.5 0 00.5-.42l.37-2.65a7.13 7.13 0 001.69-.98l2.49 1a.5.5 0 00.61-.22l2-3.46a.5.5 0 00-.12-.64l-2.11-1.63z" />
                            </svg>
                        </div>
                    </div>

                    {/* Smart City Illustration */}
                    <div className="relative w-full max-w-md">
                        {/* Globe Base */}
                        <div className="relative">
                            {/* Earth sphere */}
                            <div className="w-80 h-40 mx-auto bg-gradient-to-b from-cyan-400 to-blue-500 rounded-b-full overflow-hidden shadow-2xl">
                                {/* Grid pattern */}
                                <div className="absolute inset-0 opacity-30">
                                    <div className="absolute inset-0" style={{
                                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
                                        backgroundSize: '20px 20px'
                                    }} />
                                </div>
                                {/* Continents */}
                                <div className="absolute top-4 left-1/4 w-16 h-12 bg-emerald-400/60 rounded-full blur-sm" />
                                <div className="absolute top-8 right-1/4 w-12 h-8 bg-emerald-400/60 rounded-full blur-sm" />
                            </div>

                            {/* City on top */}
                            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-72">
                                {/* Ground */}
                                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-full" />

                                {/* Buildings */}
                                <div className="relative flex items-end justify-center gap-1 px-8">
                                    {/* Small building 1 */}
                                    <div className="w-8 h-16 bg-gradient-to-t from-slate-400 to-slate-300 rounded-t-lg relative">
                                        <div className="absolute top-1 left-1 right-1 h-2 bg-cyan-400/50 rounded" />
                                        <div className="absolute top-4 left-1 right-1 h-2 bg-cyan-400/50 rounded" />
                                    </div>

                                    {/* Tall building with solar */}
                                    <div className="w-12 h-28 bg-gradient-to-t from-slate-500 to-slate-400 rounded-t-lg relative">
                                        <div className="absolute -top-3 left-1 right-1 h-4 bg-blue-500 rounded-t" />
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="absolute left-1 right-1 h-1.5 bg-cyan-300/60 rounded" style={{ top: `${6 + i * 5}px` }} />
                                        ))}
                                    </div>

                                    {/* Main tower */}
                                    <div className="w-16 h-36 bg-gradient-to-t from-cyan-600 to-cyan-500 rounded-t-lg relative">
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-6 bg-slate-400" />
                                        {[...Array(7)].map((_, i) => (
                                            <div key={i} className="absolute left-2 right-2 h-1.5 bg-white/40 rounded" style={{ top: `${4 + i * 4}px` }} />
                                        ))}
                                    </div>

                                    {/* Medium building */}
                                    <div className="w-10 h-20 bg-gradient-to-t from-slate-400 to-slate-300 rounded-t-lg relative">
                                        {[...Array(4)].map((_, i) => (
                                            <div key={i} className="absolute left-1 right-1 h-1.5 bg-cyan-300/60 rounded" style={{ top: `${4 + i * 4}px` }} />
                                        ))}
                                    </div>

                                    {/* Small building 2 */}
                                    <div className="w-8 h-14 bg-gradient-to-t from-emerald-600 to-emerald-500 rounded-t-lg" />
                                </div>

                                {/* Wind turbines */}
                                <div className="absolute -left-2 bottom-8">
                                    <div className="w-1 h-12 bg-white rounded-full" />
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-8 animate-spin" style={{ animationDuration: '4s' }}>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full" />
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-4 bg-white rounded-full origin-bottom" />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-1 h-4 bg-white rounded-full origin-top rotate-120" style={{ transform: 'rotate(120deg) translateY(-50%)' }} />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-1 h-4 bg-white rounded-full origin-top" style={{ transform: 'rotate(240deg) translateY(-50%)' }} />
                                    </div>
                                </div>

                                <div className="absolute -right-4 bottom-10">
                                    <div className="w-1 h-16 bg-white rounded-full" />
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-10 animate-spin" style={{ animationDuration: '3s' }}>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full" />
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-5 bg-white rounded-full origin-bottom" />
                                    </div>
                                </div>

                                {/* Trees */}
                                <div className="absolute left-4 bottom-2 w-4 h-6 bg-green-600 rounded-full" />
                                <div className="absolute left-8 bottom-3 w-3 h-5 bg-green-500 rounded-full" />
                                <div className="absolute right-6 bottom-2 w-4 h-7 bg-green-600 rounded-full" />
                                <div className="absolute right-10 bottom-3 w-3 h-4 bg-green-500 rounded-full" />
                            </div>
                        </div>
                    </div>

                    {/* Water drop icon */}
                    <div className="absolute bottom-8 left-12 w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl shadow-lg flex items-center justify-center animate-bounce" style={{ animationDuration: '2.6s' }}>
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />
                        </svg>
                    </div>

                    {/* Sun icon */}
                    <div className="absolute bottom-8 right-12 w-14 h-14 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full shadow-lg flex items-center justify-center animate-pulse">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 7a5 5 0 100 10 5 5 0 000-10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                        </svg>
                    </div>
                </div>

                {/* Right side - Login form */}
                <div className="w-full lg:w-1/2 p-12 flex flex-col justify-center" style={{ background: 'var(--color-card)' }}>
                    {/* Logo and title */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-3xl mb-6 shadow-xl">
                            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black tracking-wide mb-2" style={{ color: 'var(--color-text)' }}>
                            {t ? '桃園市建築物能源設計平台' : 'Taoyuan Building Energy Design Platform'}
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                            {t ? '智慧綠建築能源管理系統' : 'Smart Green Building Energy Management'}
                        </p>
                    </div>

                    {/* Login form */}
                    <form onSubmit={handleSubmit} className="space-y-5 max-w-sm mx-auto w-full">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={t ? '帳號' : 'Username'}
                                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
                                required
                            />
                        </div>

                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t ? '密碼' : 'Password'}
                                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
                                required
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
                                />
                                <span className="text-sm text-slate-600">{t ? '記住帳號密碼' : 'Remember me'}</span>
                            </label>
                            <a href="#" className="text-sm font-medium hover:opacity-80" style={{ color: 'var(--color-accent)' }}>
                                {t ? '忘記密碼？' : 'Forgot password?'}
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 font-bold text-base rounded-xl shadow-lg hover:shadow-xl hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-fg)' }}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>{t ? '登入中...' : 'Logging in...'}</span>
                                </>
                            ) : (
                                <span>{t ? '登入' : 'Login'}</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                            © 2026 {t ? '桃園市政府 建築管理處' : 'Taoyuan City Government'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
