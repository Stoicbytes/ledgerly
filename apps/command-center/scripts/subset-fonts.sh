#!/usr/bin/env bash
# Rebuilds the web fonts in assets/fonts from @expo-google-fonts/inter (run from the app
# folder after updating that package). Needs fontTools with brotli:
#   python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install fonttools brotli
#   PYFTSUBSET=/tmp/fontenv/bin/pyftsubset scripts/subset-fonts.sh
set -euo pipefail
PYFTSUBSET="${PYFTSUBSET:-pyftsubset}"
SOURCE=node_modules/@expo-google-fonts/inter
# Latin with Latin-1 and Extended-A, punctuation, arrows, maths signs, € and ₹.
UNICODES="U+0000-017F,U+0192,U+02C6,U+02DC,U+2010-2027,U+2030-203A,U+2044,U+20AC,U+20B9,U+2122,U+2190-2199,U+2212,U+2215,U+2248,U+2260,U+2264,U+2265,U+25B2,U+25BC"
for weight in 400Regular 500Medium 600SemiBold 700Bold; do
  "$PYFTSUBSET" "$SOURCE/$weight/Inter_$weight.ttf" --unicodes="$UNICODES" \
    --layout-features='kern,liga,calt,tnum,case' --flavor=woff2 \
    --output-file="assets/fonts/Inter_$weight.woff2"
done
cp "$SOURCE/LICENSE_FONT" assets/fonts/OFL.txt
