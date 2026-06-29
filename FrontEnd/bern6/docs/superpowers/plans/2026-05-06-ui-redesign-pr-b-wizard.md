# UI 改版 PR-B：StepWizard + 接 5 個現有 panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 把 5 個現有 panel（ProjectSettings / FloorManager / Envelope+MEP / Geometry+Breakdown / Scenarios）接進左側 STEP wizard；保留 PR-A 的 feature flag、舊 UI 完全不動。

**Architecture:**
- `StepWizard` 持有 `activeStep` state（via `useActiveStep` hook，per-project sessionStorage），渲染 5 個 tabs + 對應 step content。
- STEP 3 內含 sub-tab 切換 Envelope/MEP。
- STEP 5 (Scenarios) 從 App.tsx 抽出來成獨立 `ScenariosView` 元件。
- 所有 panel **props 透過 StepWizardProps 傳入**（不用 Context；明確、可追蹤）。
- App.tsx flag-ON 分支：把 `<StepWizard {...allProps} />` 塞進 WorkspaceShell 的 `leftContent`，把 `<ReportView .../>` 塞進 `reportContent`。
- 舊 `activeTab === 'optimization'` JSX 暫時保留（PR-D 統一 DRY）。

**Tech stack:** React 19 + TS + Vite。無新 npm 依賴。

**Spec ref:** `docs/superpowers/specs/2026-05-06-ui-redesign-design.md`
**Prior plan:** `docs/superpowers/plans/2026-05-06-ui-redesign-pr-a-shell.md` (DONE)

---

## 檔案結構（PR-B 後狀態）

```
hooks/useActiveStep.ts                          ← 新
components/workspace/
  ├── StepWizard.tsx                            ← 新：5 tabs + content
  ├── ScenariosView.tsx                         ← 新：抽自 App.tsx optimization 區塊
  └── (PR-A 已有：WorkspaceShell/TopNav/SplitPane/ThemeSwitcher)
App.tsx                                          ← 改：feature-flag 分支補 leftContent/reportContent
```

| 檔案 | 唯一責任 |
|---|---|
| `hooks/useActiveStep.ts` | activeStep state、per-project sessionStorage key、外部可注入 initialStep（nav shortcut 用）|
| `components/workspace/StepWizard.tsx` | 5 tabs UI、step content 分派、STEP 3 sub-tab、「下一步」按鈕 |
| `components/workspace/ScenariosView.tsx` | Measures / Scenarios JSX（從 App.tsx lift）|
| `App.tsx` (flag-on 分支) | 把 props 全部組好餵給 `<WorkspaceShell leftContent={<StepWizard ../>} reportContent={<ReportView ../>} />` |

---

## Task 1：useActiveStep hook

**Files:**
- Create: `hooks/useActiveStep.ts`

### Steps

- [ ] **1.1 — 建檔**

```ts
import { useEffect, useState } from 'react';

const KEY_PREFIX = 'bern5.activeStep.';
const MIN_STEP = 1;
const MAX_STEP = 5;
const DEFAULT_STEP = 1;

function clampStep(n: number): number {
  return Math.max(MIN_STEP, Math.min(MAX_STEP, Math.round(n)));
}

function readStored(projectId: string): number {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + projectId);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return clampStep(n);
    }
  } catch { /* ignore */ }
  return DEFAULT_STEP;
}

/**
 * Active step (1..5) for the StepWizard, persisted per-project in sessionStorage
 * so reload keeps the user on the same step but switching projects starts fresh.
 *
 * `initialStep` is an external override (e.g. TopNav shortcut "能效分析" → 4).
 * When it changes, activeStep is forcibly set. When undefined, the stored value
 * (or default 1) is used.
 */
export function useActiveStep(
  projectId: string,
  initialStep?: number,
): [number, (n: number) => void] {
  const [active, setActiveRaw] = useState<number>(() =>
    typeof initialStep === 'number' ? clampStep(initialStep) : readStored(projectId)
  );

  // External override: when TopNav clicks "能效分析" → initialStep becomes 4
  useEffect(() => {
    if (typeof initialStep === 'number') {
      setActiveRaw(clampStep(initialStep));
    }
  }, [initialStep]);

  // Project switch: reload from new project's storage
  useEffect(() => {
    setActiveRaw(readStored(projectId));
  }, [projectId]);

  // Persist on change
  useEffect(() => {
    try { sessionStorage.setItem(KEY_PREFIX + projectId, String(active)); }
    catch { /* ignore */ }
  }, [active, projectId]);

  const setActive = (n: number) => setActiveRaw(clampStep(n));
  return [active, setActive];
}
```

