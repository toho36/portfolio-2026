#!/usr/bin/env python3
import copy
import hashlib
import json
import re
import shutil
import struct
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = Path("docs/art-direction/selected-asset-manifest.json")
GENERATION_PATH = Path("docs/art-direction/selected/generation.json")
CONTACT_PATH = Path("docs/art-direction/selected-contact-sheet.html")
DIRECTION = "A whole-machine silhouette + B modular construction + C slot interaction; D only for reward timing"
SOURCES = {
    "machine-hero-reference": ("docs/art-direction/selected/machine-hero-reference.png", 1536, 1024, "49ffdcaa1d9f664af855a7cc8ca7190ee31b9047733a3c1a9f0655062329a0b3"),
    "cartridge-reference-board": ("docs/art-direction/selected/cartridge-reference-board.png", 1254, 1254, "61e3191e33000d8c7fb29379a3fa36724aef41d24ca08bf8e1eb7b08d901826b"),
    "material-lighting-board": ("docs/art-direction/selected/material-lighting-board.png", 1536, 1024, "6c122f17fca55c00e285e5a65c0075b8a7effbf6bcdbd514f4e3b11faeca8352"),
}
OUTPUTS = {
    "machine-fallback": ("public/assets/machine/machine-fallback.webp", "image/webp", 1536, 1024, 400_000),
    "og-image": ("public/og-image.webp", "image/webp", 1200, 630, 300_000),
    "favicon": ("public/favicon.svg", "image/svg+xml", 64, 64, 4_096),
}
QUALITY_LADDER = [82, 78, 74, 70]
LOCKED_PALETTE = {"#0A0B0F", "#D8D1C4", "#FF5A1F", "#42E8FF"}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def parse_png(path):
    raw = path.read_bytes()
    require(raw.startswith(PNG_SIGNATURE), f"{path}: bad PNG signature")
    require(len(raw) >= 33 and raw[12:16] == b"IHDR", f"{path}: missing IHDR")
    require(struct.unpack(">I", raw[8:12])[0] == 13, f"{path}: malformed IHDR")
    width, height = struct.unpack(">II", raw[16:24])
    require(width > 0 and height > 0, f"{path}: empty PNG")
    return raw, width, height


