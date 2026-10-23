import { describe, expect, it } from 'vitest'
import { applyCopyMachineChain, COPY_MACHINE_DEFAULTS } from './copyMachine'
import { applyCopyMachineChainAsync, createLatestPerKey } from './copyMachineWorkerClient'

class ImageDataPolyfill {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight?: number,
    height?: number,
  ) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth
      this.height = widthOrHeight ?? dataOrWidth
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
      return
    }
    this.data = dataOrWidth
    this.width = widthOrHeight ?? 0
    this.height = height ?? 0
  }
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = ImageDataPolyfill as typeof ImageData
}

describe('copyMachineWorkerClient', () => {
  it('falls back to the main thread and stays deterministic when Worker is missing', async () => {
    const source = new ImageData(4, 4)
    source.data.fill(180)
    const treatments = [{ seed: 4719, enabled: true, params: { ...COPY_MACHINE_DEFAULTS } }]
    const sync = applyCopyMachineChain(source, treatments)
    const asyncResult = await applyCopyMachineChainAsync(source, treatments)
    expect(Array.from(asyncResult.data)).toEqual(Array.from(sync.data))
  })
})

describe('createLatestPerKey', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  it('runs one task per key and skips the requests a newer one replaced', async () => {
    const run = createLatestPerKey<string>()
    const first = deferred<string>()
    const started: string[] = []
    const task = (name: string, result?: Promise<string>) => () => {
      started.push(name)
      return result ?? Promise.resolve(name)
    }
    const a = run('layer', task('a', first.promise))
    const b = run('layer', task('b'))
    const c = run('layer', task('c'))
    // Another layer never waits on this one.
    expect(await run('other', task('x'))).toBe('x')
    first.resolve('a')
    expect(await a).toBe('a')
    expect(await b).toBeNull()
    expect(await c).toBe('c')
    expect(started).toEqual(['a', 'x', 'c'])
  })

  it('runs sequential requests in full', async () => {
    const run = createLatestPerKey<number>()
    expect(await run('layer', () => Promise.resolve(1))).toBe(1)
    expect(await run('layer', () => Promise.resolve(2))).toBe(2)
  })

  it('moves on after a failed task', async () => {
    const run = createLatestPerKey<number>()
    const failing = run('layer', () => Promise.reject(new Error('worker died')))
    const next = run('layer', () => Promise.resolve(3))
    await expect(failing).rejects.toThrow('worker died')
    expect(await next).toBe(3)
  })
})
