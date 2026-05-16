

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
function ${model.const.Name}SDK:${entity.Name}(data)
  local EntityMod = require("entity.${entity.name}_entity")
  return EntityMod.new(self, data)
end

`)

})


export {
  MainEntity
}
