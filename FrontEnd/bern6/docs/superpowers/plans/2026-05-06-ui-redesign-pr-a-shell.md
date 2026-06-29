# UI 改版 PR-A：WorkspaceShell + Theme System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立新版 workspace 外殼（top nav + split pane + theme 系統），用 feature flag gate 起來，不影響現有 UI。後續 PR-B 接 STEP 內容、PR-C 接 LayerPanel + 3D viewer 整合、PR-D 替換配色 token。

**Architecture:** 新元件全部放在 `components/workspace/`。`App.tsx` 在 workspace view 內讀 `localStorage['bern5.useNewShell']`，`'1'` 時走 `WorkspaceShell`，否則走現有 header+tabs。新 shell 不依賴 React state lift；現有 props（`baseline` / `floors` / etc.）仍從 App.tsx 透傳。Theme 用 `data-theme` attribute + CSS variable，4 套 palette 集中在 `styles/themes.css`。

**Tech Stack:** React 19、TypeScript、Vite 6、Tailwind（CDN）、CSS variables；無新增 npm 依賴。

**Spec reference:** `docs/superpowers/specs/2026-05-06-ui-redesign-design.md`

**Repo 狀態：** 目前 **不是 git 控管**（`git status` 會失敗）。所有「commit」步驟可以先跳過或記在 changelog；建議實作前先 `git init` 一次（不在這份 plan 內）。

---

## 檔案結構（PR-A 後狀態）

```
bern5/
├── styles/
│   └── themes.css                          ← 新：4 套 CSS-variable palette
├── hooks/
│   ├── useTheme.ts                         ← 新
│   └── useSplitPaneWidth.ts                ← 新
├── components/
│   └── workspace/                          ← 新資料夾
│       ├── WorkspaceShell.tsx              ← 新：外殼 + view='workspace'|'report'
│       ├── TopNav.tsx                      ← 新：4 按鈕 + ThemeSwitcher + 登出
│       ├── ThemeSwitcher.tsx               ← 新：齒輪下拉 A/B/C/D
│       └── SplitPane.tsx                   ← 新：左右拖曳分隔
├── index.html                              ← 改：<html data-theme="c"> + import themes.css
└── App.tsx                                 ← 改：workspace view 加 feature-flag swap
```

每個檔案職責：

| 檔案 | 唯一責任 |
|---|---|
| `styles/themes.css` | 定義所有 `--color-*` token 與 4 套 `[data-theme='x']` overrides |
| `hooks/useTheme.ts` | 管 theme key state、寫 `<html data-theme>`、persist `localStorage` |
| `hooks/useSplitPaneWidth.ts` | 管 split 寬度 state、clamp 範圍、persist `localStorage` |
| `components/workspace/WorkspaceShell.tsx` | 組合 TopNav + view 切換（workspace/report）+ SplitPane 殼 |
| `components/workspace/TopNav.tsx` | 純展示：brand、4 按鈕、ThemeSwitcher、登出按鈕 |
| `components/workspace/ThemeSwitcher.tsx` | 齒輪 icon + dropdown，4 選 1 |
| `components/workspace/SplitPane.tsx` | 左右兩個 slot、6px drag handle、clamp(240,560)、寬度由 hook 給 |

---

## Task 1：themes.css + useTheme

**Files:**
- Create: `styles/themes.css`
- Create: `hooks/useTheme.ts`
- Modify: `index.html`

### Steps

- [ ] **Step 1.1：建立 `styles/themes.css`**

