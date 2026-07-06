
import { cmp, each, File, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// Emits py/test/test_readme_examples.py — a pytest module that validates
// every ```python fenced block in the repository ROOT README.md, in the
// per-language py/README.md, AND in the per-language py/REFERENCE.md.
//
// What the generated test checks (documented in its own module docstring):
//   1. compile / ast.parse EVERY python block           -> catches SYNTAX errors.
//   2. if mypy is importable: concatenate the ROOT README blocks and
//      type-check them (the SDK ships py.typed + TypedDicts, so entity ops are
//      typed and e.g. `.data` on a list() result is a real error) -> TYPE errors.
//   3. EXECUTE every runnable python block offline: each block that builds a
//      client is rewritten into seeded TEST mode (so load/list resolve against
//      the in-memory mock) and run in a subprocess. For the per-language
//      py/README.md — which reads as a narrative where an early snippet builds
//      `client` and later how-to/error-handling snippets drive it — a block
//      that uses `client` without building one gets a seeded test client
//      injected first, so it too runs. A programming error
//      (Name/Attribute/Type/Key/Index/Import/Syntax) FAILS the test; a domain
//      error (e.g. not-found for an unseeded id) is tolerated. This is what
//      surfaces a bug like `result["err"]` indexing on a direct() envelope
//      that has no err key (a KeyError at runtime).
//
// The emitted Python is written WITHOUT backticks or backslashes (chr(96) is
// the fence marker, chr(10) is newline) so this TS template literal stays
// clean — the only interpolations are the SDK module/class names and the
// generated entity map.
const ReadmeExamplesTest = cmp(function ReadmeExamplesTest(props: any) {
  const { target, ctx$: { model } } = props

  const Name = model.const.Name
  const sdkModule = Name.toLowerCase() + '_sdk'
  const sdkClass = Name + 'SDK'

  // The API's capitalised semantic entities, mapped to their lowercase
  // fixture key: { "Fact": "fact", "User": "user" }. Used at runtime to seed
  // a mock record for every entity a README block references.
  const entities = each(getModelPath(model, `main.${KIT}.entity`))
    .filter((e: any) => e.active !== false)
  const entitiesLiteral = 0 === entities.length
    ? '{}'
    : '{\n' + entities
      .map((e: any) => `    "${nom(e, 'Name')}": "${e.name}",`)
      .join('\n') + '\n}'

  File({ name: 'test_readme_examples.' + target.ext }, () => {
    Content(`# ${Name} SDK — documentation python-examples test.
#
# Validates every python fenced code block in three documents:
#   - the repository ROOT README.md (one directory above the py/ package),
#   - the per-language py/README.md (tutorial, how-to, error-handling,
#     testing and entity-op examples — in the package root),
#   - the per-language py/REFERENCE.md (in the package root).
# It exists to keep the documented examples honest as the generator evolves.
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
#   3. EXECUTE (always runs; the real safety net): every python block that
#      constructs a client is rewritten into offline TEST mode — the live
#      constructor and any existing .test(...) call both become
#      .test({"entity": {...}}) seeding one mock record (id "test01") for each
#      entity the block references — and then run in a subprocess. Any
#      PROGRAMMING error (NameError / AttributeError / TypeError / KeyError /
#      IndexError / ImportError / SyntaxError) fails the test. A domain-level
#      SDK error (for instance a 404 because a referenced id is not seeded) is
#      tolerated: it proves the snippet is structurally valid Python that
#      drives the SDK. This catches real bugs — a snippet calling a method
#      that does not exist raises AttributeError and fails here.
#
# The per-language py/README.md and py/REFERENCE.md are held to the COMPILE
# and EXECUTE gates (checks 1 and 3) by the parallel test_local_readme_* and
# test_reference_* functions below. The compile gate catches a bad constructor
# import such as a hyphenated module name ("from my-slug_sdk import ..."),
# which is a Python SyntaxError. For py/README.md the examples read as one
# narrative — an early snippet builds "client", later how-to/error-handling
# snippets drive it — so the execute gate injects a seeded test "client"
# before any block that uses it without building one. That is what would
# surface, e.g., a KeyError from indexing result["err"] on a direct() envelope
# that has no err key.

import ast
import os
import subprocess
import sys
import tempfile

import pytest


_TEST_DIR = os.path.dirname(os.path.abspath(__file__))
_PY_ROOT = os.path.dirname(_TEST_DIR)                       # the py/ package root
_README = os.path.abspath(os.path.join(_PY_ROOT, "..", "README.md"))  # repo root
_REFERENCE = os.path.join(_PY_ROOT, "REFERENCE.md")        # per-language reference
_LOCAL_README = os.path.join(_PY_ROOT, "README.md")        # per-language README

_FENCE = chr(96) * 3   # the triple-backtick markdown code fence
_NL = chr(10)          # newline
_WS = (chr(32), chr(9), chr(13), chr(10))   # space, tab, CR, LF

_SDK_MODULE = "${sdkModule}"
_SDK_CLASS = "${sdkClass}"

# The variable the generated narrative examples bind the client to. A
# per-language README reads as a sequence: an early snippet builds "client",
# later snippets drive it. A block that uses "client." without building one
# gets a seeded test client injected so it can run standalone (see
# _execute_blocks(..., inject_client=True)).
_CLIENT_VAR = "client"

# The API's capitalised semantic entities -> lowercase fixture key.
_ENTITIES = ${entitiesLiteral}


def _read_doc(path, label):
    if not os.path.exists(path):
        pytest.skip(label + " not found: " + path)
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def _blocks_in(text):
    # Split on the code fence: odd-indexed segments are the inside of a fenced
    # block (an info string on the first line, then the code). No regex, no
    # backslashes — keeps this robust and generator-friendly. Only fences whose
    # info string is exactly "python" are returned, so signature/markdown
    # tables (plain text or other fences) are skipped.
    parts = text.split(_FENCE)
    blocks = []
    for i in range(1, len(parts), 2):
        seg = parts[i]
        lines = seg.split(_NL)
        info = lines[0].strip()
        if info == "python":
            blocks.append(_NL.join(lines[1:]))
    return blocks


def _python_blocks():
    return _blocks_in(_read_doc(_README, "root README"))


def _reference_blocks():
    return _blocks_in(_read_doc(_REFERENCE, "py REFERENCE.md"))


def _local_readme_blocks():
    return _blocks_in(_read_doc(_LOCAL_README, "py README.md"))


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


def test_reference_has_python_blocks():
    assert len(_reference_blocks()) > 0, "expected at least one python block in py/REFERENCE.md"


def test_reference_python_blocks_compile():
    # Syntax gate for the per-language REFERENCE.md. Its constructor example
    # imports the SDK module; if the emitted module name were hyphenated
    # (e.g. "from my-slug_sdk import ...") ast.parse would raise here. The doc
    # module name must match the real ${sdkModule}.py file.
    for i, block in enumerate(_reference_blocks()):
        try:
            ast.parse(block)
            compile(block, "<reference-block-" + str(i) + ">", "exec")
        except SyntaxError as err:
            pytest.fail(
                "py/REFERENCE.md python block #" + str(i)
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
    # inconclusive (skipped). When mypy is unavailable the execute gate below
    # is the safety net.
    if not _mypy_available():
        pytest.skip("mypy not importable — covered by the execute gate")

    source = (_NL + _NL).join(_python_blocks()) + _NL

    with tempfile.TemporaryDirectory() as td:
        snippet_path = os.path.join(td, "readme_snippets.py")
        with open(snippet_path, "w", encoding="utf-8") as fh:
            fh.write(source)

        env = dict(os.environ)
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        # Resolve "from _SDK_MODULE import _SDK_CLASS" against the package root.
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


# Exception TYPE names that signal a programming (not domain) error. Matched
# against the last line of a failed subprocess's traceback.
_PROGRAMMING_ERROR_NAMES = frozenset([
    "SyntaxError", "IndentationError", "NameError", "AttributeError",
    "TypeError", "KeyError", "IndexError", "ImportError", "ModuleNotFoundError",
])


def _seed_literal(block):
    # Build a test() fixture seeding one mock record (id "test01") for every
    # entity the block references, so list()/load() resolve offline. Detection
    # is by the "client.<Entity>(" factory call the generated examples use.
    seeded = {}
    for cap, key in _ENTITIES.items():
        if ("." + cap + "(") in block:
            seeded[key] = {"test01": {"id": "test01"}}
    return {"entity": seeded}


def _rewrite_to_test_mode(block):
    # Force every client construction into offline test mode with seeded
    # fixtures: both _SDK_CLASS(...) (live) and _SDK_CLASS.test(...) become
    # _SDK_CLASS.test({"entity": {...}}). Balanced-paren aware, so a
    # multi-line constructor argument is consumed whole. A bare mention of the
    # class name (e.g. in an import) is left untouched.
    seed = repr(_seed_literal(block))
    replacement = _SDK_CLASS + ".test(" + seed + ")"
    out = []
    i = 0
    n = len(block)
    while True:
        j = block.find(_SDK_CLASS, i)
        if j < 0:
            out.append(block[i:])
            break
        out.append(block[i:j])
        k = j + len(_SDK_CLASS)
        if block[k:k + 5] == ".test":
            k += 5
        while k < n and block[k] in _WS:
            k += 1
        if k < n and block[k] == "(":
            depth = 0
            m = k
            while m < n:
                c = block[m]
                if c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        m += 1
                        break
                m += 1
            out.append(replacement)
            i = m
        else:
            # Not a construction (e.g. "from ..._sdk import _SDK_CLASS") —
            # keep the original text verbatim.
            out.append(block[j:k])
            i = k
    return "".join(out)


def _execute_blocks(blocks, label, inject_client=False):
    # Runtime gate (offline): every python block that constructs a client is
    # rewritten into seeded test mode and executed in a subprocess. A
    # programming error fails the test; a domain error is tolerated. Returns
    # the number of blocks actually executed.
    #
    # inject_client=True (the per-language README narrative): a block that
    # drives "client." without building one gets a seeded test client injected
    # first, so error-handling/how-to snippets run rather than being merely
    # compiled. That is what surfaces, e.g., a KeyError from indexing
    # result["err"] on a direct() envelope that has no err key.
    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONPATH"] = _PY_ROOT + os.pathsep + env.get("PYTHONPATH", "")

    preamble = "import os" + _NL + "from " + _SDK_MODULE + " import " + _SDK_CLASS + _NL

    executed = 0
    for i, block in enumerate(blocks):
        if _SDK_CLASS in block:
            # Self-contained: the block builds its own client.
            source = preamble + _rewrite_to_test_mode(block)
        elif inject_client and (_CLIENT_VAR + ".") in block:
            # Narrative block: it drives a "client" an earlier snippet built.
            # Inject a seeded test client (mock records for the entities this
            # block references) and run the block verbatim.
            seed = repr(_seed_literal(block))
            inject = _CLIENT_VAR + " = " + _SDK_CLASS + ".test(" + seed + ")" + _NL
            source = preamble + inject + block
        else:
            # Neither builds nor drives a client (a signature/illustration
            # block); the compile gate already covered it — nothing to run.
            continue

        proc = subprocess.run(
            [sys.executable, "-c", source],
            cwd=_PY_ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
        executed += 1

        if proc.returncode == 0:
            continue

        stderr = proc.stderr or ""
        errlines = [ln for ln in stderr.split(_NL) if ln.strip()]
        last = errlines[-1] if errlines else ""
        # Traceback's final line is "ExceptionType: message"; the type may be
        # dotted (module-qualified) so compare the short name.
        exc_type = last.split(":", 1)[0].strip().split(".")[-1]

        if exc_type in _PROGRAMMING_ERROR_NAMES:
            pytest.fail(
                label + " python block #" + str(i)
                + " raised a programming error: " + last + _NL + _NL
                + "--- rewritten source ---" + _NL + source
                + _NL + _NL + "--- stderr ---" + _NL + stderr
            )
        # else: domain-level SDK error (e.g. unseeded id) — tolerated.

    return executed


def test_readme_python_blocks_execute():
    executed = _execute_blocks(_python_blocks(), "root README")
    assert executed > 0, "expected at least one client-constructing python block to execute"


def test_reference_python_blocks_execute():
    executed = _execute_blocks(_reference_blocks(), "py REFERENCE.md")
    assert executed > 0, (
        "expected at least one client-constructing python block in py/REFERENCE.md to execute"
    )


def test_local_readme_has_python_blocks():
    assert len(_local_readme_blocks()) > 0, (
        "expected at least one python block in py/README.md"
    )


def test_local_readme_python_blocks_compile():
    # Syntax gate for the per-language py/README.md — the tutorial, how-to,
    # error-handling, testing and entity-op examples that no other test
    # compiled until now.
    for i, block in enumerate(_local_readme_blocks()):
        try:
            ast.parse(block)
            compile(block, "<local-readme-block-" + str(i) + ">", "exec")
        except SyntaxError as err:
            pytest.fail(
                "py/README.md python block #" + str(i)
                + " is not valid Python: " + str(err) + _NL + _NL + block
            )


def test_local_readme_python_blocks_execute():
    # Runtime gate for py/README.md. Blocks that build a client run in seeded
    # test mode; blocks that only drive an earlier snippet's "client" get a
    # seeded test client injected (inject_client=True) so they run too. A
    # programming error (e.g. result["err"] KeyError on a direct() envelope
    # with no err key) fails; a not-found domain error is tolerated.
    executed = _execute_blocks(_local_readme_blocks(), "py README.md", inject_client=True)
    assert executed > 0, (
        "expected at least one python block in py/README.md to execute"
    )
`)
  })
})


export {
  ReadmeExamplesTest
}
