import React, { useEffect, useState } from 'react';
import { BuildingTypeOption, OrganizationOption, ProjectFormData } from '../types/project';

interface CreateProjectModalProps {
    buildingTypes: BuildingTypeOption[];
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: ProjectFormData) => Promise<void>;
    organizations: OrganizationOption[];
    lang: 'zh' | 'en';
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
    buildingTypes,
    isOpen,
    onClose,
    onCreate,
    organizations,
    lang,
}) => {
    const t = lang === 'zh';
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<ProjectFormData>({
        name: '',
        organizationId: '',
        location: '',
        buildingTypeCode: '',
        totalArea: 0,
    });

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setError('');
        setFormData((current) => ({
            ...current,
            organizationId: current.organizationId || organizations[0]?.id || '',
            buildingTypeCode: current.buildingTypeCode || buildingTypes[0]?.code || '',
        }));
    }, [buildingTypes, isOpen, organizations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.organizationId) {
            setError(t ? '請先選擇已驗證的機關。' : 'Please select a verified organization.');
            return;
        }

        if (!formData.buildingTypeCode) {
            setError(t ? '請選擇建築類型。' : 'Please select a building type.');
            return;
        }

        if (formData.totalArea <= 0) {
            setError(t ? '總樓地板面積必須大於 0。' : 'Total floor area must be greater than zero.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onCreate(formData);
            setFormData({
                name: '',
                organizationId: organizations[0]?.id || '',
                location: '',
                buildingTypeCode: buildingTypes[0]?.code || '',
                totalArea: 0,
            });
            onClose();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : (t ? '建立專案失敗。' : 'Failed to create project.'));
        } finally {
            setIsSubmitting(false);
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
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <h2 className="text-2xl font-black">
                        {t ? '建立新專案' : 'Create New Project'}
                    </h2>
                    <p className="text-blue-200 text-sm mt-1">
                        {t ? '從資料庫載入機關與建築類型，建立可稽核專案' : 'Use verified organizations and database building types to create an auditable project'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Project Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '專案名稱' : 'Project Name'} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder={t ? '輸入專案名稱' : 'Enter project name'}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                        />
                    </div>

                    {/* Organization */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '機關名稱' : 'Organization'} <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.organizationId}
                            onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                        >
                            <option value="">{t ? '選擇已驗證機關' : 'Select verified organization'}</option>
                            {organizations.map((organization) => (
                                <option key={organization.id} value={organization.id}>
                                    {organization.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '專案地點' : 'Location'}
                        </label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            placeholder={t ? '輸入專案地址或地點' : 'Enter project location'}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Building Type */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '建築類型' : 'Building Type'} <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.buildingTypeCode}
                            onChange={(e) => setFormData({ ...formData, buildingTypeCode: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                        >
                            <option value="">{t ? '選擇建築類型' : 'Select building type'}</option>
                            {buildingTypes.map((buildingType) => (
                                <option key={buildingType.code} value={buildingType.code}>
                                    {(t ? buildingType.labelZh : buildingType.labelEn).replace(/^[A-Z]-[\d/A-Z-]+\s+/, '')}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500">
                            {t
                                ? '建築類型由後端 BERS 2024 分類資料提供。'
                                : 'Building types are provided by the backend BERS 2024 category catalog.'}
                        </p>
                    </div>

                    {/* Total Area */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '總樓地板面積 (m²)' : 'Total Floor Area (m²)'} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={formData.totalArea || ''}
                            onChange={(e) => setFormData({ ...formData, totalArea: parseFloat(e.target.value) || 0 })}
                            placeholder={t ? '輸入面積' : 'Enter area'}
                            min="0.01"
                            step="0.01"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold">
                            {error}
                        </div>
                    )}

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
                            disabled={isSubmitting || buildingTypes.length === 0 || organizations.length === 0}
                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold rounded-xl shadow-lg transition-all"
                        >
                            {isSubmitting ? (t ? '建立中...' : 'Creating...') : (t ? '建立專案' : 'Create Project')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProjectModal;
