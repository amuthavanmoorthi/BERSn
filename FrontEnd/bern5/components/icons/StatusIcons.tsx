import React from 'react';

/**
 * Small SVG status icons used by the optimize / workflow surfaces.
 * They replace the older emoji set (✅, ⛔, ⚠️) so screen-readers,
 * print exports, and high-contrast mode all render predictably.
 *
 * All paths are 24×24 viewBox so they scale cleanly with the surrounding
 * font-size when callers set width/height via Tailwind utilities.
 */

interface IconProps extends React.SVGProps<SVGSVGElement> {
    /** Optional className passthrough — caller usually sets size + color. */
    className?: string;
}

/** Solid check inside a circle — used for "Eligible" / "Complete" states. */
export const CheckCircleIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', ...rest }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
        {...rest}
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.78 8.03a.75.75 0 1 0-1.06-1.06l-5.47 5.47-2.22-2.22a.75.75 0 0 0-1.06 1.06l2.75 2.75c.29.3.77.3 1.06 0l6-6Z"
        />
    </svg>
);

/** "No entry" sign — used for "Ineligible" / "Blocked" measures. */
export const NoEntryIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', ...rest }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
        {...rest}
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 1.5a8.46 8.46 0 0 1 5.32 1.87L5.37 17.32A8.46 8.46 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5Zm0 17a8.46 8.46 0 0 1-5.32-1.87L18.63 6.68A8.46 8.46 0 0 1 20.5 12a8.5 8.5 0 0 1-8.5 8.5Z"
        />
    </svg>
);

/** Triangle warning — used for "Warning" rows. */
export const WarningIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', ...rest }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
        {...rest}
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.7 2.97c.6-1.04 2.1-1.04 2.7 0l8.94 15.5A1.56 1.56 0 0 1 21 21H3c-1.2 0-1.95-1.3-1.34-2.34l8.94-15.5Zm.55 5.78a.75.75 0 0 1 1.5 0v5a.75.75 0 0 1-1.5 0v-5Zm.75 8.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
        />
    </svg>
);

/** X mark in a circle — used for "Delete" / "Remove" actions. */
export const XCircleIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', ...rest }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
        {...rest}
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.47 8.47a.75.75 0 0 1 1.06 0L12 10.94l2.47-2.47a.75.75 0 1 1 1.06 1.06L13.06 12l2.47 2.47a.75.75 0 1 1-1.06 1.06L12 13.06l-2.47 2.47a.75.75 0 0 1-1.06-1.06L10.94 12 8.47 9.53a.75.75 0 0 1 0-1.06Z"
        />
    </svg>
);

/** Plus sign — used for "Add" / "Create" actions in headers. */
export const PlusIcon: React.FC<IconProps> = ({ className = 'w-4 h-4', ...rest }) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
        {...rest}
    >
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 4.5a.75.75 0 0 1 .75.75v6h6a.75.75 0 0 1 0 1.5h-6v6a.75.75 0 0 1-1.5 0v-6h-6a.75.75 0 0 1 0-1.5h6v-6A.75.75 0 0 1 12 4.5Z"
        />
    </svg>
);
