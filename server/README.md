# Profile pictures

Customer, Basic User, and Supervisor pictures are stored on the server and linked to the authenticated account. Configure the database credentials in `server/.env`, then run `npm run db:migrate --prefix server` from the repository root (server startup also runs pending migrations).

Set `PROFILE_IMAGE_STORAGE_DIR` in the server environment to a **persistent** writable directory or mounted volume. The default `server/storage/profile-pictures` is suitable for local development, but ephemeral production filesystems lose pictures on redeploy. Back up this directory alongside the database. JPEG, PNG, and WebP files up to 5 MB are supported.

### Amazon S3 storage (recommended for production)

Set these variables in `server/.env` to store pictures in S3 instead of the local filesystem (see `.env.example`):

| Variable | Description |
| --- | --- |
| `AWS_S3_BUCKET` | S3 bucket name. When set, S3 storage is enabled; leave empty for local disk. |
| `AWS_REGION` | Bucket region (default `us-east-1`). |
| `AWS_S3_PREFIX` | Key prefix inside the bucket (default `profile-pictures`). |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials. Omit on EC2/ECS/Lambda to use the instance/task role instead. |

The IAM identity needs `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/<prefix>/*`. Keep the bucket **private** — pictures are served through the authenticated API endpoints, not directly from S3. Existing locally stored pictures are not migrated automatically; re-upload or copy them to the bucket under the prefix.

Customer pictures previously stored under a phone-specific browser key are migrated after that customer signs in from the original browser, if the server has no picture yet. Previous Supervisor and Basic User browser keys were not tied to individual accounts; those users should upload their picture once more after signing in. Further logins on other devices load the server copy.