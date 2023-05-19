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
    /**
     * Format of output file name
     *   {name} - new name (without ext)
     *   {ext} - new extension
     *   {orgName} - original file name
     *   {orgExt} - original file extension
     */
    fileNameFormat?: string

    // Replace filename before process for new filename
    fileNameReplace?: Record<string, string>
    dir?: string
  }
}
