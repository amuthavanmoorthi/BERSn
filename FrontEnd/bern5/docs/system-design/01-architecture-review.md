# BERN3 系統架構盤點與目標架構

## 1. 現況架構（As-Is）

### 1.1 技術與部署型態
- 前端：`React 19 + Vite + TypeScript`
- 3D 與圖表：`three`、`recharts`
- 部署：單一前端應用（SPA）
- 後端 API：目前未實作
- 資料庫：目前未實作（專案與帳號使用前端記憶體樣本資料）

### 1.2 目前模組分布（程式碼）
- UI 與流程：`/App.tsx`、`/components/*`
- 計算引擎（實際使用）：`/services/calculationEngine.ts`
- 優化引擎：`/services/optimizationEngine.ts`
- 參數表：`/data/bersn_tables/*.json`
- 型別定義：`/types.ts`、`/types/project.ts`、`/types/user.ts`

### 1.3 關鍵觀察
- `ProjectDashboard`、`AccountManagement` 使用 `SAMPLE_PROJECTS`、`SAMPLE_USERS`（記憶體資料）。
- 目前尚未看到 `fetch/axios` 對外 API 呼叫，表示未接後端。
- `lib/calc/*` 為較完整計算模組，但未接入 UI 主流程（主流程使用 `services/*`）。
- 資料治理（版本、審計、歷史追蹤）在現況尚未落地。

## 2. 建議目標架構（To-Be）

## 2.1 三層式架構

```text
[Client SPA: React]
    ↓ HTTPS (JWT)
[Node.js API/BFF]
    ├─ 業務流程、權限、審計、專案管理
    ├─ 讀寫 PostgreSQL
    └─ 呼叫 Python 計算服務
            ↓
      [Python Calculation Service]
      - BERSn 計算
      - 情境模擬 / 敏感度分析

[PostgreSQL]
- 主檔（user/project）
- 參數表（BERSn lookup）
- 計算結果與履歷
- 報表與審計紀錄
```

## 2.2 服務切分
- Web/App Layer：React 前端（專案管理、配置、可視化、報告）
- API Layer：Node.js（Auth/RBAC、Project CRUD、Scenario CRUD、Report、Audit）
- Compute Layer：Python（EEI、SCOREee、EUI 尺標、最佳化模擬）
- Data Layer：PostgreSQL + 物件儲存（報表檔）

## 2.3 主要資料流
1. 使用者登入取得 JWT。
2. 建立專案並儲存基線參數、幾何、MEP 資料。
3. 前端呼叫 `POST /projects/{id}/calculate`。
4. Node.js 組裝計算輸入，呼叫 Python 引擎。
5. Python 回傳 `EEI/SCOREee/grade + breakdown`。
6. Node.js 寫入 `calculation_runs` 與 `calculation_results`。
7. 前端顯示結果並可儲存情境方案與報表。

## 3. 分階段落地建議

### Phase 1（最小可用）
- 上線 Node.js API + PostgreSQL。
- 完成 Auth、Project、Baseline、Geometry、Calculate API。
- 將現有前端 `SAMPLE_*` 改為 API 資料源。

### Phase 2（可營運）
- Scenario/Measure 模組、計算歷史、報表匯出。
- 權限模型（SYS_ADMIN / AGENCY_USER / VENDOR_USER）後端化。
- Audit log、參數版本化。

### Phase 3（可治理）
- 計算引擎服務化（Python）與版本治理。
- 引入 Queue（長計算任務）、告警、作業追蹤。
- 效能測試與資安檢測。
