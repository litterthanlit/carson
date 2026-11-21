import { BookmarkPlus, ChevronDown, ChevronUp, Dices, Eye, EyeOff, Trash2 } from 'lucide-react'
import { formatDegrees, formatPercent } from '../../lib/canvasUtils'
import {
  COPY_MACHINE_DEFAULTS,
  COPY_MACHINE_INK_BLEED,
  COPY_MACHINE_SOLVENT_TRANSFER,
  MAX_COPY_GENERATIONS,
  copyMachineParamsToRecord,
} from '../../lib/copyMachine'
import { defaultsForFx, formatFilterParam, paramDefsForFx } from '../../lib/filterGallery'
import { canSaveTreatmentAsInstrument } from '../../lib/instrumentAssets'
import { hasMaskContent, layerMaskLabel } from '../../lib/layerMask'
import { LETTER_BREAK_DEFAULTS, MAX_BREAK_DEPTH } from '../../lib/letterBreak'
import { posterTreatmentLabel } from '../../lib/posterTreatments'
import { PRESS_CHECK_DEFAULTS } from '../../lib/pressCheck'
import { treatmentLabel } from '../../lib/treatments'
import { Slider } from '../Slider'
import type { InspectorPanelProps } from './types'

type AppliedTabProps = Pick<
  InspectorPanelProps,
  | 'posterTreatments'
  | 'selected'
  | 'selectedObject'
  | 'selectedTreatments'
  | 'layerMask'
  | 'onReorderPosterTreatment'
  | 'onRerollPosterTreatment'
  | 'onTogglePosterTreatment'
  | 'onRemovePosterTreatment'
  | 'onPreviewPosterTreatmentParams'
  | 'onUpdatePosterTreatmentParams'
  | 'onInvertLayerMask'
  | 'onToggleLayerMask'
  | 'onClearLayerMask'
  | 'onReorderLayerTreatment'
  | 'onRerollLayerTreatment'
  | 'onToggleLayerTreatment'
  | 'onRemoveLayerTreatment'
  | 'onPreviewLayerTreatmentParams'
  | 'onUpdateLayerTreatmentParams'
  | 'onSaveTreatmentStackAsComponent'
  | 'onSaveTreatmentStackAsGesture'
  | 'onSaveTreatmentAsInstrument'
  | 'savedInstruments'
  | 'savedGestures'
  | 'onApplySavedInstrument'
  | 'onApplyGesture'
>

