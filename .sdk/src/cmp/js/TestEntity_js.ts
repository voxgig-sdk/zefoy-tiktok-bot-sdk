
import * as Path from 'node:path'


import {
  flatten,
  items,
  join,
  jsonify,
  slice,
} from '@voxgig/struct'

import {
  KIT,
  Model,
  ModelEntity,
  ModelEntityFlow,
  ModelEntityFlowStep,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  Content,
  File,
  Folder,
  Fragment,
  Slot,
  cmp,
  each,
  isAuthActive,
} from '@voxgig/sdkgen'


import {
  projectPath
} from './utility_js'


// See TestEntity_ts.ts for the GenCtx/OpGen contract — this file mirrors
// it exactly, the only difference being the language string emitted.
type GenCtx = {
  model: Model
  entity: ModelEntity
  flow: ModelEntityFlow
  PROJUPPER: string
}

type OpGen = (ctx: GenCtx, step: ModelEntityFlowStep, index: number) => void


const TestEntity = cmp(function TestEntity(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model
  const stdrep = ctx$.stdrep

  const target = props.target
  const entity: ModelEntity = props.entity

  const PROJENVNAME = nom(model.const, 'NAME').replace(/[^A-Z_]/g, '_')
  const ENTENVNAME = nom(entity, 'NAME').replace(/[^A-Z_]/g, '_')
  const authActive = isAuthActive(model)
  const apikeyEnvEntry = authActive
    ? `\n    '${PROJENVNAME}_APIKEY': 'NONE',`
    : ''
  const apikeyLiveField = authActive
    ? `
        apikey: env.${PROJENVNAME}_APIKEY,`
    : ''

  // TODO: should be a utility function
  const ff = projectPath('src/cmp/js/fragment/')

  Folder({ name: entity.name }, () => {

    File({ name: nom(entity, 'Name') + 'Entity.test.' + target.name }, () => {

      Fragment({
        from: ff + 'Entity.test.fragment.js',
        replace: {
          SdkName: nom(model.const, 'Name'),
          EntityName: nom(entity, 'Name'),
          ...stdrep,
        }
      }, () => {

        const basicflow = getModelPath(model, `main.${KIT}.flow.Basic${nom(entity, 'Name')}Flow`)

        const dobasic = basicflow && true === basicflow.active

        if (!dobasic) {
          return;
        }

        const indent = 2

        const idlist = flatten([
          entity.name + '01',
          entity.name + '02',
          entity.name + '03',
          flatten(items(entity.relations.ancestors, (ap: any) =>
            items(ap[1], (a: any) =>
              items(['01', '02', '03'], (n: any) =>
                a[1] + n[1]))), 2)
        ])

        Slot({ name: 'basicSetup' }, () => {
          Content(`
function basicSetup(extra) {
  // TODO: fix test def options
  const options = {} // ${jsonify(basicflow.test, { offset: indent - 2 })}

  // TODO: needs test utility to resolve path
  const entityDataFile =
    Path.resolve(__dirname,
      '../../../../.sdk/test/entity/${entity.name}/${nom(entity, 'Name')}TestData.json')

  // TODO: file ready util needed?
  const entityDataSource = Fs.readFileSync(entityDataFile).toString('utf8')

  // TODO: need a xlang JSON parse utility in voxgig/struct with better error msgs
  const entityData = JSON.parse(entityDataSource)

  options.entity = entityData.existing

  let client = ${model.Name}SDK.test(options, extra)
  const struct = client.utility().struct
  const merge = struct.merge
  const transform = struct.transform

  let idmap = transform(
    ['${join(idlist, '\',\'')}'],
    {
      '\`$PACK\`': ['', {
        '\`$KEY\`': '\`$COPY\`',
        '\`$VAL\`': ['\`$FORMAT\`', 'upper', '\`$COPY\`']
      }]
    })

  const env = envOverride({
    '${PROJENVNAME}_TEST_${ENTENVNAME}_ENTID': idmap,
    '${PROJENVNAME}_TEST_LIVE': 'FALSE',
    '${PROJENVNAME}_TEST_EXPLAIN': 'FALSE',${apikeyEnvEntry}
  })

  idmap = env['${PROJENVNAME}_TEST_${ENTENVNAME}_ENTID']

  if ('TRUE' === env.${PROJENVNAME}_TEST_LIVE) {
    client = new ${model.Name}SDK(merge([
      {${apikeyLiveField}
      },
      extra
    ]))
  }

  const setup = {
    idmap,
    env,
    options,
    client,
    struct,
    data: entityData,
    explain: 'TRUE' === env.${PROJENVNAME}_TEST_EXPLAIN,
    now: Date.now(),
  }

  return setup
}
  `)
        })


        Slot({ name: 'basic' }, () => {
          const flowHasCreate = Object.values(basicflow.step).some(
            (s: any) => s.op === 'create'
          )

          Content(`
    const setup = basicSetup()
    const client = setup.client
    const struct = setup.struct

    const isempty = struct.isempty
    const select = struct.select

`)

          // When the flow has no create step, bootstrap the entity data variable
          // from existing test data so that subsequent update/load/remove steps
          // can reference it.
          if (!flowHasCreate) {
            const ref01 = entity.name + '_ref01'
            Content(`    let ${ref01}_data = Object.values(setup.data.existing.${entity.name})[0]
`)
          }

          const genCtx: GenCtx = {
            model, entity, flow: basicflow, PROJUPPER: PROJENVNAME,
          }
          each(basicflow.step, (step: ModelEntityFlowStep, index: number) => {
            const opgen = GENERATE_OP[step.op]
            if (null != opgen) {
              opgen(genCtx, step, index)
              Content('\n')
            }
          })
        })
      })
    })
  })
})


