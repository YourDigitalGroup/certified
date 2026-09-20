# Digital Certification portal — admin & hosting guide

The training portal now has sign-in, per-person progress stored on the server, and an admin panel at `/admin`.
This document covers how it fits together, what the host needs, and how to run it day to day.

## What lives where

| Path | Purpose |
| --- | --- |
| `index.html` | The training portal (the former `Digital House Training Portal.dc.html`). Served automatically at the site root. |
| `login.html` | Sign in, first-time password creation, forced password change. |
| `portal-boot.js` | Runs before the portal: checks the session, loads progress and course overrides, then starts the app. |
| `admin/` | The admin panel (plain HTML/JS, no build step). |
| `api/` | PHP endpoints. `config.php` holds paths and limits. |
| `vendor/` | Local copies of React (the runtime used to fetch them from unpkg.com on every visit). |
| `.htaccess` | Apache compression and caching rules for the whole site (see **Speed**). |
| `tools/optimize-images.py` | Shrinks the slide images the portal references; run after adding pictures (see **Speed**). |
| `data/course-manifest.json` | Generated list of every course, its videos and original quiz. Regenerate with `node tools/build-course-manifest.mjs` after editing modules in `index.html`. |
| `data/portal.sqlite` | The live database, created by PHP on first request. Never committed. Blocked from the web by `data/.htaccess`. |
| `uploads/custom/` | Replacement videos uploaded through the admin panel. Created on the server at runtime. |

## Host requirements

- Apache-style shared hosting with **PHP 7.4 or newer** and the `pdo_sqlite` extension (standard on cPanel hosts).
- PHP must be able to **write** to `data/` (database) and `uploads/` (replacement videos). If a folder is not writable, set it to `755` owned by the PHP user, or `775`/`777` on hosts that run PHP as a different user.
- `.htaccess` files must be honoured (they are on Apache; on nginx, deny `/data/` in the server config instead).
- After deploying, open `https://your-site/api/auth.php?action=health`. Every value should be `true`.

The GitHub Action still deploys everything except `uploads/` (1.4 GB of training video) — keep syncing that folder by FTP as before.

## First sign-in

1. Go to the site root. You are sent to the sign-in page.
2. Sign in as `scott@44interactive.com` with the temporary password `44i123`.
3. You are required to choose a new password before continuing. After that, the **Admin** button appears in the portal header and `/admin` opens.

Only this account is a super admin at the start. Promote others under **People → (person) → Access → Role**.

## Roles

| Role | Can do |
| --- | --- |
| Student | Take the training. Courses unlock strictly in hub order: Our Process blocks 1–10, then Digital 101 Online Visibility, Content Marketing, then Digital 201. |
| Trainer | Everything a student can, plus **attendance**: mark who has passed which course (from a person's page or a course's Attendance tab), and email someone a password link. Sees everyone, pre-filtered to their own group. |
| Admin | Everything a trainer can, plus add/edit/import/delete people, set passwords, edit quizzes and replace videos. Cannot create or edit super admins. |
| Super admin | Full control, including granting/removing super admin and site settings (pass mark, portal title). |

Trainers, admins and super admins are not gated — they can open any course.

## People

- **Add a person**: first/last name, group name, email, phone, address, role, and one of two sign-in options:
  - *No password yet* — once email is set up (see **Email and password resets**) they receive a link to choose a password: tick *Email them the set-your-password link now*, or they get it when they first enter their email on the sign-in page. Without email they sign in with just their email the first time and create a password on the spot.
  - *Set a password now* — optionally require them to choose a new one at first sign-in.
