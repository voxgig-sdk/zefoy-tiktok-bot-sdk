
import {
  Model,
  ModelEntity,
  ModelPoint,
  nom,
  depluralize,
} from '@voxgig/apidef'


import {
  Content,
  File,
  Folder,
  Fragment,
  Slot,
  cmp,
  snakify,
  isAuthActive,
} from '@voxgig/sdkgen'


import {
  projectPath
} from './utility_js'


const TestDirect = cmp(function TestDirect(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model
  const stdrep = ctx$.stdrep

  const target = props.target
  const entity: ModelEntity = props.entity

  const ff = projectPath('src/cmp/js/fragment/')

  const PROJECTNAME = nom(model, 'Name').toUpperCase().replace(/[^A-Z_]/g, '_')
  const entidEnvVar = `${PROJECTNAME}_TEST_${nom(entity, 'NAME').replace(/[^A-Z_]/g, '_')}_ENTID`

  const authActive = isAuthActive(model)
  const apikeyEnvEntry = authActive
    ? `\n    '${PROJECTNAME}_APIKEY': 'NONE',`
    : ''
  const apikeyLiveField = authActive
    ? `
      apikey: env.${PROJECTNAME}_APIKEY,`
    : ''

  const opnames = Object.keys(entity.op)
  const hasLoad = opnames.includes('load')
  const hasList = opnames.includes('list')

  if (!hasLoad && !hasList) {
    return
  }

  Folder({ name: entity.name }, () => {

    File({ name: nom(entity, 'Name') + 'Direct.test.' + target.name }, () => {

      Fragment({
        from: ff + 'Direct.test.fragment.js',
        replace: {
          SdkName: nom(model.const, 'Name'),
          EntityName: nom(entity, 'Name'),
          entityname: entity.name,
          ...stdrep,
        }
      }, () => {


        Slot({ name: 'directSetup' }, () => {
          Content(`
function directSetup(mockres) {
  const calls = []

  const env = envOverride({
    '${entidEnvVar}': {},
    '${PROJECTNAME}_TEST_LIVE': 'FALSE',${apikeyEnvEntry}
  })

  const live = 'TRUE' === env.${PROJECTNAME}_TEST_LIVE

  if (live) {
    const client = new ${nom(model.const, 'Name')}SDK({${apikeyLiveField}
    })

    let idmap = env['${entidEnvVar}']
    if ('string' === typeof idmap && idmap.startsWith('{')) {
      idmap = JSON.parse(idmap)
    }

    return { client, calls, live, idmap }
  }

  const mockFetch = async (url, init) => {
    calls.push({ url, init })
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      json: async () => (null != mockres ? mockres : { id: 'direct01' }),
    }
  }

  const client = new ${nom(model.const, 'Name')}SDK({
    base: 'http://localhost:8080',
    system: { fetch: mockFetch },
  })

  return { client, calls, live, idmap: {} }
}
  `)
        })


        Slot({ name: 'direct' }, () => {

          if (hasLoad) {
            generateDirectLoad(model, entity)
          }

          if (hasList) {
            generateDirectList(model, entity)
          }
        })

      })
    })
  })
})


