/**
 * Friendly 403 landing used by react-router guards when a logged-in
 * user attempts to reach a page their role does not permit. We never
 * sign them out — instead, we explain what happened, show their
 * current role, and offer two safe fallback actions (back / dashboard).
 *
 * The backend remains the actual gatekeeper. This screen is purely a
 * cooperative UX layer so privileged URLs do not leak admin chrome
 * before the API rejects the underlying request.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useSession } from '../context/SessionContext';
import { ROUTE_PATHS } from '../routes/paths';

interface UnauthorizedPageProps {
    lang?: 'zh' | 'en';
}

const COPY = {
    zh: {
        title: '無權限存取',
        explanation: '此頁面僅供具有對應權限的使用者使用，請聯絡系統管理員以取得必要權限。',
        currentRole: '目前身份',
        attemptedPath: '嘗試存取的路徑',
        backToDashboard: '返回工作區',
        backToLogin: '回到登入頁',
        guest: '訪客',
    },
    en: {
        title: '403 — Access Denied',
        explanation:
            'You do not currently have permission to view this page. Contact a system administrator if you believe you should.',
        currentRole: 'Current role',
        attemptedPath: 'Requested path',
        backToDashboard: 'Back to dashboard',
        backToLogin: 'Return to sign-in',
        guest: 'Not signed in',
    },
} as const;

const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({ lang = 'zh' }) => {
    const session = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const t = COPY[lang];

    // location.state is populated when guards redirect using
    // `<Navigate state={{ from: ... }} />`. We log it for the user but
    // never blindly redirect there — that would open a redirect loop
    // back to the page they cannot access.
    const attemptedFrom =
        (location.state && typeof location.state === 'object' && 'from' in location.state)
            ? String((location.state as { from?: unknown }).from || '')
            : '';

    const handleBack = () => {
        if (session.user) {
            navigate(ROUTE_PATHS.DASHBOARD, { replace: true });
        } else {
            navigate(ROUTE_PATHS.LOGIN, { replace: true });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 px-4">
            <div className="bg-white border border-rose-100 shadow-xl rounded-2xl p-10 max-w-lg w-full text-center">
                <div className="text-6xl mb-4" aria-hidden="true">🚫</div>
                <h1 className="text-2xl font-bold text-slate-800 mb-3">{t.title}</h1>
                <p className="text-slate-600 mb-6 leading-relaxed">{t.explanation}</p>

                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-left text-sm text-slate-700 mb-6 space-y-1">
                    <div>
                        <span className="font-semibold">{t.currentRole}:</span>{' '}
                        <span data-testid="unauthorized-role">
                            {session.role ?? t.guest}
                        </span>
                    </div>
                    {attemptedFrom && (
                        <div className="break-all">
                            <span className="font-semibold">{t.attemptedPath}:</span>{' '}
                            <span data-testid="unauthorized-path">{attemptedFrom}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {session.user ? (
                        <button
                            onClick={handleBack}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
                        >
                            {t.backToDashboard}
                        </button>
                    ) : (
                        <Link
                            to={ROUTE_PATHS.LOGIN}
                            replace
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
                        >
                            {t.backToLogin}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnauthorizedPage;
