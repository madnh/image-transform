import prettyBytes from 'pretty-bytes'

export function formatSize(size: number): string {
  return prettyBytes(size)
}

type PercentOptions = {
  /**
   * Show percent char
   * @default true
   */
  char?: boolean

  /**
   * Show sign char, ↓ when new value smaller than base, ↑ for otherwise
   * @default false
   */
  sign?: boolean
}

/**
 * Calculate percent of value to base
 * @param {number} base Base value
 * @param {number} value Value to calculate
 * @param {PercentOptions} options Options
 * @returns {string} Percent string
 * @example
 * ```ts
 *  percent(100, 50) // 50%
 *  percent(100, 50, { char: false}) // 50
 *  percent(100, 50, { sign: true }) // ↓ 50%
 *  percent(100, 150) // ↑ 150%
 *```
 */
export function percent(base: number, value: number, options?: PercentOptions): string {
  const { char, sign } = options || { char: true, sign: false }
  const result = Math.round((value / base) * 100)
  const signChar = value < base ? '↓' : '↑'

  return `${sign && signChar} ${result}${char ? '%' : ''}`.trim()
}

/**
 * Replace text content by object
 * @param {string} text Text to replace
 * @param {Record<string, string>} replaceMap Replace map
 * @returns {string} Replaced text
 * @example
 * ```ts
 * replace('Hello {name}', { name: 'world' }) // Hello world
 * ```
 */
/**
 * Replace text content by object
 * @param {string} text Text to replace
 * @param {Record<string, string>} replaceMap Replace map
 * @param {'empty' | 'keep' | 'keep-raw' | 'throw'} notFound Action when key not found
 * @returns {string} Replaced text
 * @example
 * ```ts
 *  replace('{name}{size}.{ext}', { name: 'image', size: '@2x', ext: 'jpg' }}') // image@2x.jpg
 *  replace('{name}{size}.{ext}', { name: 'image', ext: 'jpg' }, 'empty') // image.jpg
 *  replace('{name}{size}.{ext}', { name: 'image', ext: 'jpg' }, 'keep') // imagesize.jpg
 *  replace('{name}{size}.{ext}', { name: 'image', ext: 'jpg' }, 'keep-raw') // image{size}.jpg
 *  replace('{name}{size}.{ext}', { name: 'image', ext: 'jpg' }, 'throw') // throw error
 * ```
 */
export function replace(
  text: string,
  replaceMap: Record<string, string>,
  notFound: 'empty' | 'keep' | 'keep-raw' | 'throw' = 'keep-raw'
): string {
  return text.replace(/{([^}]+)}/g, (_, key) => {
    if (key in replaceMap) return replaceMap[key]

    switch (notFound) {
      case 'empty':
        return ''
      case 'keep':
        return key
      case 'keep-raw':
        return `{${key}}`
      case 'throw':
        throw new Error(`Key "${key}" not found in replace map`)
    }
  })
}

export function replaceAll(text: string, replaceMap: Record<string, string>): string {
  return Object.entries(replaceMap).reduce((result, [key, value]) => {
    return result.replace(new RegExp(key, 'g'), value)
  }, text)
}

export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}
