import React, { useEffect, useMemo, useState } from 'react';

import {
    createOrganization,
    getOrganizations,
    getProjects,
    ProjectApiError,
} from '../services/projectApi';
import type { OrganizationOption, OrganizationType, Project } from '../types/project';
import {
    BuildingIcon,
    OfficeIcon,
    PlusIcon,
    SettingsIcon,
    UsersIcon,
} from './icons/CommonIcons';

interface AgencyManagementProps {
    lang: 'zh' | 'en';
    onBack: () => void;
    onLanguageChange: () => void;
    onLogout?: () => void;
    onNavigateToAccounts: () => void;
    onNavigateToSettings: () => void;
}

interface OrgWithStats extends OrganizationOption {
    projectCount: number;
}

const ORG_TYPE_LABELS: Record<OrganizationType, { zh: string; en: string; colour: string }> = {
    GOVERNMENT: { zh: '政府機關', en: 'Government', colour: 'bg-blue-100 text-blue-700' },
    AGENCY: { zh: '審核機構', en: 'Agency', colour: 'bg-emerald-100 text-emerald-700' },
    VENDOR: { zh: '廠商', en: 'Vendor', colour: 'bg-amber-100 text-amber-700' },
};

const AgencyManagement: React.FC<AgencyManagementProps> = ({
    lang,
    onBack,
    onLanguageChange,
    onLogout,
    onNavigateToAccounts,
    onNavigateToSettings,
}) => {
    const t = lang === 'zh';
    const [orgs, setOrgs] = useState<OrgWithStats[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | OrganizationType>('all');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<OrganizationType>('AGENCY');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const loadOrgs = async () => {
        setIsLoading(true);
        setPageError('');
        try {
            const [orgList, projectList] = await Promise.all([
                getOrganizations(),
                getProjects().catch(() => [] as Project[]),
            ]);
            const counts = new Map<string, number>();
            for (const p of projectList) {
                if (p.organizationId) {
                    counts.set(p.organizationId, (counts.get(p.organizationId) ?? 0) + 1);
                }
            }
            setOrgs(orgList.map((o) => ({ ...o, projectCount: counts.get(o.id) ?? 0 })));
        } catch (err) {
            setPageError(err instanceof Error ? err.message : (t ? '載入機關失敗。' : 'Failed to load organizations.'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (cancelled) return;
            await loadOrgs();
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredOrgs = useMemo(() => {
        const q = search.trim().toLowerCase();
        return orgs.filter((o) => {
            if (typeFilter !== 'all' && o.type !== typeFilter) return false;
            if (q && !o.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [orgs, search, typeFilter]);

    const stats = useMemo(() => {
        const byType: Record<OrganizationType, number> = { GOVERNMENT: 0, AGENCY: 0, VENDOR: 0 };
        let activeCount = 0;
        let totalProjects = 0;
        for (const o of orgs) {
            byType[o.type]++;
            if (o.isActive) activeCount++;
            totalProjects += o.projectCount;
        }
        return { total: orgs.length, byType, activeCount, totalProjects };
    }, [orgs]);

    const handleAdd = async () => {
        const trimmed = newName.trim();
        if (!trimmed) {
            setCreateError(t ? '請輸入機關名稱。' : 'Please enter an organization name.');
            return;
        }
        setCreating(true);
        setCreateError('');
        try {
            await createOrganization({ name: trimmed, type: newType });
            setIsAddOpen(false);
            setNewName('');
            setNewType('AGENCY');
            await loadOrgs();
        } catch (err) {
            if (err instanceof ProjectApiError) {
                setCreateError(err.message);
            } else {
                setCreateError(err instanceof Error ? err.message : (t ? '建立機關失敗。' : 'Failed to create organization.'));
            }
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-100 flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 bg-slate-900 text-white text-xs font-black rounded-xl flex items-center justify-center cursor-pointer"
                            onClick={onLanguageChange}
                        >
                            {lang === 'zh' ? '中' : 'EN'}
                        </div>
                        <div>
                            <h1 className="font-black text-slate-800">BERSn-Pro</h1>
                            <p className="text-[10px] text-slate-400">{t ? '建築能效平台 Building Energy Platform' : 'Building Energy Platform'}</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <button
                        onClick={onBack}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left"
                    >
                        <BuildingIcon className="w-4 h-4" />
                        {t ? '專案入口網' : 'Project Portal'}
                    </button>
                    <button
                        onClick={onNavigateToAccounts}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left"
                    >
                        <UsersIcon className="w-4 h-4" />
                        {t ? '帳號管理' : 'Account Management'}
                    </button>
                    <button
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm text-left"
                    >
                        <OfficeIcon className="w-4 h-4" />
                        {t ? '機關管理' : 'Agency Management'}
                    </button>
                    <button
                        onClick={onNavigateToSettings}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left"
                    >
                        <SettingsIcon className="w-4 h-4" />
                        {t ? '系統設定' : 'Settings'}
                    </button>
                </nav>

                {/* Stats footer */}
                <div className="p-4 border-t border-slate-100 space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '統計 Statistics' : 'Statistics'}</p>
                    {(['GOVERNMENT', 'AGENCY', 'VENDOR'] as OrganizationType[]).map((type) => (
                        <div key={type} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-600">{t ? ORG_TYPE_LABELS[type].zh : ORG_TYPE_LABELS[type].en}</span>
                            <span className="font-bold text-slate-400">{stats.byType[type]}</span>
                        </div>
                    ))}
                    {onLogout && (
                        <button
                            onClick={onLogout}
                            className="w-full mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors"
                        >
                            {t ? '登出 Sign Out' : 'Sign Out'}
                        </button>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">{t ? '機關管理 Agency Management' : 'Agency Management'}</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {orgs.length}{' '}
                            {t ? '個機關 organizations' : 'organizations'}
                            {' · '}
                            {stats.totalProjects}{' '}
                            {t ? '個專案 projects' : 'projects'}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-colors"
                    >
                        <PlusIcon className="w-4 h-4" />
                        {t ? '新增機關 Add Organization' : 'Add Organization'}
                    </button>
                </header>

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 flex flex-wrap gap-3">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t ? '搜尋機關名稱 Search organizations…' : 'Search organizations…'}
                        className="flex-1 min-w-[200px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as 'all' | OrganizationType)}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    >
                        <option value="all">{t ? '所有類型 All types' : 'All types'}</option>
                        <option value="GOVERNMENT">{t ? '政府機關 Government' : 'Government'}</option>
                        <option value="AGENCY">{t ? '審核機構 Agency' : 'Agency'}</option>
                        <option value="VENDOR">{t ? '廠商 Vendor' : 'Vendor'}</option>
                    </select>
                </div>

                {pageError && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{pageError}</div>
                )}

                {isLoading ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
                        {t ? '載入中… Loading…' : 'Loading…'}
                    </div>
                ) : filteredOrgs.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                        <OfficeIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm font-bold">{t ? '尚無機關 No organizations yet' : 'No organizations yet'}</p>
                        <p className="text-slate-400 text-xs mt-1">{t ? '點選右上「新增機關」開始 Click "Add Organization" to get started.' : 'Click "Add Organization" to get started.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredOrgs.map((org) => {
                            const typeInfo = ORG_TYPE_LABELS[org.type];
                            return (
                                <div key={org.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <OfficeIcon className="w-6 h-6 text-slate-500" />
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${typeInfo.colour}`}>
                                            {t ? typeInfo.zh : typeInfo.en}
                                        </span>
                                    </div>
                                    <h3 className="font-black text-slate-800 text-lg leading-tight">{org.name}</h3>
                                    <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">
                                        {new Date(org.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </p>
                                    <div className="mt-5 grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{t ? '專案 Projects' : 'Projects'}</p>
                                            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{org.projectCount}</p>
                                        </div>
                                        <div className={`rounded-xl p-3 ${org.isActive ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{t ? '狀態 Status' : 'Status'}</p>
                                            <p className={`text-sm font-black leading-none mt-1 ${org.isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                {org.isActive
                                                    ? (t ? '啟用中 Active' : 'Active')
                                                    : (t ? '已停用 Inactive' : 'Inactive')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Add Organization Modal */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                        <h2 className="text-xl font-black text-slate-800 mb-2">
                            {t ? '新增機關 Add Organization' : 'Add Organization'}
                        </h2>
                        <p className="text-xs text-slate-500 mb-6">
                            {t ? '名稱重複時將自動重新啟用既有機關。' : 'Re-activates an existing organization if the name already exists.'}
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t ? '機關名稱 Name' : 'Name'}</label>
                                <input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder={t ? '例如：Taoyuan City Government' : 'e.g. Taoyuan City Government'}
                                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    maxLength={200}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t ? '類型 Type' : 'Type'}</label>
                                <div className="grid grid-cols-3 gap-2 mt-1">
                                    {(['GOVERNMENT', 'AGENCY', 'VENDOR'] as OrganizationType[]).map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setNewType(type)}
                                            className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-colors ${newType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            {t ? ORG_TYPE_LABELS[type].zh : ORG_TYPE_LABELS[type].en}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {createError && <div className="text-[11px] font-bold text-red-600">{createError}</div>}
                        </div>
                        <div className="flex justify-end gap-2 mt-8">
                            <button
                                onClick={() => { setIsAddOpen(false); setCreateError(''); }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                {t ? '取消 Cancel' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={creating}
                                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                {creating ? (t ? '建立中… Creating…' : 'Creating…') : (t ? '建立 Create' : 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgencyManagement;
