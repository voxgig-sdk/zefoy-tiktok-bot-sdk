
import { Context } from '../types'

function prepareMethod(ctx: Context) {
  const op = ctx.op
  const opname = op.name

  let key = opname

  const methodMap: any = {
    create: 'POST',
    update: 'PUT',
    load: 'GET',
    list: 'GET',
    remove: 'DELETE',
    patch: 'PATCH',
  }

  return methodMap[key]
}


export {
  prepareMethod
}
