package logger

// ContextConfigType represents the type of context config filter.
type ContextConfigType int

const (
	// ConfigAllowAll includes everything in the target branch.
	ConfigAllowAll ContextConfigType = iota
	// ConfigDeny removes the target branch entirely.
	ConfigDeny
	// ConfigOnlyKeys keeps only the listed keys at this level.
	ConfigOnlyKeys
	// ConfigNested applies nested configuration rules to object children.
	ConfigNested
)

// ContextConfig defines how to filter context data in log output.
// It forms a tree structure that can recursively filter nested maps.
type ContextConfig struct {
	Type     ContextConfigType
	Keys     []string                   // For ConfigOnlyKeys
	Children map[string]*ContextConfig  // For ConfigNested
}

// AllowAll returns a config that includes everything.
func AllowAll() *ContextConfig {
	return &ContextConfig{Type: ConfigAllowAll}
}

// Deny returns a config that removes the entire branch.
func Deny() *ContextConfig {
	return &ContextConfig{Type: ConfigDeny}
}

// OnlyKeys returns a config that keeps only the specified keys.
func OnlyKeys(keys ...string) *ContextConfig {
	return &ContextConfig{Type: ConfigOnlyKeys, Keys: keys}
}

// Nested returns a config that applies child configs per key.
// Keys not listed in children are kept as-is (AllowAll by default).
func Nested(children map[string]*ContextConfig) *ContextConfig {
	return &ContextConfig{Type: ConfigNested, Children: children}
}

// PresetConfigMinimal filters HTTP context to essential fields only,
// matching the Rust CONFIG_MINIMAL / TypeScript configMinimal behavior.
var PresetConfigMinimal = Nested(map[string]*ContextConfig{
	"http": Nested(map[string]*ContextConfig{
		"request":  OnlyKeys("method", "hostname", "path", "queryString", "headers", "sourceIp", "userAgent"),
		"response": OnlyKeys("statusCode", "headers"),
	}),
})

// PresetConfigFull allows all context through unfiltered.
var PresetConfigFull = AllowAll()

// ApplyContextConfig recursively filters a map based on the config.
// It returns a new map with the filtered result, leaving the original untouched.
func ApplyContextConfig(data Map, config *ContextConfig) Map {
	if config == nil || data == nil {
		return data
	}

	switch config.Type {
	case ConfigAllowAll:
		return data

	case ConfigDeny:
		return nil

	case ConfigOnlyKeys:
		filtered := make(Map, len(config.Keys))
		for _, key := range config.Keys {
			if val, ok := data[key]; ok {
				filtered[key] = val
			}
		}
		return filtered

	case ConfigNested:
		filtered := make(Map, len(data))
		for key, val := range data {
			childConfig, hasChild := config.Children[key]
			if !hasChild {
				// Keys not in children config are kept as-is
				filtered[key] = val
				continue
			}

			// If the value is a nested map, apply the child config recursively
			if nestedMap, ok := val.(Map); ok {
				result := ApplyContextConfig(nestedMap, childConfig)
				if result != nil && len(result) > 0 {
					filtered[key] = result
				}
			} else {
				// Non-map values: apply Deny/AllowAll directly
				switch childConfig.Type {
				case ConfigDeny:
					// Skip this key
				default:
					filtered[key] = val
				}
			}
		}
		return filtered

	default:
		return data
	}
}
