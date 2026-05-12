import React from 'react';

/**
 * Lightweight inline SVG icons (heroicons-style, single-file).
 *
 * Sized via the `className` prop (default w-4 h-4). Pass `stroke` colour
 * via Tailwind text colour utilities — every icon uses `currentColor`.
 */

interface IconProps {
    className?: string;
    title?: string;
}

function withDefaults(className?: string): string {
    return className ?? 'w-4 h-4';
}

export const CheckCircleIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

export const BanIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
);

export const BuildingIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <rect x="4" y="3" width="16" height="18" rx="1.5" />
        <line x1="9" y1="7" x2="9" y2="7" />
        <line x1="15" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="9" y2="11" />
        <line x1="15" y1="11" x2="15" y2="11" />
        <line x1="9" y1="15" x2="9" y2="15" />
        <line x1="15" y1="15" x2="15" y2="15" />
        <path d="M10 21v-3a2 2 0 0 1 4 0v3" />
    </svg>
);

export const OfficeIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <path d="M3 21h18" />
        <path d="M5 21V8l7-4 7 4v13" />
        <path d="M9 21v-6h6v6" />
        <path d="M9 11h.01M15 11h.01M9 7h.01M15 7h.01" />
    </svg>
);

export const MapPinIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

export const RulerIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <path d="M21 3 3 21" />
        <path d="m7.5 7.5 1.5 1.5" />
        <path d="m10.5 10.5 1.5 1.5" />
        <path d="m13.5 13.5 1.5 1.5" />
        <path d="m16.5 16.5 1.5 1.5" />
    </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.04a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.04a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={withDefaults(className)}
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
    >
        {title ? <title>{title}</title> : null}
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
);