- **Import CSV**: any column order, header row required. Recognised headers include `first_name`, `last_name`, `email`, `group`, `phone`, `address`, `city`, `state`, `zip`, `role`, `password`, `completed`, plus three for migrating from another system: `password_hash` (a WordPress `$wp$2y$…`/`$P$…` or bcrypt hash, so the person keeps their old password), `created_at` (registration date) and `last_login`. You confirm the column mapping before importing. Existing people (matched by email) are updated or skipped — your choice; a password hash or last sign-in only fills in a blank, never overwrites. A `completed` column (course ids or titles separated by `|`) records those courses as passed; append the date as `p1@2026-05-22` to keep the original pass date. Tick *Replace earlier imported or trainer-marked progress* to make the file the source of truth for the people in it: their passes from previous imports and trainer marks are cleared first and the file's list recorded instead, while passes earned in the portal's own quizzes are always kept. A downloadable template is in the import dialog.
- **Filters**: search (name, email, group, phone), group, role, **stage** (Not started · In progress · Process complete · Digital 101 complete · Fully certified) and **% complete band**, plus sort by name, group, most/least progress, last sign-in or newest. Stage means the furthest tier fully completed in unlock order.
- **Export CSV**: the whole directory including completed course ids.
- **Person page**: details, access (role, password, active, delete) and the **completed courses matrix** — tick or untick any course, or a whole section, then Save.

### Migrating from the old certified.44i.com site

The old site was WordPress + LearnPress. Its export was converted to `certified-legacy-users.csv` (109 people, their groups, WordPress password hashes, registration and last-login dates, and the nine "Our Process" quiz passes mapped to the matching blocks). Anyone who finished the old Process course outright is imported as fully certified on Our Process, all ten blocks including block 2, which had no quiz on the old site. Upload it through **People → Import CSV** with *Update people who already exist* selected; tick *Replace earlier imported or trainer-marked progress* to reset everyone in the file to the old site's record. People sign in with their old password; the hash is upgraded to a native one on their first successful login. The converter lives outside the repository (it needs the SQL dump); ask for it if the old site changes before cutover.

### The passwordless first sign-in

Until email is set up, anyone who knows an email address can claim an account that has no password yet; that is inherent in the "email only" option. Once Mailgun is configured (next section) an account can only be claimed through the link sent to that inbox, and the on-the-spot path is switched off.

## Groups

Groups are a managed list (seeded from `DEFAULT_GROUPS` in `api/config.php`; 38 names to start). When adding or editing a person you pick a group from the list; admins add, rename or merge groups under **Groups** (renaming onto an existing name merges the two). Deleting a group with members asks where to move them.

The **Groups** page shows every group with member count, how many have not started, how many have finished Our Process, how many are fully certified, average progress and last activity. Open a group to see its members with stage and progress, search or filter them by stage, **select everyone shown** (or tick individuals) and use **Mark passed…** to record one or more courses for all of them at once, with an optional note; **Remove pass…** reverses it. Admins can add a person straight into the group, rename or delete it, and anyone can export the member list as CSV.

Importing a CSV whose group column has a name not on the list creates that group (the import summary says how many). Group names are matched ignoring case, so "kensington" lands in "Kensington".

## Email and password resets (Mailgun)

Email is optional, but once it is set up people can help themselves:

- **Forgot your password?** on the sign-in page emails a one-time link. The link works once, expires after an hour, and requesting a new one cancels the old. The page gives the same answer whether or not the address has an account, so nobody can probe the directory.
- **First sign-in** for someone added without a password: entering their email sends them a "set your password" link instead of letting anyone who knows the address claim the account.
- **Add a person** has a ticked *Email them the set-your-password link now* box, so new people get their invitation straight away.
- **Email a reset link** on a person's page (trainer and up) sends the same email when someone is stuck; no more reading temporary passwords over the phone. Every link sent is written to the activity log.

### Setting it up

1. In Mailgun, add a sending domain (for example `mg.44i.com`), publish the DNS records it shows and wait for it to verify. Create a private API key under *API Security*.
2. In the admin panel open **Settings → Email (Mailgun)**. Enter the domain, pick the region your Mailgun account lives in (US or EU), paste the key, and set the From name and From address (an address on the sending domain, such as `noreply@mg.44i.com`). Reply-To is optional.
3. Check **Portal address used in links**. It is detected from the page you are on; saving pins it so emailed links always point at the live site.
4. **Save email settings**, then **Send a test email to me**.

