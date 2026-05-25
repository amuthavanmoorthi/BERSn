// Project Management Types

export interface Project {
    id: string;
    name: string;
    organization: string;
    location?: string;
    createdAt: string;
    updatedAt: string;
    status: 'draft' | 'in-progress' | 'completed';
    thumbnail?: string;
    category?: string;
    buildingType?: string;
    totalArea?: number;
    grade?: string;
    eei?: number;
}

export interface ProjectFormData {
    name: string;
    organization: string;
    location?: string;
    buildingType?: string;
    totalArea?: number;
}