const generateCreate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  const priorSteps = flow.step.slice(0, Number(index))
  const needsEnt = !priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const hasDatvar = priorSteps.some(s => {
    if ('create' === s.op) {
      const priorRef = s.input.ref ?? entity.name + '_ref01'
      const priorDatvar = s.input.datavar ?? (priorRef + '_data' + (s.input.suffix ?? ''))
      return priorDatvar === datavar
    }
    return false
  })

  Content(`
    // CREATE
`)
  if (needsEnt) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  if (hasDatvar) {
    Content(`    ${datavar} = setup.data.new.${entity.name}['${ref}']
`)
  } else {
    Content(`    let ${datavar} = setup.data.new.${entity.name}['${ref}']
`)
  }

  each(step.match, (mi: any) => {
    Content(`    ${datavar}['${mi.key$}'] = setup.idmap['${mi.val$}']
`)
  })

  const hasEntIdC = null != entity.id

  Content(`
    ${datavar} = await ${entvar}.create(${datavar})
`)
  if (hasEntIdC) {
    Content(`    assert(null != ${datavar}.id)
`)
  }
  else {
    Content(`    assert(null != ${datavar})
`)
  }
}


const generateList: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const listvar = step.input.listvar ?? (ref + '_list' + (step.input.suffix ?? ''))

  const priorSteps = flow.step.slice(0, Number(index))
  const needsEnt = !priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`
    // LIST
`)
  if (needsEnt) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  Content(`    const ${matchvar} = {}
`)

  each(step.match, (mi: any) => {
    Content(`    ${matchvar}['${mi.key$}'] = setup.idmap['${mi.val$}']
`)
  })

  Content(`
    const ${listvar} = await ${entvar}.list(${matchvar})
`)
  const allSteps = flow.step
  for (let vI = 0; vI < step.valid.length; vI++) {
    const validator = step.valid[vI]
    const validRef = validator.def?.ref
    const hasRefData = validRef && allSteps.some(s => 'create' === s.op &&
      ((s.input.ref ?? entity.name + '_ref01') === validRef))

    if ('ItemExists' === validator.apply && hasRefData) {
      Content(`
    assert(!isempty(select(${listvar}, { id: ${validRef}_data.id })))
`)
    }
    else if ('ItemNotExists' === validator.apply && hasRefData) {
      Content(`
    assert(isempty(select(${listvar}, { id: ${validRef}_data.id })))
`)
    }
  }
}


