
import {
  flatten,
  items,
  join,
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
  cmp,
  each,
  buildIdNames,
  getMatchEntries,
  isAuthActive,
} from '@voxgig/sdkgen'


// See TestEntity_ts.ts for the GenCtx/OpGen contract.
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

  const target = props.target
  const entity: ModelEntity = props.entity

  const basicflow: ModelEntityFlow | undefined =
    getModelPath(model, `main.${KIT}.flow.Basic${nom(entity, 'Name')}Flow`)
  if (null == basicflow || true !== basicflow.active) {
    return
  }

  const PROJUPPER = nom(model.const, 'Name').toUpperCase().replace(/[^A-Z_]/g, '_')

  const authActive = isAuthActive(model)
  const apikeyEnvEntry = authActive
    ? `\n    "${PROJUPPER}_APIKEY" => "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n        "apikey" => env["${PROJUPPER}_APIKEY"],`
    : ''

  const idnames = buildIdNames(entity, basicflow)
  const idnamesStr = idnames.map(n => `"${n}"`).join(', ')

  const allSteps = Object.values(basicflow.step) as any[]
  const updateStep = allSteps.find((s: any) => s.op === 'update')
  const updateData = updateStep?.data
    ? Object.entries(updateStep.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    : []
  const aliases = updateData.map(([k, v]: any) => [k, v])

  const genCtx: GenCtx = { model, entity, flow: basicflow, PROJUPPER }

  File({ name: entity.name + '_entity_test.' + target.ext }, () => {

    Content(`# ${entity.Name} entity test

require "minitest/autorun"
require "json"
require_relative "../${model.const.Name}_sdk"
require_relative "runner"

class ${entity.Name}EntityTest < Minitest::Test
  def test_create_instance
    testsdk = ${model.const.Name}SDK.test(nil, nil)
    ent = testsdk.${entity.Name}(nil)
    assert !ent.nil?
  end

  def test_basic_flow
    setup = ${entity.name}_basic_setup(nil)
    # Per-op sdk-test-control.json skip.
    _live = setup[:live] || false
    [${(Array.from(new Set((allSteps as any[]).map((s: any) => s.op).filter(Boolean)))).map(o => `"${o}"`).join(', ')}].each do |_op|
      _should_skip, _reason = Runner.is_control_skipped("entityOp", "${entity.name}." + _op, _live ? "live" : "unit")
      if _should_skip
        skip(_reason || "skipped via sdk-test-control.json")
        return
      end
    end
    # The basic flow consumes synthetic IDs from the fixture. In live mode
    # without an *_ENTID env override, those IDs hit the live API and 4xx.
    if setup[:synthetic_only]
      skip "live entity test uses synthetic IDs from fixture — set ${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID JSON to run live"
      return
    end
    client = setup[:client]

`)

    // Check if the flow has a create step
    const flowHasCreate = allSteps.some((s: any) => s.op === 'create')
    if (!flowHasCreate) {
      Content(`    # Bootstrap entity data from existing test data.
    ${entity.name}_ref01_data_raw = Vs.items(Helpers.to_map(
      Vs.getpath(setup[:data], "existing.${entity.name}")))
    ${entity.name}_ref01_data = nil
    if ${entity.name}_ref01_data_raw.length > 0
      ${entity.name}_ref01_data = Helpers.to_map(${entity.name}_ref01_data_raw[0][1])
    end

`)
    }

    // Model-driven step iteration
    each(basicflow.step, (step: any, index: any) => {
      const opgen: OpGen = GENERATE_OP[step.op]
      if (opgen) {
        opgen(genCtx, step, index)
        Content('\n')
      }
    })

    Content(`  end
end

`)

    // Generate setup function
    Content(`def ${entity.name}_basic_setup(extra)
  Runner.load_env_local

  entity_data_file = File.join(__dir__, "..", "..", ".sdk", "test", "entity", "${entity.name}", "${entity.Name}TestData.json")
  entity_data_source = File.read(entity_data_file)
  entity_data = JSON.parse(entity_data_source)

  options = {}
  options["entity"] = entity_data["existing"]

  client = ${model.const.Name}SDK.test(options, extra)

`)

    // Generate idmap via Vs.transform
    Content(`  # Generate idmap via transform.
  idmap = Vs.transform(
    [${idnamesStr}],
    {
      "\`$PACK\`" => ["", {
        "\`$KEY\`" => "\`$COPY\`",
        "\`$VAL\`" => ["\`$FORMAT\`", "upper", "\`$COPY\`"],
      }],
    }
  )

`)

    Content(`  # Detect ENTID env override before envOverride consumes it. When live
  # mode is on without a real override, the basic test runs against synthetic
  # IDs from the fixture and 4xx's. Surface this so the test can skip.
  entid_env_raw = ENV["${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID"]
  idmap_overridden = !entid_env_raw.nil? && entid_env_raw.strip.start_with?("{")

  env = Runner.env_override({
    "${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID" => idmap,
    "${PROJUPPER}_TEST_LIVE" => "FALSE",
    "${PROJUPPER}_TEST_EXPLAIN" => "FALSE",${apikeyEnvEntry}
  })

  idmap_resolved = Helpers.to_map(
    env["${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID"])
  if idmap_resolved.nil?
    idmap_resolved = Helpers.to_map(idmap)
  end
`)

    // Add aliases
    for (const [key, val] of aliases) {
      Content(`  if idmap_resolved["${key}"].nil?
    idmap_resolved["${key}"] = idmap_resolved["${val}"]
  end
`)
    }

    Content(`
  if env["${PROJUPPER}_TEST_LIVE"] == "TRUE"
    merged_opts = Vs.merge([
      {${apikeyLiveField}
      },
      extra || {},
    ])
    client = ${model.const.Name}SDK.new(Helpers.to_map(merged_opts))
  end

  live = env["${PROJUPPER}_TEST_LIVE"] == "TRUE"
  {
    client: client,
    data: entity_data,
    idmap: idmap_resolved,
    env: env,
    explain: env["${PROJUPPER}_TEST_EXPLAIN"] == "TRUE",
    live: live,
    synthetic_only: live && !idmap_overridden,
    now: (Time.now.to_f * 1000).to_i,
  }
end
`)
  })
})


