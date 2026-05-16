package utility

import (
	"reflect"

	"GOMODULE/core"
)

func featureHookUtil(ctx *core.Context, name string) {
	client := ctx.Client
	if client == nil {
		return
	}
	features := client.Features
	if features == nil {
		return
	}

	for _, f := range features {
		callFeatureMethod(f, name, ctx)
	}
}

func callFeatureMethod(f core.Feature, name string, ctx *core.Context) {
	v := reflect.ValueOf(f)
	m := v.MethodByName(name)
	if m.IsValid() {
		m.Call([]reflect.Value{reflect.ValueOf(ctx)})
	}
}
