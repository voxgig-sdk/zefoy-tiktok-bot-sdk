

import { cmp, Content, entityClassName, entityCollection } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  // Return the collision-free class (entityClassName); the accessor METHOD name
  // (entity.Name) is unchanged so callers still write client.<Name>(). The
  // source module is snake-cased, so only the imported class identifier changes.
  const cls = entityClassName(entity, entityCollection(model))

  Content(`
    def ${entity.Name}(self, data=None) -> "${cls}":
        """Entity factory: client.${entity.Name}().list() / client.${entity.Name}().load({"id": ...})."""
        from ${model.const.Name.toLowerCase()}_sdk.entity.${entity.name}_entity import ${cls}
        return ${cls}(self, data)

`)

})


export {
  MainEntity
}
