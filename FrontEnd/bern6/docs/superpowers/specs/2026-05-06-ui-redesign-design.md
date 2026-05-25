# UI 改版設計 — STEP wizard + 圖層 + 可換主題

**日期**：2026-05-06
**狀態**：Approved (pending spec review)
**參考 mockup**：客戶提供的手繪 UI 圖（BERSN-Pro v5.3.2 介面範例）

---

## 1. 目標

把目前散落在多個 panel 的工作流，整合成「左側 STEP wizard（1→5）＋ 圖層面板，右側繪圖/3D」的左右雙欄結構，並導入可切換的顏色主題系統。

### 範圍

- 只動 **layout + 顏色**；不改後端、不動 3D viewer 內部、不動形狀資料模型。
- 主題系統提供 4 套配色，預設「C 暖色淺底」（最接近客戶 mockup），可在頂部設定切換。
- 全部現有功能（建模、開窗率、能源計算、報表、Dashboard）行為不變，只改容器排版與配色 token。

### 非目標（YAGNI）

- mockup 上的手繪卡通元素（雲、太陽、草地、花、塗鴉感邊框、米色卡通字體）。
- 圖層面板的 opacity slider、LOD 控制、完成度進度條。
- 「基準平面 / 能源構件 / 設備系統 / 環境分析網格 / 參考底圖」這 5 個圖層（先只做主體模型）。
- STEP 之間的鎖定（必須完成才能進下一步）、引導動畫、完成度進度條。

---

## 2. 設計決策摘要

| # | 決策 | 結論 |
|---|---|---|
| 1 | 視覺保留度 | 只取結構，不照搬手繪風 |
| 2 | STEP 順序 | 基建 → 建模 → EUI → LRV → AFE |
| 3 | STEP 5 (AFE) | 對應現有 Measures / Scenarios 模組 |
| 4 | 圖層數量 | 只做「主體模型」一列；架構保留可擴充 |
| 5 | 圖層百分比 | 純顯示 100%，無 opacity 功能 |
| 6 | Split 模式 | 1 條垂直 handle（左 dashboard ↔ 右 3D 區）|
| 7 | Top nav 角色 | STEP 1-5 為主流程；頂部「能效分析」「方案優化」是 STEP 4/5 捷徑；「計算報告」獨立頁 |
| 8 | 配色 | C（暖色淺底）為預設；設定可切換 A/B/C/D |
| 9 | STEP 3 子結構 | Envelope / MEP 用 sub-tab |
| 10 | 「下一步」按鈕行為 | 只切 active step，不引導、不聚焦 3D |
| 11 | 自由切換 | 可隨意點任何 tab，不擋未填欄位 |
| 12 | 持久化 | activeStep → sessionStorage；theme/splitWidth → localStorage |

---

## 3. 架構

### 3.1 元件樹

```
App
└─ Workspace (activeProjectId != null)
   └─ WorkspaceShell
      ├─ TopNav
      │   ├─ Brand / Project name
      │   ├─ Nav buttons: 參數設定 | 能效分析 | 方案優化 | 計算報告
      │   ├─ ThemeSwitcher  (A/B/C/D)
      │   └─ LogoutButton
      │
      ├─ view='workspace'
      │   └─ SplitPane (left ↔ right, draggable)
      │       ├─ LeftPane
      │       │   ├─ StepWizard
      │       │   │   ├─ Tabs: 1·基建 2·建模 3·EUI 4·LRV 5·AFE
      │       │   │   └─ StepContent
      │       │   │      ├─ STEP 1 → <ProjectSettingsPanel/>
      │       │   │      ├─ STEP 2 → <FloorManagerPanel/>
      │       │   │      ├─ STEP 3 → SubTabs(外殼 | 設備)
      │       │   │      │            ├─ <EnvelopeSettingsPanel/>
      │       │   │      │            └─ <MEPSettingsPanel/>
      │       │   │      ├─ STEP 4 → <GeometryCalculationsPanel/> + <CalculationBreakdownPanel/>
      │       │   │      └─ STEP 5 → <ScenariosView/> (抽自 App.tsx Measures+Scenarios 區塊)
      │       │   └─ LayerPanel
      │       │       └─ Row: 主體模型 (visibility toggle)
      │       │
      │       └─ RightPane
      │           ├─ DrawingToolbar (現有；改從左邊移到 SplitPane 右側起點)
      │           └─ ThreeDViewer (現有；接受新的 layerVisibility prop)
      │
      └─ view='report'
          └─ <ReportView/> (full-screen, 現有元件)
```

