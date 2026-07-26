# Deploying Nivas — GitHub + Hostinger

The frontend is static files. The backend is PHP 8.1+ and MySQL, which is what
Hostinger shared hosting provides. There is no build step: what's in the repo
is what runs.

## 1. Database

hPanel → **Databases → MySQL Databases** → create a database and a user, and
note the four values (host is `localhost` on shared hosting).

Then **phpMyAdmin → Import** → upload `api/schema.sql` → Go. It creates seven
tables, all prefixed `nivas_`.

## 2. API config

`api/config.php` is **gitignored and must be created on the server** — never
commit real credentials.

```
cp api/config.example.php api/config.php
```

Fill in:

| Key | What it does |
|---|---|
| `db.*` | the four values from step 1 |
| `allowed_origins` | your live URL. Nothing else may call the API from a browser. |
| `email_domain` | `iith.ac.in` — listings can only be created from an institute address |
| `require_verification` | **keep `true`** (see Safety below) |

No mailbox is configured for this deployment. Feature requests save straight
to `nivas_feedback` — check that table in phpMyAdmin instead of expecting an
email. Verification codes (`require_verification: true`) also need
`nivas_mail()` to actually deliver, so re-add `mail_from`/`feedback_to` to
`config.php` first if you turn that back on.

## 3. Upload

Everything except `docs/` and `tmp/` goes to `public_html/`:

```
public_html/
  index.html  styles.css  app.js  viewer3d.js
  assets/  vendor/
  api/        ← including config.php, excluding schema.sql if you prefer
```

`api/.htaccess` already blocks `config.php` and `*.sql` from being served.

Check it works: `https://yourdomain/api/listings.php` should return
`{"ok":true,"listings":[],...}`. If you get PHP source instead, PHP isn't
enabled for that directory. If you get a 500, look at hPanel → Error log —
the API deliberately never prints stack traces to the browser.

## 4. Frontend → API

`app.js` defaults `API_BASE` to `./api`, so if the API sits beside
`index.html` there is nothing to configure. To point elsewhere, set it before
the script loads:

```html
<script>window.NIVAS_API_BASE = "https://api.yourdomain.com";</script>
```

Set `window.NIVAS_API_BASE = ""` to force offline mode (listings save to the
browser only) — useful for a demo.

**Feedback address.** The feature-request form's real destination is
`feedback_to` in `api/config.php` (server-side, gitignored — this is what
actually delivers feedback). `app.js`'s `FEEDBACK_TO` is only the client-side
`mailto:` fallback used when the API can't be reached at all; the committed
source deliberately ships a placeholder so no real address sits in a public
repo. If you want that offline fallback to point somewhere real too, set it
the same way as the API base, in your own deployed copy — never commit it:

```html
<script>window.NIVAS_FEEDBACK_TO = "you@iith.ac.in";</script>
```

## 5. GitHub

The repo is the source of truth for the frontend. Two sane options:

- **Manual**: push to GitHub, then upload changed files via hPanel or FTP.
- **Automatic**: hPanel → **Git** → connect the repo and enable auto-deploy on
  push to `main`. `config.php` is gitignored, so a deploy will not overwrite
  your credentials.

**Bump the `?v=` query** on `styles.css` / `app.js` / `viewer3d.js` in
`index.html` with every deploy, or the CDN serves stale files. Do it *last*,
after the edits are written — see PROGRESS.md for the incident where bumping
first cached a half-written stylesheet.

---

## Safety — read before sharing the link with 400 people

**Email verification is the only thing standing between your users and abuse.**
With `require_verification: false`, anyone can publish a listing with any name
and any phone number attached to any room, including rooms and numbers that
aren't theirs. With it on, a listing requires someone who can read mail at an
`@iith.ac.in` address, so every published number is traceable to an account.

What the system does and does not guarantee:

- **Does** prove the poster controls that institute mailbox.
- **Does** hide name and phone unless the student explicitly ticked the consent
  box. `api/listings.php` never even selects the email column.
- **Does** stop two people claiming the same room (unique key on hostel+room).
- **Does not** prove the poster actually lives in the room they listed. There
  is no allocation data to check against. A malicious verified student could
  still list someone else's room — you'd have their email in `nivas_owners` to
  act on, which is the point.

Other things worth knowing before launch:

- **Consent is publication.** A ticked box puts a real phone number on a public
  page with no login in front of it. Scrapers will find it. Say this plainly
  wherever you announce the tool, and make sure students know they can untick
  it or delete the listing at any time.
- **Rate limits** are per-IP: 5 codes / 15 min, 20 listing writes / hour, 6
  feedback / hour, 120 bookmarks / hour. Campus NAT means many students may
  share one IP — if legitimate users hit limits, raise them in
  `nivas_throttle()` calls.
- **Bookmarks are anonymous** (an opaque device token, no account). Counts are
  aggregate only; nobody can see who saved their room.
- **No backups are configured.** Turn on Hostinger's automatic backups, or the
  first bad `DELETE` loses every listing.
- Old verification codes and rate rows accumulate. They're small, but a monthly
  `DELETE FROM nivas_codes WHERE expires_at < NOW()` keeps things tidy.

## Removing someone's data

There is no admin UI yet. In phpMyAdmin:

```sql
DELETE FROM nivas_owners WHERE email = 'someone@iith.ac.in';
```

The foreign keys cascade, so their listing and preferences go with it.
