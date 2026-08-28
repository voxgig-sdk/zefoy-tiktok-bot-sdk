
import { Context, Spec } from '../types'


const HEADER_auth = 'authorization'

const OPTION_apikey = 'apikey'
const OPTION_secret = 'secret'

const NOTFOUND = '__NOTFOUND__'


function prepareAuth(ctx: Context): Spec | Error {
  const utility = ctx.utility

  const struct = utility.struct
  const getprop = struct.getprop
  const setprop = struct.setprop
  const delprop = struct.delprop

  const client = ctx.client
  const spec = ctx.spec

  if (null == spec) {
    return ctx.error('auth_no_spec', 'Expected context spec property to be defined.')
  }



  const headers = spec.headers

  const options = client.options()

  // Public APIs that need no auth omit the options.auth block entirely.
  if (null == options.auth) {
    delprop(headers, HEADER_auth)
    return spec
  }

  const prefix = options.auth.prefix

  const apikey = getprop(options, OPTION_apikey, NOTFOUND)

  // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  // token in the header (the branch below) can never authenticate against
  // an API that actually checks `Authorization: Basic base64(user:pass)`.
  if (true === options.auth.basic) {
    const secret = getprop(options, OPTION_secret, NOTFOUND)
    const noApikey = NOTFOUND === apikey || null == apikey || '' === apikey
    const noSecret = NOTFOUND === secret || null == secret || '' === secret

    if (noApikey || noSecret) {
      delprop(headers, HEADER_auth)
    }
    else {
      const b64 = Buffer.from(apikey + ':' + secret).toString('base64')
      setprop(headers, HEADER_auth, prefix ? prefix + ' ' + b64 : b64)
    }

    return spec
  }

  if (NOTFOUND === apikey || null == apikey || '' === apikey) {
    delprop(headers, HEADER_auth)
  }
  else {
    // A raw credential (empty prefix, e.g. an apiKey scheme) must go in
    // as-is; only a non-empty prefix (Bearer/Basic/OAuth) is space-joined.
    setprop(headers, HEADER_auth, prefix ? prefix + ' ' + apikey : apikey)
  }

  return spec
}


export {
  prepareAuth
}
