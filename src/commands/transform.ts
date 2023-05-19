import { Args, Command, Flags, ux } from '@oclif/core'
import { cwdPath } from '../utils/paths'

import sharp, { OutputInfo } from 'sharp'
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

    keepMeta: Flags.boolean({
      default: false,
      description: 'Keep image meta data',
    }),

    out: Flags.string({
      char: 'o',
      description: 'Output directory, if omit then use the same directory with input file',
    }),

    watch: Flags.boolean({
      default: false,
      description: 'Watch file changes',
    }),

    watchInitial: Flags.boolean({
      default: false,
      description: 'Watch file changes, and run initial transform for current file',
    }),
  }

  static args = {
    file: Args.file({ required: true, description: 'Image file to to transform' }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Transform)

    const imageFile = cwdPath(args.file)

    this.log('Image', imageFile)

    const profile = await this.getProfile()

    if (flags.watch) {
      this.log('Watching file changes...')
      await this.runWatch(imageFile, profile, flags.watchInitial)
    } else {
      await this.runOne(imageFile, profile)
    }
  }

  async runWatch(imageFile: string, profile: SharpProfile, initial = false): Promise<void> {
    const chokidar = require('chokidar')
    const watcher = chokidar.watch(imageFile, {
      persistent: true,
      awaitWriteFinish: true,
      ignoreInitial: !initial,
    })

    watcher.on('all', async () => {
      this.log('File changed')
      await this.runOne(imageFile, profile)
    })
  }

  runOne(imageFile: string, profile: SharpProfile): Promise<any> {
    return this.transformFile(imageFile, profile)
  }

  async getProfile(): Promise<SharpProfile> {
    const { flags } = await this.parse(Transform)

    const width = flags.width
    const height = flags.height

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

    return profile
  }

  async transformFile(imageFile: string, profile: SharpProfile): Promise<OutputInfo[]> {
    const rawSharp = sharp(imageFile)

    if (this.flags.keepMeta) {
      rawSharp.withMetadata()
    }

    const meta = await rawSharp.metadata()
    this.log(' - Format:', meta.format)
    this.log(' - Width:', meta.width)
    this.log(' - Height:', meta.height)

    const transform = new SharpTransform(profile, rawSharp)

    const limit = pLimit(1)
    const exportPromises = transform.export(imageFile).map((fn) => limit(fn))

    ux.action.start('Transforming')
    const result = await Promise.all(exportPromises)
    ux.action.stop()
    return result
  }
}
