import { Args, Flags } from '@oclif/core'
import { glob } from 'glob'
import pLimit from 'p-limit'
import sharp, { OutputInfo } from 'sharp'

import { BaseCommand } from '../base-command'
import { SharpProfile } from '../services/sharp/profile'
import SharpTransform from '../services/sharp/transform'
import { formatSize, toArray } from '../utils/mixed'

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

  static args = {
    file: Args.string({
      required: true,
      description: 'Images to transform, maybe single file, dir or glob pattern',
    }),
  }

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

  public async run(): Promise<void> {
    const profile = await this.getProfile()
    const files = await this.getFiles(profile)

    this.logger.debug('Files', files)
    if (!this.flags.watch) {
      this.logger.info('Found %d file(s)', files.length)
    }

    if (!this.flags.watch) {
      this.logger.start('Transforming...')

      for await (const file of files) {
        await this.runOne(file, profile)
      }

      this.logger.success('Transformed')
    }

    if (this.flags.watch) {
      this.logger.info('Watching file changes, press Ctrl+C to exit')
      await this.runWatch(profile, this.flags.watchInitial)
    }
  }

  async getFiles(profile: SharpProfile): Promise<string[]> {
    const files = []

    const sources = toArray(profile.source || '')

    for await (const file of sources) {
      files.push(...(await this.getFileFromSource(file)))
    }

    return files
  }

  async getFileFromSource(source: string): Promise<string[]> {
    if (source.includes('*')) {
      this.logger.debug('Glob pattern detected')
      return glob(source, {
        nodir: true,
        ignore: '**/.*',
      })
    }

    // is file
    const isFileReg = /\.(\w+)$/
    if (isFileReg.test(source)) {
      this.logger.debug('Single file detected')
      return [source]
    }

    this.logger.debug('Directory detected')
    // is dir
    // use glob to find all image Files
    return glob(`${source}/**/*.{jpg,jpeg,png}`, {
      nodir: true,
    })
  }

  async runWatch(profile: SharpProfile, initial = false): Promise<void> {
    const chokidar = require('chokidar')
    const watcher = chokidar.watch(profile.source!, {
      persistent: true,
      awaitWriteFinish: true,
      ignored: /(^|[/\\])\../, // ignore dotfiles
      ignoreInitial: !initial,
    })

    watcher.on('add', async (file: string) => {
      this.logger.info('File added: %s', file)
      await this.transformFile(file, profile)
    })

    watcher.on('change', async (file: string) => {
      this.logger.info('File changed: %s', file)
      await this.transformFile(file, profile)
    })

    watcher.on('unlink', async (file: string) => {
      this.logger.info('File detected (not handle) : %s', file)
    })

    return watcher
  }

  runOne(imageFile: string, profile: SharpProfile): Promise<any> {
    return this.transformFile(imageFile, profile)
  }

  async getProfile(): Promise<SharpProfile> {
    const width = this.flags.width
    const height = this.flags.height

    const profile: SharpProfile = {
      source: this.args.file,
      transform: {
        keepMeta: this.flags.keepMeta,
        resize:
          width || height
            ? {
                width,
                height,
                withoutEnlargement: !this.flags.withEnlargement,
              }
            : undefined,
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

    if (profile.transform?.keepMeta) {
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

    return Promise.all(exportPromises)
  }
}