- [ ] **1.2 — 驗證**

```bash
npx tsc --noEmit 2>&1 | grep -v "GeometryControlPanel\|ThreeDViewer.tsx(932\|ThreeDViewer.tsx(2188\|lib/calc" | head
```

預期：empty（只有原有 5 個 pre-existing errors）。

- [ ] **1.3 — Self-review**

- `clampStep` 在 3 處都套用（read / setActive / initialStep effect）
- sessionStorage 兩個 op（read/write）都 try/catch
- projectId 變動會 force read from new project's slot
- initialStep 變動會 force update（即使跟現值一樣也 OK，setState 會 bail out）
- 不依賴 localStorage（session-scoped per spec）

---

## Task 2：ScenariosView 元件（從 App.tsx 抽出）

**Files:**
- Create: `components/workspace/ScenariosView.tsx`
- Modify: 無（App.tsx 舊 JSX 保留；PR-D 統一處理）

### 範圍說明

App.tsx 第 406–520 行（`activeTab === 'optimization'` 分支）包含：
- 「方案措施庫」section（MEASURE_LIBRARY map 渲染卡片）
- 「成本效益排名」table（measureImpacts 排序）
- 「情境管理」右側欄（scenarios + selectedScenarioId）
- 可能還包含 measureImpacts 計算（如果是 inline，要連同 useMemo 一起搬；如果是上方 hook 的話只搬 JSX）

### Steps

- [ ] **2.1 — 先讀 App.tsx 對應行區，找出 props surface**

```bash
# 找 measureImpacts 定義（是 useMemo 還是 inline computed?）
grep -n "measureImpacts" /Users/yuhueisheng/Projects/antigravity/bern5/App.tsx
# 找 scenarios state 來源
grep -n "scenarios\|setScenarios\|selectedScenarioId\|setSelectedScenarioId" /Users/yuhueisheng/Projects/antigravity/bern5/App.tsx | head -10
# 找 activeScenarioResults
grep -n "activeScenarioResults" /Users/yuhueisheng/Projects/antigravity/bern5/App.tsx | head -5
```

從輸出列表，整理出 ScenariosView 需要的 props（值 + setter）：
- `lang`
- `t` (translations slice — 或讓元件自己 import translations 並用 lang 取)
- `kpis` (current baseline KPI used by measureImpacts? — confirm)
- `baseline`
- `objects`
- `scenarios` + `setScenarios`
- `selectedScenarioId` + `setSelectedScenarioId`
- `activeScenarioResults` (computed)
- `measureImpacts` (computed) — **如果是 useMemo at App level，傳值；如果是 inline，搬計算進 ScenariosView 並把它需要的 raw inputs 傳進來**

- [ ] **2.2 — 建檔 `components/workspace/ScenariosView.tsx`**

骨架（subagent 補完整 JSX）：

