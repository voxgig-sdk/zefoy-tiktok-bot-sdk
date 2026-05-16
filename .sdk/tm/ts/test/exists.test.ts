
import { test, describe } from 'node:test'
import { equal } from 'node:assert'


import { ZefoyTiktokBotSDK } from '..'


describe('exists', async () => {

  test('test-mode', async () => {
    const testsdk = await ZefoyTiktokBotSDK.test()
    equal(null !== testsdk, true)
  })

})
