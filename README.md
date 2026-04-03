# withings2fitbit

Syncs body weight and fat percentage from the [Withings API](https://developer.withings.com/) to the [Fitbit API](https://dev.fitbit.com/). Designed to run as a scheduled Docker container or as a one-shot script.

## Requirements

- Node.js 22+ (or Docker)
- OAuth2 credentials for both Withings and Fitbit
- A valid refresh token for each API

## Configuration

All configuration is via environment variables, typically provided in a `.env` file.

| Variable                 | Required | Default            | Description                                                                                    |
| ------------------------ | -------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `WITHINGS_CLIENT_ID`     | Yes      | —                  | Withings OAuth2 client ID                                                                      |
| `WITHINGS_CLIENT_SECRET` | Yes      | —                  | Withings OAuth2 client secret                                                                  |
| `WITHINGS_REFRESH_TOKEN` | Yes\*    | —                  | Withings refresh token (\*not needed if `withings-cache.json` exists)                          |
| `FITBIT_CLIENT_ID`       | Yes      | —                  | Fitbit OAuth2 client ID                                                                        |
| `FITBIT_CLIENT_SECRET`   | Yes      | —                  | Fitbit OAuth2 client secret                                                                    |
| `FITBIT_REFRESH_TOKEN`   | Yes\*    | —                  | Fitbit refresh token (\*not needed if `fitbit-cache.json` exists)                              |
| `TIMEZONE_STRING`        | No       | `America/New_York` | IANA timezone string (e.g. `Europe/London`)                                                    |
| `RUN_HOUR`               | No       | `12`               | Hour of day to run in scheduled mode (0–23)                                                    |
| `APP_MODE`               | No       | `MANUAL`           | `MANUAL` to run once and exit, `SCHEDULED` to run on a daily schedule                          |
| `PUSHOVER_USER`          | No       | —                  | Pushover user key (both `PUSHOVER_USER` and `PUSHOVER_TOKEN` required to enable notifications) |
| `PUSHOVER_TOKEN`         | No       | —                  | Pushover application token                                                                     |
| `DEBUG`                  | No       | `false`            | Set to `true` to enable verbose logging                                                        |

## Token caching

On each successful token refresh, the new token set is written to `withings-cache.json` or `fitbit-cache.json` in the working directory. On subsequent runs, the cached refresh token is used instead of the env var. These files are gitignored and should be persisted across container restarts (e.g. via a Docker volume).

## Running

### Directly

```bash
npm install
node app.js
```

### Docker

```bash
docker build -t withings2fitbit .
docker run --env-file .env -v $(pwd)/cache:/app withings2fitbit
```

For scheduled mode, keep the container running:

```bash
docker run --env-file .env -e APP_MODE=SCHEDULED -v $(pwd)/cache:/app withings2fitbit
```

## How it works

1. Fetches all measurements recorded since midnight (in the configured timezone) from the Withings API
2. Extracts weight (type 1) and body fat % (type 6) from the first measurement group
3. Posts each value to the corresponding Fitbit body log endpoint
4. Optionally sends a Pushover notification on success or failure
