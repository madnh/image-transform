import { Stats } from 'node:fs'

import { Sharp, Metadata } from 'sharp'

export type TransformSource = {
  type: 'file' | 'buffer'
  sharp: Sharp | null
  meta: Metadata | null
  info: {
    file?: string
    fileExt?: string
    width?: number
    height?: number
    size?: number
    stat: Stats | null
  }
}
