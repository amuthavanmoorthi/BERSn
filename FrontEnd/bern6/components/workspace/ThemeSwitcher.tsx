import React, { useEffect, useRef, useState } from 'react';
import { ThemeKey } from '../../hooks/useTheme';

interface Props {
  theme: ThemeKey;
  onChange: (t: ThemeKey) => void;
}

const OPTIONS: Array<{ key: ThemeKey; label: string; swatch: string }> = [
  { key: 'a', label: '暗藍',     swatch: '#2563eb' },
  { key: 'b', label: '白藍',     swatch: '#dbeafe' },
  { key: 'c', label: '暖色 ★',   swatch: '#ef5d3b' },
  { key: 'd', label: '綠能',     swatch: '#16a34a' },
  { key: 'e', label: '鮮明暖色', swatch: '#f5a78e' },
];

const ThemeSwitcher: React.FC<Props> = ({ theme, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside-click and Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
        title="主題切換"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        🎨
      </button>
      {open && (
        <div
          role="menu"
          aria-label="主題切換"
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg shadow-lg overflow-hidden"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          {OPTIONS.map(o => (
            <button
              key={o.key}
              role="menuitemradio"
              aria-checked={theme === o.key}
              type="button"
              onClick={() => { onChange(o.key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
              style={{
                background: theme === o.key ? 'var(--color-step-active-bg)' : 'transparent',
                color: theme === o.key ? 'var(--color-step-active-text)' : 'var(--color-text)',
              }}
            >
              <span style={{ background: o.swatch }} className="w-4 h-4 rounded" />
              <span className="flex-1 text-left">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;
