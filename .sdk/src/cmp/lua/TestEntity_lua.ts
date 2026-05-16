
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
    ? `\n    ["${PROJUPPER}_APIKEY"] = "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n        apikey = env["${PROJUPPER}_APIKEY"],`
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

    Content(`-- ${entity.Name} entity test

local json = require("dkjson")
local vs = require("utility.struct.struct")
local sdk = require("${model.name}_sdk")
local helpers = require("core.helpers")
local runner = require("test.runner")

local _test_dir = debug.getinfo(1, "S").source:match("^@(.+/)")  or "./"

describe("${entity.Name}Entity", function()
  it("should create instance", function()
    local testsdk = sdk.test(nil, nil)
    local ent = testsdk:${entity.Name}(nil)
    assert.is_not_nil(ent)
  end)

  it("should run basic flow", function()
    local setup = ${entity.name}_basic_setup(nil)
    -- Per-op sdk-test-control.json skip.
    local _live = setup.live or false
    for _, _op in ipairs({${(Array.from(new Set((allSteps as any[]).map((s: any) => s.op).filter(Boolean)))).map(o => `"${o}"`).join(', ')}}) do
      local _should_skip, _reason = runner.is_control_skipped("entityOp", "${entity.name}." .. _op, _live and "live" or "unit")
      if _should_skip then
        pending(_reason or "skipped via sdk-test-control.json")
        return
      end
    end
    -- The basic flow consumes synthetic IDs from the fixture. In live mode
    -- without an *_ENTID env override, those IDs hit the live API and 4xx.
    if setup.synthetic_only then
      pending("live entity test uses synthetic IDs from fixture — set ${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID JSON to run live")
      return
    end
    local client = setup.client

`)

    // Check if the flow has a create step
    const flowHasCreate = allSteps.some((s: any) => s.op === 'create')
    if (!flowHasCreate) {
      Content(`    -- Bootstrap entity data from existing test data.
    local ${entity.name}_ref01_data_raw = vs.items(helpers.to_map(
      vs.getpath(setup.data, "existing.${entity.name}")))
    local ${entity.name}_ref01_data = nil
    if #${entity.name}_ref01_data_raw > 0 then
      ${entity.name}_ref01_data = helpers.to_map(${entity.name}_ref01_data_raw[1][2])
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

    Content(`  end)
end)

`)

    // Generate setup function
    Content(`function ${entity.name}_basic_setup(extra)
  runner.load_env_local()

  local entity_data_file = _test_dir .. "../../.sdk/test/entity/${entity.name}/${entity.Name}TestData.json"
  local f = io.open(entity_data_file, "r")
  if f == nil then
    error("failed to read ${entity.name} test data: " .. entity_data_file)
  end
  local entity_data_source = f:read("*a")
  f:close()

  local entity_data = json.decode(entity_data_source)

  local options = {}
  options["entity"] = entity_data["existing"]

  local client = sdk.test(options, extra)

`)

    // Generate idmap via vs.transform
    Content(`  -- Generate idmap via transform.
  local idmap = vs.transform(
    { ${idnamesStr} },
    {
      ["\`$PACK\`"] = { "", {
        ["\`$KEY\`"] = "\`$COPY\`",
        ["\`$VAL\`"] = { "\`$FORMAT\`", "upper", "\`$COPY\`" },
      }},
    }
  )

`)

    Content(`  -- Detect ENTID env override before envOverride consumes it. When live
  -- mode is on without a real override, the basic test runs against synthetic
  -- IDs from the fixture and 4xx's. Surface this so the test can skip.
  local entid_env_raw = os.getenv("${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID")
  local idmap_overridden = entid_env_raw ~= nil and entid_env_raw:match("^%s*{") ~= nil

  local env = runner.env_override({
    ["${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID"] = idmap,
    ["${PROJUPPER}_TEST_LIVE"] = "FALSE",
    ["${PROJUPPER}_TEST_EXPLAIN"] = "FALSE",${apikeyEnvEntry}
  })

  local idmap_resolved = helpers.to_map(
    env["${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID"])
  if idmap_resolved == nil then
    idmap_resolved = helpers.to_map(idmap)
  end
`)

    // Add aliases
    for (const [key, val] of aliases) {
      Content(`  if idmap_resolved["${key}"] == nil then
    idmap_resolved["${key}"] = idmap_resolved["${val}"]
  end