Emails carry the 44i Digital logo (`assets/logo-email.png`, loaded from the portal address, since most email clients ignore SVG) above the portal title. The API key is stored in the database (blocked from the web by `data/.htaccess`) and only its last four characters are ever shown again. Until email is configured the sign-in page hides *Forgot your password?* and first sign-in falls back to on-the-spot password creation.

### If emails do not arrive

- *Mailgun rejected the API key (401)*: wrong key, or the region does not match your account.
- *Mailgun does not recognise that sending domain (404)*: check the spelling and the region.
- Sandbox domains only deliver to addresses you authorised in Mailgun; use a verified domain for real use.
- Mailgun's *Sending → Logs* shows every accepted, delivered or bounced message.
- Self-service requests are limited to 3 per address and 10 per connection per hour. Links sent by staff are not limited.

For local development start PHP with `PORTAL_MAIL_DRIVER=log`; every message is then appended to `data/tmp/mail.log` instead of being sent, and no API key is needed.

## Sign in as another person (impersonation)

On a person's page, the super admin sees a **Sign in as …** button. It switches your session to that person: you see the portal exactly as they do (their progress, their locks), and anything you do is recorded for their account. A bar at the bottom of the portal (and top of the admin panel) shows who you are viewing as, with a **Return to my account** button. Every action taken while impersonating is written to the activity log with your real account attached.

By default only `scott@44interactive.com` can do this, even if other super admins are added. To change that, edit `IMPERSONATE_ALLOWED_EMAILS` in `api/config.php` (an empty list allows every super admin).

## The `/admin` folder on the server

The hosting account previously served a CMS from `/admin`. `admin/.htaccess` makes this panel win: it serves `index.html` for the folder, ignores any inherited rewrite rules, and refuses to execute PHP or other scripts inside the folder. If `/admin` still shows the CMS after deploying, the host is routing that path before it reaches this folder (an alias or proxy rule); ask the host to remove it, or tell me and I'll move the panel to a different path.

## Courses

