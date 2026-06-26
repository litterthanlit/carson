import { useCallback } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import type { MutableRefObject, RefObject } from 'react'
import { getActiveArtboard, type DocumentMeta } from '../lib/document'
import type { GridOverlay } from '../lib/grid'
import {
  readPosterTreatments,
  removePosterTreatment,
  renderPosterTreatments,
  reorderPosterTreatment,
  updatePosterTreatment,
} from '../lib/posterTreatments'
import type { PosterPreset } from '../lib/editorModel'
import {
  readTreatments,
  removeTreatment,
  renderTreatmentStackOnCanvas,
  reorderTreatment,
  updateTreatment,
} from '../lib/treatments'
import { cropModeFromParams } from '../lib/cropTreatment'
import type { LayerKind } from '../types/editor'
import { newSeed } from '../lib/random'

type UseTreatmentsOptions = {
  canvasRef: MutableRefObject<Canvas | null>
  documentMeta: DocumentMeta | null
  setDocumentMeta: React.Dispatch<React.SetStateAction<DocumentMeta | null>>
  gridOverlay: GridOverlay
  poster: PosterPreset
  commitHistoryRef: RefObject<(message: string) => void>
  commitTreatmentHistoryRef: RefObject<
    (objectId: string, label: string, before: string, after: string) => void
  >
  activeObjectRef: RefObject<() => FabricObject | null>
  tagObjectRef: RefObject<(object: FabricObject, kind: LayerKind, name: string) => void>
}

