import React, { useMemo, useState } from 'react';
import {
    managedUserCreateSchema,
    type ManagedUserCreateInput,
} from '../types/managedUser';
import { type UserRole } from '../types/user';

interface CreateUserModalProps {
    isOpen: boolean;
    isSubmitting: boolean;
    onClose: () => void;
    onCreate: (user: ManagedUserCreateInput) => Promise<void>;
    lang: 'zh' | 'en';
}

interface FormState {
    department: string;
    email: string;
    name: string;
    organization: string;
    position: string;
    role: UserRole;
}

const INITIAL_FORM_STATE: FormState = {
    name: '',
    email: '',
    role: 'VENDOR_USER',
    organization: '',
    department: '',
    position: '',
};

const CreateUserModal: React.FC<CreateUserModalProps> = ({
    isOpen,
    isSubmitting,
    onClose,
    onCreate,
    lang,
}) => {
    const t = lang === 'zh';
    const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [submitError, setSubmitError] = useState('');

    const roleOptions = useMemo(() => ([
        { value: 'SYS_ADMIN' as UserRole, label: t ? '系統管理者' : 'System Admin', color: 'bg-red-100 border-red-300 text-red-700' },
        { value: 'AGENCY_USER' as UserRole, label: t ? '機關使用者' : 'Agency User', color: 'bg-blue-100 border-blue-300 text-blue-700' },
        { value: 'VENDOR_USER' as UserRole, label: t ? '設計廠商' : 'Vendor User', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
    ]), [t]);

    const setFieldValue = <K extends keyof FormState>(field: K, value: FormState[K]) => {
        setFormData((current) => ({ ...current, [field]: value }));
        setFieldErrors((current) => {
            if (!current[field]) {
                return current;
            }
            const nextErrors = { ...current };
            delete nextErrors[field];
            return nextErrors;
        });
        setSubmitError('');
    };

    const resetAndClose = () => {
        setFormData(INITIAL_FORM_STATE);
        setFieldErrors({});
        setSubmitError('');
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const parsed = managedUserCreateSchema.safeParse(formData);
        if (!parsed.success) {
            setFieldErrors(parsed.error.flatten().fieldErrors);
            return;
        }

        try {
            await onCreate(parsed.data);
            resetAndClose();
        } catch (error) {
            if (
                error
                && typeof error === 'object'
                && 'fieldErrors' in error
                && error.fieldErrors
                && typeof error.fieldErrors === 'object'
            ) {
                setFieldErrors(error.fieldErrors as Record<string, string[]>);
            }
            setSubmitError(error instanceof Error ? error.message : (t ? '建立帳號失敗。' : 'Failed to create account.'));
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => !isSubmitting && resetAndClose()}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-6 text-white">
                    <h2 className="text-2xl font-black">
                        {t ? '新增帳號' : 'Create Account'}
                    </h2>
                    <p className="text-slate-300 text-sm mt-1">
                        {t ? '填寫使用者資訊，系統會寄送暫時密碼。' : 'Fill in user information and the system will email a temporary password.'}
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
                                onChange={(event) => setFieldValue('name', event.target.value)}
                                placeholder={t ? '輸入姓名' : 'Enter name'}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                            {fieldErrors.name?.[0] && <p className="text-xs text-red-600">{fieldErrors.name[0]}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">
                                {t ? '電子郵件' : 'Email'} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(event) => setFieldValue('email', event.target.value)}
                                placeholder={t ? '輸入電子郵件' : 'Enter email'}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                            {fieldErrors.email?.[0] && <p className="text-xs text-red-600">{fieldErrors.email[0]}</p>}
                        </div>
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '角色權限' : 'Role'} <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {roleOptions.map((role) => (
                                <button
                                    key={role.value}
                                    type="button"
                                    onClick={() => setFieldValue('role', role.value)}
                                    className={`p-3 rounded-xl border-2 text-[11px] font-bold transition-all ${formData.role === role.value
                                            ? `${role.color} ring-2 ring-offset-2 ring-slate-400`
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                >
                                    {role.label}
                                </button>
                            ))}
                        </div>
                        {fieldErrors.role?.[0] && <p className="text-xs text-red-600">{fieldErrors.role[0]}</p>}
                    </div>

                    {/* Organization & Department */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">
                                {t ? '所屬機關/單位' : 'Organization'}
                            </label>
                            <input
                                type="text"
                                value={formData.organization}
                                onChange={(event) => setFieldValue('organization', event.target.value)}
                                placeholder={t ? '輸入機關名稱' : 'Enter organization'}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {fieldErrors.organization?.[0] && <p className="text-xs text-red-600">{fieldErrors.organization[0]}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">
                                {t ? '部門' : 'Department'}
                            </label>
                            <input
                                type="text"
                                value={formData.department}
                                onChange={(event) => setFieldValue('department', event.target.value)}
                                placeholder={t ? '輸入部門' : 'Enter department'}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {fieldErrors.department?.[0] && <p className="text-xs text-red-600">{fieldErrors.department[0]}</p>}
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
                            onChange={(event) => setFieldValue('position', event.target.value)}
                            placeholder={t ? '輸入職稱' : 'Enter position'}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {fieldErrors.position?.[0] && <p className="text-xs text-red-600">{fieldErrors.position[0]}</p>}
                    </div>

                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 leading-6">
                        {t
                            ? '系統會自動產生 12 碼暫時密碼、以 Argon2id 雜湊儲存，並寄送到使用者電子郵件。首次登入後必須立即變更密碼。'
                            : 'The system will auto-generate a 12-character temporary password, store only its Argon2id hash, and email the password to the user. First login requires an immediate password change.'}
                    </div>

                    {submitError && (
                        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {submitError}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t ? '取消' : 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white font-bold rounded-xl shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting
                                ? (t ? '建立中...' : 'Creating...')
                                : (t ? '建立帳號' : 'Create Account')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;
