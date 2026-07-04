

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
-- Idiomatic facade: client:${entity.name}():list() / client:${entity.name}():load({ id = ... })
function ${model.const.Name}SDK:${entity.name}(data)
  local EntityMod = require("entity.${entity.name}_entity")
  if data == nil then
    if self._${entity.name} == nil then
      self._${entity.name} = EntityMod.new(self, nil)
    end
    return self._${entity.name}
  end
  return EntityMod.new(self, data)
end

-- Deprecated: use client:${entity.name}() instead.
function ${model.const.Name}SDK:${entity.Name}(data)
  local EntityMod = require("entity.${entity.name}_entity")
  return EntityMod.new(self, data)
end

`)

})


export {
  MainEntity
}
