/**
 * Save a file to the user's disk: the File System Access save picker where the
 * browser has one (the user picks the folder), a plain download elsewhere.
 *
 * Choose the target first, while the click that asked for it still counts as a
 * user gesture, then build the bytes and write them.
 */

export type SaveTarget = { write: (blob: Blob) => Promise<void> }

type FileType = { description: string; accept: Record<string, string[]> }

type WritableStream = { write: (data: Blob) => Promise<void>; close: () => Promise<void> }
type SavePicker = (options: { suggestedName: string; types: FileType[] }) => Promise<{
  createWritable: () => Promise<WritableStream>
}>

function downloadTarget(fileName: string): SaveTarget {
  return {
    async write(blob) {
      const link = document.createElement('a')
      const href = URL.createObjectURL(blob)
      link.href = href
      link.download = fileName
      link.rel = 'noopener'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoking straight away can cancel a large download before it starts.
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000)
    },
  }
}

/** Resolves to null when the user cancels the picker. */
export async function chooseSaveTarget(fileName: string, type: FileType): Promise<SaveTarget | null> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker
  if (typeof picker !== 'function') return downloadTarget(fileName)
  let handle: Awaited<ReturnType<SavePicker>>
  try {
    handle = await picker.call(window, { suggestedName: fileName, types: [type] })
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return null
    // No user gesture (command run by an agent), or a sandboxed frame: download instead.
    return downloadTarget(fileName)
  }
  return {
    async write(blob) {
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
    },
  }
}
