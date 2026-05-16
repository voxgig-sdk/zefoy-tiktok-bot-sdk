
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


const Gitignore = cmp(async function Gitignore(_props: any) {
  File({ name: '.gitignore' }, () => {
    Content(`# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class
*.so

# Distribution / packaging
build/
dist/
*.egg
*.egg-info/
.eggs/
wheels/

# Test / coverage
.pytest_cache/
.tox/
.coverage
.coverage.*
htmlcov/
coverage.xml

# Type checkers
.mypy_cache/
.pyre/
.pytype/

# Virtual environments
.venv/
venv/
env/
ENV/

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
