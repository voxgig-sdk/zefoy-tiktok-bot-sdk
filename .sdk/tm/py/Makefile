.PHONY: test build clean publish

test:
	python -m pytest test/

build:
	@echo "No build step for Python"

clean:
	find . -name __pycache__ -exec rm -rf {} + 2>/dev/null; true

# --- Release: publish to PyPI ---------------------------------------------
# Publish this package to PyPI, then tag py/vX.Y.Z. Run headless under the aql
# key vault, which injects the PyPI + GitHub tokens as environment variables
# (never written to disk or argv):
#   aql vault exec --for=pypi=<alias> --for=github=<alias> -- make publish
# aql `--dry-run` injects a filler token we detect to rehearse: builds the dist
# but performs no upload, tag, or push. set -e + tag-last: a failed upload never
# leaves a tag behind. Needs python `build` + `twine` (pip install build twine).
VERSION := $(shell sed -nE 's/^version *= *"([^"]+)".*/\1/p' pyproject.toml | head -1)
TAG := py/v$(VERSION)
AQL_DRY_RUN_FILLER := AQL-DRY-RUN-FILLER-NOT-A-REAL-SECRET
publish: test
	@if git rev-parse -q --verify "refs/tags/$(TAG)" >/dev/null; then \
	  echo "tag $(TAG) already exists — bump pyproject.toml version first"; exit 1; fi
	@set -e; \
	token="$${GITHUB_TOKEN:-$$GH_TOKEN}"; \
	rm -rf dist; \
	python3 -m build; \
	if [ "$$token" = "$(AQL_DRY_RUN_FILLER)" ] || [ "$$TWINE_PASSWORD" = "$(AQL_DRY_RUN_FILLER)" ]; then \
	  echo "[dry-run] aql filler token detected: built the dist; would upload to PyPI and tag $(TAG); nothing pushed."; \
	  exit 0; \
	fi; \
	python3 -m twine upload dist/*; \
	git tag -a "$(TAG)" -m "py v$(VERSION)"; \
	url=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \
	if [ -n "$$token" ] && printf '%s' "$$url" | grep -q '^https://github.com/'; then \
	  hdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\n')"; \
	  git -c http.extraheader="$$hdr" push "$$url" "$(TAG)"; \
	else \
	  git push origin "$(TAG)"; \
	fi; \
	echo "Published to PyPI + tag $(TAG)."
