import fs from 'node:fs/promises'
import path from 'node:path'

import { Args, Flags } from '@oclif/core'
import { glob } from 'glob'
import pLimit from 'p-limit'
import PQueue from 'p-queue'
import sharp from 'sharp'

import { BaseCommand } from '../base-command'
import SharpTransform from '../services/sharp/transform'
import { TransformAction, TransformProfile, TransformSource } from '../services/sharp/types'
import { formatSize, percent, toArray } from '../utils/mixed'

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

    concurrency: Flags.integer({
      default: 1,
      description: 'Number of concurrent transform',
    }),
  }

  protected sourceFileHandleQueue!: PQueue
  protected fileHandleQueue!: PQueue

  async init(): Promise<void> {
    await super.init()

    this.logger.debug('Init....')

    this.sourceFileHandleQueue = new PQueue({
      concurrency: this.flags.concurrency,
    })

    this.logger.debug('Init completed')
  }

  public async run(): Promise<void> {
    const profile = await this.getProfile()
    const files = await this.getFiles(profile)

    this.logger.debug('Files', files)
    if (!this.flags.watch) {
      this.logger.info('Found %d file(s)', files.length)
    }

    // Run one on each files
    // ---------------------------------
    if (!this.flags.watch) {
      this.logger.start('Transforming...')

      for (const file of files) {
        this.sourceFileHandleQueue.add(() => this.transformFile(file, profile))
      }

      await this.sourceFileHandleQueue.onIdle()

      this.logger.success('Transformed')
      this.exit(0)
    }

    // Run in watch mode
    // ---------------------------------
    if (this.flags.watch) {
      this.logger.info('Watching file changes, press Ctrl+C to exit')
      await this.runWatch(profile, this.flags.watchInitial)
    }
  }

  async getFiles(profile: TransformProfile): Promise<string[]> {
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

  async runWatch(profile: TransformProfile, initial = false): Promise<void> {
    const chokidar = require('chokidar')
    const watcher = chokidar.watch(profile.source!, {
      persistent: true,
      awaitWriteFinish: true,
      ignored: /(^|[/\\])\../, // ignore dotfiles
      ignoreInitial: !initial,
    })

    watcher.on('add', async (file: string) => {
      this.logger.info('File added: %s', file)
      this.sourceFileHandleQueue.add(() => this.transformFile(file, profile))
    })

    watcher.on('change', async (file: string) => {
      this.logger.info('File changed: %s', file)
      this.sourceFileHandleQueue.add(() => this.transformFile(file, profile))
    })

    watcher.on('unlink', async (file: string) => {
      this.logger.info('File detected (not handle) : %s', file)
    })

    return watcher
  }

  runOne(imageFile: string, profile: TransformProfile): Promise<any> {
    return this.transformFile(imageFile, profile)
  }

  async getProfile(): Promise<TransformProfile> {
    const width = this.flags.width
    const height = this.flags.height

    const profile: TransformProfile = {
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

  async transformFile(imageFile: string, profile: TransformProfile): Promise<void> {
    const file = await fs.open(imageFile, 'r')
    const stat = await file.stat()
    await file.close()

    if (!stat.isFile()) {
      this.logger.warn('Skip non file: %s', imageFile)
      return
    }

    const rawSharp = sharp(imageFile)
    const meta = await rawSharp.metadata()

    const source: TransformSource = {
      sharp: rawSharp,
      meta: meta,
      info: {
        file: imageFile,
        fileExt: path.extname(imageFile).slice(1),
        width: meta.width,
        height: meta.height,
        size: stat.size,
        stat: stat,
      },
    }

    const rawFileFormattedSize = formatSize(stat.size)
    this.logger.info(`Transforming ${imageFile} ${meta.format} ${meta.width}x${meta.height} ${rawFileFormattedSize}`)

    if (profile.transform) {
      for await (const transformAction of toArray(profile.transform)) {
        await this.doTransform(profile, source, transformAction)
      }
    } else {
      await this.doTransform(profile, source)
    }
  }

  async doTransform(
    profile: TransformProfile,
    source: TransformSource,
    transformAction?: TransformAction
  ): Promise<void> {
    const transform = new SharpTransform(profile, source, transformAction)
    const stat = source.info.stat!
    const rawFileFormattedSize = formatSize(stat.size)
    const limit = pLimit(1)
    const jobs = transform.export(source.info.file).map((fn) => limit(fn).catch((error) => this.logger.error(error)))

    const allResults = await Promise.all(jobs)
    for (const result of allResults)
      if (result) {
        const percentStr = percent(stat.size, result.output.size, { sign: false, char: true })

        const formattedNewSize = formatSize(result.output.size)
        const isOverSize = result.output.size > stat.size
        const message = `${result.newFile.file}     ${result.output.width}x${
          result.output.height
        }     ${formattedNewSize} / ${rawFileFormattedSize}    ${percentStr} ${isOverSize ? '↑' : '↓'}`

        if (isOverSize) {
          this.logger.warn(message)
        } else {
          this.logger.success(message)
        }
      }
  }
}
