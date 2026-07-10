
import { cmp, each, File, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// Emits py/test/test_readme_examples.py — a pytest COMPLETENESS GATE over
// every ```python fenced block in the repository ROOT README.md, in the
// per-language py/README.md, AND in the per-language py/REFERENCE.md.
//
// The gate GUARANTEES every documented python example is unit-tested. For each
// of the three docs it:
//   1. extracts every ```python block (tagged by source doc + index);
//   2. ast.parse + compile()s EVERY block                 -> SYNTAX gate;
//   3. EXECUTEs every RUNNABLE block (one that constructs the SDK, or drives a
//      `client`/`sdk` the narrative built earlier) in a seeded, offline
//      TEST-mode subprocess. A PROGRAMMING error
//      (Name/Attribute/Type/Key/Index/Import/Syntax) FAILS; ONLY a
//      not-found/404 domain error is tolerated. Any other error also FAILS;
//   4. asserts COMPLETENESS: it partitions every block into exactly one of
//      {executed, compiled-nonrunnable, illustration} and asserts
//      total == executed + compiled + illustration. "illustration" is a NARROW
//      explicit class (a non-runnable block that is only imports / signature
//      stubs / bare references / literal assignments — a pure signature/table
//      snippet) and can NEVER absorb a runnable example. A block that looks
//      runnable (references the SDK/client) but was not executed FAILS the
//      test; a block that fails to compile FAILS the test. A per-doc summary
//      (total/executed/compiled/illustration) is printed.
//
// If mypy is importable it also type-checks the concatenated ROOT README blocks
// (the SDK ships py.typed + TypedDicts) — a bonus TYPE gate over the primary
// EXECUTE gate.
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
    Content(`# ${Name} SDK — documentation python-examples COMPLETENESS gate.
#
# GUARANTEE: every python example in the docs is unit-tested. This module is a
# completeness gate over every python fenced code block in three documents:
#   - the repository ROOT README.md (one directory above the py/ package),
#   - the per-language py/README.md (tutorial, how-to, error-handling,
#     testing and entity-op examples — in the package root),
#   - the per-language py/REFERENCE.md (in the package root).
# It exists to keep the documented examples honest as the generator evolves:
# no runnable example may be silently skipped, and no block may be dropped.
#
# Checks, in order, PER DOCUMENT:
#
#   1. COMPILE: every python block is parsed with ast.parse + compile(). This
#      catches syntax errors in the docs (e.g. a dict key with no value, or a
#      hyphenated import module name that is not valid Python).
#
#   2. EXECUTE (the primary safety net): every RUNNABLE block is run offline in
#      a seeded TEST-mode subprocess. A block is RUNNABLE when it constructs the
#      SDK (mentions ${sdkClass}) OR drives a client/sdk variable the narrative
#      built earlier ("client." / "sdk."). A constructing block is rewritten so
#      both ${sdkClass}(...) and ${sdkClass}.test(...) become
#      ${sdkClass}.test({"entity": {...}}) seeding one mock record (id "test01")
#      per referenced entity; a client-driving block gets that seeded test
#      client injected first, then runs verbatim. Any PROGRAMMING error
#      (NameError / AttributeError / TypeError / KeyError / IndexError /
#      ImportError / SyntaxError / IndentationError) FAILS the test. ONLY a
#      not-found / 404 domain error is tolerated (it proves the snippet is
#      structurally valid Python that drives the SDK against an unseeded id).
#      Any other runtime error also FAILS. This surfaces real bugs — a snippet
#      calling a method that does not exist raises AttributeError; indexing
#      result["err"] on a direct() envelope with no err key raises KeyError.
#
#   3. COMPLETENESS: every block is partitioned into exactly one of
#      {executed, compiled-nonrunnable, illustration} and the test asserts
#      total == executed + compiled + illustration. "illustration" is a NARROW
#      explicit class — a non-runnable block whose every top-level statement is
#      an import, a signature stub, a bare reference, or a literal assignment (a
#      pure signature/table snippet). It can never absorb a runnable example: a
#      block that references the SDK/client is classified RUNNABLE first and
#      MUST execute. If a runnable block is not executed, the test FAILS. A
#      per-doc summary line (total/executed/compiled/illustration) is printed.
#
#   4. TYPECHECK (only if mypy is importable): the ROOT README blocks are
#      concatenated and type-checked with mypy as a bonus gate over the primary
#      EXECUTE gate. Only errors mypy attributes to the snippet file fail;
#      import-resolution noise is inconclusive.

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

# The variable names the generated narrative examples bind the client to. A doc
# reads as a sequence: an early snippet builds the client, later snippets drive
# it. A block that uses "client." or "sdk." without building one gets a seeded
# test client injected under those names so it runs standalone.
_CLIENT_VARS = ("client", "sdk")

# The API's capitalised semantic entities -> lowercase fixture key.
_ENTITIES = ${entitiesLiteral}

# The three documents held to the gate, tagged by human label.
_DOCS = (
    ("root README", _README),
    ("py README.md", _LOCAL_README),
    ("py REFERENCE.md", _REFERENCE),
)


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


# ----------------------------------------------------------------------------
# Presence + COMPILE (syntax) gate
# ----------------------------------------------------------------------------

def test_readme_has_python_blocks():
    assert len(_python_blocks()) > 0, "expected at least one python block in the root README"


def test_reference_has_python_blocks():
    assert len(_reference_blocks()) > 0, "expected at least one python block in py/REFERENCE.md"


def test_local_readme_has_python_blocks():
    assert len(_local_readme_blocks()) > 0, "expected at least one python block in py/README.md"


def _assert_blocks_compile(blocks, label):
    # Syntax gate: every documented python block must parse and compile. Catches
    # a bad constructor import such as a hyphenated module name
    # ("from my-slug_sdk import ...") which is a Python SyntaxError.
    for i, block in enumerate(blocks):
        try:
            ast.parse(block)
            compile(block, "<" + label + "-block-" + str(i) + ">", "exec")
        except SyntaxError as err:
            pytest.fail(
                label + " python block #" + str(i)
                + " is not valid Python: " + str(err) + _NL + _NL + block
            )


def test_readme_python_blocks_compile():
    _assert_blocks_compile(_python_blocks(), "root README")


def test_reference_python_blocks_compile():
    _assert_blocks_compile(_reference_blocks(), "py REFERENCE.md")


def test_local_readme_python_blocks_compile():
    _assert_blocks_compile(_local_readme_blocks(), "py README.md")


# ----------------------------------------------------------------------------
# TYPECHECK (bonus, root README only, if mypy is importable)
# ----------------------------------------------------------------------------

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


# ----------------------------------------------------------------------------
# Classification: runnable / illustration / compiled-nonrunnable
# ----------------------------------------------------------------------------

def _uses_var(block, var):
    # True if the block reads an attribute off the whole-word variable "var"
    # (i.e. contains "var." with a non-identifier char, or nothing, before it).
    # This distinguishes a client-driving "sdk." from the "_sdk." tail of an
    # import module name.
    needle = var + "."
    start = 0
    while True:
        j = block.find(needle, start)
        if j < 0:
            return False
        ok_before = True
        if j > 0:
            ch = block[j - 1]
            if ch.isalnum() or ch == "_":
                ok_before = False
        if ok_before:
            return True
        start = j + 1


def _is_runnable(block):
    # A block is RUNNABLE — and therefore MUST be executed — when it constructs
    # the SDK (mentions the class) or drives a client/sdk the narrative built.
    if _SDK_CLASS in block:
        return True
    for var in _CLIENT_VARS:
        if _uses_var(block, var):
            return True
    return False


def _is_literalish(value):
    # A right-hand side that performs no function call (a literal, name, or
    # collection display). Keeps the "illustration" class narrow.
    for sub in ast.walk(value):
        if isinstance(sub, ast.Call):
            return False
    return True


def _is_illustration_node(node):
    # A single "shape only" statement: an import, a bare reference/literal
    # (not a call), a signature stub (def/class whose body is only pass /
    # docstring / ...), or a literal assignment.
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        return True
    if isinstance(node, ast.Expr):
        return not isinstance(node.value, ast.Call)
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        for b in node.body:
            if isinstance(b, ast.Pass):
                continue
            if isinstance(b, ast.Expr) and isinstance(b.value, ast.Constant):
                continue
            return False
        return True
    if isinstance(node, ast.AnnAssign):
        return node.value is None or _is_literalish(node.value)
    if isinstance(node, ast.Assign):
        return _is_literalish(node.value)
    return False


def _is_illustration(block):
    # NARROW, explicit: a non-runnable block whose every top-level statement is
    # a benign "shape" node — an import, a bare reference/literal, a signature
    # stub, or a literal assignment (a pure signature/table snippet). Anything
    # that does work (a call, a loop, a with/try) is NOT an illustration; it
    # falls to the compiled-nonrunnable bucket. A runnable block (references the
    # SDK/client) is never an illustration, so this class can never silently
    # absorb a runnable example.
    if _is_runnable(block):
        return False
    try:
        tree = ast.parse(block)
    except SyntaxError:
        return False
    if not tree.body:
        return True
    for node in tree.body:
        if not _is_illustration_node(node):
            return False
    return True


def _classify(block):
    if _is_runnable(block):
        return "runnable"
    if _is_illustration(block):
        return "illustration"
    return "compiled"


# ----------------------------------------------------------------------------
# EXECUTE gate
# ----------------------------------------------------------------------------

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


def _build_exec_source(block):
    # Return runnable python source for a RUNNABLE block, else None. A block
    # that constructs the SDK is rewritten into seeded test mode; a block that
    # only drives a client/sdk gets a seeded test client injected under those
    # names first, then runs verbatim. The set of blocks for which this returns
    # a source is exactly the set _is_runnable() flags — the completeness gate
    # asserts that, so no runnable block is ever silently skipped.
    preamble = "import os" + _NL + "from " + _SDK_MODULE + " import " + _SDK_CLASS + _NL
    if _SDK_CLASS in block:
        return preamble + _rewrite_to_test_mode(block)
    inject = ""
    used = False
    seed = repr(_seed_literal(block))
    for var in _CLIENT_VARS:
        if _uses_var(block, var):
            inject += var + " = " + _SDK_CLASS + ".test(" + seed + ")" + _NL
            used = True
    if used:
        return preamble + inject + block
    return None


def _is_not_found_error(last):
    # The ONLY tolerated domain error: a not-found / 404 raised because a
    # referenced id was not seeded. Detected by the SDK error message text.
    low = last.lower()
    return ("404" in last) or ("not found" in low) or ("notfound" in low)


def _run_source(source, label, index):
    # Run one rewritten block in a subprocess. Returns None when it exits 0 or
    # fails with the single tolerated not-found/404 domain error; otherwise
    # returns a failure message (a programming error, or any other runtime
    # error — both fail the gate).
    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONPATH"] = _PY_ROOT + os.pathsep + env.get("PYTHONPATH", "")

    proc = subprocess.run(
        [sys.executable, "-c", source],
        cwd=_PY_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    if proc.returncode == 0:
        return None

    stderr = proc.stderr or ""
    errlines = [ln for ln in stderr.split(_NL) if ln.strip()]
    last = errlines[-1] if errlines else ""
    # Traceback's final line is "ExceptionType: message"; the type may be
    # dotted (module-qualified) so compare the short name.
    exc_type = last.split(":", 1)[0].strip().split(".")[-1]

    detail = (
        label + " python block #" + str(index) + ": " + last + _NL + _NL
        + "--- executed source ---" + _NL + source
        + _NL + _NL + "--- stderr ---" + _NL + stderr
    )

    if exc_type in _PROGRAMMING_ERROR_NAMES:
        return "PROGRAMMING ERROR in " + detail
    if _is_not_found_error(last):
        return None   # tolerated domain error
    return "UNEXPECTED (non not-found/404) ERROR in " + detail


# ----------------------------------------------------------------------------
# COMPLETENESS gate (the guarantee)
# ----------------------------------------------------------------------------

def _completeness_gate(label, blocks):
    # Partition every block, execute every runnable one, and assert the
    # partition is complete. Returns the per-doc stats dict.
    total = len(blocks)
    executed = 0
    runnable = 0
    illustration = 0
    compiled = 0
    failures = []

    for i, block in enumerate(blocks):
        kind = _classify(block)
        if kind == "runnable":
            runnable += 1
            source = _build_exec_source(block)
            if source is None:
                # Should be impossible: _is_runnable and _build_exec_source key
                # off the same markers. If it ever happens a runnable example
                # would be silently skipped — fail loudly.
                failures.append(
                    label + " python block #" + str(i) + " is runnable-looking "
                    "(references the SDK/client) but produced no executable "
                    "source; it would be silently skipped:" + _NL + _NL + block
                )
                continue
            executed += 1
            msg = _run_source(source, label, i)
            if msg is not None:
                failures.append(msg)
        elif kind == "illustration":
            illustration += 1
        else:
            compiled += 1

    print(
        _NL + "[readme-examples] " + label + " python blocks: total="
        + str(total) + " executed=" + str(executed) + " compiled="
        + str(compiled) + " illustration=" + str(illustration)
    )

    if failures:
        pytest.fail(
            label + ": " + str(len(failures))
            + " documented python example(s) failed the completeness gate:"
            + _NL + _NL + (_NL + _NL).join(failures)
        )

    # Every runnable (SDK/client-referencing) block MUST have executed.
    assert executed == runnable, (
        label + ": " + str(runnable - executed) + " runnable python block(s) "
        "were not executed — a documented example that drives the SDK/client "
        "must run, never be silently skipped (executed=" + str(executed)
        + ", runnable=" + str(runnable) + ")"
    )
    # Every block is accounted for by exactly one bucket.
    assert total == executed + compiled + illustration, (
        label + ": python-block accounting does not add up — total=" + str(total)
        + " but executed+compiled+illustration="
        + str(executed + compiled + illustration)
        + ". Every block must be executed, compiled-nonrunnable, or a narrow "
        "illustration; none may be dropped."
    )
    return {
        "total": total,
        "executed": executed,
        "compiled": compiled,
        "illustration": illustration,
    }


def test_readme_completeness_gate():
    stats = _completeness_gate("root README", _python_blocks())
    assert stats["executed"] > 0, (
        "expected at least one runnable python block in the root README to execute"
    )


def test_local_readme_completeness_gate():
    stats = _completeness_gate("py README.md", _local_readme_blocks())
    assert stats["executed"] > 0, (
        "expected at least one runnable python block in py/README.md to execute"
    )


def test_reference_completeness_gate():
    stats = _completeness_gate("py REFERENCE.md", _reference_blocks())
    assert stats["executed"] > 0, (
        "expected at least one runnable python block in py/REFERENCE.md to execute"
    )
`)
  })
})


export {
  ReadmeExamplesTest
}
