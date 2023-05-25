import { ResizeOptions, Sharp } from 'sharp'

export default async function resize(sharp: Sharp, options: ResizeOptions): Promise<Sharp> {
  return sharp.resize(options)
}
