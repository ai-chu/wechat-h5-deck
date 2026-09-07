#!/bin/bash
# 把 templates/poster.html 渲染成邀请函海报 PNG
#   ./scripts/shot.sh      → 1080×1920（微信发图用）
#   ./scripts/shot.sh 2    → 2160×3840（印刷备用）
set -e

# macOS 默认路径；Windows/Linux 请改成自己的 Chrome 可执行文件
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "找不到 Chrome，请设置环境变量 CHROME=<chrome 可执行文件路径>"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCALE="${1:-1}"
OUT="$ROOT/out"
mkdir -p "$OUT"
NAME=$([ "$SCALE" = "2" ] && echo "poster@2x.png" || echo "poster.png")

# virtual-time-budget 是留给 Google Fonts 和二维码渲染的时间。
# 调小会截到系统字体的回退版 —— 字重和字距都不对，一眼能看出来。
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor="$SCALE" \
  --window-size=1080,1920 \
  --virtual-time-budget=8000 \
  --screenshot="$OUT/$NAME" \
  "file://$ROOT/templates/poster.html" 2>/dev/null

echo "→ $OUT/$NAME"
