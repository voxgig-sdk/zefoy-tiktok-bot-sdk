

import { cmp, Content } from '@voxgig/sdkgen'


// Reserved PHP method names on the SDK class that an entity accessor must
// not collide with. PHP method names are case-insensitive at declaration
// time, so an entity literally named 'test' would collide with the static
// `test()` test-mode constructor. Mangle to `<Name>_` in that case.
const PHP_RESERVED_LOWER = new Set(['test'])

const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props
  const { model } = props.ctx$

  const accessor = PHP_RESERVED_LOWER.has(entity.Name.toLowerCase())
    ? entity.Name + '_'
    : entity.Name

  Content(`
    public function ${accessor}($data = null)
    {
        require_once __DIR__ . '/entity/${entity.name}_entity.php';
        return new ${entity.Name}Entity($this, $data);
    }

`)

})


export {
  MainEntity
}
