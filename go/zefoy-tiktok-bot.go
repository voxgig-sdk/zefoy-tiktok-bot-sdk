package voxgigzefoytiktokbotsdk

import (
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/entity"
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/feature"
	_ "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/utility"
)

// Type aliases preserve external API.
type ZefoyTiktokBotSDK = core.ZefoyTiktokBotSDK
type Context = core.Context
type Utility = core.Utility
type Feature = core.Feature
type Entity = core.Entity
type ZefoyTiktokBotEntity = core.ZefoyTiktokBotEntity
type FetcherFunc = core.FetcherFunc
type Spec = core.Spec
type Result = core.Result
type Response = core.Response
type Operation = core.Operation
type Control = core.Control
type ZefoyTiktokBotError = core.ZefoyTiktokBotError

// BaseFeature from feature package.
type BaseFeature = feature.BaseFeature

func init() {
	core.NewBaseFeatureFunc = func() core.Feature {
		return feature.NewBaseFeature()
	}
	core.NewTestFeatureFunc = func() core.Feature {
		return feature.NewTestFeature()
	}
	core.NewEngagementEntityFunc = func(client *core.ZefoyTiktokBotSDK, entopts map[string]any) core.ZefoyTiktokBotEntity {
		return entity.NewEngagementEntity(client, entopts)
	}
}

// Constructor re-exports.
var NewZefoyTiktokBotSDK = core.NewZefoyTiktokBotSDK
var TestSDK = core.TestSDK
var NewContext = core.NewContext
var NewSpec = core.NewSpec
var NewResult = core.NewResult
var NewResponse = core.NewResponse
var NewOperation = core.NewOperation
var MakeConfig = core.MakeConfig

// No-arg convenience constructors. Go has no default-argument syntax,
// so these aliases let callers write `sdk.New()` / `sdk.Test()`
// instead of `sdk.NewZefoyTiktokBotSDK(nil)` / `sdk.TestSDK(nil, nil)`
// for the common no-options case.
func New() *ZefoyTiktokBotSDK  { return NewZefoyTiktokBotSDK(nil) }
func Test() *ZefoyTiktokBotSDK { return TestSDK(nil, nil) }
var NewBaseFeature = feature.NewBaseFeature
var NewTestFeature = feature.NewTestFeature
