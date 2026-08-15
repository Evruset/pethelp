# Owner App mobile delivery

## Purpose

This runbook covers the React Native Owner App in `apps/owner-app`. GitHub Actions proves install/static/test/native-config gates; EAS Build produces signed Android/iOS artifacts. It does not authorize store publication or production deployment.

## Environment contract

| Profile | `VETHELP_ENV` | EAS environment | Distribution | API configuration |
| --- | --- | --- | --- | --- |
| `development` | `local` | development | internal development client | local explicit value or `http://localhost:3000` |
| `test` | `test` | preview | internal | required `EXPO_PUBLIC_API_BASE_URL`, HTTPS |
| `pilot` | `pilot` | production | internal | required `EXPO_PUBLIC_API_BASE_URL`, HTTPS |

Test and pilot must use different API endpoints, credentials and provider/telemetry environments. Values embedded through `EXPO_PUBLIC_*` are public mobile configuration, never secrets. T092 owns the final cross-system isolation matrix.

## Required external setup

1. Link `apps/owner-app` to the approved EAS project without committing credentials.
2. Configure the `development`, `preview` and `production` EAS environments with distinct public API URLs.
3. Store `EXPO_TOKEN` only as a GitHub Actions secret.
4. Configure platform signing credentials in EAS credential storage.
5. Never add signing keys, provider credentials, access tokens or private certificates to Git or workflow output.
6. Keep EAS remote app-version state authoritative; test and pilot profiles auto-increment native build numbers. The pinned EAS CLI version changes only through a reviewed delivery-config update.

## Pull-request gate

Changes to `apps/owner-app/**` run Node 22, `npm ci`, Expo Doctor, lint, TypeScript, Jest, test/pilot public-config validation and Expo prebuild validation. Signed native artifacts are not required for every pull request.

## Test build

1. Confirm the Owner App CI gate is green for the source commit.
2. Dispatch the `Owner App` workflow with `profile=test` and the required platform.
3. Record the uploaded `eas-build.json`, EAS build ID, git SHA, app version and platform build number.
4. Run the T015 smoke against that exact artifact and attach the result to the owning Jira checkpoint.

## Pilot promotion

Queue a `pilot` build only after applicable test acceptance, no blocking defects, approved pilot configuration and available signing credentials. Promote the same tested source commit unless an exception is documented. Store publication is a separate authorization.

## Rollback

Stop promotion of a bad artifact and redistribute the previous known-good signed build. Confirm backend compatibility before rollback or forward deployment. OTA/EAS Update is not an assumed rollback mechanism for first MVP.

## Evidence checklist

- GitHub Actions run URL and result;
- Android and iOS test build IDs;
- source git SHA and build metadata;
- distinct test/pilot public config evidence without values that disclose secrets;
- T015 smoke result and device matrix;
- known limitations and rollback decision.
