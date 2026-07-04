

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  Content(`
    @property
    def ${entity.name}(self):
        """Idiomatic facade: client.${entity.name}.list() / client.${entity.name}.load({"id": ...})."""
        from entity.${entity.name}_entity import ${entity.Name}Entity
        cached = getattr(self, "_${entity.name}", None)
        if cached is None:
            cached = ${entity.Name}Entity(self, None)
            self._${entity.name} = cached
        return cached

    def ${entity.Name}(self, data=None):
        # Deprecated: use client.${entity.name} instead.
        from entity.${entity.name}_entity import ${entity.Name}Entity
        return ${entity.Name}Entity(self, data)

`)

})


export {
  MainEntity
}
