package logger

import "os"

// IsLocal returns true when running in a local development environment,
// matching the TypeScript/Python/Rust detection logic.
func IsLocal() bool {
	if os.Getenv("SST_DEV") != "" {
		return true
	}
	if os.Getenv("IS_LOCAL") != "" {
		return true
	}
	deployed := os.Getenv("IS_DEPLOYED_STAGE")
	return deployed != "" && deployed != "true"
}

// IsBuild returns true when running inside GitHub Actions.
func IsBuild() bool {
	return os.Getenv("GITHUB_ACTIONS") != ""
}
