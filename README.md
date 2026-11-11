# PAIRS Lab Website

Website for the Physical AI and Robotic Systems Lab at HKUST(GZ), built with Hugo.

## Live website

The site is deployed automatically with GitHub Pages:

https://pairslab.github.io/

## Local preview

Hugo Extended 0.135 or newer is recommended. The repository includes a local
Hugo binary under `.tools/`, but that directory is intentionally not committed.

```bash
./.tools/hugo server --disableFastRender
```

Open `http://localhost:1313/`.

## Update content

- Research directions: `data/research.yaml`
- Publications: `data/publications.yaml`
- People: `data/people.yaml`
- PI directory data: `data/people.yaml`
- PhD, MPhil, and RA profiles: one page bundle per member under `content/people/`
- Shareable member submission package: `member-profile-template/`
- News: one page bundle per update under `content/news/`; the homepage automatically shows the three most recent entries
- Recruitment copy: `layouts/join/list.html`
- Homepage: `layouts/index.html`
- Shared header and footer: `layouts/partials/`
- Approved PAIRS Lab web brand assets: `static/brand/`
- Site styling: `static/css/site.css`
- Images and video: `static/images/` and `static/media/`

Only confirmed lab members and verified research information should be added.
Use only the approved assets documented in `docs/brand-assets.md` when changing
logos, icons, or core brand colours.

## Production build

```bash
./.tools/hugo --gc --minify
```

The generated site is written to `public/`.

## Media and browser caching

Hugo generates WebP display images from the original files through
`layouts/partials/image-url.html`. CSS, JavaScript and SVG URLs are fingerprinted;
editing the source automatically changes the URL, without a manual version bump.
Keep the originals and edit them normally; do not commit generated `resources/`.

`assets/js/media.js` manages video loading and playback for the whole site.
Only visible, active videos play. Research direction cards use six-second,
640-pixel H.264 clips in `static/media/research/previews/`; each topic's `preview`
field selects the clip, while `demo` retains the full video for its detail card.

Production pages register `static/sw.js`. It caches only content-addressed assets,
up to 60 files of 512 KiB each (30 MiB of bodies), for at most 14 days. HTML is
revalidated against the network; videos, Range requests and external URLs bypass
this cache. The footer's **Refresh site cache** clears only PAIRS asset caches and
reloads the page. Pet stats, likes, preferences and exploration progress remain
in local storage. Storage denial falls back to ordinary browser loading.

Normal `hugo server` development previews do not register a service worker. Use
`hugo server --environment production --disableFastRender` on localhost to test
the production cache. Increment the worker's cache version when its storage
format or policy changes; activation removes older PAIRS asset caches.

## Deployment

Every push to `main` runs `.github/workflows/publish.yaml`. GitHub Actions builds
the site with the Pages URL as Hugo's production `baseURL`, uploads the static
artifact, and publishes it to GitHub Pages.

No generated `public/` files need to be committed.