```tsx
import React from 'react';
import { ProjectBaseline, GeometryObject, Scenario, Measure } from '../../types';
import { MEASURE_LIBRARY } from '../../constants';
import { translations } from '../../translations';
import { simulateMeasure } from '../../services/optimizationEngine';

interface ScenariosViewProps {
  lang: 'zh' | 'en';
  baseline: ProjectBaseline;
  objects: GeometryObject[];
  kpis: any; // 沿用 App.tsx 既有 kpis 型別（避免引入新 type 風險）
  scenarios: Scenario[];
  onScenariosChange: (s: Scenario[]) => void;
  selectedScenarioId: string | null;
  onSelectScenario: (id: string | null) => void;
  activeScenarioResults: any; // 同上
}

const ScenariosView: React.FC<ScenariosViewProps> = (props) => {
  const { lang } = props;
  const t = translations[lang];

  // measureImpacts: 如果原本在 App.tsx 是 useMemo，這裡也用 useMemo 重算
  // (需要 simulateMeasure + baseline + objects + kpis)
  const measureImpacts = React.useMemo(() => {
    // 從 App.tsx 對應段 lift 進來；保持完全相同的計算
    return MEASURE_LIBRARY.map(m => simulateMeasure(props.baseline, props.objects, props.kpis, m));
  }, [props.baseline, props.objects, props.kpis]);

  return (
    // ★ 把 App.tsx 第 407-520 行的 JSX lift 進來
    // 注意：類別字串 (bg-white / text-slate-* 等) 在 PR-B 階段保留 hard-coded，
    //       PR-D 會集中換成 var(--color-*) token。
    <div className="lg:col-span-12 grid grid-cols-12 gap-8 overflow-y-auto custom-scrollbar p-2">
      {/* ... entire optimization JSX ... */}
    </div>
  );
};

export default ScenariosView;
```

- [ ] **2.3 — Lift 步驟（subagent 執行細節）**

1. 開 `App.tsx` 第 406 行附近的 `: activeTab === 'optimization' ? (` 區塊
2. 找到該分支對應的右括號 `) : (` （約 524 行附近）
3. **整段** 內層 `<div className="lg:col-span-12 grid grid-cols-12 ...">...</div>` 複製到 `ScenariosView.tsx` 對應位置
4. 把 JSX 內所有對 `t.xxx`、`MEASURE_LIBRARY`、`measureImpacts`、`scenarios`、`selectedScenarioId`、`setSelectedScenarioId`、`activeScenarioResults`、`lang`、`kpis` 的引用 → 改成 `props.xxx` / 解構 / `import` 過來的對應名稱
5. **不要修改 App.tsx 那段原始 JSX**（PR-B 不動舊 UI；PR-D 才會把它替換成 `<ScenariosView ...>`）

- [ ] **2.4 — 驗證**

```bash
npx tsc --noEmit 2>&1 | grep -v "GeometryControlPanel\|ThreeDViewer.tsx(932\|ThreeDViewer.tsx(2188\|lib/calc" | head
```

預期：empty。

- [ ] **2.5 — Self-review**

- 沒有未使用的 import
- JSX 內所有 `t.xxx` 都解析得到（confirm via tsc / 視覺確認）
- `measureImpacts` 計算邏輯跟 App.tsx 原版「完全相同」（同樣的 `simulateMeasure` 呼叫順序）
- `onScenariosChange` / `onSelectScenario` 在 JSX 內被正確呼叫（取代原本的 setState）
- App.tsx **沒被改**（用 git status / mtime 確認，或 grep `activeTab === 'optimization'` 仍然存在）

---

## Task 3：StepWizard 元件

**Files:**
- Create: `components/workspace/StepWizard.tsx`

### 前置 grep（避免 token / panel prop 名稱猜錯）

```bash
# 1. 確認 PR-A 已落地的 CSS tokens（StepWizard 會用到 step-active-* 與 accent-fg）
grep -E "step-active|accent-fg" /Users/yuhueisheng/Projects/antigravity/bern5/styles/themes.css | head -10
# 應該在 4 個 [data-theme] 區塊各看到 3 個 token；若缺，在繼續前補上

# 2. 確認 6 個 panel 的 props interface 名稱
for f in ProjectSettings FloorManager EnvelopeSettings MEPSettings GeometryCalculations CalculationBreakdown; do
  echo "=== $f ==="
  grep -A20 "^interface.*Props\|^interface ${f}" /Users/yuhueisheng/Projects/antigravity/bern5/components/${f}Panel.tsx | head -22
done
```