export function useTreatments({
  canvasRef,
  documentMeta,
  setDocumentMeta,
  gridOverlay,
  poster,
  commitHistoryRef,
  commitTreatmentHistoryRef,
  activeObjectRef,
  tagObjectRef,
}: UseTreatmentsOptions) {
  const activeObject = useCallback(() => activeObjectRef.current?.() ?? null, [activeObjectRef])
  const commitHistory = useCallback((message: string) => commitHistoryRef.current?.(message), [commitHistoryRef])
  const commitTreatmentHistory = useCallback(
    (objectId: string, label: string, before: string, after: string) =>
      commitTreatmentHistoryRef.current?.(objectId, label, before, after),
    [commitTreatmentHistoryRef],
  )
  const tagObject = useCallback(
    (object: FabricObject, kind: LayerKind, name: string) => tagObjectRef.current?.(object, kind, name),
    [tagObjectRef],
  )
  const tensionScatterScale = useCallback(() => 1 + gridOverlay.tension / 100, [gridOverlay.tension])

  const tagPosterFragment = useCallback((object: FabricObject, name: string) => {
    object.set({
      kind: 'fragment',
      name,
      selectable: false,
      evented: false,
    } as Partial<FabricObject>)
  }, [])

  const refreshTreatmentStack = useCallback(
    async (object?: FabricObject | null) => {
      const canvas = canvasRef.current
      const target = object ?? activeObject()
      if (!canvas || !target || target.type === 'activeselection') return
      await renderTreatmentStackOnCanvas(
        canvas,
        target,
        {
          slice: (fragment, index) => {
            tagObject(fragment, 'fragment', `Cut ${index + 1}`)
          },
          crop: (fragment, treatment) => {
            tagObject(fragment, 'fragment', `${cropModeFromParams(treatment.params)} crop`)
          },
          tear: (fragment, index) => {
            tagObject(fragment, 'fragment', `Torn scrap ${index + 1}`)
          },
          badCrop: (fragment, index) => {
            tagObject(fragment, 'fragment', `Bad crop ${index + 1}`)
          },
          glyph: (fragment, _index, glyphText) => {
            tagObject(fragment, 'text', `Glyph ${glyphText}`)
          },
        },
        tensionScatterScale(),
      )
      canvas.requestRenderAll()
    },
    [activeObject, canvasRef, tagObject, tensionScatterScale],
  )

  const reconcileArtifactTreatments = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const artifactTypes = new Set(['slice', 'crop', 'tear', 'bad-crop', 'glyph-break'])
    for (const object of canvas.getObjects()) {
      if (readTreatments(object).some((item) => artifactTypes.has(item.type))) {
        await refreshTreatmentStack(object)
      }
    }
  }, [canvasRef, refreshTreatmentStack])

  const refreshPosterTreatments = useCallback(async () => {
    const canvas = canvasRef.current
    const board = documentMeta ? getActiveArtboard(documentMeta) : undefined
    if (!canvas || !board) return
    renderPosterTreatments(canvas, readPosterTreatments(board), poster, tagPosterFragment)
    canvas.requestRenderAll()
  }, [canvasRef, documentMeta, poster, tagPosterFragment])

  const rerollTreatment = useCallback(
    async (treatmentId: string) => {
      const object = activeObject()
      if (!object) return
      const objectId = String(object.get('id') ?? '')
      const before = JSON.stringify(readTreatments(object))
      updateTreatment(object, treatmentId, { seed: newSeed() })
      await refreshTreatmentStack(object)
      commitTreatmentHistory(objectId, 'Re-rolled treatment', before, JSON.stringify(readTreatments(object)))
    },
    [activeObject, commitTreatmentHistory, refreshTreatmentStack],
  )

  const reorderLayerTreatment = useCallback(
    async (treatmentId: string, direction: 'up' | 'down') => {
      const object = activeObject()
      if (!object) return
      const objectId = String(object.get('id') ?? '')
      const before = JSON.stringify(readTreatments(object))
      reorderTreatment(object, treatmentId, direction)
      await refreshTreatmentStack(object)
      commitTreatmentHistory(objectId, 'Reordered treatment', before, JSON.stringify(readTreatments(object)))
    },
    [activeObject, commitTreatmentHistory, refreshTreatmentStack],
  )

  const toggleTreatment = useCallback(
    async (treatmentId: string) => {
      const object = activeObject()
      if (!object) return
      const treatment = readTreatments(object).find((item) => item.id === treatmentId)
      if (!treatment) return
      const objectId = String(object.get('id') ?? '')
      const before = JSON.stringify(readTreatments(object))
      updateTreatment(object, treatmentId, { enabled: !treatment.enabled })
      await refreshTreatmentStack(object)
      commitTreatmentHistory(
        objectId,
        treatment.enabled ? 'Bypassed treatment' : 'Enabled treatment',
        before,
        JSON.stringify(readTreatments(object)),
      )
    },
    [activeObject, commitTreatmentHistory, refreshTreatmentStack],
  )

  const removeLayerTreatment = useCallback(
    async (object: FabricObject, treatmentId: string) => {
      const objectId = String(object.get('id') ?? '')
      const before = JSON.stringify(readTreatments(object))
      removeTreatment(object, treatmentId)
      await refreshTreatmentStack(object)
      commitTreatmentHistory(objectId, 'Removed treatment', before, JSON.stringify(readTreatments(object)))
    },
    [commitTreatmentHistory, refreshTreatmentStack],
  )

  const rerollPosterTreatment = useCallback(
    async (treatmentId: string) => {
      if (!documentMeta) return
      const board = getActiveArtboard(documentMeta)
      if (!board) return
      const nextBoard = updatePosterTreatment(board, treatmentId, { seed: newSeed() })
      setDocumentMeta({
        ...documentMeta,
        artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
      })
      await refreshPosterTreatments()
      commitHistory('Re-rolled poster treatment')
    },
    [commitHistory, documentMeta, refreshPosterTreatments, setDocumentMeta],
  )

  const togglePosterTreatment = useCallback(
    async (treatmentId: string) => {
      if (!documentMeta) return
      const board = getActiveArtboard(documentMeta)
      if (!board) return
      const treatment = readPosterTreatments(board).find((item) => item.id === treatmentId)
      if (!treatment) return
      const nextBoard = updatePosterTreatment(board, treatmentId, { enabled: !treatment.enabled })
      setDocumentMeta({
        ...documentMeta,
        artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
      })
      await refreshPosterTreatments()
      commitHistory(treatment.enabled ? 'Bypassed poster treatment' : 'Enabled poster treatment')
    },
    [commitHistory, documentMeta, refreshPosterTreatments, setDocumentMeta],
  )

  const removePosterTreatmentAction = useCallback(
    async (treatmentId: string) => {
      if (!documentMeta) return
      const board = getActiveArtboard(documentMeta)
      if (!board) return
      const nextBoard = removePosterTreatment(board, treatmentId)
      setDocumentMeta({
        ...documentMeta,
        artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
      })
      await refreshPosterTreatments()
      commitHistory('Removed poster treatment')
    },
    [commitHistory, documentMeta, refreshPosterTreatments, setDocumentMeta],
  )

  const reorderPosterTreatmentAction = useCallback(
    async (treatmentId: string, direction: 'up' | 'down') => {
      if (!documentMeta) return
      const board = getActiveArtboard(documentMeta)
      if (!board) return
      const nextBoard = reorderPosterTreatment(board, treatmentId, direction)
      setDocumentMeta({
        ...documentMeta,
        artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
      })
      await refreshPosterTreatments()
      commitHistory('Reordered poster treatment')
    },
    [commitHistory, documentMeta, refreshPosterTreatments, setDocumentMeta],
  )

  return {
    refreshTreatmentStack,
    reconcileArtifactTreatments,
    refreshPosterTreatments,
    rerollTreatment,
    reorderLayerTreatment,
    toggleTreatment,
    removeLayerTreatment,
    rerollPosterTreatment,
    togglePosterTreatment,
    removePosterTreatmentAction,
    reorderPosterTreatmentAction,
  }
}
