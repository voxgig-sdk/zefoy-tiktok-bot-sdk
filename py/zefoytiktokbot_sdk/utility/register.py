# ZefoyTiktokBot SDK utility registration

from zefoytiktokbot_sdk.core.utility_type import ZefoyTiktokBotUtility

from zefoytiktokbot_sdk.utility.clean import clean_util
from zefoytiktokbot_sdk.utility.done import done_util
from zefoytiktokbot_sdk.utility.make_error import make_error_util
from zefoytiktokbot_sdk.utility.feature_add import feature_add_util
from zefoytiktokbot_sdk.utility.feature_hook import feature_hook_util
from zefoytiktokbot_sdk.utility.feature_init import feature_init_util
from zefoytiktokbot_sdk.utility.fetcher import fetcher_util
from zefoytiktokbot_sdk.utility.make_fetch_def import make_fetch_def_util
from zefoytiktokbot_sdk.utility.make_context import make_context_util
from zefoytiktokbot_sdk.utility.make_options import make_options_util
from zefoytiktokbot_sdk.utility.make_request import make_request_util
from zefoytiktokbot_sdk.utility.make_response import make_response_util
from zefoytiktokbot_sdk.utility.make_result import make_result_util
from zefoytiktokbot_sdk.utility.make_point import make_point_util
from zefoytiktokbot_sdk.utility.make_spec import make_spec_util
from zefoytiktokbot_sdk.utility.make_url import make_url_util
from zefoytiktokbot_sdk.utility.param import param_util
from zefoytiktokbot_sdk.utility.prepare_auth import prepare_auth_util
from zefoytiktokbot_sdk.utility.prepare_body import prepare_body_util
from zefoytiktokbot_sdk.utility.prepare_headers import prepare_headers_util
from zefoytiktokbot_sdk.utility.prepare_method import prepare_method_util
from zefoytiktokbot_sdk.utility.prepare_params import prepare_params_util
from zefoytiktokbot_sdk.utility.prepare_path import prepare_path_util
from zefoytiktokbot_sdk.utility.prepare_query import prepare_query_util
from zefoytiktokbot_sdk.utility.graphql import graphql_body_util, graphql_errors_util
from zefoytiktokbot_sdk.utility.result_basic import result_basic_util
from zefoytiktokbot_sdk.utility.result_body import result_body_util
from zefoytiktokbot_sdk.utility.result_headers import result_headers_util
from zefoytiktokbot_sdk.utility.transform_request import transform_request_util
from zefoytiktokbot_sdk.utility.transform_response import transform_response_util


def register_all(u):
    u.clean = clean_util
    u.done = done_util
    u.make_error = make_error_util
    u.feature_add = feature_add_util
    u.feature_hook = feature_hook_util
    u.feature_init = feature_init_util
    u.fetcher = fetcher_util
    u.make_fetch_def = make_fetch_def_util
    u.make_context = make_context_util
    u.make_options = make_options_util
    u.make_request = make_request_util
    u.make_response = make_response_util
    u.make_result = make_result_util
    u.make_point = make_point_util
    u.make_spec = make_spec_util
    u.make_url = make_url_util
    u.param = param_util
    u.prepare_auth = prepare_auth_util
    u.prepare_body = prepare_body_util
    u.prepare_headers = prepare_headers_util
    u.prepare_method = prepare_method_util
    u.prepare_params = prepare_params_util
    u.prepare_path = prepare_path_util
    u.prepare_query = prepare_query_util
    u.graphql_body = graphql_body_util
    u.graphql_errors = graphql_errors_util
    u.result_basic = result_basic_util
    u.result_body = result_body_util
    u.result_headers = result_headers_util
    u.transform_request = transform_request_util
    u.transform_response = transform_response_util


ZefoyTiktokBotUtility._registrar = register_all
