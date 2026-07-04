

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity, gomodule } = props
  const { model } = props.ctx$

  // Go keeps the PascalCase accessor: exported identifiers must be PascalCase,
  // so a lowercase facade is not idiomatic (nor exportable) in Go.
  // Idiomatic usage: client.${entity.Name}(nil).List(nil, nil) / .Load(...).
  Content(`
// ${entity.Name} returns a ${entity.Name} entity bound to this client.
// Idiomatic usage: client.${entity.Name}(nil).List(nil, nil) or
// client.${entity.Name}(nil).Load(map[string]any{"id": ...}, nil).
func (sdk *${model.const.Name}SDK) ${entity.Name}(data map[string]any) ${model.const.Name}Entity {
	return New${entity.Name}EntityFunc(sdk, data)
}

`)

})


export {
  MainEntity
}
