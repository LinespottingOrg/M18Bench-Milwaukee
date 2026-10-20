"""Copy the production build and the window host into store/windows/app."""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "store" / "windows" / "app"
HOST = ROOT / "store" / "windows" / "host"
STATIC = ROOT / ".vercel" / "output" / "static"
FUNCTIONS = ROOT / ".vercel" / "output" / "functions"

def copy_tree(src: Path, dest: Path) -> None:
    if dest.exists() or dest.is_symlink():
        if dest.is_symlink() or dest.is_file():
            dest.unlink()
        else:
            shutil.rmtree(dest)
    shutil.copytree(src, dest, symlinks=False)

def main() -> None:
    if not STATIC.exists() or not FUNCTIONS.exists():
        raise SystemExit("Run npm run build first. The Store window needs .vercel/output.")
    APP.mkdir(parents=True, exist_ok=True)
    for name in ("main.cjs", "serve.mjs", "package.json"):
        shutil.copyfile(HOST / name, APP / name)
    copy_tree(STATIC, APP / "static")
    copy_tree(FUNCTIONS, APP / "functions")
    print(APP)

if __name__ == "__main__":
    main()
