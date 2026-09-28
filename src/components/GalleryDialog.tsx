import { useEffect, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { handleGalleryKeyDown } from './galleryKeys'

export type GalleryDialogProps = {
  /** id of the heading that names the dialog. */
  labelledBy: string
  className?: string
  onClose: () => void
  children: ReactNode
}

/**
 * Modal shell for the asset galleries, built on the native `<dialog>`: `showModal()` puts it in
 * the top layer and makes the editor behind it inert, so Tab stays inside and pointer events
 * can't reach the canvas. Focus returns to whatever opened it. Escape and a click on the
 * backdrop call `onClose`; the parent owns open state by mounting and unmounting this.
 */
export function GalleryDialog({ labelledBy, className, onClose, children }: GalleryDialogProps) {
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
    dialog.focus()
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
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
      className={['gallery-dialog glass-panel', className].filter(Boolean).join(' ')}
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault()
        onCloseRef.current()
      }}
      onKeyDown={(event) => handleGalleryKeyDown(event, () => onCloseRef.current())}
      onClick={closeOnBackdrop}
    >
      {children}
    </dialog>
  )
}
