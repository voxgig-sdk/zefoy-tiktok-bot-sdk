
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
dist/
dist-test/
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
