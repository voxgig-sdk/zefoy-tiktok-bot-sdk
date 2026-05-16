<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility registration

require_once __DIR__ . '/../core/UtilityType.php';
require_once __DIR__ . '/Clean.php';
require_once __DIR__ . '/Done.php';
require_once __DIR__ . '/MakeError.php';
require_once __DIR__ . '/FeatureAdd.php';
require_once __DIR__ . '/FeatureHook.php';
require_once __DIR__ . '/FeatureInit.php';
require_once __DIR__ . '/Fetcher.php';
require_once __DIR__ . '/MakeFetchDef.php';
require_once __DIR__ . '/MakeContext.php';
require_once __DIR__ . '/MakeOptions.php';
require_once __DIR__ . '/MakeRequest.php';
require_once __DIR__ . '/MakeResponse.php';
require_once __DIR__ . '/MakeResult.php';
require_once __DIR__ . '/MakePoint.php';
require_once __DIR__ . '/MakeSpec.php';
require_once __DIR__ . '/MakeUrl.php';
require_once __DIR__ . '/Param.php';
require_once __DIR__ . '/PrepareAuth.php';
require_once __DIR__ . '/PrepareBody.php';
require_once __DIR__ . '/PrepareHeaders.php';
require_once __DIR__ . '/PrepareMethod.php';
require_once __DIR__ . '/PrepareParams.php';
require_once __DIR__ . '/PreparePath.php';
require_once __DIR__ . '/PrepareQuery.php';
require_once __DIR__ . '/ResultBasic.php';
require_once __DIR__ . '/ResultBody.php';
require_once __DIR__ . '/ResultHeaders.php';
require_once __DIR__ . '/TransformRequest.php';
require_once __DIR__ . '/TransformResponse.php';

ZefoyTiktokBotUtility::setRegistrar(function (ZefoyTiktokBotUtility $u): void {
    $u->clean = [ZefoyTiktokBotClean::class, 'call'];
    $u->done = [ZefoyTiktokBotDone::class, 'call'];
    $u->make_error = [ZefoyTiktokBotMakeError::class, 'call'];
    $u->feature_add = [ZefoyTiktokBotFeatureAdd::class, 'call'];
    $u->feature_hook = [ZefoyTiktokBotFeatureHook::class, 'call'];
    $u->feature_init = [ZefoyTiktokBotFeatureInit::class, 'call'];
    $u->fetcher = [ZefoyTiktokBotFetcher::class, 'call'];
    $u->make_fetch_def = [ZefoyTiktokBotMakeFetchDef::class, 'call'];
    $u->make_context = [ZefoyTiktokBotMakeContext::class, 'call'];
    $u->make_options = [ZefoyTiktokBotMakeOptions::class, 'call'];
    $u->make_request = [ZefoyTiktokBotMakeRequest::class, 'call'];
    $u->make_response = [ZefoyTiktokBotMakeResponse::class, 'call'];
    $u->make_result = [ZefoyTiktokBotMakeResult::class, 'call'];
    $u->make_point = [ZefoyTiktokBotMakePoint::class, 'call'];
    $u->make_spec = [ZefoyTiktokBotMakeSpec::class, 'call'];
    $u->make_url = [ZefoyTiktokBotMakeUrl::class, 'call'];
    $u->param = [ZefoyTiktokBotParam::class, 'call'];
    $u->prepare_auth = [ZefoyTiktokBotPrepareAuth::class, 'call'];
    $u->prepare_body = [ZefoyTiktokBotPrepareBody::class, 'call'];
    $u->prepare_headers = [ZefoyTiktokBotPrepareHeaders::class, 'call'];
    $u->prepare_method = [ZefoyTiktokBotPrepareMethod::class, 'call'];
    $u->prepare_params = [ZefoyTiktokBotPrepareParams::class, 'call'];
    $u->prepare_path = [ZefoyTiktokBotPreparePath::class, 'call'];
    $u->prepare_query = [ZefoyTiktokBotPrepareQuery::class, 'call'];
    $u->result_basic = [ZefoyTiktokBotResultBasic::class, 'call'];
    $u->result_body = [ZefoyTiktokBotResultBody::class, 'call'];
    $u->result_headers = [ZefoyTiktokBotResultHeaders::class, 'call'];
    $u->transform_request = [ZefoyTiktokBotTransformRequest::class, 'call'];
    $u->transform_response = [ZefoyTiktokBotTransformResponse::class, 'call'];
});
