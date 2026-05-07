import React from 'react';
import { User, ROLE_INFO } from '../types/user';

interface UserCardProps {
    user: User;
    lang: 'zh' | 'en';
    onEdit?: (userId: string) => void;
    onToggleStatus?: (userId: string) => void;
    isAdmin?: boolean;
    statusBusy?: boolean;
}

// Avatar color based on name hash
const getAvatarColor = (name: string) => {
    const colors = [
        'from-blue-400 to-blue-600',
        'from-emerald-400 to-emerald-600',
        'from-purple-400 to-purple-600',
        'from-orange-400 to-orange-600',
        'from-pink-400 to-pink-600',
        'from-teal-400 to-teal-600',
        'from-indigo-400 to-indigo-600',
        'from-amber-400 to-amber-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const UserCard: React.FC<UserCardProps> = ({
    user,
    lang,
    onEdit,
    onToggleStatus,
    isAdmin = false,
    statusBusy = false,
}) => {
    const t = lang === 'zh';
    const roleInfo = ROLE_INFO[user.role];
    const avatarColor = getAvatarColor(user.name);
    const initials = user.name.slice(0, 2);

    return (
        <div className={`bg-white rounded-xl border ${user.status === 'inactive' ? 'border-slate-300 opacity-60' : 'border-slate-200'} overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group`}>
            {/* Header with Avatar */}
            <div className="p-4 flex gap-4">
                {/* Avatar */}
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-black text-xl shadow-lg flex-shrink-0`}>
                    {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                        initials
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="font-black text-slate-800 text-sm truncate">{user.name}</h3>
                            <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                        </div>
                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${user.status === 'active' ? 'bg-emerald-100 text-emerald-600' :
                                user.status === 'inactive' ? 'bg-slate-100 text-slate-500' :
                                    'bg-amber-100 text-amber-600'
                            }`}>
                            {user.status === 'active' ? (t ? '啟用' : 'Active') :
                                user.status === 'inactive' ? (t ? '停用' : 'Inactive') :
                                    (t ? '待審核' : 'Pending')}
                        </span>
                    </div>

                    {/* Role Badge */}
                    <div className="mt-2">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-bold ${roleInfo.bgColor} ${roleInfo.color}`}>
                            {t ? roleInfo.name : roleInfo.nameEn}
                        </span>
                    </div>
                </div>
            </div>

            {/* Details */}
            <div className="px-4 pb-3 space-y-1.5 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400 w-12 flex-shrink-0">{t ? '單位' : 'Org'}</span>
                    <span className="text-slate-600 font-medium truncate">{user.organizationName || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400 w-12 flex-shrink-0">{t ? '權限' : 'Perm'}</span>
                    <span className="text-slate-600 font-medium truncate">{user.department || (t ? '內部' : 'Internal')}</span>
                </div>
            </div>

            {/* Admin Actions */}
            {isAdmin && (
                <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-slate-100">
                    <button
                        onClick={() => onEdit?.(user.id)}
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition-colors"
                    >
                        {t ? '編輯' : 'Edit'}
                    </button>
                    <button
                        onClick={() => onToggleStatus?.(user.id)}
                        disabled={statusBusy}
                        className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${user.status === 'inactive'
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                : 'bg-red-50 hover:bg-red-100 text-red-600'
                            }`}
                    >
                        {statusBusy
                            ? (t ? '更新中...' : 'Updating...')
                            : user.status === 'inactive'
                                ? (t ? '啟用' : 'Enable')
                                : (t ? '停用' : 'Disable')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserCard;
