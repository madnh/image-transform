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
  newName?: string
  append?: string
  prepend?: string
}
export type ChangeNameResult = {
  dir: string
  file: string
  newName: string
  newExt: string
  newNameWithExt: string
}

export function changeName(file: string, options: ChangeNameOptions): ChangeNameResult {
  const currentExt = path.extname(file)
  const currentNameWithoutExt = path.basename(file, currentExt)
  const currentDir = path.dirname(file)

  const newExt = options.ext || currentExt.slice(1) // remove dot if use current ext
  let newName = options.newName || currentNameWithoutExt

  if (options.append) {
    newName = `${newName}${options.append}`
  }

  if (options.prepend) {
    newName = `${options.prepend}${newName}`
  }

  const newNameWithExt = `${newName}.${newExt}`
  const newDir = options.dir || currentDir
  const newFile = path.join(newDir, newNameWithExt)

  return {
    dir: newDir,
    file: newFile,
    newName,
    newExt,
    newNameWithExt,
  }
}
