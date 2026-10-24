import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

export type DialogProps = {
  /** id of the heading that names the dialog. */
  labelledBy?: string
  /** Accessible name when there is no visible heading. */
  label?: string
  className?: string
  /** Escape, and a click on the backdrop unless `closeOnBackdrop` is false. */
  onClose: () => void
  /** Dialogs that ask a question (unsaved work) keep a stray click from answering it. */
  closeOnBackdrop?: boolean
  /** 'top' sits the dialog high on the screen, like a search bar. */
  placement?: 'center' | 'top'
  children: ReactNode
}

/**
 * The one modal shell every dialog uses, built on the native `<dialog>`. `showModal()` puts it in
 * the top layer and makes the editor behind it inert, so Tab stays inside and pointer events can't
 * reach the canvas. Keys pressed inside never reach the editor's window shortcuts. Focus moves to
 * the element marked `data-autofocus` (or the dialog itself) and returns to whatever opened it.
 * The parent owns open state by mounting and unmounting this.
 */
export function Dialog({
  labelledBy,
  label,
  className,
  onClose,
  closeOnBackdrop = true,
  placement = 'center',
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal()
    } else {
      // Environments without the modal API (jsdom) still get an open, labelled dialog.
      dialog.setAttribute('open', '')
    }
    const target = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog
    target.focus()
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    // Keys pressed in a dialog belong to it: Backspace in a field must not delete the selected layer.
    event.stopPropagation()
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault()
      onCloseRef.current()
    }
  }

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdrop) return
    // A click on ::backdrop targets the dialog itself, outside its box.
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
    if (!inside) onCloseRef.current()
  }

  return (
    <dialog
      ref={dialogRef}
      className={['app-dialog glass-panel', placement === 'top' ? 'app-dialog-top' : null, className].filter(Boolean).join(' ')}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault()
        onCloseRef.current()
      }}
      onKeyDown={onKeyDown}
      onClick={onBackdropClick}
    >
      {children}
    </dialog>
  )
}
