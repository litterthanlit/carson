import { afterEach, describe, expect, it, vi } from 'vitest'
import { Textbox } from 'fabric'
import { installTextClickBehavior, setTextEditOnSingleClick } from './textClickBehavior'

installTextClickBehavior()

type Handlers = {
  selected: boolean
  isEditing: boolean
  editable: boolean
  enterEditing: () => void
  initDelayedCursor: () => void
  getActiveControl: () => undefined
  draggableTextDelegate: { end: () => boolean }
  mouseUpHandler: (options: { e: MouseEvent }) => void
  doubleClickHandler: (options: { e: MouseEvent }) => void
}

// A bare instance: building a real Textbox needs a 2D canvas to measure type,
// and only the click handlers on the prototype are under test.
function clickedText() {
  const text = Object.create(Textbox.prototype) as Handlers
  text.isEditing = false
  text.editable = true
  text.enterEditing = vi.fn()
  text.initDelayedCursor = vi.fn()
  text.getActiveControl = () => undefined
  text.draggableTextDelegate = { end: () => false }
  const event = { button: 0 } as MouseEvent
  // Fabric sets `selected` on mouse down when the layer was already active.
  const secondClick = () => {
    text.selected = true
    text.mouseUpHandler({ e: event })
  }
  return { text, event, secondClick }
}

afterEach(() => setTextEditOnSingleClick(false))

describe('text click behavior', () => {
  it('does not enter editing when the Move tool clicks a selected text layer', () => {
    const { text, secondClick } = clickedText()
    secondClick()
    expect(text.enterEditing).not.toHaveBeenCalled()
  })

  it('enters editing on a single click with the Text tool', () => {
    const { text, secondClick } = clickedText()
    setTextEditOnSingleClick(true)
    secondClick()
    expect(text.enterEditing).toHaveBeenCalledTimes(1)
  })

  it('enters editing on a double click with any tool', () => {
    const { text, event } = clickedText()
    text.doubleClickHandler({ e: event })
    expect(text.enterEditing).toHaveBeenCalledTimes(1)
  })

  it('ignores a right-button double click', () => {
    const { text } = clickedText()
    text.doubleClickHandler({ e: { button: 2 } as MouseEvent })
    expect(text.enterEditing).not.toHaveBeenCalled()
  })
})
