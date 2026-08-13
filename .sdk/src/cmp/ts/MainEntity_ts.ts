

import { cmp, Content, entityClassName, entityCollection } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  // Return the collision-free class TYPE (entityClassName); the accessor METHOD
  // name (entity.Name) is unchanged so callers still write client.<Name>().
  const cls = entityClassName(entity, entityCollection(model))

  Content(`
  // Entity access: \`client.${entity.Name}().list()\` / \`client.${entity.Name}().load({ id })\`.
  // The argument is the entity OPTIONS object (passed to the entity
  // constructor as entopts), not initial entity data.
  ${entity.Name}(entopts?: Record<string, any>) {
    const self = this
    return new ${cls}(self, entopts)
  }

`)

})


export {
  MainEntity
}
