import React, { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { API_BASE_URL, buildFingerprint } from '../services/authApi';

interface BackendDashboardStats {
    totalProjects: number;
    byStatus: Record<string, number>;
    byGrade: Record<string, number>;
    totalFloorAreaM2: number;
    averageEui: number | null;
    recentActivity: Array<{
        projectId: string;
        projectName: string;
        action: string;
        username: string | null;
        at: string;
    }>;
}

interface DashboardOverviewProps {
    lang: 'zh' | 'en';
    onBack: () => void;
    onLanguageChange: () => void;
    onNavigateToAccounts?: () => void;
    onNavigateToProjects?: () => void;
    onLogout?: () => void;
}

// Taoyuan Districts Data
const TAOYUAN_DISTRICTS = [
    { id: 'zhongli', name: '中壢區', nameEn: 'Zhongli', projects: 5, inProgress: 3, completed: 2 },
    { id: 'taoyuan', name: '桃園區', nameEn: 'Taoyuan', projects: 4, inProgress: 2, completed: 2 },
    { id: 'guishan', name: '龜山區', nameEn: 'Guishan', projects: 3, inProgress: 1, completed: 2 },
    { id: 'bade', name: '八德區', nameEn: 'Bade', projects: 2, inProgress: 2, completed: 0 },
    { id: 'luzhu', name: '蘆竹區', nameEn: 'Luzhu', projects: 3, inProgress: 1, completed: 2 },
    { id: 'daxi', name: '大溪區', nameEn: 'Daxi', projects: 1, inProgress: 1, completed: 0 },
    { id: 'pingzhen', name: '平鎮區', nameEn: 'Pingzhen', projects: 2, inProgress: 1, completed: 1 },
];

// Yearly completion data
const YEARLY_DATA = [
    { year: 2026, total: 8, completed: 6, inProgress: 2 },
    { year: 2027, total: 12, completed: 10, inProgress: 2 },
    { year: 2028, total: 15, completed: 11, inProgress: 4 },
    { year: 2029, total: 18, completed: 8, inProgress: 10 },
];

// Category distribution
const CATEGORY_DATA = [
    { id: 'office', name: '辦公建築', nameEn: 'Office', count: 8, color: '#3B82F6' },
    { id: 'hospital', name: '醫院', nameEn: 'Hospital', count: 4, color: '#F59E0B' },
    { id: 'retail', name: '零售商場', nameEn: 'Retail', count: 3, color: '#10B981' },
    { id: 'residential', name: '住宅', nameEn: 'Residential', count: 3, color: '#8B5CF6' },
    { id: 'hotel', name: '旅館', nameEn: 'Hotel', count: 2, color: '#EC4899' },
];

// Recent projects
const RECENT_PROJECTS = [
    { id: 'p1', name: 'A1 綠能總部', status: 'in-progress', date: '2026-01-20', color: '#3B82F6' },
    { id: 'p2', name: 'A2 PMIS V2', status: 'in-progress', date: '2026-01-18', color: '#F59E0B' },
    { id: 'p3', name: '復設計專案', status: 'completed', date: '2026-01-15', color: '#10B981' },
];

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
    lang,
    onBack,
    onLanguageChange,
    onNavigateToAccounts,
    onNavigateToProjects,
    onLogout,
}) => {
    const t = lang === 'zh';

    // ── Backend dashboard stats (fetched on mount) ──
    const [backendStats, setBackendStats] = useState<BackendDashboardStats | null>(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'X-Device-Fingerprint': buildFingerprint() },
                });
                if (!res.ok) return; // Fail silently — keep demo data visible
                const body = await res.json() as { ok: boolean; stats: BackendDashboardStats };
                if (!cancelled && body.ok) setBackendStats(body.stats);
            } catch { /* offline / network — keep demo data */ }
        })();
        return () => { cancelled = true; };
    }, []);

    // Use backend data when available, else demo
    const totalProjects = backendStats?.totalProjects ?? TAOYUAN_DISTRICTS.reduce((sum, d) => sum + d.projects, 0);
    const totalInProgress = backendStats?.byStatus?.IN_REVIEW ?? backendStats?.byStatus?.DRAFT ?? TAOYUAN_DISTRICTS.reduce((sum, d) => sum + d.inProgress, 0);
    const totalCompleted = backendStats?.byStatus?.APPROVED ?? TAOYUAN_DISTRICTS.reduce((sum, d) => sum + d.completed, 0);
    const totalArea = backendStats ? Math.round(backendStats.totalFloorAreaM2 / 10000) / 100 : 967.0;

    // Max for bar chart scaling
    // (maxProjects previously used by inline SVG bar chart — Recharts auto-scales)
    // (maxYearlyTotal previously used by inline SVG bar chart — Recharts auto-scales)

    return (
        <div className="h-screen flex bg-slate-100 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
                {/* Logo */}
                <div className="p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg cursor-pointer"
                            onClick={onLanguageChange}
                        >
                            {lang === 'zh' ? '中' : 'EN'}
                        </div>
                        <div>
                            <h1 className="font-black text-slate-800">PMIS</h1>
                            <p className="text-[10px] text-slate-400">{t ? '綠建入口網' : 'Green Building Portal'}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    <button
                        onClick={onNavigateToProjects}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left"
                    >
                        <span>📋</span>
                        {t ? '專案入口網' : 'Project Portal'}
                    </button>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm">
                        <span>📊</span>
                        {t ? '儀表板總覽' : 'Dashboard'}
                    </a>
                    <button
                        onClick={onNavigateToAccounts}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left"
                    >
                        <span>👥</span>
                        {t ? '帳號管理' : 'Account Management'}
                    </button>
                </nav>

                {onLogout && (
                    <div className="p-4 border-t border-slate-100">
                        <button
                            onClick={onLogout}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors"
                        >
                            {t ? '登出' : 'Sign Out'}
                        </button>
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">
                            {t ? '儀表板總覽' : 'Dashboard Overview'}
                        </h2>
                        <p className="text-sm text-slate-400">
                            {t ? '桃園市專案執行情形' : 'Taoyuan City Project Status'}
                        </p>
                    </div>
                </header>

                {/* Dashboard Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t ? '專案中' : 'In Progress'}</p>
                            <p className="text-3xl font-black text-blue-600">{totalInProgress}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t ? '執行中' : 'Active'}</p>
                            <p className="text-3xl font-black text-amber-500">{totalInProgress}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t ? '轄區面積' : 'District Area'}</p>
                            <p className="text-3xl font-black text-slate-800">{totalArea} <span className="text-sm font-medium text-slate-400">km²</span></p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t ? '總專案數' : 'Total Projects'}</p>
                            <p className="text-3xl font-black text-emerald-600">{totalProjects}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-6">
                        {/* Left Column */}
                        <div className="col-span-8 space-y-6">
                            {/* Taoyuan District Map with Overlays */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-4">{t ? '桃園市行政區專案分布' : 'Taoyuan District Project Distribution'}</h3>
                                <div className="relative">
                                    {/* Map Image - Enlarged */}
                                    <img
                                        src="/taoyuan-map.png"
                                        alt="桃園市行政區劃"
                                        className="w-full h-auto min-h-[550px] object-contain"
                                    />
                                    {/* District Overlays - positioned to match actual map locations */}
                                    {/* 大園區 - top-center (機場附近) */}
                                    <div className="absolute" style={{ top: '12%', left: '40%' }}>
                                        <div className="bg-indigo-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">2</span>
                                            <span className="text-[8px] font-bold">大園區</span>
                                        </div>
                                    </div>
                                    {/* 蘆竹區 - top-right (大園右邊) */}
                                    <div className="absolute" style={{ top: '8%', left: '58%' }}>
                                        <div className="bg-cyan-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">3</span>
                                            <span className="text-[8px] font-bold">蘆竹區</span>
                                        </div>
                                    </div>
                                    {/* 龜山區 - right-top (蘆竹下方) */}
                                    <div className="absolute" style={{ top: '18%', left: '72%' }}>
                                        <div className="bg-orange-500 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">3</span>
                                            <span className="text-[8px] font-bold">龜山區</span>
                                        </div>
                                    </div>
                                    {/* 觀音區 - left (西側海邊) */}
                                    <div className="absolute" style={{ top: '22%', left: '18%' }}>
                                        <div className="bg-teal-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">1</span>
                                            <span className="text-[8px] font-bold">觀音區</span>
                                        </div>
                                    </div>
                                    {/* 中壢區 - center (地圖中心偏左) */}
                                    <div className="absolute" style={{ top: '30%', left: '38%' }}>
                                        <div className="bg-blue-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">5</span>
                                            <span className="text-[8px] font-bold">中壢區</span>
                                        </div>
                                    </div>
                                    {/* 桃園區 - center-right (中壢右邊) */}
                                    <div className="absolute" style={{ top: '26%', left: '55%' }}>
                                        <div className="bg-emerald-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">4</span>
                                            <span className="text-[8px] font-bold">桃園區</span>
                                        </div>
                                    </div>
                                    {/* 八德區 - right (桃園區下方) */}
                                    <div className="absolute" style={{ top: '35%', left: '65%' }}>
                                        <div className="bg-purple-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">2</span>
                                            <span className="text-[8px] font-bold">八德區</span>
                                        </div>
                                    </div>
                                    {/* 新屋區 - left-bottom (觀音下方) */}
                                    <div className="absolute" style={{ top: '38%', left: '10%' }}>
                                        <div className="bg-slate-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">1</span>
                                            <span className="text-[8px] font-bold">新屋區</span>
                                        </div>
                                    </div>
                                    {/* 楊梅區 - bottom-left (新屋右下) */}
                                    <div className="absolute" style={{ top: '48%', left: '25%' }}>
                                        <div className="bg-rose-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">2</span>
                                            <span className="text-[8px] font-bold">楊梅區</span>
                                        </div>
                                    </div>
                                    {/* 平鎮區 - center-bottom (中壢下方) */}
                                    <div className="absolute" style={{ top: '42%', left: '48%' }}>
                                        <div className="bg-pink-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">2</span>
                                            <span className="text-[8px] font-bold">平鎮區</span>
                                        </div>
                                    </div>
                                    {/* 龍潭區 - bottom-center (平鎮下方) */}
                                    <div className="absolute" style={{ top: '55%', left: '42%' }}>
                                        <div className="bg-violet-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">1</span>
                                            <span className="text-[8px] font-bold">龍潭區</span>
                                        </div>
                                    </div>
                                    {/* 大溪區 - right-center (八德下方) */}
                                    <div className="absolute" style={{ top: '50%', left: '62%' }}>
                                        <div className="bg-amber-600 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">1</span>
                                            <span className="text-[8px] font-bold">大溪區</span>
                                        </div>
                                    </div>
                                    {/* 復興區 - bottom-right (山區，最大區域) */}
                                    <div className="absolute" style={{ top: '72%', left: '68%' }}>
                                        <div className="bg-green-700 text-white px-2 py-1 rounded-lg shadow-lg flex flex-col items-center">
                                            <span className="text-lg font-black">0</span>
                                            <span className="text-[8px] font-bold">復興區</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Yearly Completion Chart — Recharts */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-4">{t ? '人月資源分布' : 'Yearly Resource Distribution'}</h3>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={YEARLY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#64748b' }} />
                                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                                            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconSize={10} />
                                            <Bar dataKey="completed" stackId="a" fill="#10b981" name={t ? '已完成' : 'Completed'} />
                                            <Bar dataKey="inProgress" stackId="a" fill="#fbbf24" name={t ? '執行中' : 'In Progress'} radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Comparative Chart — Districts side-by-side */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-4">{t ? '行政區專案進度比較' : 'District Progress Comparison'}</h3>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={TAOYUAN_DISTRICTS.map(d => ({
                                                ...d,
                                                displayName: t ? d.name : d.nameEn,
                                            }))}
                                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="displayName" tick={{ fontSize: 10, fill: '#64748b' }} />
                                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                                            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconSize={10} />
                                            <Bar dataKey="completed"  fill="#10b981" name={t ? '已完成' : 'Completed'}  radius={[4,4,0,0]} />
                                            <Bar dataKey="inProgress" fill="#fbbf24" name={t ? '執行中' : 'In Progress'} radius={[4,4,0,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="col-span-4 space-y-6">
                            {/* Category Pie Chart — Recharts */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-4">{t ? '專案工程分布' : 'Category Distribution'}</h3>
                                <div className="h-44">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                                            <Pie
                                                data={CATEGORY_DATA.map(c => ({ ...c, displayName: t ? c.name : c.nameEn }))}
                                                dataKey="count"
                                                nameKey="displayName"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={70}
                                                paddingAngle={2}
                                            >
                                                {CATEGORY_DATA.map(cat => (
                                                    <Cell key={cat.id} fill={cat.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend */}
                                <div className="space-y-2">
                                    {CATEGORY_DATA.map((cat) => (
                                        <div key={cat.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.color }}></div>
                                                <span className="text-[11px] text-slate-600">{t ? cat.name : cat.nameEn}</span>
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-400">{cat.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recent Projects */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-4">{t ? '最新專案新設紀錄' : 'Recent Projects'}</h3>
                                <div className="space-y-3">
                                    {RECENT_PROJECTS.map((proj) => (
                                        <div key={proj.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                            <div
                                                className="w-2 h-8 rounded-full"
                                                style={{ backgroundColor: proj.color }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-700 truncate">{proj.name}</p>
                                                <p className="text-[10px] text-slate-400">{proj.date}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${proj.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                                }`}>
                                                {proj.status === 'completed' ? (t ? '完成' : 'Done') : (t ? '進行中' : 'Active')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardOverview;
