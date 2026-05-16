
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


const Gitignore = cmp(async function Gitignore(_props: any) {
  File({ name: '.gitignore' }, () => {
    Content(`# Compiled object files and binaries
*.o
*.a
*.so
*.dll
*.dylib
*.exe
*.exe~

# Test binaries and output
*.test
*.out

# Coverage
coverage.txt
coverage.html
*.cover

# Go workspace
go.work
go.work.sum

# Vendored deps
vendor/

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
