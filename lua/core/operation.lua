-- ZefoyTiktokBot SDK operation

local vs = require("utility.struct.struct")

local Operation = {}
Operation.__index = Operation


function Operation.new(opmap)
  local self = setmetatable({}, Operation)
  opmap = opmap or {}

  local entity = vs.getprop(opmap, "entity")
  if type(entity) ~= "string" or entity == "" then
    entity = "_"
  end
  self.entity = entity

  local name = vs.getprop(opmap, "name")
  if type(name) ~= "string" or name == "" then
    name = "_"
  end
  self.name = name

  local input = vs.getprop(opmap, "input")
  if type(input) ~= "string" or input == "" then
    input = "_"
  end
  self.input = input

  self.points = {}
  local raw_points = vs.getprop(opmap, "points")
  if type(raw_points) == "table" then
    for _, t in ipairs(raw_points) do
      if type(t) == "table" then
        table.insert(self.points, t)
      end
    end
  end

  self.alias = nil
  local raw_alias = vs.getprop(opmap, "alias")
  if type(raw_alias) == "table" then
    self.alias = raw_alias
  end

  return self
end


return Operation