const generateCreate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const datavar = step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? ''))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const hasDatvar = priorSteps.some((s: any) => {
    if ('create' === s.op) {
      const priorRef = s.input.ref ?? entity.name + '_ref01'
      const priorDatvar = s.input.datavar ?? (priorRef + '_data' + (s.input.suffix ?? ''))
      return priorDatvar === datavar
    }
    return false
  })

  Content(`    # CREATE
`)
  if (needsEnt) {
    Content(`    ${entvar} = client.${entity.Name}(nil)
`)
  }

  if (hasDatvar) {
    Content(`    ${datavar} = Helpers.to_map(Vs.getprop(
      Vs.getpath(setup[:data], "new.${entity.name}"), "${ref}"))
`)
  } else {
    Content(`    ${datavar} = Helpers.to_map(Vs.getprop(
      Vs.getpath(setup[:data], "new.${entity.name}"), "${ref}"))
`)
  }

  const matchEntries = getMatchEntries(step)
  for (const [key, val] of matchEntries) {
    Content(`    ${datavar}["${key}"] = setup[:idmap]["${val}"]
`)
  }

  Content(`
    ${datavar}_result, err = ${entvar}.create(${datavar}, nil)
    assert_nil err
    ${datavar} = Helpers.to_map(${datavar}_result)
    assert !${datavar}.nil?
`)
  if (null != ctx.entity.id) {
    Content(`    assert !${datavar}["id"].nil?
`)
  }
}


