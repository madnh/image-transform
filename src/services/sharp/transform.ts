import fsExtra from 'fs-extra'
import pPipe from 'p-pipe'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AvifOptions, JpegOptions, PngOptions, Sharp, WebpOptions } from 'sharp'

import { changeName, ChangeNameResult } from '../../utils/paths'

import actions from './actions'
import { TransformReport } from './report'
import { SharpFn, TransformAction, TransformProfile, TransformSource } from './types'

export type TapFunction<T extends any> = (sharp: Sharp) => T
export type ExportFunction = () => Promise<TransformReport>

export default class Transform {
  source: TransformSource
  result: Sharp | null = null
  profile: TransformProfile
  transformAction: TransformAction | null = null

  constructor(profile: TransformProfile, source: TransformSource, transformAction?: TransformAction) {
    this.profile = profile
    this.source = source

    this.transformAction = transformAction || null
  }

  protected resetResult(): void {
    this.result = null
  }

  /**
   * Change source, this will reset result if already transformed
   * @param {TransformSource} source New source
   * @returns {this}
   */
  useSource(source: TransformSource): this {
    this.source = source
    this.resetResult()

    return this
  }

  get isTransformed(): boolean {
    return Boolean(this.result)
  }

  get transformFns(): SharpFn[] {
    if (!this.transformAction) return []

    const fns: SharpFn[] = []

    const { resize, rotate } = this.transformAction
    if (resize) {
      fns.push((sharp) => actions.resize(sharp, resize))
    }

    if (rotate) {
      fns.push((sharp) => actions.rotate(sharp, rotate))
    }

    return fns
  }

  get rawSharp(): Sharp {
    if (!this.source.sharp) {
      throw new Error('Source sharp is null')
    }

    return this.source.sharp
  }

  async transform(): Promise<Sharp> {
    if (this.result) {
      return this.result
    }

    const fns: SharpFn[] = this.transformFns
    if (fns.length > 0) {
      let sharp = this.rawSharp.clone()

      if (this.transformAction?.keepMeta) {
        sharp = sharp.withMetadata()
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const pipeline = pPipe<Sharp, Sharp>(...fns)
      this.result = await pipeline(sharp.clone())!
    } else {
      this.result = this.rawSharp.clone()
    }

    return this.result
  }

  export(rawFile: string): ExportFunction[] {
    const exportFns: ExportFunction[] = []

    if (this.profile.export.jpeg) {
      const options: JpegOptions = this.profile.export.jpeg === true ? {} : this.profile.export.jpeg
      exportFns.push(this.createExportFn((s) => Promise.resolve(s.jpeg(options)), rawFile, 'jpg'))
    }

    if (this.profile.export.png) {
      const options: PngOptions = this.profile.export.png === true ? {} : this.profile.export.png
      exportFns.push(this.createExportFn((s) => Promise.resolve(s.png(options)), rawFile, 'png'))
    }

    if (this.profile.export.webp) {
      const options: WebpOptions = this.profile.export.webp === true ? {} : this.profile.export.webp
      exportFns.push(this.createExportFn((s) => Promise.resolve(s.webp(options)), rawFile, 'webp'))
    }

    if (this.profile.export.avif) {
      const options: AvifOptions = this.profile.export.avif === true ? {} : this.profile.export.avif
      exportFns.push(this.createExportFn((s) => Promise.resolve(s.avif(options)), rawFile, 'avif'))
    }

    return exportFns
  }

  createExportFn(exporter: SharpFn, rawFile: string, newFileExt: string): () => Promise<TransformReport> {
    return async (): Promise<TransformReport> => {
      const newFile = this.exportTarget(rawFile, newFileExt)
      const sharp = await this.tap(exporter)

      await fsExtra.ensureDir(newFile.dir)

      const exportResult = await sharp.toFile(newFile.file)

      return new TransformReport(this, exportResult, newFile)
    }
  }

  exportTarget(rawFile: string, newFileExt: string): ChangeNameResult {
    const formatData = {
      ...this.profile.output?.fileNameData,
      width: String(this.transformAction?.resize?.width) || '',
      height: String(this.transformAction?.resize?.height) || '',
      label: this.transformAction?.label || '',
    }

    const defaultFormat = 'version' in formatData ? `{name}__{version}.{ext}` : `{name}.{ext}`
    return changeName(rawFile, {
      ext: newFileExt,
      dir: this.profile.output?.dir,
      format: this.profile.output?.fileNameFormat || defaultFormat,
      replace: this.profile.output?.fileNameReplace,
      formatData: formatData,
    })
  }

  tapRaw<T extends any>(fn: TapFunction<T>): T {
    if (!this.rawSharp) {
      throw new Error('Call tap function when no raw sharp instance')
    }

    return fn(this.rawSharp.clone())
  }

  async tap<T extends any>(fn: TapFunction<T>): Promise<T> {
    if (!this.result) {
      await this.transform()
    }

    return fn(this.result!.clone())
  }
}
