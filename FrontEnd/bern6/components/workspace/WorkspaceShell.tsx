import React, { useState } from 'react';
import TopNav, { WorkspaceView } from './TopNav';
import SplitPane from './SplitPane';
import LayerPanel, { LayerVisibility, LayerKey } from './LayerPanel';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  projectName: string;
  onLogout: () => void;
  /** Active wizard step (1..4) — lifted to parent so TopNav shortcut buttons
   *  and the wizard tabs share state. */
  activeStep: number;
  onActiveStepChange: (n: number) => void;
  /** Left dashboard content (StepWizard). */
  leftContent?: React.ReactNode;
  /** Right pane content (DrawingToolbar + ThreeDViewer wrapper). */
  rightContent?: React.ReactNode;
  /** Full-screen ReportView for the 計算報告 nav. */
  reportContent?: React.ReactNode;
  /** Full-screen ScenariosView (方案優化) for the 方案優化 nav. */
  scenariosContent?: React.ReactNode;
  layerVisibility?: LayerVisibility;
  onLayerToggle?: (key: LayerKey) => void;
}

/**
 * Outer shell for the workspace view. Owns:
 *   - theme key (via useTheme)
 *   - view = 'workspace' | 'scenarios' | 'report'
 *   - activeStep (for TopNav highlighting & shortcut hints)
 *
 * Does NOT own STEP content, layer panel, or 3D viewer — those come via props.
 */
const WorkspaceShell: React.FC<Props> = ({
  projectName, onLogout, activeStep, onActiveStepChange,
  leftContent, rightContent, reportContent, scenariosContent,
  layerVisibility, onLayerToggle,
}) => {
  const [theme, setTheme] = useTheme();
  const [view, setView] = useState<WorkspaceView>('workspace');

  const handleNavigate = (target: WorkspaceView, stepHint?: number) => {
    setView(target);
    if (target === 'workspace' && typeof stepHint === 'number') {
      onActiveStepChange(stepHint);
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

      {view === 'workspace' && (
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
      )}

      {view === 'scenarios' && (
        <div className="flex-1 overflow-auto p-4" style={{ background: 'var(--color-bg)' }}>
          {scenariosContent ?? (
            <div className="p-8 text-center" style={{ color: 'var(--color-muted)' }}>
              方案優化（AFE）內容會在後續接入。
            </div>
          )}
        </div>
      )}

      {view === 'report' && (
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
