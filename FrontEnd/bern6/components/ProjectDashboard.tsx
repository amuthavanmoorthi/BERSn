import React, { useState, useEffect } from 'react';
import { Project, ProjectFormData } from '../types/project';
import ProjectCard from './ProjectCard';
import CreateProjectModal from './CreateProjectModal';
import { listProjects, createProject } from '../services/apiClient';

interface ProjectDashboardProps {
    lang: 'zh' | 'en';
    onEnterProject: (projectId: string) => void;
    onLanguageChange: () => void;
    onNavigateToAccounts?: () => void;
    onNavigateToOverview?: () => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
    lang,
    onEnterProject,
    onLanguageChange,
    onNavigateToAccounts,
    onNavigateToOverview,
}) => {
    const t = lang === 'zh';
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Load projects from backend on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await listProjects();
                if (!cancelled) {
                    setProjects(list);
                    setLoadError(null);
                }
            } catch (e: any) {
                if (!cancelled) setLoadError(e?.message || 'Failed to load projects');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleCreateProject = async (formData: ProjectFormData) => {
        try {
            const created = await createProject(formData);
            setProjects(prev => [created, ...prev]);
        } catch (e: any) {
            alert((t ? '建立專案失敗：' : 'Failed to create project: ') + (e?.message || e));
        }
    };

    const filteredProjects = projects.filter(project => {
        const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.organization.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || project.status === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="h-screen flex overflow-hidden" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
            {/* Sidebar */}
            <aside className="w-64 flex flex-col flex-shrink-0" style={{ background: 'var(--color-card)', borderRight: '1px solid var(--color-border)' }}>
                {/* Logo */}
                <div className="p-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg cursor-pointer"
                            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-fg)' }}
                            onClick={onLanguageChange}
                        >
                            {lang === 'zh' ? '中' : 'EN'}
                        </div>
                        <div>
                            <h1 className="font-black" style={{ color: 'var(--color-text)' }}>BERSn-Pro</h1>
                            <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{t ? '建築能效平台' : 'Building Energy Platform'}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm" style={{ background: 'var(--color-step-active-bg)', color: 'var(--color-step-active-text)' }}>
                        <span>📋</span>
                        {t ? '專案入口網' : 'Project Portal'}
                    </a>
                    <button
                        onClick={onNavigateToOverview}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors text-left hover:opacity-80"
                        style={{ color: 'var(--color-muted)' }}
                    >
                        <span>📊</span>
                        {t ? '儀表板總覽' : 'Dashboard'}
                    </button>
                    <button
                        onClick={onNavigateToAccounts}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors text-left hover:opacity-80"
                        style={{ color: 'var(--color-muted)' }}
                    >
                        <span>👥</span>
                        {t ? '帳號管理' : 'Account Management'}
                    </button>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors hover:opacity-80" style={{ color: 'var(--color-muted)' }}>
                        <span>⚙️</span>
                        {t ? '系統設定' : 'Settings'}
                    </a>
                </nav>

                {/* User Info */}
                <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--color-bg)' }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: 'var(--color-accent)', color: 'var(--color-accent-fg)' }}>
                            U
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>{t ? '使用者' : 'User'}</p>
                            <p className="text-[10px] truncate" style={{ color: 'var(--color-muted)' }}>{t ? '管理員' : 'Admin'}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="p-4 flex justify-between items-center flex-shrink-0" style={{ background: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                        <h2 className="text-2xl font-black" style={{ color: 'var(--color-text)' }}>
                            {t ? '桃園市建築物能源設計平台' : 'Taoyuan Building Energy Design Platform'}
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                            {loading
                                ? (t ? '載入中…' : 'Loading…')
                                : loadError
                                    ? (t ? `無法連線後端：${loadError}` : `Backend offline: ${loadError}`)
                                    : (t ? `共 ${projects.length} 個專案` : `${projects.length} projects total`)}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={t ? '搜尋專案...' : 'Search projects...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-64 pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2"
                                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }}>🔍</span>
                        </div>
                        {/* Filter */}
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2"
                            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                        >
                            <option value="all">{t ? '全部狀態' : 'All Status'}</option>
                            <option value="draft">{t ? '草稿' : 'Draft'}</option>
                            <option value="in-progress">{t ? '進行中' : 'In Progress'}</option>
                            <option value="completed">{t ? '已完成' : 'Completed'}</option>
                        </select>
                        {/* Create Button */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-5 py-2.5 font-bold text-sm rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
                            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-fg)' }}
                        >
                            <span className="text-lg">+</span>
                            {t ? '新增專案' : 'New Project'}
                        </button>
                    </div>
                </header>

                {/* Project Grid */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {/* Create New Card */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="h-[320px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 hover:opacity-80 transition-all duration-300 group"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
                        >
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-colors" style={{ background: 'var(--color-bg)' }}>
                                +
                            </div>
                            <span className="font-bold">{t ? '建立新專案' : 'Create New Project'}</span>
                        </button>

                        {/* Project Cards */}
                        {filteredProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onEnter={onEnterProject}
                                lang={lang}
                            />
                        ))}
                    </div>
                </div>
            </main>

            {/* Create Modal */}
            <CreateProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateProject}
                lang={lang}
            />
        </div>
    );
};

export default ProjectDashboard;
