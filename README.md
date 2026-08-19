# GoBag

A packing app built around **reusable bags** — for week-long trips and for just
heading to the pool.

Make a **bag** once (Swimming, Beach day, Camping, Week in Europe), then start a
**go** from it whenever you head out. Tick things off as they're packed. When you
get home, hit *Unpack all* and the same list is ready for the next go.

It's a Progressive Web App: plain HTML/CSS/JS, no build step, no dependencies. It
installs to your home screen and works with no signal — which matters, because
you're usually packing somewhere with bad wifi.

## Running it

Service workers don't run from `file://`, so it needs to be served over HTTP:

```bash
python3 -m http.server 8123 --directory gobag
```

Then open <http://localhost:8123>.

## Installing it on your phone

Put the folder on any static host (GitHub Pages, Netlify, Cloudflare Pages — all
free, and any of them will serve this as-is). HTTPS is required for the service
worker; `localhost` is the only exception.

- **iOS:** open in Safari → Share → *Add to Home Screen*
- **Android:** open in Chrome → the install prompt appears, or menu → *Install app*

Once installed it opens full-screen with no browser chrome.

## How it works

**Bags** are the reusable lists. **Gos** are the working copies you actually
tick off, so checking something off never touches the bag it came from.

Starting a go from more than one bag merges them and drops duplicates — pick
Swimming + Beach day and you get one "Swimsuit", not two. Sections with the same
name merge together.

Bags are edited as plain text, one item per line. A line starting with `#`
begins a new section:

```
Blanket
Basket

# Food
Sandwiches
Fruit

# Drink
Water
Wine
```

Everything is stored in `localStorage` on the device. There's no account, no
server, and no sync — which also means clearing site data wipes your bags.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and tab bar |
| `app.js` | State, hash routing, views, and actions |
| `styles.css` | Theme tokens plus light/dark styling |
| `sw.js` | Service worker — precaches the shell for offline use |
| `manifest.webmanifest` | Install metadata (name, icons, colors) |
| `icons/` | Generated PNGs; `icons/src/` holds the SVG sources |

### Regenerating the icons

Edit the SVGs in `icons/src/`, then (macOS):

```bash
cd gobag/icons && rm -rf .tmp && mkdir -p .tmp \
  && qlmanage -t -s 1024 -o .tmp src/icon-rounded.svg src/icon-square.svg src/icon-maskable.svg \
  && sips -Z 192 .tmp/icon-rounded.svg.png --out icon-192.png \
  && sips -Z 512 .tmp/icon-rounded.svg.png --out icon-512.png \
  && sips -Z 512 .tmp/icon-maskable.svg.png --out icon-maskable-512.png \
  && sips -Z 180 .tmp/icon-square.svg.png --out apple-touch-icon.png \
  && rm -rf .tmp
```

After changing any cached file, bump `CACHE` in `sw.js` so installed copies pick
up the new version instead of serving the old one from cache.

## Ideas for later

- Reordering items by drag
- A "what did I forget?" prompt that suggests items from similar past gos
- Export/import so bags survive a wiped browser
- Weather-aware suggestions for trip gos
