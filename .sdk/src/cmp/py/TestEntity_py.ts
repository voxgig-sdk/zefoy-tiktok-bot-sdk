
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

  // No flow or flow inactive — nothing to generate. The narrowed-form
  // check (rather than `if (!dobasic)`) is what lets TS know `basicflow`
  // is non-null in the rest of the cmp body.
  if (null == basicflow || true !== basicflow.active) {
    return
  }

  const PROJUPPER = nom(model.const, 'Name').toUpperCase().replace(/[^A-Z_]/g, '_')

  const authActive = isAuthActive(model)
  const apikeyEnvEntry = authActive
    ? `\n        "${PROJUPPER}_APIKEY": "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n                "apikey": env.get("${PROJUPPER}_APIKEY"),`
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

  File({ name: 'test_' + entity.name + '_entity.' + target.ext }, () => {

    Content(`# ${entity.Name} entity test

import json
import os
import time

import pytest

from utility.voxgig_struct import voxgig_struct as vs
from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK
from core import helpers

_TEST_DIR = os.path.dirname(os.path.abspath(__file__))
from test import runner


class Test${entity.Name}Entity:

    def test_should_create_instance(self):
        testsdk = ${model.const.Name}SDK.test(None, None)
        ent = testsdk.${entity.Name}(None)
        assert ent is not None

    def test_should_run_basic_flow(self):
        setup = _${entity.name}_basic_setup(None)
        # Per-op sdk-test-control.json skip — basic test exercises a flow with
        # multiple ops; skipping any one skips the whole flow (steps depend
        # on each other).
        _live = setup.get("live", False)
        for _op in [${(Array.from(new Set((basicflow.step as any[]).map((s: any) => s.op).filter(Boolean)))).map(o => `"${o}"`).join(', ')}]:
            _skip, _reason = runner.is_control_skipped("entityOp", "${entity.name}." + _op, "live" if _live else "unit")
            if _skip:
                pytest.skip(_reason or "skipped via sdk-test-control.json")
                return
        # The basic flow consumes synthetic IDs from the fixture. In live mode
        # without an *_ENTID env override, those IDs hit the live API and 4xx.
        if setup.get("synthetic_only"):
            pytest.skip("live entity test uses synthetic IDs from fixture — "
                        "set ${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID JSON to run live")
        client = setup["client"]

`)

    // Check if the flow has a create step
    const flowHasCreate = allSteps.some((s: any) => s.op === 'create')
    if (!flowHasCreate) {
      Content(`        # Bootstrap entity data from existing test data.
        ${entity.name}_ref01_data_raw = vs.items(helpers.to_map(
            vs.getpath(setup["data"], "existing.${entity.name}")))
        ${entity.name}_ref01_data = None
        if len(${entity.name}_ref01_data_raw) > 0:
            ${entity.name}_ref01_data = helpers.to_map(${entity.name}_ref01_data_raw[0][1])

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

    Content(`

def _${entity.name}_basic_setup(extra):
    runner.load_env_local()

    entity_data_file = os.path.join(_TEST_DIR, "../../.sdk/test/entity/${entity.name}/${entity.Name}TestData.json")
    with open(entity_data_file, "r") as f:
        entity_data_source = f.read()

    entity_data = json.loads(entity_data_source)

    options = {}
    options["entity"] = entity_data.get("existing")

    client = ${model.const.Name}SDK.test(options, extra)

`)

    // Generate idmap via vs.transform
    Content(`    # Generate idmap via transform.
    idmap = vs.transform(
        [${idnamesStr}],
        {
            "\`$PACK\`": ["", {
                "\`$KEY\`": "\`$COPY\`",
                "\`$VAL\`": ["\`$FORMAT\`", "upper", "\`$COPY\`"],
            }],
        }
    )

`)

    Content(`    # Detect ENTID env override before envOverride consumes it. When live
    # mode is on without a real override, the basic test runs against synthetic
    # IDs from the fixture and 4xx's. We surface this so the test can skip.
    _entid_env_raw = os.environ.get(
        "${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID")
    _idmap_overridden = _entid_env_raw is not None and _entid_env_raw.strip().startswith("{")

    env = runner.env_override({
        "${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID": idmap,
        "${PROJUPPER}_TEST_LIVE": "FALSE",
        "${PROJUPPER}_TEST_EXPLAIN": "FALSE",${apikeyEnvEntry}
    })

    idmap_resolved = helpers.to_map(
        env.get("${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID"))
    if idmap_resolved is None:
        idmap_resolved = helpers.to_map(idmap)
`)

    // Add aliases
    for (const [key, val] of aliases) {
      Content(`    if idmap_resolved.get("${key}") is None:
        idmap_resolved["${key}"] = idmap_resolved.get("${val}")
`)
    }

    Content(`
    if env.get("${PROJUPPER}_TEST_LIVE") == "TRUE":
        merged_opts = vs.merge([
            {${apikeyLiveField}
            },
            extra or {},
        ])
        client = ${model.const.Name}SDK(helpers.to_map(merged_opts))

    _live = env.get("${PROJUPPER}_TEST_LIVE") == "TRUE"
    return {
        "client": client,
        "data": entity_data,
        "idmap": idmap_resolved,
        "env": env,
        "explain": env.get("${PROJUPPER}_TEST_EXPLAIN") == "TRUE",
        "live": _live,
        "synthetic_only": _live and not _idmap_overridden,
        "now": int(time.time() * 1000),
    }
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

  Content(`        # CREATE
`)
  if (needsEnt) {
    Content(`        ${entvar} = client.${entity.Name}(None)
`)
  }

  if (hasDatvar) {
    Content(`        ${datavar} = helpers.to_map(vs.getprop(
            vs.getpath(setup["data"], "new.${entity.name}"), "${ref}"))
`)
  } else {
    Content(`        ${datavar} = helpers.to_map(vs.getprop(
            vs.getpath(setup["data"], "new.${entity.name}"), "${ref}"))
`)
  }

  const matchEntries = getMatchEntries(step)
  for (const [key, val] of matchEntries) {
    Content(`        ${datavar}["${key}"] = setup["idmap"]["${val}"]
`)
  }

  const hasEntIdC = null != ctx.entity.id

  Content(`
        ${datavar}_result, err = ${entvar}.create(${datavar}, None)
        assert err is None
        ${datavar} = helpers.to_map(${datavar}_result)
        assert ${datavar} is not None
`)
  if (hasEntIdC) {
    Content(`        assert ${datavar}["id"] is not None
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

  Content(`        # LIST
`)
  if (needsEnt) {
    Content(`        ${entvar} = client.${entity.Name}(None)
`)
  }

  const matchEntries = getMatchEntries(step)
  if (matchEntries.length === 0) {
    Content(`        ${matchvar} = {}
`)
  } else {
    Content(`        ${matchvar} = {
`)
    for (const [key, val] of matchEntries) {
      Content(`            "${key}": setup["idmap"]["${val}"],
`)
    }
    Content(`        }
`)
  }

  Content(`
        ${listvar}_result, err = ${entvar}.list(${matchvar}, None)
        assert err is None
        assert isinstance(${listvar}_result, list)
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
        found_item = vs.select(
            runner.entity_list_to_data(${listvar}_result),
            {"id": ${refDataVar}["id"]})
        assert not vs.isempty(found_item)
`)
      } else if ('ItemNotExists' === validator.apply && hasRefData) {
        const refDataVar = validRef + '_data'
        Content(`
        not_found_item = vs.select(
            runner.entity_list_to_data(${listvar}_result),
            {"id": ${refDataVar}["id"]})
        assert vs.isempty(not_found_item)
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

  Content(`        # UPDATE
`)
  if (needsEnt) {
    Content(`        ${entvar} = client.${entity.Name}(None)
`)
  }
  Content(`        ${datavar}_up = {
`)
  if (hasEntIdU) {
    Content(`            "id": ${srcdatavar}["id"],
`)
  }

  if (step.data) {
    const dataEntries = Object.entries(step.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    for (const [key] of dataEntries) {
      Content(`            "${key}": setup["idmap"]["${key}"],
`)
    }
  }

  Content(`        }
`)

  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        const fieldname = step.input.textfield
        const fieldvalue = spec.def?.mark ?? `Mark01-${ref}`
        Content(`
        ${markdefvar}_name = "${fieldname}"
        ${markdefvar}_value = "${fieldvalue}_" + str(setup["now"])
        ${datavar}_up[${markdefvar}_name] = ${markdefvar}_value
`)
      }
    }
  }

  Content(`
        ${resdatavar}_result, err = ${entvar}.update(${datavar}_up, None)
        assert err is None
        ${resdatavar} = helpers.to_map(${resdatavar}_result)
        assert ${resdatavar} is not None
`)
  if (hasEntIdU) {
    Content(`        assert ${resdatavar}["id"] == ${datavar}_up["id"]
`)
  }

  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        Content(`        assert ${resdatavar}[${markdefvar}_name] == ${markdefvar}_value
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

  Content(`        # LOAD
`)
  if (!hasEntVar) {
    Content(`        ${entvar} = client.${entity.Name}(None)
`)
  }
  if (!hasSrcData && hasEntId) {
    Content(`        ${srcdatavar}_raw = vs.items(helpers.to_map(
            vs.getpath(setup["data"], "existing.${entity.name}")))
        ${srcdatavar} = None
        if len(${srcdatavar}_raw) > 0:
            ${srcdatavar} = helpers.to_map(${srcdatavar}_raw[0][1])
`)
  }
  if (hasEntId) {
    Content(`        ${matchvar} = {
            "id": ${srcdatavar}["id"],
        }
        ${datavar}_loaded, err = ${entvar}.load(${matchvar}, None)
        assert err is None
        ${datavar}_load_result = helpers.to_map(${datavar}_loaded)
        assert ${datavar}_load_result is not None
        assert ${datavar}_load_result["id"] == ${srcdatavar}["id"]
`)
  }
  else {
    Content(`        ${matchvar} = {}
        ${datavar}_loaded, err = ${entvar}.load(${matchvar}, None)
        assert err is None
        assert ${datavar}_loaded is not None
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

  Content(`        # REMOVE
`)
  if (needsEnt) {
    Content(`        ${entvar} = client.${entity.Name}(None)
`)
  }
  // Always match the prior-created entity by id to avoid mock-order flakes.
  Content(`        ${matchvar} = {
            "id": ${srcdatavar}["id"],
        }
        _, err = ${entvar}.remove(${matchvar}, None)
        assert err is None
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
