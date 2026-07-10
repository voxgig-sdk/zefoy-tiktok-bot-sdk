

import { cmp, Content, entityClassName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


// Reserved PHP method names on the SDK class that an entity accessor must
// not collide with. PHP method names are case-insensitive at declaration
// time, so an entity literally named 'test' would collide with the static
// `test()` test-mode constructor. Mangle to `<Name>_` in that case.
const PHP_RESERVED_LOWER = new Set(['test'])

const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  // Collision-free entity CLASS name (entityClassName); the accessor METHOD name
  // (below) is unchanged so callers still write $client->${entity.Name}().
  const cls = entityClassName(entity, getModelPath(model, `main.${KIT}.entity`))

  // Canonical facade method name is the PascalCase entity Name
  // (`$client->${entity.Name}()`). PHP method names are case-insensitive, so
  // the lowercase spelling `$client->${entity.name}()` still resolves here as
  // a convenience — we declare it ONCE under the PascalCase name. An entity
  // literally named 'test' would collide (case-insensitively) with the static
  // `test()` test-mode constructor, so mangle to `<Name>_` in that case.
  const accessor = PHP_RESERVED_LOWER.has(entity.name.toLowerCase())
    ? entity.Name + '_'
    : entity.Name

  Content(`
    private $_${entity.name} = null;

    // Canonical facade: $client->${accessor}()->list() / ->load(["id" => ...]).
    // PHP method names are case-insensitive, so lowercase $client->${entity.name}()
    // resolves here too.
    public function ${accessor}($data = null)
    {
        require_once __DIR__ . '/entity/${entity.name}_entity.php';
        if ($data === null) {
            if ($this->_${entity.name} === null) {
                $this->_${entity.name} = new ${cls}($this, null);
            }
            return $this->_${entity.name};
        }
        return new ${cls}($this, $data);
    }

`)

})


export {
  MainEntity
}
