-- ZefoyTiktokBot SDK result

local vs = require("utility.struct.struct")

local Result = {}
Result.__index = Result


function Result.new(resmap)
  local self = setmetatable({}, Result)
  resmap = resmap or {}

  self.ok = false
  if vs.getprop(resmap, "ok") == true then
    self.ok = true
  end

  self.status = -1
  local s = vs.getprop(resmap, "status")
  if s ~= nil then
    if type(s) == "number" then
      self.status = math.floor(s)
    end
  end

  self.status_text = ""
  local st = vs.getprop(resmap, "statusText")
  if type(st) == "string" then
    self.status_text = st
  end

  self.headers = {}
  local h = vs.getprop(resmap, "headers")
  if type(h) == "table" then
    self.headers = h
  end

  self.body = vs.getprop(resmap, "body")

  self.err = nil
  local e = vs.getprop(resmap, "err")
  if e ~= nil then
    self.err = e
  end

  self.resdata = vs.getprop(resmap, "resdata")

  self.resmatch = nil
  local rm = vs.getprop(resmap, "resmatch")
  if type(rm) == "table" then
    self.resmatch = rm
  end

  return self
end


return Result
