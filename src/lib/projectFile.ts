/**
 * Carson poster files (`.carson`): one self-contained JSON file that carries a
 * poster to another browser or machine.
 *
 * A stored project already keeps its images inline as data URLs, so the file is
 * the project plus what the project needs from outside IndexedDB: the font files
 * the designer uploaded. Large data URLs are stored once in `media` and referenced
 * from the project, so a photo shared by the poster and its versions is written
 * once instead of once per version.
 *
 * Pure: no DOM, no IndexedDB. A file is untrusted input — `parseProjectFile`
 * validates the envelope and the fields the app reads, and hands `canvas` on as
 * opaque data for the same revive path a project loaded from IndexedDB takes.
 */
import { z } from 'zod'
import type { PosterPresetId } from './editorModel'
import type { StoredProject } from './storage'

export const PROJECT_FILE_FORMAT = 'carson-poster'
export const PROJECT_FILE_VERSION = 1
export const PROJECT_FILE_EXTENSION = '.carson'
export const PROJECT_FILE_MIME = 'application/vnd.carson.poster+json'

/** A font file the designer uploaded, embedded so the poster sets in it anywhere. */
export type EmbeddedFont = {
  family: string
  fileName: string
  mimeType: string
  /** The font file, base64. */
  data: string
}

/** The project as a file carries it: no id (opening makes a new project) and no last-used time. */
export type ProjectFileProject = Omit<StoredProject, 'id' | 'lastUsedAt'>

export type ProjectFile = {
  savedAt: string
  app?: string
  project: ProjectFileProject
  fonts: EmbeddedFont[]
}

export type ProjectFileErrorKind = 'not-carson' | 'too-new' | 'damaged'

export type ProjectFileError = { kind: ProjectFileErrorKind; message: string }

export type ParseProjectFileResult = { ok: true; file: ProjectFile } | { ok: false; error: ProjectFileError }

const MESSAGES: Record<ProjectFileErrorKind, string> = {
  'not-carson': 'That file isn’t a Carson poster. Choose a .carson file saved from Carson.',
  'too-new': 'This poster was saved by a newer version of Carson. Update Carson to open it.',
  damaged: 'This poster file is damaged or incomplete, so it can’t be opened.',
}

function fail(kind: ProjectFileErrorKind): ParseProjectFileResult {
  return { ok: false, error: { kind, message: MESSAGES[kind] } }
}

// ── Shared media ─────────────────────────────────────────────────────────────
// A NUL keeps the reference out of reach of anything a designer can type.
const MEDIA_REF = '\u0000carson-media:'
const MIN_MEDIA_LENGTH = 2048

type Json = unknown

function mapStrings(value: Json, transform: (text: string) => string): Json {
  if (typeof value === 'string') return transform(value)
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform))
  if (!value || typeof value !== 'object') return value
  const out: Record<string, Json> = {}
  for (const [key, item] of Object.entries(value as Record<string, Json>)) out[key] = mapStrings(item, transform)
  return out
}

function internMedia<T>(value: T): { value: T; media: string[] } {
  const media: string[] = []
  const index = new Map<string, number>()
  const mapped = mapStrings(value, (text) => {
    if (text.length < MIN_MEDIA_LENGTH || !text.startsWith('data:')) return text
    let at = index.get(text)
    if (at === undefined) {
      at = media.length
      media.push(text)
      index.set(text, at)
    }
    return `${MEDIA_REF}${at}`
  })
  return { value: mapped as T, media }
}

class MissingMedia extends Error {}

function resolveMedia<T>(value: T, media: readonly string[]): T {
  return mapStrings(value, (text) => {
    if (!text.startsWith(MEDIA_REF)) return text
    const at = Number(text.slice(MEDIA_REF.length))
    const resolved = Number.isInteger(at) ? media[at] : undefined
    if (resolved === undefined) throw new MissingMedia(text)
    return resolved
  }) as T
}

// ── Schema ───────────────────────────────────────────────────────────────────
// Only what the app reads is checked. Canvas JSON is opaque here: it goes through
// the same Fabric revive as a stored project. Unknown envelope fields are dropped;
// unknown fields inside the project are kept so nothing a newer minor build wrote is lost.

const PRESET_IDS = ['a3', 'a2', 'instagram', 'square', 'custom'] as const satisfies readonly PosterPresetId[]

const finite = z.number().refine(Number.isFinite)
const positive = finite.refine((value) => value > 0)
const canvasSchema = z.record(z.string(), z.unknown())

const presetSchema = z.looseObject({
  id: z.enum(PRESET_IDS).catch('custom'),
  name: z.string(),
  width: positive,
  height: positive,
  dpi: positive.optional(),
  widthMm: positive.optional(),
  heightMm: positive.optional(),
})

const artboardSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  preset: presetSchema,
  canvas: canvasSchema,
  posterTreatments: z.array(z.record(z.string(), z.unknown())).optional(),
  press: z.unknown().optional(),
})

const variantSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  savedAt: z.string(),
  canvas: canvasSchema,
  thumbnail: z.string().optional(),
})

const componentSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  canvas: canvasSchema,
  thumbnail: z.string().optional(),
  kind: z.enum(['object', 'stack']).optional(),
})

const records = z.array(z.record(z.string(), z.unknown()))

const documentSchema = z.looseObject({
  dpi: positive,
  bleedMm: finite.refine((value) => value >= 0),
  palette: z.array(z.string()),
  artboards: z.array(artboardSchema).min(1),
  activeArtboardId: z.string(),
  variants: z.array(variantSchema),
  components: z.array(componentSchema),
  instruments: records.optional(),
  gestures: records.optional(),
  characterStyles: records.optional(),
  paragraphStyles: records.optional(),
})

const projectSchema = z.looseObject({
  name: z.string(),
  savedAt: z.string(),
  thumbnail: z.string().optional(),
  preset: presetSchema,
  canvas: canvasSchema,
  document: documentSchema.optional(),
})

const fontSchema = z.object({
  family: z.string().trim().min(1).max(200),
  fileName: z.string().max(500),
  mimeType: z.string().max(200),
  data: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
})

const envelopeSchema = z.object({
  format: z.literal(PROJECT_FILE_FORMAT),
  version: z.number().int().positive(),
  savedAt: z.string(),
  app: z.string().optional(),
  project: projectSchema,
  fonts: z.array(fontSchema).optional(),
  media: z.array(z.string()).optional(),
})

// ── Write ────────────────────────────────────────────────────────────────────

export type SerializeProjectFileInput = {
  project: ProjectFileProject | StoredProject
  fonts?: EmbeddedFont[]
  app?: string
  savedAt?: string
}

export function serializeProjectFile({ project, fonts = [], app, savedAt = new Date().toISOString() }: SerializeProjectFileInput): string {
  const { name, savedAt: projectSavedAt, thumbnail, preset, canvas, document } = project
  const body: ProjectFileProject = { name, savedAt: projectSavedAt, preset, canvas }
  if (thumbnail) body.thumbnail = thumbnail
  if (document) body.document = document
  const { value, media } = internMedia(body)
  return JSON.stringify({
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    savedAt,
    ...(app ? { app } : {}),
    project: value,
    ...(fonts.length ? { fonts } : {}),
    ...(media.length ? { media } : {}),
  })
}

// ── Read ─────────────────────────────────────────────────────────────────────

function decode(input: string | Uint8Array | ArrayBuffer): string | null {
  if (typeof input === 'string') return input
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input)
  } catch {
    return null
  }
}

/** Does unparseable text still look like the start of a Carson file (i.e. it was cut short)? */
function looksLikeCarson(text: string) {
  const head = text.slice(0, 256)
  return /^\s*\{/.test(head) && head.includes(`"${PROJECT_FILE_FORMAT}"`)
}

export function parseProjectFile(input: string | Uint8Array | ArrayBuffer): ParseProjectFileResult {
  const decoded = decode(input)
  if (decoded === null) return fail('not-carson')
  const text = decoded.replace(/^\uFEFF/, '')

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail(looksLikeCarson(text) ? 'damaged' : 'not-carson')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('not-carson')
  const head = raw as Record<string, unknown>
  if (head.format !== PROJECT_FILE_FORMAT) return fail('not-carson')
  if (typeof head.version === 'number' && head.version > PROJECT_FILE_VERSION) return fail('too-new')

  const parsed = envelopeSchema.safeParse(raw)
  if (!parsed.success) return fail('damaged')
  const { savedAt, app, project, fonts = [], media = [] } = parsed.data

  let resolved: ProjectFileProject
  try {
    // The schema checked every field the app reads from the project and its document.
    resolved = resolveMedia(project, media) as unknown as ProjectFileProject
  } catch (error) {
    if (error instanceof MissingMedia) return fail('damaged')
    throw error
  }
  return { ok: true, file: { savedAt, ...(app ? { app } : {}), project: resolved, fonts } }
}

// ── Names and bytes ──────────────────────────────────────────────────────────

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i

/** `<poster name>.carson`, safe on every desktop file system. */
export function projectFileName(posterName: string): string {
  const cleaned = posterName
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120)
    .trim()
  const base = cleaned || 'Untitled poster'
  return `${WINDOWS_RESERVED.test(base) ? `${base} poster` : base}${PROJECT_FILE_EXTENSION}`
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at)
  return bytes
}
