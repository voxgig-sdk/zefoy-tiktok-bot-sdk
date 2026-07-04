// Typed models for the ZefoyTiktokBot SDK.
//
// GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Do not edit by hand.

export interface Engagement {
  amount?: number
  estimated_time?: number
  message?: string
  status?: string
  success?: boolean
  type?: string
  url: string
}

export type EngagementCreateData = Partial<Engagement>

