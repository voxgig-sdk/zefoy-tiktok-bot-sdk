
import * as Path from 'node:path'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


function formatPyDict(obj: any, indent: number = 0): string {
  if (obj == null) {
    return 'None'
  }

  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]'
    }
    const items = obj.map(v => padInner + formatPyValue(v, indent + 1)).join(',\n')
    return `[\n${items},\n${pad}]`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) {
      return '{}'
    }
    const items = entries
      .map(([k, v]) => `${padInner}"${k}": ${formatPyValue(v, indent + 1)}`)
      .join(',\n')
    return `{\n${items},\n${pad}}`
  }

  return formatPyValue(obj, indent)
}


function formatPyValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'None'
  }
  if (typeof val === 'string') {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  if (typeof val === 'number') {
    return String(val)
  }
  if (typeof val === 'boolean') {
    return val ? 'True' : 'False'
  }
  if (Array.isArray(val)) {
    return formatPyDict(val, indent)
  }
  if (typeof val === 'object') {
    return formatPyDict(val, indent)
  }
  return String(val)
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
  formatPyDict,
  formatPyValue,
  projectPath,
}
