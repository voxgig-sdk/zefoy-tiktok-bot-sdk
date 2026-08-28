# ZefoyTiktokBot SDK feature corpus test
#
# Feature behaviour, driven by the SHARED corpus.
#
# The same route test_primary_utility.py takes for the utilities:
# language-neutral cases in .sdk/test/test.json, executed against THIS
# generated SDK. The feature is the ordinary class, built by the generated
# config, installed by the generated constructor, and driven by a real entity
# operation. Not a miniature of the pipeline - that is what feature_harness.py
# does, and a miniature can only be as right as the miniature.
#
# Everything in a case is data. The one piece python writes for itself is
# turning scripted responses into a fetcher, through the documented
# `utility.fetcher` override.

import json
import os
import re

import pytest

from projectname_sdk import ZefoyTiktokBotSDK

_TEST_DIR = os.path.dirname(os.path.abspath(__file__))

# Features with a corpus section — read from the corpus itself, so a
# project-authored section (a custom feature added under
# .sdk/test/feature/) runs without editing this file. Read eagerly:
# parametrize needs the names at collection time. An SDK generated
# without a listed feature still skips, not fails.
def _corpus_feature_names():
    try:
        with open(os.path.join(_TEST_DIR, "../../.sdk/test/test.json"), "r") as f:
            return sorted((json.loads(f.read()).get("feature") or {}).keys())
    except OSError:
        return []


FEATURE_CORPUS_NAMES = _corpus_feature_names()

# The standard operation names, in the order the runner prefers them.
FEATURE_CORPUS_OPS = ["load", "list", "create", "update", "remove"]


def _load_corpus():
    with open(os.path.join(_TEST_DIR, "../../.sdk/test/test.json"), "r") as f:
        return json.loads(f.read())


def _scripted_fetcher(res):
    """A scripted transport built from a case's `res` list.

    Responses are consumed in order and the last one repeats, so a case that
    does not care how many attempts happen need only declare one.
    """
    state = {"n": -1}

    def fetcher(ctx, fullurl, fetchdef):
        state["n"] += 1
        spec = {}
        if res:
            i = state["n"]
            if i >= len(res):
                i = len(res) - 1
            spec = res[i] or {}

        status = spec.get("status")
        status = 200 if status is None else int(status)
        body = spec.get("body")
        body = {} if body is None else body

        # The shape the real fetcher returns: a (response, err) PAIR, with the
        # parsed body behind a `json` thunk and `body` as the raw string. A
        # bare dict here unpacks as "too many values", and a script that only
        # set `body` would look like an empty result - either reads as a
        # feature defect rather than a mis-shaped script.
        if spec.get("throw") is True:
            return None, RuntimeError("scripted transport failure")

        return {
            "status": status,
            "statusText": "OK" if status < 400 else "ERR",
            "headers": dict(spec.get("headers") or {}),
            "json": (lambda: body),
            "body": json.dumps(body),
        }, None

    return fetcher


def _client(kase):
    """Build a client the way a caller would.

    ZefoyTiktokBotSDK(...), not ZefoyTiktokBotSDK.test(...): the `test` feature is
    transport: 'base' and REPLACES the transport, so a client in test mode
    would shadow the script.
    """
    opts = {"utility": {"fetcher": _scripted_fetcher(kase.get("res"))}}
    if kase.get("feature") is not None:
        opts["feature"] = kase["feature"]
    return ZefoyTiktokBotSDK(opts)


def _candidates(client):
    """Every operation this SDK declares, in a stable order.

    The corpus cannot name an entity - it is shared by SDKs with none in
    common - so the runner finds them here. An entity accessor is a
    capitalised, single-optional-argument client method whose result answers
    get_name().
    """
    found = {}
    for attr in dir(client):
        if not attr[:1].isupper():
            continue
        acc = getattr(client, attr, None)
        if not callable(acc):
            continue
        try:
            ent = acc()
        except Exception:
            continue
        getname = getattr(ent, "get_name", None)
        if not callable(getname):
            continue
        try:
            name = getname()
        except Exception:
            continue
        if isinstance(name, str) and name != "":
            found[name] = (attr, ent)

    out = []
    for name in sorted(found):
        accessor, ent = found[name]
        for opname in FEATURE_CORPUS_OPS:
            if callable(getattr(ent, opname, None)):
                out.append({
                    "key": name + "." + opname,
                    "accessor": accessor,
                    "op": opname,
                })

    # SAFE OPS FIRST - see the ts harness for the reasoning: the cache stores
    # only successful GETs, so an SDK whose first usable op is a `create`
    # (POST) can never satisfy "a hit served from cache costs nothing".
    safe = {"list": 0, "load": 1}
    out.sort(key=lambda o: (safe.get(o["op"], 2), o["key"]))
    return out


def _invoke(client, op, ctrl):
    ent = getattr(client, op["accessor"])()
    return getattr(ent, op["op"])({}, ctrl)


def _usable_ops(want):
    """Pick operations by DRIVING them.

    An op is usable when it completes against a plain 200 with no feature
    active. Declared operations are not all callable with no arguments (a
    required path parameter, a body), and a case failing for that reason
    would read as a feature defect.
    """
    picked = []
    for cand in _candidates(_client({})):
        try:
            _invoke(_client({}), cand, {})
        except Exception:
            continue
        picked.append(cand)
        if len(picked) >= want:
            break
    return picked