### 3.2 新增檔案

| 路徑 | 用途 |
|---|---|
| `components/workspace/WorkspaceShell.tsx` | workspace 外殼，管 view='workspace'\|'report' |
| `components/workspace/TopNav.tsx` | 4 按鈕 + 主題切換 + 登出 |
| `components/workspace/SplitPane.tsx` | 左右拖曳分隔（含 width 記憶）|
| `components/workspace/StepWizard.tsx` | 5 tabs + active step 渲染 + 「下一步」按鈕 |
| `components/workspace/LayerPanel.tsx` | 圖層面板 |
| `components/workspace/AnalysisView.tsx` | (shortcut shim) `<StepWizard initialStep={4}/>` 包一層 |
| `components/workspace/ScenariosView.tsx` | (shortcut shim) `<StepWizard initialStep={5}/>` 包一層 |
| `components/workspace/ThemeSwitcher.tsx` | dropdown for A/B/C/D |
| `hooks/useTheme.ts` | theme state + 寫 `data-theme` + localStorage |
| `hooks/useSplitPaneWidth.ts` | split 寬度 state + localStorage clamp |
| `hooks/useActiveStep.ts` | active step + sessionStorage（依 projectId 區分 key）|
| `styles/themes.css` | 4 套 palette CSS variable |

### 3.3 既有檔案修改

| 路徑 | 改什麼 | 幅度 |
|---|---|---|
| `App.tsx` | workspace 區段換成 `<WorkspaceShell/>`；抽出 Scenarios 區塊到 `ScenariosView` | 中 |
| `index.html` | 引入 `styles/themes.css`；`<html data-theme="c">` | 1 行 |
| `components/ThreeDViewer.tsx` | 新增 prop `layerVisibility: { mainModel: boolean }`，套到 shape group `.visible` | 小 |
| 所有 panel 元件 | 把 hard-coded `bg-slate-900`/`text-slate-300`/`bg-blue-600` 等替換成 `var(--color-*)` token（透過 inline class 或在 themes.css 補 utility）| 中（sed 批改）|
| `components/FloorManagerPanel` | **保留功能**。但若內部已有外層 panel frame（背景、邊框、標題列），改用 StepWizard 提供的容器，避免雙層 frame | 小 |

### 3.4 保留完全不動

- 後端 `server/**`
- `components/ThreeDViewer.tsx` 的繪圖、snap、移動、拖曳、形狀渲染邏輯
- `components/drawing/**`
- `services/**`, `hooks/useDrawingTool.ts` 等
- `types.ts`, `translations.ts`

---

## 4. 詳細元件規格

### 4.1 WorkspaceShell

**Props**：`activeProjectId: string`

**State**：
- `view: 'workspace' | 'report'` （由 TopNav 控制）
- `nextStepHint: number | undefined`（接收 nav 按下「能效分析」「方案優化」時的目標 step，傳給 StepWizard）

**行為**：
- `view === 'workspace'` → 渲染 SplitPane + StepWizard + 3D
- `view === 'report'` → 渲染 ReportView（full-screen，無 split）
- 切回 `workspace` 時清掉 `nextStepHint`

### 4.2 TopNav

**Props**：
- `activeView`
- `onViewChange(view, stepHint?)`
- `projectName`
- `onLogout()`

**布局**：
```
[BERSN-Pro][／ProjectName]      [參數設定][能效分析][方案優化][計算報告] [🎨][登出]
```

