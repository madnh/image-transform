import { AvifOptions, GifOptions, JpegOptions, PngOptions, ResizeOptions, Sharp, WebpOptions } from 'sharp'

export type SharpFn = (sharp: Sharp) => Sharp
export type ExportFn = (dir?: string) => Promise<void>

/**
 * Wrapper a SharpAction fn
 * @param {SharpAction} fn Target fn
 * @returns {SharpAction} just input fn
 * @export
 * @example
 *  const fn = sharpFn(async (sharp) => sharp.resize({ width: 100, height: 100 }))
 */
export function sharpFn(fn: SharpFn): SharpFn {
  return fn
}

export function applyFns(sharp: Sharp, fns: SharpFn[]): Sharp {
  // eslint-disable-next-line unicorn/no-array-reduce
  return fns.reduce((s, fn) => fn(s), sharp)
}

export function resize(options: ResizeOptions): SharpFn {
  return (sharp: Sharp) => sharp.resize(options)
}

export function rotate(degrees: number): SharpFn {
  return (sharp: Sharp) => sharp.rotate(degrees)
}

export function jpeg(options: JpegOptions): SharpFn {
  return (sharp: Sharp) => sharp.jpeg(options)
}

export function png(options: PngOptions): SharpFn {
  return (sharp: Sharp) => sharp.png(options)
}

export function webp(options: WebpOptions): SharpFn {
  return (sharp: Sharp) => sharp.webp(options)
}

export function gif(options: GifOptions): SharpFn {
  return (sharp: Sharp) => sharp.gif(options)
}

export function avif(options: AvifOptions): SharpFn {
  return (sharp: Sharp) => sharp.avif(options)
}
