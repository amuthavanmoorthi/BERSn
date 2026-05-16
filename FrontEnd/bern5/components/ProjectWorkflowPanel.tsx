import React, { useEffect, useMemo, useState } from 'react';

import {
    Project,
    ProjectStatus,
    ProjectWorkflowEvent,
} from '../types/project';
import {
    getProjectWorkflowHistory,
    submitProject,
    updateProjectStatus,
} from '../services/projectApi';
import { useSession } from '../context/SessionContext';
import {
    PERMISSIONS,
    WORKFLOW_STATES,
    allowedTransitionsFor,
    describeWorkflowState,
    isWorkflowState,
    normalizeRole,
} from '../services/rbacPolicy';

interface ProjectWorkflowPanelProps {
    project: Project;
    lang: 'zh' | 'en';
    onProjectChanged?: (project: Project) => void;
}

interface ActionDescriptor {
    target: ProjectStatus;
    labelEn: string;
    labelZh: string;
    permission: string;
    tone: 'primary' | 'success' | 'warn' | 'danger' | 'neutral';
    requiresReason: boolean;
}

const ACTION_BY_TARGET: Partial<Record<ProjectStatus, ActionDescriptor>> = {
    SUBMITTED: {
        target: 'SUBMITTED',
        labelEn: 'Submit for Review',
        labelZh: '提交審查',
        permission: PERMISSIONS.PROJECT_SUBMIT,
        tone: 'primary',
        requiresReason: false,
    },
    UNDER_REVIEW: {
        target: 'UNDER_REVIEW',
        labelEn: 'Start Review',
        labelZh: '開始審查',
        permission: PERMISSIONS.WORKFLOW_REVIEW,
        tone: 'primary',
        requiresReason: false,
    },
    APPROVED: {
        target: 'APPROVED',
        labelEn: 'Approve',
        labelZh: '核准',
        permission: PERMISSIONS.WORKFLOW_APPROVE,
        tone: 'success',
        requiresReason: false,
    },
    REJECTED: {
        target: 'REJECTED',
        labelEn: 'Reject',
        labelZh: '駁回',
        permission: PERMISSIONS.WORKFLOW_REJECT,
        tone: 'danger',
        requiresReason: true,
    },
    REVISION_REQUESTED: {
        target: 'REVISION_REQUESTED',
        labelEn: 'Request Revision',
        labelZh: '要求修訂',
        permission: PERMISSIONS.WORKFLOW_REQUEST_REVISION,
        tone: 'warn',
        requiresReason: true,
    },
    COMPLETED: {
        target: 'COMPLETED',
        labelEn: 'Mark Completed',
        labelZh: '標示完成',
        permission: PERMISSIONS.WORKFLOW_COMPLETE,
        tone: 'success',
        requiresReason: false,
    },
    DRAFT: {
        target: 'DRAFT',
        labelEn: 'Reopen to Draft',
        labelZh: '重新開啟為草稿',
        permission: PERMISSIONS.PROJECT_REOPEN,
        tone: 'neutral',
        requiresReason: false,
    },
    ARCHIVED: {
        target: 'ARCHIVED',
        labelEn: 'Archive',
        labelZh: '封存',
        permission: PERMISSIONS.PROJECT_DELETE,
        tone: 'neutral',
        requiresReason: false,
    },
};

const TONE_CLASSES: Record<ActionDescriptor['tone'], string> = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    warn: 'bg-amber-500 hover:bg-amber-600 text-white',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    neutral: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
};

