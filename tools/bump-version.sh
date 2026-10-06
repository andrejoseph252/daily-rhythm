#!/bin/sh
# Stamp the CSS/JS URLs with a fresh version before each deploy, so a browser
# never combines a new index.html with an old cached stylesheet or script.
set -e
cd "$(dirname "$0")/.."
v=$(date +%Y%m%d%H%M)
sed -i.bak -E "s/(style\.css|app\.js)(\?v=[0-9]+)?\"/\1?v=$v\"/g" index.html
for f in js/*.js; do
  sed -i.bak -E "s#from '\./([a-z]+)\.js(\?v=[0-9]+)?'#from './\1.js?v=$v'#g" "$f"
done
rm -f index.html.bak js/*.bak
echo "Assets stamped with v=$v"
