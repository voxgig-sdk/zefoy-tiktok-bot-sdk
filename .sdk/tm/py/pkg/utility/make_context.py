# ZefoyTiktokBot SDK utility: make_context

from projectname_sdk.core.context import ZefoyTiktokBotContext


def make_context_util(ctxmap, basectx):
    return ZefoyTiktokBotContext(ctxmap, basectx)
