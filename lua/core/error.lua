-- ZefoyTiktokBot SDK error

local ZefoyTiktokBotError = {}
ZefoyTiktokBotError.__index = ZefoyTiktokBotError


function ZefoyTiktokBotError.new(code, msg, ctx)
  local self = setmetatable({}, ZefoyTiktokBotError)
  self.is_sdk_error = true
  self.sdk = "ZefoyTiktokBot"
  self.code = code or ""
  self.msg = msg or ""
  self.ctx = ctx
  self.result = nil
  self.spec = nil
  return self
end


function ZefoyTiktokBotError:error()
  return self.msg
end


function ZefoyTiktokBotError:__tostring()
  return self.msg
end


return ZefoyTiktokBotError