`)
    }

    Content(`
  if env["${PROJUPPER}_TEST_LIVE"] == "TRUE" then
    local merged_opts = vs.merge({
      {${apikeyLiveField}
      },
      extra or {},
    })
    client = sdk.new(helpers.to_map(merged_opts))
  end

  local live = env["${PROJUPPER}_TEST_LIVE"] == "TRUE"
  return {
    client = client,
    data = entity_data,
    idmap = idmap_resolved,
    env = env,
    explain = env["${PROJUPPER}_TEST_EXPLAIN"] == "TRUE",
    live = live,
    synthetic_only = live and not idmap_overridden,
    now = os.time() * 1000,
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

  Content(`    -- CREATE
`)
  if (needsEnt) {
    Content(`    local ${entvar} = client:${entity.Name}(nil)
`)
  }

  if (hasDatvar) {
    Content(`    ${datavar} = helpers.to_map(vs.getprop(
      vs.getpath(setup.data, "new.${entity.name}"), "${ref}"))
`)
  } else {
    Content(`    local ${datavar} = helpers.to_map(vs.getprop(
      vs.getpath(setup.data, "new.${entity.name}"), "${ref}"))
`)
  }

  const matchEntries = getMatchEntries(step)
  for (const [key, val] of matchEntries) {
    Content(`    ${datavar}["${key}"] = setup.idmap["${val}"]
`)
  }

  Content(`
    local ${datavar}_result, err = ${entvar}:create(${datavar}, nil)
    assert.is_nil(err)
    ${datavar} = helpers.to_map(${datavar}_result)
    assert.is_not_nil(${datavar})
`)
  if (null != ctx.entity.id) {
    Content(`    assert.is_not_nil(${datavar}["id"])
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

  Content(`    -- LIST
`)
  if (needsEnt) {
    Content(`    local ${entvar} = client:${entity.Name}(nil)
`)
  }

  const matchEntries = getMatchEntries(step)
  if (matchEntries.length === 0) {
    Content(`    local ${matchvar} = {}
`)
  } else {
    Content(`    local ${matchvar} = {
`)
    for (const [key, val] of matchEntries) {
      Content(`      ["${key}"] = setup.idmap["${val}"],
`)
    }
    Content(`    }
`)
  }

  Content(`
    local ${listvar}_result, err = ${entvar}:list(${matchvar}, nil)
    assert.is_nil(err)
    assert.is_table(${listvar}_result)
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
    local found_item = vs.select(
      runner.entity_list_to_data(${listvar}_result),
      { id = ${refDataVar}["id"] })
    assert.is_false(vs.isempty(found_item))
`)
      } else if ('ItemNotExists' === validator.apply && hasRefData) {
        const refDataVar = validRef + '_data'
        Content(`
    local not_found_item = vs.select(
      runner.entity_list_to_data(${listvar}_result),
      { id = ${refDataVar}["id"] })
    assert.is_true(vs.isempty(not_found_item))
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

  Content(`    -- UPDATE
`)
  if (needsEnt) {
    Content(`    local ${entvar} = client:${entity.Name}(nil)
`)
  }
  Content(`    local ${datavar}_up = {
`)
  if (hasEntIdU) {
    Content(`      id = ${srcdatavar}["id"],
`)
  }

  if (step.data) {
    const dataEntries = Object.entries(step.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    for (const [key] of dataEntries) {
      Content(`      ["${key}"] = setup.idmap["${key}"],
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
    local ${markdefvar}_name = "${fieldname}"
    local ${markdefvar}_value = "${fieldvalue}_" .. tostring(setup.now)
    ${datavar}_up[${markdefvar}_name] = ${markdefvar}_value
`)
      }
    }
  }

  Content(`
    local ${resdatavar}_result, err = ${entvar}:update(${datavar}_up, nil)
    assert.is_nil(err)
    local ${resdatavar} = helpers.to_map(${resdatavar}_result)
    assert.is_not_nil(${resdatavar})
`)
  if (hasEntIdU) {
    Content(`    assert.are.equal(${resdatavar}["id"], ${datavar}_up["id"])
`)
  }

  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        Content(`    assert.are.equal(${resdatavar}[${markdefvar}_name], ${markdefvar}_value)
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

  Content(`    -- LOAD
`)
  if (!hasEntVar) {
    Content(`    local ${entvar} = client:${entity.Name}(nil)
`)
  }
  if (!hasSrcData && hasEntId) {
    Content(`    local ${srcdatavar}_raw = vs.items(helpers.to_map(
      vs.getpath(setup.data, "existing.${entity.name}")))
    local ${srcdatavar} = nil
    if #${srcdatavar}_raw > 0 then
      ${srcdatavar} = helpers.to_map(${srcdatavar}_raw[1][2])
    end
`)
  }
  if (hasEntId) {
    Content(`    local ${matchvar} = {
      id = ${srcdatavar}["id"],
    }
    local ${datavar}_loaded, err = ${entvar}:load(${matchvar}, nil)
    assert.is_nil(err)
    local ${datavar}_load_result = helpers.to_map(${datavar}_loaded)
    assert.is_not_nil(${datavar}_load_result)
    assert.are.equal(${datavar}_load_result["id"], ${srcdatavar}["id"])
`)
  }
  else {
    Content(`    local ${matchvar} = {}
    local ${datavar}_loaded, err = ${entvar}:load(${matchvar}, nil)
    assert.is_nil(err)
    assert.is_not_nil(${datavar}_loaded)
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

  Content(`    -- REMOVE
`)
  if (needsEnt) {
    Content(`    local ${entvar} = client:${entity.Name}(nil)
`)
  }
  // Always match the prior-created entity by id to avoid mock-order flakes.
  Content(`    local ${matchvar} = {
      id = ${srcdatavar}["id"],
    }
    local _, err = ${entvar}:remove(${matchvar}, nil)
    assert.is_nil(err)
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
