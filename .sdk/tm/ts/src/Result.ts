
import { getprop } from './utility/StructUtility'


class Result {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body?: any
  err?: any
  resdata?: any
  resmatch?: any

  constructor(resmap: Record<string, any>) {
    this.ok = getprop(resmap, 'ok', false)
    this.status = getprop(resmap, 'status', -1)
    this.statusText = getprop(resmap, 'statusText', '')
    this.headers = getprop(resmap, 'headers', {})
    this.body = getprop(resmap, 'body')
    this.err = getprop(resmap, 'err')
    this.resdata = getprop(resmap, 'resdata')
    this.resmatch = getprop(resmap, 'resmatch')
  }
}


export {
  Result,
}
