.PHONY: test build clean

test:
	python -m pytest test/

build:
	@echo "No build step for Python"

clean:
	find . -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
