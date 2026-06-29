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
  type Treatment,
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
  commitTreatmentHistoryRef: RefObject<
    (objectId: string, label: string, before: string, after: string) => void
  >
  commitPosterTreatmentHistoryRef: RefObject<
    (artboardId: string, label: string, before: string, after: string) => void
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
  commitTreatmentHistoryRef,
  commitPosterTreatmentHistoryRef,
  activeObjectRef,
  tagObjectRef,
}: UseTreatmentsOptions) {
  const activeObject = useCallback(() => activeObjectRef.current?.() ?? null, [activeObjectRef])
  const commitTreatmentHistory = useCallback(
    (objectId: string, label: string, before: string, after: string) =>
      commitTreatmentHistoryRef.current?.(objectId, label, before, after),
    [commitTreatmentHistoryRef],
  )
  const commitPosterTreatmentHistory = useCallback(
    (artboardId: string, label: string, before: string, after: string) =>
      commitPosterTreatmentHistoryRef.current?.(artboardId, label, before, after),
    [commitPosterTreatmentHistoryRef],
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

  const refreshPosterTreatments = useCallback(
    async (treatmentsOverride?: Treatment[]) => {
      const canvas = canvasRef.current
      const board = documentMeta ? getActiveArtboard(documentMeta) : undefined
      if (!canvas || !board) return
      const treatments = treatmentsOverride ?? readPosterTreatments(board)
      renderPosterTreatments(canvas, treatments, poster, tagPosterFragment)
      canvas.requestRenderAll()
    },
    [canvasRef, documentMeta, poster, tagPosterFragment],
  )

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
      const before = JSON.stringify(readPosterTreatments(board))
      const nextBoard = updatePosterTreatment(board, treatmentId, { seed: newSeed() })
      const after = JSON.stringify(readPosterTreatments(nextBoard))
      setDocumentMeta({
        ...documentMeta,
        artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
      })
      await refreshPosterTreatments(readPosterTreatments(nextBoard))
      commitPosterTreatmentHistory(board.id, 'Re-rolled poster treatment', before, after)
    },
    [commitPosterTreatmentHistory, documentMeta, refreshPosterTreatments, setDocumentMeta],
  )

  const togglePosterTreatment = useCallback(
    async (treatmentId: string) => {
      if (!documentMeta) return
      const board = getActiveArtboard(documentMeta)
      if (!board) return
      const treatment = readPosterTreatments(board).find((item) => item.id === treatmentId)
      if (!treatment) return
      const before = JSON.stringify(readPosterTreatments(board))
      const nextBoard = updatePosterTreatment(board, treatmentId, { enabled: !treatment.enabled })
      const after = JSON.stringify(readPosterTreatments(nextBoard))
      setDocumentMeta({
        ...documentMeta,
        artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
      })
      await refreshPosterTreatments(readPosterTreatments(nextBoard))
      commitPosterTreatmentHistory(
        board.id,
        treatment.enabled ? 'Bypassed poster treatment' : 'Enabled poster treatment',
        before,
        after,
      )
    },
    [commitPosterTreatmentHistory, documentMeta, refreshPosterTreatments, setDocumentMeta],
  )

  const removePosterTreatmentAction = useCallback(
    async (treatmentId: string) => {
      if (!documentMeta) return
      const board = getActiveArtboard(documentMeta)
      if (!board) return
      const before = JSON.stringify(readPosterTreatments(board))
      const nextBoard = removePosterTreatment(board, treatmentId)
      const after = JSON.stringify(readPosterTreatments(nextBoard))
      setDocumentMeta({
        ...documentMeta,
        artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
      })
      await refreshPosterTreatments(readPosterTreatments(nextBoard))
      commitPosterTreatmentHistory(board.id, 'Removed poster treatment', before, after)
    },
    [commitPosterTreatmentHistory, documentMeta, refreshPosterTreatments, setDocumentMeta],
  )

  const reorderPosterTreatmentAction = useCallback(
    async (treatmentId: string, direction: 'up' | 'down') => {
      if (!documentMeta) return
      const board = getActiveArtboard(documentMeta)
      if (!board) return
      const before = JSON.stringify(readPosterTreatments(board))
      const nextBoard = reorderPosterTreatment(board, treatmentId, direction)
      const after = JSON.stringify(readPosterTreatments(nextBoard))
      setDocumentMeta({
        ...documentMeta,
        artboards: documentMeta.artboards.map((item) => (item.id === board.id ? nextBoard : item)),
      })
      await refreshPosterTreatments(readPosterTreatments(nextBoard))
      commitPosterTreatmentHistory(board.id, 'Reordered poster treatment', before, after)
    },
    [commitPosterTreatmentHistory, documentMeta, refreshPosterTreatments, setDocumentMeta],
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
