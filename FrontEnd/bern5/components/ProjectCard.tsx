import React from 'react';
import { Project } from '../types/project';

interface ProjectCardProps {
    project: Project;
    onEnter: (projectId: string) => void;
    lang: 'zh' | 'en';
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onEnter, lang }) => {
    const t = lang === 'zh';
    const eeiValue = project.eei ?? 0;

    const getStatusBadge = (status: Project['status']) => {
        const styles = {
            DRAFT: 'bg-slate-100 text-slate-600',
            IN_REVIEW: 'bg-blue-100 text-blue-600',
            APPROVED: 'bg-emerald-100 text-emerald-600',
            ARCHIVED: 'bg-amber-100 text-amber-600',
        };
        const labels = {
            DRAFT: t ? '草稿' : 'Draft',
            IN_REVIEW: t ? '審查中' : 'In Review',
            APPROVED: t ? '已核准' : 'Approved',
            ARCHIVED: t ? '已封存' : 'Archived',
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group">
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
                    <div className="absolute top-3 right-3 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg">
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
                    <h3 className="font-black text-slate-800 text-lg leading-tight truncate">
                        {project.name}
                    </h3>
                    {project.category && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {project.category}
                        </span>
                    )}
                </div>

                {/* Metadata */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-4 h-4 flex items-center justify-center">🏛️</span>
                        <span className="font-medium truncate">{project.organization}</span>
                    </div>
                    {project.location && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="w-4 h-4 flex items-center justify-center">📍</span>
                            <span className="truncate">{project.location}</span>
                        </div>
                    )}
                    {project.totalArea && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="w-4 h-4 flex items-center justify-center">📐</span>
                            <span>{project.totalArea.toLocaleString()} m²</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="w-4 h-4 flex items-center justify-center">📅</span>
                        <span>{formatDate(project.updatedAt)}</span>
                    </div>
                </div>

                {/* EEI Indicator */}
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{t ? '能效指標 EEI' : 'Energy Index EEI'}</span>
                    <span className={`font-black ${eeiValue <= 0.8 ? 'text-emerald-600' : eeiValue <= 1.0 ? 'text-amber-600' : 'text-red-600'}`}>
                        {eeiValue.toFixed(3)}
                    </span>
                </div>

                {/* Enter Button */}
                <button
                    onClick={() => onEnter(project.id)}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
                >
                    {t ? '進入 BERSn-Pro 系統' : 'Enter BERSn-Pro'}
                </button>
            </div>
        </div>
    );
};

export default ProjectCard;
