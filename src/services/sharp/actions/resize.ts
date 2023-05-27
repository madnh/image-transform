import { ResizeOptions, Sharp } from 'sharp'

export type ResizeActionOptions = ResizeOptions
export default async function resize(sharp: Sharp, options: ResizeActionOptions): Promise<Sharp> {
  return sharp.resize(options)
}
