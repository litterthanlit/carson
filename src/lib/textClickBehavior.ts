import { Textbox, type TPointerEvent } from 'fabric'

/**
 * Fabric puts a text layer into edit mode when an already-selected one is
 * clicked again. With the Move tool that turns a plain second click into a
 * text cursor, and Cmd+C then copies characters instead of the layer.
 *
 * Carson follows the Photoshop convention instead:
 * - Move tool (and every other tool): a single click only selects; a double
 *   click edits.
 * - Text tool: a single click on a text layer edits it.
 *
 * Fabric binds these handlers from the prototype when a text object is built,
 * so they are replaced on the prototype once, before any poster loads.
 */

type ClickOptions = { e: TPointerEvent }

type ClickableText = {
  isEditing: boolean
  editable: boolean
  selected: boolean
  group?: { interactive?: boolean }
  enterEditing: (e?: TPointerEvent) => void
  mouseUpHandler: (options: ClickOptions) => void
  doubleClickHandler: (options: ClickOptions) => void
}

let editOnSingleClick = false
let installed = false

/** The Text tool edits on a single click; every other tool waits for a double click. */
export function setTextEditOnSingleClick(value: boolean) {
  editOnSingleClick = value
}

export function installTextClickBehavior() {
  if (installed) return
  installed = true
  const proto = Textbox.prototype as unknown as ClickableText
  const mouseUp = proto.mouseUpHandler
  const doubleClick = proto.doubleClickHandler

  proto.mouseUpHandler = function (this: ClickableText, options: ClickOptions) {
    // Fabric enters editing on mouse up when `selected` is set; while already
    // editing it must stay set so clicks keep placing the cursor.
    if (!this.isEditing) this.selected = editOnSingleClick
    mouseUp.call(this, options)
  }

  proto.doubleClickHandler = function (this: ClickableText, options: ClickOptions) {
    const leftButton = !(options.e as MouseEvent).button
    const reachable = !this.group || this.group.interactive
    if (!this.isEditing && this.editable && leftButton && reachable) this.enterEditing(options.e)
    doubleClick.call(this, options)
  }
}
