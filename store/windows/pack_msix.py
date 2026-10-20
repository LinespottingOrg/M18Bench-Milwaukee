"""Pack a folder into an unsigned MSIX. Partner Center still needs the publisher changed and a signature."""

import hashlib
import os
import struct
import sys
import zlib
from pathlib import Path
from xml.sax.saxutils import escape

BLOCK = 64 * 1024
SKIP = {"appxmanifest.xml", "appxblockmap.xml", "[content_types].xml", "appxsignature.p7x"}

CONTENT_TYPES = {
    "exe": "application/x-msdownload",
    "dll": "application/x-msdownload",
    "png": "image/png",
    "xml": "application/octet-stream",
    "js": "application/javascript",
    "cjs": "application/javascript",
    "mjs": "application/javascript",
    "css": "text/css",
    "html": "text/html",
    "json": "application/json",
    "svg": "image/svg+xml",
    "woff": "font/woff",
    "woff2": "font/woff2",
    "pak": "application/octet-stream",
    "bin": "application/octet-stream",
    "dat": "application/octet-stream",
    "ico": "image/vnd.microsoft.icon",
    "txt": "text/plain",
    "node": "application/octet-stream",
}


def dos_name(path: Path, root: Path) -> str:
    rel = path.relative_to(root).as_posix().replace("/", "\\")
    if rel.lower() in SKIP:
        return ""
    return rel


def block_hashes(data: bytes) -> list[str]:
    if not data:
        return []
    out = []
    for offset in range(0, len(data), BLOCK):
        digest = hashlib.sha256(data[offset : offset + BLOCK]).digest()
        out.append(__import__("base64").b64encode(digest).decode("ascii"))
    return out


def collect(root: Path) -> list[tuple[str, bytes]]:
    files: list[tuple[str, bytes]] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        for name in sorted(filenames):
            path = Path(dirpath) / name
            if not path.is_file():
                continue
            zip_name = dos_name(path, root)
            if not zip_name:
                continue
            files.append((zip_name, path.read_bytes()))
    return files


def content_types(names: list[str]) -> str:
    extensions = sorted({Path(name.replace("\\", "/")).suffix.lower().lstrip(".") for name in names if "." in name})
    defaults = []
    for ext in extensions:
        kind = CONTENT_TYPES.get(ext, "application/octet-stream")
        defaults.append(f'  <Default Extension="{ext}" ContentType="{kind}"/>')
    body = "\n".join(defaults)
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
{body}
  <Override PartName="/AppxManifest.xml" ContentType="application/vnd.ms-appx.manifest+xml"/>
  <Override PartName="/AppxBlockMap.xml" ContentType="application/vnd.ms-appx.blockmap+xml"/>
</Types>
"""


def block_map(entries: list[tuple[str, bytes]]) -> str:
    files = []
    for name, data in entries:
        blocks = "\n".join(f'    <Block Hash="{item}"/>' for item in block_hashes(data))
        inner = f"\n{blocks}\n  " if blocks else ""
        files.append(
            f'  <File Name="{escape(name)}" Size="{len(data)}" LfhSize="{30 + len(name.encode("utf-8"))}">{inner}</File>'
        )
    body = "\n".join(files)
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<BlockMap xmlns="http://schemas.microsoft.com/appx/2010/blockmap" HashMethod="http://www.w3.org/2001/04/xmlenc#sha256">
{body}
</BlockMap>
"""


def zip_bytes(entries: list[tuple[str, bytes]]) -> bytes:
    local_parts = []
    central = []
    offset = 0
    for name, data in entries:
        name_b = name.encode("utf-8")
        crc = zlib.crc32(data) & 0xFFFFFFFF
        comp = zlib.compress(data, 6)[2:-4]
        method = 8
        if len(comp) >= len(data):
            comp = data
            method = 0
        local = struct.pack(
            "<IHHHHHIIIHH",
            0x04034B50,
            20,
            0,
            method,
            0,
            0x21,
            crc,
            len(comp),
            len(data),
            len(name_b),
            0,
        ) + name_b + comp
        central.append(
            struct.pack(
                "<IHHHHHHIIIHHHHHII",
                0x02014B50,
                20,
                20,
                0,
                method,
                0,
                0x21,
                crc,
                len(comp),
                len(data),
                len(name_b),
                0,
                0,
                0,
                0,
                0,
                offset,
            )
            + name_b
        )
        local_parts.append(local)
        offset += len(local)
    central_blob = b"".join(central)
    end = struct.pack(
        "<IHHHHIIH",
        0x06054B50,
        0,
        0,
        len(entries),
        len(entries),
        len(central_blob),
        offset,
        0,
    )
    return b"".join(local_parts) + central_blob + end


def pack(source: Path, manifest: str, dest: Path) -> None:
    payload = collect(source)
    names = [name for name, _data in payload]
    types = content_types(names).encode("utf-8")
    manifest_b = manifest.encode("utf-8")
    meta = [("[Content_Types].xml", types), ("AppxManifest.xml", manifest_b), *payload]
    mapped = block_map(meta).encode("utf-8")
    ordered = [("[Content_Types].xml", types), ("AppxBlockMap.xml", mapped), ("AppxManifest.xml", manifest_b), *payload]
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(zip_bytes(ordered))
    print(f"wrote {dest} ({dest.stat().st_size} bytes, {len(ordered)} files)")


def main() -> None:
    source = Path(sys.argv[1])
    manifest = Path(sys.argv[2]).read_text(encoding="utf-8")
    dest = Path(sys.argv[3])
    pack(source, manifest, dest)


if __name__ == "__main__":
    main()