```css
/* styles/themes.css
 * 全站顏色 token。改色只動這個檔案，元件用 var(--color-*)。
 * Default = theme C (warm) — 對應 :root 內容。
 */
:root {
  --color-bg:               #fffaf3;
  --color-card:             #ffffff;
  --color-border:           #f3e2c8;
  --color-text:             #3d2c1a;
  --color-muted:            #7a5a3a;
  --color-accent:           #ef5d3b;
  --color-accent-hover:     #d44a28;
  --color-accent-fg:        #ffffff;
  --color-step-active-bg:   #ffe9d6;
  --color-step-active-text: #8a3b00;
  --color-handle:           #f3e2c8;
  --color-handle-hover:     #ef5d3b;
}

[data-theme='a'] { /* 暗藍：現有風格 */
  --color-bg:               #0f172a;
  --color-card:             #1e293b;
  --color-border:           #334155;
  --color-text:             #e2e8f0;
  --color-muted:            #94a3b8;
  --color-accent:           #2563eb;
  --color-accent-hover:     #1d4ed8;
  --color-accent-fg:        #ffffff;
  --color-step-active-bg:   #1e3a8a;
  --color-step-active-text: #dbeafe;
  --color-handle:           #334155;
  --color-handle-hover:     #2563eb;
}

[data-theme='b'] { /* 白底 + 藍 */
  --color-bg:               #f8fafc;
  --color-card:             #ffffff;
  --color-border:           #e2e8f0;
  --color-text:             #1e293b;
  --color-muted:            #64748b;
  --color-accent:           #2563eb;
  --color-accent-hover:     #1d4ed8;
  --color-accent-fg:        #ffffff;
  --color-step-active-bg:   #dbeafe;
  --color-step-active-text: #1e40af;
  --color-handle:           #e2e8f0;
  --color-handle-hover:     #2563eb;
}

[data-theme='c'] { /* 暖色（預設，同 :root） */
  --color-bg:               #fffaf3;
  --color-card:             #ffffff;
  --color-border:           #f3e2c8;
  --color-text:             #3d2c1a;
  --color-muted:            #7a5a3a;
  --color-accent:           #ef5d3b;
  --color-accent-hover:     #d44a28;
  --color-accent-fg:        #ffffff;
  --color-step-active-bg:   #ffe9d6;
  --color-step-active-text: #8a3b00;
  --color-handle:           #f3e2c8;
  --color-handle-hover:     #ef5d3b;
}

[data-theme='d'] { /* 綠能 */
  --color-bg:               #f7fbf4;
  --color-card:             #ffffff;
  --color-border:           #d6e8d2;
  --color-text:             #1f2d23;
  --color-muted:            #5b6e60;
  --color-accent:           #16a34a;
  --color-accent-hover:     #15803d;
  --color-accent-fg:        #ffffff;
  --color-step-active-bg:   #dcf0d1;
  --color-step-active-text: #15553a;
  --color-handle:           #d6e8d2;
  --color-handle-hover:     #16a34a;
}
```

- [ ] **Step 1.2：建立 `hooks/useTheme.ts`**

```ts
import { useEffect, useState } from 'react';

export type ThemeKey = 'a' | 'b' | 'c' | 'd';
const STORAGE_KEY = 'bern5.theme';
const DEFAULT_THEME: ThemeKey = 'c';
const VALID = new Set<ThemeKey>(['a', 'b', 'c', 'd']);

function readStored(): ThemeKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && VALID.has(v as ThemeKey)) return v as ThemeKey;
  } catch { /* private mode etc. */ }
  return DEFAULT_THEME;
}

/**
 * Manages the active theme key, persists to localStorage, and writes
 * `<html data-theme="x">` so styles/themes.css can swap palettes.
 */
export function useTheme(): [ThemeKey, (t: ThemeKey) => void] {
  const [theme, setTheme] = useState<ThemeKey>(readStored);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  return [theme, setTheme];
}
```

- [ ] **Step 1.3：載入 themes.css + 設預設 data-theme**

  **重要**：現有 `index.html` 內已有 `<link rel="stylesheet" href="/index.css">` 但 `index.css` 其實不存在（silent 404）— 這代表 root-level `<link href>` 在這個 Vite 設定下並不可靠。本 plan **不使用 `<link>` 標籤**，改透過 module graph import 確保 Vite 一定處理。

  - 改 `index.tsx`，在最上方 imports 區塊加一行（在 `import React` 上方或下方都可）：

    ```ts
    import './styles/themes.css';
    ```

  - 改 `index.html`，把：
    ```html
    <html lang="en">
    ```
    改成：
    ```html
    <html lang="en" data-theme="c">
    ```
    （在 React mount 前就有預設 theme，避免 FOUC；useTheme 會在 mount 後 reconcile）

- [ ] **Step 1.4：手動驗證**

開 `http://localhost:3001/`（或現在用的 port），F12 console：
```js
document.documentElement.dataset.theme         // → "c"
getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
// → "#ef5d3b"

document.documentElement.dataset.theme = 'a'
getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
// → "#2563eb"

document.documentElement.dataset.theme = 'c'  // 還原
```

預期：4 個 token 都讀得到、切換 `data-theme` 後變色。

- [ ] **Step 1.5：（選擇性）commit**

```bash
# 若已 git init
git add styles/themes.css hooks/useTheme.ts index.html
git commit -m "feat(ui): add 4-palette theme system with data-theme attribute"
```

---

## Task 2：SplitPane + useSplitPaneWidth

**Files:**
- Create: `hooks/useSplitPaneWidth.ts`
- Create: `components/workspace/SplitPane.tsx`

### Steps

