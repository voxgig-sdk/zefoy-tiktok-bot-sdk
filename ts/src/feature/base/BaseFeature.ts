import type { Feature, Context, FeatureOptions } from '../../types'




class BaseFeature implements Feature {
  version = '0.0.1'
  name = 'base'
  active = true


  init(_ctx: Context, _options: FeatureOptions): void | Promise<any> { }


  PostConstruct(this: any, _ctx: any) { }

  PostConstructEntity(this: any, _ctx: any) { }


  SetData(this: any, _ctx: any) { }

  GetData(this: any, _ctx: any) { }

  SetMatch(this: any, _ctx: any) { }

  GetMatch(this: any, _ctx: any) { }


  PrePoint(this: any, _ctx: any) { }

  PreSpec(this: any, _ctx: any) { }

  PreRequest(this: any, _ctx: any) { }

  PreResponse(this: any, _ctx: any) { }

  PreResult(this: any, _ctx: any) { }

  PreDone(this: any, _ctx: any) { }

  PreUnexpected(this: any, _ctx: any) { }

}


export {
  BaseFeature
}
