# vendor

Third-party libraries, stored locally (no CDN at runtime). Not changed.

| File | Library | Version | Source | License |
|---|---|---|---|---|
| `xlsx-0.20.3.mjs` | SheetJS Community Edition (ES module build) | 0.20.3 | <https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs> | Apache-2.0, see `xlsx.LICENSE` |

| `plotly-basic-4.1.2.min.js` | plotly.js, basic bundle (scatter, bar, pie), minified | 4.1.2 | <https://registry.npmjs.org/plotly.js-basic-dist-min/-/plotly.js-basic-dist-min-4.1.2.tgz> | MIT, see `plotly.LICENSE` |

SHA-256 of `xlsx-0.20.3.mjs`:
`1A0FB062EE9781B13F6687371B202AAEFC53B6CE55B530C027E01F9C087B77DB`

SHA-256 of `plotly-basic-4.1.2.min.js`:
`FA18ED1C94C06576C0A867BB2477534716C39E5B22AFFE673F2A184317974926`

The files in this folder are excluded from the type check
(`jsconfig.json`). The app code does not import them directly: the
library is passed as an argument (see `app/xls_read.js`, `app/app.js`).
`plotly-basic-4.1.2.min.js` is a classic script that sets `window.Plotly`;
`index.html` loads it and passes it on.

On Cloudflare Pages these files are kept in the browser for one year
(`app/_headers`). A new version of a library therefore needs a new file
name, see DEPLOY.md.
