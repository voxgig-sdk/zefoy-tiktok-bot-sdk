
import { BaseFeature } from './feature/base/BaseFeature'
import { TestFeature } from './feature/test/TestFeature'



const FEATURE_CLASS: Record<string, typeof BaseFeature> = {
   test: TestFeature,

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
        slug: "zefoy-tiktok-bot",
    version: "0.0.1",
    target: "ts",

  }


  feature = {
     test:     {
      "options": {
        "active": false
      }
    },

  }


  options = {
    base: "https://zefoy.com",

    auth: {
      prefix: '',
    },

    headers: {
      "content-type": "application/json"
    },

    entity: {
      
      engagement: {
      },

    }
  }


  entity = {
    "engagement": {
      "fields": [
        {
          "name": "amount",
          "short": "The amount of engagement to acquire (if applicable)",
          "type": "`$INTEGER`"
        },
        {
          "name": "estimatedTime",
          "short": "Estimated time to complete in seconds",
          "type": "`$INTEGER`"
        },
        {
          "name": "message",
          "short": "Response message",
          "type": "`$STRING`"
        },
        {
          "name": "status",
          "short": "Current status of the boost request",
          "type": "`$STRING`"
        },
        {
          "name": "success",
          "short": "Indicates if the request was successful",
          "type": "`$BOOLEAN`"
        },
        {
          "name": "type",
          "op": {
            "create": {
              "req": true,
              "type": "`$STRING`"
            }
          },
          "short": "The type of engagement boosted",
          "type": "`$STRING`"
        },
        {
          "name": "url",
          "req": true,
          "short": "The TikTok video or profile URL to boost",
          "type": "`$STRING`"
        }
      ],
      "name": "engagement",
      "op": {
        "create": {
          "input": "data",
          "name": "create",
          "points": [
            {
              "args": {},
              "kind": "http",
              "method": "POST",
              "orig": "/api/boost",
              "parts": [
                "api",
                "boost"
              ],
              "select": {},
              "transform": {
                "req": "`reqdata`",
                "res": "`body`"
              }
            }
          ]
        }
      },
      "relations": {
        "ancestors": []
      }
    }
  }
}


const config = new Config()

export {
  config
}

