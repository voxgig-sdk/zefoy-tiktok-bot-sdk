
import { Context, Feature } from '../types'


function featureHook(ctx: Context, name: string) {
  const client = ctx.client

  let resp: Promise<any>[] = []
  const features: Feature[] = client._features || []

  for (let f of features) {
    const fh = (f as any)[name]
    if (null != fh) {
      // Call bound to the feature instance: hook methods read instance state
      // via `this` (e.g. clienttrack's session/options), so an unbound call
      // would run with `this === undefined` and throw.
      const fres = fh.call(f, ctx)
      if (fres instanceof Promise) {
        resp.push(fres)
      }
    }
  }

  if (0 < resp.length) {
    return Promise.all(resp)
  }
}


export {
  featureHook
}
