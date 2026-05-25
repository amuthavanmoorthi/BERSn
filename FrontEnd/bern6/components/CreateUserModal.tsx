import React, { useState } from 'react';
import { User, UserRole } from '../types/user';

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (user: Partial<User>) => void;
    lang: 'zh' | 'en';
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({
    isOpen,
    onClose,
    onCreate,
    lang,
}) => {
    const t = lang === 'zh';
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'VENDOR_USER' as UserRole,
        organizationName: '',
        department: '',
        position: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name && formData.email) {
            onCreate({
                ...formData,
                id: `user-${Date.now()}`,
                status: 'pending',
                createdAt: new Date().toISOString(),
            });
            setFormData({
                name: '',
                email: '',
                role: 'VENDOR_USER',
                organizationName: '',
                department: '',
                position: '',
            });
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-6 text-white">
                    <h2 className="text-2xl font-black">
                        {t ? '新增帳號' : 'Create Account'}
                    </h2>
                    <p className="text-slate-300 text-sm mt-1">
                        {t ? '填寫使用者資訊' : 'Fill in user information'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name & Email Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">
                                {t ? '姓名' : 'Name'} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t ? '輸入姓名' : 'Enter name'}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">
                                {t ? '電子郵件' : 'Email'} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder={t ? '輸入電子郵件' : 'Enter email'}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '角色權限' : 'Role'} <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'SYS_ADMIN', label: t ? '系統管理者' : 'System Admin', color: 'bg-red-100 border-red-300 text-red-700' },
                                { value: 'AGENCY_USER', label: t ? '機關使用者' : 'Agency User', color: 'bg-blue-100 border-blue-300 text-blue-700' },
                                { value: 'VENDOR_USER', label: t ? '設計廠商' : 'Vendor User', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
                            ].map((role) => (
                                <button
                                    key={role.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, role: role.value as UserRole })}
                                    className={`p-3 rounded-xl border-2 text-[11px] font-bold transition-all ${formData.role === role.value
                                            ? `${role.color} ring-2 ring-offset-2 ring-slate-400`
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                >
                                    {role.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Organization & Department */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">
                                {t ? '所屬機關/單位' : 'Organization'}
                            </label>
                            <input
                                type="text"
                                value={formData.organizationName}
                                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                                placeholder={t ? '輸入機關名稱' : 'Enter organization'}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">
                                {t ? '部門' : 'Department'}
                            </label>
                            <input
                                type="text"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                placeholder={t ? '輸入部門' : 'Enter department'}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Position */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '職稱' : 'Position'}
                        </label>
                        <input
                            type="text"
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            placeholder={t ? '輸入職稱' : 'Enter position'}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                        >
                            {t ? '取消' : 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white font-bold rounded-xl shadow-lg transition-all"
                        >
                            {t ? '建立帳號' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;
