-- ZefoyTiktokBot SDK response

local vs = require("utility.struct.struct")

local Response = {}
Response.__index = Response


function Response.new(resmap)
  local self = setmetatable({}, Response)
  resmap = resmap or {}

  self.status = -1
  local s = vs.getprop(resmap, "status")
  if s ~= nil and type(s) == "number" then
    self.status = math.floor(s)
  end

  self.status_text = ""
  local st = vs.getprop(resmap, "statusText")
  if type(st) == "string" then
    self.status_text = st
  end

  self.headers = vs.getprop(resmap, "headers")

  self.json_func = nil
  local jf = vs.getprop(resmap, "json")
  if type(jf) == "function" then
    self.json_func = jf
  end

  self.body = vs.getprop(resmap, "body")

  self.err = nil
  local e = vs.getprop(resmap, "err")
  if e ~= nil then
    self.err = e
  end

  return self
end


return Response