const generateList: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const listvar = step.input.listvar ?? (ref + '_list' + (step.input.suffix ?? ''))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`    # LIST
`)
  if (needsEnt) {
    Content(`    ${entvar} = client.${entity.Name}(nil)
`)
  }

  const matchEntries = getMatchEntries(step)
  if (matchEntries.length === 0) {
    Content(`    ${matchvar} = {}
`)
  } else {
    Content(`    ${matchvar} = {
`)
    for (const [key, val] of matchEntries) {
      Content(`      "${key}" => setup[:idmap]["${val}"],
`)
    }
    Content(`    }
`)
  }

  Content(`
    ${listvar}_result, err = ${entvar}.list(${matchvar}, nil)
    assert_nil err
    assert ${listvar}_result.is_a?(Array)
`)

  // Handle validators
  const allSteps = Object.values(flow.step) as any[]
  if (step.valid) {
    for (const validator of step.valid) {
      const validRef = validator.def?.ref
      const hasRefData = validRef && allSteps.some((s: any) => 'create' === s.op &&
        ((s.input.ref ?? entity.name + '_ref01') === validRef))

      if ('ItemExists' === validator.apply && hasRefData) {
        const refDataVar = validRef + '_data'
        Content(`
    found_item = Vs.select(
      Runner.entity_list_to_data(${listvar}_result),
      { "id" => ${refDataVar}["id"] })
    assert !Vs.isempty(found_item)
`)
      } else if ('ItemNotExists' === validator.apply && hasRefData) {
        const refDataVar = validRef + '_data'
        Content(`
    not_found_item = Vs.select(
      Runner.entity_list_to_data(${listvar}_result),
      { "id" => ${refDataVar}["id"] })
    assert Vs.isempty(not_found_item)
`)
      }
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

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const hasEntIdU = null != entity.id

  Content(`    # UPDATE
`)
  if (needsEnt) {
    Content(`    ${entvar} = client.${entity.Name}(nil)
`)
  }
  Content(`    ${datavar}_up = {
`)
  if (hasEntIdU) {
    Content(`      "id" => ${srcdatavar}["id"],
`)
  }

  if (step.data) {
    const dataEntries = Object.entries(step.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    for (const [key] of dataEntries) {
      Content(`      "${key}" => setup[:idmap]["${key}"],
`)
    }
  }

  Content(`    }
`)

  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        const fieldname = step.input.textfield
        const fieldvalue = spec.def?.mark ?? `Mark01-${ref}`
        Content(`
    ${markdefvar}_name = "${fieldname}"
    ${markdefvar}_value = "${fieldvalue}_#{setup[:now]}"
    ${datavar}_up[${markdefvar}_name] = ${markdefvar}_value
`)
      }
    }
  }

  Content(`
    ${resdatavar}_result, err = ${entvar}.update(${datavar}_up, nil)
    assert_nil err
    ${resdatavar} = Helpers.to_map(${resdatavar}_result)
    assert !${resdatavar}.nil?
`)
  if (hasEntIdU) {
    Content(`    assert_equal ${resdatavar}["id"], ${datavar}_up["id"]
`)
  }

  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        Content(`    assert_equal ${resdatavar}[${markdefvar}_name], ${markdefvar}_value
`)
      }
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

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const hasEntVar = priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const flowHasCreate = Object.values(flow.step).some((s: any) => (s as any).op === 'create')
  const preambleRef = entity.name + '_ref01'
  const hasSrcData = (!flowHasCreate && srcdatavar === (preambleRef + '_data')) ||
    priorSteps.some((s: any) => {
      if ('create' === s.op) {
        const priorRef = s.input.ref ?? entity.name + '_ref01'
        const priorDatvar = s.input.datavar ?? (priorRef + '_data' + (s.input.suffix ?? ''))
        return priorDatvar === srcdatavar
      }
      return false
    })

  const hasEntId = null != entity.id

  Content(`    # LOAD
`)
  if (!hasEntVar) {
    Content(`    ${entvar} = client.${entity.Name}(nil)
`)
  }
  if (!hasSrcData && hasEntId) {
    Content(`    ${srcdatavar}_raw = Vs.items(Helpers.to_map(
      Vs.getpath(setup[:data], "existing.${entity.name}")))
    ${srcdatavar} = nil
    if ${srcdatavar}_raw.length > 0
      ${srcdatavar} = Helpers.to_map(${srcdatavar}_raw[0][1])
    end
`)
  }
  if (hasEntId) {
    Content(`    ${matchvar} = {
      "id" => ${srcdatavar}["id"],
    }
    ${datavar}_loaded, err = ${entvar}.load(${matchvar}, nil)
    assert_nil err
    ${datavar}_load_result = Helpers.to_map(${datavar}_loaded)
    assert !${datavar}_load_result.nil?
    assert_equal ${datavar}_load_result["id"], ${srcdatavar}["id"]
`)
  }
  else {
    Content(`    ${matchvar} = {}
    ${datavar}_loaded, err = ${entvar}.load(${matchvar}, nil)
    assert_nil err
    assert !${datavar}_loaded.nil?
`)
  }
}


const generateRemove: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const srcdatavar = step.input.srcdatavar ?? (ref + '_data')

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`    # REMOVE
`)
  if (needsEnt) {
    Content(`    ${entvar} = client.${entity.Name}(nil)
`)
  }
  // Always match the prior-created entity by id to avoid mock-order flakes.
  Content(`    ${matchvar} = {
      "id" => ${srcdatavar}["id"],
    }
    _, err = ${entvar}.remove(${matchvar}, nil)
    assert_nil err
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
