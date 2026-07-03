.PHONY: test build clean publish

# tsc emits to dist/ + dist-test/; the test runner reads dist-test/, so build first.
test: build
	npm test

build:
	npm run build

clean:
	rm -rf dist dist-test node_modules

# --- Release: publish to npm ----------------------------------------------
# Compile, then publish this package to npm and tag ts/vX.Y.Z. Run headless
# under the aql key vault, which injects the npm auth token + the GitHub token
# (never on disk or argv):
#   aql vault exec --for=npm=<alias> --for=github=<alias> -- make publish
# aql `--dry-run` injects a filler token we detect to rehearse (build only, no
# publish/tag). set -e + tag-last: a failed publish never leaves a tag behind.
SHELL := /bin/bash
VERSION := $(shell node -p "require('./package.json').version")
TAG := ts/v$(VERSION)
AQL_DRY_RUN_FILLER := AQL-DRY-RUN-FILLER-NOT-A-REAL-SECRET
publish: test
	@if git rev-parse -q --verify "refs/tags/$(TAG)" >/dev/null; then \
	  echo "tag $(TAG) already exists — bump package.json version first"; exit 1; fi
	@set -e; \
	token="$${GITHUB_TOKEN:-$$GH_TOKEN}"; \
	if [ "$$token" = "$(AQL_DRY_RUN_FILLER)" ]; then \
	  echo "[dry-run] aql filler token detected: would publish to npm and tag $(TAG); nothing pushed."; \
	  exit 0; \
	fi; \
	npm publish --access public --registry https://registry.npmjs.org; \
	git tag -a "$(TAG)" -m "ts v$(VERSION)"; \
	url=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \
	if [ -n "$$token" ] && printf '%s' "$$url" | grep -q '^https://github.com/'; then \
	  hdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\n')"; \
	  git -c http.extraheader="$$hdr" push "$$url" "$(TAG)"; \
	else \
	  git push origin "$(TAG)"; \
	fi; \
	echo "Published to npm + tag $(TAG)."
