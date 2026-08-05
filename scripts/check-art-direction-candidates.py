#!/usr/bin/env python3
import copy
import hashlib
import json
import shutil
import struct
import tempfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "docs" / "art-direction"
CANDIDATES = ART / "candidates"
GENERATION = CANDIDATES / "generation.json"
MANIFEST = ART / "asset-manifest.json"
CONTACT = ART / "candidate-contact-sheet.html"
COMPARISON = ART / "candidate-comparison.md"
EXPECTED = {
    "A": "a-frontal-bench.png",
    "B": "b-exploded-assembly.png",
    "C": "c-seat-closeup.png",
    "D": "d-reward-stage.png",
}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def paeth(a, b, c):
    p = a + b - c
    distances = abs(p - a), abs(p - b), abs(p - c)
    return (a, b, c)[distances.index(min(distances))]


def parse_png(path):
    raw = path.read_bytes()
    require(raw.startswith(PNG_SIGNATURE), f"{path.name}: bad PNG signature")
    offset = len(PNG_SIGNATURE)
    chunks = []
    while offset < len(raw):
        require(offset + 12 <= len(raw), f"{path.name}: truncated chunk")
        length = struct.unpack(">I", raw[offset:offset + 4])[0]
        kind = raw[offset + 4:offset + 8]
        end = offset + 12 + length
        require(end <= len(raw), f"{path.name}: truncated {kind!r}")
        data = raw[offset + 8:offset + 8 + length]
        crc = struct.unpack(">I", raw[offset + 8 + length:end])[0]
        require(zlib.crc32(kind + data) & 0xFFFFFFFF == crc, f"{path.name}: bad CRC")
        chunks.append((kind, data))
        offset = end
        if kind == b"IEND":
            break
    require(offset == len(raw), f"{path.name}: trailing bytes")
    require(chunks and chunks[0][0] == b"IHDR" and len(chunks[0][1]) == 13, f"{path.name}: bad IHDR")
    require(chunks[-1][0] == b"IEND" and len(chunks[-1][1]) == 0, f"{path.name}: bad IEND")
    require(sum(kind == b"IHDR" for kind, _ in chunks) == 1, f"{path.name}: duplicate IHDR")
    width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", chunks[0][1])
    require(width > 0 and height > 0, f"{path.name}: empty dimensions")
    require(depth == 8 and color in (2, 6), f"{path.name}: expected 8-bit RGB/RGBA")
    require((compression, filtering, interlace) == (0, 0, 0), f"{path.name}: unsupported PNG method")
    idat = b"".join(data for kind, data in chunks if kind == b"IDAT")
    require(idat, f"{path.name}: missing IDAT")
    channels = 3 if color == 2 else 4
    stride = width * channels
    decoded = zlib.decompress(idat)
    require(len(decoded) == height * (stride + 1), f"{path.name}: malformed scanlines")
    previous = bytearray(stride)
    alpha_values = []
    for row_index in range(height):
        start = row_index * (stride + 1)
        filter_type = decoded[start]
        require(filter_type <= 4, f"{path.name}: invalid row filter")
        source = decoded[start + 1:start + 1 + stride]
        current = bytearray(stride)
        for index, value in enumerate(source):
            left = current[index - channels] if index >= channels else 0
            up = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            predictor = (0, left, up, (left + up) // 2, paeth(left, up, upper_left))[filter_type]
            current[index] = (value + predictor) & 0xFF
        if color == 6:
            alpha_values.extend(current[3::4])
        previous = current
    if color == 6:
        require(any(alpha < 255 for alpha in alpha_values), f"{path.name}: fully opaque RGBA")
    return raw, width, height, "RGB" if color == 2 else "RGBA"


def validate(candidate_dir, generation, manifest):
    records = generation.get("candidates", [])
    by_id = {item.get("id"): item for item in records}
    require(set(by_id) == set(EXPECTED) and len(records) == 4, "generation candidate IDs drift")
    actual_pngs = {path.name for path in candidate_dir.glob("*.png")}
    require(actual_pngs == set(EXPECTED.values()), "candidate PNG allowlist drift")
    require(generation.get("provider") == "openai-codex", "provider drift")
    require(generation.get("model") == "gpt-image-2-high", "model drift")
    require(generation.get("paidFallbackUsed") is False, "paid fallback must be false")

    assets = manifest.get("assets", [])
    require(len(assets) == 1, "manifest must contain one concept set")
    asset = assets[0]
    require(asset.get("kind") == "concept-reference-set", "manifest kind drift")
    require(asset.get("status") == "owner-selected", "owner-selected status drift")
    require(asset.get("selectedDirection") == "A whole-machine silhouette + B modular construction + C slot interaction; D only for reward timing", "selected direction drift")
    require(asset.get("generationRecord") == "candidates/generation.json", "generation record path drift")
    require(asset.get("loadPriority") == "documentation-only", "concepts must stay documentation-only")
    max_bytes = asset.get("maxBytesPerFile")
    require(isinstance(max_bytes, int) and max_bytes > 0, "invalid byte ceiling")
    manifest_files = {item.get("id"): item for item in asset.get("files", [])}
    require(set(manifest_files) == set(EXPECTED) and len(asset.get("files", [])) == 4, "manifest files drift")

    hashes = set()
    for candidate_id, filename in EXPECTED.items():
        record = by_id[candidate_id]
        entry = manifest_files[candidate_id]
        require(record.get("file") == filename, f"{candidate_id}: generation filename drift")
        require(entry.get("file") == f"candidates/{filename}", f"{candidate_id}: manifest filename drift")
        raw, width, height, mode = parse_png(candidate_dir / filename)
        digest = hashlib.sha256(raw).hexdigest()
        require(0 < len(raw) <= max_bytes, f"{candidate_id}: byte budget failure")
        require((width, height) == (record.get("width"), record.get("height")), f"{candidate_id}: generation dimensions drift")
        require((width, height) == (entry.get("width"), entry.get("height")), f"{candidate_id}: manifest dimensions drift")
        require(record.get("sha256") == digest == entry.get("sha256"), f"{candidate_id}: hash drift")
        require(entry.get("mime") == "image/png" and mode in entry.get("allowedColorModes", []), f"{candidate_id}: format drift")
        require(digest not in hashes, f"{candidate_id}: duplicate candidate")
        hashes.add(digest)


def validate_documents():
    contact = CONTACT.read_text()
    for candidate_id, filename in EXPECTED.items():
        require(f'candidates/{filename}' in contact, f"contact sheet missing {candidate_id}")
        require(f"<strong>{candidate_id}</strong>" in contact, f"contact sheet label missing {candidate_id}")
    lowered = contact.lower()
    for forbidden in ("http://", "https://", "<script", "@import", "<link"):
        require(forbidden not in lowered, f"contact sheet external resource: {forbidden}")
    for guardrail in ("width=device-width", "grid-template-columns", "max-width: 600px", "max-width: 100%", "min-width: 0"):
        require(guardrail in contact, f"contact sheet missing guardrail: {guardrail}")

    comparison = COMPARISON.read_text()
    for phrase in ("OWNER DIRECTION SELECTED", "Approved synthesis", "A", "B", "C", "D only", "HTML/SVG", "procedural"):
        require(phrase in comparison, f"comparison missing: {phrase}")


def expect_failure(label, operation):
    try:
        operation()
    except (ValueError, OSError, json.JSONDecodeError, zlib.error):
        return
    raise AssertionError(f"negative probe unexpectedly passed: {label}")


def main():
    generation = json.loads(GENERATION.read_text())
    manifest = json.loads(MANIFEST.read_text())
    validate(CANDIDATES, generation, manifest)
    validate_documents()

    bad_hash = copy.deepcopy(generation)
    bad_hash["candidates"][0]["sha256"] = "0" * 64
    expect_failure("hash drift", lambda: validate(CANDIDATES, bad_hash, manifest))

    bad_dimensions = copy.deepcopy(generation)
    bad_dimensions["candidates"][0]["width"] += 1
    expect_failure("dimension drift", lambda: validate(CANDIDATES, bad_dimensions, manifest))

    with tempfile.TemporaryDirectory() as temp:
        temp_dir = Path(temp)
        for filename in EXPECTED.values():
            shutil.copy2(CANDIDATES / filename, temp_dir / filename)
        shutil.copy2(CANDIDATES / EXPECTED["A"], temp_dir / "undeclared.png")
        expect_failure("undeclared PNG", lambda: validate(temp_dir, generation, manifest))

    print("art-direction candidates: PASS (4 files; drift probes passed)")


if __name__ == "__main__":
    main()
