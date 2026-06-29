import React from 'react';
import { ThemeKey } from '../../hooks/useTheme';
import ThemeSwitcher from './ThemeSwitcher';

export type WorkspaceView = 'workspace' | 'scenarios' | 'report';

export interface TopNavProps {
  projectName: string;
  view: WorkspaceView;
  activeStep: number;
  onNavigate: (view: WorkspaceView, stepHint?: number) => void;
  onLogout: () => void;
  theme: ThemeKey;
  onThemeChange: (t: ThemeKey) => void;
}

const NAV_BUTTONS: Array<{
  label: string;
  match: (v: WorkspaceView, step: number) => boolean;
  go: { view: WorkspaceView; stepHint?: number };
}> = [
  { label: '參數設定',  match: (v, s) => v === 'workspace' && s <= 3, go: { view: 'workspace', stepHint: 1 } },
  { label: '能效分析',  match: (v, s) => v === 'workspace' && s === 4, go: { view: 'workspace', stepHint: 4 } },
  { label: '方案優化',  match: (v) => v === 'scenarios',                go: { view: 'scenarios' } },
  { label: '計算報告',  match: (v) => v === 'report',                   go: { view: 'report' } },
];

const TopNav: React.FC<TopNavProps> = ({
  projectName, view, activeStep, onNavigate, onLogout, theme, onThemeChange,
}) => {
  return (
    <header
      className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
      style={{
        background: 'var(--color-card)',
        borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      <div className="flex items-center gap-2 mr-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-black"
          style={{ background: 'var(--color-accent)', color: 'var(--color-accent-fg)' }}
        >
          B
        </div>
        <div className="leading-tight">
          <div className="font-black text-sm">BERSN-Pro 建築能效平台</div>
          <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>／{projectName}</div>
        </div>
      </div>

      <nav className="ml-auto flex items-center gap-1">
        {NAV_BUTTONS.map(b => {
          const active = b.match(view, activeStep);
          return (
            <button
              key={b.label}
              type="button"
              onClick={() => onNavigate(b.go.view, b.go.stepHint)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={{
                background: active ? 'var(--color-accent)' : 'transparent',
                color: active ? 'var(--color-accent-fg)' : 'var(--color-text)',
                border: '1px solid ' + (active ? 'var(--color-accent)' : 'var(--color-border)'),
              }}
            >
              {b.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 ml-2">
        <ThemeSwitcher theme={theme} onChange={onThemeChange} />
        <button
          type="button"
          onClick={onLogout}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          style={{
            background: 'transparent',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
          title="登出 / 返回專案列表"
        >
          ← 返回
        </button>
      </div>
    </header>
  );
};

export default TopNav;
