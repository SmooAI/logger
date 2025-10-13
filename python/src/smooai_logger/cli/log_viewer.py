#!/usr/bin/env python3
"""Python wrapper for the smooai-log-viewer binary."""

import platform
import subprocess
import sys
from pathlib import Path


def find_binary() -> Path:
    """Find the log-viewer binary for the current platform."""
    current_platform = platform.system().lower()
    current_arch = platform.machine().lower()

    # Map Python platform names to the format used in the npm package
    platform_mapping = {"darwin": "darwin", "linux": "linux", "windows": "win32"}

    # Map Python arch names to npm format
    arch_mapping = {"x86_64": "x64", "amd64": "x64", "arm64": "arm64", "aarch64": "arm64"}

    mapped_platform = platform_mapping.get(current_platform)
    mapped_arch = arch_mapping.get(current_arch)

    if not mapped_platform or not mapped_arch:
        raise RuntimeError(f"Unsupported platform: {current_platform}/{current_arch}")

    binary_name = "smooai-log-viewer.exe" if mapped_platform == "win32" else "smooai-log-viewer"

    # Look for the binary in the package directory structure
    package_dir = Path(__file__).parent.parent.parent.parent
    binary_path = package_dir / "log-viewer" / f"{mapped_platform}-{mapped_arch}" / binary_name

    if not binary_path.exists():
        raise RuntimeError(
            f"[smooai-log-viewer] No binary found for {mapped_platform}/{mapped_arch}. Expected to find:\n"
            f"  {binary_path}\n"
            f"[smooai-log-viewer] Ensure Rust is installed and the binary has been built for your platform."
        )

    return binary_path


def main() -> None:
    """Main entry point for the log-viewer CLI."""
    try:
        binary_path = find_binary()

        # Execute the binary with the same arguments
        result = subprocess.run([str(binary_path)] + sys.argv[1:], stdout=sys.stdout, stderr=sys.stderr, stdin=sys.stdin)

        sys.exit(result.returncode)

    except KeyboardInterrupt:
        sys.exit(130)  # Standard exit code for SIGINT
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[smooai-log-viewer] Failed to launch the log viewer binary: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
