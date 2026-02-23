#!/usr/bin/env python3
"""Bundle the log-viewer binary for Python distribution."""

import platform
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

GITHUB_REPO = "SmooAI/logger"

# Map Python platform names to npm format
PLATFORM_MAPPING = {"darwin": "darwin", "linux": "linux", "windows": "win32"}
ARCH_MAPPING = {"x86_64": "x64", "amd64": "x64", "arm64": "arm64", "aarch64": "arm64"}


def try_download(dest_binary: Path, mapped_platform: str, mapped_arch: str) -> bool:
    """Try to download a pre-built binary from GitHub Releases."""
    try:
        ext = ".exe" if mapped_platform == "win32" else ""
        asset_name = f"smooai-log-viewer-{mapped_platform}-{mapped_arch}{ext}"
        url = f"https://github.com/{GITHUB_REPO}/releases/latest/download/{asset_name}"

        print(f"bundle-log-viewer: attempting to download pre-built binary from {url}")
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=60) as response:
            data = response.read()

        dest_binary.parent.mkdir(parents=True, exist_ok=True)
        dest_binary.write_bytes(data)
        if mapped_platform != "win32":
            dest_binary.chmod(0o755)
        return True
    except Exception as e:
        print(f"bundle-log-viewer: download failed ({e}), falling back to cargo build", file=sys.stderr)
        return False


def main() -> None:
    """Bundle the log-viewer binary into the Python package."""
    python_dir = Path(__file__).parent.parent
    root_dir = python_dir.parent

    current_platform = platform.system().lower()
    current_arch = platform.machine().lower()

    mapped_platform = PLATFORM_MAPPING.get(current_platform)
    mapped_arch = ARCH_MAPPING.get(current_arch)

    if not mapped_platform or not mapped_arch:
        print(f"bundle-log-viewer: unsupported platform {current_platform}/{current_arch}", file=sys.stderr)
        sys.exit(1)

    binary_name = "smooai-log-viewer.exe" if mapped_platform == "win32" else "smooai-log-viewer"
    dest_dir = python_dir / "log-viewer" / f"{mapped_platform}-{mapped_arch}"
    dest_binary = dest_dir / binary_name

    # Try to download pre-built binary first
    if try_download(dest_binary, mapped_platform, mapped_arch):
        print(f"bundle-log-viewer: downloaded pre-built binary to {dest_binary}")
        return

    # Fall back to cargo build
    manifest_path = root_dir / "log-viewer" / "Cargo.toml"
    if not manifest_path.exists():
        print("bundle-log-viewer: manifest not found and no pre-built binary available, skipping", file=sys.stderr)
        return

    try:
        result = subprocess.run(["cargo", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode != 0:
            raise subprocess.CalledProcessError(result.returncode, "cargo --version")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("bundle-log-viewer: cargo not detected and no pre-built binary available, skipping", file=sys.stderr)
        return

    print("bundle-log-viewer: no pre-built binary found, building from source...")
    build_result = subprocess.run(["cargo", "build", "--release", "--manifest-path", str(manifest_path)], cwd=root_dir)

    if build_result.returncode != 0:
        print("bundle-log-viewer: cargo build failed", file=sys.stderr)
        sys.exit(build_result.returncode)

    source_binary = root_dir / "log-viewer" / "target" / "release" / binary_name
    if not source_binary.exists():
        print(f"bundle-log-viewer: expected binary at {source_binary} but none was found", file=sys.stderr)
        sys.exit(1)

    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_binary, dest_binary)
    if mapped_platform != "win32":
        dest_binary.chmod(0o755)

    print(f"bundle-log-viewer: built and packaged {dest_binary}")


if __name__ == "__main__":
    main()
