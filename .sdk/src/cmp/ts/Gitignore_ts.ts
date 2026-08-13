
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


const Gitignore = cmp(async function Gitignore(_props: any) {
  File({ name: '.gitignore' }, () => {
    Content(`# Dependencies
node_modules/

# Build output
#
# dist/ and dist-test/ are COMMITTED, not ignored: the compiled SDK and the
# compiled test suite are part of the published repo, so a consumer can read
# and run them straight from a clone without a build step. Only the
# incremental-build bookkeeping is ignored.
*.tsbuildinfo

# Coverage
coverage/

# Logs
*.log
npm-debug.log*

# IDE / OS
.idea/
.vscode/
.DS_Store
`)
  })
})


export {
  Gitignore
}