const generateUpdate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))
  const resdatavar = step.input.resdatavar ?? (ref + '_resdata' + (step.input.suffix ?? ''))
  const markdefvar = step.input.markdefvar ?? (ref + '_markdef' + (step.input.suffix ?? ''))
  const srcdatavar = step.input.srcdatavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  const priorSteps = flow.step.slice(0, Number(index))
  const needsEnt = !priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const hasEntIdU = null != entity.id

  Content(`
    // UPDATE
`)
  if (needsEnt) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  Content(`    const ${datavar} = {}
`)
  if (hasEntIdU) {
    Content(`    ${datavar}.id = ${srcdatavar}.id
`)
  }

  each(step.data, (mi: any) => {
    if ('id' !== mi.key$) {
      Content(`    ${datavar} ['${mi.key$}'] = setup.idmap['${mi.key$}']
`)
    }
  })


  for (let sI = 0; sI < step.spec.length; sI++) {
    const spec = step.spec[sI]
    if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
      const fieldname = step.input.textfield
      const fieldvalue = spec.def.mark
      Content(`
    const ${markdefvar} = { name: '${fieldname}', value: '${fieldvalue}_' + setup.now }
    ${datavar} [${markdefvar}.name] = ${markdefvar}.value
`)
    }
  }

  Content(`
    const ${resdatavar} = await ${entvar}.update(${datavar})
`)
  if (hasEntIdU) {
    Content(`    assert(${resdatavar}.id === ${datavar}.id)
`)
  }
  else {
    Content(`    assert(null != ${resdatavar})
`)
  }

  for (let sI = 0; sI < step.spec.length; sI++) {
    const spec = step.spec[sI]
    if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
      Content(`
    assert(${resdatavar}[${markdefvar}.name] === ${markdefvar}.value)
`)
    }
  }

}


const generateLoad: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))
  const srcdatavar = step.input.srcdatavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  const priorSteps = flow.step.slice(0, Number(index))
  const hasEntVar = priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  // Check if srcdatavar was declared by a prior create step or by the
  // preamble bootstrap (which runs when the flow has no create step)
  const flowHasCreate = flow.step.some(s => s.op === 'create')
  const preambleRef = entity.name + '_ref01'
  const hasSrcData = (!flowHasCreate && srcdatavar === preambleRef + '_data') ||
    priorSteps.some(s => {
      if ('create' === s.op) {
        const priorRef = s.input.ref ?? entity.name + '_ref01'
        const priorDatvar = s.input.datavar ?? (priorRef + '_data' + (s.input.suffix ?? ''))
        return priorDatvar === srcdatavar
      }
      return false
    })

  const hasEntId = null != entity.id

  Content(`
    // LOAD
`)
  if (!hasEntVar) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  if (!hasSrcData && hasEntId) {
    Content(`    const ${srcdatavar} = Object.values(setup.data.existing.${entity.name})[0]
`)
  }
  if (hasEntId) {
    Content(`    const ${matchvar} = {}
    ${matchvar}.id = ${srcdatavar}.id
    const ${datavar} = await ${entvar}.load(${matchvar})
    assert(${datavar}.id === ${srcdatavar}.id)
`)
  }
  else {
    Content(`    const ${matchvar} = {}
    const ${datavar} = await ${entvar}.load(${matchvar})
    assert(null != ${datavar})
`)
  }
}


const generateRemove: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const srcdatavar = step.input.srcdatavar ?? (ref + '_data')

  const priorSteps = flow.step.slice(0, Number(index))
  const needsEnt = !priorSteps.some(s =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const hasEntIdR = null != entity.id

  Content(`
    // REMOVE
`)
  if (needsEnt) {
    Content(`    const ${entvar} = client.${nom(entity, 'Name')}()
`)
  }
  Content(`    const ${matchvar} = {}
`)
  if (hasEntIdR) {
    Content(`    ${matchvar}.id = ${srcdatavar}.id
`)
  }
  Content(`    await ${entvar}.remove(${matchvar})
  `)
}


const GENERATE_OP: Record<string, OpGen> = {
  create: generateCreate,
  list: generateList,
  update: generateUpdate,
  load: generateLoad,
  remove: generateRemove,
}


export {
  TestEntity
}
