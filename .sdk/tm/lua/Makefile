.PHONY: test build clean publish

test:
	busted -p _test test/

build:
	@echo "No build step for Lua"

clean:
	@echo "No clean step for Lua"

# --- Release: publish to LuaRocks -----------------------------------------
# Upload the rockspec to LuaRocks, then tag lua/vX.Y.Z. LuaRocks has no aql
# recipe, so inject its API key + the GitHub token as custom env vars
# (all-positional — aql cannot mix --for recipes with positional env):
#   aql vault exec '<alias>=LUAROCKS_API_KEY,<gh-alias>=GITHUB_TOKEN' -- make publish
# --skip-pack uploads only the rockspec (its git+https source is fetched at the
# lua/vX.Y.Z tag on install; that tag is pushed in the LAST step, so we must not
# pack here). LuaRocks requires the rockspec filename to be
# <package>-<version>.rockspec, so we upload a canonically-named copy. aql
# `--dry-run` rehearses (no upload/tag). set -e + tag-last: a failed upload
# never leaves a tag behind.
VERSION := $(shell sed -nE 's/^version *= *"([0-9.]+).*/\1/p' *.rockspec | head -1)
TAG := lua/v$(VERSION)
AQL_DRY_RUN_FILLER := AQL-DRY-RUN-FILLER-NOT-A-REAL-SECRET
publish: test
	@if git rev-parse -q --verify "refs/tags/$(TAG)" >/dev/null; then \
	  echo "tag $(TAG) already exists — bump the rockspec version first"; exit 1; fi
	@set -e; \
	token="$${GITHUB_TOKEN:-$$GH_TOKEN}"; \
	if [ "$$token" = "$(AQL_DRY_RUN_FILLER)" ] || [ "$$LUAROCKS_API_KEY" = "$(AQL_DRY_RUN_FILLER)" ]; then \
	  echo "[dry-run] aql filler token detected: would upload to LuaRocks and tag $(TAG); nothing pushed."; \
	  exit 0; \
	fi; \
	rock=$$(ls *.rockspec | head -1); \
	pkg=$$(sed -nE 's/^package *= *"([^"]+)".*/\1/p' "$$rock" | head -1); \
	rev=$$(sed -nE 's/^version *= *"([^"]+)".*/\1/p' "$$rock" | head -1); \
	cp "$$rock" "$$pkg-$$rev.rockspec"; \
	luarocks upload --skip-pack "$$pkg-$$rev.rockspec" --temp-key="$$LUAROCKS_API_KEY"; \
	rm -f "$$pkg-$$rev.rockspec"; \
	git tag -a "$(TAG)" -m "lua v$(VERSION)"; \
	url=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \
	if [ -n "$$token" ] && printf '%s' "$$url" | grep -q '^https://github.com/'; then \
	  hdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\n')"; \
	  git -c http.extraheader="$$hdr" push "$$url" "$(TAG)"; \
	else \
	  git push origin "$(TAG)"; \
	fi; \
	echo "Published to LuaRocks + tag $(TAG)."
