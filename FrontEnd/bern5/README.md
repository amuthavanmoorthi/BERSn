# Bern02 - 整合版 BERSn 建築能效分析平台

**Integrated Building Energy Analysis Platform v1.0**

一個整合了 BERSn-Pro Platform UI 和計算引擎的統一專案。

## 🚀 快速開始

```bash
cd FrontEnd/bern5
npm install
npm run dev
```

伺服器將在 http://localhost:5173 啟動

## 📁 專案結構

```
FrontEnd/bern5/
├── App.tsx                 # 主應用程式
├── components/
│   ├── CalculationBreakdownPanel.tsx  # 9步計算過程面板 ⭐
│   ├── ThreeDViewer.tsx    # 3D 建築視圖
│   └── ReportView.tsx      # 報告生成
├── services/
│   ├── calculationEngine.ts  # BERSn 計算引擎
│   └── optimizationEngine.ts # 優化分析
├── lib/calc/               # 進階計算模組
│   ├── engine.ts           # 完整 BERSn 公式
│   └── tables.ts           # 資料表載入器
├── data/bersn_tables/      # 12個 JSON 查詢表
│   ├── regions.json        # 氣候區 UR 係數
│   ├── use_categories.json # 建築用途類別
│   ├── constructions.json  # 構造組件 U值
│   ├── glazing_types.json  # 玻璃 U/SHGC
│   ├── shading_types.json  # 遮陽 Ki 係數
│   ├── hvac_systems.json   # 空調 EAC
│   ├── lighting_systems.json # 照明 EL
│   ├── elevator_tables.json  # 昇降機 Eelj/YOHj
│   ├── dhw_systems.json    # 熱水 EHW
│   ├── measures.json       # 優化措施庫
│   └── grade_thresholds.json # 等級門檻
├── constants.ts            # 常數定義
├── types.ts                # TypeScript 類型
└── translations.ts         # 中英文翻譯
```

## ✨ 主要功能

### 1. 計算過程面板 (新增)
在「能效分析」頁面左側顯示 9 步詳細計算過程：
- 有效冷房面積 (AFe)
- 外殼效率 (EEV)
- 權重係數 (a,b,c)
- 機電效率
- 能效指標 (EEI)
- 能效得分 (SCOREee)
- 能效等級
- 節能率 (ESR)
- EUI 基準尺標

### 2. 互動式 3D 建模
- Digital Twin 參數化建模器
- 即時能源通量可視化
- 可調整尺寸、WWR、玻璃類型

### 3. 優化分析
- 12+ 節能措施庫
- CP 值排序
- 多方案比較

### 4. 多語言支援
- 中文 / English 切換

## 🔧 技術棧

- **Framework**: Vite + React 19
- **3D**: Three.js
- **Charts**: Recharts
- **Language**: TypeScript

## 📊 BERSn 公式參考

```
EEI = a(EAC − EEV × Es) + b·EL + c·Et [+ d·EHW]

SCOREee = 
  if EEI ≤ 0.8: 50 + 40 × (0.8 − EEI) / 0.3
  else:         50 × (2.0 − EEI) / 1.2
```

---

**Built with ❤️ for sustainable building design**
