
import { getprop } from './utility/StructUtility'


class Response {
  status: number
  statusText: string
  headers: any
  json: Function
  err?: Error
  body?: any

  constructor(resmap: Record<string, any>) {
    this.status = getprop(resmap, 'status', -1)
    this.statusText = getprop(resmap, 'statusText', '')
    this.headers = getprop(resmap, 'headers')
    this.json = resmap.json ? resmap.json.bind(resmap) : async () => undefined
    this.body = getprop(resmap, 'body')
    this.err = getprop(resmap, 'err')
  }
}


export {
  Response,
}
