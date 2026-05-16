package core

type Spec struct {
	Parts   []any
	Headers map[string]any
	Alias   map[string]any
	Base    string
	Prefix  string
	Suffix  string
	Params  map[string]any
	Query   map[string]any
	Step    string
	Method  string
	Body    any
	Url     string
	Path    string
}

func NewSpec(specmap map[string]any) *Spec {
	s := &Spec{
		Headers: map[string]any{},
		Alias:   map[string]any{},
		Params:  map[string]any{},
		Query:   map[string]any{},
		Method:  "GET",
	}

	if specmap == nil {
		return s
	}

	if v, ok := specmap["parts"]; ok && v != nil {
		if parts, ok := v.([]any); ok {
			s.Parts = parts
		}
	}
	if v, ok := specmap["headers"]; ok && v != nil {
		if h, ok := v.(map[string]any); ok {
			s.Headers = h
		}
	}
	if v, ok := specmap["alias"]; ok && v != nil {
		if a, ok := v.(map[string]any); ok {
			s.Alias = a
		}
	}
	if v, ok := specmap["base"]; ok && v != nil {
		if b, ok := v.(string); ok {
			s.Base = b
		}
	}
	if v, ok := specmap["prefix"]; ok && v != nil {
		if p, ok := v.(string); ok {
			s.Prefix = p
		}
	}
	if v, ok := specmap["suffix"]; ok && v != nil {
		if sf, ok := v.(string); ok {
			s.Suffix = sf
		}
	}
	if v, ok := specmap["params"]; ok && v != nil {
		if p, ok := v.(map[string]any); ok {
			s.Params = p
		}
	}
	if v, ok := specmap["query"]; ok && v != nil {
		if q, ok := v.(map[string]any); ok {
			s.Query = q
		}
	}
	if v, ok := specmap["step"]; ok && v != nil {
		if st, ok := v.(string); ok {
			s.Step = st
		}
	}
	if v, ok := specmap["method"]; ok && v != nil {
		if m, ok := v.(string); ok {
			s.Method = m
		}
	}
	if v, ok := specmap["body"]; ok {
		s.Body = v
	}
	if v, ok := specmap["url"]; ok && v != nil {
		if u, ok := v.(string); ok {
			s.Url = u
		}
	}
	if v, ok := specmap["path"]; ok && v != nil {
		if p, ok := v.(string); ok {
			s.Path = p
		}
	}

	return s
}
