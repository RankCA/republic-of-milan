# Republic of Milan

Recruitment site for the Republic of Milan, a player nation in [Parlamentum](https://parlamentum.org), a geopolitical browser MMO.

**Live:** https://republic-of-milan.vercel.app

It is a single static page with no build step and no dependencies. It shows a countdown to Founding Day (Saturday 10 October 2026, 17:00 UTC), the founding cabinet and the Discord invite.

## Run locally

```bash
python3 -m http.server 4321
```

Then open http://localhost:4321.

## Files

- `index.html`: the page, with its CSS and JavaScript inline
- `poster-1.webp` to `poster-4.webp`: the recruitment poster in four 400px strips (fallback for older browsers)
- `poster-1.avif` to `poster-4.avif`: the same strips at 800px for sharp screens
- `og.webp`: the link preview image for Discord and other apps

## Credits

- Fonts: [Cinzel](https://fonts.google.com/specimen/Cinzel) and [Crimson Pro](https://fonts.google.com/specimen/Crimson+Pro), served by Google Fonts (SIL Open Font License)
- Icons: [Lucide](https://lucide.dev) (ISC License)
- Discord logo: [Simple Icons](https://simpleicons.org) (CC0). Discord is a trademark of Discord Inc.

Not affiliated with the developers of Parlamentum.