把實際 prop 名稱對到 3.1 骨架的對應位置；若有差異（例如 `onProjectNameChange` 改名了）以實際檔案為準。

### Steps

- [ ] **3.1 — 建檔骨架**

```tsx
import React, { useState } from 'react';
import { useActiveStep } from '../../hooks/useActiveStep';
import ProjectSettingsPanel from '../ProjectSettingsPanel';
import FloorManagerPanel from '../FloorManagerPanel';
import EnvelopeSettingsPanel from '../EnvelopeSettingsPanel';
import MEPSettingsPanel from '../MEPSettingsPanel';
import GeometryCalculationsPanel from '../GeometryCalculationsPanel';
import CalculationBreakdownPanel from '../CalculationBreakdownPanel';
import ScenariosView from './ScenariosView';

import type { Floor, GeometryObject, ProjectBaseline, ExemptArea, Scenario } from '../../types';
import type { UseCategoryId } from '../../data/bersnConfig';

export interface StepWizardProps {
  projectId: string;
  initialStep?: number;
  lang: 'zh' | 'en';

  // STEP 1: ProjectSettings
  baseline: ProjectBaseline;
  onBaselineChange: (b: ProjectBaseline) => void;
  selectedRegion: string;
  onRegionChange: (id: string) => void;
  selectedUseCategory: UseCategoryId;
  onUseCategoryChange: (id: UseCategoryId) => void;

  // STEP 2: FloorManager
  floors: Floor[];
  onFloorsChange: (f: Floor[]) => void;
  selectedFloorId: string | null;
  onSelectFloor: (id: string | null) => void;
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  onEnterTopView?: (floorId: string) => void;

  // STEP 3: Envelope + MEP
  selectedWall: string;        onWallChange: (id: string) => void;
  selectedRoof: string;        onRoofChange: (id: string) => void;
  selectedShading: string;     onShadingChange: (id: string) => void;
  selectedGlazing: string;     onGlazingChange: (id: string) => void;
  selectedHVAC: string;        onHVACChange: (id: string) => void;
  selectedLighting: string;    onLightingChange: (id: string) => void;
  selectedElevator: string;    onElevatorChange: (id: string) => void;
  selectedDHW: string;         onDHWChange: (id: string) => void;
  elevatorCount: number;       onElevatorCountChange: (n: number) => void;

  // STEP 4: Geometry + Breakdown
  objects: GeometryObject[];
  floorsForCalc: Floor[];
  kpis: any;

  // STEP 5: Scenarios
  scenarios: Scenario[];
  onScenariosChange: (s: Scenario[]) => void;
  selectedScenarioId: string | null;
  onSelectScenario: (id: string | null) => void;
  activeScenarioResults: any;
}

const TABS: { num: number; label: string; tag: string }[] = [
  { num: 1, label: '基建', tag: '專案基建' },
  { num: 2, label: '建模', tag: '用戶側形貌建模 (AF)' },
  { num: 3, label: 'EUI',  tag: '耗能參數計算' },
  { num: 4, label: 'LRV',  tag: '效益模擬' },
  { num: 5, label: 'AFE',  tag: '方案比對' },
];

const StepWizard: React.FC<StepWizardProps> = (props) => {
  const [active, setActive] = useActiveStep(props.projectId, props.initialStep);
  const [step3Sub, setStep3Sub] = useState<'envelope' | 'mep'>('envelope');

  const goNext = () => { if (active < 5) setActive(active + 1); };
  const canGoNext = active < 5;

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--color-card)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Tabs row */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        {TABS.map(t => {
          const isActive = active === t.num;
          return (
            <button
              key={t.num}
              type="button"
              onClick={() => setActive(t.num)}
              className="flex-1 px-2 py-2 text-[11px] font-bold transition-colors"
              style={{
                background: isActive ? 'var(--color-step-active-bg)' : 'transparent',
                color: isActive ? 'var(--color-step-active-text)' : 'var(--color-muted)',
                borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
              title={t.tag}
            >
              {t.num}·{t.label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-3 text-sm" style={{ color: 'var(--color-text)' }}>
        {active === 1 && (
          <ProjectSettingsPanel
            lang={props.lang}
            projectName={props.baseline.name}
            onProjectNameChange={(name) => props.onBaselineChange({ ...props.baseline, name })}
            selectedRegion={props.selectedRegion}
            onRegionChange={props.onRegionChange}
            selectedUseCategory={props.selectedUseCategory}
            onUseCategoryChange={props.onUseCategoryChange}
            totalFloorArea={props.baseline.totalFloorAreaAF}
            onTotalFloorAreaChange={(area) => props.onBaselineChange({ ...props.baseline, totalFloorAreaAF: area })}
            exemptAreas={props.baseline.exemptAreas}
            onExemptAreasChange={(areas) => props.onBaselineChange({ ...props.baseline, exemptAreas: areas })}
          />
        )}
        {active === 2 && (
          <FloorManagerPanel
            lang={props.lang}
            floors={props.floors}
            onFloorsChange={props.onFloorsChange}
            selectedFloorId={props.selectedFloorId}
            onSelectFloor={props.onSelectFloor}
            selectedShapeId={props.selectedShapeId}
            onSelectShape={props.onSelectShape}
            onEnterTopView={props.onEnterTopView}
          />
        )}
        {active === 3 && (
          <div>
            {/* Sub-tabs: Envelope / MEP */}
            <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              {(['envelope', 'mep'] as const).map(sub => {
                const isOn = step3Sub === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setStep3Sub(sub)}
                    className="flex-1 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                    style={{
                      background: isOn ? 'var(--color-accent)' : 'transparent',
                      color: isOn ? 'var(--color-accent-fg)' : 'var(--color-muted)',
                    }}
                  >
                    {sub === 'envelope' ? '外殼' : '設備'}
                  </button>
                );
              })}
            </div>
            {step3Sub === 'envelope' ? (
              <EnvelopeSettingsPanel
                lang={props.lang}
                selectedWall={props.selectedWall}
                onWallChange={props.onWallChange}
                selectedRoof={props.selectedRoof}
                onRoofChange={props.onRoofChange}
                selectedShading={props.selectedShading}
                onShadingChange={props.onShadingChange}
                selectedGlazing={props.selectedGlazing}
                onGlazingChange={props.onGlazingChange}
              />
            ) : (
              <MEPSettingsPanel
                lang={props.lang}
                selectedHVAC={props.selectedHVAC}
                onHVACChange={props.onHVACChange}
                selectedLighting={props.selectedLighting}
                onLightingChange={props.onLightingChange}
                selectedElevator={props.selectedElevator}
                onElevatorChange={props.onElevatorChange}
                selectedDHW={props.selectedDHW}
                onDHWChange={props.onDHWChange}
                elevatorCount={props.elevatorCount}
                onElevatorCountChange={props.onElevatorCountChange}
              />
            )}
          </div>
        )}
        {active === 4 && (
          <div className="space-y-3">
            <GeometryCalculationsPanel
              objects={props.objects}
              floors={props.floorsForCalc}
              lang={props.lang}
              selectedShading={props.selectedShading}
            />
            <CalculationBreakdownPanel kpis={props.kpis} lang={props.lang} />
          </div>
        )}
        {active === 5 && (
          <ScenariosView
            lang={props.lang}
            baseline={props.baseline}
            objects={props.objects}
            kpis={props.kpis}
            scenarios={props.scenarios}
            onScenariosChange={props.onScenariosChange}
            selectedScenarioId={props.selectedScenarioId}
            onSelectScenario={props.onSelectScenario}
            activeScenarioResults={props.activeScenarioResults}
          />
        )}
      </div>

      {/* Footer: Next */}
      <div
        className="flex justify-end p-3 border-t"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoNext}
          className="px-4 py-1.5 rounded text-xs font-bold transition-opacity"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            opacity: canGoNext ? 1 : 0.4,
            cursor: canGoNext ? 'pointer' : 'not-allowed',
          }}
        >
          下一步 →
        </button>
      </div>
    </div>
  );
};

export default StepWizard;
```

