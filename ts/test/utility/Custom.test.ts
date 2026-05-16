
import { test, describe } from 'node:test'
import { equal } from 'node:assert'

import { ZefoyTiktokBotSDK } from '../..'


describe('Custom', () => {

  test('basic', async () => {
    const client = ZefoyTiktokBotSDK.test({}, {
      apikey: 'APIKEY01',

      // NOTE: original utility.options must remain in place.
      utility: {
        auth: () => ({ util: 'AUTH' }),
        body: () => ({ util: 'BODY' }),
        contextify: () => ({ util: 'CONTEXTIFY' }),
        done: () => ({ util: 'DONE' }),
        error: () => ({ util: 'ERROR' }),
        findparam: () => ({ util: 'FINDPARAM' }),
        fullurl: () => ({ util: 'FULLURL' }),
        headers: () => ({ util: 'HEADERS' }),
        method: () => ({ util: 'METHOD' }),
        operator: () => ({ util: 'OPERATOR' }),
        params: () => ({ util: 'PARAMS' }),
        query: () => ({ util: 'QUERY' }),
        reqform: () => ({ util: 'REQFORM' }),
        request: () => ({ util: 'REQUEST' }),
        resbasic: () => ({ util: 'RESBASIC' }),
        resbody: () => ({ util: 'RESBODY' }),
        resform: () => ({ util: 'RESFORM' }),
        resheaders: () => ({ util: 'RESHEADERS' }),
        response: () => ({ util: 'RESPONSE' }),
        result: () => ({ util: 'RESULT' }),
        spec: () => ({ util: 'SPEC' }),
      }
    })

    const u: any = client.utility()

    equal(u.auth().util, 'AUTH')
    equal(u.body().util, 'BODY')
    equal(u.contextify().util, 'CONTEXTIFY')
    equal(u.done().util, 'DONE')
    equal(u.error().util, 'ERROR')
    equal(u.findparam().util, 'FINDPARAM')
    equal(u.fullurl().util, 'FULLURL')
    equal(u.headers().util, 'HEADERS')
    equal(u.method().util, 'METHOD')
    equal(u.operator().util, 'OPERATOR')
    equal(u.params().util, 'PARAMS')
    equal(u.query().util, 'QUERY')
    equal(u.reqform().util, 'REQFORM')
    equal(u.resbasic().util, 'RESBASIC')
    equal(u.resbody().util, 'RESBODY')
    equal(u.resform().util, 'RESFORM')
    equal(u.resheaders().util, 'RESHEADERS')
    equal(u.response().util, 'RESPONSE')
    equal(u.result().util, 'RESULT')
    equal(u.spec().util, 'SPEC')
  })
})
