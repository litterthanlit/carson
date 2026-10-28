/** Markdown views of editor state, sized for an agent's context window. */
import type {
  AgentCatalog,
  AgentChange,
  AgentCommand,
  AgentLayer,
  AgentState,
  AgentTreatment,
} from '../src/lib/agentProtocol.ts'
import type { EditorInfo } from './hub.ts'

function treatmentLine(treatment: AgentTreatment) {
  const params = Object.entries(treatment.params)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')
  return `${treatment.label} \`${treatment.id}\` (${treatment.type}, seed ${treatment.seed}${treatment.enabled ? '' : ', bypassed'}${params ? `; ${params}` : ''})`
}

function quote(text: string, max = 80) {
  const flat = text.replace(/\s+/g, ' ').trim()
  return `"${flat.length > max ? `${flat.slice(0, max - 1)}…` : flat}"`
}

export function formatState(state: AgentState, editor: EditorInfo) {
  const lines = [`# Carson — ${state.screen === 'editor' ? state.project.name : 'home screen'}`]
  lines.push(`Editor window: "${editor.title}" (${editor.origin ?? 'local process'}), connected ${editor.connectedAt.toISOString()}.`)
  if (state.screen === 'home') {
    lines.push('', 'No poster is open. Start one with carson_start_poster.')
  } else {
    lines.push(
      '',
      `- Poster: ${state.poster.width}×${state.poster.height}px (${state.poster.preset}), ${state.layerCount} layers${state.project.dirty ? ', unsaved changes' : ', saved'}`,
      `- Selection: ${state.selection.length > 0 ? state.selection.map((id) => `\`${id}\``).join(', ') : 'nothing'}`,
      `- Tension: ${state.tension}/100`,
      `- Status line: ${state.status}`,
    )
    if (state.lastChaos) lines.push(`- Last chaos move: ${state.lastChaos.label} (seed ${state.lastChaos.seed})`)
    if (state.recordingGesture) lines.push('- Recording a gesture: instrument plays are being captured')
    if (state.posterTreatments.length > 0) {
      lines.push('', '## Poster treatments', ...state.posterTreatments.map((item) => `- ${treatmentLine(item)}`))
    }
    lines.push('', `## Trail (${state.trail.canUndo ? 'can undo' : 'nothing to undo'}, ${state.trail.canRedo ? 'can redo' : 'nothing to redo'})`)
    for (const frame of state.trail.frames.slice(-12)) {
      lines.push(`- ${frame.current ? '**→** ' : ''}${frame.label} \`${frame.opId}\``)
    }
    if (state.trail.frames.length > 12) lines.push(`- …${state.trail.frames.length - 12} earlier steps`)
  }
  if (state.savedPosters.length > 0) {
    lines.push('', '## Saved posters in this editor')
    for (const poster of state.savedPosters.slice(0, 20)) lines.push(`- ${poster.name} \`${poster.id}\` (saved ${poster.savedAt})`)
  }
  return lines.join('\n')
}

export function formatLayer(layer: AgentLayer) {
  const indent = '  '.repeat(layer.depth)
  const flags = [layer.selected ? 'selected' : '', layer.visible ? '' : 'hidden', layer.locked ? 'locked' : '']
    .filter(Boolean)
    .join(', ')
  const { left, top, width, height } = layer.bounds
  const parts = [
    `${indent}- **${layer.name}** \`${layer.id}\` ${layer.kind}${flags ? ` (${flags})` : ''}`,
    `at ${Math.round(left)},${Math.round(top)} size ${Math.round(width)}×${Math.round(height)}`,
  ]
  if (layer.angle) parts.push(`${layer.angle}°`)
  if (layer.opacity !== 1) parts.push(`opacity ${layer.opacity}`)
  if (layer.blendMode !== 'source-over') parts.push(`blend ${layer.blendMode}`)
  if (layer.text !== undefined) parts.push(`text ${quote(layer.text)}`)
  if (layer.fontFamily) parts.push(`${layer.fontFamily} ${layer.fontSize ?? ''}px ${layer.fontWeight ?? ''}`.trim())
  if (layer.fill) parts.push(`fill ${layer.fill}`)
  const head = parts.join(' · ')
  if (layer.treatments.length === 0) return head
  return [head, ...layer.treatments.map((item) => `${indent}  - ${treatmentLine(item)}`)].join('\n')
}

export function formatCommands(commands: AgentCommand[]) {
  const groups: Record<AgentCommand['scope'], AgentCommand[]> = { selection: [], canvas: [], any: [] }
  for (const command of commands) groups[command.scope].push(command)
  const titles: Record<AgentCommand['scope'], string> = {
    selection: 'Act on the selected layers (pass layer_ids)',
    canvas: 'Act on the whole poster',
    any: 'Anywhere',
  }
  const lines: string[] = []
  for (const scope of ['selection', 'canvas', 'any'] as const) {
    if (groups[scope].length === 0) continue
    lines.push(`## ${titles[scope]}`)
    for (const command of groups[scope]) {
      const notes = [command.enabled ? '' : 'unavailable now', command.interactive ? 'opens UI for the designer' : '']
        .filter(Boolean)
        .join(', ')
      lines.push(`- \`${command.id}\` ${command.label}${notes ? ` (${notes})` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

export function formatChange(summary: string, change: AgentChange) {
  const lines = [summary, `Status: ${change.status}`]
  if (change.trailHead) lines.push(`Trail: ${change.trailHead}`)
  if (change.addedLayers.length > 0) lines.push(`New layers: ${change.addedLayers.map((id) => `\`${id}\``).join(', ')}`)
  if (change.removedLayers.length > 0) lines.push(`Removed layers: ${change.removedLayers.map((id) => `\`${id}\``).join(', ')}`)
  for (const { layerId, treatment } of change.addedTreatments) {
    lines.push(`New treatment on ${layerId ? `\`${layerId}\`` : 'the poster'}: ${treatmentLine(treatment)}`)
  }
  lines.push(`Selection: ${change.selection.length > 0 ? change.selection.map((id) => `\`${id}\``).join(', ') : 'nothing'}`)
  return lines.join('\n')
}

export function formatCatalog(catalog: AgentCatalog) {
  const fontsByCategory = new Map<string, string[]>()
  for (const font of catalog.fonts) {
    fontsByCategory.set(font.category, [...(fontsByCategory.get(font.category) ?? []), `${font.family} (${font.weights.join('/')})`])
  }
  const lines = ['# Carson catalog', '', '## Fonts (font_family)']
  for (const [category, fonts] of fontsByCategory) lines.push(`- ${category}: ${fonts.join(', ')}`)
  lines.push('', '## Poster presets')
  for (const preset of catalog.presets) lines.push(`- \`${preset.id}\` ${preset.name}: ${preset.width}×${preset.height}px`)
  lines.push('', '## Blend modes (blend_mode)', catalog.blendModes.map((mode) => `\`${mode.value}\` ${mode.label}`).join(', '))
  lines.push('', '## Instruments (default params; tune a played one with carson_treatment set-params)')
  for (const instrument of catalog.instruments) {
    const params = Object.entries(instrument.defaultParams)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')
    lines.push(`- ${instrument.name} → ${instrument.treatmentType} treatment (${instrument.scope})${params ? `: ${params}` : ''}`)
  }
  return lines.join('\n')
}
