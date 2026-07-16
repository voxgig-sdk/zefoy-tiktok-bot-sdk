# ZefoyTiktokBot SDK rbac feature

from __future__ import annotations

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Client-side role/permission enforcement. Before an operation resolves its
# endpoint, the required permission for that entity+operation is checked
# against the permissions the client holds; a disallowed call is
# short-circuited with an `rbac_denied` error placed in ctx.out["point"]
# (the pipeline's make_point surfaces it) and never touches the network.
# Required permissions come from `rules` (keyed by `<entity>.<op>`, `<op>`,
# or `*`); the default when no rule matches is controlled by `deny`
# (default: allow when unspecified). Held permissions are the `permissions`
# list (a `*` grants everything).
class ZefoyTiktokBotRbacFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "rbac"
        self.active = True
        self.client = None
        self.options = {}
        self.granted = {}

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        self.granted = {}
        perms = self.options.get("permissions") or []
        for perm in perms:
            self.granted[perm] = True

    def PrePoint(self, ctx):
        if not self.active:
            return

        required = self._required(ctx)
        if required is None:
            # No rule: honour the default policy.
            if self.options.get("deny") is True:
                return self._reject(ctx, "<default-deny>")
            return

        if self.granted.get("*") is True or self.granted.get(required) is True:
            self._track(ctx, required, True)
            return

        return self._reject(ctx, required)

    def _required(self, ctx):
        rules = self.options.get("rules") or {}

        entity = ""
        ent = ctx.entity
        if ent is not None and hasattr(ent, "get_name") and callable(ent.get_name):
            entity = ent.get_name()
        if entity == "" and ctx.op is not None and isinstance(ctx.op.entity, str):
            entity = ctx.op.entity

        opname = ""
        if ctx.op is not None and isinstance(ctx.op.name, str):
            opname = ctx.op.name

        if rules.get(entity + "." + opname) is not None:
            return rules[entity + "." + opname]
        if rules.get(opname) is not None:
            return rules[opname]
        if rules.get("*") is not None:
            return rules["*"]
        return None

    def _reject(self, ctx, required):
        self._track(ctx, required, False)
        opname = "?"
        if ctx.op is not None and isinstance(ctx.op.name, str) and ctx.op.name != "":
            opname = ctx.op.name
        err = ctx.make_error("rbac_denied",
            'Permission "' + required + '" required for operation "' + opname + '"')
        # Short-circuit endpoint resolution; the pipeline surfaces this error.
        ctx.out["point"] = err
        return err

    def _track(self, ctx, required, allowed):
        client = self.client
        track = getattr(client, "_rbac", None)
        if track is None:
            track = {"allowed": 0, "denied": 0, "last": None}
            client._rbac = track
        track["allowed" if allowed else "denied"] += 1
        track["last"] = {
            "required": required,
            "allowed": allowed,
            "op": ctx.op.name if ctx.op is not None else None,
        }
