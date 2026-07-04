
import { cmp, Content, installCommand, isPublished, repoInfo } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

If the module is not yet published, add the source directory to
your \`LUA_PATH\`:

\`\`\`bash
export LUA_PATH="path/to/lua/?.lua;path/to/lua/?/init.lua;;"
\`\`\`

`)
    return
  }

  // Publish pending: not yet on LuaRocks. Install from the git release tag,
  // or add the source directory to LUA_PATH.
  const { releasesUrl } = repoInfo(model)
  Content(`This package is not yet published to LuaRocks. Install it from the
GitHub release tag (\`${target.name}/vX.Y.Z\`, see [Releases](${releasesUrl})),
or add the source directory to your \`LUA_PATH\`:

\`\`\`bash
export LUA_PATH="path/to/lua/?.lua;path/to/lua/?/init.lua;;"
\`\`\`

`)
})


export {
  ReadmeInstall
}
