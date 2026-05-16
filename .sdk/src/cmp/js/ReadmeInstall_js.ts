
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target } = props

  Content('```js')
  Content(`
npm install ${target.module.name}
`)
  Content('```')

})


export {
  ReadmeInstall
}
