<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility type

class ZefoyTiktokBotUtility
{
    public mixed $clean = null;
    public mixed $done = null;
    public mixed $make_error = null;
    public mixed $feature_add = null;
    public mixed $feature_hook = null;
    public mixed $feature_init = null;
    public mixed $fetcher = null;
    public mixed $make_fetch_def = null;
    public mixed $make_context = null;
    public mixed $make_options = null;
    public mixed $make_request = null;
    public mixed $make_response = null;
    public mixed $make_result = null;
    public mixed $make_point = null;
    public mixed $make_spec = null;
    public mixed $make_url = null;
    public mixed $param = null;
    public mixed $prepare_auth = null;
    public mixed $prepare_body = null;
    public mixed $prepare_headers = null;
    public mixed $prepare_method = null;
    public mixed $prepare_params = null;
    public mixed $prepare_path = null;
    public mixed $prepare_query = null;
    public mixed $graphql_body = null;
    public mixed $graphql_errors = null;
    public mixed $result_basic = null;
    public mixed $result_body = null;
    public mixed $result_headers = null;
    public mixed $transform_request = null;
    public mixed $transform_response = null;
    public array $custom = [];

    private static mixed $registrar = null;

    public static function setRegistrar(callable $r): void
    {
        self::$registrar = $r;
    }

    public function __construct()
    {
        $this->custom = [];
        if (self::$registrar !== null) {
            (self::$registrar)($this);
        }
    }

    public static function copy(ZefoyTiktokBotUtility $src): ZefoyTiktokBotUtility
    {
        $u = new ZefoyTiktokBotUtility();
        $u->clean = $src->clean;
        $u->done = $src->done;
        $u->make_error = $src->make_error;
        $u->feature_add = $src->feature_add;
        $u->feature_hook = $src->feature_hook;
        $u->feature_init = $src->feature_init;
        $u->fetcher = $src->fetcher;
        $u->make_fetch_def = $src->make_fetch_def;
        $u->make_context = $src->make_context;
        $u->make_options = $src->make_options;
        $u->make_request = $src->make_request;
        $u->make_response = $src->make_response;
        $u->make_result = $src->make_result;
        $u->make_point = $src->make_point;
        $u->make_spec = $src->make_spec;
        $u->make_url = $src->make_url;
        $u->param = $src->param;
        $u->prepare_auth = $src->prepare_auth;
        $u->prepare_body = $src->prepare_body;
        $u->prepare_headers = $src->prepare_headers;
        $u->prepare_method = $src->prepare_method;
        $u->prepare_params = $src->prepare_params;
        $u->prepare_path = $src->prepare_path;
        $u->prepare_query = $src->prepare_query;
        $u->result_basic = $src->result_basic;
        $u->result_body = $src->result_body;
        $u->result_headers = $src->result_headers;
        $u->transform_request = $src->transform_request;
        $u->transform_response = $src->transform_response;
        $u->custom = $src->custom;
        return $u;
    }
}
