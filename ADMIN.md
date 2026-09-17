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
| Trainer | Everything a student can, plus **attendance**: mark who has passed which course (from a person's page or a course's Attendance tab). Sees everyone, pre-filtered to their own group. |
| Admin | Everything a trainer can, plus add/edit/import/delete people, set passwords, edit quizzes and replace videos. Cannot create or edit super admins. |
| Super admin | Full control, including granting/removing super admin and site settings (pass mark, portal title). |

Trainers, admins and super admins are not gated — they can open any course.

## People

- **Add a person**: first/last name, group name, email, phone, address, role, and one of two sign-in options:
  - *No password yet* — they sign in with just their email the first time and are asked to create a password.
  - *Set a password now* — optionally require them to choose a new one at first sign-in.
- **Import CSV**: any column order, header row required. Recognised headers include `first_name`, `last_name`, `email`, `group`, `phone`, `address`, `city`, `state`, `zip`, `role`, `password`, `completed`. You confirm the column mapping before importing. Existing people (matched by email) are updated or skipped — your choice. A `completed` column (course ids or titles separated by `|`) records those courses as passed. A downloadable template is in the import dialog.
- **Export CSV**: the whole directory including completed course ids.
- **Person page**: details, access (role, password, active, delete) and the **completed courses matrix** — tick or untick any course, or a whole section, then Save.

### The passwordless first sign-in

Anyone who knows an email address can claim an account that has no password yet. That is inherent in the "email only" option you chose; once a password is set it is the only way in. If you want more protection later, the API already stores enough to add an invite code.

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
- Sign-in is throttled: 10 failures for an email or IP address within 15 minutes pauses that address.
- Uploaded videos are checked by extension and file signature, stored under `uploads/custom/`, and that folder gets an `.htaccess` that refuses to execute scripts.
- The portal page still embeds the ElevenLabs API key it always did (in the `data-props` attribute of `index.html`). It is visible to anyone who can view the page source; rotate it or move narration behind the API if that matters.

## Regenerating the course manifest

If you add, remove, or rename a module or a video in `index.html`:

```bash
node tools/build-course-manifest.mjs
```

Commit the updated `data/course-manifest.json`. Quiz edits and video replacements made in the admin panel are keyed by course id and original video path, so they survive a regeneration as long as those don't change.

## Local development

```bash
php -S 127.0.0.1:8085 -t .
# then open http://127.0.0.1:8085/
```

Delete `data/portal.sqlite` to start over (the super admin is re-seeded on the next request).
