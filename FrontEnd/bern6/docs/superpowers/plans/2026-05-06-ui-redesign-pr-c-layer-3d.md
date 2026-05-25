# UI 改版 PR-C：LayerPanel + ThreeDViewer 整合進新 shell

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 加入「圖層／元件」面板（單列：主體模型 toggle），讓 ThreeDViewer 真正出現在新 shell 的右半（取代 PR-A 的 placeholder）。

**Architecture:**
- `layerVisibility` state（型別 `{ mainModel: boolean }`，預設 `{ mainModel: true }`）住在 App.tsx，透過兩條路徑分發：
  1. WorkspaceShell prop → 渲染左側下方的 LayerPanel
  2. ThreeDViewer prop → 控制 main shape group 的 `.visible`
- DrawingToolbar 早已在 ThreeDViewer 內部 — 不必額外搬。
- WorkspaceShell `leftContent` 之後新增一個小區塊「圖層」（不收掉 SplitPane）。

**Tech:** React + TS。無新依賴。
**Spec:** `docs/superpowers/specs/2026-05-06-ui-redesign-design.md`
**Prior plans:** PR-A (DONE), PR-B (DONE)

---

## 檔案結構（PR-C 後）

```
components/workspace/
  ├── LayerPanel.tsx                ← 新
  ├── WorkspaceShell.tsx            ← 改：accept layers prop + render LayerPanel
  └── (PR-A/B 既有: StepWizard, TopNav, SplitPane, ScenariosView, ThemeSwitcher)
components/ThreeDViewer.tsx          ← 改：accept layerVisibility prop + group.visible effect
App.tsx                              ← 改：加 layerVisibility state；rightContent={<ThreeDViewer ... />}
```

---

## Task 1：LayerPanel（單列）

**File:**
- Create: `components/workspace/LayerPanel.tsx`

```tsx
import React from 'react';

export type LayerKey = 'mainModel';

export interface LayerVisibility {
  mainModel: boolean;
  // 預留擴充槽：baselinePlane / energyComponents / mep / envGrid / refUnderlay
}

interface Props {
  layers: LayerVisibility;
  onToggle: (key: LayerKey) => void;
}

const LayerPanel: React.FC<Props> = ({ layers, onToggle }) => {
  const Row: React.FC<{
    layerKey: LayerKey;
    tag: string;
    label: string;
    pct: string;
  }> = ({ layerKey, tag, label, pct }) => {
    const visible = layers[layerKey];
    return (
      <div className="flex items-center gap-2 py-1 px-1">
        <button
          type="button"
          onClick={() => onToggle(layerKey)}
          className="w-7 h-7 rounded flex items-center justify-center text-xs font-black transition-colors"
          style={{
            background: visible ? 'var(--color-accent)' : 'transparent',
            color: visible ? 'var(--color-accent-fg)' : 'var(--color-muted)',
            border: '1px solid var(--color-border)',
          }}
          title={visible ? '隱藏' : '顯示'}
          aria-pressed={visible}
        >
          👁
        </button>
        <span
          className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-black"
          style={{ background: 'var(--color-step-active-bg)', color: 'var(--color-step-active-text)' }}
        >
          {tag}
        </span>
        <span className="flex-1 text-xs" style={{ color: 'var(--color-text)' }}>{label}</span>
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{pct}</span>
      </div>
    );
  };

  return (
    <div
      className="border-t p-2"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <div className="text-[10px] font-black uppercase mb-2 px-1" style={{ color: 'var(--color-muted)' }}>
        圖層 / 元件
      </div>
      <Row layerKey="mainModel" tag="M" label="主體模型" pct="100%" />
    </div>
  );
};

export default LayerPanel;
```

**Verify:** `npx tsc --noEmit | grep -v ...` empty.

---

## Task 2：WorkspaceShell — 加 layer props + render LayerPanel

**File:**
- Modify: `components/workspace/WorkspaceShell.tsx`

**Changes (add to Props):**
```tsx
import LayerPanel, { LayerVisibility, LayerKey } from './LayerPanel';

interface Props {
  // ...existing...
  layerVisibility?: LayerVisibility;
  onLayerToggle?: (key: LayerKey) => void;
}
```

**Render LayerPanel inside the left pane below `leftContent`:**

找到 SplitPane 那段：
```tsx
<SplitPane
  left={
    leftContent ?? (... placeholder ...)
  }
  ...
/>
```

把 `left` 改成 column 結構（leftContent 取 flex-1，LayerPanel 在底部）：