export function AppliedTab({
  posterTreatments,
  selected,
  selectedObject,
  selectedTreatments,
  layerMask,
  onReorderPosterTreatment,
  onRerollPosterTreatment,
  onTogglePosterTreatment,
  onRemovePosterTreatment,
  onPreviewPosterTreatmentParams,
  onUpdatePosterTreatmentParams,
  onInvertLayerMask,
  onToggleLayerMask,
  onClearLayerMask,
  onReorderLayerTreatment,
  onRerollLayerTreatment,
  onToggleLayerTreatment,
  onRemoveLayerTreatment,
  onPreviewLayerTreatmentParams,
  onUpdateLayerTreatmentParams,
  onSaveTreatmentStackAsComponent,
  onSaveTreatmentStackAsGesture,
  onSaveTreatmentAsInstrument,
  savedInstruments,
  savedGestures,
  onApplySavedInstrument,
  onApplyGesture,
}: AppliedTabProps) {
  return (
    <div className="panel-section">
      <h2>
        Applied effects <span className="heading-sub">Treatments</span>
      </h2>
      <p className="hint">Non-destructive — text stays editable; remove artifact treatments to restore the source layer.</p>
      {posterTreatments.length > 0 ? (
        <>
          <h3 className="property-kicker">Poster effects</h3>
          <ul className="treatment-stack">
            {posterTreatments.map((treatment, index) => (
              <li key={treatment.id} className={treatment.enabled ? undefined : 'bypassed'}>
                <span>{posterTreatmentLabel(treatment)}</span>
                <small>#{treatment.seed}</small>
                <span className="treatment-actions">
                  <button type="button" title="Move up" disabled={index === 0} onClick={() => onReorderPosterTreatment(treatment.id, 'up')}>
                    <ChevronUp size={12} aria-hidden />
                  </button>
                  <button type="button" title="Move down" disabled={index === posterTreatments.length - 1} onClick={() => onReorderPosterTreatment(treatment.id, 'down')}>
                    <ChevronDown size={12} aria-hidden />
                  </button>
                  <button type="button" title="Re-roll seed" onClick={() => onRerollPosterTreatment(treatment.id)}>
                    <Dices size={12} aria-hidden />
                  </button>
                  <button type="button" title={treatment.enabled ? 'Bypass' : 'Enable'} onClick={() => onTogglePosterTreatment(treatment.id)}>
                    {treatment.enabled ? <Eye size={12} aria-hidden /> : <EyeOff size={12} aria-hidden />}
                  </button>
                  <button type="button" title="Remove" onClick={() => onRemovePosterTreatment(treatment.id)}>
                    <Trash2 size={12} aria-hidden />
                  </button>
                </span>
                {treatment.type === 'press-check' ? (
                  <div className="treatment-params nested">
                    <Slider
                      label="Ink spread"
                      min={0}
                      max={100}
                      value={treatment.params.inkSpread ?? PRESS_CHECK_DEFAULTS.inkSpread}
                      defaultValue={PRESS_CHECK_DEFAULTS.inkSpread}
                      onChange={(value) => onPreviewPosterTreatmentParams(treatment.id, { inkSpread: value })}
                      onCommit={() => onUpdatePosterTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Misregistration"
                      min={0}
                      max={100}
                      value={treatment.params.misregistration ?? PRESS_CHECK_DEFAULTS.misregistration}
                      defaultValue={PRESS_CHECK_DEFAULTS.misregistration}
                      onChange={(value) => onPreviewPosterTreatmentParams(treatment.id, { misregistration: value })}
                      onCommit={() => onUpdatePosterTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Paper tooth"
                      min={0}
                      max={100}
                      value={treatment.params.paperTooth ?? PRESS_CHECK_DEFAULTS.paperTooth}
                      defaultValue={PRESS_CHECK_DEFAULTS.paperTooth}
                      onChange={(value) => onPreviewPosterTreatmentParams(treatment.id, { paperTooth: value })}
                      onCommit={() => onUpdatePosterTreatmentParams(treatment.id, {})}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {!selected ? (
        <p className="empty">Select a layer to see its applied effects.</p>
      ) : selectedTreatments.length === 0 && !hasMaskContent(layerMask) ? (
        <p className="empty">No effects applied to this layer yet. Try Scatter, Copy machine, or paint a mask.</p>
      ) : (
        <>
          <h3 className="property-kicker">Layer effects</h3>
          <ul className="treatment-stack">
            {hasMaskContent(layerMask) && layerMask ? (
              <li className={layerMask.enabled ? undefined : 'bypassed'}>
                <span>{layerMaskLabel(layerMask)}</span>
                <small>{layerMask.inverted ? 'inv' : 'alpha'}</small>
                <span className="treatment-actions">
                  <button type="button" title="Invert mask" onClick={onInvertLayerMask}>
                    Inv
                  </button>
                  <button type="button" title={layerMask.enabled ? 'Bypass' : 'Enable'} onClick={onToggleLayerMask}>
                    {layerMask.enabled ? <Eye size={12} aria-hidden /> : <EyeOff size={12} aria-hidden />}
                  </button>
                  <button type="button" title="Remove" onClick={onClearLayerMask}>
                    <Trash2 size={12} aria-hidden />
                  </button>
                </span>
              </li>
            ) : null}
            {selectedTreatments.map((treatment, index) => (
              <li key={treatment.id} className={treatment.enabled ? undefined : 'bypassed'}>
                <span>{treatmentLabel(treatment)}</span>
                <small>#{treatment.seed}</small>
                <span className="treatment-actions">
                  <button type="button" title="Move up" disabled={index === 0} onClick={() => onReorderLayerTreatment(treatment.id, 'up')}>
                    <ChevronUp size={12} aria-hidden />
                  </button>
                  <button type="button" title="Move down" disabled={index === selectedTreatments.length - 1} onClick={() => onReorderLayerTreatment(treatment.id, 'down')}>
                    <ChevronDown size={12} aria-hidden />
                  </button>
                  <button type="button" title="Re-roll seed" onClick={() => onRerollLayerTreatment(treatment.id)}>
                    <Dices size={12} aria-hidden />
                  </button>
                  <button type="button" title={treatment.enabled ? 'Bypass' : 'Enable'} onClick={() => onToggleLayerTreatment(treatment.id)}>
                    {treatment.enabled ? <Eye size={12} aria-hidden /> : <EyeOff size={12} aria-hidden />}
                  </button>
                  {canSaveTreatmentAsInstrument(treatment) ? (
                    <button
                      type="button"
                      title="Save as instrument"
                      aria-label="Save as instrument"
                      onClick={() => onSaveTreatmentAsInstrument(treatment)}
                    >
                      <BookmarkPlus size={12} aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => {
                      if (!selectedObject) return
                      onRemoveLayerTreatment(selectedObject, treatment.id)
                    }}
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                </span>
                {treatment.type === 'copy-machine' ? (
                  <div className="treatment-params nested">
                    <div className="preset-row" role="group" aria-label="Copy machine presets">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateLayerTreatmentParams(treatment.id, copyMachineParamsToRecord(COPY_MACHINE_DEFAULTS))
                        }
                      >
                        Copier
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateLayerTreatmentParams(treatment.id, copyMachineParamsToRecord(COPY_MACHINE_INK_BLEED))
                        }
                      >
                        Ink bleed
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateLayerTreatmentParams(
                            treatment.id,
                            copyMachineParamsToRecord(COPY_MACHINE_SOLVENT_TRANSFER),
                          )
                        }
                      >
                        Solvent
                      </button>
                    </div>
                    <Slider
                      label="Ink blot"
                      value={treatment.params.blot ?? COPY_MACHINE_DEFAULTS.blot}
                      defaultValue={COPY_MACHINE_DEFAULTS.blot}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { blot: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Rub smear"
                      value={treatment.params.smear ?? COPY_MACHINE_DEFAULTS.smear}
                      defaultValue={COPY_MACHINE_DEFAULTS.smear}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { smear: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Paste seams"
                      value={treatment.params.seams ?? COPY_MACHINE_DEFAULTS.seams}
                      defaultValue={COPY_MACHINE_DEFAULTS.seams}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { seams: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Debris"
                      value={treatment.params.debris ?? COPY_MACHINE_DEFAULTS.debris}
                      defaultValue={COPY_MACHINE_DEFAULTS.debris}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { debris: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Wobble"
                      value={treatment.params.wobble ?? COPY_MACHINE_DEFAULTS.wobble}
                      defaultValue={COPY_MACHINE_DEFAULTS.wobble}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { wobble: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Drag"
                      value={treatment.params.drag ?? COPY_MACHINE_DEFAULTS.drag}
                      defaultValue={COPY_MACHINE_DEFAULTS.drag}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { drag: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Tear"
                      value={treatment.params.wobbleFreq ?? COPY_MACHINE_DEFAULTS.wobbleFreq}
                      defaultValue={COPY_MACHINE_DEFAULTS.wobbleFreq}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { wobbleFreq: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Scan angle"
                      value={treatment.params.dragAngle ?? COPY_MACHINE_DEFAULTS.dragAngle}
                      defaultValue={COPY_MACHINE_DEFAULTS.dragAngle}
                      min={0}
                      max={359}
                      format={formatDegrees}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { dragAngle: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Grain"
                      value={treatment.params.grain ?? COPY_MACHINE_DEFAULTS.grain}
                      defaultValue={COPY_MACHINE_DEFAULTS.grain}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { grain: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Contrast"
                      value={treatment.params.contrast ?? COPY_MACHINE_DEFAULTS.contrast}
                      defaultValue={COPY_MACHINE_DEFAULTS.contrast}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { contrast: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Ink bleed"
                      value={treatment.params.bleed ?? COPY_MACHINE_DEFAULTS.bleed}
                      defaultValue={COPY_MACHINE_DEFAULTS.bleed}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { bleed: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Ink starve"
                      value={treatment.params.starve ?? COPY_MACHINE_DEFAULTS.starve}
                      defaultValue={COPY_MACHINE_DEFAULTS.starve}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { starve: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Slur"
                      value={treatment.params.slur ?? COPY_MACHINE_DEFAULTS.slur}
                      defaultValue={COPY_MACHINE_DEFAULTS.slur}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { slur: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Bands"
                      value={treatment.params.bands ?? COPY_MACHINE_DEFAULTS.bands}
                      defaultValue={COPY_MACHINE_DEFAULTS.bands}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { bands: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Voids"
                      value={treatment.params.voids ?? COPY_MACHINE_DEFAULTS.voids}
                      defaultValue={COPY_MACHINE_DEFAULTS.voids}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { voids: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Streaks"
                      value={treatment.params.streaks ?? COPY_MACHINE_DEFAULTS.streaks}
                      defaultValue={COPY_MACHINE_DEFAULTS.streaks}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { streaks: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Lid edge"
                      value={treatment.params.edge ?? COPY_MACHINE_DEFAULTS.edge}
                      defaultValue={COPY_MACHINE_DEFAULTS.edge}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { edge: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Generations"
                      value={treatment.params.generations ?? COPY_MACHINE_DEFAULTS.generations}
                      defaultValue={COPY_MACHINE_DEFAULTS.generations}
                      min={1}
                      max={MAX_COPY_GENERATIONS}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { generations: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Copy size"
                      value={treatment.params.copyScale ?? COPY_MACHINE_DEFAULTS.copyScale}
                      defaultValue={COPY_MACHINE_DEFAULTS.copyScale}
                      min={50}
                      max={200}
                      format={formatPercent}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { copyScale: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Ghost"
                      value={treatment.params.ghost ?? COPY_MACHINE_DEFAULTS.ghost}
                      defaultValue={COPY_MACHINE_DEFAULTS.ghost}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { ghost: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Ghost offset"
                      value={treatment.params.ghostOffset ?? COPY_MACHINE_DEFAULTS.ghostOffset}
                      defaultValue={COPY_MACHINE_DEFAULTS.ghostOffset}
                      min={0}
                      max={24}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { ghostOffset: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                  </div>
                ) : treatment.type === 'letter-break' ? (
                  <div className="treatment-params nested">
                    <Slider
                      label="Letters"
                      value={treatment.params.letters ?? LETTER_BREAK_DEFAULTS.letters}
                      defaultValue={LETTER_BREAK_DEFAULTS.letters}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { letters: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Cuts"
                      value={treatment.params.depth ?? LETTER_BREAK_DEFAULTS.depth}
                      defaultValue={LETTER_BREAK_DEFAULTS.depth}
                      min={1}
                      max={MAX_BREAK_DEPTH}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { depth: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Gap"
                      value={treatment.params.gap ?? LETTER_BREAK_DEFAULTS.gap}
                      defaultValue={LETTER_BREAK_DEFAULTS.gap}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { gap: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Slide"
                      value={treatment.params.shift ?? LETTER_BREAK_DEFAULTS.shift}
                      defaultValue={LETTER_BREAK_DEFAULTS.shift}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { shift: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Missing"
                      value={treatment.params.drop ?? LETTER_BREAK_DEFAULTS.drop}
                      defaultValue={LETTER_BREAK_DEFAULTS.drop}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { drop: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Across ↔ along"
                      value={treatment.params.axis ?? LETTER_BREAK_DEFAULTS.axis}
                      defaultValue={LETTER_BREAK_DEFAULTS.axis}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { axis: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                  </div>
                ) : treatment.type === 'decay' || treatment.type === 'decay-marks' ? (
                  <div className="treatment-params nested">
                    <Slider
                      label="Amount"
                      value={treatment.params.amount ?? 55}
                      defaultValue={55}
                      min={0}
                      max={100}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { amount: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                  </div>
                ) : treatment.type === 'misprint' ? (
                  <div className="treatment-params nested">
                    <Slider
                      label="Offset"
                      value={treatment.params.offset ?? 10}
                      defaultValue={10}
                      min={0}
                      max={40}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { offset: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Opacity"
                      value={Math.round((treatment.params.opacity ?? 0.27) * 100)}
                      min={4}
                      max={60}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { opacity: value / 100 })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                  </div>
                ) : treatment.type === 'type-strips' ? (
                  <div className="treatment-params nested">
                    <Slider
                      label="Rows"
                      value={treatment.params.rows ?? 5}
                      defaultValue={5}
                      min={2}
                      max={12}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { rows: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                    <Slider
                      label="Jitter"
                      value={treatment.params.jitter ?? 12}
                      defaultValue={12}
                      min={0}
                      max={40}
                      onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { jitter: value })}
                      onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                    />
                  </div>
                ) : treatment.type === 'fx' ? (
                  <div className="treatment-params nested">
                    {paramDefsForFx(treatment.fxKind).map((param) => (
                      <Slider
                        key={param.key}
                        label={param.label}
                        value={
                          treatment.params[param.key] ??
                          defaultsForFx(treatment.fxKind)[param.key] ??
                          param.min
                        }
                        defaultValue={defaultsForFx(treatment.fxKind)[param.key]}
                        min={param.min}
                        max={param.max}
                        format={(value) => formatFilterParam(param, value)}
                        onChange={(value) => onPreviewLayerTreatmentParams(treatment.id, { [param.key]: value })}
                        onCommit={() => onUpdateLayerTreatmentParams(treatment.id, {})}
                      />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        type="button"
        title="Save this layer's treatment stack as a reusable component"
        onClick={onSaveTreatmentStackAsComponent}
        disabled={!selected || selectedTreatments.length === 0}
      >
        Save stack as component
      </button>
      <button
        type="button"
        title="Save this layer's treatment chain as a replayable gesture (treatments only, not canvas JSON)"
        onClick={onSaveTreatmentStackAsGesture}
        disabled={!selected || selectedTreatments.length === 0}
      >
        Save stack as gesture
      </button>
      {savedInstruments.length > 0 ? (
        <>
          <h3 className="property-kicker">Saved instruments</h3>
          <div className="preset-row">
            {savedInstruments.map((asset) => (
              <button
                key={asset.id}
                type="button"
                aria-label={`Play instrument ${asset.name}`}
                title={`Play ${asset.name} on the selected layer`}
                onClick={() => onApplySavedInstrument(asset)}
                disabled={!selected}
              >
                {asset.name}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {savedGestures.length > 0 ? (
        <>
          <h3 className="property-kicker">Saved gestures</h3>
          <div className="preset-row">
            {savedGestures.map((gesture) => (
              <button
                key={gesture.id}
                type="button"
                title={`Play ${gesture.name} on the selected layer`}
                onClick={() => onApplyGesture(gesture)}
                disabled={!selected}
              >
                {gesture.name}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
