---
'@smooai/logger': minor
---

## Multi-Language Logger Ecosystem

This release transforms `@smooai/logger` into a comprehensive multi-language logging ecosystem:

### 🐍 Python Package (`smooai-logger`)

- Available on PyPI as `smooai-logger`
- Full Python implementation with identical API to TypeScript version
- Synchronized versioning with npm package

### 🦀 Rust Crate (`smooai-logger`)

- Available on crates.io as `smooai-logger`
- Native Rust logging implementation
- Synchronized versioning with npm package

### 📊 Log Viewer CLI (`smooai-log-viewer`)

- Interactive GUI application for viewing `.smooai-logs` files
- Available as CLI command when installing npm package: `smooai-log-viewer`
- Cross-platform native binaries bundled with package
- Features filtering, searching, JSON expansion, and context viewing

### 🔄 Automated Publishing Pipeline

- Single changesets release now publishes to npm, PyPI, and crates.io
- Automatic version synchronization across all packages
- Enhanced CI/CD workflow for multi-language support

This creates a unified logging solution across JavaScript/TypeScript, Python, and Rust ecosystems, all with consistent APIs and synchronized versions.
