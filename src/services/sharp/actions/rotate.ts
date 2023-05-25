import { RotateOptions, Sharp } from 'sharp'

export type RorateFnOptions = {
  angle: number
  options?: RotateOptions
}
export default async function rotate(sharp: Sharp, options: RorateFnOptions): Promise<Sharp> {
  return sharp.rotate(options.angle, options.options)
}
