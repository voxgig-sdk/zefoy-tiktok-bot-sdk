

import {
  cmp,
  Deploy,
  ReadmeTop,
} from '@voxgig/sdkgen'


const Top = cmp(function Top(props: any) {
  ReadmeTop({})

  // Root deployment Makefile: per-target `make deploy-<t>` (publish with
  // credentials injected by the aql key vault) plus an all-targets
  // `make deploy-dry` rehearsal.
  Deploy({})
})


export {
  Top
}

