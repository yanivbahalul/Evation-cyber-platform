# EJS Partials

Shared layout fragments included by both the real and decoy templates.

| Files | Owner | Used by |
|-------|-------|---------|
| `head.ejs`, `foot.ejs`, `sidebar.ejs`, `topbar.ejs` | Sagiv | Real HR portal |
| `decoy-sidebar.ejs`, `decoy-kill-chain.ejs` | Bar | Decoy kill-chain UI |

Keeping layout in partials means the real and fake pages share a look, so the decoy is
harder to tell apart from the genuine portal.
