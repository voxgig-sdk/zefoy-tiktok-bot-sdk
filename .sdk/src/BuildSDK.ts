
import { size } from '@voxgig/struct'


import {
  Content,
  File,
  Folder,
  cmp,
  each,
} from '@voxgig/sdkgen'

import { camelify, lcf } from 'jostraca'


import type {
  Model,
  ModelEntity,
  ModelField,
} from '@voxgig/apidef'


import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const BuildSDK = cmp(function BuildSDK(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model

  // TODO: should come from ctx$ options
  const sdkBuildFolder = '.sdk'

  const entityMap: ModelEntity = getModelPath(model, `main.${KIT}.entity`)

  Folder({ name: sdkBuildFolder }, () => {
    each(entityMap, (entity: ModelEntity) => {
      Folder({ name: 'test' }, () => {
        Folder({ name: 'entity' }, () => {
          Folder({ name: entity.name }, () => {
            File({ name: nom(entity, 'Name') + 'TestData.json' }, () => {
              const entityTestData = makeEntityTestData(model, entity)
              Content(JSON.stringify(entityTestData, null, 2))
            })
          })
        })
      })
    })
  })
})


function makeEntityTestData(_model: Model, entity: ModelEntity) {
  const data: any = {
    existing: {
      [entity.name]: {}
    },
    new: {
      [entity.name]: {}
    }
  }

  const idcount = 3

  const refs = [...Array(idcount).keys()].reduce((a, _x, i) =>
    (a.push(`${entity.name}${String(i).padStart(2, "0")}`), a), [] as string[])

  const idmap = refs.reduce((a: any, ref) => (a[ref] = ref.toUpperCase(), a), {})

  // Path params required across the entity's ops (excluding the entity's own
  // id and any param renamed-to-id). The in-memory test mock's buildArgs
  // searches existing entities by these fields, so they need to be present
  // with values that match what the test code sends via setup.idmap.
  const pathParams = collectEntityPathParams(entity)

  const hasEntId = null != (entity as any).id
  // Some entities don't declare a top-level `id` field but still need an
  // `id` value in their fixture: any entity that has a non-list op (remove,
  // update, load) will hit `data["id"]` in the generated test code. The
  // test mock is lenient about extra/missing path params, so synthesising
  // an `id` here keeps tests green for entities like
  //   `/{namespace}/{key}` (no `id` in URL) or `/{resource}/{id}`
  // alongside the simple `{id}`-only case.
  const needsFixtureId = hasEntId || entityHasMutatingOp(entity)

  let i = 1

  refs.map((ref) => {
    const id = idmap[ref]
    const ent: any = data.existing[entity.name][id] = {}

    makeEntityTestFields(entity, i++, ent)
    for (const [paramName, paramValue] of pathParams) {
      // Don't overwrite a real entity field with the same name.
      if (ent[paramName] === undefined) {
        ent[paramName] = paramValue
      }
    }
    // Inject a fixture id when the spec models one for this entity (either
    // as a top-level field or as a path param). Read-only feeds with no id
    // at all leave fixtures bare so test generators don't synthesise bogus
    // id assertions.
    if (needsFixtureId) {
      ent.id = id
    }
  })

  let id = entity.name + '_ref01'
  const ent: any = data.new[entity.name][id] = {}
  makeEntityTestFields(entity, i++, ent)
  delete ent.id

  return data
}


// Detect whether the entity has any op other than `list` (which doesn't
// take a per-item id). Used to decide whether the fixture needs a
// synthesised `id` — the test code for load/update/remove ops references
// `data["id"]` unconditionally in Python (and similarly in other strict
// languages), so the fixture must provide one even when the URL path
// params are named differently (e.g. `/{namespace}/{key}`).
function entityHasMutatingOp(entity: any): boolean {
  const ops = entity?.op || {}
  for (const opname of Object.keys(ops)) {
    if (opname !== 'list') return true
  }
  return false
}


// Walk every op point on the entity, collect the names of path params, and
// pair each with its canonical idmap value. The canonical value mirrors the
// flow generator's path-param defaulting in apidef:
//   `step.match[name] = name.replace(/_id$/,'') + '01'`
// Then setup.idmap maps that lower ref to upper:  `company01 → COMPANY01`.
// So the value seeded into existing test data is the upper form: `COMPANY01`.
function collectEntityPathParams(entity: any): [string, string][] {
  const out = new Map<string, string>()
  const ops = entity?.op || {}
  for (const opname of Object.keys(ops)) {
    const op = ops[opname]
    const points = op?.points || []
    for (const point of points) {
      const params = point?.args?.params || []
      const renameMap: Record<string, string> = point?.rename?.param || {}
      for (const param of params) {
        if (!param?.name) continue
        if ('id' === param.name) continue
        // Skip params that ARE the entity's own id under URL rename.
        const camel = lcf(camelify(param.name))
        if ('id' === renameMap[camel]) continue
        if (out.has(param.name)) continue
        const baseName = param.name.replace(/_id$/, '')
        out.set(param.name, baseName.toUpperCase() + '01')
      }
    }
  }
  return Array.from(out.entries())
}


function makeEntityTestFields(entity: ModelEntity, start: number, entdata: Record<string, any>) {
  entdata = entdata ?? {}
  let num = (start * size(entity.fields) * 10)
  each(entity.fields, (field: ModelField) => {
    entdata[field.name] =
      field.name.endsWith('_id') ?
        field.name.substring(0, field.name.length - 3).toUpperCase() + '01' :
        '`$NUMBER`' === field.type ? num :
          '`$BOOLEAN`' === field.type ? 0 === num % 2 :
            '`$OBJECT`' === field.type ? {} :
              '`$MAP`' === field.type ? {} :
                '`$ARRAY`' === field.type ? [] :
                  '`$LIST`' === field.type ? [] :
                    's' + (num.toString(16))
    num++
  })
  return entdata
}


export {
  BuildSDK
}

