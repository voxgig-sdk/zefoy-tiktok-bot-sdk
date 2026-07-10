

import { cmp, Content, entityClassName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  // Return the collision-free class (entityClassName); the accessor METHOD name
  // (entity.Name) is unchanged so callers still write client.<Name>.
  const cls = entityClassName(entity, getModelPath(model, `main.${KIT}.entity`))

  Content(`
  # Canonical facade: client.${entity.Name}.list / client.${entity.Name}.load({ "id" => ... })
  def ${entity.Name}(data = nil)
    require_relative 'entity/${entity.name}_entity'
    ${cls}.new(self, data)
  end

`)

})


export {
  MainEntity
}
