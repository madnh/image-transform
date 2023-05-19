import { replace, replaceAll } from './mixed'

const path = require('node:path')
const fs = require('node:fs').promises

const cwd = process.cwd()

export function cwdPath(...paths: string[]): string {
  return path.join(cwd, ...paths)
}

export async function readFile(path: string): Promise<[Buffer, null] | [null, any]> {
  try {
    const result = await fs.readFile(path)

    return [result, null]
  } catch (error) {
    return [null, error]
  }
}

export type ChangeNameOptions = {
  dir?: string
  ext?: string
  name?: string
  format?: string
  formatData?: Record<string, string>
  replace?: Record<string, string>
}
export type ChangeNameResult = {
  dir: string
  file: string
  newName: string
  newExt: string
  newNameWithExt: string
}

/**
 * Change file name with format
 * @param {string} file Original file path
 * @param {ChangeNameOptions} options Options
 * @param {string} options.dir New directory
 * @param {string} options.ext New extension
 * @param {string} options.name New name
 * @param {string} options.format Format of new file name, default is `{name}.{ext}`
 * @param {Record<string, string>} options.formatData Data for format
 * @returns {ChangeNameResult} Result
 * @example
 * ```ts
 *  changeName('a/b/c.jpg', { name: 'd', ext: 'png' })
 *  // { dir: 'a/b', file: 'a/b/d.png', newName: 'd.png', newExt: 'png', newNameWithExt: 'd.png' }
 *
 *  changeName('a/b/c.jpg', { name: 'd', format: '{name}@{size}.{ext}', formatData: { size: '2x' } })
 *  // { dir: 'a/b', file: 'a/b/d@2x.jpg', newName: 'd@2x.jpg', newExt: 'jpg', newNameWithExt: 'd@2x.jpg' }
 * ```
 */
export function changeName(file: string, options: ChangeNameOptions): ChangeNameResult {
  const currentExt = path.extname(file) // extenstion with dot, e.g. .jpg, .png
  const orgExt = currentExt.slice(1) // remove dot
  const currentName = path.basename(file, currentExt) // file name without extension
  const currentDir = path.dirname(file) // directory of file

  const cleanupCurrentName = options.replace ? replaceAll(currentName, options.replace) : currentName

  const defaultFormat = `{name}.{ext}`
  let format = String(options.format || defaultFormat).trim()

  if (!format.endsWith(`.{ext}`)) {
    format = `${format}.{ext}` // add extension
  }

  const newExt = options.ext || orgExt
  const newName = options.name || cleanupCurrentName
  const newDir = options.dir || currentDir
  const rawFilename = replace(format, {
    ...options.formatData,
    name: newName,
    ext: newExt,
    orgExt,
    orgName: cleanupCurrentName,
  })

  const safeFilename = cleanupFilename(rawFilename)
  const newFile = path.join(newDir, safeFilename)

  return {
    dir: newDir,
    file: newFile,
    newName: safeFilename,
    newExt,
    newNameWithExt: safeFilename,
  }
}

/**
 * Save filename without invalid characters
 * @param {string} filename Filename
 * @returns {string} Filename without invalid characters
 * @example
 * ```ts
 * cleanupFilename('a/b/c.jpg') // c.jpg
 * cleanupFilename('../../../a/b/c.jpg') // c.jpg
 * ```
 */
export function cleanupFilename(filename: string): string {
  filename = path.basename(filename)
  return filename.replace(/["%*/:<>?\\|]/g, '')
}
