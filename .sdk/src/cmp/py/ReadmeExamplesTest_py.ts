
import { cmp, File, Content } from '@voxgig/sdkgen'


// Emits py/test/test_readme_examples.py — a pytest module that validates
// every ```python fenced block in the repository ROOT README.md.
//
// What the generated test checks (documented in its own module docstring):
//   1. compile / ast.parse EVERY python block           -> catches SYNTAX errors.
//   2. if mypy is importable: concatenate the blocks and type-check them
//      (the SDK ships py.typed + TypedDicts, so entity ops are typed and
//      e.g. `.data` on a list() result is a real error)  -> catches TYPE errors.
//   3. mypy-absent fallback: execute the TEST-MODE snippets (those calling
//      `.test()`, which run offline against the mock transport) and assert
//      they raise no PROGRAMMING error (Name/Attribute/Type/Key/Import).
//      A domain SDK error (e.g. a 404 for an unseeded mock id) is allowed.
//
// The emitted Python is written WITHOUT backticks or backslashes (chr(96) is
// the fence marker, chr(10) is newline) so this TS template literal stays
// clean — the only interpolations are the SDK module/class names.
const ReadmeExamplesTest = cmp(function ReadmeExamplesTest(props: any) {
  const { target, ctx$: { model } } = props

  const Name = model.const.Name
  const sdkModule = Name.toLowerCase() + '_sdk'
  const sdkClass = Name + 'SDK'

  File({ name: 'test_readme_examples.' + target.ext }, () => {
    Content(`# ${Name} SDK — root README python-examples test.
#
# Validates every python fenced code block in the repository ROOT README.md
# (one directory above the py/ package). It exists to keep the documented
# examples honest as the generator evolves.
#
# Checks, in order:
#
#   1. COMPILE: every python block is parsed with ast.parse + compile(). This
#      catches syntax errors in the docs (e.g. a dict key with no value).
#
#   2. TYPECHECK (if mypy is importable): all blocks are concatenated into a
#      single module — they read as one sequential narrative, so the "client"
#      defined in the quickstart carries through — and type-checked with mypy.
#      The SDK ships py.typed and TypedDicts, so entity operations are typed
#      (list() -> list[Entity], load() -> Entity). mypy therefore flags bogus
#      access such as ".data" on a list result or a wrong-typed match dict.
#      Only errors attributed to the concatenated snippet file fail the test;
#      import-resolution noise is treated as inconclusive.
#
#   3. RUNTIME FALLBACK (always runs; the real safety net when mypy is absent):
#      every TEST-MODE snippet (one that calls .test(), which runs fully
#      offline against the in-memory mock transport) is executed and must not
#      raise a PROGRAMMING error — NameError / AttributeError / TypeError /
#      KeyError / IndexError / ImportError. A domain-level SDK error (for
#      instance a 404 because the mock id is not seeded) is acceptable: it
#      proves the snippet is structurally valid Python that reaches the SDK.

import ast
import os
import subprocess
import sys
import tempfile

import pytest


_TEST_DIR = os.path.dirname(os.path.abspath(__file__))
_PY_ROOT = os.path.dirname(_TEST_DIR)                       # the py/ package root
_README = os.path.abspath(os.path.join(_PY_ROOT, "..", "README.md"))  # repo root

_FENCE = chr(96) * 3   # the triple-backtick markdown code fence
_NL = chr(10)          # newline


def _read_readme():
    if not os.path.exists(_README):
        pytest.skip("root README not found: " + _README)
    with open(_README, "r", encoding="utf-8") as fh:
        return fh.read()


def _python_blocks():
    # Split on the code fence: odd-indexed segments are the inside of a fenced
    # block (an info string on the first line, then the code). No regex, no
    # backslashes — keeps this robust and generator-friendly.
    text = _read_readme()
    parts = text.split(_FENCE)
    blocks = []
    for i in range(1, len(parts), 2):
        seg = parts[i]
        lines = seg.split(_NL)
        info = lines[0].strip()
        if info == "python":
            blocks.append(_NL.join(lines[1:]))
    return blocks


def test_readme_has_python_blocks():
    assert len(_python_blocks()) > 0, "expected at least one python block in the root README"


def test_readme_python_blocks_compile():
    # Syntax gate: every documented python block must parse and compile.
    for i, block in enumerate(_python_blocks()):
        try:
            ast.parse(block)
            compile(block, "<readme-block-" + str(i) + ">", "exec")
        except SyntaxError as err:
            pytest.fail(
                "root README python block #" + str(i)
                + " is not valid Python: " + str(err) + _NL + _NL + block
            )


def _mypy_available():
    try:
        import mypy  # noqa: F401
        return True
    except Exception:
        return False


def test_readme_python_blocks_typecheck():
    # Type gate: concatenate the blocks and run mypy over them. Only fails on
    # errors mypy attributes to our snippet file; environmental import noise is
    # inconclusive (skipped). When mypy is unavailable the runtime fallback
    # below is the safety net.
    if not _mypy_available():
        pytest.skip("mypy not importable — covered by the runtime fallback test")

    source = (_NL + _NL).join(_python_blocks()) + _NL

    with tempfile.TemporaryDirectory() as td:
        snippet_path = os.path.join(td, "readme_snippets.py")
        with open(snippet_path, "w", encoding="utf-8") as fh:
            fh.write(source)

        env = dict(os.environ)
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        # Resolve "from ${sdkModule} import ${sdkClass}" against the package root.
        env["MYPYPATH"] = _PY_ROOT + os.pathsep + env.get("MYPYPATH", "")

        proc = subprocess.run(
            [
                sys.executable, "-m", "mypy",
                "--no-error-summary",
                "--no-color-output",
                "--follow-imports=silent",   # use SDK types, silence SDK-internal errors
                "--ignore-missing-imports",
                snippet_path,
            ],
            cwd=_PY_ROOT,
            env=env,
            capture_output=True,
            text=True,
        )

        base = os.path.basename(snippet_path)
        output = (proc.stdout or "") + (proc.stderr or "")
        errors = []
        for line in output.split(_NL):
            if base in line and ": error:" in line:
                if "Cannot find implementation or library stub" in line:
                    continue
                if "Skipping analyzing" in line:
                    continue
                errors.append(line)

        if errors:
            pytest.fail(
                "mypy found type errors in the root README python snippets:"
                + _NL + _NL.join(errors) + _NL + _NL + "--- snippets ---" + _NL + source
            )


_PROGRAMMING_ERRORS = (
    SyntaxError, NameError, AttributeError, TypeError,
    KeyError, IndexError, ImportError,
)


def test_readme_testmode_snippets_run():
    # Runtime gate (offline): execute the test-mode snippets against the mock
    # transport and assert they contain no programming error. Domain errors
    # (e.g. a 404 for an unseeded mock id) are tolerated — they still prove the
    # snippet is valid Python that drives the SDK.
    from ${sdkModule} import ${sdkClass}

    blocks = [b for b in _python_blocks() if ".test()" in b]
    if not blocks:
        pytest.skip("no test-mode (.test()) python blocks in the root README")

    for i, block in enumerate(blocks):
        # Seed the names the snippet relies on from the surrounding narrative
        # (the SDK import lives in the quickstart block above it).
        namespace = {"${sdkClass}": ${sdkClass}, "os": os}
        try:
            exec(compile(block, "<readme-testmode-" + str(i) + ">", "exec"), namespace)
        except _PROGRAMMING_ERRORS as err:
            pytest.fail(
                "root README test-mode block #" + str(i)
                + " raised a programming error: "
                + type(err).__name__ + ": " + str(err) + _NL + _NL + block
            )
        except Exception:
            # Domain-level SDK error — acceptable (mock data may be absent).
            pass
`)
  })
})


export {
  ReadmeExamplesTest
}
