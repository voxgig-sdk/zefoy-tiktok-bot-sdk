# ZefoyTiktokBot SDK feature factory

from zefoytiktokbot_sdk.feature.base_feature import ZefoyTiktokBotBaseFeature
from zefoytiktokbot_sdk.feature.test_feature import ZefoyTiktokBotTestFeature


def _make_feature(name):
    features = {
        "base": lambda: ZefoyTiktokBotBaseFeature(),
        "test": lambda: ZefoyTiktokBotTestFeature(),
    }
    factory = features.get(name)
    if factory is not None:
        return factory()
    return features["base"]()
