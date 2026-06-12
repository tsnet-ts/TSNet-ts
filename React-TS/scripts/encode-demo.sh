#!/usr/bin/env bash
# Re-encode landing demo video for fast streaming playback.
# Outputs: poster JPG + HLS stream segments.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../public/demo" && pwd)"
SRC="${1:-}"

if [[ -z "$SRC" ]]; then
  if [[ -f "$ROOT/demo.mov" ]]; then
    SRC="$ROOT/demo.mov"
  elif [[ -f "$ROOT/demo.mp4" ]]; then
    SRC="$ROOT/demo.mp4"
  else
    echo "Source not found: pass a screen recording path, e.g. npm run encode:demo -- ~/Movies/demo.mov" >&2
    exit 1
  fi
fi

if [[ ! -f "$SRC" ]]; then
  echo "Source not found: $SRC" >&2
  exit 1
fi

echo "Source: $SRC"

cd "$ROOT"
mkdir -p stream

# Crop: 40px letterbox + 90px browser chrome (tabs/address bar) from top.
# Preview a frame: ffmpeg -ss 3 -i demo.mov -vf "crop=2560:1478:56:130" -frames:v 1 /tmp/demo-crop-preview.jpg
CROP="crop=2560:1478:56:130"
SCALE="scale=2400:-2"
VF="${CROP},${SCALE}"
CRF=20
FPS=30

echo "→ Poster (instant first frame)"
ffmpeg -y -i "$SRC" -vf "$VF" -frames:v 1 -update 1 -q:v 2 demo-poster.jpg

echo "→ HLS stream (2 s segments)"
ffmpeg -y -i "$SRC" -an \
  -vf "$VF" \
  -c:v libx264 -preset slow -crf "$CRF" -r "$FPS" \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -hls_time 2 -hls_list_size 0 \
  -hls_segment_filename "stream/seg_%03d.ts" \
  stream/demo.m3u8

echo "Done."
ls -lh demo-poster.jpg stream/demo.m3u8 stream/seg_000.ts
