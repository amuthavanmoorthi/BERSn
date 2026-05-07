import React, { useEffect, useMemo, useState } from 'react';
import {
    BuildingTypeOption,
    OrganizationOption,
    Project,
    ProjectFormData,
    ProjectStatus,
} from '../types/project';
import ProjectCard from './ProjectCard';
import CreateProjectModal from './CreateProjectModal';
import {
    createProject,
    getBuildingTypes,
    getOrganizations,
    getProjects,
} from '../services/projectApi';

interface ProjectDashboardProps {
    lang: 'zh' | 'en';
    onEnterProject: (projectId: string) => void;
    onLanguageChange: () => void;
    onNavigateToAccounts?: () => void;
    onNavigateToOverview?: () => void;
    onLogout?: () => void;
}

const STATUS_FILTERS: Array<ProjectStatus | 'all'> = ['all', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED'];

const DEMO_PROJECTS: Project[] = [
    {
        id: 'demo-a1-green-hq',
        name: 'A1 綠能總部',
        organization: '桃園市政府工務局',
        organizationId: null,
        location: '桃園區',
        createdAt: '2026-01-20T00:00:00.000Z',
        updatedAt: '2026-01-20T00:00:00.000Z',
        status: 'IN_REVIEW',
        category: '辦公室',
        buildingType: 'Office',
        buildingTypeCode: 'OFFICE',
        buildingTypeEuiBaseline: 220,
        totalArea: 5000,
        grade: 'A',
        eei: 0.72,
    },
    {
        id: 'demo-a2-pmis-v2',
        name: 'A2 PMIS V2',
        organization: '桃園市政府都市發展局',
        organizationId: null,
        location: '中壢區',
        createdAt: '2026-01-18T00:00:00.000Z',
        updatedAt: '2026-01-18T00:00:00.000Z',
        status: 'DRAFT',
        category: '混合使用',
        buildingType: 'Mixed Use',
        buildingTypeCode: 'MIXED_USE',
        buildingTypeEuiBaseline: 240,
        totalArea: 8200,
        grade: 'B',
        eei: 0.86,
    },
    {
        id: 'demo-retrofit-design',
        name: '復設計專案',
        organization: '桃園市政府住宅發展處',
        organizationId: null,
        location: '龜山區',
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
        status: 'APPROVED',
        category: '住宅',
        buildingType: 'Residential',
        buildingTypeCode: 'RESIDENTIAL',
        buildingTypeEuiBaseline: 120,
        totalArea: 3600,
        grade: 'A',
        eei: 0.64,
    },
];

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
    lang,
    onEnterProject,
    onLanguageChange,
    onNavigateToAccounts,
    onNavigateToOverview,
    onLogout,
}) => {
    const t = lang === 'zh';
    const [projects, setProjects] = useState<Project[]>([]);
    const [buildingTypes, setBuildingTypes] = useState<BuildingTypeOption[]>([]);
    const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
    const [pageError, setPageError] = useState('');
    const [pageMessage, setPageMessage] = useState('');

    useEffect(() => {
        let cancelled = false;

        const loadProjectData = async () => {
            setIsLoading(true);
            setPageError('');
            try {
                const [projectRows, buildingTypeRows, organizationRows] = await Promise.all([
                    getProjects(),
                    getBuildingTypes(),
                    getOrganizations(),
                ]);
                if (!cancelled) {
                    setProjects(projectRows);
                    setBuildingTypes(buildingTypeRows);
                    setOrganizations(organizationRows);
                }
            } catch (error) {
                if (!cancelled) {
                    setPageError(error instanceof Error ? error.message : (t ? '載入專案資料失敗。' : 'Failed to load project data.'));
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadProjectData();

        return () => {
            cancelled = true;
        };
    }, [t]);

    const handleCreateProject = async (formData: ProjectFormData) => {
        setPageError('');
        setPageMessage('');
        const project = await createProject(formData);
        setProjects((currentProjects) => [project, ...currentProjects]);
        setPageMessage(t ? '專案已建立並寫入稽核紀錄。' : 'Project created and audit log recorded.');
    };

    const dashboardProjects = useMemo(() => {
        const backendProjectIds = new Set(projects.map((project) => project.id));
        return [
            ...projects,
            ...DEMO_PROJECTS.filter((project) => !backendProjectIds.has(project.id)),
        ];
    }, [projects]);

    const filteredProjects = useMemo(() => dashboardProjects.filter(project => {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        const matchesSearch = normalizedSearchTerm.length === 0
            || project.name.toLowerCase().includes(normalizedSearchTerm)
            || project.organization.toLowerCase().includes(normalizedSearchTerm)
            || (project.buildingType || '').toLowerCase().includes(normalizedSearchTerm);
        const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
        return matchesSearch && matchesStatus;
    }), [dashboardProjects, searchTerm, statusFilter]);

    const statusLabel = (status: ProjectStatus | 'all') => {
        const labels: Record<ProjectStatus | 'all', string> = {
            all: t ? '全部狀態' : 'All Status',
            DRAFT: t ? '草稿' : 'Draft',
            IN_REVIEW: t ? '審查中' : 'In Review',
            APPROVED: t ? '已核准' : 'Approved',
            ARCHIVED: t ? '已封存' : 'Archived',
        };
        return labels[status];
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
                    <a href="#" className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm">
                        <span>📋</span>
                        {t ? '專案入口網' : 'Project Portal'}
                    </a>
                    <button
                        onClick={onNavigateToOverview}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left"
                    >
                        <span>📊</span>
                        {t ? '儀表板總覽' : 'Dashboard'}
                    </button>
                    <button
                        onClick={onNavigateToAccounts}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left"
                    >
                        <span>👥</span>
                        {t ? '帳號管理' : 'Account Management'}
                    </button>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors">
                        <span>⚙️</span>
                        {t ? '系統設定' : 'Settings'}
                    </a>
                </nav>

                {/* User Info */}
                <div className="p-4 border-t border-slate-100">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                                U
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-slate-800 truncate">{t ? '使用者' : 'User'}</p>
                                <p className="text-[10px] text-slate-400 truncate">{t ? '已驗證帳號' : 'Verified Account'}</p>
                            </div>
                        </div>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors"
                            >
                                {t ? '登出' : 'Sign Out'}
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">
                            {t ? '桃園市建築物能源設計平台' : 'Taoyuan Building Energy Design Platform'}
                        </h2>
                        <p className="text-sm text-slate-400">
                            {isLoading
                                ? (t ? '正在載入專案...' : 'Loading projects...')
                                : (t ? `共 ${dashboardProjects.length} 個專案` : `${dashboardProjects.length} projects total`)}
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
                                className="w-64 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        </div>
                        {/* Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {STATUS_FILTERS.map((status) => (
                                <option key={status} value={status}>{statusLabel(status)}</option>
                            ))}
                        </select>
                        {/* Create Button */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2"
                        >
                            <span className="text-lg">+</span>
                            {t ? '新增專案' : 'New Project'}
                        </button>
                    </div>
                </header>

                {/* Project Grid */}
                <div className="flex-1 overflow-auto p-6">
                    {pageError && (
                        <div className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 font-bold text-sm">
                            {pageError}
                        </div>
                    )}
                    {pageMessage && (
                        <div className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-sm">
                            {pageMessage}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {/* Create New Card */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="h-[320px] border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all duration-300 group"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-3xl transition-colors">
                                +
                            </div>
                            <span className="font-bold">{t ? '建立新專案' : 'Create New Project'}</span>
                            <span className="text-[10px] font-bold text-slate-400 px-6 text-center">
                                {t ? '建築類型與 EUI 基準值由資料庫提供' : 'Building type and EUI baseline come from the database'}
                            </span>
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

                    {!isLoading && filteredProjects.length === 0 && (
                        <div className="mt-8 text-center text-slate-400 font-bold">
                            {t ? '目前沒有符合條件的專案。' : 'No projects match the current filters.'}
                        </div>
                    )}
                </div>
            </main>

            {/* Create Modal */}
            <CreateProjectModal
                buildingTypes={buildingTypes}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateProject}
                organizations={organizations}
                lang={lang}
            />
        </div>
    );
};

export default ProjectDashboard;
