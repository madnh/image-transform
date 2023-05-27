import { AnimationOptions, OutputOptions } from 'sharp'
import { z, ZodType } from 'zod'

import { ResizeActionOptions } from './actions/resize'
import { TransformAction, TransformProfile } from './types'

export const transformActionResizeSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  fit: z.enum(['contain', 'cover', 'fill', 'inside', 'outside']).optional() satisfies ZodType<
    ResizeActionOptions['fit']
  >,
  position: z.union([z.string(), z.number()]).optional(),
  background: z.string().optional(),
  withoutEnlargement: z.boolean().optional(),
  withoutReduction: z.boolean().optional(),
  fastShrinkOnLoad: z.boolean().optional(),
  kernel: z.enum(['nearest', 'cubic', 'mitchell', 'lanczos2']).optional() satisfies ZodType<
    ResizeActionOptions['kernel']
  >,
}) satisfies ZodType<TransformAction['resize']>

export const transformActionRotateSchema = z.object({
  angle: z.number(),
  options: z
    .object({
      background: z
        .union([
          z.string(),
          z.object({
            r: z.number().optional(),
            g: z.number().optional(),
            b: z.number().optional(),
            alpha: z.number().optional(),
          }),
        ])
        .optional(),
    })
    .optional(),
}) satisfies ZodType<TransformAction['rotate']>

export const TransformActionSchema = z.object({
  name: z.string().optional(),
  keepMeta: z.boolean().optional(),
  resize: transformActionResizeSchema.optional(),
  rotate: transformActionRotateSchema.optional(),
}) satisfies ZodType<TransformAction>

const sharpOutputOptionsSchema = z.object({
  force: z.boolean().optional(),
}) satisfies ZodType<OutputOptions>

const animationOptionsSchema = z.object({
  loop: z.number().optional(),
  delay: z.number().optional(),
}) satisfies ZodType<AnimationOptions>

export const exportJpegOptionsSchema = sharpOutputOptionsSchema.merge(
  z.object({
    quality: z.number().optional(),
    progressive: z.boolean().optional(),
    chromaSubsampling: z.string().optional(),
    trellisQuantisation: z.boolean().optional(),
    overshootDeringing: z.boolean().optional(),
    optimiseScans: z.boolean().optional(),
    optimiseCoding: z.boolean().optional(),
    optimizeCoding: z.boolean().optional(),
    quantisationTable: z.number().optional(),
    quantizationTable: z.number().optional(),
    mozjpeg: z.boolean().optional(),
  })
) satisfies ZodType<TransformProfile['export']['jpeg']>

export const exportPngOptionsSchema = sharpOutputOptionsSchema.merge(
  z.object({
    progressive: z.boolean().optional(),
    compressionLevel: z.number().optional(),
    adaptiveFiltering: z.boolean().optional(),
    quality: z.number().optional(),
    effort: z.number().optional(),
    palette: z.boolean().optional(),
    colors: z.number().optional(),
    dither: z.number().optional(),
  })
) satisfies ZodType<TransformProfile['export']['png']>

export const exportWebpOptionsSchema = sharpOutputOptionsSchema.merge(
  animationOptionsSchema.merge(
    z.object({
      quality: z.number().optional(),
      alphaQuality: z.number().optional(),
      lossless: z.boolean().optional(),
      nearLossless: z.boolean().optional(),
      smartSubsample: z.boolean().optional(),
      effort: z.number().optional(),
      minSize: z.number().optional(),
      mixed: z.boolean().optional(),
    })
  )
) satisfies ZodType<TransformProfile['export']['webp']>

export const exportAvifOptionsSchema = sharpOutputOptionsSchema.merge(
  z.object({
    quality: z.number().optional(),
    lossless: z.boolean().optional(),
    effort: z.number().optional(),
    chromaSubsampling: z.string().optional(),
  })
) satisfies ZodType<TransformProfile['export']['avif']>

export const ProfileSchema = z.object({
  name: z.string().optional(),
  source: z.union([z.string(), z.array(z.string())]).optional(),
  transform: z.union([TransformActionSchema, z.array(TransformActionSchema)]).optional(),

  export: z.object({
    jpeg: z.union([exportJpegOptionsSchema, z.literal(true)]).optional(),
    png: z.union([exportPngOptionsSchema, z.literal(true)]).optional(),
    webp: z.union([exportWebpOptionsSchema, z.literal(true)]).optional(),
    avif: z.union([exportAvifOptionsSchema, z.literal(true)]).optional(),
  }),
  output: z
    .object({
      fileNameFormat: z.string().optional(),
      fileNameReplace: z.record(z.string()).optional(),
      dir: z.string().optional(),
    })
    .optional(),
}) satisfies ZodType<TransformProfile>
