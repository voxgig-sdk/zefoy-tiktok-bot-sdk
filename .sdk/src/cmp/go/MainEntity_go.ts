

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity, gomodule } = props
  const { model } = props.ctx$

  Content(`
func (sdk *${model.const.Name}SDK) ${entity.Name}(data map[string]any) ${model.const.Name}Entity {
	return New${entity.Name}EntityFunc(sdk, data)
}

`)

})


export {
  MainEntity
}
