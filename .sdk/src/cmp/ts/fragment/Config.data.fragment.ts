
import { BaseFeature } from './feature/base/BaseFeature'
// #ImportFeatures


const FEATURE_CLASS: Record<string, typeof BaseFeature> = {
  // #FeatureClasses
}


// THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
//
// The literal form of this file declares the whole model as nested object
// literals on the class. For a large API that is megabytes of source that the
// TypeScript compiler must parse and infer a type for on every build, and that
// the JavaScript engine must build node by node on every module load.
//
// As a single string constant it is one token to the compiler, and V8's JSON
// parser builds the object far faster than the equivalent literal - JSON.parse
// is the well-worn trick for exactly this shape of data.
//
// Emitted only above a size threshold, or when `main.kit.config.repr` pins it:
// for a small model the literal is smaller, loads no slower, and is far easier
// to read when debugging.
const CONFIG_DATA = 'CONFIGJSON'


class Config {

  makeFeature(this: any, fn: string) {
    const fc = FEATURE_CLASS[fn]
    const fi = new fc()
    // TODO: errors etc
    return fi
  }

  // False for a feature added at runtime via options.extend (station's
  // adopt path) - the constructor uses this to skip makeFeature for names
  // no generated class backs.
  hasFeature(this: any, fn: string) {
    return null != FEATURE_CLASS[fn]
  }

}


// Parsed ONCE, at module load, exactly like the literal form was built once.
//
// The parsed data is assigned onto an instance rather than replacing it, so
// `config.main` / `.feature` / `.options` / `.entity` read exactly as they did
// when they were field initialisers, and `makeFeature` stays where it was on
// the prototype. Callers cannot tell which representation they were given.
const config: any = Object.assign(new Config(), JSON.parse(CONFIG_DATA))

export {
  config
}
