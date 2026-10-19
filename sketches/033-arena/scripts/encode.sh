#!/usr/bin/env bash
# Usage: encode.sh RENDER_ROOT [MEDIA_ROOT]; desktop/ and mobile/ each contain 1-804.
set -euo pipefail
render_root="${1:?Usage: encode.sh RENDER_ROOT [MEDIA_ROOT]}"
sketch_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
media_root="${2:-$sketch_root/media}"
command -v ffmpeg >/dev/null || { echo 'ffmpeg must already be installed' >&2; exit 1; }
for camera in desktop mobile; do
  frames="$render_root/$camera"
  dest="$media_root/$camera"
  for ((frame=1; frame<=804; frame++)); do
    printf -v name 'frame-%04d.png' "$frame"
    [[ -f "$frames/$name" ]] || { echo "Missing $frames/$name" >&2; exit 1; }
  done
  mkdir -p "$dest"
  for mapping in '1:poster' '84:stop-1' '228:stop-2' '468:stop-3' '660:stop-4' '804:stop-5'; do
    frame="${mapping%%:*}"; name="${mapping#*:}"
    printf -v input 'frame-%04d.png' "$frame"
    # Homebrew ffmpeg may lack libwebp; cwebp is the fallback.
    if ffmpeg -hide_banner -encoders 2>/dev/null | grep libwebp >/dev/null; then
      ffmpeg -hide_banner -loglevel error -y -i "$frames/$input" -frames:v 1 -c:v libwebp -quality 80 "$dest/$name.webp"
    else
      cwebp -quiet -q 80 "$frames/$input" -o "$dest/$name.webp"
    fi
  done
  for segment in A B C D E; do
    case "$segment" in
      A) start=1; count=84; cap=1200000 ;;
      B) start=85; count=144; cap=1200000 ;;
      C) start=229; count=240; cap=2000000 ;;
      D) start=469; count=192; cap=1600000 ;;
      E) start=661; count=144; cap=1200000 ;;
    esac
    last=$((count - 1))
    # CRF with VBV, then lower bitrate budget only if measured file exceeds cap.
    budget=2200
    while :; do
      ffmpeg -hide_banner -loglevel error -y -framerate 24 -start_number "$start" \
        -i "$frames/frame-%04d.png" -frames:v "$count" -an -c:v libx264 -preset slow \
        -crf 25 -maxrate "${budget}k" -bufsize "${budget}k" -pix_fmt yuv420p \
        -g "$last" -keyint_min "$last" -sc_threshold 0 -force_key_frames "expr:eq(n,0)+eq(n,$last)" \
        -movflags +faststart "$dest/seg$segment.mp4"
      bytes="$(wc -c < "$dest/seg$segment.mp4")"
      [[ "$bytes" -le "$cap" ]] && break
      budget=$((budget * 8 / 10))
      [[ "$budget" -ge 300 ]] || { echo "Cannot meet $cap byte segment cap" >&2; exit 1; }
    done
    echo "$camera seg$segment: $bytes bytes"
  done
done
