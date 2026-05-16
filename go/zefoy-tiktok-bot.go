package voxgigzefoytiktokbotsdk

import (
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/core"
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/entity"
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/feature"
	_ "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/utility"
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
var NewBaseFeature = feature.NewBaseFeature
var NewTestFeature = feature.NewTestFeature