- [ ] **Step 2.1：建立 `hooks/useSplitPaneWidth.ts`**

```ts
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'bern5.splitWidth';
const MIN = 240;
const MAX = 560;
const DEFAULT = 320;

function clamp(n: number): number {
  return Math.max(MIN, Math.min(MAX, n));
}

function readStored(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return clamp(n);
    }
  } catch { /* ignore */ }
  return DEFAULT;
}

/**
 * Width (in px) for the left pane of the workspace split.
 * Clamped to [MIN, MAX]; persisted to localStorage.
 */
export function useSplitPaneWidth(): [number, (n: number) => void, { min: number; max: number }] {
  const [width, setWidthState] = useState<number>(readStored);

  const setWidth = (n: number) => setWidthState(clamp(n));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(width)); } catch { /* ignore */ }
  }, [width]);

  return [width, setWidth, { min: MIN, max: MAX }];
}
```

- [ ] **Step 2.2：建立 `components/workspace/SplitPane.tsx`**

```tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { useSplitPaneWidth } from '../../hooks/useSplitPaneWidth';

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
}

/**
 * Two-column layout with a draggable vertical divider.
 * Left pane width is persisted to localStorage via useSplitPaneWidth.
 */
const SplitPane: React.FC<Props> = ({ left, right }) => {
  const [width, setWidth] = useSplitPaneWidth();
  const draggingRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      // x relative to viewport left edge
      setWidth(e.clientX);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setWidth]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div style={{ width, flexShrink: 0 }} className="overflow-hidden">
        {left}
      </div>
      <div
        onPointerDown={onPointerDown}
        title="拖曳改變寬度"
        className="w-[6px] cursor-col-resize transition-colors"
        style={{ background: 'var(--color-handle)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-handle-hover)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-handle)'; }}
      />
      <div className="flex-1 min-w-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
};

export default SplitPane;
```

- [ ] **Step 2.3：手動驗證（暫時 standalone 測試）**

在 `App.tsx` 內，**暫時** 在 workspace return 前加一段測試 hook（驗完即刪）：

```tsx
// TEMP — 驗證 SplitPane，驗完刪除
import SplitPane from './components/workspace/SplitPane';
// ... 在 workspace return 前
if (typeof window !== 'undefined' && window.location.search.includes('split-test')) {
  return (
    <SplitPane
      left={<div className="h-full p-4" style={{ background: 'var(--color-card)', color: 'var(--color-text)' }}>LEFT</div>}
      right={<div className="h-full p-4" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>RIGHT (3D placeholder)</div>}
    />
  );
}
```

開 `http://localhost:3001/?split-test`：
- 看到左/右兩個區塊，中間 6px 拖曳條
- 拖曳左右改變左區寬度
- 拖到最左仍卡在 240px，拖到右仍卡在 560px
- 重整瀏覽器，寬度保留
- F12 console: `localStorage['bern5.splitWidth']` 顯示數值

驗證完 **刪掉這段 TEMP 程式碼**。

- [ ] **Step 2.4：（選擇性）commit**

```bash
git add hooks/useSplitPaneWidth.ts components/workspace/SplitPane.tsx
git commit -m "feat(ui): add draggable SplitPane with persisted width"
```

---

## Task 3：TopNav + ThemeSwitcher

**Files:**
- Create: `components/workspace/ThemeSwitcher.tsx`
- Create: `components/workspace/TopNav.tsx`

### Steps

- [ ] **Step 3.1：建立 `components/workspace/ThemeSwitcher.tsx`**

```tsx
import React, { useState } from 'react';
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
];

const ThemeSwitcher: React.FC<Props> = ({ theme, onChange }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
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
      >
        🎨
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg shadow-lg overflow-hidden"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          {OPTIONS.map(o => (
            <button
              key={o.key}
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
```

- [ ] **Step 3.2：建立 `components/workspace/TopNav.tsx`**

```tsx
import React from 'react';
import { ThemeKey } from '../../hooks/useTheme';
import ThemeSwitcher from './ThemeSwitcher';

export type WorkspaceView = 'workspace' | 'report';

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
  { label: '方案優化',  match: (v, s) => v === 'workspace' && s === 5, go: { view: 'workspace', stepHint: 5 } },
  { label: '計算報告',  match: (v) => v === 'report',                  go: { view: 'report' } },
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
```

- [ ] **Step 3.3：手動驗證**（暫時 standalone）

在 `App.tsx` **頂層 imports** 加：
```tsx
import TopNav from './components/workspace/TopNav';
import { useTheme } from './hooks/useTheme';
```