**按鈕點擊對應**：
| 按鈕 | onViewChange 參數 |
|---|---|
| 參數設定 | `('workspace', 1)` — 跳到 STEP 1 |
| 能效分析 | `('workspace', 4)` |
| 方案優化 | `('workspace', 5)` |
| 計算報告 | `('report')` |

active state 依 `(view, currentStep)` 判定。

### 4.3 SplitPane

**Props**：`left: ReactNode`, `right: ReactNode`

**內部**：
- 用 `useSplitPaneWidth()` 取得寬度
- 中間 6px wide drag handle，`cursor: col-resize`，hover 變 accent 色
- pointer down → window listeners 算 delta → clamp(240, 560) → setWidth
- 寬度寫 `style={{ width: leftWidth }}` 在左 pane；右 pane 用 `flex: 1`

### 4.4 StepWizard

**Props**：
- `initialStep?: number`（由 TopNav shortcut 傳入；預設讀 sessionStorage）
- `projectId: string`
- `floors / setFloors / baseline / setBaseline / envelope / mep ...`（透傳給內部各 STEP 元件）

**內部**：
- `activeStep`：useState，初始來自 `initialStep ?? readSessionStorage(key) ?? 1`
- `key = bern5.activeStep.${projectId}` → 換專案自動歸 1
- 監聽 `initialStep` prop 變動（由 TopNav 觸發 4/5 跳轉）
- 5 個 tab buttons，active 用 accent 底色 + 粗體
- step content 直接 switch 渲染對應元件
- 底部「下一步 →」按鈕：`setActiveStep(Math.min(5, current + 1))`，step=5 時 disabled

### 4.5 LayerPanel

**Props**：
- `layers: { mainModel: { visible: boolean } }`
  - 結構保留可擴充（未來新增 `baselinePlane`, `energyComponents`, ...）
  - 暫不放 `opacity` 欄位，避免「死資料」；未來要做時加進 type 同步打開 UI
- `onToggle(layerKey)`

**內部**：
- 單一 row：`[👁] [M] 主體模型              100%`
- 👁 hover 變 accent；toggle 後反白
- 100% 文字無互動

### 4.6 ThemeSwitcher

**Props**：`theme: 'a'|'b'|'c'|'d'`, `onChange(t)`

**內部**：
- 齒輪 icon 按鈕，點開 dropdown
- 4 個選項，hover 顯示色塊預覽
- 選擇即時更新 `data-theme`，無需重整

### 4.7 hooks

```ts
// useTheme.ts
function useTheme(): [ThemeKey, (t: ThemeKey) => void] {
  const [t, setT] = useState<ThemeKey>(() => {
    try {
      const stored = localStorage.getItem('bern5.theme');
      if (stored === 'a'||stored === 'b'||stored === 'c'||stored === 'd') return stored;
    } catch {}
    return 'c';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('bern5.theme', t); } catch {}
  }, [t]);
  return [t, setT];
}

// useSplitPaneWidth.ts → similar, clamp(240, 560), default 320
// useActiveStep.ts    → sessionStorage, default 1, key per projectId
```

### 4.8 themes.css

```css
:root {
  /* fallback = theme C */
  --color-bg:      #fffaf3;
  --color-card:    #ffffff;
  --color-border:  #f3e2c8;
  --color-text:    #3d2c1a;
  --color-muted:   #7a5a3a;
  --color-accent:  #ef5d3b;
  --color-accent-hover: #d44a28;
  --color-step-active-bg: #ffe9d6;
  --color-step-active-text: #8a3b00;
}

[data-theme='a'] { /* 暗藍 */
  --color-bg:#0f172a; --color-card:#1e293b; --color-border:#334155;
  --color-text:#e2e8f0; --color-muted:#94a3b8;
  --color-accent:#2563eb; --color-accent-hover:#1d4ed8;
  --color-step-active-bg:#1e3a8a; --color-step-active-text:#dbeafe;
}
[data-theme='b'] { /* 白藍 */
  --color-bg:#f8fafc; --color-card:#ffffff; --color-border:#e2e8f0;
  --color-text:#1e293b; --color-muted:#64748b;
  --color-accent:#2563eb; --color-accent-hover:#1d4ed8;
  --color-step-active-bg:#dbeafe; --color-step-active-text:#1e40af;
}
[data-theme='c'] { /* 暖色（同 :root，預設）*/ }
[data-theme='d'] { /* 綠能 */
  --color-bg:#f7fbf4; --color-card:#ffffff; --color-border:#d6e8d2;
  --color-text:#1f2d23; --color-muted:#5b6e60;
  --color-accent:#16a34a; --color-accent-hover:#15803d;
  --color-step-active-bg:#dcf0d1; --color-step-active-text:#15553a;
}
```

