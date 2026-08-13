-- ProjectName SDK error

local ProjectNameError = {}
ProjectNameError.__index = ProjectNameError


function ProjectNameError.new(code, msg)
  local self = setmetatable({}, ProjectNameError)
  self.code = code or ""
  self.msg = msg or ""
  self.sdk = "ProjectName"

  -- HTTP status of the response that caused this error, or -1 when the
  -- request never got one. PROMOTED to the top level: it used to be
  -- reachable only at `err.result.status`, so every consumer coupled itself
  -- to the internal shape of `result`.
  self.status = -1

  return self
end


function ProjectNameError:not_found()
  return 404 == self.status
end


function ProjectNameError:error()
  return self.sdk .. ": " .. self.code .. ": " .. self.msg
end


function ProjectNameError:__tostring()
  return self:error()
end


return ProjectNameError
