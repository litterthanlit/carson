import { useCallback, useRef, useState } from 'react'

export type AskTextOptions = {
  title: string
  label: string
  defaultValue?: string
  submitLabel?: string
}

export type AskConfirmOptions = {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  /** Deleting or replacing something: focus starts on Cancel and the confirm button reads as a warning. */
  destructive?: boolean
}

export type AskRequest = { id: number } & (({ kind: 'text' } & AskTextOptions) | ({ kind: 'confirm' } & AskConfirmOptions))

export type AskAnswer = string | boolean | null

/**
 * In-app replacements for window.prompt and window.confirm. Each ask returns a promise that
 * settles when the person answers the <AskDialog> rendered from `request`.
 */
export function useAsk() {
  const [request, setRequest] = useState<AskRequest | null>(null)
  const pendingRef = useRef<{ resolve: (answer: AskAnswer) => void; cancelled: AskAnswer } | null>(null)
  const nextIdRef = useRef(1)

  const open = useCallback((next: AskRequest, cancelled: AskAnswer) => {
    return new Promise<AskAnswer>((resolve) => {
      // A newer question replaces an unanswered one, which settles as cancelled.
      pendingRef.current?.resolve(pendingRef.current.cancelled)
      pendingRef.current = { resolve, cancelled }
      setRequest(next)
    })
  }, [])

  const askText = useCallback(
    async (options: AskTextOptions): Promise<string | null> => {
      const answer = await open({ id: nextIdRef.current++, kind: 'text', ...options }, null)
      return typeof answer === 'string' ? answer : null
    },
    [open],
  )

  const askConfirm = useCallback(
    async (options: AskConfirmOptions): Promise<boolean> => {
      const answer = await open({ id: nextIdRef.current++, kind: 'confirm', ...options }, false)
      return answer === true
    },
    [open],
  )

  const answer = useCallback((value: AskAnswer) => {
    const pending = pendingRef.current
    pendingRef.current = null
    setRequest(null)
    pending?.resolve(value)
  }, [])

  return { request, askText, askConfirm, answer }
}
