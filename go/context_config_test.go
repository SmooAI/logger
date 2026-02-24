package logger

import (
	"testing"
)

func TestAllowAllReturnsDataUnchanged(t *testing.T) {
	data := Map{"a": "1", "b": "2", "nested": Map{"x": "y"}}
	result := ApplyContextConfig(data, AllowAll())

	if result["a"] != "1" || result["b"] != "2" {
		t.Error("AllowAll should return data unchanged")
	}
	nested, ok := result["nested"].(Map)
	if !ok || nested["x"] != "y" {
		t.Error("AllowAll should preserve nested data")
	}
}

func TestDenyReturnsNil(t *testing.T) {
	data := Map{"a": "1", "b": "2"}
	result := ApplyContextConfig(data, Deny())

	if result != nil {
		t.Errorf("Deny should return nil, got %v", result)
	}
}

func TestOnlyKeysKeepsSpecifiedKeys(t *testing.T) {
	data := Map{"a": "1", "b": "2", "c": "3"}
	result := ApplyContextConfig(data, OnlyKeys("a", "c"))

	if result["a"] != "1" {
		t.Errorf("OnlyKeys should keep 'a', got %v", result["a"])
	}
	if _, ok := result["b"]; ok {
		t.Error("OnlyKeys should remove 'b'")
	}
	if result["c"] != "3" {
		t.Errorf("OnlyKeys should keep 'c', got %v", result["c"])
	}
}

func TestOnlyKeysWithMissingKeys(t *testing.T) {
	data := Map{"a": "1"}
	result := ApplyContextConfig(data, OnlyKeys("a", "missing"))

	if result["a"] != "1" {
		t.Errorf("OnlyKeys should keep existing key 'a'")
	}
	if len(result) != 1 {
		t.Errorf("OnlyKeys result should have 1 key, got %d", len(result))
	}
}

func TestNestedAppliesChildConfigs(t *testing.T) {
	data := Map{
		"http": Map{
			"request": Map{
				"method": "GET",
				"body":   "secret",
				"path":   "/api/test",
			},
			"response": Map{
				"statusCode": 200,
				"body":       "hidden",
			},
			"other": "keep",
		},
		"namespace": "test",
	}

	config := Nested(map[string]*ContextConfig{
		"http": Nested(map[string]*ContextConfig{
			"request":  OnlyKeys("method", "path"),
			"response": OnlyKeys("statusCode"),
		}),
	})

	result := ApplyContextConfig(data, config)

	// namespace not in config children → kept as-is
	if result["namespace"] != "test" {
		t.Errorf("namespace should be kept, got %v", result["namespace"])
	}

	http, ok := result["http"].(Map)
	if !ok {
		t.Fatal("http should be a map")
	}

	// "other" not in http config children → kept as-is
	if http["other"] != "keep" {
		t.Errorf("http.other should be kept, got %v", http["other"])
	}

	req, ok := http["request"].(Map)
	if !ok {
		t.Fatal("http.request should be a map")
	}
	if req["method"] != "GET" {
		t.Errorf("request.method = %v, want GET", req["method"])
	}
	if req["path"] != "/api/test" {
		t.Errorf("request.path = %v, want /api/test", req["path"])
	}
	if _, ok := req["body"]; ok {
		t.Error("request.body should be filtered out")
	}

	resp, ok := http["response"].(Map)
	if !ok {
		t.Fatal("http.response should be a map")
	}
	if resp["statusCode"] != 200 {
		t.Errorf("response.statusCode = %v, want 200", resp["statusCode"])
	}
	if _, ok := resp["body"]; ok {
		t.Error("response.body should be filtered out")
	}
}

func TestPresetConfigMinimal(t *testing.T) {
	data := Map{
		"http": Map{
			"request": Map{
				"method":      "POST",
				"hostname":    "example.com",
				"path":        "/api/users",
				"queryString": "page=1",
				"headers":     Map{"content-type": "application/json"},
				"sourceIp":    "1.2.3.4",
				"userAgent":   "test",
				"body":        Map{"password": "secret"},
			},
			"response": Map{
				"statusCode": 201,
				"headers":    Map{"x-request-id": "abc"},
				"body":       Map{"token": "secret"},
			},
		},
		"correlationId": "test-123",
	}

	result := ApplyContextConfig(data, PresetConfigMinimal)

	// correlationId not in config → kept
	if result["correlationId"] != "test-123" {
		t.Error("correlationId should be kept")
	}

	http, ok := result["http"].(Map)
	if !ok {
		t.Fatal("http should be a map")
	}

	req, ok := http["request"].(Map)
	if !ok {
		t.Fatal("http.request should be a map")
	}
	if req["method"] != "POST" {
		t.Error("request.method should be kept")
	}
	if _, ok := req["body"]; ok {
		t.Error("request.body should be filtered out by ConfigMinimal")
	}

	resp, ok := http["response"].(Map)
	if !ok {
		t.Fatal("http.response should be a map")
	}
	if resp["statusCode"] != 201 {
		t.Error("response.statusCode should be kept")
	}
	if _, ok := resp["body"]; ok {
		t.Error("response.body should be filtered out by ConfigMinimal")
	}
}

func TestMixedNestedConfigs(t *testing.T) {
	data := Map{
		"keep":   "yes",
		"remove": "no",
		"filter": Map{"a": "1", "b": "2", "c": "3"},
	}

	config := Nested(map[string]*ContextConfig{
		"remove": Deny(),
		"filter": OnlyKeys("a", "c"),
	})

	result := ApplyContextConfig(data, config)

	if result["keep"] != "yes" {
		t.Error("'keep' should be preserved")
	}
	if _, ok := result["remove"]; ok {
		t.Error("'remove' should be denied")
	}
	filtered, ok := result["filter"].(Map)
	if !ok {
		t.Fatal("'filter' should be a map")
	}
	if filtered["a"] != "1" || filtered["c"] != "3" {
		t.Error("filter should keep only 'a' and 'c'")
	}
	if _, ok := filtered["b"]; ok {
		t.Error("filter should remove 'b'")
	}
}

func TestEmptyDataReturnsEmpty(t *testing.T) {
	result := ApplyContextConfig(Map{}, OnlyKeys("a"))
	if len(result) != 0 {
		t.Errorf("empty data should return empty map, got %v", result)
	}
}

func TestNilDataReturnsNil(t *testing.T) {
	result := ApplyContextConfig(nil, AllowAll())
	if result != nil {
		t.Error("nil data should return nil")
	}
}

func TestNilConfigReturnsData(t *testing.T) {
	data := Map{"a": "1"}
	result := ApplyContextConfig(data, nil)
	if result["a"] != "1" {
		t.Error("nil config should return data unchanged")
	}
}
