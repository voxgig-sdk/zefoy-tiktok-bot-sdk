
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


// PHP's GenCtx mirrors the shared shape (see TestEntity_ts.ts) plus an
// `accessor` slot used to mangle the entity factory name when it collides
// with PHP's case-insensitive `test()` static constructor.
type GenCtx = {
  model: Model
  entity: ModelEntity
  flow: ModelEntityFlow
  PROJUPPER: string
  accessor: string
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

  // PHP method names are case-insensitive — an entity literally named 'test'
  // collides with the static `test()` test-mode constructor on the SDK class.
  // Mirror the mangling done in MainEntity_php.ts.
  const entName = nom(entity, 'Name')
  const accessor = 'test' === entName.toLowerCase()
    ? entName + '_'
    : entName

  const PROJUPPER = nom(model.const, 'Name').toUpperCase().replace(/[^A-Z_]/g, '_')

  const authActive = isAuthActive(model)
  const apikeyEnvEntry = authActive
    ? `\n        "${PROJUPPER}_APIKEY" => "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n                "apikey" => $env["${PROJUPPER}_APIKEY"],`
    : ''

  const idnames = buildIdNames(entity, basicflow)
  const idnamesStr = idnames.map(n => `"${n}"`).join(', ')

  const allSteps = Object.values(basicflow.step) as any[]
  const updateStep = allSteps.find((s: any) => s.op === 'update')
  const updateData = updateStep?.data
    ? Object.entries(updateStep.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    : []
  const aliases = updateData.map(([k, v]: any) => [k, v])

  const genCtx: GenCtx = { model, entity, flow: basicflow, PROJUPPER, accessor }

  File({ name: entity.Name + 'EntityTest.' + target.ext }, () => {

    Content(`<?php
declare(strict_types=1);

// ${entity.Name} entity test

require_once __DIR__ . '/../${model.const.Name.toLowerCase()}_sdk.php';
require_once __DIR__ . '/Runner.php';

use PHPUnit\\Framework\\TestCase;
use Voxgig\\Struct\\Struct as Vs;

class ${entity.Name}EntityTest extends TestCase
{
    public function test_create_instance(): void
    {
        $testsdk = ${model.const.Name}SDK::test(null, null);
        $ent = $testsdk->${accessor}(null);
        $this->assertNotNull($ent);
    }

    public function test_basic_flow(): void
    {
        $setup = ${entity.name}_basic_setup(null);
        // Per-op sdk-test-control.json skip.
        $_live = !empty($setup["live"]);
        foreach ([${(Array.from(new Set((allSteps as any[]).map((s: any) => s.op).filter(Boolean)))).map(o => `"${o}"`).join(', ')}] as $_op) {
            [$_shouldSkip, $_reason] = Runner::is_control_skipped("entityOp", "${entity.name}." . $_op, $_live ? "live" : "unit");
            if ($_shouldSkip) {
                $this->markTestSkipped($_reason ?? "skipped via sdk-test-control.json");
                return;
            }
        }
        // The basic flow consumes synthetic IDs from the fixture. In live mode
        // without an *_ENTID env override, those IDs hit the live API and 4xx.
        if (!empty($setup["synthetic_only"])) {
            $this->markTestSkipped("live entity test uses synthetic IDs from fixture — set ${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID JSON to run live");
            return;
        }
        $client = $setup["client"];

`)

    // Check if the flow has a create step
    const flowHasCreate = allSteps.some((s: any) => s.op === 'create')
    if (!flowHasCreate) {
      Content(`        // Bootstrap entity data from existing test data.
        $${entity.name}_ref01_data_raw = Vs::items(Helpers::to_map(
            Vs::getpath($setup["data"], "existing.${entity.name}")));
        $${entity.name}_ref01_data = null;
        if (count($${entity.name}_ref01_data_raw) > 0) {
            $${entity.name}_ref01_data = Helpers::to_map($${entity.name}_ref01_data_raw[0][1]);
        }

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

    Content(`    }
}

`)

    // Generate setup function
    Content(`function ${entity.name}_basic_setup($extra)
{
    Runner::load_env_local();

    $entity_data_file = __DIR__ . '/../../.sdk/test/entity/${entity.name}/${entity.Name}TestData.json';
    $entity_data_source = file_get_contents($entity_data_file);
    $entity_data = json_decode($entity_data_source, true);

    $options = [];
    $options["entity"] = $entity_data["existing"];

    $client = ${model.const.Name}SDK::test($options, $extra);

`)

    // Generate idmap: key => UPPER(key)
    Content(`    // Generate idmap.
    $idmap = [];
    foreach ([${idnamesStr}] as $k) {
        $idmap[$k] = strtoupper($k);
    }

`)

    Content(`    // Detect ENTID env override before envOverride consumes it. When live
    // mode is on without a real override, the basic test runs against synthetic
    // IDs from the fixture and 4xx's. Surface this so the test can skip.
    $entid_env_raw = getenv("${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID");
    $idmap_overridden = $entid_env_raw !== false && str_starts_with(trim($entid_env_raw), "{");

    $env = Runner::env_override([
        "${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID" => $idmap,
        "${PROJUPPER}_TEST_LIVE" => "FALSE",
        "${PROJUPPER}_TEST_EXPLAIN" => "FALSE",${apikeyEnvEntry}
    ]);

    $idmap_resolved = Helpers::to_map(
        $env["${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID"]);
    if ($idmap_resolved === null) {
        $idmap_resolved = Helpers::to_map($idmap);
    }
`)

    // Add aliases
    for (const [key, val] of aliases) {
      Content(`    if (!isset($idmap_resolved["${key}"])) {
        $idmap_resolved["${key}"] = $idmap_resolved["${val}"];
    }
`)
    }

    Content(`
    if ($env["${PROJUPPER}_TEST_LIVE"] === "TRUE") {
        $merged_opts = Vs::merge([
            [${apikeyLiveField}
            ],
            $extra ?? [],
        ]);
        $client = new ${model.const.Name}SDK(Helpers::to_map($merged_opts));
    }

    $live = $env["${PROJUPPER}_TEST_LIVE"] === "TRUE";
    return [
        "client" => $client,
        "data" => $entity_data,
        "idmap" => $idmap_resolved,
        "env" => $env,
        "explain" => $env["${PROJUPPER}_TEST_EXPLAIN"] === "TRUE",
        "live" => $live,
        "synthetic_only" => $live && !$idmap_overridden,
        "now" => (int)(microtime(true) * 1000),
    ];
}
`)
  })
})


const generateCreate: OpGen = (ctx, step, index) => {
  const { entity, flow, accessor } = ctx
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

  Content(`        // CREATE
`)
  if (needsEnt) {
    Content(`        $${entvar} = $client->${accessor}(null);
`)
  }

  if (hasDatvar) {
    Content(`        $${datavar} = Helpers::to_map(Vs::getprop(
            Vs::getpath($setup["data"], "new.${entity.name}"), "${ref}"));
`)
  } else {
    Content(`        $${datavar} = Helpers::to_map(Vs::getprop(
            Vs::getpath($setup["data"], "new.${entity.name}"), "${ref}"));
`)
  }

  const matchEntries = getMatchEntries(step)
  for (const [key, val] of matchEntries) {
    Content(`        $${datavar}["${key}"] = $setup["idmap"]["${val}"];
`)
  }

  Content(`
        [$${datavar}_result, $err] = $${entvar}->create($${datavar}, null);
        $this->assertNull($err);
        $${datavar} = Helpers::to_map($${datavar}_result);
        $this->assertNotNull($${datavar});
`)
  if (null != ctx.entity.id) {
    Content(`        $this->assertNotNull($${datavar}["id"]);
`)
  }
}


const generateList: OpGen = (ctx, step, index) => {
  const { entity, flow, accessor } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const listvar = step.input.listvar ?? (ref + '_list' + (step.input.suffix ?? ''))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`        // LIST
`)
  if (needsEnt) {
    Content(`        $${entvar} = $client->${accessor}(null);
`)
  }

  const matchEntries = getMatchEntries(step)
  if (matchEntries.length === 0) {
    Content(`        $${matchvar} = [];
`)
  } else {
    Content(`        $${matchvar} = [
`)
    for (const [key, val] of matchEntries) {
      Content(`            "${key}" => $setup["idmap"]["${val}"],
`)
    }
    Content(`        ];
`)
  }

  Content(`
        [$${listvar}_result, $err] = $${entvar}->list($${matchvar}, null);
        $this->assertNull($err);
        $this->assertIsArray($${listvar}_result);
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
        $found_item = sdk_select(
            Runner::entity_list_to_data($${listvar}_result),
            ["id" => $${refDataVar}["id"]]);
        $this->assertNotEmpty($found_item);
`)
      } else if ('ItemNotExists' === validator.apply && hasRefData) {
        const refDataVar = validRef + '_data'
        Content(`
        $not_found_item = sdk_select(
            Runner::entity_list_to_data($${listvar}_result),
            ["id" => $${refDataVar}["id"]]);
        $this->assertEmpty($not_found_item);
`)
      }
    }
  }
}


const generateUpdate: OpGen = (ctx, step, index) => {
  const { entity, flow, accessor } = ctx
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

  Content(`        // UPDATE
`)
  if (needsEnt) {
    Content(`        $${entvar} = $client->${accessor}(null);
`)
  }
  Content(`        $${datavar}_up = [
`)
  if (hasEntIdU) {
    Content(`            "id" => $${srcdatavar}["id"],
`)
  }

  if (step.data) {
    const dataEntries = Object.entries(step.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    for (const [key] of dataEntries) {
      Content(`            "${key}" => $setup["idmap"]["${key}"],
`)
    }
  }

  Content(`        ];
`)

  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        const fieldname = step.input.textfield
        const fieldvalue = spec.def?.mark ?? `Mark01-${ref}`
        Content(`
        $${markdefvar}_name = "${fieldname}";
        $${markdefvar}_value = "${fieldvalue}_" . $setup["now"];
        $${datavar}_up[$${markdefvar}_name] = $${markdefvar}_value;
`)
      }
    }
  }

  Content(`
        [$${resdatavar}_result, $err] = $${entvar}->update($${datavar}_up, null);
        $this->assertNull($err);
        $${resdatavar} = Helpers::to_map($${resdatavar}_result);
        $this->assertNotNull($${resdatavar});
`)
  if (hasEntIdU) {
    Content(`        $this->assertEquals($${resdatavar}["id"], $${datavar}_up["id"]);
`)
  }

  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        Content(`        $this->assertEquals($${resdatavar}[$${markdefvar}_name], $${markdefvar}_value);
`)
      }
    }
  }
}


const generateLoad: OpGen = (ctx, step, index) => {
  const { entity, flow, accessor } = ctx
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

  Content(`        // LOAD
`)
  if (!hasEntVar) {
    Content(`        $${entvar} = $client->${accessor}(null);
`)
  }
  if (!hasSrcData && hasEntId) {
    Content(`        $${srcdatavar}_raw = Vs::items(Helpers::to_map(
            Vs::getpath($setup["data"], "existing.${entity.name}")));
        $${srcdatavar} = null;
        if (count($${srcdatavar}_raw) > 0) {
            $${srcdatavar} = Helpers::to_map($${srcdatavar}_raw[0][1]);
        }
`)
  }
  if (hasEntId) {
    Content(`        $${matchvar} = [
            "id" => $${srcdatavar}["id"],
        ];
        [$${datavar}_loaded, $err] = $${entvar}->load($${matchvar}, null);
        $this->assertNull($err);
        $${datavar}_load_result = Helpers::to_map($${datavar}_loaded);
        $this->assertNotNull($${datavar}_load_result);
        $this->assertEquals($${datavar}_load_result["id"], $${srcdatavar}["id"]);
`)
  }
  else {
    Content(`        $${matchvar} = [];
        [$${datavar}_loaded, $err] = $${entvar}->load($${matchvar}, null);
        $this->assertNull($err);
        $this->assertNotNull($${datavar}_loaded);
`)
  }
}


const generateRemove: OpGen = (ctx, step, index) => {
  const { entity, flow, accessor } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = step.input.entvar ?? ref + '_ent'
  const matchvar = step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? ''))
  const srcdatavar = step.input.srcdatavar ?? (ref + '_data')

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`        // REMOVE
`)
  if (needsEnt) {
    Content(`        $${entvar} = $client->${accessor}(null);
`)
  }
  // Always match the prior-created entity by id to avoid mock-order flakes.
  Content(`        $${matchvar} = [
            "id" => $${srcdatavar}["id"],
        ];
        [$_, $err] = $${entvar}->remove($${matchvar}, null);
        $this->assertNull($err);
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
