
import { ZefoyTiktokBotEntityBase } from './ZefoyTiktokBotEntityBase'

import { Point } from './Point'
import { Context } from './Context'
import { Control } from './Control'
import { Operation } from './Operation'
import { Response } from './Response'
import { Result } from './Result'
import { Spec } from './Spec'


type FeatureOptions = Record<string, any> | {
  active: boolean
}


interface Feature {
  version: string
  name: string
  active: boolean

  init: (ctx: Context, options: FeatureOptions) => void | Promise<any>

  PostConstruct: (ctx: Context) => void | Promise<any>
  PostConstructEntity: (ctx: Context) => void | Promise<any>
  SetData: (ctx: Context) => void | Promise<any>
  GetData: (ctx: Context) => void | Promise<any>
  GetMatch: (ctx: Context) => void | Promise<any>

  PrePoint: (ctx: Context) => void | Promise<any>
  PreSpec: (ctx: Context) => void | Promise<any>
  PreRequest: (ctx: Context) => void | Promise<any>
  PreResponse: (ctx: Context) => void | Promise<any>
  PreResult: (ctx: Context) => void | Promise<any>
  PreDone: (ctx: Context) => void | Promise<any>
  PreUnexpected: (ctx: Context) => void | Promise<any>
  SetMatch: (ctx: Context) => void | Promise<any>
}


export {
  Point,
  Context,
  Control,
  Operation,
  Response,
  Result,
  Spec,
  ZefoyTiktokBotEntityBase,
}


export type {
  Feature,
  FeatureOptions,
}
