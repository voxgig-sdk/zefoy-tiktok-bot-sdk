package core

import (
	vs "github.com/voxgig/struct"
)

type Result struct {
	Ok         bool
	Status     int
	StatusText string
	Headers    map[string]any
	Body       any
	Err        error
	Resdata    any
	Resmatch   map[string]any
}

func NewResult(resmap map[string]any) *Result {
	ok := false
	if o := vs.GetProp(resmap, "ok"); o != nil {
		if b, is := o.(bool); is {
			ok = b
		}
	}

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

	headers := map[string]any{}
	if h := vs.GetProp(resmap, "headers"); h != nil {
		if hm, ok := h.(map[string]any); ok {
			headers = hm
		}
	}

	body := vs.GetProp(resmap, "body")

	var err error
	if e := vs.GetProp(resmap, "err"); e != nil {
		if er, ok := e.(error); ok {
			err = er
		}
	}

	resdata := vs.GetProp(resmap, "resdata")

	var resmatch map[string]any
	if rm := vs.GetProp(resmap, "resmatch"); rm != nil {
		if rmm, ok := rm.(map[string]any); ok {
			resmatch = rmm
		}
	}

	return &Result{
		Ok:         ok,
		Status:     status,
		StatusText: statusText,
		Headers:    headers,
		Body:       body,
		Err:        err,
		Resdata:    resdata,
		Resmatch:   resmatch,
	}
}
