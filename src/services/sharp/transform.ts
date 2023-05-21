import fsExtra from 'fs-extra'
import { AvifOptions, JpegOptions, PngOptions, Sharp, WebpOptions } from 'sharp'

import { formatSize } from '../../utils/mixed'
import { changeName, ChangeNameResult } from '../../utils/paths'

import { applyFns, avif, jpeg, png, SharpFn, webp } from './actions'
import { TransformProfile } from './profile'
import { TransformReport } from './report'
import { TransformSource } from './types'

export type TapFunction<T extends any> = (sharp: Sharp) => T
export type ExportFunction = () => Promise<TransformReport>

export default class Transform {
  source: TransformSource
  result: Sharp | null = null
  profile: TransformProfile

  constructor(profile: TransformProfile, source: TransformSource) {
    this.profile = profile
    this.source = source
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
    const fns: SharpFn[] = []
    const { resize, rotate } = this.profile.transform || {}
    if (resize) {
      fns.push((sharp) => sharp.resize(resize))
    }

    if (rotate) {
      fns.push((sharp) => sharp.rotate(rotate))
    }

    return fns
  }

  get rawSharp(): Sharp {
    if (!this.source.sharp) {
      throw new Error('Source sharp is null')
    }

    return this.source.sharp
  }

  transform(): Sharp {
    if (this.result) {
      return this.result
    }

    const fns: SharpFn[] = this.transformFns

    this.result = fns.length > 0 ? applyFns(this.rawSharp.clone(), fns) : this.rawSharp.clone()
    return this.result
  }

  export(rawFile: string): ExportFunction[] {
    const exportFns: ExportFunction[] = []

    if (this.profile.export.jpeg) {
      const options: JpegOptions = this.profile.export.jpeg === true ? {} : this.profile.export.jpeg
      exportFns.push(this.createExportFn(jpeg(options), rawFile, 'jpg'))
    }

    if (this.profile.export.png) {
      const options: PngOptions = this.profile.export.png === true ? {} : this.profile.export.png
      exportFns.push(this.createExportFn(png(options), rawFile, 'png'))
    }

    if (this.profile.export.webp) {
      const options: WebpOptions = this.profile.export.webp === true ? {} : this.profile.export.webp
      exportFns.push(this.createExportFn(webp(options), rawFile, 'webp'))
    }

    if (this.profile.export.avif) {
      const options: AvifOptions = this.profile.export.avif === true ? {} : this.profile.export.avif
      exportFns.push(this.createExportFn(avif(options), rawFile, 'avif'))
    }

    return exportFns
  }

  createExportFn(exporter: SharpFn, rawFile: string, newFileExt: string): () => Promise<TransformReport> {
    return async (): Promise<TransformReport> => {
      const newFile = this.exportTarget(rawFile, newFileExt)
      const sharp = this.tap(exporter)
      await fsExtra.ensureDir(newFile.dir)

      const exportResult = await sharp.toFile(newFile.file)

      return new TransformReport(this, exportResult, newFile)
    }
  }

  exportTarget(rawFile: string, newFileExt: string): ChangeNameResult {
    return changeName(rawFile, {
      ext: newFileExt,
      dir: this.profile.output?.dir,
      format: this.profile.output?.fileNameFormat,
      replace: this.profile.output?.fileNameReplace,
    })
  }

  tapRaw<T extends any>(fn: TapFunction<T>): T {
    if (!this.rawSharp) {
      throw new Error('Call tap function when no raw sharp instance')
    }

    return fn(this.rawSharp.clone())
  }

  tap<T extends any>(fn: TapFunction<T>): T {
    if (!this.result) {
      this.transform()
    }

    return fn(this.result!.clone())
  }
}
