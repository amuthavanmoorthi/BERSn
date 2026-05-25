
import React, { useState, useMemo, useEffect } from 'react';
import {
  BuildingCategory, ProjectBaseline, GeometryObject, GeometryType,
  GlassType, ShadingType, HVACMode, GeographicRegion, Measure, Scenario,
  Floor, FloorShape
} from './types';
import { REGION_UR_MAP, MEASURE_LIBRARY } from './constants';
import { calculateKPIs } from './services/calculationEngine';
import { floorUnionArea } from './services/areaUnion';
import { useUndoableState } from './hooks/useUndoableState';
import { saveProjectFloors, loadProjectFloors } from './services/projectStorage';
import { simulateMeasure, simulateScenario } from './services/optimizationEngine';
import { translations } from './translations';
import ThreeDViewer from './components/ThreeDViewer';
import ReportView from './components/ReportView';
import CalculationBreakdownPanel from './components/CalculationBreakdownPanel';
import FloorManagerPanel from './components/FloorManagerPanel';
import ProjectSettingsPanel from './components/ProjectSettingsPanel';
import EnvelopeSettingsPanel from './components/EnvelopeSettingsPanel';
import MEPSettingsPanel from './components/MEPSettingsPanel';
import GeometryCalculationsPanel from './components/GeometryCalculationsPanel';
import ProjectDashboard from './components/ProjectDashboard';
import AccountManagement from './components/AccountManagement';
import DashboardOverview from './components/DashboardOverview';
import LoginPage from './components/LoginPage';
import WorkspaceShell from './components/workspace/WorkspaceShell';
import StepWizard from './components/workspace/StepWizard';
import ScenariosView from './components/workspace/ScenariosView';
import { useActiveStep } from './hooks/useActiveStep';
import type { LayerVisibility, LayerKey } from './components/workspace/LayerPanel';
import { DEFAULT_CALC_EXTRAS, type CalcExtras } from './components/workspace/CalcExtraFields';

// Feature flag — new workspace shell. Default is ON.
// Opt OUT (legacy UI) via DevTools:
//   localStorage.setItem('bern5.useNewShell','0'); location.reload()
// Opt back IN (or remove override):
//   localStorage.removeItem('bern5.useNewShell'); location.reload()
// Read at module load so the value is stable across renders.
const USE_NEW_SHELL: boolean = (() => {
  try {
    const v = localStorage.getItem('bern5.useNewShell');
    return v !== '0';  // null (no override) → true; '0' → legacy
  } catch { return true; }
})();
import { UseCategoryId, bersnGlazingToCategorical, bersnShadingToCategorical } from './data/bersnConfig';
import { login as authApiLogin } from './services/authApi';
import { useSession } from './context/SessionContext';

const GLASS_PERFORMANCE: Record<GlassType, { u: number, eta: number }> = {
  'Single': { u: 5.8, eta: 0.85 }, 'Double': { u: 2.8, eta: 0.70 }, 'Triple-LowE': { u: 1.2, eta: 0.45 }, 'Vacuum': { u: 0.7, eta: 0.35 }
};
const SHADING_PERFORMANCE: Record<ShadingType, number> = {
  'None': 1.0, 'Horizontal': 0.8, 'Vertical': 0.85, 'Eggcrate': 0.7, 'Louver': 0.75
};

