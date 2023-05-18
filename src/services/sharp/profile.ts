import { AvifOptions, JpegOptions, PngOptions, ResizeOptions, WebpOptions } from 'sharp'

export type SharpProfile = {
  name?: string
  transform?: {
    resize?: ResizeOptions
    rotate?: number
  }
  export: {
    jpeg?: JpegOptions | true
    png?: PngOptions | true
    webp?: WebpOptions | true
    avif?: AvifOptions | true
  }
  output?: {
    fileName?: {
      append?: string
      prepend?: string
      alias?: string
      aliasSeparator?: string
    }
    dir?: string
  }
}
