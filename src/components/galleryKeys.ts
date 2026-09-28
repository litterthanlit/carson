import type { KeyboardEvent } from 'react'

/**
 * Keys pressed inside a gallery dialog belong to the dialog. Stopping propagation keeps
 * them from reaching the editor's window shortcuts (Backspace would delete the layer
 * being previewed, Escape would deselect it). Escape closes the dialog.
 */
export function handleGalleryKeyDown(event: KeyboardEvent, onClose: () => void) {
  event.stopPropagation()
  if (event.key === 'Escape') {
    event.preventDefault()
    onClose()
  }
}
