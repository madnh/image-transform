import { Args, Command, Flags } from '@oclif/core'
import { cwdPath } from '../utils/paths'

import sharp from 'sharp'
import pLimit from 'p-limit'

import SharpTransform from '../services/sharp/transform'
import { SharpProfile } from '../services/sharp/profile'

export default class Transform extends Command {
  static description =
    'Manually transform images, if `--width` and `--height`` are not provided, the image will be keep original size'

  static examples = [
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --webp',
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --webp --width 500 --out images/optimized',
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --avif --png --height=300',
    '<%= config.bin %> <%= command.id %> images/image-1.jpg -w 1000 --webp --avif --png --alias small --aliasSeparator=@',
  ]

  static flags = {
    withEnlargement: Flags.boolean({
      default: false,
      description: 'Allow image enlargements',
    }),
    width: Flags.integer({
      char: 'w',
      helpValue: '1000',
      description: 'Resize width, default is auto scale with height',
    }),

    height: Flags.integer({
      char: 'h',
      description: 'Resize height, default is auto scale with width',
    }),

    alias: Flags.string({
      description: 'Alias name of exported images',
    }),
    aliasSeparator: Flags.string({
      description: 'String to join alias and file name',
      default: '__',
    }),

    jpg: Flags.boolean({
      default: false,
      aliases: ['jpeg'],
      description: 'Export to jpg',
    }),
    png: Flags.boolean({
      default: false,
      description: 'Export to png',
    }),
    webp: Flags.boolean({
      default: false,
      description: 'Export to webp',
    }),
    avif: Flags.boolean({
      default: false,
      description: 'Export to avif',
    }),

    out: Flags.string({
      char: 'o',
      description: 'Output directory, if omit then use the same directory with input file',
    }),
  }

  static args = {
    file: Args.file({ required: true, description: 'Image file to to transform' }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Transform)

    const imageFile = cwdPath(args.file)

    this.log('Image', imageFile)

    const rawSharp = sharp(imageFile)

    const meta = await rawSharp.metadata()
    const width = flags.width
    const height = flags.height

    this.log(' - Format:', meta.format)
    this.log(' - Width:', meta.width)
    this.log(' - Height:', meta.height)

    const profile: SharpProfile = {
      transform: {
        resize: {
          width,
          height,
          withoutEnlargement: !flags.withEnlargement,
          fit: 'contain',
        },
      },
      export: {},
      output: {
        dir: flags.out,
        fileName: {
          alias: flags.alias,
          aliasSeparator: flags.aliasSeparator,
        },
      },
    }

    if (flags.jpg) {
      profile.export.jpeg = true
    }

    if (flags.png) {
      profile.export.png = true
    }

    if (flags.webp) {
      profile.export.webp = true
    }

    if (flags.avif) {
      profile.export.avif = true
    }

    const transform = new SharpTransform(profile, rawSharp)

    const limit = pLimit(1)
    const exportPromises = transform.export(imageFile).map((fn) => limit(fn))
    await Promise.all(exportPromises)

    this.log('Done')
  }
}