---

## 5. 資料流

```
                        ┌─ TopNav ─ themeKey ──→ <html data-theme>
                        │              ↓
WorkspaceShell ─ view ─┤              localStorage['bern5.theme']
   ('workspace'|        │
    'report')           ├─ activeStep (1..5) ──→ sessionStorage['bern5.activeStep.<projectId>']
                        │     ↑ user clicks tab / 下一步
                        │     ↑ TopNav shortcut (能效分析→4 / 方案優化→5)
                        │
                        ├─ SplitPane width ──→ localStorage['bern5.splitWidth']
                        │
                        └─ layerVisibility ──→ React state (in-memory)
                              ↓
                          ThreeDViewer (props)
                              ↓ shapeGroup.visible = layers.mainModel.visible
```

既有資料流（floors / baseline / envelope / mep）完全不變，仍走 PR3/PR4 已建立的 IndexedDB→API 路徑。

---

## 6. 錯誤處理

| 失敗點 | 行為 |
|---|---|
| `localStorage` 不可用 | catch → in-memory fallback；不報錯 |
| `sessionStorage` 不可用 | activeStep 每次回 1；不報錯 |
| Theme key 異常 | 不在 `'a'\|'b'\|'c'\|'d'` → fallback `'c'` |
| Split width 異常 | `clamp(240, 560)` |
| ReportView 無資料 | 元件本身已有 empty state |
| Nav shortcut 到 STEP 4/5 但前置資料缺 | 自由切換不擋；各 STEP 元件自己處理 empty |

---

## 7. 測試（manual smoke checklist）

- [ ] 進專案 → 預設 STEP 1 + theme C
- [ ] Tab 1→2→3→4→5 自由切換無錯
- [ ] 「下一步」累進，STEP 5 時 disabled
- [ ] 重整：theme / splitWidth / activeStep 保留
- [ ] 換不同專案：activeStep 歸 1
- [ ] TopNav「能效分析」跳 STEP 4；「方案優化」跳 STEP 5
- [ ] TopNav「計算報告」進 full-screen ReportView；點「參數設定」回得來
- [ ] Theme A/B/C/D 即時切換，無需重整
- [ ] Split handle 240–560 clamp；最小寬時 dashboard 仍能用
- [ ] LAYER 主體模型 👁 toggle → 3D shapes 隱藏/顯示
- [ ] STEP 3 內 Envelope/MEP sub-tab 切換
- [ ] STEP 2 動 floor 仍正常 debounced save 進 SQLite（迴歸）

---

## 8. 出貨切割

| PR | 範圍 | 大小 |
|---|---|---|
| **PR-A** | WorkspaceShell + SplitPane + TopNav（殼 + 「TODO」內容）+ themes.css + ThemeSwitcher + useTheme/useSplitPaneWidth | 中 |
| **PR-B** | StepWizard + useActiveStep + 接通 5 個現有 panel + STEP 3 sub-tab + 「下一步」按鈕 | 中 |
| **PR-C** | LayerPanel + ThreeDViewer layerVisibility prop + AnalysisView/ScenariosView shortcut shim | 小 |
| **PR-D** | 配色 token 大規模 sed（slate-* / blue-* → `var(--color-*)`）+ smoke checklist 跑完 | 中 |

每個 PR 都能獨立運行（前一個交付後系統仍可用）。

---

## 9. Open questions

無 — 全部澄清完畢。
