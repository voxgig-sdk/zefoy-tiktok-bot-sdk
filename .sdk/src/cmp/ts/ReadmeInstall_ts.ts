
import { cmp, Content, installCommand } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  Content('```bash')
  Content(`
${installCommand(model, target.name)}
`)
  Content('```')

})


export {
  ReadmeInstall
}
