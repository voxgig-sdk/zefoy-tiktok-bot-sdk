
import * as Path from 'node:path'


import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


function formatJSONSrc(jsonsrc: string) {
  return jsonsrc
    .replace(/([{:\[,])/g, '$1 ')
    .replace(/([}\]])/g, ' $1')
}


function formatJson(obj: any, flags?: { line?: boolean, margin?: number }): string {
  const marginSize = flags?.margin ?? 0
  const marginStr = ' '.repeat(marginSize)

  let json: string

  if (flags?.line) {
    // One line with spaces for clarity
    json = JSON.stringify(obj)
      .replace(/([{:\[,])/g, '$1 ')
      .replace(/([}\]])/g, ' $1')
  }
  else {
    // Pretty printed with 2-space indentation
    json = JSON.stringify(obj, null, 2)
  }

  // Add margin to the left of every line
  if (marginSize > 0) {
    json = json.split('\n').map(line => marginStr + line).join('\n')
  }

  return json
}


function clean(o: any) {
  return walk(clone(o), (k: any, v: any, p: any) => {
    if (null != k && k.endsWith('$')) {
      delete p[k]
    }
    return v
  })
}


export {
  clean,
  formatJSONSrc,
  formatJson,
  projectPath,
}
