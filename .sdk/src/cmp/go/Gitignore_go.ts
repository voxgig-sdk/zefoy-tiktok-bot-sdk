
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

# Readme-snippet check work dirs (TestReadmeGoSnippets). Normally removed on
# exit; a killed run leaves one behind, and committing it is how a 1132-file
# snippet package once shipped in a release.
_readmecheck-*/
readmecheck-*/

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
