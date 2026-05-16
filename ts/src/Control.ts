
import { getprop } from './utility/StructUtility'


class Control {
  throw?: boolean
  err?: any
  explain?: any

  constructor(ctrlmap: Record<string, any>) {
    this.throw = getprop(ctrlmap, 'throw')
    this.err = getprop(ctrlmap, 'err')
    this.explain = getprop(ctrlmap, 'explain')
  }
}


export {
  Control,
}
