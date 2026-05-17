# go-cli features

The go-cli target does not generate per-feature source. Features are
applied to the sibling Go SDK by the `go` target; the CLI consumes
that SDK as a single dependency. This file exists only to satisfy
the standard tm/<target>/src/feature/ folder convention.
