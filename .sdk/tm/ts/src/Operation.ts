
import { getprop } from './utility/StructUtility'

import { Point } from './Point'


class Operation {
  entity: string
  name: string
  input: string
  points: Point[]

  constructor(opmap: Record<string, any>) {
    this.entity = getprop(opmap, 'entity', '_')
    this.name = getprop(opmap, 'name', '_')
    this.input = getprop(opmap, 'input', '_')
    this.points = getprop(opmap, 'points', [])
  }
}


export {
  Operation,
}