def parse_webp(path):
    raw = path.read_bytes()
    require(len(raw) >= 20 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP", f"{path}: bad RIFF/WEBP signature")
    require(struct.unpack("<I", raw[4:8])[0] == len(raw) - 8, f"{path}: RIFF size drift")
    dimensions = []
    image_chunks = 0
    offset = 12
    while offset < len(raw):
        require(offset + 8 <= len(raw), f"{path}: truncated WebP chunk header")
        kind = raw[offset:offset + 4]
        size = struct.unpack("<I", raw[offset + 4:offset + 8])[0]
        start, end = offset + 8, offset + 8 + size
        padded_end = end + (size & 1)
        require(end <= len(raw) and padded_end <= len(raw), f"{path}: truncated {kind!r} chunk")
        data = raw[start:end]
        if kind == b"VP8X":
            require(len(data) == 10, f"{path}: malformed VP8X")
            dimensions.append((1 + int.from_bytes(data[4:7], "little"), 1 + int.from_bytes(data[7:10], "little")))
        elif kind == b"VP8L":
            require(len(data) >= 5 and data[0] == 0x2F, f"{path}: malformed VP8L")
            bits = int.from_bytes(data[1:5], "little")
            dimensions.append(((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1))
            image_chunks += 1
        elif kind == b"VP8 ":
            require(len(data) >= 10 and data[3:6] == b"\x9d\x01\x2a", f"{path}: malformed VP8")
            width, height = struct.unpack("<HH", data[6:10])
            dimensions.append((width & 0x3FFF, height & 0x3FFF))
            image_chunks += 1
        offset = padded_end
    require(offset == len(raw), f"{path}: trailing WebP bytes")
    require(image_chunks == 1, f"{path}: expected exactly one static WebP image bitstream")
    require(dimensions and len(set(dimensions)) == 1, f"{path}: missing or conflicting WebP dimensions")
    return raw, dimensions[0][0], dimensions[0][1]


def parse_svg(path):
    raw = path.read_bytes()
    require(len(raw) <= OUTPUTS["favicon"][4], "favicon: byte budget failure")
    text = raw.decode("utf-8")
    lowered = text.lower()
    for token in ("<script", "<text", "<image", "<use", "<foreignobject", "<style", "url(", "href=", "xlink", "data:"):
        require(token not in lowered, f"favicon: forbidden {token}")
    require("http://" not in lowered.replace('xmlns="http://www.w3.org/2000/svg"', ""), "favicon: external URL")
    require("https://" not in lowered and "//" not in lowered.replace("http://www.w3.org/2000/svg", ""), "favicon: external URL")
    root = ET.fromstring(raw)
    namespace = "{http://www.w3.org/2000/svg}"
    require(root.tag == namespace + "svg", "favicon: root must be SVG")
    require(root.attrib.get("viewBox") == "0 0 64 64", "favicon: viewBox drift")
    paints = set()
    allowed_tags = {"svg", "g", "rect", "path", "circle"}
    for element in root.iter():
        tag = element.tag.removeprefix(namespace)
        require(tag in allowed_tags, f"favicon: forbidden element {tag}")
        require(not (element.text or "").strip() and not (element.tail or "").strip(), "favicon: text content")
        for name, value in element.attrib.items():
            require(not name.lower().startswith("on") and name not in {"href", "style", "src"}, f"favicon: forbidden attribute {name}")
            if name in {"fill", "stroke"}:
                paints.add(value.upper())
    require(paints == LOCKED_PALETTE, "favicon: locked four-color palette drift")
    return raw, 64, 64


class ContactParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        require(tag not in {"script", "link", "iframe", "object", "embed", "video", "audio", "source"}, f"contact sheet: forbidden <{tag}>")
        for name, value in attrs:
            if name in {"href", "src", "srcset", "poster", "action"}:
                require(tag == "img" and name == "src", f"contact sheet: forbidden resource attribute {tag}[{name}]")
                self.sources.append(value)


def validate_contact(root):
    text = (root / CONTACT_PATH).read_text()
    lowered = text.lower()
    for token in ("http://", "https://", "//", "@import", "url("):
        require(token not in lowered, f"contact sheet: external request token {token}")
    parser = ContactParser()
    parser.feed(text)
    expected = Counter({
        "selected/machine-hero-reference.png": 1,
        "selected/cartridge-reference-board.png": 1,
        "selected/material-lighting-board.png": 1,
        "../../public/assets/machine/machine-fallback.webp": 1,
        "../../public/og-image.webp": 1,
        "../../public/favicon.svg": 3,
    })
    require(Counter(parser.sources) == expected, "contact sheet: local asset allowlist drift")
    for source in expected:
        require((root / CONTACT_PATH.parent / source).resolve().is_file(), f"contact sheet: missing {source}")
    for phrase in ("procedural geometry", "not final meshes", "390px", "wordmark", "decals", "sprites", "portrait", "extra cartridge rasters", "glTF", "app integration"):
        require(phrase.lower() in lowered, f"contact sheet: missing {phrase}")
    for guard in ("width=device-width", "box-sizing: border-box", "overflow-x: hidden", "min-width: 0", "max-width: 100%", "overflow-wrap: anywhere", "@media (max-width: 600px)"):
        require(guard in text, f"contact sheet: missing responsive guard {guard}")


def expected_command(path, quality):
    source = "docs/art-direction/selected/machine-hero-reference.png"
    common = f"/opt/homebrew/bin/cwebp -quiet -q {quality} -m 6 -pass 10 -sharp_yuv -metadata none"
    if path.endswith("machine-fallback.webp"):
        return f"{common} {source} -o {path}"
    return f"{common} -crop 8 113 1520 798 -resize 1200 630 {source} -o {path}"


def validate(root, manifest, check_contact=True):
    require(manifest.get("schemaVersion") == 1 and manifest.get("ticket") == "t_9775f392", "manifest identity drift")
    require(manifest.get("selectedDirection") == DIRECTION, "selected direction drift")
    require(manifest.get("productGrammar") == "Assembly drag -> snap -> seat/eject", "product grammar drift")
    require(manifest.get("imageToVideo") == "rejected" and manifest.get("paidProviderUsed") is False, "provider/video boundary drift")
    require(manifest.get("outsidePrerequisites") == [] and manifest.get("serialSlices") == [], "scope admission drift")
    require(manifest.get("deferrals") == ["wordmark", "decals", "sprites", "portrait", "extra cartridge rasters", "glTF", "app integration"], "deferral list drift")
    encoder = manifest.get("encoder", {})
    require(encoder.get("path") == "/opt/homebrew/bin/cwebp" and encoder.get("version") == "1.6.0", "encoder provenance drift")
    require(encoder.get("qualityFallback") == QUALITY_LADDER, "quality fallback drift")

    generation = json.loads((root / GENERATION_PATH).read_text())
    require(generation.get("paidFallbackUsed") is False and generation.get("selectedDirection") == DIRECTION, "generation boundary drift")
    generated = {item.get("id"): item for item in generation.get("assets", [])}
    require(set(generated) == set(SOURCES) and len(generation.get("assets", [])) == 3, "generation source allowlist drift")
    selected_dir = root / "docs/art-direction/selected"
    require({path.name for path in selected_dir.glob("*.png")} == {Path(item[0]).name for item in SOURCES.values()}, "selected PNG allowlist drift")

    source_entries = {item.get("id"): item for item in manifest.get("sources", [])}
    output_entries = {item.get("id"): item for item in manifest.get("outputs", [])}
    require(set(source_entries) == set(SOURCES) and len(manifest.get("sources", [])) == 3, "manifest source allowlist drift")
    require(set(output_entries) == set(OUTPUTS) and len(manifest.get("outputs", [])) == 3, "manifest output allowlist drift")
    public_files = {path.relative_to(root).as_posix() for path in (root / "public").rglob("*") if path.is_file()}
    require(public_files == {item[0] for item in OUTPUTS.values()}, "filesystem output allowlist drift")

    hashes = set()
    for asset_id, (relative, width, height, expected_hash) in SOURCES.items():
        path = root / relative
        require(path.is_file() and not path.is_symlink(), f"{asset_id}: missing local source")
        raw, actual_width, actual_height = parse_png(path)
        actual_hash = digest(raw)
        record = generated[asset_id]
        entry = source_entries[asset_id]
        require((actual_width, actual_height, actual_hash) == (width, height, expected_hash), f"{asset_id}: approved source drift")
        require((record.get("file"), record.get("width"), record.get("height"), record.get("sha256")) == (Path(relative).name, width, height, expected_hash), f"{asset_id}: generation record drift")
        require(entry == {
            "id": asset_id,
            "path": relative,
            "source": "docs/art-direction/selected/generation.json",
            "generationCommand": "Approved gpt-image-2-high source; not rerun for packaging.",
            "mime": "image/png",
            "width": width,
            "height": height,
            "bytes": len(raw),
            "sha256": actual_hash,
            "responsiveUse": "Procedural geometry reference only; documentation contact sheet.",
            "loadPriority": "documentation-only",
            "fallback": "Not an application asset.",
        }, f"{asset_id}: manifest consistency drift")
        require(actual_hash not in hashes, f"{asset_id}: duplicate hash")
        hashes.add(actual_hash)

    for asset_id, (relative, mime, width, height, ceiling) in OUTPUTS.items():
        path = root / relative
        require(path.is_file() and not path.is_symlink(), f"{asset_id}: missing local output")
        if mime == "image/webp":
            raw, actual_width, actual_height = parse_webp(path)
        else:
            raw, actual_width, actual_height = parse_svg(path)
        actual_hash = digest(raw)
        entry = output_entries[asset_id]
        require((actual_width, actual_height) == (width, height), f"{asset_id}: dimensions drift")
        require(0 < len(raw) <= ceiling, f"{asset_id}: byte budget failure")
        require(entry.get("path") == relative and entry.get("source") == SOURCES["machine-hero-reference"][0], f"{asset_id}: source/path drift")
        require((entry.get("mime"), entry.get("width"), entry.get("height"), entry.get("bytes"), entry.get("sha256"), entry.get("maxBytes")) == (mime, width, height, len(raw), actual_hash, ceiling), f"{asset_id}: manifest file facts drift")
        for field in ("responsiveUse", "loadPriority", "fallback"):
            require(isinstance(entry.get(field), str) and entry[field], f"{asset_id}: missing {field}")
        if mime == "image/webp":
            quality = entry.get("selectedQuality")
            require(quality in QUALITY_LADDER and entry.get("generationCommand") == expected_command(relative, quality), f"{asset_id}: generation command drift")
        else:
            require(entry.get("generationCommand") == "Hand-authored original SVG; no generator.", "favicon: generation provenance drift")
        require(actual_hash not in hashes, f"{asset_id}: duplicate hash")
        hashes.add(actual_hash)
    require(len(hashes) == 6, "six unique asset hashes required")
    require(output_entries["og-image"].get("criticalCopy") == "Imagery only; no baked critical copy.", "OG critical-copy boundary drift")
    if check_contact:
        validate_contact(root)


def expect_failure(label, operation):
    try:
        operation()
    except (ValueError, OSError, UnicodeDecodeError, ET.ParseError, json.JSONDecodeError):
        return
    raise AssertionError(f"negative probe unexpectedly passed: {label}")


def main():
    manifest = json.loads((ROOT / MANIFEST_PATH).read_text())
    validate(ROOT, manifest)

    bad_hash = copy.deepcopy(manifest)
    bad_hash["sources"][0]["sha256"] = "0" * 64
    expect_failure("hash", lambda: validate(ROOT, bad_hash, False))

    bad_dimensions = copy.deepcopy(manifest)
    bad_dimensions["outputs"][0]["width"] += 1
    expect_failure("dimension", lambda: validate(ROOT, bad_dimensions, False))

    with tempfile.TemporaryDirectory() as temp:
        mirror = Path(temp)
        for relative in [GENERATION_PATH, CONTACT_PATH, MANIFEST_PATH]:
            target = mirror / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        for relative, *_ in SOURCES.values():
            target = mirror / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        for relative, *_ in OUTPUTS.values():
            target = mirror / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        undeclared = mirror / "public/undeclared.webp"
        shutil.copy2(mirror / OUTPUTS["og-image"][0], undeclared)
        expect_failure("undeclared output", lambda: validate(mirror, manifest, False))

        vp8x_only = mirror / "vp8x-only.webp"
        payload = bytes(4) + (1535).to_bytes(3, "little") + (1023).to_bytes(3, "little")
        body = b"WEBP" + b"VP8X" + struct.pack("<I", len(payload)) + payload
        vp8x_only.write_bytes(b"RIFF" + struct.pack("<I", len(body)) + body)
        expect_failure("VP8X without image bitstream", lambda: parse_webp(vp8x_only))

    print("selected art-direction assets: PASS (6 files; hash, dimension, undeclared-output, and decodability probes passed)")


if __name__ == "__main__":
    main()