const formatTimestamp = (iso: string, lang: 'zh' | 'en') => {
    const date = new Date(iso);
    return date.toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const ProjectWorkflowPanel: React.FC<ProjectWorkflowPanelProps> = ({ project, lang, onProjectChanged }) => {
    const t = lang === 'zh';
    const session = useSession();
    const [history, setHistory] = useState<ProjectWorkflowEvent[]>([]);
    const [historyError, setHistoryError] = useState('');
    const [actionTarget, setActionTarget] = useState<ProjectStatus | null>(null);
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [actionError, setActionError] = useState('');
    const [actionMessage, setActionMessage] = useState('');

    const status = (isWorkflowState(project.status) ? project.status : WORKFLOW_STATES.DRAFT) as ProjectStatus;

    useEffect(() => {
        let cancelled = false;
        setHistoryError('');
        getProjectWorkflowHistory(project.id)
            .then((rows) => {
                if (!cancelled) {
                    setHistory(rows);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setHistoryError(error instanceof Error ? error.message : (t ? '無法載入流程紀錄。' : 'Failed to load workflow history.'));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [project.id, project.status, t]);

    const role = useMemo(() => normalizeRole(session.role), [session.role]);
    // A user "owns" a project when they created it (vendor/agency
    // self-authored) OR were assigned to it as the reviewer (agency
    // review queue). Mirrors backend Backend/src/services/projectService
    // .ts isProjectOwner().
    const isOwner = useMemo(() => {
        if (!session.user) return false;
        if (project.createdBy && project.createdBy === session.user.id) return true;
        return project.assignedTo === session.user.id;
    }, [project.createdBy, project.assignedTo, session.user]);

    const availableActions = useMemo<ActionDescriptor[]>(() => {
        const allowed = allowedTransitionsFor(role, status);
        return allowed
            .map((target) => ACTION_BY_TARGET[target])
            .filter((action): action is ActionDescriptor => Boolean(action))
            .filter((action) => {
                if (!session.hasPermission(action.permission as never)) return false;
                // Vendors only act on their own projects.
                if (role === 'VENDOR_USER' && !isOwner) return false;
                // Submitting a draft is a creator action; agencies that
                // *review* may not submit projects they didn't author.
                // Admins keep their override capability.
                if (action.target === 'SUBMITTED' && role === 'AGENCY_USER' && !isOwner) {
                    return false;
                }
                return true;
            });
    }, [role, status, session, isOwner]);

    const handleConfirm = async () => {
        if (!actionTarget) return;
        const action = ACTION_BY_TARGET[actionTarget];
        if (!action) return;
        if (action.requiresReason && !reason.trim()) {
            setActionError(t ? '請填寫原因。' : 'Please provide a reason.');
            return;
        }
        setIsSaving(true);
        setActionError('');
        try {
            let updated: Project;
            if (actionTarget === 'SUBMITTED' && status !== 'UNDER_REVIEW') {
                // Vendor flow: DRAFT/REVISION_REQUESTED → SUBMITTED via /submit.
                updated = await submitProject(project.id, reason.trim() || undefined);
            } else {
                updated = await updateProjectStatus(project.id, actionTarget, reason.trim() || undefined);
            }
            setActionTarget(null);
            setReason('');
            setActionMessage(t ? '狀態已更新並寫入稽核紀錄。' : 'Status updated and audit log recorded.');
            onProjectChanged?.(updated);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : (t ? '操作失敗。' : 'Action failed.'));
        } finally {
            setIsSaving(false);
        }
    };

    const descriptor = describeWorkflowState(status);

    return (
        <section className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4">
            <header className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    {t ? '工作流程' : 'Workflow'}
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${descriptor.badgeClass}`}>
                    {descriptor.icon} {t ? descriptor.zh : descriptor.en}
                </span>
            </header>

            {/* Available actions */}
            <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400">
                    {t ? '可用操作' : 'Available actions'}
                </p>
                {availableActions.length === 0 ? (
                    <p className="text-xs text-slate-400">
                        {t ? '在目前的狀態與您的權限下，沒有可執行的工作流程操作。' : 'No workflow actions available for your role at this status.'}
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {availableActions.map((action) => (
                            <button
                                key={action.target}
                                type="button"
                                disabled={isSaving}
                                onClick={() => {
                                    setActionTarget(action.target);
                                    setReason('');
                                    setActionError('');
                                    setActionMessage('');
                                }}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${TONE_CLASSES[action.tone]}`}
                            >
                                {t ? action.labelZh : action.labelEn}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {actionMessage && (
                <p className="text-xs font-bold text-emerald-600">{actionMessage}</p>
            )}

            {/* Confirmation form */}
            {actionTarget && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-slate-700">
                        {t ? '確認操作' : 'Confirm action'}：{' '}
                        <span className="text-slate-500">{ACTION_BY_TARGET[actionTarget]?.[t ? 'labelZh' : 'labelEn']}</span>
                    </p>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder={ACTION_BY_TARGET[actionTarget]?.requiresReason
                            ? (t ? '請填寫理由 (必填)' : 'Reason (required)')
                            : (t ? '備註 (選填)' : 'Notes (optional)')}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {actionError && (
                        <p className="text-xs font-bold text-rose-600">{actionError}</p>
                    )}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setActionTarget(null);
                                setReason('');
                                setActionError('');
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700"
                        >
                            {t ? '取消' : 'Cancel'}
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isSaving}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                        >
                            {isSaving ? (t ? '處理中...' : 'Working...') : (t ? '確認' : 'Confirm')}
                        </button>
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div>
                <p className="text-[10px] uppercase tracking-wide font-bold text-slate-400 mb-2">
                    {t ? '流程時間軸' : 'Workflow timeline'}
                </p>
                {historyError && (
                    <p className="text-xs font-bold text-rose-600">{historyError}</p>
                )}
                {!historyError && history.length === 0 && (
                    <p className="text-xs text-slate-400">{t ? '尚無工作流程紀錄。' : 'No workflow events yet.'}</p>
                )}
                <ol className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {history.map((event) => {
                        const toDesc = describeWorkflowState(event.toStatus);
                        const fromDesc = event.fromStatus ? describeWorkflowState(event.fromStatus) : null;
                        return (
                            <li key={event.id} className="border-l-2 border-slate-200 pl-3 py-1">
                                <div className="text-xs font-bold text-slate-700">
                                    {fromDesc ? (
                                        <span>{t ? fromDesc.zh : fromDesc.en} → {t ? toDesc.zh : toDesc.en}</span>
                                    ) : (
                                        <span>{t ? '建立' : 'Created as'} {t ? toDesc.zh : toDesc.en}</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {event.actorUsername || event.actorUserId} · {event.actorRole} · {formatTimestamp(event.at, lang)}
                                </div>
                                {event.reason && (
                                    <div className="text-[11px] text-slate-600 mt-1 italic">“{event.reason}”</div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
};

export default ProjectWorkflowPanel;