在 `App` 元件 **內最上方**（其他 `useState`/`useUndoableState` 旁，**不是** 在條件 return 內 — React hook 不可放條件式裡）加：
```tsx
const [tk, setTk] = useTheme();
```

然後在 workspace return 前加：
```tsx
// TEMP — 驗證 TopNav，驗完刪除（含上面的 hook 呼叫與 imports）
if (typeof window !== 'undefined' && window.location.search.includes('nav-test')) {
  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <TopNav
        projectName="二次測試"
        view="workspace"
        activeStep={1}
        onNavigate={(v, s) => alert(`view=${v} step=${s ?? '-'}`)}
        onLogout={() => alert('logout')}
        theme={tk}
        onThemeChange={setTk}
      />
      <div className="flex-1 p-4">Body placeholder</div>
    </div>
  );
}
```

開 `http://localhost:3001/?nav-test`：
- 看到 TopNav，4 個按鈕、🎨、← 返回
- 點按鈕跳 alert
- 點 🎨 → dropdown 出現 → 選擇變主題（整頁 bg / text 顏色變）
- 重整：theme 保留

驗證完 **刪掉這段 TEMP 程式碼**。

- [ ] **Step 3.4：（選擇性）commit**

```bash
git add components/workspace/ThemeSwitcher.tsx components/workspace/TopNav.tsx
git commit -m "feat(ui): add TopNav with theme switcher"
```

---

## Task 4：WorkspaceShell + 接入 App.tsx（feature flag）

**Files:**
- Create: `components/workspace/WorkspaceShell.tsx`
- Modify: `App.tsx` workspace return 區塊（line ~349）

### Steps

- [ ] **Step 4.1：建立 `components/workspace/WorkspaceShell.tsx`**

```tsx
import React, { useState } from 'react';
import TopNav, { WorkspaceView } from './TopNav';
import SplitPane from './SplitPane';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  projectName: string;
  onLogout: () => void;
  /** PR-A 暫用 placeholder。PR-B 換成真實 StepWizard。 */
  leftContent?: React.ReactNode;
  /** PR-A 暫用 placeholder。PR-B/C 換成 DrawingToolbar + ThreeDViewer。 */
  rightContent?: React.ReactNode;
  /** PR-A 暫用 placeholder。最終是 ReportView。 */
  reportContent?: React.ReactNode;
}

/**
 * Outer shell for the workspace view. Owns:
 *   - theme key (via useTheme)
 *   - view = 'workspace' | 'report'
 *   - activeStep (for TopNav highlighting & shortcut hints)
 *
 * Does NOT own STEP content, layer panel, or 3D viewer — those come via props.
 */
const WorkspaceShell: React.FC<Props> = ({
  projectName, onLogout, leftContent, rightContent, reportContent,
}) => {
  const [theme, setTheme] = useTheme();
  const [view, setView] = useState<WorkspaceView>('workspace');
  const [activeStep, setActiveStep] = useState<number>(1);

  const handleNavigate = (target: WorkspaceView, stepHint?: number) => {
    setView(target);
    if (target === 'workspace' && typeof stepHint === 'number') {
      setActiveStep(stepHint);
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      <TopNav
        projectName={projectName}
        view={view}
        activeStep={activeStep}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        theme={theme}
        onThemeChange={setTheme}
      />

      {view === 'workspace' ? (
        <SplitPane
          left={
            leftContent ?? (
              <div
                className="h-full p-4 text-sm"
                style={{ background: 'var(--color-card)', borderRight: '1px solid var(--color-border)' }}
              >
                <div className="font-bold mb-2">STEP {activeStep} (TODO)</div>
                <div style={{ color: 'var(--color-muted)' }}>左側 STEP wizard 內容會在 PR-B 接入。</div>
              </div>
            )
          }
          right={
            rightContent ?? (
              <div
                className="h-full flex items-center justify-center"
                style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}
              >
                右側 3D 區域會在 PR-C 接入。
              </div>
            )
          }
        />
      ) : (
        <div className="flex-1 overflow-auto" style={{ background: 'var(--color-bg)' }}>
          {reportContent ?? (
            <div className="p-8 text-center" style={{ color: 'var(--color-muted)' }}>
              ReportView（計算報告）會在後續 PR 接入。
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceShell;
```

- [ ] **Step 4.2：改 `App.tsx` — 在 workspace return 上方加 feature flag swap**

找到（約 line 349）：
```tsx
  // Workspace View
  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-slate-900 antialiased font-sans overflow-hidden">
```

**前面** 插入：

