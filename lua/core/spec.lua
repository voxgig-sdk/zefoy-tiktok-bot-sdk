-- ZefoyTiktokBot SDK spec

local Spec = {}
Spec.__index = Spec


function Spec.new(specmap)
  local self = setmetatable({}, Spec)
  specmap = specmap or {}

  self.parts = specmap.parts or {}
  self.headers = specmap.headers or {}
  self.alias = specmap.alias or {}
  self.base = specmap.base or ""
  self.prefix = specmap.prefix or ""
  self.suffix = specmap.suffix or ""
  self.params = specmap.params or {}
  self.query = specmap.query or {}
  self.step = specmap.step or ""
  self.method = specmap.method or "GET"
  self.body = specmap.body
  self.url = specmap.url or ""
  self.path = specmap.path or ""

  return self
end


return Spec
