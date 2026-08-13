

import { cmp, Content, entityCacheField } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$
  // The cache slot must not alias one of the SDK's own fields: an entity
  // named `utility` made client:Utility() hand back self._utility, the SDK's
  // internal utility object, whose :load() is nil.
  const field = entityCacheField(entity.name)


  Content(`
-- Idiomatic facade: client:${entity.Name}():list() / client:${entity.Name}():load({ id = ... })
-- Entity access is capitalised (PascalCase) for parity with the other SDKs.
function ${model.const.Name}SDK:${entity.Name}(data)
  local EntityMod = require("entity.${entity.name}_entity")
  if data == nil then
    if self._${field} == nil then
      self._${field} = EntityMod.new(self, nil)
    end
    return self._${field}
  end
  return EntityMod.new(self, data)
end

`)

})


export {
  MainEntity
}
