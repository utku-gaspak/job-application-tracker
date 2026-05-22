#!/bin/sh
set -e

if [ "${ENABLE_SCRAPER_VERIFICATION_DISPLAY:-1}" = "1" ]; then
  Xvfb "${DISPLAY:-:99}" -screen 0 "${SCRAPER_DISPLAY_GEOMETRY:-1920x1080x24}" &
  sleep 1

  x11vnc \
    -display "${DISPLAY:-:99}" \
    -forever \
    -shared \
    -nopw \
    -listen 0.0.0.0 \
    -rfbport 5900 &

  NOVNC_WEB_ROOT="${NOVNC_WEB_ROOT:-/usr/share/novnc}"
  if [ ! -d "$NOVNC_WEB_ROOT" ] && [ -d /usr/share/webapps/novnc ]; then
    NOVNC_WEB_ROOT="/usr/share/webapps/novnc"
  fi

  websockify --web="$NOVNC_WEB_ROOT" 6080 localhost:5900 &
fi

exec ./api
