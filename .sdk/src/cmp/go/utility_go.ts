
import * as Path from 'node:path'


import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


function formatGoMap(obj: any, indent: number = 0): string {
  if (obj == null) {
    return 'nil'
  }

  const pad = '\t'.repeat(indent)
  const padInner = '\t'.repeat(indent + 1)

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]any{}'
    }
    const items = obj.map(v => padInner + formatGoValue(v, indent + 1)).join(',\n')
    return `[]any{\n${items},\n${pad}}`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) {
      return 'map[string]any{}'
    }
    const items = entries
      .map(([k, v]) => `${padInner}"${k}": ${formatGoValue(v, indent + 1)}`)
      .join(',\n')
    return `map[string]any{\n${items},\n${pad}}`
  }

  return formatGoValue(obj, indent)
}


function formatGoValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'nil'
  }
  if (typeof val === 'string') {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return String(val)
    }
    return String(val)
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false'
  }
  if (Array.isArray(val)) {
    return formatGoMap(val, indent)
  }
  if (typeof val === 'object') {
    return formatGoMap(val, indent)
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
  formatGoMap,
  formatGoValue,
  projectPath,
}
