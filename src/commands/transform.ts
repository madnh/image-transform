import { Args, Flags } from '@oclif/core'
import { cwdPath } from '../utils/paths'

import sharp, { OutputInfo } from 'sharp'
import pLimit from 'p-limit'

import SharpTransform from '../services/sharp/transform'
import { SharpProfile } from '../services/sharp/profile'
import { BaseCommand } from '../BaseCommand'
import { formatSize } from '../utils/mixed'

export default class Transform extends BaseCommand<typeof Transform> {
  static description = `Transform images.

  Name format:
        {name} - new name (without ext)
        {ext} - new extension
        {orgName} - original file name
        {orgExt} - original file extension
`

  static examples = [
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --webp',
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --webp --width 500 --out images/optimized',
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --avif --png --height=300',
    `<%= config.bin %> <%= command.id %> images/image-1.jpg -w 1000 --webp --avif --png --name-format='{name}@2x.{ext}'`,
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --webp --name-remove=__raw',
  ]

  static flags = {
    withEnlargement: Flags.boolean({
      default: false,
      aliases: ['with-enlargement'],
      description: 'Allow image enlargements',
    }),
    width: Flags.integer({
      char: 'w',
      helpValue: 'number',
      description: 'Resize width, default is auto scale with height',
    }),

    height: Flags.integer({
      char: 'h',
      helpValue: 'number',
      description: 'Resize height, default is auto scale with width',
    }),

    nameFormat: Flags.string({
      aliases: ['name-format'],
      default: '{name}.{ext}',
      description: 'Format of output file name',
    }),
    nameRemove: Flags.string({
      aliases: ['name-remove'],
      description: 'Remove part of file name',
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
      aliases: ['keep-meta'],
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
      aliases: ['watch-initial'],
    }),
  }

  static args = {
    file: Args.file({ required: true, description: 'Image file to to transform' }),
  }

  public async run(): Promise<void> {
    const imageFile = cwdPath(this.args.file)

    this.logger.info('Image:', imageFile)

    const profile = await this.getProfile()

    if (this.flags.watch) {
      this.logger.info('Watching file changes...')
      await this.runWatch(imageFile, profile, this.flags.watchInitial)
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

    watcher.on('change', async () => {
      this.logger.info('File changed')
      await this.runOne(imageFile, profile)
    })
  }

  runOne(imageFile: string, profile: SharpProfile): Promise<any> {
    return this.transformFile(imageFile, profile)
  }

  async getProfile(): Promise<SharpProfile> {
    const width = this.flags.width
    const height = this.flags.height

    const profile: SharpProfile = {
      transform: {
        resize: {
          width,
          height,
          withoutEnlargement: !this.flags.withEnlargement,
        },
      },
      export: {},
      output: {
        dir: this.flags.out,
        fileNameFormat: this.flags.nameFormat,
        fileNameReplace: this.flags.nameRemove ? { [this.flags.nameRemove]: '' } : undefined,
      },
    }

    if (this.flags.jpg) {
      profile.export.jpeg = true
    }

    if (this.flags.png) {
      profile.export.png = true
    }

    if (this.flags.webp) {
      profile.export.webp = true
    }

    if (this.flags.avif) {
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
    this.logger.info(' - Format:', meta.format)
    this.logger.info(' - Width:', meta.width)
    this.logger.info(' - Height:', meta.height)
    if (meta.size !== undefined) {
      this.logger.info(' - Size:', formatSize(meta.size))
    }

    const transform = new SharpTransform(profile, rawSharp)

    const limit = pLimit(1)
    const exportPromises = transform.export(imageFile).map((fn) => limit(fn))

    this.logger.start('Transforming')
    const result = await Promise.all(exportPromises)
    this.logger.success('Transformed')

    return result
  }
}
