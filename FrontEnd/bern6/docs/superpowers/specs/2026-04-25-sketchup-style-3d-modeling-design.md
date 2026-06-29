# SketchUp 風格的 3D 建模介面 — 設計文件

**日期**：2026-04-25
**狀態**：Design approved, pending implementation plan
**範圍**：`components/ThreeDViewer.tsx` 與相關新元件

---

## 1. 背景與目標

目前 BERSn-Pro 的 3D 建模流程是：

- **3D 視窗 (ThreeDViewer)**：唯讀預覽，無法直接在裡面建模。
- **右側 FloorManagerPanel**：以表單方式輸入 width / length / radius 等參數新增形狀。
- **TopViewCanvas**：另開的全螢幕 2D 俯視畫布，目前只有 polyline 走這條路徑。

使用者希望改成 **SketchUp 風格** 的工作流：

1. 左側工具列選工具（矩形、圓、polyline 等）。
2. 直接在 3D 透視視窗裡畫圖（不彈出新介面）。
3. 畫完輸入擠出高度，直接成形。
4. 右側既有的 FloorManagerPanel 改成可手動隱藏的側邊欄。

## 2. 需求釐清結論

| # | 議題 | 決議 |
|---|---|---|
| Q1 | 畫圖發生在哪個畫布 | **B** — 直接在 3D 透視視窗裡畫（raycast 投影到地面） |
| Q2 | 新形狀屬於哪個樓層 | **A** — 寫入「目前選取的活動樓層」 |
| Q3 | 工具列收錄範圍 | **B** — 完整版（10+ 個工具，所有形狀都能視覺化建立） |
| Q4 | 擠出高度輸入方式 | **A** — 沿用 ExtrudeHeightDialog 彈窗 |
| Q5 | FloorManagerPanel 隱藏行為 | **A** — 顯式 toggle 按鈕，預設展開 |
| Q6 | 3D 中畫圖的相機行為 | **C** — 自由視角，提供「鎖定俯視」按鈕 |
| Q7 | 繪製輔助 | **A** — 完整：地面網格 + snap + 座標 HUD + 邊長 tooltip |

## 3. 架構決策

採用 **方向 1**：把繪製功能掛在現有 ThreeDViewer 內，不重構 ThreeDViewer 本體。
新增程式碼集中在 `components/drawing/` 與 `hooks/`，ThreeDViewer 只新增 hook 呼叫與 preview group 渲染（預估 +80 行）。

不採用：
- 方向 2（拆 ThreeDViewer 成多個 hook）— 範圍超出本次需求。
- 方向 3（疊一層獨立 overlay scene）— 雙 scene 同步相機與互動穿透更複雜。

## 4. 檔案結構

新增 / 改動：

```
components/
  ThreeDViewer.tsx               # 改：+useDrawingTool 呼叫, +preview group, +toolbar mount
  drawing/
    DrawingToolbar.tsx           # 新：左側懸浮工具列
    ExtrudeHeightDialog.tsx      # 新：從 TopViewCanvas 抽出共用
    DrawingHUD.tsx               # 新：右下角座標 / 邊長 / 鎖定俯視按鈕
  hooks/
    useDrawingTool.ts            # 新：繪製狀態機 + pointer event 處理 + commit
    useGroundRaycaster.ts        # 新：螢幕座標 → 地面世界座標 + snap

App.tsx                          # 改：傳入 onFloorsChange 給 ThreeDViewer（已有）
```

## 5. 工具列規格

懸浮在 3D 畫布**左側**，深色半透明圓角，icon-only + tooltip。

```
[🔍] 縮放/平移 (預設模式)
─────
[↖]  選取
─────  ← 形狀工具
[▭]  矩形    (box)
[○]  圓      (cylinder)
[⬡]  正多邊形 (polygon)
[ᒪ]  L 形
[⊥]  T 形
[◗]  弧
[⬭]  橢圓
[◔]  扇形
[~]  Polyline
─────  ← 變換工具
[✥]  移動
[↻]  旋轉
[🗑]  刪除
─────  ← 視圖
[⬇]  鎖定俯視 (toggle)
```

