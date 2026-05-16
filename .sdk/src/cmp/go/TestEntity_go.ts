
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


// Convert snake_case to camelCase for Go variable names.
function goVar(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_: any, c: string) => c.toUpperCase())
}


// Go's GenCtx mirrors the shared shape (see TestEntity_ts.ts) plus a
// `gomodule` slot used to build qualified package paths in emitted code.
type GenCtx = {
  model: Model
  entity: ModelEntity
  gomodule: string
  flow: ModelEntityFlow
  PROJUPPER: string
}

type OpGen = (ctx: GenCtx, step: ModelEntityFlowStep, index: number) => void


const TestEntity = cmp(function TestEntity(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model

  const target = props.target
  const entity: ModelEntity = props.entity
  const gomodule: string = props.gomodule

  const basicflow: ModelEntityFlow | undefined =
    getModelPath(model, `main.${KIT}.flow.Basic${nom(entity, 'Name')}Flow`)
  if (null == basicflow || true !== basicflow.active) {
    return
  }

  const PROJUPPER = nom(model.const, 'Name').toUpperCase().replace(/[^A-Z_]/g, '_')

  const authActive = isAuthActive(model)
  const apikeyEnvEntry = authActive
    ? `\n\t\t"${PROJUPPER}_APIKEY":         "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n\t\t\t\t"apikey": env["${PROJUPPER}_APIKEY"],`
    : ''

  const idnames = buildIdNames(entity, basicflow)
  const idnamesStr = idnames.map(n => `"${n}"`).join(', ')

  // Get all update data entries for alias generation
  const allSteps = Object.values(basicflow.step) as any[]
  const updateStep = allSteps.find((s: any) => s.op === 'update')
  const updateData = updateStep?.data
    ? Object.entries(updateStep.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    : []
  const aliases = updateData.map(([k, v]: any) => [k, v])

  const genCtx: GenCtx = { model, entity, gomodule, flow: basicflow, PROJUPPER }

  // fmt is only used by the TextFieldMark Update branch — omit the import
  // when no step needs it, otherwise Go's strict unused-import check fails.
  const needsFmt = allSteps.some((s: any) =>
    s.op === 'update' &&
    s.input.textfield &&
    Array.isArray(s.spec) &&
    s.spec.some((sp: any) => sp.apply === 'TextFieldMark'))

  File({ name: entity.name + '_entity_test.' + target.ext }, () => {

    Content(`package sdktest

import (
	"encoding/json"${needsFmt ? '\n\t"fmt"' : ''}
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	sdk "${gomodule}"
	"${gomodule}/core"

	vs "github.com/voxgig/struct"
)

func Test${entity.Name}Entity(t *testing.T) {
	t.Run("instance", func(t *testing.T) {
		testsdk := sdk.TestSDK(nil, nil)
		ent := testsdk.${entity.Name}(nil)
		if ent == nil {
			t.Fatal("expected non-nil ${entity.Name}Entity")
		}
	})

	t.Run("basic", func(t *testing.T) {
		setup := ${entity.name}BasicSetup(nil)
		// Per-op sdk-test-control.json skip — basic test exercises a flow
		// with multiple ops; skipping any op skips the whole flow.
		_mode := "unit"
		if setup.live {
			_mode = "live"
		}
		for _, _op := range []string{${(Array.from(new Set((allSteps as any[]).map((s: any) => s.op).filter(Boolean)))).map(o => `"${o}"`).join(', ')}} {
			if _shouldSkip, _reason := isControlSkipped("entityOp", "${entity.name}." + _op, _mode); _shouldSkip {
				if _reason == "" {
					_reason = "skipped via sdk-test-control.json"
				}
				t.Skip(_reason)
				return
			}
		}
		// The basic flow consumes synthetic IDs from the fixture. In live mode
		// without an *_ENTID env override, those IDs hit the live API and 4xx.
		if setup.syntheticOnly {
			t.Skip("live entity test uses synthetic IDs from fixture — set ${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID JSON to run live")
			return
		}
${allSteps.length > 0 ? '\t\tclient := setup.client\n\n' : ''}`)

    // Check if the flow has a create step; if not, bootstrap entity data
    const flowHasCreate = allSteps.some((s: any) => s.op === 'create')
    if (!flowHasCreate) {
      const preambleRef = entity.name + '_ref01'
      const preambleVar = goVar(preambleRef)
      Content(`		// Bootstrap entity data from existing test data (no create step in flow).
		${preambleVar}DataRaw := vs.Items(core.ToMapAny(vs.GetPath("existing.${entity.name}", setup.data)))
		var ${preambleVar}Data map[string]any
		if len(${preambleVar}DataRaw) > 0 {
			${preambleVar}Data = core.ToMapAny(${preambleVar}DataRaw[0][1])
		}
		// Discard guards against Go's unused-var check when the flow's steps
		// happen not to consume the bootstrap data (e.g. list-only flows).
		_ = ${preambleVar}Data

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

    Content(`	})
}

`)

    // Generate setup function
    Content(`func ${entity.name}BasicSetup(extra map[string]any) *entityTestSetup {
	loadEnvLocal()

	_, filename, _, _ := runtime.Caller(0)
	dir := filepath.Dir(filename)

	entityDataFile := filepath.Join(dir, "..", "..", ".sdk", "test", "entity", "${entity.name}", "${entity.Name}TestData.json")

	entityDataSource, err := os.ReadFile(entityDataFile)
	if err != nil {
		panic("failed to read ${entity.name} test data: " + err.Error())
	}

	var entityData map[string]any
	if err := json.Unmarshal(entityDataSource, &entityData); err != nil {
		panic("failed to parse ${entity.name} test data: " + err.Error())
	}

	options := map[string]any{}
	options["entity"] = entityData["existing"]

	client := sdk.TestSDK(options, extra)

`)

    // Generate idmap via vs.Transform
    Content('\t// Generate idmap via transform, matching TS pattern.\n')
    Content('\tidmap := vs.Transform(\n')
    Content('\t\t[]any{' + idnamesStr + '},\n')
    Content('\t\tmap[string]any{\n')
    Content('\t\t\t"`$PACK`": []any{"", map[string]any{\n')
    Content('\t\t\t\t"`$KEY`": "`$COPY`",\n')
    Content('\t\t\t\t"`$VAL`": []any{"`$FORMAT`", "upper", "`$COPY`"},\n')
    Content('\t\t\t}},\n')
    Content('\t\t},\n')
    Content('\t)\n')

    Content(`
	// Detect ENTID env override before envOverride consumes it. When live
	// mode is on without a real override, the basic test runs against synthetic
	// IDs from the fixture and 4xx's. Surface this so the test can skip.
	entidEnvRaw := os.Getenv("${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID")
	idmapOverridden := entidEnvRaw != "" && strings.HasPrefix(strings.TrimSpace(entidEnvRaw), "{")

	env := envOverride(map[string]any{
		"${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID": idmap,
		"${PROJUPPER}_TEST_LIVE":      "FALSE",
		"${PROJUPPER}_TEST_EXPLAIN":   "FALSE",${apikeyEnvEntry}
	})

	idmapResolved := core.ToMapAny(env["${PROJUPPER}_TEST_${entity.name.toUpperCase().replace(/[^A-Z_]/g, '_')}_ENTID"])
	if idmapResolved == nil {
		idmapResolved = core.ToMapAny(idmap)
	}
`)

    // Add aliases for ancestor field names
    for (const [key, val] of aliases) {
      Content(`	// Add ${key} alias for update test.
	if idmapResolved["${key}"] == nil {
		idmapResolved["${key}"] = idmapResolved["${val}"]
	}
`)
    }

    Content(`
	if env["${PROJUPPER}_TEST_LIVE"] == "TRUE" {
		mergedOpts := vs.Merge([]any{
			map[string]any{${apikeyLiveField}
			},
			extra,
		})
		client = sdk.New${model.const.Name}SDK(core.ToMapAny(mergedOpts))
	}

	live := env["${PROJUPPER}_TEST_LIVE"] == "TRUE"
	return &entityTestSetup{
		client:        client,
		data:          entityData,
		idmap:         idmapResolved,
		env:           env,
		explain:       env["${PROJUPPER}_TEST_EXPLAIN"] == "TRUE",
		live:          live,
		syntheticOnly: live && !idmapOverridden,
		now:           time.Now().UnixMilli(),
	}
}
`)
  })
})


const generateCreate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input.entvar ?? ref + '_ent')
  const datavar = goVar(step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? '')))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const hasDatvar = priorSteps.some((s: any) => {
    if ('create' === s.op) {
      const priorRef = s.input.ref ?? entity.name + '_ref01'
      const priorDatvar = goVar(s.input.datavar ?? (priorRef + '_data' + (s.input.suffix ?? '')))
      return priorDatvar === datavar
    }
    return false
  })

  Content(`		// CREATE
`)
  if (needsEnt) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }

  // Load data from test data file
  if (hasDatvar) {
    Content(`		${datavar} = core.ToMapAny(vs.GetProp(
			vs.GetPath([]any{"new", "${entity.name}"}, setup.data), "${ref}"))
`)
  } else {
    Content(`		${datavar} := core.ToMapAny(vs.GetProp(
			vs.GetPath([]any{"new", "${entity.name}"}, setup.data), "${ref}"))
`)
  }

  // Add match entries
  const matchEntries = getMatchEntries(step)
  for (const [key, val] of matchEntries) {
    Content(`		${datavar}["${key}"] = setup.idmap["${val}"]
`)
  }

  Content(`
		${datavar}Result, err := ${entvar}.Create(${datavar}, nil)
		if err != nil {
			t.Fatalf("create failed: %v", err)
		}
		${datavar} = core.ToMapAny(${datavar}Result)
		if ${datavar} == nil {
			t.Fatal("expected create result to be a map")
		}
`)
  if (null != ctx.entity.id) {
    Content(`		if ${datavar}["id"] == nil {
			t.Fatal("expected created entity to have an id")
		}
`)
  }
}


const generateList: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input.entvar ?? ref + '_ent')
  const matchvar = goVar(step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? '')))
  const listvar = goVar(step.input.listvar ?? (ref + '_list' + (step.input.suffix ?? '')))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  Content(`		// LIST
`)
  if (needsEnt) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }

  // Generate match map
  const matchEntries = getMatchEntries(step)
  if (matchEntries.length === 0) {
    Content(`		${matchvar} := map[string]any{}
`)
  } else {
    Content(`		${matchvar} := map[string]any{
`)
    for (const [key, val] of matchEntries) {
      Content(`			"${key}": setup.idmap["${val}"],
`)
    }
    Content(`		}
`)
  }

  // Only declare ${listvar} as a real var when a downstream validator
  // actually uses it; otherwise `_` to satisfy Go's unused-var check.
  const allSteps = Object.values(flow.step) as any[]
  const listvarUsed = !!step.valid?.some((v: any) => {
    if ('ItemExists' !== v.apply && 'ItemNotExists' !== v.apply) return false
    const validRef = v.def?.ref
    return validRef && allSteps.some((s: any) => 'create' === s.op &&
      ((s.input.ref ?? entity.name + '_ref01') === validRef))
  })
  const listvarBind = listvarUsed ? listvar : '_'

  // Use a list-step-unique `ok` name; if a prior list emitted plain `ok`,
  // a second `_, ok :=` would be "no new variables on left side of :=".
  const okvar = listvar + 'Ok'
  Content(`
		${listvar}Result, err := ${entvar}.List(${matchvar}, nil)
		if err != nil {
			t.Fatalf("list failed: %v", err)
		}
		${listvarBind}, ${okvar} := ${listvar}Result.([]any)
		if !${okvar} {
			t.Fatalf("expected list result to be an array, got %T", ${listvar}Result)
		}
`)

  // Handle validators from step.valid
  if (step.valid) {
    for (const validator of step.valid) {
      const validRef = validator.def?.ref
      const hasRefData = validRef && allSteps.some((s: any) => 'create' === s.op &&
        ((s.input.ref ?? entity.name + '_ref01') === validRef))

      if ('ItemExists' === validator.apply && hasRefData) {
        const refDataVar = goVar(validRef + '_data')
        Content(`
		foundItem := vs.Select(entityListToData(${listvar}), map[string]any{"id": ${refDataVar}["id"]})
		if vs.IsEmpty(foundItem) {
			t.Fatal("expected to find created entity in list")
		}
`)
      } else if ('ItemNotExists' === validator.apply && hasRefData) {
        const refDataVar = goVar(validRef + '_data')
        Content(`
		notFoundItem := vs.Select(entityListToData(${listvar}), map[string]any{"id": ${refDataVar}["id"]})
		if !vs.IsEmpty(notFoundItem) {
			t.Fatal("expected removed entity to not be in list")
		}
`)
      }
    }
  }
}


const generateUpdate: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input.entvar ?? ref + '_ent')
  const datavar = goVar(step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? '')))
  const resdatavar = goVar(step.input.resdatavar ?? (ref + '_resdata' + (step.input.suffix ?? '')))
  const markdefvar = goVar(step.input.markdefvar ?? (ref + '_markdef' + (step.input.suffix ?? '')))
  const srcdatavar = goVar(step.input.srcdatavar ?? (ref + '_data' + (step.input.suffix ?? '')))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  const hasEntIdU = null != entity.id

  Content(`		// UPDATE
`)
  if (needsEnt) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }
  Content(`		${datavar}Up := map[string]any{
`)
  if (hasEntIdU) {
    Content(`			"id": ${srcdatavar}["id"],
`)
  }

  // Add data entries from step.data
  if (step.data) {
    const dataEntries = Object.entries(step.data).filter(([k]: any) => k !== 'id' && !k.endsWith('$'))
    for (const [key] of dataEntries) {
      Content(`			"${key}": setup.idmap["${key}"],
`)
    }
  }

  Content(`		}
`)

  // Handle TextFieldMark spec
  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        const fieldname = step.input.textfield
        const fieldvalue = spec.def?.mark ?? `Mark01-${ref}`
        Content(`
		${markdefvar}Name := "${fieldname}"
		${markdefvar}Value := fmt.Sprintf("${fieldvalue}_%d", setup.now)
		${datavar}Up[${markdefvar}Name] = ${markdefvar}Value
`)
      }
    }
  }

  Content(`
		${resdatavar}Result, err := ${entvar}.Update(${datavar}Up, nil)
		if err != nil {
			t.Fatalf("update failed: %v", err)
		}
		${resdatavar} := core.ToMapAny(${resdatavar}Result)
		if ${resdatavar} == nil {
			t.Fatal("expected update result to be a map")
		}
`)
  if (hasEntIdU) {
    Content(`		if ${resdatavar}["id"] != ${datavar}Up["id"] {
			t.Fatal("expected update result id to match")
		}
`)
  }

  // Assert TextFieldMark
  if (step.spec) {
    for (const spec of step.spec) {
      if ('TextFieldMark' === spec.apply && null != step.input.textfield) {
        Content(`		if ${resdatavar}[${markdefvar}Name] != ${markdefvar}Value {
			t.Fatalf("expected %s to be updated, got %v", ${markdefvar}Name, ${resdatavar}[${markdefvar}Name])
		}
`)
      }
    }
  }
}


const generateLoad: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input.entvar ?? ref + '_ent')
  const matchvar = goVar(step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? '')))
  const datavar = goVar(step.input.datavar ?? (ref + '_data' + (step.input.suffix ?? '')))
  const srcdatavar = goVar(step.input.srcdatavar ?? (ref + '_data' + (step.input.suffix ?? '')))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const hasEntVar = priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  // Check if srcdatavar was declared by a prior create step or preamble
  const flowHasCreate = Object.values(flow.step).some((s: any) => (s as any).op === 'create')
  const preambleRef = entity.name + '_ref01'
  const hasSrcData = (!flowHasCreate && srcdatavar === goVar(preambleRef + '_data')) ||
    priorSteps.some((s: any) => {
      if ('create' === s.op) {
        const priorRef = s.input.ref ?? entity.name + '_ref01'
        const priorDatvar = goVar(s.input.datavar ?? (priorRef + '_data' + (s.input.suffix ?? '')))
        return priorDatvar === srcdatavar
      }
      return false
    })

  const hasEntId = null != entity.id

  Content(`		// LOAD
`)
  if (!hasEntVar) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }
  if (!hasSrcData && hasEntId) {
    Content(`		${srcdatavar}Raw := vs.Items(core.ToMapAny(vs.GetPath("existing.${entity.name}", setup.data)))
		var ${srcdatavar} map[string]any
		if len(${srcdatavar}Raw) > 0 {
			${srcdatavar} = core.ToMapAny(${srcdatavar}Raw[0][1])
		}
`)
  }
  if (hasEntId) {
    Content(`		${matchvar} := map[string]any{
			"id": ${srcdatavar}["id"],
		}
		${datavar}Loaded, err := ${entvar}.Load(${matchvar}, nil)
		if err != nil {
			t.Fatalf("load failed: %v", err)
		}
		${datavar}LoadResult := core.ToMapAny(${datavar}Loaded)
		if ${datavar}LoadResult == nil {
			t.Fatal("expected load result to be a map")
		}
		if ${datavar}LoadResult["id"] != ${srcdatavar}["id"] {
			t.Fatal("expected load result id to match")
		}
`)
  }
  else {
    Content(`		${matchvar} := map[string]any{}
		${datavar}Loaded, err := ${entvar}.Load(${matchvar}, nil)
		if err != nil {
			t.Fatalf("load failed: %v", err)
		}
		if ${datavar}Loaded == nil {
			t.Fatal("expected load result to be non-nil")
		}
`)
  }
}


const generateRemove: OpGen = (ctx, step, index) => {
  const { entity, flow } = ctx
  const ref = step.input.ref ?? entity.name + '_ref01'
  const entvar = goVar(step.input.entvar ?? ref + '_ent')
  const matchvar = goVar(step.input.matchvar ?? (ref + '_match' + (step.input.suffix ?? '')))
  const srcdatavar = goVar(step.input.srcdatavar ?? (ref + '_data'))

  const priorSteps = Object.values(flow.step).slice(0, Number(index)) as any[]
  const needsEnt = !priorSteps.some((s: any) =>
    ['create', 'list', 'load', 'update', 'remove'].includes(s.op))

  // Use `:=` when this is the first op step (so `err` gets declared);
  // otherwise reuse the `err` from a prior op step.
  const errOp = needsEnt ? ':=' : '='

  Content(`		// REMOVE
`)
  if (needsEnt) {
    Content(`		${entvar} := client.${entity.Name}(nil)
`)
  }
  // Always match the prior-created entity by id to avoid mock-order flakes.
  Content(`		${matchvar} := map[string]any{
			"id": ${srcdatavar}["id"],
		}
		_, err ${errOp} ${entvar}.Remove(${matchvar}, nil)
		if err != nil {
			t.Fatalf("remove failed: %v", err)
		}
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
