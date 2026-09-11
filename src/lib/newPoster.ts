import { applyPosterPreset, type PosterPreset, type PosterPresetId } from './editorModel'

export type NewPosterIntent = 'Print' | 'Screen' | 'Custom'

export type NewPosterChoice = {
  id: PosterPresetId
  label: string
  intent: NewPosterIntent
  detail: string
}

export type ReplaceReason = 'new' | 'open' | 'restore'

export function hasUnsavedWork(savedClean: boolean): boolean {
  return !savedClean
}

export function blankPosterCanvas(background = '#f6f1e6'): Record<string, unknown> {
  return { version: '7.0.0', objects: [], background }
}

export function newPosterChoices(): NewPosterChoice[] {
  return [
    { id: 'a3', label: 'A3 portrait', intent: 'Print', detail: '297 × 420 mm · 300 dpi' },
    { id: 'a2', label: 'A2 portrait', intent: 'Print', detail: '420 × 594 mm · 300 dpi' },
    { id: 'instagram', label: 'Instagram portrait', intent: 'Screen', detail: '1080 × 1350 px' },
    { id: 'square', label: 'Square', intent: 'Screen', detail: '1600 × 1600 px' },
    { id: 'custom', label: 'Custom', intent: 'Custom', detail: 'Choose width and height' },
  ]
}

export function presetForNewPoster(
  id: PosterPresetId,
  custom?: { width: number; height: number },
): PosterPreset {
  return applyPosterPreset(id, custom)
}

export function unsavedWorkCopy(reason: ReplaceReason): { title: string; body: string } {
  if (reason === 'new') {
    return {
      title: 'Unsaved changes',
      body: 'This poster has unsaved changes. Starting a new poster will replace it.',
    }
  }
  if (reason === 'restore') {
    return {
      title: 'Unsaved changes',
      body: 'This poster has unsaved changes. Restoring the recovered session will replace it.',
    }
  }
  return {
    title: 'Unsaved changes',
    body: 'This poster has unsaved changes. Opening another poster will replace it.',
  }
}
