# BERN3 模組說明（Module Specification）

## 1. 模組清單

### M1. 認證與帳號管理（Auth & IAM）
- 功能：登入、角色授權（SYS_ADMIN / AGENCY_USER / VENDOR_USER）、帳號啟停。
- 對應畫面：`LoginPage`、`AccountManagement`。
- 主要 API：`/auth/*`、`/users/*`。

### M2. 專案入口與管理（Project Portal）
- 功能：專案建立、查詢、狀態管理、專案成員權限。
- 對應畫面：`ProjectDashboard`、`ProjectCard`、`CreateProjectModal`。
- 主要 API：`/projects`、`/projects/{id}`、`/projects/{id}/members`（建議新增）。

### M3. 基線設定（Baseline Configuration）
- 功能：建築用途、地區 UR、免評估面積、Envelope、MEP 參數。
- 對應畫面：`ProjectSettingsPanel`、`EnvelopeSettingsPanel`、`MEPSettingsPanel`、`ParameterSettingsPanel`。
- 主要 API：`/projects/{id}/baseline`。

### M4. 幾何建模與指標（Geometry & Metrics）
- 功能：3D 幾何輸入、朝向與 WWR、外殼面積與遮陽比分析。
- 對應畫面：`ThreeDViewer`、`GeometryControlPanel`、`GeometryCalculationsPanel`。
- 主要 API：`/projects/{id}/geometry`。

### M5. BERSn 計算核心（Calculation Core）
- 功能：EEV、EAC/EL/Et/EHW、EEI、SCOREee、grade、EUI 尺標。
- 現況程式：`services/calculationEngine.ts`（UI 實際使用）、`lib/calc/engine.ts`（較完整設計）。
- 目標：以 Python service 化，Node.js 僅做流程封裝。
- 主要 API：`/projects/{id}/calculate`、`/projects/{id}/calculations`。

### M6. 優化模擬（Optimization & Scenario）
- 功能：措施適用性、成本估算、CP 值排序、方案模擬。
- 現況程式：`services/optimizationEngine.ts`、`constants.ts`（measure library）。
- 主要 API：`/reference/measures`、`/projects/{id}/scenarios/*`。

### M7. 報告產出（Reporting）
- 功能：計算書、審查報表、PDF 匯出。
- 對應畫面：`ReportView`。
- 主要 API：`/projects/{id}/reports`。

### M8. 參數字典與版本治理（Reference & Governance）
- 功能：BERSn 表格（regions/use/hvac/lighting/...）管理、版本化、套版更新。
- 現況資料：`data/bersn_tables/*.json`。
- 主要 API：`/reference/*`（唯讀）、`/admin/reference/*`（建議新增管理端）。

### M9. 稽核與追蹤（Audit & Observability）
- 功能：操作留痕、計算任務追蹤、錯誤監控。
- 主要資料表：`audit_logs`、`calculation_runs`。
- 建議整合：結構化日誌 + Trace ID。

## 2. 模組依賴

```text
Auth/IAM
  ├─ Project Portal
  │   ├─ Baseline Configuration
  │   ├─ Geometry & Metrics
  │   ├─ Calculation Core
  │   │   ├─ Optimization & Scenario
  │   │   └─ Reporting
  │   └─ Audit & Observability
  └─ Reference & Governance
```

## 3. 建議責任邊界
- React：輸入、視覺化、互動、狀態管理。
- Node.js API：身分授權、流程編排、持久化、審計。
- Python Engine：純計算與公式版本管理。
- PostgreSQL：主資料、參數、履歷、審計。

## 4. 優先開發順序
1. M1 + M2（登入與專案 CRUD）
2. M3 + M4（基線與幾何持久化）
3. M5（計算 API）
4. M6（優化模擬）
5. M7 + M9（報表與治理）
