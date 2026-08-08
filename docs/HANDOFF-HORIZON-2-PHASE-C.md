# Carson — Horizon 2 Phase C Handoff (Typography depth)

**Repo:** https://github.com/litterthanlit/carson  
**Branch:** `main`  
**Parent:** [`HANDOFF-HORIZON-2.md`](./HANDOFF-HORIZON-2.md) · [`REIMAGINED.md`](./REIMAGINED.md) §8 item **2.2**

---

## Mission

Ship professional typography depth: OpenType toggles, reusable character/paragraph styles in `documentMeta`, and per-character styling via Fabric selection APIs.

---

## What shipped

| Capability | Status | Where |
|------------|--------|--------|
| OpenType toggles (kern, liga, smcp) | ✅ | `textTypography.ts` render patch · Inspector Typography card |
| Character styles (document assets) | ✅ | `documentMeta.characterStyles` · save/apply in Inspector |
| Paragraph styles (document assets) | ✅ | `documentMeta.paragraphStyles` · save/apply in Inspector |
| Per-character styling | ✅ | Double-click text → select range → Accent/Bold/Italic or apply character style |
| Text alignment control | ✅ | Inspector alignment select |
| Legacy doc migration | ✅ | `normalizeDocumentMeta()` on load |

**92 tests** · `npm test && npm run build`

---

## Architecture

```
main.tsx
  installTextTypographyRenderPatch()   // patches FabricText._setTextStyles

documentMeta
  characterStyles: CharacterStyleDef[]
  paragraphStyles: ParagraphStyleDef[]

textStyles.ts (pure)
  capture*/apply* helpers
  applySelectionCharacterPatch() → Textbox.setSelectionStyles()

App.tsx
  textSelection state ← useCanvasEvents text:selection:changed
  save/apply style handlers
```

OpenType features persist on text objects as `openTypeFeatures` (serialized via `HISTORY_PROPS`).

---

## User-facing path

1. Select text layer → Inspector → Typography
2. Toggle OpenType features (kerning, ligatures, small caps)
3. Double-click text on canvas → drag to select characters
4. Use **Accent selection** / **Bold selection** / **Italic selection**
5. **Save character style** or **Save paragraph style** → apply from dropdown on other text layers

---

## Known limits

- OpenType on canvas depends on browser support (`fontKerning`, `fontVariantCaps`, `fontFeatureSettings`)
- Ligatures toggle is best-effort where `fontFeatureSettings` is unavailable
- Character styles saved from a selection store inline props; OpenType remains object-level when applying to a range
- Styles capped at 24 per kind in documentMeta

---

## Next

- Phase D: blend-mode hover preview (2.4)
- OpenType feature detection per font (disable unsupported toggles)
- Paragraph/character style preview thumbnails in Assets tab

---

*Written 2026-08-08*
