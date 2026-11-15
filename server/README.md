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

## Daily missions

Daily mission definitions are stored in the `daily_missions` table. Server startup applies the migration automatically; to apply it manually, run `npm run db:migrate --prefix server` from the repository root. The migration seeds the initial sample missions only when the table is empty.

Supervisors manage missions through the authenticated `/api/supervisor/missions` endpoints. Customers can retrieve active missions, their daily completed-transaction progress, login streak, and earned-points balance from `GET /api/customer/missions`. Successful customer logins are recorded once per calendar day in `customer_login_days`; existing customers start building streak history after their next login following this migration. Completed mission awards are recorded once per customer, mission, and day in `customer_points_ledger`, and the points balance is the sum of those ledger entries. Transaction-count missions count completed imported transactions dated today; login-streak missions complete when the customer's consecutive login streak reaches the mission target.

Each login-streak mission has its own cycle. A successful login counts once per day; completing the target awards points on that login day. The next cycle starts with a login on a later day, and the previous award remains in the ledger. Missing a day breaks the consecutive streak; until the end of the next day, yesterday's progress remains visible so a login today can continue it. Existing awards remain intact and the most recent prior award marks the beginning of the next cycle. The streak shown in the page header is the overall consecutive-login streak, not a mission cycle. Calendar dates follow the MySQL session time zone.

Supervisors can view a customer's mission reward history in Customer Directory by opening the customer profile. The supervisor-only endpoint `GET /api/supervisor/customers/:phone/mission-rewards?page=1` returns the reward description, points and dates. New awards preserve the mission title at the time of the award. Older awards predate title snapshots and are labelled in the UI with the current mission name, which may have changed.