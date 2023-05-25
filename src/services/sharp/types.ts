import { Stats } from 'node:fs'

import { Sharp, Metadata, ResizeOptions, JpegOptions, AvifOptions, PngOptions, WebpOptions } from 'sharp'

import { RorateFnOptions } from './actions/rotate'

export type TransformSource = {
  sharp: Sharp | null
  meta: Metadata | null
  info: {
    file: string
    fileExt: string
    width?: number
    height?: number
    size: number
    stat: Stats | null
  }
}

export type TransformAction = {
  name?: string
  keepMeta?: boolean
  resize?: ResizeOptions
  rotate?: RorateFnOptions
}

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
  transform?: TransformAction | TransformAction[]
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
     *   {orgNameExt} - original file name with extension
     */
    fileNameFormat?: string

    // Replace filename before process for new filename
    fileNameReplace?: Record<string, string>
    dir?: string
  }
}

export type SharpHandler<O extends any> = (sharp: Sharp, options: O) => Promise<Sharp>
export type SharpFn = (sharp: Sharp) => Promise<Sharp>
export type ExportFn = (dir?: string) => Promise<void>
