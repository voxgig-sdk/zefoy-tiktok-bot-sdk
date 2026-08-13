# ZefoyTiktokBot SDK helpers


def to_map(v):
    return v if isinstance(v, dict) else None


def to_int(v):
    return int(v) if isinstance(v, (int, float)) else -1


def get_ctx_prop(m, key):
    if m is None:
        return None
    return m.get(key) if isinstance(m, dict) else None
