import { AvifOptions, JpegOptions, PngOptions, ResizeOptions, WebpOptions } from 'sharp'

export type TransformProfile = {
  name?: string
  /**
   * File or files to transform:
   * - file path: specified image file, example: image/1.jpg
   * - directory: all files in images/raw/ and sub directories, example: images/raw/
   * - glob pattern: use glob pattern to select files, example:
   *   + images/raw/*.jpg      // all jpg files in images/raw/
   *   + images/raw/**\/*.{jpg,png}   // all jpg and png files in images/raw/, include sub directories
   */
  source?: string | string[]
  transform?: {
    keepMeta?: boolean
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
