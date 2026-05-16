

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
    def ${entity.Name}(self, data=None):
        from entity.${entity.name}_entity import ${entity.Name}Entity
        return ${entity.Name}Entity(self, data)

`)

})


export {
  MainEntity
}
