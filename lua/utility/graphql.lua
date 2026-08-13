-- ZefoyTiktokBot SDK utility: graphql
--
-- GraphQL transport. API-INDEPENDENT: every GraphQL SDK this generator
-- produces uses this file unchanged. The API-specific part — which
-- operations exist and what each one's document is — is model data,
-- computed once by apidef and emitted into Config.
--
-- Two jobs:
--
--   graphql_body   — build { query, variables } for a point, binding the
--                    op's arguments to the document's declared variables.
--
--   graphql_errors — lift a GraphQL failure into an SDK error. GraphQL
--                    reports failures as a top-level `errors` array under
--                    HTTP 200, so the status-driven path in result_basic
--                    never sees them.

local vs = require("utility.struct.struct")

local M = {}

-- Content type every GraphQL-over-HTTP request uses.
M.CONTENT_TYPE = "application/json"

-- Map a GraphQL error to the same error codes the HTTP path produces, so a
-- caller handles auth or rate limiting identically on both transports.
-- Servers put the machine-readable code in `extensions.code`; Linear-style
-- APIs use `extensions.type`.
function M.error_code(gqlerr)
  local ext = vs.getprop(gqlerr, "extensions")

  local raw = vs.getprop(ext, "code")
  if raw == nil or raw == "" then
    raw = vs.getprop(ext, "type")
  end
  raw = type(raw) == "string" and raw:upper() or ""

  if raw:find("AUTH", 1, true) or raw:find("FORBIDDEN", 1, true)
    or raw:find("UNAUTHENTICATED", 1, true) then
    return "request_auth"
  end
  if raw:find("RATELIMIT", 1, true) or raw:find("RATE_LIMIT", 1, true)
    or raw:find("TOO_MANY", 1, true) then
    return "request_ratelimit"
  end
  if raw:find("BAD_USER_INPUT", 1, true) or raw:find("VALIDATION", 1, true)
    or raw:find("INVALID", 1, true) then
    return "request_invalid"
  end

  return "request_graphql"
end

-- Build the request body for a GraphQL point.
--
-- Variables come from the op's own arguments: a named variable binds to the
-- like-named argument (`from`), and the input-object variable (empty
-- `from`) takes the request data as a whole — which is what makes a
-- generated create/update call look exactly like its REST equivalent.
function M.body(ctx)
  local gql = vs.getprop(ctx.point, "graphql")
  if type(gql) ~= "table" then
    return nil
  end

  -- reqmatch/reqdata hold the caller's arguments for THIS call; data/match
  -- hold the entity's current state. Which pair depends on whether the op
  -- takes match or data input. A named variable falls back to the current
  -- state, so updating a loaded entity with just {title} still binds the
  -- stored id the mutation requires.
  local reqsrc = ctx.reqmatch
  local datasrc = ctx.match
  if ctx.op ~= nil and ctx.op.input == "data" then
    reqsrc = ctx.reqdata
    datasrc = ctx.data
  end
  if type(reqsrc) ~= "table" then
    reqsrc = {}
  end
  if type(datasrc) ~= "table" then
    datasrc = {}
  end

  local variables = {}

  local varlist = vs.getprop(gql, "vars")
  if type(varlist) == "table" then
    for _, spec in ipairs(varlist) do
      if type(spec) == "table" then
        local name = vs.getprop(spec, "name")
        local from = vs.getprop(spec, "from")

        if name ~= nil then
          if from == nil or from == "" then
            -- The input object IS the request body. Strip the action
            -- selector, which is an SDK-side point discriminator, not an
            -- API field.
            local body = {}
            for k, v in pairs(reqsrc) do
              if k ~= "$action" then
                body[k] = v
              end
            end
            variables[name] = body
          else
            -- Only send variables the caller actually supplied: sending an
            -- explicit null would clear a field on many APIs.
            local val = vs.getprop(reqsrc, from)
            if val == nil then
              val = vs.getprop(datasrc, from)
            end
            if val ~= nil then
              variables[name] = val
            end
          end
        end
      end
    end
  end

  return {
    query = vs.getprop(gql, "doc"),
    variables = variables,
  }
end

-- Inspect a decoded GraphQL response body and record a failure when the
-- server reported one. Returns true when an error was recorded.
--
-- Partial data (`data` alongside `errors`) is treated as failure: the REST
-- surface has no partial-success concept, and silently returning half an
-- object would be worse than failing.
function M.errors(ctx)
  local result = ctx.result
  if result == nil or ctx.point == nil then
    return false
  end

  if vs.getprop(ctx.point, "kind") ~= "graphql" then
    return false
  end

  local errors = vs.getprop(result.body, "errors")
  if type(errors) ~= "table" or #errors == 0 then
    return false
  end

  local first = errors[1]
  local msg = vs.getprop(first, "message")
  if type(msg) ~= "string" or msg == "" then
    msg = "graphql error"
  end
  if 1 < #errors then
    msg = msg .. " (+" .. tostring(#errors - 1) .. " more)"
  end

  result.err = ctx:make_error(M.error_code(first), "graphql: " .. msg)
  result.ok = false

  return true
end

return M