- [ ] **3.2 — 驗證**

```bash
npx tsc --noEmit 2>&1 | grep -v "GeometryControlPanel\|ThreeDViewer.tsx(932\|ThreeDViewer.tsx(2188\|lib/calc" | head
```

預期：empty。

- [ ] **3.3 — Self-review**

- 5 個 step content 都對到正確元件
- STEP 3 預設 sub = envelope；switch 即時生效
- 「下一步」在 STEP 5 disabled
- 所有 panel props 名稱跟現有元件 interface 對得起來（subagent 要實際開那些 panel 檔案 cross-check）
- 沒引入新的 hard-coded slate-* / blue-* 顏色（PR-B 階段以 `var(--color-*)` 為主；panel 內部既有色塊保留）

---

## Task 4：App.tsx wire-in

**Files:**
- Modify: `App.tsx` flag-on 分支（不動其他地方）

### 前置 grep（驗證 state 變數名）

```bash
# 一次列出 Task 4.2 會用到的所有 setter/state 是否存在於 App.tsx
grep -nE "setBaseline|selectedRegion|selectedUseCategory|setSelectedFloorId|setSelectedShapeId|handleEnterTopViewEdit|setSelectedWall|setSelectedRoof|setSelectedShading|setSelectedGlazing|setSelectedHVAC|setSelectedLighting|setSelectedElevator|setSelectedDHW|elevatorCount|setElevatorCount|floorsForCalc|kpis|scenarios|setScenarios|selectedScenarioId|setSelectedScenarioId|activeScenarioResults|activeProjectId" /Users/yuhueisheng/Projects/antigravity/bern5/App.tsx | head -40
```

