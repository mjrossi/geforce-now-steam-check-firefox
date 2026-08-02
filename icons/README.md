# Icons

`icon.svg` is the source of truth — edit that. The PNGs are generated from it and are
what the manifest actually points at.

## Why PNGs and not the SVG directly

The manifest declares five icon sizes (16/32/48/96/128). Pointing all of them at one
SVG makes the declared size a label with no effect: the file carries an intrinsic
96×96, so any surface that doesn't constrain both dimensions in CSS draws it at 96px.
`about:addons` is such a surface, which is where it showed up as an oversized icon.
Exact-size rasters make the intrinsic size correct for every slot.

## Regenerating

Rasterize with headless Chrome after editing `icon.svg`:

```bash
for N in 16 32 48 96 128; do
  cat > /tmp/icon-$N.html <<HTML
<!doctype html>
<style>html,body{margin:0;padding:0;background:transparent}
svg{display:block;width:${N}px;height:${N}px}</style>
$(cat icons/icon.svg)
HTML
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --no-first-run --disable-background-networking --disable-component-update \
    --force-device-scale-factor=1 --force-color-profile=srgb \
    --default-background-color=00000000 \
    --user-data-dir=/tmp/chrome-icon-$N \
    --window-size=$N,$N --screenshot=icons/icon-$N.png \
    "file:///tmp/icon-$N.html" &
  sleep 20; kill $! 2>/dev/null   # Chrome writes the file, then does not exit
done
```

Three things that are easy to get wrong:

- **`--headless=new`.** The legacy `--headless` renders Chrome's error page instead.
- **`--force-color-profile=srgb`.** Without it Chrome colour-manages the output and the
  NVIDIA green drifts a couple of levels off `#76b900`.
- **Not `qlmanage -t`.** It produces document-style *thumbnails* — the art at intrinsic
  size in the corner of a padded canvas — which is what shipped in 0.2.1 and rendered as
  a tiny icon in a white box.

Verify before committing: each file must be exactly N×N, with transparent corners
(the artwork is a full-bleed rounded square) and no padding.
