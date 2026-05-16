
import { Context, Spec } from '../types'


const HEADER_auth = 'authorization'

const OPTION_apikey = 'apikey'

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

  const apikey = getprop(options, OPTION_apikey, NOTFOUND)

  if (NOTFOUND === apikey || null == apikey || '' === apikey) {
    delprop(headers, HEADER_auth)
  }
  else {
    setprop(headers, HEADER_auth, options.auth.prefix + ' ' + apikey)
  }

  return spec
}


export {
  prepareAuth
}