如果某個名稱不存在 → 在 4.2 用實際名稱替換（不要假設）。最常見差異：`floorsForCalc` 可能直接是 `floors`；`activeScenarioResults` 可能要從 `useMemo` 結果取。

### Steps

- [ ] **4.1 — 改 import**

加進 imports 區塊：
```tsx
import StepWizard from './components/workspace/StepWizard';
```

（`ReportView` 已 import）

- [ ] **4.2 — 改 flag-on 分支**

找到 PR-A 加的：
```tsx
  if (USE_NEW_SHELL) {
    return (
      <WorkspaceShell
        projectName={baseline.name}
        onLogout={handleBackToDashboard}
      />
    );
  }
```

改成：
```tsx
  if (USE_NEW_SHELL) {
    return (
      <WorkspaceShell
        projectName={baseline.name}
        onLogout={handleBackToDashboard}
        leftContent={
          <StepWizard
            projectId={activeProjectId ?? '__none'}
            lang={lang}
            baseline={baseline}
            onBaselineChange={setBaseline}
            selectedRegion={selectedRegion}
            onRegionChange={setSelectedRegion}
            selectedUseCategory={selectedUseCategory}
            onUseCategoryChange={setSelectedUseCategory}
            floors={floors}
            onFloorsChange={setFloors}
            selectedFloorId={selectedFloorId}
            onSelectFloor={setSelectedFloorId}
            selectedShapeId={selectedShapeId}
            onSelectShape={setSelectedShapeId}
            onEnterTopView={handleEnterTopViewEdit}
            selectedWall={selectedWall}        onWallChange={setSelectedWall}
            selectedRoof={selectedRoof}        onRoofChange={setSelectedRoof}
            selectedShading={selectedShading}  onShadingChange={setSelectedShading}
            selectedGlazing={selectedGlazing}  onGlazingChange={setSelectedGlazing}
            selectedHVAC={selectedHVAC}        onHVACChange={setSelectedHVAC}
            selectedLighting={selectedLighting} onLightingChange={setSelectedLighting}
            selectedElevator={selectedElevator} onElevatorChange={setSelectedElevator}
            selectedDHW={selectedDHW}          onDHWChange={setSelectedDHW}
            elevatorCount={elevatorCount}      onElevatorCountChange={setElevatorCount}
            objects={objects}
            floorsForCalc={floorsForCalc}
            kpis={kpis}
            scenarios={scenarios}
            onScenariosChange={setScenarios}
            selectedScenarioId={selectedScenarioId}
            onSelectScenario={setSelectedScenarioId}
            activeScenarioResults={activeScenarioResults}
          />
        }
        reportContent={<ReportView baseline={baseline} kpis={kpis} lang={lang} />}
      />
    );
  }
```

