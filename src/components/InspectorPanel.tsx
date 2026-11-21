import { useRef } from 'react'
import {
  Blend,
  ChevronsLeft,
  ChevronsRight,
  Grid3x3,
  History,
  Image as ImageIcon,
  Printer,
  SlidersHorizontal,
} from 'lucide-react'
import { AppliedTab } from './inspector/AppliedTab'
import { AssetsTab } from './inspector/AssetsTab'
import { HistoryTab } from './inspector/HistoryTab'
import { LayersDock } from './inspector/LayersDock'
import { LayoutTab } from './inspector/LayoutTab'
import { PrintTab } from './inspector/PrintTab'
import { PropertiesTab } from './inspector/PropertiesTab'
import type { InspectorPanelProps } from './inspector/types'

export type { InspectorPanelProps } from './inspector/types'

const TABS = [
  ['inspect', 'Properties', 'Properties', SlidersHorizontal],
  ['treatments', 'Applied', 'Applied effects', Blend],
  ['history', 'History', 'History & versions', History],
  ['assets', 'Assets', 'Assets', ImageIcon],
  ['layout', 'Layout', 'Layout & guides', Grid3x3],
  ['print', 'Print', 'Print & press', Printer],
] as const

export function InspectorPanel(props: InspectorPanelProps) {
  const { inspectorTab, onInspectorTabChange, panelCollapsed = false, onTogglePanelCollapsed } = props
  const inspectorAsideRef = useRef<HTMLElement | null>(null)
  const activeTab = TABS.find(([id]) => id === inspectorTab) ?? TABS[0]

  const handleTabClick = (id: (typeof TABS)[number][0]) => {
    if (inspectorTab === id && onTogglePanelCollapsed) {
      onTogglePanelCollapsed()
      return
    }
    onInspectorTabChange(id)
    if (panelCollapsed && onTogglePanelCollapsed) onTogglePanelCollapsed()
  }

  return (
    <div className={panelCollapsed ? 'ps-dock is-collapsed' : 'ps-dock'}>
      <div className="ps-rail-column">
        {onTogglePanelCollapsed ? (
          <button
            type="button"
            className="ps-dock-toggle"
            aria-label={panelCollapsed ? 'Expand panels' : 'Collapse panels'}
            aria-expanded={!panelCollapsed}
            title={panelCollapsed ? 'Expand panels' : 'Collapse panels'}
            onClick={onTogglePanelCollapsed}
          >
            {panelCollapsed ? <ChevronsLeft size={14} aria-hidden /> : <ChevronsRight size={14} aria-hidden />}
          </button>
        ) : null}
        <nav className="ps-icon-rail" role="tablist" aria-label="Inspector panels" aria-orientation="vertical">
          {TABS.map(([id, label, tooltip, Icon]) => {
            const isActive = !panelCollapsed && inspectorTab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                title={isActive ? `${tooltip} — click to collapse` : tooltip}
                aria-label={label}
                aria-selected={isActive}
                className={isActive ? 'active' : undefined}
                onClick={() => handleTabClick(id)}
              >
                <Icon size={16} aria-hidden />
              </button>
            )
          })}
        </nav>
      </div>

      {!panelCollapsed ? (
        <aside ref={inspectorAsideRef} className="rail inspector glass-panel" aria-label="Inspector">
          <div className="ps-panel-header">
            <span className="ps-panel-tab-label">{activeTab[1]}</span>
          </div>
          <div className="inspector-scroll">
            {inspectorTab === 'treatments' ? <AppliedTab {...props} /> : null}
            {inspectorTab === 'inspect' ? <PropertiesTab {...props} /> : null}
            {inspectorTab === 'history' ? <HistoryTab {...props} /> : null}
            {inspectorTab === 'assets' ? <AssetsTab {...props} /> : null}
            {inspectorTab === 'layout' ? <LayoutTab {...props} /> : null}
            {inspectorTab === 'print' ? <PrintTab {...props} /> : null}
          </div>

          <LayersDock {...props} inspectorAsideRef={inspectorAsideRef} />
        </aside>
      ) : null}
    </div>
  )
}
