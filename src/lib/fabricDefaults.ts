import { FabricObject, InteractiveFabricObject } from 'fabric'

/**
 * Fabric 7 positions objects by their center by default. Every authoring path in
 * Carson (seed poster, add tools, imports, textures, noise, crop marks, type strips,
 * decay marks) computes `left`/`top` as the top-left corner, so under the Fabric
 * default the wreck poster loaded half off the artboard and cover textures sat
 * offset by half their size.
 *
 * Restoring the top-left origin is Fabric's documented migration. Saved posters
 * are unaffected: `toObject()` always serializes `originX`/`originY`, so revived
 * objects keep whatever origin they were saved with.
 */
export function installFabricDefaults() {
  FabricObject.ownDefaults.originX = 'left'
  FabricObject.ownDefaults.originY = 'top'
  InteractiveFabricObject.ownDefaults.originX = 'left'
  InteractiveFabricObject.ownDefaults.originY = 'top'
}
