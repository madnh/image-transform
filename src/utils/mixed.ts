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
