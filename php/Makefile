.PHONY: test build clean publish

test:
	./vendor/bin/phpunit test

build:
	@echo "No build step for PHP"

clean:
	@echo "No clean step for PHP"

# --- Release: tag for Packagist -------------------------------------------
# Packagist has no upload — it tracks the repo and indexes each git tag
# php/vX.Y.Z (a configured GitHub webhook, or the Packagist "Update" API,
# refreshes the package). So publishing a version means pushing the tag. Run
# headless under the aql key vault, which injects the GitHub token:
#   aql vault exec --for=github=<alias> -- make publish
# aql `--dry-run` injects a filler token we detect to rehearse (no tag/push).
# set -e + tag-last: a failed push never leaves a tag behind.
VERSION := $(shell cat VERSION)
TAG := php/v$(VERSION)
AQL_DRY_RUN_FILLER := AQL-DRY-RUN-FILLER-NOT-A-REAL-SECRET
publish: test
	@if git rev-parse -q --verify "refs/tags/$(TAG)" >/dev/null; then \
	  echo "tag $(TAG) already exists — bump VERSION first"; exit 1; fi
	@set -e; \
	token="$${GITHUB_TOKEN:-$$GH_TOKEN}"; \
	if [ "$$token" = "$(AQL_DRY_RUN_FILLER)" ]; then \
	  echo "[dry-run] aql filler token detected: would tag $(TAG) for Packagist; nothing pushed."; \
	  exit 0; \
	fi; \
	git tag -a "$(TAG)" -m "php v$(VERSION)"; \
	url=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \
	if [ -n "$$token" ] && printf '%s' "$$url" | grep -q '^https://github.com/'; then \
	  hdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\n')"; \
	  git -c http.extraheader="$$hdr" push "$$url" "$(TAG)"; \
	else \
	  git push origin "$(TAG)"; \
	fi; \
	echo "Tagged $(TAG) for Packagist."
