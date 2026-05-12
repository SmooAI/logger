package logger

import "strings"

// DefaultRedactKeys returns the default list of context keys whose values
// will be replaced with [RedactedValue] before logging. Matching is
// case-insensitive.
func DefaultRedactKeys() []string {
	return []string{
		// Auth-bearing HTTP headers
		"authorization",
		"proxy-authorization",
		"cookie",
		"set-cookie",
		"x-api-key",
		"x-amz-security-token",
		// Common credential / token field names
		"password",
		"passwd",
		"secret",
		"apikey",
		"api_key",
		"token",
		"access_token",
		"refresh_token",
		"client_secret",
	}
}

// RedactedValue is the placeholder string substituted in place of any
// redacted value.
const RedactedValue = "[REDACTED]"

// redactSensitiveValues recursively walks `data` and replaces any field whose
// key matches an entry in `redactSet` (case-insensitive) with [RedactedValue].
// `redactSet` is keyed by lowercase entries.
func redactSensitiveValues(data any, redactSet map[string]struct{}) any {
	if len(redactSet) == 0 || data == nil {
		return data
	}
	switch v := data.(type) {
	case Map:
		for k, val := range v {
			if _, ok := redactSet[strings.ToLower(k)]; ok {
				v[k] = RedactedValue
			} else {
				v[k] = redactSensitiveValues(val, redactSet)
			}
		}
		return v
	case []any:
		for i, item := range v {
			v[i] = redactSensitiveValues(item, redactSet)
		}
		return v
	case map[string]string:
		// HTTP header maps are commonly stored as map[string]string. Promote
		// to a Map so we can mutate string values to "[REDACTED]" alongside
		// the structured payload.
		promoted := make(Map, len(v))
		for k, val := range v {
			if _, ok := redactSet[strings.ToLower(k)]; ok {
				promoted[k] = RedactedValue
			} else {
				promoted[k] = val
			}
		}
		return promoted
	default:
		return v
	}
}

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
	Keys     []string                  // For ConfigOnlyKeys
	Children map[string]*ContextConfig // For ConfigNested
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