function generateDirectLoad(model: Model, entity: ModelEntity) {
  const loadOp = entity.op.load
  const loadPoint: ModelPoint | undefined = loadOp?.points?.[0]

  if (null == loadPoint) {
    return
  }

  const loadParams = loadPoint.args?.params || []
  const loadPath = normalizePathParams(loadPoint.parts || [], loadParams, loadPoint.rename?.param)

  // Get list info for live mode bootstrapping
  const listOp = entity.op.list
  const listPoint = listOp?.points?.[0]
  const listParams = listPoint?.args?.params || []
  const listPath = listPoint ? normalizePathParams(listPoint.parts || [], listParams, listPoint.rename?.param) : ''
  const hasList = null != listPoint

  // Ancestor params (not 'id') for live mode
  const ancestorParams = loadParams.filter((p: any) => p.name !== 'id')

  const paramAsserts = loadParams.map((p: any, i: number) =>
    '      assert(calls[0].url.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  // Build live list params
  const liveListParams = listParams.map((p: any) => {
    const key = p.name === 'id'
      ? entity.name + '01'
      : p.name.replace(/_id$/, '') + '01'
    return { name: p.name, key }
  })

  // Build live ancestor params for load
  const liveAncestorParams = ancestorParams.map((p: any) => {
    const key = p.name.replace(/_id$/, '') + '01'
    return { name: p.name, key }
  })

  let liveParamsBlock = ''
  if (hasList) {
    const listParamLines = liveListParams.map((lp: any) =>
      `        ${lp.name}: setup.idmap['${lp.key}'],`).join('\n')
    const ancestorParamLines = liveAncestorParams.map((lp: any) =>
      `      params.${lp.name} = setup.idmap['${lp.key}']`).join('\n')

    liveParamsBlock = `    if (setup.live) {
      const listResult = await client.direct({
        path: '${listPath}',
        method: 'GET',
        params: {
${listParamLines}
        },
      })
      assert(listResult.ok === true)
      const listData = listResult.data
      if (!Array.isArray(listData) || listData.length === 0) {
        return // skip: no entities to load in live mode
      }
      params.id = listData[0].id
${ancestorParamLines}
    } else {
${loadParams.map((p: any, i: number) => `      params.${p.name} = 'direct0${i + 1}'`).join('\n')}
    }`
  } else {
    liveParamsBlock = `    if (!setup.live) {
${loadParams.map((p: any, i: number) => `      params.${p.name} = 'direct0${i + 1}'`).join('\n')}
    }`
  }

  Content(`
  test('direct-load-${entity.name}', async () => {
    const setup = directSetup({ id: 'direct01' })
    const { client, calls } = setup

    const params = {}
${liveParamsBlock}

    const result = await client.direct({
      path: '${loadPath}',
      method: 'GET',
      params,
    })

    assert(result.ok === true)
    assert(result.status === 200)
    assert(null != result.data)

    if (!setup.live) {
      assert(result.data.id === 'direct01')
      assert(calls.length === 1)
      assert(calls[0].init.method === 'GET')
${paramAsserts}    }
  })
`)
}


function generateDirectList(model: Model, entity: ModelEntity) {
  const listOp = entity.op.list
  const listPoint: ModelPoint | undefined = listOp?.points?.[0]

  if (null == listPoint) {
    return
  }

  const listParams = listPoint.args?.params || []
  const listPath = normalizePathParams(listPoint.parts || [], listParams, listPoint.rename?.param)

  // Build live params
  const liveParams = listParams.map((p: any) => {
    const key = p.name === 'id'
      ? entity.name + '01'
      : p.name.replace(/_id$/, '') + '01'
    return { name: p.name, key }
  })

  const paramAsserts = listParams.map((p: any, i: number) =>
    '      assert(calls[0].url.includes(\'direct0' + (i + 1) + '\'))\n').join('')

  let paramsBlock = ''
  if (listParams.length > 0) {
    const liveLines = liveParams.map((lp: any) =>
      `      params.${lp.name} = setup.idmap['${lp.key}']`).join('\n')
    const mockLines = listParams.map((p: any, i: number) =>
      `      params.${p.name} = 'direct0${i + 1}'`).join('\n')

    paramsBlock = `    const params = {}
    if (setup.live) {
${liveLines}
    } else {
${mockLines}
    }
`
  } else {
    paramsBlock = `    const params = {}
`
  }

  Content(`
  test('direct-list-${entity.name}', async () => {
    const setup = directSetup([{ id: 'direct01' }, { id: 'direct02' }])
    const { client, calls } = setup

${paramsBlock}
    const result = await client.direct({
      path: '${listPath}',
      method: 'GET',
      params,
    })

    assert(result.ok === true)
    assert(result.status === 200)
    assert(Array.isArray(result.data))

    if (!setup.live) {
      assert(result.data.length === 2)
      assert(calls.length === 1)
      assert(calls[0].init.method === 'GET')
${paramAsserts}    }
  })
`)
}


// Replace raw OpenAPI parameter names in path parts with model parameter names.
// Path parts may have e.g. {subBreed} while model params use sub_breed.
// When a rename mapping exists (e.g. closureId -> id), path parts contain the
// renamed form {id} but params still use the original name closure_id.
// The rename mapping is used to reverse-lookup the original param name.
function normalizePathParams(
  parts: string[],
  params: any[],
  rename?: Record<string, string>
): string {
  return parts.map((part: string) => {
    // Replace each {paramName} occurrence within the part.
    // Handles both simple parts like "{id}" and compound parts like
    // "{outputFields}.{format}" that contain multiple parameters.
    return part.replace(/\{([^}]+)\}/g, (match: string, rawName: string) => {
      const snaked = snakify(rawName)
      const depluralized = depluralize(snaked)
      // Prefer exact name match — orig matches can collide when one param's
      // original name was renamed to another param's current name (e.g. badge
      // load: param 'group_id' has orig 'id', and another param has name 'id').
      const param = params.find((p: any) =>
          p.name === snaked || p.name === depluralized) ||
        params.find((p: any) =>
          p.orig === snaked || p.orig === depluralized)
      if (param) return '{' + param.name + '}'

      // Reverse-lookup through rename mapping: if rawName is a renamed value
      // (e.g. "id"), find the original camelCase key (e.g. "closureId"),
      // snakify+depluralize it (e.g. "closure_id"), and match against params.
      if (rename) {
        for (const [origCamel, renamedTo] of Object.entries(rename)) {
          if (renamedTo === rawName) {
            const origSnaked = snakify(origCamel)
            const origDepluralized = depluralize(origSnaked)
            const renamedParam = params.find(
              (p: any) => p.orig === origSnaked || p.name === origSnaked ||
                p.orig === origDepluralized || p.name === origDepluralized
            )
            if (renamedParam) return '{' + renamedParam.name + '}'
          }
        }
      }

      return match
    })
  }).join('/')
}


export {
  TestDirect
}