```tsx
  // Workspace View — new shell (feature-flagged for PR-A)
  // To enable: in browser devtools console run `localStorage.setItem('bern5.useNewShell','1'); location.reload()`
  // To disable: `localStorage.removeItem('bern5.useNewShell'); location.reload()`
  const useNewShell = (() => {
    try { return localStorage.getItem('bern5.useNewShell') === '1'; }
    catch { return false; }
  })();
  if (useNewShell) {
    return (
      <WorkspaceShell
        projectName={baseline?.name ?? ''}
        onLogout={handleBackToDashboard}
      />
    );
  }

  // ⚠️ Implementer check：`baseline` 在 App.tsx 已用 `useState<ProjectBaseline>(...)` 初始化（line ~43），
  // 進到 workspace return 時必為 defined。`baseline?.name` 純防禦寫法，可改 `baseline.name`；
  // 若你看到 baseline 在某些 view 是 nullable，保留 `?.`。
```

並在 App.tsx 上方的 imports（與其他 components 一起）加：
```tsx
import WorkspaceShell from './components/workspace/WorkspaceShell';
```

> 既有的 workspace return（line 349 以後）完全保留，只在前面多一條 if-return。Feature flag 預設關 → 既有 UI 不受影響。

- [ ] **Step 4.3：手動驗證 — flag OFF**

開 `http://localhost:3001/`，登入進專案：
- 看到的是 **原本** 的 workspace UI（不是新 shell）
- F12 console: `localStorage.getItem('bern5.useNewShell')` → `null`

- [ ] **Step 4.4：手動驗證 — flag ON（PR-A 主要驗證點）**

F12 console：
```js
localStorage.setItem('bern5.useNewShell', '1'); location.reload()
```

預期：
- [ ] 進專案後看到新 TopNav（B、BERSN-Pro 標題、4 按鈕、🎨、← 返回）
- [ ] 預設 theme C（暖色淺底），背景 `#fffaf3`
- [ ] 切換 🎨：4 套 palette 即時生效
- [ ] 4 個 nav 按鈕：點「參數設定」「能效分析」「方案優化」會看到 STEP 數字變（1/4/5）並顯示「TODO」placeholder
- [ ] 點「計算報告」→ 顯示「ReportView 會在後續 PR 接入」
- [ ] 點回「參數設定」→ 回 SplitPane
- [ ] SplitPane 左右拖曳，clamp 240–560
- [ ] 重整：theme 保留、split 寬度保留、view 回到預設 'workspace'/step=1（無持久化 by design）
- [ ] 點「← 返回」→ 回 Dashboard
- [ ] 切回 flag OFF（`localStorage.removeItem('bern5.useNewShell'); location.reload()`）→ 舊 UI 完全恢復

任何一項不過就回該 Task 修。

- [ ] **Step 4.5：（選擇性）commit**

```bash
git add components/workspace/WorkspaceShell.tsx App.tsx
git commit -m "feat(ui): add WorkspaceShell behind localStorage feature flag"
```

---

## Task 5：最終 smoke checklist

逐項打勾，每項失敗就回對應 Task 修。

- [ ] Flag OFF（預設）→ 現有 UI 完全沒變
- [ ] Flag ON → 新 shell 顯示，theme C 預設
- [ ] Theme A/B/C/D 切換即時生效，無需重整
- [ ] Theme 在重整後保留
- [ ] Split handle 拖曳：流暢、clamp(240, 560)
- [ ] Split width 在重整後保留
- [ ] Top nav 4 按鈕點擊 → STEP 數字 / view 正確切換
- [ ] 「← 返回」回 Dashboard
- [ ] 無 console error / warning
- [ ] Tailwind class 沒打架（檢查視覺有無破版）
- [ ] 換不同 theme 後，handle hover 顏色正確（用 hover 那條 token）

通過後 PR-A 完成 → 進 PR-B（StepWizard + 接 5 個 panel）。

---

## 後續 PR 預告（不在本 plan 範圍）

| PR | 範圍 |
|---|---|
| **PR-B** | StepWizard + useActiveStep（sessionStorage by projectId）+ 接通 5 個現有 panel + STEP 3 sub-tab(外殼/設備)+「下一步」按鈕；把 props 透傳到 WorkspaceShell 的 `leftContent` |
| **PR-C** | LayerPanel + ThreeDViewer `layerVisibility` prop；把 DrawingToolbar+ThreeDViewer 包成 `rightContent` 傳入 |
| **PR-D** | 大規模 sed：把現有 panel 內部 hard-coded slate/blue 換成 `var(--color-*)` token；smoke checklist 跑完；翻 feature flag default = ON；最終移除 flag |
