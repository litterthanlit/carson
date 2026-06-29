import { useCallback, useRef } from 'react'
import type { Canvas } from 'fabric'
import type { MutableRefObject, RefObject } from 'react'
import { HISTORY_PROPS } from '../lib/editorConstants'
import {
  createHistoryState,
  pushHistoryOp,
  restoreActionForRedo,
  restoreActionForUndo,
  shouldSnapshot,
  type HistoryState,
} from '../lib/historyLog'

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
}: UseEditorHistoryOptions) {
  const historyLogRef = useRef<HistoryState>(createHistoryState())
  const restoringRef = useRef(false)

  const restoreSnapshot = useCallback(
    async (snapshot: string, message: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      restoringRef.current = true
      await canvas.loadFromJSON(JSON.parse(snapshot))
      restoringRef.current = false
      await onAfterRestore()
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
    },
    [canvasRef, captureStyleBaseline, scheduleAutosave, setStatus, syncLayers, syncSelected],
  )

  const commitTreatmentHistory = useCallback(
    (objectId: string, label: string, before: string, after: string) => {
      const canvas = canvasRef.current
      if (!canvas || restoringRef.current) return
      if (before === after) return

      if (shouldSnapshot(historyLogRef.current)) {
        const snapshot = JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[]))
        historyLogRef.current = pushHistoryOp(historyLogRef.current, {
          type: 'snapshot',
          label,
          data: snapshot,
        })
      } else {
        historyLogRef.current = pushHistoryOp(historyLogRef.current, {
          type: 'treatment',
          label,
          objectId,
          before,
          after,
        })
      }

      scheduleAutosave()
      syncSelected()
      syncLayers()
      setStatus(label)
    },
    [canvasRef, scheduleAutosave, setStatus, syncLayers, syncSelected],
  )

  const commitPosterTreatmentHistory = useCallback(
    (artboardId: string, label: string, before: string, after: string) => {
      const canvas = canvasRef.current
      if (!canvas || restoringRef.current) return
      if (before === after) return

      if (shouldSnapshot(historyLogRef.current)) {
        const snapshot = JSON.stringify(canvas.toObject(HISTORY_PROPS as unknown as string[]))
        historyLogRef.current = pushHistoryOp(historyLogRef.current, {
          type: 'snapshot',
          label,
          data: snapshot,
        })
      } else {
        historyLogRef.current = pushHistoryOp(historyLogRef.current, {
          type: 'posterTreatment',
          label,
          artboardId,
          before,
          after,
        })
      }

      scheduleAutosave()
      syncSelected()
      syncLayers()
      setStatus(label)
    },
    [canvasRef, scheduleAutosave, setStatus, syncLayers, syncSelected],
  )

  const undoAsync = useCallback(async () => {
    const action = restoreActionForUndo(historyLogRef.current)
    if (!action) return
    historyLogRef.current = {
      ...historyLogRef.current,
      cursor: historyLogRef.current.cursor - 1,
    }
    await applyRestoreAction(action)
  }, [applyRestoreAction])

  const redo = useCallback(() => {
    const action = restoreActionForRedo(historyLogRef.current)
    if (!action) return
    historyLogRef.current = {
      ...historyLogRef.current,
      cursor: historyLogRef.current.cursor + 1,
    }
    void applyRestoreAction(action)
  }, [applyRestoreAction])

  const resetHistory = useCallback((snapshot: string, label: string) => {
    historyLogRef.current = pushHistoryOp(createHistoryState(), {
      type: 'snapshot',
      label,
      data: snapshot,
    })
  }, [])

  commitHistoryRef.current = commitHistory
  commitTreatmentHistoryRef.current = commitTreatmentHistory
  commitPosterTreatmentHistoryRef.current = commitPosterTreatmentHistory

  return {
    historyLogRef,
    restoringRef,
    commitHistory,
    commitTreatmentHistory,
    commitPosterTreatmentHistory,
    restoreSnapshot,
    undoAsync,
    redo,
    resetHistory,
  }
}
