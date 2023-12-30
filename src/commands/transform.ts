import fs from 'node:fs/promises'
import path from 'node:path'

import { Args, Flags } from '@oclif/core'
import fsExtra from 'fs-extra'
import { glob } from 'glob'
import pLimit from 'p-limit'
import PQueue from 'p-queue'
import sharp from 'sharp'

import { BaseCommand } from '../base-command'
import { configSchema, profileSchema } from '../services/sharp/schemas'
import SharpTransform from '../services/sharp/transform'
import { TransformAction, TransformConfig, TransformProfile, TransformSource } from '../services/sharp/types'
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
    '<%= config.bin %> <%= command.id %> --profile apple-icons',
    '<%= config.bin %> <%= command.id %> --profile apple-icons --config images-transform.json',
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --webp',
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --webp --width 500 --out images/optimized',
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --avif --png --height=300',
    `<%= config.bin %> <%= command.id %> images/image-1.jpg -w 1000 --webp --avif --png --name-format='{name}@2x.{ext}'`,
    '<%= config.bin %> <%= command.id %> images/image-1.jpg --webp --name-remove=__raw',
  ]

  static args = {
    file: Args.string({
      required: false,
      description: 'Images to transform, maybe single file, dir or glob pattern. Can ignore if use `--profile`',
    }),
  }

  static flags = {
    configFile: Flags.string({
      char: 'c',
      description: 'Config file path',
      default: 'image-transform.config.json',
      aliases: ['config-file'],
    }),
    profile: Flags.string({
      char: 'p',
      description: 'Profile name',
    }),
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
      min: 1,
      max: 10,
    }),
    data: Flags.string({
      char: 'd',
      description:
        'Data to pass to filename format, can be multiple, informat of `key=value`, example: `--data name=abc --data age=20`',
      multiple: true,
    }),
    quality: Flags.integer({
      description: `Quality of output image, override defined value in profile.
        Useful to reduce file size manually, use with "--data" flag to add versioning, example: "--quality 80 --data version=1"`,
      min: 1,
      default: 90,
      max: 100,
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
    this.logger.debug('Flag - fileNameData', this.getFileNameData())

    if (!this.flags.profile && !this.args.file) {
      this.logger.error('Please provide profile name or file path')
      this.exit(1)
    }

    const profile = await this.getProfile()
    const files = await this.getFiles(profile)

    this.logger.debug('Profile', profile)
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

  /**
   * Get data for filename format
   */
  getFileNameData(): Record<string, string> {
    const data: Record<string, string> = {}

    for (const item of this.flags.data || []) {
      if (!/\w+=\w+/.test(item)) {
        this.logger.error(`Invalid data format, should be 'key=value': ${item}`)
        this.exit(1)
      }

      const [key, value] = item.split('=')
      data[key] = value
    }

    return data
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
    this.logger.info('source', source)
    if (source.includes('*') || source.includes('?') || source.includes('{')) {
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

  async loadConfig(configFile: string): Promise<TransformConfig> {
    const configFilePath = path.resolve(configFile)

    if (!(await fsExtra.pathExists(configFilePath))) {
      this.logger.error(`Config file not found: ${configFilePath}`)
      this.exit(1)
    }

    const config = await fsExtra.readJSON(configFilePath)
    const validateResult = configSchema.safeParse(config)
    if (validateResult.success) {
      return validateResult.data
    }

    this.logger.error(`Config file is invalid: ${validateResult.error.message}`)

    this.exit(1)

    return undefined as unknown as TransformConfig
  }

  async getProfileFromConfig(profile: string): Promise<TransformProfile> {
    const config = await this.loadConfig(this.flags.configFile)
    const foundProfile = config.profiles.find((p) => p.name === profile)

    if (!foundProfile) {
      this.logger.error(`Profile not defined: ${profile}`)
      this.exit(1)
    }

    return foundProfile!
  }

  getProfileFromFlags(): TransformProfile {
    const width = this.flags.width
    const height = this.flags.height

    const profile: TransformProfile = {
      name: 'cli',
      source: this.args.file,
      transforms: [
        {
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
      ],
      export: {},
      output: {
        dir: this.flags.out,
        fileNameFormat: this.flags.nameFormat,
        fileNameReplace: this.flags.nameRemove ? { [this.flags.nameRemove]: '' } : undefined,
        fileNameData: this.getFileNameData(),
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

  async getProfile(): Promise<TransformProfile> {
    const profile: TransformProfile = this.flags.profile
      ? await this.getProfileFromConfig(this.flags.profile)
      : this.getProfileFromFlags()

    // Custom quality
    if (this.flags.quality) {
      profile.export = profile.export || {}
      for (const [name, option] of Object.entries(profile.export)) {
        if (!(name in profile.export)) continue

        if (option === true) {
          profile.export[name as keyof typeof profile.export] = { quality: this.flags.quality }
        } else {
          option.quality = this.flags.quality
        }
      }
    }

    // Add custom data to fileNameData
    const fileNameData = this.getFileNameData()
    profile.output = profile.output || {}
    profile.output.fileNameData = {
      ...profile.output.fileNameData,
      ...fileNameData,
    }

    const validateProfileResult = profileSchema.safeParse(profile)
    if (!validateProfileResult.success) {
      this.logger.error(`Profile is invalid: ${validateProfileResult.error.message}`)
      this.exit(1)
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

    if (profile.transforms) {
      for await (const transformAction of toArray(profile.transforms)) {
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
        const percentResult = percent(stat.size, result.output.size, { sign: false, char: true })

        const formattedNewSize = formatSize(result.output.size)
        const isOverSize = result.output.size > stat.size
        const changeIcon = result.output.size > stat.size ? '↑' : result.output.size < stat.size ? '↓' : '='

        const message = [
          transformAction?.label ? `[ ${transformAction.label} ]` : '',
          result.newFile.file,
          `${result.output.width}x${result.output.height}`,
          `${formattedNewSize} / ${rawFileFormattedSize}`,
          `${percentResult.percentStr} ${changeIcon}${percentResult.changePercent}%`,
        ]
          .filter(Boolean)
          .join('   ')

        if (isOverSize) {
          this.logger.warn(message)
        } else {
          this.logger.success(message)
        }
      }
  }
}
