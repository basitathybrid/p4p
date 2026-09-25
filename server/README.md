# Profile pictures

Customer, Basic User, and Supervisor pictures are stored on the server and linked to the authenticated account. Configure the database credentials in `server/.env`, then run `npm run db:migrate --prefix server` from the repository root (server startup also runs pending migrations).

Set `PROFILE_IMAGE_STORAGE_DIR` in the server environment to a **persistent** writable directory or mounted volume. The default `server/storage/profile-pictures` is suitable for local development, but ephemeral production filesystems lose pictures on redeploy. Back up this directory alongside the database. JPEG, PNG, and WebP files up to 5 MB are supported.

Customer pictures previously stored under a phone-specific browser key are migrated after that customer signs in from the original browser, if the server has no picture yet. Previous Supervisor and Basic User browser keys were not tied to individual accounts; those users should upload their picture once more after signing in. Further logins on other devices load the server copy.