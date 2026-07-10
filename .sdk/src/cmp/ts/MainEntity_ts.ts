

import { cmp, Content, entityClassName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  // Return the collision-free class TYPE (entityClassName); the accessor METHOD
  // name (entity.Name) is unchanged so callers still write client.<Name>().
  const cls = entityClassName(entity, getModelPath(model, `main.${KIT}.entity`))

  Content(`
  // Entity access: \`client.${entity.Name}().list()\` / \`client.${entity.Name}().load({ id })\`.
  ${entity.Name}(data?: any) {
    const self = this
    return new ${cls}(self,data)
  }

`)

})


export {
  MainEntity
}
