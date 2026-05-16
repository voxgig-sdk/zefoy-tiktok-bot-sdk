
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  Content(`\`\`\`bash
luarocks install ${model.name}-sdk
\`\`\`

If the module is not yet published, add the source directory to
your \`LUA_PATH\`:

\`\`\`bash
export LUA_PATH="path/to/lua/?.lua;path/to/lua/?/init.lua;;"
\`\`\`

`)
})


export {
  ReadmeInstall
}
