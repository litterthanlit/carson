import { useCallback, useRef } from 'react'
import type { Canvas } from 'fabric'
import type { MutableRefObject, RefObject } from 'react'
import { HISTORY_PROPS } from '../lib/editorConstants'
import { readObjectProp } from '../lib/canvasUtils'
import { collectFontFamilies, ensureLibraryFonts } from '../lib/fonts'
import { applyLayerOrder, applyObjectPatch } from '../lib/historyObject'
import {
  createHistoryState,
  indexOfOp,
  jumpRestoreActions,
  pushHistoryOp,
  restoreActionForRedo,
  restoreActionForUndo,
  shouldSnapshot,
  type HistoryOp,
  type HistoryState,
} from '../lib/historyLog'
import { withLayerSyncSuppressed } from '../lib/layerSync'

type UseEditorHistoryOptions = {
  canvasRef: MutableRefObject<Canvas | null>
  setStatus: (message: string) => void
  syncSelected: () => void
  syncLayers: () => void
  scheduleAutosave: () => void
  captureStyleBaseline: () => void
  onAfterRestore: () => Promise<void>
  onTreatmentRestore: (objectId: string, treatmentsJson: string) => Promise<void>
  onPosterTreatmentRestore: (artboardId: string, treatmentsJson: string) => Promise<void>
  commitHistoryRef: RefObject<(message: string) => void>
  commitTreatmentHistoryRef: RefObject<
    (objectId: string, label: string, before: string, after: string) => void
  >
  commitPosterTreatmentHistoryRef: RefObject<
    (artboardId: string, label: string, before: string, after: string) => void
  >
  commitObjectPatchHistoryRef: RefObject<
    (objectId: string, label: string, before: string, after: string) => void
  >
  commitLayerOrderHistoryRef: RefObject<(label: string, before: string, after: string) => void>
  onHistoryCommit?: (info: {
    reason: 'commit' | 'reset'
    op: HistoryOp
    ops: HistoryOp[]
    cursor: number
  }) => void
  onHistoryCursorChange?: (opId: string | null, cursor: number) => void
}