const App: React.FC = () => {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = translations[lang];

  // View state: 'login', 'dashboard', 'workspace', 'accounts', or 'overview'
  const [currentView, setCurrentView] = useState<'login' | 'dashboard' | 'workspace' | 'accounts' | 'overview'>('login');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const session = useSession();

  const [baseline, setBaseline] = useState<ProjectBaseline>({
    id: 'proj-001',
    name: '綠能大樓原型專案',
    address: '台北市信義區',
    category: BuildingCategory.OFFICE,
    region: GeographicRegion.A,
    ur: 1.0,
    hvacMode: HVACMode.YEAR_ROUND,
    intermittentChecks: { shortDepth: false, noCentralPlant: false, openableWindows: false },
    totalFloorAreaAF: 0,
    exemptAreas: [
      { id: 'ex-1', name: '地下停車場 B1-B2', reason: 'parking', area: 800 },
      { id: 'ex-2', name: '防空避難室', reason: 'shelter', area: 200 }
    ],
    envelope: {
      wallMaterial: 'RC + 隔熱板',
      wallThickness: 0.15,
      wallKValue: 0.27,
      wallUValue: 1.8,
      roofMaterial: '混凝土 + 隔熱磚',
      roofThickness: 0.2,
      roofKValue: 0.16,
      roofUValue: 0.8,
      eev: 1.0,
      shadingKi: 1.0,
      glassUValue: 2.0,
      glassEtaI: 0.6
    },
    mep: {
      hvac: { systemType: 'VRF', cop: 3.5, auxEff: 0.8, controlStrategy: 0.9, coverage: 1.0 },
      lighting: { lpd: 10.0, controlFactor: 1.0, coverage: 1.0 },
      elevator: { type: 'VVVF', effConstant: 0.6, numElevators: 4, energyPerCycle: 0.05, yearlyHours: 2500 },
      dhw: { hasDhw: false, systemType: 'None', hpc: 1.0, ehwConstant: 1.0, loadFactor: 0.7 }
    }
  });

  // ===== Floor-based Modeling State =====
  const {
    state: floors,
    setState: setFloors,
    undo: undoFloors,
    redo: redoFloors,
    canUndo: canUndoFloors,
    canRedo: canRedoFloors,
    reset: resetFloors,
  } = useUndoableState<Floor[]>([
    { id: 'floor-1', name: '1F', floorHeight: 4.5, shapes: [] },
  ]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>('floor-1');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [showFloorPanel, setShowFloorPanel] = useState(false);
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [topViewRequestSeq, setTopViewRequestSeq] = useState(0);

  const handleEnterTopViewEdit = (floorId: string) => {
    setSelectedFloorId(floorId);
    setEditingFloorId(floorId);
    setTopViewRequestSeq(s => s + 1);
  };

  // Debounced snapshot of floors used by expensive area calculations.
  // 拖拉時 floors 會高頻變動，但 GeometryCalculationsPanel 的 union 計算成本高，
  // 用 debounce 確保只在停止操作後才重算（避免每幀重算造成卡頓）。
  const [floorsForCalc, setFloorsForCalc] = useState(floors);
  useEffect(() => {
    const handle = setTimeout(() => setFloorsForCalc(floors), 350);
    return () => clearTimeout(handle);
  }, [floors]);

  // ===== Per-project IndexedDB persistence =====
  // Tracks whether we've finished loading from storage for the current project,
  // so we don't write the default floors back over data that was just loaded.
  const [hydratedProjectId, setHydratedProjectId] = useState<string | null>(null);

  // Load on project enter
  useEffect(() => {
    if (!activeProjectId) {
      setHydratedProjectId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const loaded = await loadProjectFloors(activeProjectId);
      if (cancelled) return;
      if (loaded && loaded.length > 0) {
        resetFloors(loaded);
        setSelectedFloorId(loaded[0].id);
      } else {
        // Fresh project — reset to default empty floor and clear undo history
        resetFloors([{ id: 'floor-1', name: '1F', floorHeight: 4.5, shapes: [] }]);
        setSelectedFloorId('floor-1');
      }
      setSelectedShapeId(null);
      setHydratedProjectId(activeProjectId);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // Debounced save on floors change (only after hydration completes for this project)
  useEffect(() => {
    if (!activeProjectId || hydratedProjectId !== activeProjectId) return;
    const handle = setTimeout(() => {
      saveProjectFloors(activeProjectId, floors);
    }, 500);
    return () => clearTimeout(handle);
  }, [floors, activeProjectId, hydratedProjectId]);

  // Floor → GeometryObject[] conversion for backward compatibility with calculation engine
  const floorsToGeometryObjects = (floorList: Floor[]): GeometryObject[] => {
    return floorList.flatMap(floor =>
      floor.shapes.map(shape => ({
        id: shape.id,
        type: shape.type,
        params: {
          ...shape.params,
          height: floor.floorHeight,
          azimuth: shape.rotation,
          wwr: shape.params.wwr ?? 0.35,
        },
        position: [shape.position.x, 0, shape.position.y] as [number, number, number]
      }))
    );
  };

  const objects = useMemo(() => floorsToGeometryObjects(floors), [floors]);

  const [activeTab, setActiveTab] = useState<'config' | 'analysis' | 'optimization' | 'report'>('config');
  const [configSubTab, setConfigSubTab] = useState<'project' | 'envelope' | 'mep'>('project');
  const [analysisSubTab, setAnalysisSubTab] = useState<'eev' | 'mep'>('eev');

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: 'sc-1', name: lang === 'zh' ? '極致外殼方案 (外殼優先)' : 'Premium Eco (Envelope Focus)', selectedMeasureIds: ['m1', 'm2', 'm6'] },
    { id: 'sc-2', name: '智慧機電方案 (控制優先)', selectedMeasureIds: ['m3', 'm4', 'm11'] }
  ]);

  // Parameter Settings State
  const [selectedRegion, setSelectedRegion] = useState('REGION_A');
  const [selectedUseCategory, setSelectedUseCategory] = useState<UseCategoryId>('USE_OFFICE');
  const [selectedHVAC, setSelectedHVAC] = useState('HVAC_VRF');
  const [selectedLighting, setSelectedLighting] = useState('LGT_LED');
  const [selectedElevator, setSelectedElevator] = useState('ET_VVVF');
  const [selectedDHW, setSelectedDHW] = useState('DHW_NONE');
  const [elevatorCount, setElevatorCount] = useState(4);
  // Envelope Settings State
  const [selectedWall, setSelectedWall] = useState('CONS_WALL_RC_INS');
  const [selectedRoof, setSelectedRoof] = useState('CONS_ROOF_RC_INS');
  const [selectedShading, setSelectedShading] = useState('SH_OVERHANG');
  const [selectedGlazing, setSelectedGlazing] = useState('GLZ_DBL_LOW_E');
  const facadeDefaults = useMemo(() => ({
    wwr: 0.35,
    glassType: bersnGlazingToCategorical(selectedGlazing),
    shadingType: bersnShadingToCategorical(selectedShading),
  }), [selectedGlazing, selectedShading]);

  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({ mainModel: true, planes: true });
  const handleLayerToggle = (key: LayerKey) => {
    setLayerVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Active wizard step (1..4) — lifted out of StepWizard so TopNav buttons
  // ("能效分析" → 4) and the wizard tabs share the same source of truth.
  // Persists per-project to sessionStorage via useActiveStep.
  const [activeStep, setActiveStep] = useActiveStep(activeProjectId ?? '__none');

  // Calengine-style BERSn Manual Ch.3 calc parameters (Step 4-9 + 8-10 + optional)
  const [calcExtras, setCalcExtras] = useState<CalcExtras>(DEFAULT_CALC_EXTRAS);
  const handleRunCalculation = async () => {
    if (!activeProjectId) { alert('請先選擇專案'); return; }
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/calc/run`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      alert(`計算完成（snapshot #${data.snapshotId}）`);
    } catch (e: any) {
      alert('計算失敗：' + (e?.message || e));
    }
  };

  const activeObj = objects[0];
  const kpis = useMemo(() => {
    const glassPerf = GLASS_PERFORMANCE[activeObj?.params?.glassType || 'Double'] ?? GLASS_PERFORMANCE['Double'];
    const shadingKi = SHADING_PERFORMANCE[activeObj?.params?.shadingType || 'None'] ?? SHADING_PERFORMANCE['None'];
    const adjustedBaseline = {
      ...baseline,
      envelope: { ...baseline.envelope, glassUValue: glassPerf.u, glassEtaI: glassPerf.eta, shadingKi: shadingKi }
    };
    return calculateKPIs(adjustedBaseline, objects);
  }, [baseline, objects]);

  const measureImpacts = useMemo(() => {
    return MEASURE_LIBRARY.map(m => simulateMeasure(baseline, objects, kpis, m))
      .sort((a, b) => b.cpValue - a.cpValue);
  }, [baseline, objects, kpis]);

  // Auto-sync total floor area from floor-based geometry.
  // 總樓地板面積 = 各樓層形狀「聯集」面積之總和（重疊不重複計算）。
  // 用 floorsForCalc（debounced）確保拖拉中不會每幀重算。
  useEffect(() => {
    if (floorsForCalc.length === 0) return;
    const calculatedFloorArea = Math.round(
      floorsForCalc.reduce((sum, f) => sum + floorUnionArea(f.shapes), 0)
    );
    if (calculatedFloorArea > 0 && Math.abs(calculatedFloorArea - baseline.totalFloorAreaAF) > 1) {
      setBaseline(prev => ({ ...prev, totalFloorAreaAF: calculatedFloorArea }));
    }
  }, [floorsForCalc]);

  const activeScenarioResults = useMemo(() => {
    if (!selectedScenarioId) return null;
    const scenario = scenarios.find(s => s.id === selectedScenarioId);
    if (!scenario) return null;
    const selectedMeasures = MEASURE_LIBRARY.filter(m => scenario.selectedMeasureIds.includes(m.id));
    return simulateScenario(baseline, objects, kpis, selectedMeasures);
  }, [selectedScenarioId, scenarios, baseline, objects, kpis]);

  const handleEnterProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentView('workspace');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setActiveProjectId(null);
  };

  // Legacy helper (kept for compatibility, but main editing is via FloorManagerPanel)
  const updateActiveObject = (updates: Partial<GeometryObject['params']>) => {
    // Not used in floor mode, kept for reference
  };

  // 3D Click handlers
  const handleAddFloorFromViewer = () => {
    const topFloor = floors[floors.length - 1];
    const newFloorId = `floor-${Date.now()}`;
    const newFloor: Floor = {
      id: newFloorId,
      name: `${floors.length + 1}F`,
      floorHeight: topFloor?.floorHeight || 3.5,
      shapes: [],
    };
    setFloors(prev => [...prev, newFloor]);
    setSelectedFloorId(newFloorId);
    setSelectedShapeId(null);
    setShowFloorPanel(true);
  };

  const handleSelectFloorFromViewer = (floorId: string) => {
    setSelectedFloorId(floorId);
    setSelectedShapeId(null);
    setShowFloorPanel(true);
  };

  const handleSelectShapeFromViewer = (shapeId: string) => {
    setSelectedShapeId(shapeId);
    // Find which floor this shape belongs to
    for (const floor of floors) {
      if (floor.shapes.some(s => s.id === shapeId)) {
        setSelectedFloorId(floor.id);
        break;
      }
    }
    setShowFloorPanel(true);
  };

  const handleMoveShape = (floorId: string, shapeId: string, x: number, y: number) => {
    setFloors(prev => prev.map(f =>
      f.id === floorId ? {
        ...f,
        shapes: f.shapes.map(s =>
          s.id === shapeId ? { ...s, position: { x, y } } : s
        )
      } : f
    ));
  };

  // Edit Mode handlers (3D)
  const handleEnterEditMode = (floorId: string) => {
    setEditingFloorId(floorId);
    setSelectedFloorId(floorId);
  };

  const handleExitEditMode = () => {
    setEditingFloorId(null);
  };

  // Login View
  if (currentView === 'login') {
    return (
      <LoginPage
        lang={lang}
        onLogin={async (username, password) => {
          try {
            await authApiLogin(username, password);
            await session.refresh();
            setCurrentView('dashboard');
          } catch (err: any) {
            alert(err?.message || (lang === 'zh' ? '登入失敗' : 'Login failed'));
          }
        }}
      />
    );
  }

  // Accounts View
  if (currentView === 'accounts') {
    return (
      <AccountManagement
        lang={lang}
        onBack={handleBackToDashboard}
        onLanguageChange={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      />
    );
  }

  // Overview Dashboard View
  if (currentView === 'overview') {
    return (
      <DashboardOverview
        lang={lang}
        onBack={handleBackToDashboard}
        onLanguageChange={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        onNavigateToAccounts={() => setCurrentView('accounts')}
        onNavigateToProjects={() => setCurrentView('dashboard')}
      />
    );
  }

  // Dashboard View
  if (currentView === 'dashboard') {
    return (
      <ProjectDashboard
        lang={lang}
        onEnterProject={handleEnterProject}
        onLanguageChange={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        onNavigateToAccounts={() => setCurrentView('accounts')}
        onNavigateToOverview={() => setCurrentView('overview')}
      />
    );
  }

  // Workspace View — new shell is now the default.
  // To opt out (fall back to legacy UI below): in DevTools run
  //   localStorage.setItem('bern5.useNewShell','0'); location.reload()
  if (USE_NEW_SHELL) {
    return (
      <WorkspaceShell
        projectName={baseline.name}
        onLogout={handleBackToDashboard}
        activeStep={activeStep}
        onActiveStepChange={setActiveStep}
        layerVisibility={layerVisibility}
        onLayerToggle={handleLayerToggle}
        leftContent={
          <StepWizard
            activeStep={activeStep}
            onActiveStepChange={setActiveStep}
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
            selectedWall={selectedWall}             onWallChange={setSelectedWall}
            selectedRoof={selectedRoof}             onRoofChange={setSelectedRoof}
            selectedShading={selectedShading}       onShadingChange={setSelectedShading}
            selectedGlazing={selectedGlazing}       onGlazingChange={setSelectedGlazing}
            selectedHVAC={selectedHVAC}             onHVACChange={setSelectedHVAC}
            selectedLighting={selectedLighting}     onLightingChange={setSelectedLighting}
            selectedElevator={selectedElevator}     onElevatorChange={setSelectedElevator}
            selectedDHW={selectedDHW}               onDHWChange={setSelectedDHW}
            elevatorCount={elevatorCount}           onElevatorCountChange={setElevatorCount}
            objects={objects}
            floorsForCalc={floorsForCalc}
            kpis={kpis}
            calcExtras={calcExtras}
            onCalcExtrasChange={setCalcExtras}
            onRunCalculation={handleRunCalculation}
          />
        }
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
            inlineToolbar={true}
            facadeDefaults={facadeDefaults}
          />
        }
        scenariosContent={
          <ScenariosView
            lang={lang}
            measureImpacts={measureImpacts}
            scenarios={scenarios}
            selectedScenarioId={selectedScenarioId}
            onSelectScenario={setSelectedScenarioId}
            activeScenarioResults={activeScenarioResults}
          />
        }
        reportContent={<ReportView baseline={baseline} kpis={kpis} lang={lang} />}
      />
    );
  }

  // Workspace View
  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-slate-900 antialiased font-sans overflow-hidden">
      <header className="bg-[#0f172a] text-white p-3 flex justify-between items-center shadow-2xl z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Back Button */}
          <button
            onClick={handleBackToDashboard}
            className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-center transition-colors"
            title={lang === 'zh' ? '返回專案列表' : 'Back to Projects'}
          >
            <span className="text-lg">←</span>
          </button>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg cursor-pointer" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
            {lang === 'zh' ? '中' : 'EN'}
          </div>
          <div>
            <h1 className="text-xl font-black leading-none">{t.title} <span className="text-blue-500 font-medium text-sm">v5.3.2</span></h1>
            <p className="text-[10px] text-slate-400">{baseline.name}</p>
          </div>
        </div>
        <nav className="flex bg-slate-800/50 p-1 rounded-xl">
          {(['config', 'analysis', 'optimization', 'report'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
              {t[tab as keyof typeof t]}
            </button>
          ))}
        </nav>
      </header>

      <main className={`flex-1 min-h-0 ${activeTab === 'report' ? 'overflow-auto' : 'grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden max-w-[1920px] mx-auto w-full'}`}>
        {activeTab === 'report' ? (
          <ReportView baseline={baseline} kpis={kpis} lang={lang} />
        ) : activeTab === 'optimization' ? (
          <div className="lg:col-span-12 grid grid-cols-12 gap-8 overflow-y-auto custom-scrollbar p-2">
            <div className="col-span-12 lg:col-span-7 space-y-8">
              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h2 className="text-2xl font-black text-slate-800 mb-6 flex justify-between items-center">
                  <span>{t.measureLibrary}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-200">{MEASURE_LIBRARY.length} {t.measuresAnalyzed}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MEASURE_LIBRARY.map(m => {
                    const impact = measureImpacts.find(imp => imp.measureId === m.id);
                    const measureName = t[`${m.id}_name` as keyof typeof t] || m.name;
                    const measureDesc = t[`${m.id}_desc` as keyof typeof t] || m.description;
                    const categoryName = t[`cat_${m.category}` as keyof typeof t] || m.category;
                    return (
                      <div key={m.id} className={`p-5 rounded-3xl border transition-all ${impact?.isEligible ? 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${m.category === 'Envelope' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{categoryName}</span>
                          {impact?.isEligible ? (
                            <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">✅ {t.eligible}</span>
                          ) : (
                            <span className="text-[10px] font-black text-red-400 flex items-center gap-1" title={impact?.ineligibleReason}>⛔ {t.ineligible}</span>
                          )}
                        </div>
                        <h4 className="font-black text-sm text-slate-800 mb-1">{measureName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold mb-4 line-clamp-2">{measureDesc}</p>
                        <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">{t.deltaEEI}</span>
                            <span className="text-sm font-black text-emerald-600">-{impact?.deltaEEI.toFixed(3) || '0.000'}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">{t.cost}</span>
                            <span className="text-sm font-black text-slate-800">${(impact?.cost || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h2 className="text-2xl font-black text-slate-800 mb-6">{t.cpRanking}</h2>
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="p-4">{t.rank}</th>
                        <th className="p-4">{t.measureName}</th>
                        <th className="p-4">{t.deltaEEI}</th>
                        <th className="p-4">{t.cost}</th>
                        <th className="p-4 text-right">{t.cpValue}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {measureImpacts.filter(i => i.isEligible).map((imp, idx) => {
                        const m = MEASURE_LIBRARY.find(ml => ml.id === imp.measureId)!;
                        const measureName = t[`${m.id}_name` as keyof typeof t] || m.name;
                        return (
                          <tr key={imp.measureId} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-slate-400">#{idx < 9 ? '0' : ''}{idx + 1}</td>
                            <td className="p-4">{measureName}</td>
                            <td className="p-4 text-emerald-600">-{imp.deltaEEI.toFixed(3)}</td>
                            <td className="p-4">${imp.cost.toLocaleString()}</td>
                            <td className="p-4 text-right">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${idx === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{imp.cpValue.toFixed(2)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-8">
              <section className="bg-[#0f172a] p-10 rounded-[2.5rem] text-white shadow-2xl space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black">{t.scenarios}</h2>
                  <button className="bg-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-500 transition-colors">+ {lang === 'zh' ? '新增' : 'New'}</button>
                </div>

                <div className="space-y-4">
                  {scenarios.map(sc => (
                    <div key={sc.id} onClick={() => setSelectedScenarioId(sc.id)} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${selectedScenarioId === sc.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800/50 border-transparent hover:border-slate-700'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-black text-lg">{sc.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold">{sc.selectedMeasureIds.length} {t.measuresSelected}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedScenarioId === sc.id ? 'border-blue-400 bg-blue-500' : 'border-slate-600'}`}>
                          {selectedScenarioId === sc.id && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {sc.selectedMeasureIds.map(mid => (
                          <span key={mid} className="text-[9px] font-black bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-700">
                            {t[`${mid}_name` as keyof typeof t] || MEASURE_LIBRARY.find(m => m.id === mid)?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedScenarioId && activeScenarioResults && (
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">{t.scenarioPerf}</p>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <span className="text-[9px] text-slate-500 font-black uppercase">{t.resultEEI}</span>
                        <div className="text-3xl font-black text-emerald-400">{activeScenarioResults.kpis.eei.toFixed(3)}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1">{t.grade}: {activeScenarioResults.kpis.grade}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 font-black uppercase">{t.totalCost}</span>
                        <div className="text-3xl font-black text-white">${activeScenarioResults.totalCost.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <>
            {/* Left Column: Data & Controls */}
            <div className="lg:col-span-3 flex flex-col gap-6 overflow-y-auto min-h-0 max-h-full pr-1 custom-scrollbar">
              {activeTab === 'config' ? (
                <div className="space-y-4">
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['project', 'envelope', 'mep'] as const).map(tSub => (
                      <button key={tSub} onClick={() => setConfigSubTab(tSub)} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${configSubTab === tSub ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>
                        {t[tSub as keyof typeof t]}
                      </button>
                    ))}
                  </div>

                  {configSubTab === 'project' ? (
                    <div className="animate-in slide-in-from-left-2 duration-300">
                      <ProjectSettingsPanel
                        lang={lang}
                        projectName={baseline.name}
                        onProjectNameChange={(name) => setBaseline(prev => ({ ...prev, name }))}
                        selectedRegion={selectedRegion}
                        onRegionChange={setSelectedRegion}
                        selectedUseCategory={selectedUseCategory}
                        onUseCategoryChange={setSelectedUseCategory}
                        totalFloorArea={baseline.totalFloorAreaAF}
                        onTotalFloorAreaChange={(area) => setBaseline(prev => ({ ...prev, totalFloorAreaAF: area }))}
                        exemptAreas={baseline.exemptAreas}
                        onExemptAreasChange={(areas) => setBaseline(prev => ({ ...prev, exemptAreas: areas }))}
                      />
                    </div>
                  ) : configSubTab === 'envelope' ? (
                    <div className="animate-in slide-in-from-left-2">
                      <EnvelopeSettingsPanel
                        lang={lang}
                        selectedWall={selectedWall}
                        onWallChange={setSelectedWall}
                        selectedRoof={selectedRoof}
                        onRoofChange={setSelectedRoof}
                        selectedShading={selectedShading}
                        onShadingChange={setSelectedShading}
                        selectedGlazing={selectedGlazing}
                        onGlazingChange={setSelectedGlazing}
                      />
                    </div>
                  ) : (
                    <div className="animate-in slide-in-from-left-2">
                      <MEPSettingsPanel
                        lang={lang}
                        selectedHVAC={selectedHVAC}
                        onHVACChange={setSelectedHVAC}
                        selectedLighting={selectedLighting}
                        onLightingChange={setSelectedLighting}
                        selectedElevator={selectedElevator}
                        onElevatorChange={setSelectedElevator}
                        selectedDHW={selectedDHW}
                        onDHWChange={setSelectedDHW}
                        elevatorCount={elevatorCount}
                        onElevatorCountChange={setElevatorCount}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Analysis Tab: Left Dashboard (Narrow) - Now with Calculation Breakdown */
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {/* Top Summary Card */}
                  <div className={`p-4 rounded-2xl text-white shadow-xl relative overflow-hidden transition-all duration-700 ${kpis.isNZCB ? 'bg-gradient-to-br from-emerald-600 to-teal-800' : 'bg-[#0f172a]'}`}>
                    {kpis.isNZCB && (
                      <div className="absolute top-1 right-1">
                        <span className="text-[6px] font-black uppercase bg-emerald-400/20 px-1 py-0.5 rounded border border-emerald-300/30">NZCB</span>
                      </div>
                    )}
                    <p className="text-[7px] font-black text-blue-300 uppercase tracking-widest mb-1">{t.esr}</p>
                    <div className="text-2xl font-black tracking-tighter mb-1">{kpis.esr.toFixed(1)}%</div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                      <div className="text-center">
                        <span className="text-[7px] font-bold text-slate-400 uppercase block">{t.eeiScore}</span>
                        <span className="text-sm font-black">{kpis.score.toFixed(1)}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[7px] font-bold text-slate-400 uppercase block">{t.grade}</span>
                        <span className={`text-sm font-black ${kpis.grade === '1+' ? 'text-blue-400' : ''}`}>{kpis.grade}</span>
                      </div>
                    </div>
                  </div>

                  {/* NEW: Calculation Breakdown Panel */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <CalculationBreakdownPanel kpis={kpis} lang={lang} />
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: 3D WORKSPACE - Full height */}
            <div className="lg:col-span-9 flex flex-col gap-2 h-full">
              {/* 3D Viewer - Expands to fill available space */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm relative flex-1 flex flex-col">
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] bg-slate-50 flex-1 min-h-[500px] relative">
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
                  />

                  {/* Floor Manager Panel - Floating overlay inside 3D viewer */}
                  {activeTab === 'config' && (
                    <div className="absolute top-3 left-[60px] bottom-3 z-20 flex flex-col" style={{ width: showFloorPanel ? '300px' : 'auto' }}>
                      <div className="flex items-center gap-1 mb-1">
                        <button
                          onClick={() => setShowFloorPanel(!showFloorPanel)}
                          className="bg-slate-900/90 backdrop-blur-xl hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-black transition-all shadow-xl border border-white/20 flex items-center gap-1.5"
                          title={showFloorPanel ? (lang === 'zh' ? '收合面板' : 'Hide panel') : (lang === 'zh' ? '展開面板' : 'Show panel')}
                        >
                          <span>{showFloorPanel ? '◀' : '▶'}</span>
                          <span>{showFloorPanel ? (lang === 'zh' ? '收合' : 'Hide') : (lang === 'zh' ? '面板' : 'Panel')}</span>
                        </button>
                      </div>

                      {showFloorPanel && (
                        <div className="flex-1 min-h-0 rounded-xl overflow-hidden shadow-2xl border border-white/10 backdrop-blur-sm" style={{ background: 'rgba(15, 23, 42, 0.92)' }}>
                          <FloorManagerPanel
                            floors={floors}
                            onFloorsChange={setFloors}
                            selectedFloorId={selectedFloorId}
                            onSelectFloor={setSelectedFloorId}
                            selectedShapeId={selectedShapeId}
                            onSelectShape={setSelectedShapeId}
                            onEnterTopView={handleEnterTopViewEdit}
                            lang={lang}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="absolute bottom-3 right-3 flex gap-2 pointer-events-none">
                    <div className="bg-white/80 backdrop-blur-md p-2 rounded-xl border border-white shadow-lg flex flex-col items-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase">Grade</span>
                      <span className="text-lg font-black text-blue-600">{kpis.grade}</span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-md p-2 rounded-xl border border-white shadow-lg flex flex-col items-center">
                      <span className="text-[7px] font-black text-slate-400 uppercase">ESR</span>
                      <span className="text-lg font-black text-emerald-600">{kpis.esr.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Controls - Geometry Calculations */}
              {activeTab === 'config' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <GeometryCalculationsPanel
                      objects={objects}
                      floors={floorsForCalc}
                      lang={lang}
                      selectedShading={selectedShading}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 p-3 px-8 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest flex-shrink-0">
        <div className="flex gap-14 items-center">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-xl shadow-emerald-500/50"></div>
            <span className="text-emerald-600 tracking-[0.2em]">{t.statusOnline}</span>
          </div>
          <div className="flex gap-10 border-l border-slate-200 pl-10">
            <span className="flex items-center gap-2 text-slate-500">EEI: <span className="text-slate-900 font-black text-sm">{kpis.eei.toFixed(3)}</span></span>
            <span className="flex items-center gap-2 text-slate-500">{t.grade}: <span className={`px-3 py-0.5 rounded-lg text-sm font-black transition-all ${kpis.grade === '1+' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-900'}`}>{kpis.grade}</span></span>
            <span className="flex items-center gap-2 text-slate-500">{t.afe}: <span className="text-slate-900 font-black text-sm">{kpis.afe.toFixed(0)} m²</span></span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-slate-400 opacity-60 hover:opacity-100 transition-opacity">
          <span>BERSn-Compliance Framework v5.3.4</span>
          <span className="text-slate-200">|</span>
          <span>Architectural Performance Digital Twin Engine</span>
        </div>
      </footer>
    </div >
  );
};

export default App;
