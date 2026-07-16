package utility

import "GOMODULE/core"

// featureAddUtil appends a feature to the client's feature list. A feature
// that implements AddOptions (every BaseFeature embedder does, via the
// AddOpts field) can instead position itself relative to an already-added
// feature with "__before__", "__after__" or "__replace__" naming that
// feature — mirroring the ts featureAdd. The first match wins; when no
// ordering option matches, the feature is appended.
func featureAddUtil(ctx *core.Context, f core.Feature) {
	client := ctx.Client
	features := client.Features

	var fopts map[string]any
	if af, ok := f.(interface{ AddOptions() map[string]any }); ok {
		fopts = af.AddOptions()
	}

	if fopts != nil {
		before, _ := fopts["__before__"].(string)
		after, _ := fopts["__after__"].(string)
		replace, _ := fopts["__replace__"].(string)

		if "" != before || "" != after || "" != replace {
			for i, ef := range features {
				name := ef.GetName()
				if before == name {
					client.Features = append(features[:i],
						append([]core.Feature{f}, features[i:]...)...)
					return
				}
				if after == name {
					client.Features = append(features[:i+1],
						append([]core.Feature{f}, features[i+1:]...)...)
					return
				}
				if replace == name {
					features[i] = f
					client.Features = features
					return
				}
			}
		}
	}

	client.Features = append(features, f)
}
