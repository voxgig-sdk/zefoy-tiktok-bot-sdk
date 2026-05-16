package core

import (
	vs "github.com/voxgig/struct"
)

type Point struct {
	Args      map[string]any
	Rename    map[string]any
	Method    string
	Orig      string
	Parts     []any
	Params    []any
	Select    map[string]any
	Active    bool
	Relations []any
	Alias     map[string]any
	Transform map[string]any
}

func NewPoint(altmap map[string]any) *Point {
	t := &Point{}

	if args := vs.GetProp(altmap, "args"); args != nil {
		if am, ok := args.(map[string]any); ok {
			t.Args = am
		}
	}
	if t.Args == nil {
		t.Args = map[string]any{"params": []any{}}
	}

	if rename := vs.GetProp(altmap, "rename"); rename != nil {
		if rm, ok := rename.(map[string]any); ok {
			t.Rename = rm
		}
	}
	if t.Rename == nil {
		t.Rename = map[string]any{"params": map[string]any{}}
	}

	if m := vs.GetProp(altmap, "method"); m != nil {
		t.Method, _ = m.(string)
	}

	if o := vs.GetProp(altmap, "orig"); o != nil {
		t.Orig, _ = o.(string)
	}

	if p := vs.GetProp(altmap, "parts"); p != nil {
		if pl, ok := p.([]any); ok {
			t.Parts = pl
		}
	}
	if t.Parts == nil {
		t.Parts = []any{}
	}

	if p := vs.GetProp(altmap, "params"); p != nil {
		if pl, ok := p.([]any); ok {
			t.Params = pl
		}
	}

	if s := vs.GetProp(altmap, "select"); s != nil {
		if sm, ok := s.(map[string]any); ok {
			t.Select = sm
		}
	}

	if a := vs.GetProp(altmap, "active"); a != nil {
		if ab, ok := a.(bool); ok {
			t.Active = ab
		}
	}

	if r := vs.GetProp(altmap, "relations"); r != nil {
		if rl, ok := r.([]any); ok {
			t.Relations = rl
		}
	}

	if a := vs.GetProp(altmap, "alias"); a != nil {
		if am, ok := a.(map[string]any); ok {
			t.Alias = am
		}
	}
	if t.Alias == nil {
		t.Alias = map[string]any{}
	}

	if tf := vs.GetProp(altmap, "transform"); tf != nil {
		if tm, ok := tf.(map[string]any); ok {
			t.Transform = tm
		}
	}
	if t.Transform == nil {
		t.Transform = map[string]any{}
	}

	return t
}
