
import { Context, Feature } from '../types'


function featureAdd(ctx: Context, f: Feature) {
  const client = ctx.client
  const struct = ctx.utility.struct
  const setprop = struct.setprop
  const getprop = struct.getprop

  const fopts = getprop(f, '_options', {})
  let added = false
  const features = client._features

  // TODO: make this a utility
  if (fopts.__before__ || fopts.__after__ || fopts.__replace__) {

    for (let i = 0; i < features.length; i++) {
      let ef = client._features[i]
      if (fopts.__before__ === ef.name) {
        client._features = [...features.slice(0, i), f, ...features.slice(i)]
        added = true
        break
      }
      else if (fopts.__after__ === ef.name) {
        client._features = [...features.slice(0, ++i), f, ...features.slice(i)]
        added = true
        break
      }
      else if (fopts.__replace__ === ef.name) {
        client._features = setprop(features, i, f)
        added = true
        break
      }
    }
  }

  if (!added) {
    client._features = setprop(features, features.length, f)
  }

}


export {
  featureAdd
}
