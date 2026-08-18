
import { Context, Point } from '../types'


// The entity's OWN route among an op's points, as opposed to a
// CROSS-REFERENCE: another resource's route that happens to return this
// entity (`/notifications/{id}/board` for a board). Both are plain GETs
// with no `$action`, so the path itself is all there is to go on.
//
// Two signals, in order:
//
//   1. A record route ends in the record's identifier (`/boards/{id}`,
//      `/accounts/{account_id}/users/{id}`); a cross-reference ends in the
//      relationship's name (`/posts/{id}/author`). A terminal parameter is
//      therefore the stronger signal, and unlike depth it survives an entity
//      nested more deeply than the route pointing at it.
//   2. Failing that, fewest path segments — the shallower route is the one
//      the entity is named for.
//
// Ties keep the earlier point, so the sorted-key order of the model decides
// and the output stays byte-stable.
//
// The same rule runs at GENERATION time, in `shortestPoint`/`ownPoint` in
// helpers/opShape.ts. It cannot be shared with this file — a template ships
// standalone, outside that package — so it is written twice on purpose, and
// both sides must move together.
function terminalParam(point: any): boolean {
  const parts = point.parts
  const last = 0 < parts.length ? parts[parts.length - 1] : ''
  return 'string' === typeof last && 0 === last.indexOf('{')
}


function ownPoint(points: any[]): any {
  let best = points[0]

  for (const cand of points) {
    const candterm = terminalParam(cand)
    const bestterm = terminalParam(best)

    if (candterm !== bestterm ? candterm :
      cand.parts.length < best.parts.length) {
      best = cand
    }
  }

  return best
}


function makePoint(ctx: Context): Point | Error {
  if (ctx.out.point) {
    return ctx.point = ctx.out.point
  }

  const getprop = ctx.utility.struct.getprop
  const op = ctx.op
  const options = ctx.options

  if (!options.allow.op.includes(op.name)) {
    return ctx.error('point_op_allow', 'Operation "' + op.name +
      '" not allowed by SDK option allow.op value: "' + options.allow.op + '"')
  }

  if (0 === op.points.length) {
    return ctx.error('point_no_points',
      'Operation "' + op.name + '" has no endpoint definitions.')
  }

  // Choose the appropriate point based on the match or data.
  if (1 === op.points.length) {
    ctx.point = op.points[0]
  }
  else {
    // Operation argument has priority, but also look in current data or match.
    const reqselector = getprop(ctx, 'req' + op.input)
    const selector = getprop(ctx, op.input)

    let point
    let matched = false
    for (let i = 0; i < op.points.length; i++) {
      const cand = op.points[i]
      const select = cand.select
      let found = true

      if (selector && select.exist) {
        for (let j = 0; j < select.exist.length; j++) {
          const existkey = select.exist[j]

          if (
            undefined === getprop(reqselector, existkey)
            && undefined === getprop(selector, existkey)
          ) {
            found = false
            break
          }
        }
      }

      // Action is only in operation argument.
      if (found && reqselector.$action !== select.$action) {
        found = false
      }

      if (found) {
        point = cand
        matched = true
        break
      }
    }

    // select.exist can list more than the params needed to pick a point (for
    // /boards/{id} it is Trello's 17 optional query-includes), so a plain
    // {id} call matches NOTHING. Fall back to the entity's OWN route rather
    // than whichever point came last.
    if (!matched) {
      // A request naming an action reaches here only because that action's
      // own point failed its exist test, so the request is unbuildable
      // whatever we pick. Refuse it BEFORE choosing a fallback: the guard
      // below compares the chosen point's $action, and would wave the
      // request through whenever the action point is itself the one the
      // fallback selects (a short action route folded into an entity whose
      // canonical route is longer). An unbuildable action request is an
      // error, never a silent request to some other endpoint.
      if (null != reqselector.$action) {
        return ctx.error('point_action_invalid', 'Operation "' + op.name +
          '" action "' + reqselector.$action + '" is not valid.')
      }

      point = ownPoint(op.points)
    }

    if (
      null != reqselector.$action &&
      null != point &&
      reqselector.$action !== point.select.$action
    ) {
      return ctx.error('point_action_invalid', 'Operation "' + op.name +
        '" action "' + reqselector.$action + '" is not valid.')
    }

    ctx.point = point
  }

  return ctx.point
}


export {
  makePoint,
}