模式切換規則：
- 點工具 → `currentTool` 更新 → 游標改 crosshair
- 按 `Esc` 或再次點同工具 → 回 `pan` 模式
- 形狀工具進行中按 `Esc` → 取消當前繪製、保留工具

## 6. 繪製互動細節

### 6.1 地面投影

- 所有形狀工具用 `THREE.Raycaster` 把滑鼠位置投到 y=0 平面。
- 取得世界座標後依 `snapToGrid` 設定吸附到網格。

### 6.2 形狀工具表

每種形狀畫完都彈 `ExtrudeHeightDialog` 輸入高度，commit 後寫入 `floor.shapes[]` 並同步 `floor.floorHeight`。

| 工具 | 互動序列 | 寫入 params |
|---|---|---|
| 矩形 | click 起點 → cursor 預覽矩形 → click 終點 | `width, length` ；`position` = 中心 |
| 圓 | click 圓心 → cursor 預覽圓 → click 設半徑 | `radius` |
| 正多邊形 | 同圓；dialog 加問邊數 (預設 6) | `sides, circumradius` |
| L 形 | click 角 → cursor 預覽 → click 對角 → dialog 問 L2/W2 + 方向 | `l1,w1,l2,w2,direction` |
| T 形 | 同 L | `l1,w1,l2,w2,wingPos` |
| 弧 | click 圓心 → click 起始邊 → cursor 預覽角度 → click 確認 | `arcRadius, arcAngle, depth` |
| 橢圓 | click 中心 → 拖長軸方向 → click → 拖短軸 → click | `majorRadius, minorRadius` |
| 扇形 | 同弧；dialog 加問內半徑 | `innerRadius, outerRadius, fanAngle` |
| Polyline | click N 次 → 雙擊或回起點閉合 → dialog | `points, isClosed, extrudeHeight` |

### 6.3 變換工具

| 工具 | 互動 |
|---|---|
| 選取 | hover 高亮、click 選取（沿用 `selectedShapeId`）、Del 刪除 |
| 移動 | 點 shape → 拖拉改 `position.x/y`（y=0 固定）；Shift 鎖軸 |
| 旋轉 | 點 shape → 顯示旋轉環 gizmo → 拖拉改 `rotation`（度） |
| 刪除 | 點 shape 即從 `floor.shapes[]` 移除 |

### 6.4 邊界情況

- **沒有 active floor**：點任何形狀工具顯示 toast「請先在右側面板選一個樓層」並維持 pan 模式。
- **Esc 鍵**：一律回 pan 模式 + 清掉所有預覽。
- **工具切換**：未完成的繪製狀態 reset。

## 7. 資料整合

### 7.1 狀態機 (useDrawingTool)

```ts
type DrawingState =
  | { kind: 'idle' }
  | { kind: 'placing', tool: ShapeTool, points: Vec2[], cursor: Vec2 }
  | { kind: 'awaiting-extrude', tool: ShapeTool, params: Partial<ShapeParams> }
  | { kind: 'transforming', mode: 'move'|'rotate', shapeId: string, start: Vec2 };
```

### 7.2 預覽 mesh

ThreeDViewer 新增 `previewGroupRef: THREE.Group` 掛在 scene 下：

- `state.kind === 'placing'` 時依工具與 `cursor` 重建半透明預覽（藍色 0x3b82f6, opacity 0.3）。
- 其他狀態清空。
- 預覽 group 與主要 floors useEffect 互不干擾。

### 7.3 寫入 floors

形狀工具完成 dialog →

```ts
onFloorsChange(floors.map(f =>
  f.id === activeFloorId
    ? { ...f, shapes: [...f.shapes, newShape], floorHeight: extH }
    : f
));
```

