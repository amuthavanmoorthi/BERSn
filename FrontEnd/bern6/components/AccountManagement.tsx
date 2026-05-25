import React, { useState } from 'react';
import { User, UserRole, ROLE_INFO, SAMPLE_USERS } from '../types/user';
import UserCard from './UserCard';
import CreateUserModal from './CreateUserModal';

interface AccountManagementProps {
    lang: 'zh' | 'en';
    onBack: () => void;
    onLanguageChange: () => void;
}

const AccountManagement: React.FC<AccountManagementProps> = ({
    lang,
    onBack,
    onLanguageChange,
}) => {
    const t = lang === 'zh';
    const [users, setUsers] = useState<User[]>(SAMPLE_USERS);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const handleCreateUser = (userData: Partial<User>) => {
        const newUser: User = {
            id: userData.id || `user-${Date.now()}`,
            name: userData.name || '',
            email: userData.email || '',
            role: userData.role || 'VENDOR_USER',
            organizationName: userData.organizationName,
            department: userData.department,
            position: userData.position,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        setUsers([newUser, ...users]);
    };

    const handleToggleStatus = (userId: string) => {
        setUsers(users.map(u =>
            u.id === userId
                ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' as User['status'] }
                : u
        ));
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });

    // Group users by role for legend
    const roleStats = {
        SYS_ADMIN: users.filter(u => u.role === 'SYS_ADMIN').length,
        AGENCY_USER: users.filter(u => u.role === 'AGENCY_USER').length,
        VENDOR_USER: users.filter(u => u.role === 'VENDOR_USER').length,
    };

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
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">{t ? '全部狀態' : 'All Status'}</option>
                            <option value="active">{t ? '啟用中' : 'Active'}</option>
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

                {/* User Grid */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredUsers.map(user => (
                            <UserCard
                                key={user.id}
                                user={user}
                                lang={lang}
                                isAdmin={true}
                                onToggleStatus={handleToggleStatus}
                            />
                        ))}
                    </div>

                    {filteredUsers.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <span className="text-6xl mb-4">👤</span>
                            <p className="font-bold">{t ? '找不到符合條件的使用者' : 'No users found'}</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Create Modal */}
            <CreateUserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateUser}
                lang={lang}
            />
        </div>
    );
};

export default AccountManagement;
