
import { BaseFeature } from './feature/base/BaseFeature'
// #ImportFeatures


const FEATURE_CLASS: Record<string, typeof BaseFeature> = {
  // #FeatureClasses
}


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


  main = {
    name: 'ZefoyTiktokBot',
    // #MainMeta
  }


  feature = {
    // #FeatureConfigs
  }


  options = {
    base: 'BASEURL',

    'SERVERBLOCK''AUTHBLOCK'headers: 'HEADERS',

    entity: {
      // #EntityConfigs
    }
  }


  entity = 'ENTITYMAP'
}


const config = new Config()

export {
  config
}

