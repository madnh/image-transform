import { RotateOptions, Sharp } from 'sharp'

export type RorateActionOptions = {
  angle: number
  options?: RotateOptions
}
export default async function rotate(sharp: Sharp, options: RorateActionOptions): Promise<Sharp> {
  return sharp.rotate(options.angle, options.options)
}
