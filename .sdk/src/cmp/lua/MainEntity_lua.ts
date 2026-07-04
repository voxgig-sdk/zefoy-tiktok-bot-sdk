

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
-- Idiomatic facade: client:${entity.Name}():list() / client:${entity.Name}():load({ id = ... })
-- Entity access is capitalised (PascalCase) for parity with the other SDKs.
function ${model.const.Name}SDK:${entity.Name}(data)
  local EntityMod = require("entity.${entity.name}_entity")
  if data == nil then
    if self._${entity.name} == nil then
      self._${entity.name} = EntityMod.new(self, nil)
    end
    return self._${entity.name}
  end
  return EntityMod.new(self, data)
end

`)

})


export {
  MainEntity
}