**注意事項：**
- `activeProjectId` 可能是 null（剛進 workspace）→ 用 `?? '__none'` 兜底；sessionStorage key 變成 `bern5.activeStep.__none`，重整後一樣回 step 1。
- 所有 state 變數應該都已存在於 App.tsx（用 grep 確認，不要憑空猜名）。
- TopNav 的「能效分析」「方案優化」shortcut 還沒接到 StepWizard 的 initialStep — 那是 Task 4.3 / PR-C 範圍，PR-B 暫時忽略（top nav 按鈕本身有 highlight 切換，但不會跳 STEP）。
  - 如果要在 PR-B 一起做，需要 WorkspaceShell 把 view/activeStep state 提升或讓 StepWizard 受控；那會擴大這次改動。**建議：PR-B 先不做，記成 follow-up。**

- [ ] **4.3 — 驗證**

```bash
npx tsc --noEmit 2>&1 | grep -v "GeometryControlPanel\|ThreeDViewer.tsx(932\|ThreeDViewer.tsx(2188\|lib/calc" | head -20
```

預期：empty。如有 error，最常見的是 prop 名稱拼錯、state 變數不存在；逐個對照 grep 結果修正。

- [ ] **4.4 — Self-review**

- 既有 workspace JSX 仍在（line ~370 後）
- flag-OFF 完全沒變
- 沒移除任何既有的 imports
- 沒打到登入/Dashboard/Account/Overview 路徑

---

## Task 5：Smoke checklist（Claude Preview 自動跑）

啟動 dev 應已在跑（PR-A 已跑起）。Controller 用 `mcp__Claude_Preview__*` 跑下列：

- [ ] Flag OFF → 舊 UI 正常（看截圖：有深色 header、舊 panel）
- [ ] Flag ON → 新 shell；STEP 1 顯示 ProjectSettingsPanel
- [ ] 點 tab 2 → FloorManagerPanel（看到樓層列表）
- [ ] 點 tab 3 → 看到「外殼/設備」sub-tab；預設外殼→EnvelopeSettings；點「設備」→MEPSettings
- [ ] 點 tab 4 → GeometryCalculations + CalculationBreakdown 上下堆疊
- [ ] 點 tab 5 → ScenariosView（Measures 卡片 + 排名表 + Scenarios 欄）
- [ ] STEP 5 時「下一步」按鈕 disabled
- [ ] STEP 1-4 時「下一步」按一下 active step +1
- [ ] 重新整理瀏覽器 → activeStep 保留（同專案 sessionStorage）
- [ ] 換不同專案 → activeStep 歸 1
- [ ] tab 切換時 console 無 error
- [ ] 切到 TopNav「計算報告」→ ReportView 顯示；切回「參數設定」→ 回 StepWizard

任何一項失敗 → 記下並 dispatch fix subagent。

---

## 後續預告（不在本 plan 範圍）

| PR | 內容 |
|---|---|
| **PR-B follow-ups** | (1) TopNav「能效分析」「方案優化」shortcut 真的跳 STEP 4/5（需要 WorkspaceShell 提升 activeStep 或 StepWizard 受控）；(2) ThemeSwitcher dropdown a11y（Escape / 點外部關閉 / 鍵盤）|
| **PR-C** | LayerPanel + ThreeDViewer `layerVisibility` prop；把 DrawingToolbar+ThreeDViewer 包成 `rightContent` 傳入 |
| **PR-D** | App.tsx 舊 UI JSX 全砍掉 / sed slate→var token / 翻 flag default / 移除 flag |
