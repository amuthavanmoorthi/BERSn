import React from 'react';
import { Project } from '../types/project';

interface ProjectCardProps {
    project: Project;
    onEnter: (projectId: string) => void;
    lang: 'zh' | 'en';
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEnter, lang }) => {
    const t = lang === 'zh';

    const getStatusBadge = (status: Project['status']) => {
        const styles = {
            'draft': 'bg-slate-100 text-slate-600',
            'in-progress': 'bg-blue-100 text-blue-600',
            'completed': 'bg-emerald-100 text-emerald-600',
        };
        const labels = {
            'draft': t ? '草稿' : 'Draft',
            'in-progress': t ? '進行中' : 'In Progress',
            'completed': t ? '已完成' : 'Completed',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            {/* Thumbnail */}
            <div className="h-40 bg-gradient-to-br from-slate-200 to-slate-300 relative overflow-hidden">
                {project.thumbnail ? (
                    <img
                        src={project.thumbnail}
                        alt={project.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-6xl opacity-20">🏢</div>
                    </div>
                )}
                {/* Grade Badge */}
                {project.grade && (
                    <div className="absolute top-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-lg" style={{ background: 'var(--color-accent)', color: 'var(--color-accent-fg)' }}>
                        {project.grade}
                    </div>
                )}
                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                    {getStatusBadge(project.status)}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Title & Category */}
                <div>
                    <h3 className="font-black text-[color:var(--color-text)] text-lg leading-tight truncate">
                        {project.name}
                    </h3>
                    {project.category && (
                        <span className="text-[10px] font-bold text-[color:var(--color-muted)] uppercase tracking-wider">
                            {project.category}
                        </span>
                    )}
                </div>

                {/* Metadata */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                        <span className="w-4 h-4 flex items-center justify-center">🏛️</span>
                        <span className="font-medium truncate">{project.organization}</span>
                    </div>
                    {project.location && (
                        <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                            <span className="w-4 h-4 flex items-center justify-center">📍</span>
                            <span className="truncate">{project.location}</span>
                        </div>
                    )}
                    {project.totalArea && (
                        <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                            <span className="w-4 h-4 flex items-center justify-center">📐</span>
                            <span>{project.totalArea.toLocaleString()} m²</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                        <span className="w-4 h-4 flex items-center justify-center">📅</span>
                        <span>{formatDate(project.updatedAt)}</span>
                    </div>
                </div>

                {/* EEI Indicator */}
                {project.eei !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-[color:var(--color-bg)] rounded-lg">
                        <span className="text-[10px] font-bold text-[color:var(--color-muted)] uppercase">EEI</span>
                        <span className={`font-black ${project.eei <= 0.8 ? 'text-emerald-600' : project.eei <= 1.0 ? 'text-amber-600' : 'text-red-600'}`}>
                            {project.eei.toFixed(3)}
                        </span>
                    </div>
                )}

                {/* Enter Button */}
                <button
                    onClick={() => onEnter(project.id)}
                    className="w-full py-2.5 font-bold text-sm rounded-xl hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-accent-fg)' }}
                >
                    {t ? '進入 BERSn-Pro 系統' : 'Enter BERSn-Pro'}
                </button>
            </div>
        </div>
    );
};

export default ProjectCard;
