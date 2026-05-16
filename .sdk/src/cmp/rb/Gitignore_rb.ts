
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


const Gitignore = cmp(async function Gitignore(_props: any) {
  File({ name: '.gitignore' }, () => {
    Content(`# Bundler / gem build artifacts
*.gem
.bundle/
vendor/bundle/
pkg/

# Test / coverage
coverage/
.rspec_status

# Documentation
.yardoc/
_yardoc/
doc/
rdoc/

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
