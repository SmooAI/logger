#!/usr/bin/env python3
"""Bundle the log-viewer binary for Python distribution."""

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> None:
    """Bundle the log-viewer binary into the Python package."""
    # Get paths
    python_dir = Path(__file__).parent.parent
    root_dir = python_dir.parent
    manifest_path = root_dir / "log-viewer" / "Cargo.toml"

    if not manifest_path.exists():
        print("bundle-log-viewer: manifest not found, skipping build", file=sys.stderr)
        return

    # Check if cargo is available
    try:
        result = subprocess.run(["cargo", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode != 0:
            raise subprocess.CalledProcessError(result.returncode, "cargo --version")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("bundle-log-viewer: cargo not detected on PATH, skipping build", file=sys.stderr)
        return

    # Build the binary
    print("bundle-log-viewer: building log-viewer binary...")
    build_result = subprocess.run(["cargo", "build", "--release", "--manifest-path", str(manifest_path)], cwd=root_dir)

    if build_result.returncode != 0:
        print("bundle-log-viewer: cargo build failed", file=sys.stderr)
        sys.exit(build_result.returncode)

    # Determine binary name and paths
    current_platform = platform.system().lower()
    current_arch = platform.machine().lower()

    # Map Python platform names to npm format
    platform_mapping = {"darwin": "darwin", "linux": "linux", "windows": "win32"}

    # Map Python arch names to npm format
    arch_mapping = {"x86_64": "x64", "amd64": "x64", "arm64": "arm64", "aarch64": "arm64"}

    mapped_platform = platform_mapping.get(current_platform)
    mapped_arch = arch_mapping.get(current_arch)

    if not mapped_platform or not mapped_arch:
        print(f"bundle-log-viewer: unsupported platform {current_platform}/{current_arch}", file=sys.stderr)
        sys.exit(1)

    binary_name = "smooai-log-viewer.exe" if mapped_platform == "win32" else "smooai-log-viewer"
    source_binary = root_dir / "log-viewer" / "target" / "release" / binary_name

    if not source_binary.exists():
        print(f"bundle-log-viewer: expected binary at {source_binary} but none was found", file=sys.stderr)
        sys.exit(1)

    # Create destination directory
    dest_dir = python_dir / "log-viewer" / f"{mapped_platform}-{mapped_arch}"
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest_binary = dest_dir / binary_name
    shutil.copy2(source_binary, dest_binary)

    # Make executable on Unix-like systems
    if mapped_platform != "win32":
        dest_binary.chmod(0o755)

    print(f"bundle-log-viewer: packaged {dest_binary}")


if __name__ == "__main__":
    main()
