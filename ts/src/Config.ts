
import { BaseFeature } from './feature/base/BaseFeature'
import { TestFeature } from './feature/test/TestFeature'



const FEATURE_CLASS: Record<string, typeof BaseFeature> = {
   test: TestFeature

}


class Config {

  makeFeature(this: any, fn: string) {
    const fc = FEATURE_CLASS[fn]
    const fi = new fc()
    // TODO: errors etc
    return fi
  }


  main = {
    name: 'ProjectName',
  }


  feature = {
     test:     {
      "options": {
        "active": false
      }
    }

  }


  options = {
    base: 'https://zefoy.com',

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
          "req": false,
          "type": "`$INTEGER`",
          "active": true,
          "index$": 0
        },
        {
          "name": "estimated_time",
          "req": false,
          "type": "`$INTEGER`",
          "active": true,
          "index$": 1
        },
        {
          "name": "message",
          "req": false,
          "type": "`$STRING`",
          "active": true,
          "index$": 2
        },
        {
          "name": "status",
          "req": false,
          "type": "`$STRING`",
          "active": true,
          "index$": 3
        },
        {
          "name": "success",
          "req": false,
          "type": "`$BOOLEAN`",
          "active": true,
          "index$": 4
        },
        {
          "name": "type",
          "op": {
            "create": {
              "req": true,
              "type": "`$STRING`"
            }
          },
          "req": false,
          "type": "`$STRING`",
          "active": true,
          "index$": 5
        },
        {
          "name": "url",
          "req": true,
          "type": "`$STRING`",
          "active": true,
          "index$": 6
        }
      ],
      "name": "engagement",
      "op": {
        "create": {
          "name": "create",
          "points": [
            {
              "method": "POST",
              "orig": "/api/boost",
              "parts": [
                "api",
                "boost"
              ],
              "transform": {
                "req": "`reqdata`",
                "res": "`body`"
              },
              "active": true,
              "args": {},
              "select": {},
              "index$": 0
            }
          ],
          "input": "data",
          "key$": "create"
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