- **Attendance** (trainer+): filter by group, select individuals or everyone shown, add an optional note, then *Mark as passed* or *Remove pass*. Records show date, method (quiz / marked by trainer / imported) and who marked them.
- **Quiz** (admin+): edit question text, answer options (2–6), the correct answer, the "why" explanation and which section the question belongs to. Add, remove and reorder questions. *Reset to original* restores the built-in quiz. The portal uses your version immediately.
- **Videos** (admin+): every video the module plays, in order. *Replace video…* uploads a new `.mp4`/`.webm`/`.mov` in 1 MB pieces (so shared-host upload limits don't matter) and the portal serves it instead. *Revert to original* deletes the upload. Three videos are shared between two modules; the panel tells you which.

Modules built from interactive screens rather than video still have editable quizzes; their Videos tab explains there is nothing to replace.

## Narration and video loading

- Narration clips are generated by ElevenLabs **once per clip, on the server** (`api/tts.php`) and cached in `data/vo-cache/`. The first person to reach a section waits a moment while it is synthesized; everyone after that gets the cached clip immediately. Each browser also keeps its own copy. The API key lives in `api/config.php` (`ELEVENLABS_API_KEY`), not in the page. Only texts that appear in the course scripts can be synthesized, so the endpoint cannot be abused to generate arbitrary speech. To pre-warm the cache, click through a module once after editing its narration.
- Each section's video must be able to play through before narration starts. While it buffers, a "Loading video…" panel covers the video and the play button shows "…". A video that stalls never holds the lesson for more than 15 seconds.

## Speed

The training page is one large template (every course inline). What keeps it quick:

- **The template is inert.** It sits inside `<x-dc><script type="text/x-dc-template">…</script></x-dc>`, a non-executing block, so the browser neither parses it nor fetches the 125 videos and 100+ images it mentions when the page loads; only what the current screen shows is requested. The runtime receives the exact source text, which matters because the design-system components (the quiz's Submit button, for one) need their `onClick` props spelled in camelCase, and a parsed-DOM copy would lower-case them. Keep that wrapper when editing `index.html`, and never put a literal `</script>` inside the template.
- **One screen at a time.** Images inside the template carry `loading="lazy"`; a section's video downloads when the section appears, and while it plays the portal quietly warms up the *next* section's video (the pairing comes from `stepVideos` in `data/course-manifest.json`, so re-run the manifest builder after changing videos).
- **Nothing from third-party CDNs.** React is served from `vendor/`, and the runtime no longer re-downloads the page to re-read the template.
- **Compression and caching** come from the root `.htaccess`: HTML, CSS, JS and JSON are gzip/brotli compressed (the 2 MB page travels as roughly 350 KB), videos and images are cacheable for 30 days, scripts and styles for an hour, pages never. Every rule is inside `IfModule`, so a host missing a module just skips it. To confirm after a deploy: `curl -sI -H 'Accept-Encoding: gzip' https://your-site/index.html` should show `Content-Encoding: gzip`.
- **Smaller pictures.** `python3 tools/optimize-images.py` (needs `pip install pillow`) resizes anything wider than 1600 px, re-encodes opaque images as progressive JPEG (renaming `.png` → `.jpg` and fixing the references in `index.html`), keeps transparent ones as PNG or WebP, and only replaces a file when the result is at least 5% smaller. `--dry-run` shows what it would do. Run it whenever new slides are added.

## Keyboard shortcuts (for testing)

| Keys | Who | What |
| --- | --- | --- |
| `f` `f` (twice, quickly) | Everyone | Skip the current section's narration. |
| `a` `a` (twice, quickly) | Admin and super admin only | On a quiz, fill in the correct answer for every question. Students never get this. |

## Progress

- Passing a quiz in the portal records the pass on the server (`api/progress.php`). A pass needs the site-wide pass mark (default 100%).
- Trainer marks and imports count the same as a quiz pass for unlocking the next course.
- The old localStorage-only progress and the "TESTING" seed that pre-completed Digital 101 have been removed.

## Security notes

- Passwords are hashed with PHP's `password_hash`. Sessions are cookie-based (`HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS) and expire after 12 idle hours.
- Every state-changing request needs a per-session CSRF token; the UI sends it automatically.
- Password links carry a random 256-bit token. Only its SHA-256 hash is stored, each link works once, expires after an hour, and the token is removed from the address bar as soon as the page loads.
- Sign-in is throttled: 10 failures for an email or IP address within 15 minutes pauses that address.
- Uploaded videos are checked by extension and file signature, stored under `uploads/custom/`, and that folder gets an `.htaccess` that refuses to execute scripts.
- The portal page still embeds the ElevenLabs API key it always did (in the `data-props` attribute of `index.html`). It is visible to anyone who can view the page source; rotate it or move narration behind the API if that matters.

## Regenerating the course manifest

If you add, remove, or rename a module or a video in `index.html`:

```bash
node tools/build-course-manifest.mjs
```

Commit the updated `data/course-manifest.json`. Quiz edits and video replacements made in the admin panel are keyed by course id and original video path, so they survive a regeneration as long as those don't change. The manifest also records which video belongs to which section (`stepVideos`), which the portal uses to prefetch the next section's video.

## Local development

```bash
php -S 127.0.0.1:8085 -t .
# then open http://127.0.0.1:8085/
# with emails written to data/tmp/mail.log instead of sent:
PORTAL_MAIL_DRIVER=log php -S 127.0.0.1:8085 -t .
```

Delete `data/portal.sqlite` to start over (the super admin is re-seeded on the next request).
