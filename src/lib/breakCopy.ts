/**
 * Ray Gun copy breaker — turns ordinary copy into dense, zero-space,
 * erratically mid-word hyphenated vertical/editorial type columns:
 *
 *   RAYGUNPO-
 *   P50RG584046WORD-
 *   SROBE-
 *   RTPLANTANDJIMM-
 *   Y
 *
 * Pure, deterministic, seeded, and headless-testable. The source string is
 * preserved on the layer (`rawCopySource`) so re-rolling generates fresh
 * breaks without losing the original words or doubling hyphens.
 */
import { createSeededRandom } from './random'

export const RAW_COPY_SOURCE_KEY = 'rawCopySource'

export type BreakCopyOptions = {
  /** Hyphen character appended to broken lines (defaults to '–' / '-'). */
  hyphen?: string
  /** Uppercase the stream (defaults to true, matching Ray Gun display setting). */
  uppercase?: boolean
  /** Preferred average characters per long line (defaults to 14). */
  maxLine?: number
}

export type BrokenCopyResult = {
  text: string
  lineHeight: number
  charSpacing: number
}

/** Collapse whitespace and strip existing break-hyphens when re-breaking raw copy. */
export function normalizeCopyStream(input: string, uppercase = true): string {
  const collapsed = input.replace(/\s+/g, '')
  return uppercase ? collapsed.toUpperCase() : collapsed
}

/**
 * Break continuous copy into erratic Ray Gun lines with abrupt mid-word
 * hyphenation and occasional 1–2 character orphan lines.
 */
export function breakRayGunCopy(
  source: string,
  seed: number,
  options: BreakCopyOptions = {},
): BrokenCopyResult {
  const hyphen = options.hyphen ?? '-'
  const uppercase = options.uppercase ?? true
  const maxLine = Math.max(6, Math.min(28, Math.round(options.maxLine ?? 15)))
  const stream = normalizeCopyStream(source, uppercase)
  if (stream.length <= 3) {
    return { text: stream || source, lineHeight: 0.88, charSpacing: -15 }
  }

  const rand = createSeededRandom(seed)
  const lines: string[] = []
  let cursor = 0
  let lastWasShort = false
  let lastWasOrphan = false

  while (cursor < stream.length) {
    const remaining = stream.length - cursor
    if (remaining <= 2) {
      lines.push(stream.slice(cursor))
      break
    }

    let take: number
    const roll = rand()
    if (!lastWasOrphan && lines.length >= 2 && remaining > 5 && roll < 0.16) {
      // Occasional dramatic 1–2 char orphan line (like "Y" or "LE"), no trailing hyphen.
      take = rand() < 0.6 ? 1 : 2
      lastWasOrphan = true
      lastWasShort = true
      lines.push(stream.slice(cursor, cursor + take))
      cursor += take
      continue
    }

    if (!lastWasShort && roll < 0.48) {
      // Abrupt short cut line (4–8 chars).
      take = Math.min(remaining, Math.max(4, Math.round(4 + rand() * 4)))
      lastWasShort = true
    } else {
      // Dense long run (10–maxLine chars).
      const minLong = Math.min(maxLine, Math.max(8, maxLine - 5))
      take = Math.min(remaining, Math.round(minLong + rand() * (maxLine - minLong)))
      lastWasShort = false
    }
    lastWasOrphan = false

    // Avoid leaving a bare 0-char tail; allow a 1–2 char orphan at the very end!
    const chunk = stream.slice(cursor, cursor + take)
    cursor += take
    const needsHyphen = cursor < stream.length && !chunk.endsWith('-') && !chunk.endsWith('–')
    lines.push(needsHyphen ? `${chunk}${hyphen}` : chunk)
  }

  return {
    text: lines.join('\n'),
    lineHeight: 0.88,
    charSpacing: -15,
  }
}
