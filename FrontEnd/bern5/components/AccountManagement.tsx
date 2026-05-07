import React, { useEffect, useMemo, useState } from 'react';
import type { ManagedUserCreateInput } from '../types/managedUser';

import { ROLE_INFO, type User, type UserRole } from '../types/user';
import UserCard from './UserCard';
import CreateUserModal from './CreateUserModal';
import {
    UserApiError,
    createUserAccount,
    getUsers,
    updateUserStatus,
} from '../services/userApi';

interface AccountManagementProps {
    lang: 'zh' | 'en';
    onBack: () => void;
    onLanguageChange: () => void;
    onLogout?: () => void;
}

const AccountManagement: React.FC<AccountManagementProps> = ({
    lang,
    onBack,
    onLanguageChange,
    onLogout,
}) => {
    const t = lang === 'zh';
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | User['status']>('all');
    const [pageMessage, setPageMessage] = useState('');
    const [pageError, setPageError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const loadUsers = async () => {
            setIsLoading(true);
            setPageError('');
            try {
                const result = await getUsers();
                if (!cancelled) {
                    setUsers(result);
                }
            } catch (error) {
                if (!cancelled) {
                    setPageError(error instanceof Error ? error.message : (t ? '載入使用者失敗。' : 'Failed to load users.'));
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadUsers();

        return () => {
            cancelled = true;
        };
    }, [t]);

    const handleCreateUser = async (userData: ManagedUserCreateInput) => {
        setIsCreatingUser(true);
        setPageError('');
        setPageMessage('');
        try {
            const result = await createUserAccount(userData);
            setUsers((currentUsers) => [result.user, ...currentUsers]);
            setPageMessage(
                result.deliveryMode === 'log'
                    ? (
                        result.deliveryReason === 'log_only_enabled'
                            ? (t ? '帳號已建立，但目前環境啟用了郵件記錄模式，暫時密碼只寫入後端日誌，尚未寄送到實際信箱。' : 'Account created, but this environment is running in email log-only mode, so the temporary password was written to the backend logs instead of being emailed.')
                            : (t ? '帳號已建立，但 SMTP 尚未設定完成，暫時密碼目前只寫入後端日誌。' : 'Account created, but SMTP is not configured yet, so the temporary password was written to the backend logs.')
                    )
                    : (t ? '帳號已建立，暫時密碼已寄送至使用者信箱。' : 'Account created and the temporary password email has been sent.')
            );
        } catch (error) {
            if (error instanceof UserApiError) {
                throw error;
            }
            throw new Error(error instanceof Error ? error.message : (t ? '建立帳號失敗。' : 'Failed to create account.'));
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleToggleStatus = async (userId: string) => {
        const currentUser = users.find((user) => user.id === userId);
        if (!currentUser) {
            return;
        }

        setStatusUpdatingUserId(userId);
        setPageError('');
        setPageMessage('');
        try {
            const updatedUser = await updateUserStatus(userId, currentUser.status === 'inactive');
            setUsers((currentUsers) => currentUsers.map((user) => user.id === userId ? updatedUser : user));
            setPageMessage(
                updatedUser.status === 'inactive'
                    ? (t ? '帳號已停用。' : 'Account disabled.')
                    : (t ? '帳號已啟用。' : 'Account enabled.')
            );
        } catch (error) {
            setPageError(error instanceof Error ? error.message : (t ? '更新帳號狀態失敗。' : 'Failed to update account status.'));
        } finally {
            setStatusUpdatingUserId(null);
        }
    };

    const filteredUsers = useMemo(() => users.filter((user) => {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        const matchesSearch = normalizedSearchTerm.length === 0
            || user.name.toLowerCase().includes(normalizedSearchTerm)
            || user.email.toLowerCase().includes(normalizedSearchTerm)
            || (user.organizationName?.toLowerCase().includes(normalizedSearchTerm) || false)
            || (user.username?.toLowerCase().includes(normalizedSearchTerm) || false);

        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    }), [roleFilter, searchTerm, statusFilter, users]);

    const roleStats = useMemo(() => ({
        SYS_ADMIN: users.filter((user) => user.role === 'SYS_ADMIN').length,
        AGENCY_USER: users.filter((user) => user.role === 'AGENCY_USER').length,
        VENDOR_USER: users.filter((user) => user.role === 'VENDOR_USER').length,
    }), [users]);

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
                            <h1 className="font-black text-slate-800">BERSn-Pro</h1>
                            <p className="text-[10px] text-slate-400">{t ? '建築能效平台' : 'Building Energy Platform'}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    <button
                        onClick={onBack}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors"
                    >
                        <span>📋</span>
                        {t ? '專案入口網' : 'Project Portal'}
                    </button>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm">
                        <span>👥</span>
                        {t ? '帳號管理' : 'Account Management'}
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors">
                        <span>🏛️</span>
                        {t ? '機關管理' : 'Agency Management'}
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors">
                        <span>⚙️</span>
                        {t ? '系統設定' : 'Settings'}
                    </a>
                </nav>

                {/* Role Legend */}
                <div className="p-4 border-t border-slate-100">
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">{t ? '角色說明' : 'Role Legend'}</p>
                            <div className="space-y-2">
                                {Object.entries(ROLE_INFO).map(([role, info]) => (
                                    <div key={role} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${info.bgColor}`}></span>
                                            <span className="text-[11px] text-slate-600">{t ? info.name : info.nameEn}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {roleStats[role as UserRole]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors"
                            >
                                {t ? '登出' : 'Sign Out'}
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">
                            {t ? '本群組使用者權限' : 'User Permissions'}
                        </h2>
                        <p className="text-sm text-slate-400">
                            {t ? `共 ${users.length} 位使用者` : `${users.length} users total`}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={t ? '搜尋使用者...' : 'Search users...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-64 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        </div>

                        {/* Role Filter */}
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">{t ? '全部角色' : 'All Roles'}</option>
                            <option value="SYS_ADMIN">{t ? '系統管理者' : 'System Admin'}</option>
                            <option value="AGENCY_USER">{t ? '機關使用者' : 'Agency User'}</option>
                            <option value="VENDOR_USER">{t ? '設計廠商' : 'Vendor User'}</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | User['status'])}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">{t ? '全部狀態' : 'All Status'}</option>
                            <option value="active">{t ? '啟用中' : 'Active'}</option>
                            <option value="pending">{t ? '待變更密碼' : 'Pending Reset'}</option>
                            <option value="inactive">{t ? '已停用' : 'Inactive'}</option>
                        </select>

                        {/* Permissions Legend */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 border-l border-slate-200 pl-4">
                            <span className="font-bold">{t ? '管理者' : 'Admin'}:</span>
                            <span className="text-red-500">{t ? '可以新增帳號和外部權限' : 'Full access'}</span>
                            <span>|</span>
                            <span className="font-bold">{t ? '內部' : 'Internal'}:</span>
                            <span className="text-blue-500">{t ? '擁有群組管理功能' : 'Group manage'}</span>
                            <span>|</span>
                            <span className="font-bold">{t ? '外部' : 'External'}:</span>
                            <span className="text-emerald-500">{t ? '外部訪客' : 'Guest'}</span>
                        </div>

                        {/* Create Button */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2"
                        >
                            <span className="text-lg">+</span>
                            {t ? '新增帳號' : 'Add User'}
                        </button>
                    </div>
                </header>

                {(pageMessage || pageError) && (
                    <div className="px-6 pt-4">
                        {pageMessage && (
                            <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {pageMessage}
                            </div>
                        )}
                        {pageError && (
                            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                                {pageError}
                            </div>
                        )}
                    </div>
                )}

                {/* User Grid */}
                <div className="flex-1 overflow-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <span className="text-4xl mb-4">⏳</span>
                            <p className="font-bold">{t ? '正在載入使用者資料...' : 'Loading users...'}</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredUsers.map(user => (
                                    <UserCard
                                        key={user.id}
                                        user={user}
                                        lang={lang}
                                        isAdmin={true}
                                        onToggleStatus={handleToggleStatus}
                                        statusBusy={statusUpdatingUserId === user.id}
                                    />
                                ))}
                            </div>

                            {filteredUsers.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <span className="text-6xl mb-4">👤</span>
                                    <p className="font-bold">{t ? '找不到符合條件的使用者' : 'No users found'}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Create Modal */}
            <CreateUserModal
                isOpen={isModalOpen}
                isSubmitting={isCreatingUser}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateUser}
                lang={lang}
            />
        </div>
    );
};

export default AccountManagement;
