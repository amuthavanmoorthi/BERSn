// User Management Types

export type UserRole = 'SYS_ADMIN' | 'AGENCY_USER' | 'VENDOR_USER';

export interface User {
    id: string;
    username?: string;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
    organizationId?: string;
    organizationName?: string;
    department?: string;
    position?: string;
    status: 'active' | 'inactive' | 'pending';
    createdAt: string;
    lastLoginAt?: string;
    permissions?: string[];
}

export interface Organization {
    id: string;
    name: string;
    type: 'agency' | 'vendor';
    address?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
}

// Role descriptions
export const ROLE_INFO: Record<UserRole, {
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    color: string;
    bgColor: string;
}> = {
    SYS_ADMIN: {
        name: '系統管理者',
        nameEn: 'System Admin',
        description: '全域檢視/管理所有機關、廠商、工程、方案。負責帳號建立/修改/停用、機關與廠商關聯設定。',
        descriptionEn: 'Global view/manage all agencies, vendors, projects. Responsible for account creation/modification/deactivation.',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
    },
    AGENCY_USER: {
        name: '機關使用者',
        nameEn: 'Agency User',
        description: '僅可檢視/管理「同機關 ID」關聯之工程與方案。不可管理帳號。',
        descriptionEn: 'Can only view/manage projects associated with the same agency ID. Cannot manage accounts.',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
    },
    VENDOR_USER: {
        name: '設計廠商',
        nameEn: 'Vendor User',
        description: '僅可存取「自己建立」的工程與方案資料。不可跨工程、不可跨機關。',
        descriptionEn: 'Can only access projects/data they created. Cannot access cross-project or cross-agency data.',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
    },
};

// Sample users for demo
export const SAMPLE_USERS: User[] = [
    {
        id: 'user-001',
        name: '張建安',
        email: 'admin@bersn.gov.tw',
        role: 'SYS_ADMIN',
        organizationName: '內政部建築研究所',
        department: '系統管理組',
        position: '管理員',
        status: 'active',
        createdAt: '2025-01-01T00:00:00Z',
        lastLoginAt: '2026-01-21T08:30:00Z',
    },
    {
        id: 'user-002',
        name: '品管組長_吳琳',
        email: 'wulin@agency.gov.tw',
        role: 'AGENCY_USER',
        organizationName: '環境發展協會',
        department: '品管組',
        position: '組長',
        status: 'active',
        createdAt: '2025-03-15T00:00:00Z',
        lastLoginAt: '2026-01-20T14:20:00Z',
    },
    {
        id: 'user-003',
        name: '經理_劉俊益',
        email: 'liu@vendor.com.tw',
        role: 'AGENCY_USER',
        organizationName: '環境發展協會',
        department: '環保發展協會',
        position: '經理',
        status: 'active',
        createdAt: '2025-02-10T00:00:00Z',
    },
    {
        id: 'user-004',
        name: '經理_簡新盛',
        email: 'jian@vendor.com.tw',
        role: 'AGENCY_USER',
        organizationName: '環境發展協會',
        department: '內部',
        position: '經理',
        status: 'active',
        createdAt: '2025-04-20T00:00:00Z',
    },
    {
        id: 'user-005',
        name: '副主任_李坤賢',
        email: 'lee@agency.gov.tw',
        role: 'AGENCY_USER',
        organizationName: '環境發展協會',
        department: '內部',
        position: '副主任',
        status: 'active',
        createdAt: '2025-05-01T00:00:00Z',
    },
    {
        id: 'user-006',
        name: '副主任_陳梓芃',
        email: 'chen@agency.gov.tw',
        role: 'AGENCY_USER',
        organizationName: '環境發展協會',
        department: '內部',
        position: '副主任',
        status: 'active',
        createdAt: '2025-05-15T00:00:00Z',
    },
    {
        id: 'user-007',
        name: '工程師_郝仁心',
        email: 'hao@vendor.com.tw',
        role: 'VENDOR_USER',
        organizationName: '環境營造',
        department: '內部',
        position: '工程師',
        status: 'active',
        createdAt: '2025-06-01T00:00:00Z',
    },
    {
        id: 'user-008',
        name: '工程師_楊博達',
        email: 'yang@vendor.com.tw',
        role: 'VENDOR_USER',
        organizationName: '環境營造',
        department: '內部',
        position: '工程師',
        status: 'active',
        createdAt: '2025-06-15T00:00:00Z',
    },
    {
        id: 'user-009',
        name: '工程師_吳宏上',
        email: 'wu@vendor.com.tw',
        role: 'VENDOR_USER',
        organizationName: '環境營造',
        department: '內部',
        position: '工程師',
        status: 'active',
        createdAt: '2025-07-01T00:00:00Z',
    },
    {
        id: 'user-010',
        name: '工程師_陳家偉',
        email: 'chen2@vendor.com.tw',
        role: 'VENDOR_USER',
        organizationName: '環境營造',
        department: '內部',
        position: '工程師',
        status: 'active',
        createdAt: '2025-07-15T00:00:00Z',
    },
    {
        id: 'user-011',
        name: '工程師_莊明豐',
        email: 'zhuang@vendor.com.tw',
        role: 'VENDOR_USER',
        organizationName: '環境營造',
        department: '內部',
        position: '工程師',
        status: 'inactive',
        createdAt: '2025-08-01T00:00:00Z',
    },
    {
        id: 'user-012',
        name: '工程師_蔡信安',
        email: 'cai@vendor.com.tw',
        role: 'VENDOR_USER',
        organizationName: '環境營造',
        department: '內部',
        position: '工程師',
        status: 'active',
        createdAt: '2025-08-15T00:00:00Z',
    },
    {
        id: 'user-013',
        name: '安衛組長_鄭凱',
        email: 'zheng@agency.gov.tw',
        role: 'AGENCY_USER',
        organizationName: '環境發展協會',
        department: '內部',
        position: '組長',
        status: 'active',
        createdAt: '2025-09-01T00:00:00Z',
    },
    {
        id: 'user-014',
        name: '安衛工程師_陳',
        email: 'chen3@agency.gov.tw',
        role: 'VENDOR_USER',
        organizationName: '環境營造',
        department: '管理員',
        position: '工程師',
        status: 'active',
        createdAt: '2025-09-15T00:00:00Z',
    },
];
