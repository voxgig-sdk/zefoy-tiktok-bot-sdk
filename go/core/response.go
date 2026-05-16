package core

import (
	vs "github.com/voxgig/struct"
)

type Response struct {
	Status     int
	StatusText string
	Headers    any
	JsonFunc   func() any
	Body       any
	Err        error
}

func NewResponse(resmap map[string]any) *Response {
	status := -1
	if s := vs.GetProp(resmap, "status"); s != nil {
		status = ToInt(s)
	}

	statusText := ""
	if st := vs.GetProp(resmap, "statusText"); st != nil {
		if s, ok := st.(string); ok {
			statusText = s
		}
	}

	headers := vs.GetProp(resmap, "headers")

	var jsonFunc func() any
	if jf := vs.GetProp(resmap, "json"); jf != nil {
		if f, ok := jf.(func() any); ok {
			jsonFunc = f
		}
	}

	body := vs.GetProp(resmap, "body")

	var err error
	if e := vs.GetProp(resmap, "err"); e != nil {
		if er, ok := e.(error); ok {
			err = er
		}
	}

	return &Response{
		Status:     status,
		StatusText: statusText,
		Headers:    headers,
		JsonFunc:   jsonFunc,
		Body:       body,
		Err:        err,
	}
}
