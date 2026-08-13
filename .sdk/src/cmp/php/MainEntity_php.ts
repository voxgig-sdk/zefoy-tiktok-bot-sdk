

import {
  cmp, Content, entityClassName, entityCollection,
  phpEntityAccessor, entityCacheField,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  // Collision-free entity CLASS name (entityClassName); the accessor METHOD name
  // (below) is unchanged so callers still write $client->${entity.Name}().
  const cls = entityClassName(entity, entityCollection(model))

  // Canonical facade method name is the PascalCase entity Name
  // (`$client->${entity.Name}()`). PHP method names are case-insensitive, so
  // the lowercase spelling `$client->${entity.name}()` still resolves here as
  // a convenience — we declare it ONCE under the PascalCase name. An entity
  // literally named 'test' would collide (case-insensitively) with the static
  // `test()` test-mode constructor, so mangle to `<Name>_` in that case.
  const accessor = phpEntityAccessor(entity.Name)

  // The backing field is mangled independently of the accessor: the two are
  // compared against different member sets, and an entity can collide with
  // one without colliding with the other.
  const field = entityCacheField(entity.name)

  Content(`
    private $_${field} = null;

    // Canonical facade: $client->${accessor}()->list() / ->load(["id" => ...]).${
      accessor === entity.Name
        ? `
    // PHP method names are case-insensitive, so lowercase $client->${entity.name}()
    // resolves here too.`
        : `
    // Renamed from ${entity.Name}: that name is already taken by an SDK class
    // member, and a duplicate declaration is a fatal PHP parse error.`}
    public function ${accessor}($data = null)
    {
        require_once __DIR__ . '/entity/${entity.name}_entity.php';
        if ($data === null) {
            if ($this->_${field} === null) {
                $this->_${field} = new ${cls}($this, null);
            }
            return $this->_${field};
        }
        return new ${cls}($this, $data);
    }

`)

})


export {
  MainEntity
}