def _resolve(node, tokens):
    """Replace #OPn throughout a case, keys included."""
    if isinstance(node, str):
        out = node
        for tok, val in tokens.items():
            out = out.replace(tok, val)
        return out
    if isinstance(node, list):
        return [_resolve(n, tokens) for n in node]
    if isinstance(node, dict):
        return {_resolve(k, tokens): _resolve(v, tokens) for k, v in node.items()}
    return node


def _tokens_used(kase):
    """The highest #OPn a case mentions."""
    found = re.findall(r"#OP(\d+)", json.dumps(kase))
    return max([int(n) for n in found], default=0)


def _member(actual, key):
    if actual is None:
        return (None, False)
    if isinstance(actual, dict):
        if key in actual:
            return (actual[key], True)
        return (None, False)
    if hasattr(actual, key):
        return (getattr(actual, key), True)
    return (None, False)


def _subset(actual, expect, path):
    """Assert that `actual` contains `expect`, recursively.

    Cases assert only the fields they are about, so a full equality check
    would force every case to restate the whole record.
    """
    if isinstance(expect, dict):
        for k, want in expect.items():
            got, found = _member(actual, k)
            assert found, "{}.{}: no such member".format(path, k)
            _subset(got, want, "{}.{}".format(path, k))
        return

    if isinstance(expect, bool) or not isinstance(expect, (int, float)):
        assert actual == expect, "{}: got {!r}, want {!r}".format(path, actual, expect)
        return

    # Money is float arithmetic; compare with a tolerance far below any
    # amount a case states.
    assert isinstance(actual, (int, float)) and not isinstance(actual, bool), \
        "{}: expected a number, got {!r}".format(path, actual)
    assert abs(float(actual) - float(expect)) < 1e-9, \
        "{}: got {!r}, want {!r}".format(path, actual, expect)


def _record(client, name):
    return getattr(client, "_" + name, None)


class TestFeatureCorpus:

    def test_corpus_carries_a_feature_section(self):
        # A corpus with no `feature` section is a SKIP, not a failure. Each
        # project carries its OWN materialised copy of .sdk/test/test.json, so a
        # project scaffolded before the section existed legitimately has no cases
        # to run - and a hard assertion here turned that into a red suite in every
        # SDK on the fleet, for a corpus the project had simply not re-pulled yet.
        # The strict check belongs where the corpus is CONTROLLED: sdkgen's own
        # end-to-end lane supplies one and requires the cases to actually run.
        if _load_corpus().get("feature") is None:
            pytest.skip("this project's test.json has no `feature` section "
                        "- recompile the corpus (create-sdkgen "
                        ".sdk/test/feature/) to run these cases")

    def test_sdk_has_an_operation_the_corpus_can_drive(self):
        # At least one operation, or every case below would skip and this
        # would report green having run nothing.
        assert len(_usable_ops(2)) > 0, \
            "no declared operation completed against a plain 200 - the " \
            "corpus cannot exercise a feature without one"

    @pytest.mark.parametrize("name", FEATURE_CORPUS_NAMES)
    def test_feature(self, name):
        section = (_load_corpus().get("feature") or {}).get(name)
        if section is None:
            pytest.skip("no corpus section for {}".format(name))

        cases = ((section.get("basic") or {}).get("set")) or []
        assert len(cases) > 0, (
            "corpus section feature.{} ran ZERO cases - a renamed section or "
            "an emptied fixture must fail loudly, not pass silently".format(name))

        # Probed by ACTIVATING it: the feature defaults to inactive, so an
        # idle client never builds it and its absence says nothing.
        probe = _client({"feature": [{"name": name, "active": True}]})
        if _record(probe, name) is None:
            pytest.skip("this SDK was generated without the {} feature".format(name))

        ops = _usable_ops(2)
        by_key = {o["key"]: o for o in ops}

        ran = 0
        for raw in cases:
            need = _tokens_used(raw)
            if need > len(ops):
                continue

            tokens = {}
            for i in range(need):
                tokens["#OP{}".format(i + 1)] = ops[i]["key"]
            kase = _resolve(raw, tokens)

            client = _client(kase)
            label = kase.get("name")

            for step in (kase.get("op") or []):
                op = by_key.get(step["op"])
                assert op is not None, "{}: no operation {}".format(label, step["op"])
                ctrl = step.get("ctrl") or {}
                wanterr = step.get("err")

                try:
                    _invoke(client, op, ctrl)
                    assert wanterr is None, \
                        "{}: {} was expected to fail, and did not".format(label, step["op"])
                except AssertionError:
                    raise
                except Exception as err:
                    assert wanterr is not None, \
                        "{}: {} failed unexpectedly: {}".format(label, step["op"], err)
                    if isinstance(wanterr, str):
                        # The CODE, not the message: makeError prefixes and
                        # humanises the text, so matching it would pass on any
                        # error that happened to mention the word.
                        code = getattr(err, "code", None)
                        assert code == wanterr, \
                            "{}: wrong error code: got {!r} ({}), want {!r}".format(
                                label, code, err, wanterr)

            _subset(_record(client, name), kase.get("out"), "{}: _{}".format(label, name))
            ran += 1

        assert ran > 0, "every feature.{} case was skipped".format(name)
        # Say how many ran. A partial run is legitimate (an SDK with one
        # operation skips the cases needing two) but it should be visible
        # rather than inferred from a green tick.
        print("feature.{}: ran {} of {} case(s) against {} operation(s)".format(
            name, ran, len(cases), len(ops)))
