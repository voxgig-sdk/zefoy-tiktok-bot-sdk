# ProjectName SDK exists test

import pytest
from zefoytiktokbot_sdk import ZefoyTiktokBotSDK


class TestExists:

    def test_should_create_test_sdk(self):
        testsdk = ZefoyTiktokBotSDK.test(None, None)
        assert testsdk is not None
