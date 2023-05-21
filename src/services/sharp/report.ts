import { OutputInfo } from 'sharp'

import { ChangeNameResult } from '@/src/utils/paths'

import Transform from './transform'

export class TransformReport {
  transform: Transform
  output: OutputInfo
  newFile: ChangeNameResult

  constructor(transform: Transform, output: OutputInfo, newFile: ChangeNameResult) {
    this.transform = transform
    this.output = output
    this.newFile = newFile
  }
}
