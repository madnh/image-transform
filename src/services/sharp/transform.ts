import { changeName, ChangeNameResult } from '../../utils/paths'
import { AvifOptions, JpegOptions, OutputInfo, PngOptions, Sharp, WebpOptions } from 'sharp'
import { applyFns, avif, jpeg, png, SharpFn, webp } from './actions'
import { SharpProfile } from './profile'
import fsExtra from 'fs-extra'

export type TapFunction<T extends any> = (sharp: Sharp) => T

export default class Transform {
  protected rawSharp: Sharp | null = null
  protected result: Sharp | null = null
  protected profile: SharpProfile

  constructor(profile: SharpProfile, rawSharp?: Sharp | null) {
    this.profile = profile

    if (rawSharp) {
      this.rawSharp = rawSharp
    }
  }

  protected resetResult(): void {
    this.result = null
  }

  withSharpSource(sharp: Sharp): this {
    this.rawSharp = sharp
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

  transform(): Sharp {
    if (this.result) {
      return this.result
    }

    if (!this.rawSharp) {
      throw new Error('No sharp instance')
    }

    const fns: SharpFn[] = this.transformFns

    this.result = fns.length > 0 ? applyFns(this.rawSharp.clone(), fns) : this.rawSharp.clone()
    return this.result
  }

  export(rawFile: string): Array<() => Promise<OutputInfo>> {
    const promises: Array<() => Promise<OutputInfo>> = []

    if (this.profile.export.jpeg) {
      const options: JpegOptions = this.profile.export.jpeg === true ? {} : this.profile.export.jpeg
      promises.push(this.createExportFn(jpeg(options), rawFile, 'jpg'))
    }

    if (this.profile.export.png) {
      const options: PngOptions = this.profile.export.png === true ? {} : this.profile.export.png
      promises.push(this.createExportFn(png(options), rawFile, 'png'))
    }

    if (this.profile.export.webp) {
      const options: WebpOptions = this.profile.export.webp === true ? {} : this.profile.export.webp
      promises.push(this.createExportFn(webp(options), rawFile, 'webp'))
    }

    if (this.profile.export.avif) {
      const options: AvifOptions = this.profile.export.avif === true ? {} : this.profile.export.avif
      promises.push(this.createExportFn(avif(options), rawFile, 'avif'))
    }

    return promises
  }

  createExportFn(exporter: SharpFn, rawFile: string, newFileExt: string): () => Promise<OutputInfo> {
    return async (): Promise<OutputInfo> => {
      const newFile = this.exportTarget(rawFile, newFileExt)
      console.log(`Exporting`, newFile)
      const sharp = this.tap(exporter)
      await fsExtra.ensureDir(newFile.dir)

      return sharp.toFile(newFile.file)
    }
  }

  exportTarget(rawFile: string, newFileExt: string): ChangeNameResult {
    const { alias, aliasSeparator } = this.profile.output?.fileName || {}
    const newFileNameAppend = alias ? `${aliasSeparator}${alias}` : ''

    return changeName(rawFile, {
      ext: newFileExt,
      append: newFileNameAppend,
      dir: this.profile.output?.dir,
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
