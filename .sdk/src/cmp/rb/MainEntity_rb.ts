

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
  # Idiomatic facade: client.${entity.name}.list / client.${entity.name}.load({ "id" => ... })
  def ${entity.name}
    require_relative 'entity/${entity.name}_entity'
    @${entity.name} ||= ${entity.Name}Entity.new(self, nil)
  end

  # Deprecated: use client.${entity.name} instead.
  def ${entity.Name}(data = nil)
    require_relative 'entity/${entity.name}_entity'
    ${entity.Name}Entity.new(self, data)
  end

`)

})


export {
  MainEntity
}
