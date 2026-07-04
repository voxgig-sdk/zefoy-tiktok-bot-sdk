

import { cmp, Content } from '@voxgig/sdkgen'


// Reserved PHP method names on the SDK class that an entity accessor must
// not collide with. PHP method names are case-insensitive at declaration
// time, so an entity literally named 'test' would collide with the static
// `test()` test-mode constructor. Mangle to `<Name>_` in that case.
const PHP_RESERVED_LOWER = new Set(['test'])

const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  // Idiomatic facade method name is the lowercase entity name. PHP method
  // names are case-insensitive, so `$client->${entity.Name}()` still resolves
  // here (deprecated alias) — we cannot declare a separate PascalCase method
  // without a "Cannot redeclare" fatal.
  const accessor = PHP_RESERVED_LOWER.has(entity.name.toLowerCase())
    ? entity.name + '_'
    : entity.name

  Content(`
    private $_${entity.name} = null;

    // Idiomatic facade: $client->${accessor}()->list() / ->load(["id" => ...]).
    // Also serves the deprecated PascalCase alias ${entity.Name}() (PHP method
    // names are case-insensitive).
    public function ${accessor}($data = null)
    {
        require_once __DIR__ . '/entity/${entity.name}_entity.php';
        if ($data === null) {
            if ($this->_${entity.name} === null) {
                $this->_${entity.name} = new ${entity.Name}Entity($this, null);
            }
            return $this->_${entity.name};
        }
        return new ${entity.Name}Entity($this, $data);
    }

`)

})


export {
  MainEntity
}
