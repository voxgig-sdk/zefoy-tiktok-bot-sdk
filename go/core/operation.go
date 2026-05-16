package core

import (
	vs "github.com/voxgig/struct"
)

type Operation struct {
	Entity  string
	Name    string
	Input   string
	Points []map[string]any
	Alias   map[string]any
}

func NewOperation(opmap map[string]any) *Operation {
	entity, _ := vs.GetProp(opmap, "entity").(string)
	if entity == "" {
		entity = "_"
	}
	name, _ := vs.GetProp(opmap, "name").(string)
	if name == "" {
		name = "_"
	}
	input, _ := vs.GetProp(opmap, "input").(string)
	if input == "" {
		input = "_"
	}

	var targets []map[string]any
	rawPoints := vs.GetProp(opmap, "points")
	if rawPoints != nil {
		if tlist, ok := rawPoints.([]any); ok {
			for _, t := range tlist {
				if tm, ok := t.(map[string]any); ok {
					targets = append(targets, tm)
				}
			}
		} else if tlist, ok := rawPoints.([]map[string]any); ok {
			targets = tlist
		}
	}
	if targets == nil {
		targets = []map[string]any{}
	}

	var alias map[string]any
	rawAlias := vs.GetProp(opmap, "alias")
	if rawAlias != nil {
		if am, ok := rawAlias.(map[string]any); ok {
			alias = am
		}
	}

	return &Operation{
		Entity:  entity,
		Name:    name,
		Input:   input,
		Points: targets,
		Alias:   alias,
	}
}
