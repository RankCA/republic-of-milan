# Republic of Milan

Recruitment site for the Republic of Milan, a player nation in [Parlamentum](https://parlamentum.org), a geopolitical browser MMO.

**Live:** https://republic-of-milan.vercel.app

It is a static site with no build step and no dependencies. The home page shows a countdown to Founding Day (Saturday 10 October 2026, 17:00 UTC), the founding cabinet and the Discord invite.

## The Parliament

`/parliament` is the public Register of the Republic: every law, bill, treaty and resolution, set in type and readable on any device, with the original PDF beside it. Citizens can search the full text of every act. Each act has its own page, so a link pasted in Discord unfurls with the act's title and summary.

Members of Parliament table and edit acts through the Members' Entrance at `/parliament/portal`. Each member holds a personal seal (an access code like `MIL-XXXX-XXXX-XXXX`) issued by the Keeper of the Seals, who swears in members, issues new seals and revokes old ones under Members and seals.

The acts live in a Supabase project. Citizens can only read published acts; every change goes through a database function that checks the member's seal first, and only a hash of each seal is stored. The schema is in `supabase/migrations/`.

### Writing an act

The editor works like a word processor: MPs type straight onto the page of the act, which looks the way citizens will see it. The toolbar sets each line as normal text, a section, a heading, a clause, a bullet, a translation or a signature line, and inserts tables, signature blocks and dividers. Sections number themselves (1, 2, 3) and so do clauses within them (1.1, 1.2). There is undo and redo, Ctrl or Cmd+S saves, a preview shows the finished act, and unsaved work is kept on the device in case the tab closes.

Underneath, every act is stored as Markdown, and the Markdown tab shows it. Starting a line with these and pressing space also sets the style:

| Write | You get |
| --- | --- |
| `# Trade` | Section, numbered for you (stored as `# 1. Trade`) |
| `## Annex A: Spheres` | Heading without a number |
| `1.1 Both states shall` | Clause, numbered for you within its section |
| `- Prices are negotiated` | Bullet |
| `> Fiyatlar müzakere edilir` | Translation of the line above |
| `\| State \| Sphere \|` | Table row |
| `President ______` | Signature line |

Attach the PDF too. Its text is read in the browser and can be put straight onto the page as a first draft. It is also indexed for search.

## Run locally

```bash
node tools/serve.mjs 4321
```

Then open http://localhost:4321. The server applies the same rewrites as `vercel.json`, so Parliament links like `/parliament/acts/...` work.

To try the Members' portal without touching the live Register, open http://localhost:4321/parliament/portal?fake=1. It copies the published acts into a stand-in archive that lives only in that browser tab. Test seals: `FAKE-KEEP` (Keeper of the Seals) and `FAKE-MP01`. Open `?fake=0` to go back to the live Register.

## Files

- `index.html`: the page, with its CSS and JavaScript inline
- `poster-1.webp` to `poster-4.webp`: the recruitment poster in four 400px strips (fallback for older browsers)
- `poster-1.avif` to `poster-4.avif`: the same strips at 800px for sharp screens
- `og.webp`: the link preview image for Discord and other apps
- `parliament/`: the Parliament pages (`index.html`, `parliament.css`, `js/`), styled to match the home page, plus `vendor/pdfjs` for showing PDFs. `js/wp.js` is the word processor and `js/markup.js` reads and typesets the Markdown.
- `api/act.js`: gives each act page its own title and description for link previews
- `api/keepalive.js`: a daily Vercel cron that keeps the free Supabase project awake
- `supabase/migrations/`: the database schema and the first three treaties
- `vercel.json`: rewrites for the Parliament pages, the cron, and the function settings

## Credits

- Fonts: [Cinzel](https://fonts.google.com/specimen/Cinzel) and [Crimson Pro](https://fonts.google.com/specimen/Crimson+Pro), served by Google Fonts (SIL Open Font License)
- Icons: [Lucide](https://lucide.dev) (ISC License)
- PDF viewer: [PDF.js](https://mozilla.github.io/pdf.js/) by Mozilla (Apache License 2.0)
- Discord logo: [Simple Icons](https://simpleicons.org) (CC0). Discord is a trademark of Discord Inc.

Not affiliated with the developers of Parlamentum.
