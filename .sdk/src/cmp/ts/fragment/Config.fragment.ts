
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


  main = {
    name: 'ZefoyTiktokBot',
  }


  feature = {
    // #FeatureConfigs
  }


  options = {
    base: '$$main.kit.info.servers.0.url$$',

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

