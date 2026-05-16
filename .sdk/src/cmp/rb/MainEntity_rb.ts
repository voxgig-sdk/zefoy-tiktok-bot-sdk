

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
  def ${entity.Name}(data = nil)
    require_relative 'entity/${entity.name}_entity'
    ${entity.Name}Entity.new(self, data)
  end

`)

})


export {
  MainEntity
}
