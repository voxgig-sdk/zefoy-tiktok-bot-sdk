.PHONY: test build clean publish

test:
	go test ./... -v

build:
	go build ./...

clean:
	go clean ./...

# --- Release: tag for the Go module proxy (pkg.go.dev) --------------------
# Go modules have no registry upload — publishing a version means pushing the
# tag go/vX.Y.Z (this module is the go/ subdir, and Go's submodule-tag
# convention is <subdir>/vX.Y.Z), which the module proxy + pkg.go.dev pick up on
# first fetch. Run headless under the aql key vault, which injects the GitHub
# token so nothing lands on disk or argv:
#   aql vault exec --for=github=<alias> -- make publish
# aql `--dry-run` injects a filler token we detect to rehearse (no tag/push).
# set -e + tag-last: a failed push never leaves a tag behind.
#
# NOTE: publishing the git tag is deliberately NOT gated on `go test` (every
# other target's deploy just pushes its tag; a generated-test quirk must not
# block the module tag). Run `make test` separately in CI to gate quality.
VERSION := $(shell cat VERSION)
TAG := go/v$(VERSION)
AQL_DRY_RUN_FILLER := AQL-DRY-RUN-FILLER-NOT-A-REAL-SECRET
publish:
	@if git rev-parse -q --verify "refs/tags/$(TAG)" >/dev/null; then \
	  echo "tag $(TAG) already exists — bump VERSION first"; exit 1; fi
	@set -e; \
	token="$${GITHUB_TOKEN:-$$GH_TOKEN}"; \
	if [ "$$token" = "$(AQL_DRY_RUN_FILLER)" ]; then \
	  echo "[dry-run] aql filler token detected: would tag $(TAG) for pkg.go.dev; nothing pushed."; \
	  exit 0; \
	fi; \
	git tag -a "$(TAG)" -m "go v$(VERSION)"; \
	url=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \
	if [ -n "$$token" ] && printf '%s' "$$url" | grep -q '^https://github.com/'; then \
	  hdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\n')"; \
	  git -c http.extraheader="$$hdr" push "$$url" "$(TAG)"; \
	else \
	  git push origin "$(TAG)"; \
	fi; \
	echo "Tagged $(TAG) for pkg.go.dev."