```tsx
<SplitPane
  left={
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        {leftContent ?? (
          <div
            className="h-full p-4 text-sm"
            style={{ background: 'var(--color-card)', borderRight: '1px solid var(--color-border)' }}
          >
            <div className="font-bold mb-2">STEP {activeStep} (TODO)</div>
            <div style={{ color: 'var(--color-muted)' }}>左側 STEP wizard 內容會在 PR-B 接入。</div>
          </div>
        )}
      </div>
      {layerVisibility && onLayerToggle && (
        <LayerPanel layers={layerVisibility} onToggle={onLayerToggle} />
      )}
    </div>
  }
  right={...}
/>
```

LayerPanel 是 optional render — 沒傳 props 時不出現（保持 PR-A 行為向後相容）。

**Verify:** tsc clean。

---

## Task 3：ThreeDViewer — accept layerVisibility prop

**File:**
- Modify: `components/ThreeDViewer.tsx`

**Changes：**

1. 在 `interface ThreeDViewerProps` 加：
```tsx
  /** Optional layer visibility map. When provided, `mainModel` controls
   *  whether the main shape group is visible. */
  layerVisibility?: { mainModel: boolean };
```

2. 在 component arg destructure 加 `layerVisibility`

3. 在 component 內加一個 useEffect（緊接在 main scene 初始化的 useEffect 後即可，或在 component 末尾）：

```tsx
// Sync external layer visibility → main shape group
useEffect(() => {
  const group = objectsGroupRef.current;
  if (!group) return;
  const visible = layerVisibility?.mainModel !== false;  // default true if prop omitted
  group.visible = visible;
}, [layerVisibility, sceneReady]);
```

（`sceneReady` 已經是 state；確認在 `useEffect` dep 內，這樣 scene mount 完成後 effect 也會 fire。）

**Verify:** tsc clean。Reload preview → toggle eye → 3D shapes 隱藏/顯示。

---

## Task 4：App.tsx — 加 state + rightContent

**File:**
- Modify: `App.tsx`

**Changes:**

1. 加 import：
```tsx
import type { LayerVisibility, LayerKey } from './components/workspace/LayerPanel';
```

2. 在其他 useState 旁加：
```tsx
const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({ mainModel: true });
const handleLayerToggle = (key: LayerKey) => {
  setLayerVisibility(prev => ({ ...prev, [key]: !prev[key] }));
};
```

3. 改 `if (USE_NEW_SHELL)` 分支，加 `layerVisibility` / `onLayerToggle` / `rightContent`：

```tsx
if (USE_NEW_SHELL) {
  return (
    <WorkspaceShell
      projectName={baseline.name}
      onLogout={handleBackToDashboard}
      layerVisibility={layerVisibility}
      onLayerToggle={handleLayerToggle}
      leftContent={<StepWizard ... />}
      rightContent={
        <ThreeDViewer
          objects={objects}
          floors={floors}
          selectedFloorId={selectedFloorId}
          selectedShapeId={selectedShapeId}
          editingFloorId={editingFloorId}
          lang={lang}
          showCompass={true}
          onAddFloor={handleAddFloorFromViewer}
          onSelectFloor={handleSelectFloorFromViewer}
          onSelectShape={handleSelectShapeFromViewer}
          onMoveShape={handleMoveShape}
          onEnterEditMode={handleEnterEditMode}
          onExitEditMode={handleExitEditMode}
          onFloorsChange={setFloors}
          onUndo={undoFloors}
          onRedo={redoFloors}
          canUndo={canUndoFloors}
          canRedo={canRedoFloors}
          topViewRequestSeq={topViewRequestSeq}
          layerVisibility={layerVisibility}
        />
      }
      reportContent={<ReportView baseline={baseline} kpis={kpis} lang={lang} />}
    />
  );
}
```

**Important:** 不動 App.tsx 其他部分。舊 workspace JSX 仍保留（flag-off 使用）。

**Verify:** tsc clean。

---

## Task 5：Smoke checklist（Claude Preview）

- [ ] Flag OFF → 舊 UI 正常
- [ ] Flag ON → 新 shell + LayerPanel 在左下顯示「主體模型 100%」
- [ ] 切到 STEP 1-5 任一 → ThreeDViewer 一直顯示在右側（建模相關 step 也能看到形狀）
- [ ] 點圖層 👁 toggle → ThreeDViewer 內所有 shapes 隱藏；再點 → 顯示
- [ ] toggle 後切到「計算報告」→ 回「參數設定」→ ThreeDViewer 仍記得隱藏狀態
- [ ] 0 console error
- [ ] STEP 2 (建模) 仍能新增 / 拖曳 / 編輯形狀（迴歸驗證）

---

## 後續預告

| PR | 範圍 |
|---|---|
| **PR-D** | App.tsx 舊 workspace JSX 砍掉；sed slate→token；翻 flag default = ON；移除 flag；ThemeSwitcher a11y；TopNav shortcut 真的跳 STEP |
