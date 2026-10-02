# VFA FINAL SETUP — DO THIS IN THIS ORDER

This package contains the portal code plus the two required Supabase fixes.

## 1. Supabase: Realtime sync

Open the Supabase project used by this portal → **SQL Editor**.

Open `VFA_REALTIME_SYNC_FIX.sql` from this ZIP, paste the whole file, and click **Run**.

The final query in that file should return the tables currently published to `supabase_realtime`.

**Do not skip this step.** The website code can subscribe to Realtime only after the database tables are in the Supabase Realtime publication.

## 2. Supabase: Admin single-device lock

Still in Supabase SQL Editor, open `VFA_ADMIN_SINGLE_SESSION_LOCK.sql`, paste the whole file, and click **Run**.

Run it once. It creates the lock table/functions if they are not already present.

The existing admin login behavior is preserved:
- First device can sign in normally.
- A second device using the same admin account is rejected.
- The second device does NOT sign out the first device.
- The second device gets the message that the account is already signed in elsewhere and must be logged out there first.
- The lock is released by the existing **Log Out** button.

## 3. Replace the website files

Use the files in this ZIP as the project version to put into your VS Code/Git repository.

Do not mix the `admin.js`, `dashboard.js`, or SQL files with older versions.

## 4. Test before pushing

Use two browsers/devices.

### Realtime test
1. Sign in to the admin portal on Device A.
2. Sign in to the authorized portal on Device B.
3. On Device A, save a real database change (for example an announcement, assignment, fee/payment record, grade, staff attendance, or student edit).
4. Leave Device B open on the relevant page.
5. Device B should update automatically. **Do not refresh Device B.**

### Single-device admin test
1. Keep Admin Account A signed in on Device A.
2. Try to sign in with the same Admin Account A on Device B.
3. Device B must be rejected with the already-signed-in message.
4. Confirm Device A is still signed in.
5. Log out on Device A.
6. Sign in with that admin account on Device B; it should now work.

## 5. Push to GitHub

From the project folder in VS Code's terminal:

```bash
git status
git add .
git commit -m "Fix realtime sync and admin single-device sessions"
git push
```

If your branch is not already connected to GitHub, check it with:

```bash
git remote -v
git branch --show-current
```

Do not force-push (`git push --force`) for this update.

## Important

The two SQL files are required backend changes. The ZIP alone cannot change Supabase's Realtime publication or create the admin session-lock functions.