export function useEditorHistory({
  canvasRef,
  setStatus,
  syncSelected,
  syncLayers,
  scheduleAutosave,
  captureStyleBaseline,
  onAfterRestore,
  onTreatmentRestore,
  onPosterTreatmentRestore,
  commitHistoryRef,
  commitTreatmentHistoryRef,
  commitPosterTreatmentHistoryRef,
  commitObjectPatchHistoryRef,
  commitLayerOrderHistoryRef,
  onHistoryCommit,
  onHistoryCursorChange,
}: UseEditorHistoryOptions) {
  const historyLogRef = useRef<HistoryState>(createHistoryState())
  const restoringRef = useRef(false)
  const onHistoryCommitRef = useRef(onHistoryCommit)
  const onHistoryCursorChangeRef = useRef(onHistoryCursorChange)
  onHistoryCommitRef.current = onHistoryCommit
  onHistoryCursorChangeRef.current = onHistoryCursorChange

  const notifyCursor = useCallback(() => {
    const state = historyLogRef.current
    onHistoryCursorChangeRef.current?.(state.ops[state.cursor]?.id ?? null, state.cursor)
  }, [])

  const notifyCommit = useCallback((reason: 'commit' | 'reset') => {
    const state = historyLogRef.current
    const op = state.ops[state.cursor]
    if (!op) return
    onHistoryCommitRef.current?.({ reason, op, ops: state.ops, cursor: state.cursor })
  }, [])

  const restoreSnapshot = useCallback(
    async (snapshot: string, message: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      restoringRef.current = true
      const parsed = JSON.parse(snapshot) as Record<string, unknown>
      await ensureLibraryFonts(collectFontFamilies(parsed))
      await withLayerSyncSuppressed(async () => {
        await canvas.loadFromJSON(parsed)
        await onAfterRestore()
      })
      restoringRef.current = false
      canvas.requestRenderAll()
      captureStyleBaseline()
      syncSelected()
      syncLayers()
      setStatus(message)
    },
    [canvasRef, captureStyleBaseline, onAfterRestore, setStatus, syncLayers, syncSelected],
  )

  const applyRestoreAction = useCallback(
    async (action: NonNullable<ReturnType<typeof restoreActionForUndo>>) => {
      if (action.kind === 'snapshot') {
        await restoreSnapshot(action.data, action.label)
        return
      }
      if (action.kind === 'posterTreatment') {
        restoringRef.current = true
        await onPosterTreatmentRestore(action.artboardId, action.treatmentsJson)
        restoringRef.current = false
        const canvas = canvasRef.current
        canvas?.requestRenderAll()
        syncSelected()
        syncLayers()
        setStatus(action.label)
        return
      }
      if (action.kind === 'objectPatch') {
        const canvas = canvasRef.current
        const object =
          canvas?.getObjects().find((item) => String(readObjectProp(item, 'id') ?? '') === action.objectId) ??
          null
        if (object) {
          restoringRef.current = true
          applyObjectPatch(object, action.patchJson)
          restoringRef.current = false
          canvas?.requestRenderAll()
          syncSelected()
          syncLayers()
        }
        setStatus(action.label)
        return
      }
      if (action.kind === 'layerOrder') {
        const canvas = canvasRef.current
        if (canvas) {
          restoringRef.current = true
          applyLayerOrder(canvas, action.orderJson)
          restoringRef.current = false
          canvas.requestRenderAll()
          syncSelected()
          syncLayers()
        }
        setStatus(action.label)
        return
      }
      restoringRef.current = true
      await onTreatmentRestore(action.objectId, action.treatmentsJson)
      restoringRef.current = false
      const canvas = canvasRef.current
      canvas?.requestRenderAll()
      syncSelected()
      syncLayers()
      setStatus(action.label)
    },
    [canvasRef, onPosterTreatmentRestore, onTreatmentRestore, restoreSnapshot, setStatus, syncLayers, syncSelected],
  )

  const commitHistory = useCallback(
    (message: string) => {
      const canvas = canvasRef.current
      if (!canvas || restoringRef.current) return
      const snapshot = JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[]))
      const lastOp = historyLogRef.current.ops[historyLogRef.current.cursor]
      if (lastOp?.type === 'snapshot' && lastOp.data === snapshot) {
        syncSelected()
        syncLayers()
        setStatus(message)
        return
      }
      historyLogRef.current = pushHistoryOp(historyLogRef.current, {
        type: 'snapshot',
        label: message,
        data: snapshot,
      })
      scheduleAutosave()
      if (!message.endsWith(' preset')) captureStyleBaseline()
      syncSelected()
      syncLayers()
      setStatus(message)
      notifyCommit('commit')
    },
    [canvasRef, captureStyleBaseline, notifyCommit, scheduleAutosave, setStatus, syncLayers, syncSelected],
  )

  const pushIncrementalOp = useCallback(
    (op: Exclude<HistoryOp, { type: 'snapshot' }>, label: string) => {
      const canvas = canvasRef.current
      if (!canvas || restoringRef.current) return
      if ('before' in op && 'after' in op && op.before === op.after) return

      if (shouldSnapshot(historyLogRef.current)) {
        const snapshot = JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[]))
        historyLogRef.current = pushHistoryOp(historyLogRef.current, {
          type: 'snapshot',
          label,
          data: snapshot,
        })
      } else {
        historyLogRef.current = pushHistoryOp(historyLogRef.current, op)
      }

      scheduleAutosave()
      syncSelected()
      syncLayers()
      setStatus(label)
      notifyCommit('commit')
    },
    [canvasRef, notifyCommit, scheduleAutosave, setStatus, syncLayers, syncSelected],
  )

  const commitTreatmentHistory = useCallback(
    (objectId: string, label: string, before: string, after: string) => {
      pushIncrementalOp({ type: 'treatment', label, objectId, before, after }, label)
    },
    [pushIncrementalOp],
  )

  const commitPosterTreatmentHistory = useCallback(
    (artboardId: string, label: string, before: string, after: string) => {
      pushIncrementalOp({ type: 'posterTreatment', label, artboardId, before, after }, label)
    },
    [pushIncrementalOp],
  )

  const commitObjectPatchHistory = useCallback(
    (objectId: string, label: string, before: string, after: string) => {
      pushIncrementalOp({ type: 'objectPatch', label, objectId, before, after }, label)
    },
    [pushIncrementalOp],
  )

  const commitLayerOrderHistory = useCallback(
    (label: string, before: string, after: string) => {
      pushIncrementalOp({ type: 'layerOrder', label, before, after }, label)
    },
    [pushIncrementalOp],
  )

  const undoAsync = useCallback(async () => {
    const action = restoreActionForUndo(historyLogRef.current)
    if (!action) return
    historyLogRef.current = {
      ...historyLogRef.current,
      cursor: historyLogRef.current.cursor - 1,
    }
    await applyRestoreAction(action)
    notifyCursor()
  }, [applyRestoreAction, notifyCursor])

  const redo = useCallback(() => {
    const action = restoreActionForRedo(historyLogRef.current)
    if (!action) return
    historyLogRef.current = {
      ...historyLogRef.current,
      cursor: historyLogRef.current.cursor + 1,
    }
    void applyRestoreAction(action).then(() => notifyCursor())
  }, [applyRestoreAction, notifyCursor])

  const resetHistory = useCallback(
    (snapshot: string, label: string) => {
      historyLogRef.current = pushHistoryOp(createHistoryState(), {
        type: 'snapshot',
        label,
        data: snapshot,
      })
      notifyCommit('reset')
    },
    [notifyCommit],
  )

  const jumpToOpId = useCallback(
    async (opId: string) => {
      const state = historyLogRef.current
      const target = indexOfOp(state, opId)
      if (target < 0 || target === state.cursor) return
      const actions = jumpRestoreActions(state, target)
      historyLogRef.current = { ...state, cursor: target }
      restoringRef.current = true
      try {
        for (const action of actions) {
          if (!action) continue
          await applyRestoreAction(action)
          restoringRef.current = true
        }
      } finally {
        restoringRef.current = false
      }
      const op = historyLogRef.current.ops[target]
      if (op) setStatus(op.label)
      notifyCursor()
    },
    [applyRestoreAction, notifyCursor, setStatus],
  )

  commitHistoryRef.current = commitHistory
  commitTreatmentHistoryRef.current = commitTreatmentHistory
  commitPosterTreatmentHistoryRef.current = commitPosterTreatmentHistory
  commitObjectPatchHistoryRef.current = commitObjectPatchHistory
  commitLayerOrderHistoryRef.current = commitLayerOrderHistory

  return {
    historyLogRef,
    restoringRef,
    commitHistory,
    commitTreatmentHistory,
    commitPosterTreatmentHistory,
    commitObjectPatchHistory,
    commitLayerOrderHistory,
    restoreSnapshot,
    undoAsync,
    redo,
    resetHistory,
    jumpToOpId,
  }
}
