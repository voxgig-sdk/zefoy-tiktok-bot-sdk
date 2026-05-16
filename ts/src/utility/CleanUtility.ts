
import { Context } from '../types'


import {
  walk, size, pad, slice, clone
} from './StructUtility'


// Clean request data by partially hiding sensitive values.
function clean(ctx: Context, val: any) {
  const options = ctx.options

  const cleankeyre = options?.__derived__?.clean?.keyre
  const hintsize = 4

  /*
  if (null != cleankeyre) {
    val = walk(clone(val), (key: any, subval: any) => {
      if (cleankeyre.exec(key) && 'string' === typeof subval) {
        const len = size(subval)
        const hint = (hintsize * 4) < len ? slice(subval, 0, hintsize) : ''
        subval = pad(hint, len, '*')
      }
      return subval
    })
  }
  */

  return val
}


export {
  clean
}
