

import { cmp, Content } from '@voxgig/sdkgen'


const MainEntity = cmp(async function MainEntity(props: any) {
  const { entity } = props

  Content(`
  ${entity.Name}(data?: any) {
    const self = this
    return new ${entity.Name}Entity(self,data)
  }

`)

})


export {
  MainEntity
}
