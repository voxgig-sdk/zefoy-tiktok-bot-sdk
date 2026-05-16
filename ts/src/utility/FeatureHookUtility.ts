
import { Context, Feature } from '../types'


function featureHook(ctx: Context, name: string) {
  const client = ctx.client

  let resp: Promise<any>[] = []
  const features: Feature[] = client._features || []

  for (let f of features) {
    const fh = (f as any)[name]
    if (null != fh) {
      const fres = fh(ctx)
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
