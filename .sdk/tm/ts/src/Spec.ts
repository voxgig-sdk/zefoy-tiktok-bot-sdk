
import { getprop } from './utility/StructUtility'


class Spec {
  parts: string[]
  headers: Record<string, string>
  alias: any
  base: string
  prefix: string
  suffix: string
  params: Record<string, string>
  query: Record<string, string>
  step: string
  method: string
  body: any
  url?: string
  path?: string

  constructor(specmap: Record<string, any>) {
    this.parts = getprop(specmap, 'parts', [])
    this.headers = getprop(specmap, 'headers', {})
    this.alias = getprop(specmap, 'alias', {})
    this.base = getprop(specmap, 'base', '')
    this.prefix = getprop(specmap, 'prefix', '')
    this.suffix = getprop(specmap, 'suffix', '')
    this.params = getprop(specmap, 'params', {})
    this.query = getprop(specmap, 'query', {})
    this.step = getprop(specmap, 'step', '')
    this.method = getprop(specmap, 'method', 'GET')
    this.body = getprop(specmap, 'body')
    this.url = getprop(specmap, 'url')
    this.path = getprop(specmap, 'path')
  }
}


export {
  Spec,
}
