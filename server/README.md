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

## Customer notifications

Customer notifications are stored in the `notifications` table and are addressed by the customer's phone number. The authenticated `GET /api/notifications` endpoint returns the latest notifications and unread count. Customers can mark one notification read with `PATCH /api/notifications/:id/read` or all notifications read with `POST /api/notifications/read-all`.

Tier changes and daily mission progress create notifications from their source transactions. Mission reminders are emitted only at two or one remaining missions, and the daily reward notification is emitted once all active missions have been credited. Event keys include the customer and cycle date so repeated page loads do not repeat a notification.

## In-app support chat

This chat is separate from the LiveChat widget. Approved customers start a conversation from **Chat With Us**; supervisors and basic users share the **Support Chat** inbox and may reply to existing customer conversations. Customer access is limited to the authenticated customer's thread. History and inbox results are loaded in pages of 50. Messages contain text of up to 4,000 characters or one JPEG, PNG, GIF, WebP or PDF attachment, up to 50 MiB. Attachments are stored in the database and served only through authenticated downloads. A text message and an attachment sent together are saved as two messages.

Server startup applies the `014_support_chat` migration. Messages and attachment bytes become inaccessible 30 days after their individual send time. An hourly server job also deletes expired rows in batches, starting on server startup; failures are logged and retried on the next run. Physical deletion can therefore lag expiration, especially while the server is down. Existing database backup retention remains unchanged.

The realtime stream uses bearer-authenticated HTTP and reconnects with a history refresh after interruption. It uses in-process fan-out and requires one server instance per environment. Configure any reverse proxy to support long-lived streaming responses without buffering and permit uploads of at least 50 MiB. Set MySQL `max_allowed_packet` to at least 64 MiB on the database server, including replicas; ensure sufficient database space and server memory for concurrent 50 MiB uploads and downloads. Review database capacity, backup size, proxy timeouts and access controls before deployment. For example, check the database setting with `SELECT @@max_allowed_packet`; a lower setting can cause attachment uploads to fail.

## Supervisor notifications

Verified sign-ups and Daily Mission configuration changes notify all active supervisor accounts at the time of the event. The notification and source change are committed together. Notifications are private to each supervisor and use the same authenticated notification endpoints as customer notifications. The dashboard refreshes them periodically and when opened.

Sign-up alerts link to the corresponding pending application and remain visible after being read, prioritized ahead of other alerts in the latest list. Their status reflects the current application status; a subsequent sign-up for the same phone marks earlier alerts as superseded. The pending applications queue remains available on the supervisor dashboard. Mission alerts identify the changed mission, the supervisor, and the time of the change, and link to Daily Mission settings. Existing events and supervisors created after an event are not backfilled.

Daily mission points are credited automatically. Daily reward approvals, birthday freeplay approvals, and separate Daily Reward configuration are not currently implemented and therefore do not generate supervisor notifications.

## Supervisor records pages

The supervisor side menu links to dedicated Audit Log, Recent Transactions and Tier Configuration pages. `GET /api/supervisor/audit-logs` and `GET /api/supervisor/transactions` return paginated records (50 per page); transaction records include the player name and phone alongside transaction details. `GET /api/supervisor/tier-configuration` returns the saved tier names and minimum lifetime volumes without substituting defaults. Tier benefits are not currently stored as configuration. Supervisors can use the link on the tier page to edit thresholds and manual customer overrides on the dashboard.

## Confirmed notification and records decisions

- The notifications described above are delivered in-app only. Existing signup verification and review-decision SMS messages are separate from these notifications.
- Daily mission rewards are credited automatically; daily reward approval notifications remain deferred. Birthday freeplay requests and approval notifications also remain deferred.
- All active supervisors receive sign-up approval notifications. Future approval workflows should use the same recipient policy unless requirements change.
- Every actual Daily Mission configuration change triggers an alert, regardless of which authorized supervisor made it; saving without changes does not.
- Audit Log shows date/time, user, role, action, target and details. Recent Transactions shows player/account, transaction ID, type, amount, status and date/time. Both are sorted newest first and paginated, with no filters or export on these pages.