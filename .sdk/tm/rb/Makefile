.PHONY: test build clean publish

test:
	ruby -Ilib test/exists_test.rb

build:
	@echo "No build step for Ruby"

clean:
	@echo "No clean step for Ruby"

# --- Release: publish to RubyGems -----------------------------------------
# Build the gem and push it to RubyGems, then tag rb/vX.Y.Z. Run headless under
# the aql key vault, which injects GEM_HOST_API_KEY + the GitHub token (never on
# disk or argv):
#   aql vault exec --for=gem=<alias> --for=github=<alias> -- make publish
# aql `--dry-run` injects a filler token we detect to rehearse (build only, no
# push/tag). set -e + tag-last: a failed push never leaves a tag behind.
VERSION := $(shell sed -nE 's/.*\.version *= *"([^"]+)".*/\1/p' *.gemspec | head -1)
TAG := rb/v$(VERSION)
AQL_DRY_RUN_FILLER := AQL-DRY-RUN-FILLER-NOT-A-REAL-SECRET
publish: test
	@if git rev-parse -q --verify "refs/tags/$(TAG)" >/dev/null; then \
	  echo "tag $(TAG) already exists — bump the gemspec version first"; exit 1; fi
	@set -e; \
	token="$${GITHUB_TOKEN:-$$GH_TOKEN}"; \
	rm -f *.gem; \
	gem build *.gemspec; \
	if [ "$$token" = "$(AQL_DRY_RUN_FILLER)" ] || [ "$$GEM_HOST_API_KEY" = "$(AQL_DRY_RUN_FILLER)" ]; then \
	  echo "[dry-run] aql filler token detected: built the gem; would push to RubyGems and tag $(TAG); nothing pushed."; \
	  exit 0; \
	fi; \
	gem push *.gem; \
	git tag -a "$(TAG)" -m "rb v$(VERSION)"; \
	url=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \
	if [ -n "$$token" ] && printf '%s' "$$url" | grep -q '^https://github.com/'; then \
	  hdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\n')"; \
	  git -c http.extraheader="$$hdr" push "$$url" "$(TAG)"; \
	else \
	  git push origin "$(TAG)"; \
	fi; \
	echo "Published to RubyGems + tag $(TAG)."
