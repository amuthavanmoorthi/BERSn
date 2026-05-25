import React, { useState } from 'react';
import { ProjectFormData } from '../types/project';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: ProjectFormData) => void;
    lang: 'zh' | 'en';
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
    isOpen,
    onClose,
    onCreate,
    lang,
}) => {
    const t = lang === 'zh';
    const [formData, setFormData] = useState<ProjectFormData>({
        name: '',
        organization: '',
        location: '',
        buildingType: '',
        totalArea: 0,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name && formData.organization) {
            onCreate(formData);
            setFormData({ name: '', organization: '', location: '', buildingType: '', totalArea: 0 });
            onClose();
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
                        {t ? '填寫專案基本資訊以開始能效分析' : 'Fill in project details to start energy analysis'}
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
                        <input
                            type="text"
                            value={formData.organization}
                            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                            placeholder={t ? '輸入機關或業主名稱' : 'Enter organization name'}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            required
                        />
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
                            {t ? '建築類型' : 'Building Type'}
                        </label>
                        <select
                            value={formData.buildingType}
                            onChange={(e) => setFormData({ ...formData, buildingType: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                            <option value="">{t ? '選擇建築類型' : 'Select building type'}</option>
                            <option value="office">{t ? '辦公建築' : 'Office'}</option>
                            <option value="retail">{t ? '零售商場' : 'Retail'}</option>
                            <option value="hotel">{t ? '旅館' : 'Hotel'}</option>
                            <option value="hospital">{t ? '醫院' : 'Hospital'}</option>
                            <option value="residential">{t ? '住宅' : 'Residential'}</option>
                            <option value="mixed">{t ? '混合使用' : 'Mixed Use'}</option>
                        </select>
                    </div>

                    {/* Total Area */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            {t ? '總樓地板面積 (m²)' : 'Total Floor Area (m²)'}
                        </label>
                        <input
                            type="number"
                            value={formData.totalArea || ''}
                            onChange={(e) => setFormData({ ...formData, totalArea: parseFloat(e.target.value) || 0 })}
                            placeholder={t ? '輸入面積' : 'Enter area'}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

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
                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all"
                        >
                            {t ? '建立專案' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProjectModal;
