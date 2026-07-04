

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props

  Content(`
  _${entity.name}?: ${entity.Name}Entity

  // Idiomatic facade: \`client.${entity.name}.list()\` / \`client.${entity.name}.load({ id })\`.
  get ${entity.name}(): ${entity.Name}Entity {
    return (this._${entity.name} ??= new ${entity.Name}Entity(this, undefined))
  }

  /** @deprecated Use \`client.${entity.name}\` instead. */
  ${entity.Name}(data?: any) {
    const self = this
    return new ${entity.Name}Entity(self,data)
  }

`)

})


export {
  MainEntity
}
