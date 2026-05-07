import React, { useState } from 'react';

interface ChangePasswordPageProps {
    lang: 'zh' | 'en';
    onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}

const ChangePasswordPage: React.FC<ChangePasswordPageProps> = ({ lang, onSubmit }) => {
    const t = lang === 'zh';
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (newPassword !== confirmPassword) {
            setError(t ? '新密碼與確認密碼不一致。' : 'New password and confirmation do not match.');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await onSubmit(currentPassword, newPassword);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : (t ? '密碼變更失敗。' : 'Password change failed.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-emerald-50 to-cyan-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/70 p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white mb-4 shadow-lg">
                        <span className="text-2xl">🔐</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">
                        {t ? '首次登入請更新密碼' : 'Change your password'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        {t
                            ? '系統管理員已為您建立暫時密碼。請先完成密碼更新後再繼續使用。'
                            : 'Your account was created with a temporary password. Update it now before continuing.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '目前密碼' : 'Current password'}
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '新密碼' : 'New password'}
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '確認新密碼' : 'Confirm new password'}
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 leading-6">
                        {t
                            ? '密碼至少需 12 碼，並包含大寫字母、小寫字母、數字與符號。'
                            : 'Passwords must be at least 12 characters and include uppercase, lowercase, numbers, and symbols.'}
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-emerald-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting
                            ? (t ? '更新中...' : 'Updating...')
                            : (t ? '更新密碼並重新登入' : 'Update password and sign in again')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordPage;
