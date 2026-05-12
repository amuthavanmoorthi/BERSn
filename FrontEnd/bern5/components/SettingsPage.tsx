import React, { useEffect, useState } from 'react';

import { getCurrentUser, type AuthenticatedUser } from '../services/authApi';
import {
    BuildingIcon,
    OfficeIcon,
    SettingsIcon,
    UsersIcon,
} from './icons/CommonIcons';

interface SettingsPageProps {
    lang: 'zh' | 'en';
    onBack: () => void;
    onLanguageChange: () => void;
    onLogout?: () => void;
    onNavigateToAccounts: () => void;
    onNavigateToAgencies: () => void;
}

const PLATFORM_VERSION = 'v5.3.2';
const FRAMEWORK_VERSION = 'BERSn-Compliance Framework v5.3.4';

const SettingsPage: React.FC<SettingsPageProps> = ({
    lang,
    onBack,
    onLanguageChange,
    onLogout,
    onNavigateToAccounts,
    onNavigateToAgencies,
}) => {
    const t = lang === 'zh';
    const [user, setUser] = useState<AuthenticatedUser | null>(null);

    useEffect(() => {
        let cancelled = false;
        getCurrentUser()
            .then((u) => { if (!cancelled) setUser(u); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, []);

    const Section: React.FC<{ titleZh: string; titleEn: string; descZh?: string; descEn?: string; children: React.ReactNode }>
        = ({ titleZh, titleEn, descZh, descEn, children }) => (
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div>
                    <h2 className="text-lg font-black text-slate-800">{t ? `${titleZh} ${titleEn}` : titleEn}</h2>
                    {(descZh || descEn) && (
                        <p className="text-xs text-slate-500 mt-1">{t ? (descZh || descEn) : (descEn || descZh)}</p>
                    )}
                </div>
                {children}
            </section>
        );

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
                        onClick={onNavigateToAgencies}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left"
                    >
                        <OfficeIcon className="w-4 h-4" />
                        {t ? '機關管理' : 'Agency Management'}
                    </button>
                    <button
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm text-left"
                    >
                        <SettingsIcon className="w-4 h-4" />
                        {t ? '系統設定' : 'Settings'}
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100">
                    {onLogout && (
                        <button
                            onClick={onLogout}
                            className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors"
                        >
                            {t ? '登出 Sign Out' : 'Sign Out'}
                        </button>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full">
                <header className="mb-8">
                    <h1 className="text-3xl font-black text-slate-800">{t ? '系統設定' : 'Settings'}</h1>
                    <p className="text-sm text-slate-500 mt-1">{t ? '管理個人偏好、帳號安全與系統資訊。' : 'Manage personal preferences, account security and system info.'}</p>
                </header>

                <div className="space-y-6">
                    {/* Account */}
                    <Section
                        titleZh="帳號"
                        titleEn="Account"
                        descZh="目前登入的使用者資訊。"
                        descEn="Information about the currently signed-in user."
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '使用者名稱 Username' : 'Username'}</p>
                                <p className="font-bold text-slate-800">{user?.username || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '角色 Role' : 'Role'}</p>
                                <p className="font-bold text-slate-800">{user?.role || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '使用者 ID User ID' : 'User ID'}</p>
                                <p className="font-mono text-xs text-slate-600 break-all">{user?.id || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '首次登入 First Login' : 'First Login'}</p>
                                <p className="font-bold text-slate-800">
                                    {user
                                        ? user.is_first_login
                                            ? (t ? '是 Yes' : 'Yes')
                                            : (t ? '否 No' : 'No')
                                        : '—'}
                                </p>
                            </div>
                        </div>
                    </Section>

                    {/* Preferences */}
                    <Section
                        titleZh="偏好設定"
                        titleEn="Preferences"
                        descZh="調整介面語言。"
                        descEn="Adjust the interface language."
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{t ? '介面語言 Interface Language' : 'Interface Language'}</p>
                                <p className="text-xs text-slate-500">{t ? '目前語言：繁體中文 + English' : 'Current: English + 繁體中文'}</p>
                            </div>
                            <button
                                onClick={onLanguageChange}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                            >
                                {t ? '切換語言 Switch Language' : 'Switch Language'}
                            </button>
                        </div>
                    </Section>

                    {/* Security */}
                    <Section
                        titleZh="安全性"
                        titleEn="Security"
                        descZh="密碼管理與通行金鑰。"
                        descEn="Manage your password and passkeys."
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{t ? '變更密碼 Change Password' : 'Change Password'}</p>
                                <p className="text-xs text-slate-500">{t ? '建議每 90 天更換一次密碼。' : 'Recommend changing every 90 days.'}</p>
                            </div>
                            <button
                                onClick={() => alert(t ? '請於登入頁面選擇「變更密碼」。' : 'Use the "Change Password" option from the login screen.')}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                {t ? '前往 Go' : 'Go'}
                            </button>
                        </div>
                    </Section>

                    {/* System Info */}
                    <Section
                        titleZh="系統資訊"
                        titleEn="System Information"
                        descZh="平台版本與技術規範。"
                        descEn="Platform version and technical framework."
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '平台版本 Platform Version' : 'Platform Version'}</p>
                                <p className="font-bold text-slate-800">BERSn-Pro {PLATFORM_VERSION}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '規範版本 Compliance Framework' : 'Compliance Framework'}</p>
                                <p className="font-bold text-slate-800">{FRAMEWORK_VERSION}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '計算引擎 Calculation Engine' : 'Calculation Engine'}</p>
                                <p className="font-bold text-slate-800">{t ? '建築效能數位孿生 Architectural Performance Digital Twin' : 'Architectural Performance Digital Twin'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{t ? '使用條款 Terms' : 'Terms'}</p>
                                <p className="font-bold text-slate-800">© {new Date().getFullYear()} BERSn-Pro</p>
                            </div>
                        </div>
                    </Section>
                </div>
            </main>
        </div>
    );
};

export default SettingsPage;
