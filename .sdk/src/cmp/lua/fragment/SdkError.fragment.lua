-- ProjectName SDK error

local ProjectNameError = {}
ProjectNameError.__index = ProjectNameError


function ProjectNameError.new(code, msg)
  local self = setmetatable({}, ProjectNameError)
  self.code = code or ""
  self.msg = msg or ""
  self.sdk = "ProjectName"
  return self
end


function ProjectNameError:error()
  return self.sdk .. ": " .. self.code .. ": " .. self.msg
end


function ProjectNameError:__tostring()
  return self:error()
end


return ProjectNameError