延續上一輪修改的「extrudeHeight ↔ floorHeight 連動」邏輯：所有形狀的 dialog 都同步更新 `floor.floorHeight`，符合「一棟一個高度」的使用者直覺。

移動 / 旋轉直接 patch `shape.position` / `shape.rotation`，與右側面板輸入等價。

### 7.4 active floor 來源

沿用既有 `selectedFloorId`（同時兼「選取焦點」與「活動樓層」），不引入第三個 state。
無 `selectedFloorId` 時禁用形狀工具。

## 8. 繪製輔助 (HUD)

### 8.1 地面網格

- `THREE.GridHelper(200, 100, 0xcccccc, 0xeeeeee)` 永遠顯示。
- 鎖定俯視時可加密。

### 8.2 Snap

- ThreeDViewer 自帶 `snapToGrid` state（不共用 TopViewCanvas）。
- 沿用 TopViewCanvas 的 `GRID_OPTIONS` 數值，避免兩處不一致。

### 8.3 右下角 HUD (DrawingHUD 元件)

```
X: 12.3  Y: -5.2 m
[繪製中] 邊長: 8.4 m
```

- 永遠顯示游標當前世界座標。
- 繪製中加顯示當前邊長 / 半徑 / 角度（依工具）。
- 同元件內含「鎖定俯視」toggle 按鈕。

### 8.4 鎖定俯視

- 切到 `THREE.OrthographicCamera` + lookAt(0, totalHeight/2, 0)。
- OrbitControls `enableRotate = false`。
- 解除時還原成原本 PerspectiveCamera（保存解除前的位置 / target）。

## 9. FloorManagerPanel 隱藏

- 沿用既有 `showFloorPanel` state（已存在於 App.tsx）。
- 把 toggle 按鈕做得更明顯：右上角加一個固定的箭頭按鈕，預設展開狀態。
- Drawing toolbar 與 FloorManagerPanel 互不耦合，可獨立顯隱。

## 10. 不在本次範圍內

- 推拉 (Push/Pull) 工具（已決議走 dialog）。
- 自動樓層切換（畫圖時手動切活動樓層）。
- 自動樓層生成（一筆畫一層）。
- 高級 SketchUp 功能：軸鎖定、推論線、面分割、群組 / Component。
- ThreeDViewer 拆分重構（方向 2）。
- 透視畫面下的精確 3D gizmo 庫（移動 / 旋轉用簡單滑鼠拖拉，無 axis arrow handles）。

## 11. 風險與已知限制

- **透視視角下 raycast 投影**：游標愈靠近 horizon 投影距離急劇放大，可能畫出超大形狀。緩解：限制 raycast hit 距離（例如 < 500 m）。
- **預覽 mesh 效能**：每次滑鼠移動都重建 geometry。緩解：throttle 到 ~60fps，或對複雜工具改用 LineSegments 預覽。
- **OrbitControls 與繪製事件衝突**：繪製模式時暫停 OrbitControls 的左鍵 pan / rotate。
- **既有 polyline 流程衝突**：`TopViewCanvas` 的 polyline 路徑暫時保留，後續可考慮收斂到 3D toolbar。

## 12. 驗收標準

- [ ] 12 個工具按鈕全部可點，icon + tooltip 顯示正確。
- [ ] 9 個形狀工具皆可在 3D 畫布完成繪製、彈 dialog、寫入 active floor。
- [ ] 移動 / 旋轉 / 刪除可作用於既有 shape，floors 資料正確更新。
- [ ] Snap 啟用時座標吸附網格；HUD 顯示游標座標 + 繪製中邊長。
- [ ] 鎖定俯視按鈕切換正交相機，再點還原。
- [ ] FloorManagerPanel toggle 按鈕清楚可見、收合 / 展開正確。
- [ ] 沒有 active floor 時點形狀工具顯示 toast 提示。
- [ ] Esc 取消當前繪製。
- [ ] extrudeHeight 與 floorHeight 連動，3D 樓層堆疊不會脫節。
