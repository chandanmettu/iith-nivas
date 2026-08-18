# Known issues — Nivas

Things we know are wrong or unfinished. Listed here deliberately: an issue
recorded and accepted is a decision, an issue nobody wrote down is a surprise
waiting to happen.

**When you fix one:** move it to Fixed at the bottom, add the date and commit,
and don't delete it. The history of what was wrong is worth keeping.

**When you find one:** add it to Open with the next `NIV-` number. Say what
breaks and who it affects, not just what the code does.

> This file is public, like the rest of the repo. The site is live with real
> student data, so entries describe *what* is wrong and *what fixing it means* —
> not step-by-step how to exploit it. Operational detail lives in the private
> project tracker.

---

## Open

### NIV-001 — Contact details on listings are readable without signing in
**Severity:** High · **Affects:** students who ticked *share contact* · **Since:** launch

The read side of the listings API has no authentication, so the contact details
a student chose to share are reachable by anyone who can reach the site — not
only by other IITH students, which is the audience students realistically think
they are sharing with. Writes are properly gated behind `@iith.ac.in` email
verification; reads never were.

**Accepted for now.** Being tracked rather than fixed immediately.

**When we fix it, the options are:** require the same email verification for
reads that writes already use; return contact details only for one specifically
requested room instead of in a bulk listing; or put contact behind a separate
"reveal" call that can be rate-limited and logged. The first is the most
thorough and the most disruptive to how the board currently feels to use.

### NIV-002 — The bookmark waitlist is broader than intended
**Severity:** Medium · **Affects:** students who bookmarked a room · **Since:** launch

The bookmarks endpoint is keyed on a device token that the browser generates for
itself and the server never issues or checks, so it identifies a device but
authenticates nothing. The response also covers every room rather than the one
being looked at. The code's own comment describes the intent as showing names
"to whoever else is looking at that same room" — the behaviour is wider than
that intent.

**When we fix it:** scope the response to the room actually being viewed, or
keep the aggregate counts and drop the names from it.

### NIV-003 — No admin or moderation UI
**Severity:** Medium · **Affects:** us · **Since:** launch

Removing a bad or abusive listing means running a `DELETE` by hand in
phpMyAdmin. There is no way to review, hide, or take down a listing from the
app. Fine while the board is small and friendly; not fine the first time
somebody posts something they shouldn't, and worse once complaints ship (see
Upcoming features in the tracker — complaints will need status tracking and
takedown far more than listings do).

### NIV-004 — No backups configured
**Severity:** Medium · **Affects:** everyone · **Since:** launch

Nothing backs up the MySQL database. Every listing, bookmark and feedback row
exists in exactly one place. A bad migration or a host-side incident loses all
of it with no way back.

### NIV-005 — README has no screenshot
**Severity:** Low · **Affects:** anyone finding the repo · **Since:** always

The 3D viewer and the traced floor plans are the most distinctive thing about
this project and the repo shows neither. The README still says a screenshot is
"to be added".

---

## Fixed

### NIV-100 — Email verification could not run at all
**Fixed:** 2026-08-19 · `d0ed50a`

`nivas_mail()` reads `mail_from` and `mail_from_name`, but `config.example.php`
never defined either. Anyone setting up from the example produced a malformed
`From:` header, mail delivery failed, and the verify endpoint returned 500.
Because email verification is the only identity check in the system, that meant
nobody could publish a listing at all. Both keys are now in the example,
`nivas_mail()` logs a specific error instead of sending a broken header, and
`docs/DEPLOY.md` states that they are required.

### NIV-101 — Avatar initials were not escaped before rendering
**Fixed:** 2026-08-19 · `d0ed50a`

`initials()` wrote straight into `innerHTML`. Only the first character of each
of the first two words survives, so it was never enough to execute anything, but
a display name starting with `<` still corrupted the surrounding markup. Now
escaped like every other render site, and null-safe.

### NIV-102 — Docs claimed the project was not deployed
**Fixed:** 2026-08-19 · `e27a44c`

The README said a screenshot was "coming once this is deployed" and
`docs/DEPLOY.md` carried placeholder domains, long after the site went live at
[nivas.iith.online](https://nivas.iith.online). This actively misled a review
into treating live privacy issues as pre-launch questions. Both corrected.
