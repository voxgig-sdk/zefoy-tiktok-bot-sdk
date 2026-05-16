# ZefoyTiktokBot SDK utility type

from __future__ import annotations


class ZefoyTiktokBotUtility:
    _registrar = None

    def __init__(self):
        self.custom = {}

        # All utility functions are set by the register module
        self.clean = None
        self.done = None
        self.make_error = None
        self.feature_add = None
        self.feature_hook = None
        self.feature_init = None
        self.fetcher = None
        self.make_fetch_def = None
        self.make_context = None
        self.make_options = None
        self.make_request = None
        self.make_response = None
        self.make_result = None
        self.make_point = None
        self.make_spec = None
        self.make_url = None
        self.param = None
        self.prepare_auth = None
        self.prepare_body = None
        self.prepare_headers = None
        self.prepare_method = None
        self.prepare_params = None
        self.prepare_path = None
        self.prepare_query = None
        self.result_basic = None
        self.result_body = None
        self.result_headers = None
        self.transform_request = None
        self.transform_response = None

        # Let the registrar fill in all functions
        if ZefoyTiktokBotUtility._registrar is not None:
            ZefoyTiktokBotUtility._registrar(self)

    @classmethod
    def copy(cls, src):
        u = cls()
        u.clean = src.clean
        u.done = src.done
        u.make_error = src.make_error
        u.feature_add = src.feature_add
        u.feature_hook = src.feature_hook
        u.feature_init = src.feature_init
        u.fetcher = src.fetcher
        u.make_fetch_def = src.make_fetch_def
        u.make_context = src.make_context
        u.make_options = src.make_options
        u.make_request = src.make_request
        u.make_response = src.make_response
        u.make_result = src.make_result
        u.make_point = src.make_point
        u.make_spec = src.make_spec
        u.make_url = src.make_url
        u.param = src.param
        u.prepare_auth = src.prepare_auth
        u.prepare_body = src.prepare_body
        u.prepare_headers = src.prepare_headers
        u.prepare_method = src.prepare_method
        u.prepare_params = src.prepare_params
        u.prepare_path = src.prepare_path
        u.prepare_query = src.prepare_query
        u.result_basic = src.result_basic
        u.result_body = src.result_body
        u.result_headers = src.result_headers
        u.transform_request = src.transform_request
        u.transform_response = src.transform_response
        u.custom = {}
        for k, v in src.custom.items():
            u.custom[k] = v
        return u
