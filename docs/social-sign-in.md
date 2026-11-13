# Sign in with Apple and Google

The sign-in and register screens can show "Continue with Apple" (iOS) and "Sign in with Google" (iOS and
Android) under the email form. Each button appears once you've set it up in `.env`. Until then, the mock
backend provides both, so you can try the flow with no accounts
([ADR 0020](decisions/0020-sign-in-with-apple-and-google.md)).

## How it works

1. The user taps a button and picks an account in Apple's or Google's own sheet.
2. The app gets an ID token (a JWT signed by Apple or Google) and sends it to your backend at
   `POST /auth/social`.
3. Your backend checks the token, finds or creates the account, and returns the same `{ tokens, user }` as
   email sign-in.

| Part | Where |
| --- | --- |
| Port and adapters | `SocialSignIn` in `src/shared/ports`, `src/shared/adapters/native-social-sign-in.ts` |
| Buttons | `src/features/auth/components/SocialSignIn.tsx`, `src/shared/ui/primitives/SocialButton.tsx` |
| Request | `socialSignIn()` in `src/features/auth/api.ts`, `useSocialSignIn()` in its hooks |
| Mock | `src/mocks/social.ts` and the `/auth/social` handler in `src/mocks/handlers.ts` |

Apple is iOS only. Cancelling a sheet does nothing, and offline the buttons are disabled.

## Try it without accounts

With `API_MOCKS=true` (the dev environment's default) both buttons show and sign you in as the demo user.
The mock backend accepts only its own mock tokens.

## Set up Google

1. In [Google Cloud](https://console.cloud.google.com/apis/credentials), create a project and set up the
   OAuth consent screen.
2. Create three OAuth clients:
   - **Web application.** Its client id is the audience of every ID token. Put it in `GOOGLE_WEB_CLIENT_ID`.
   - **iOS**, with your bundle id. Put its client id in `GOOGLE_IOS_CLIENT_ID`.
   - **Android**, with your package name and the SHA-1 of the key that signs the app. Nothing goes in
     `.env`; Google matches the app by package and signature.
3. Each environment has its own app id (`com.acme.app.dev`, `.staging`, and the prod id), so add an iOS and
   an Android client for each environment you use, or give each environment its own project.
4. Run `bundle exec ruby scripts/ios/configure-environments.rb`, then rebuild.

Get the SHA-1 of the debug key with `cd android && ./gradlew signingReport`. Play App Signing re-signs your
release, so for apps from the Play Store also register the SHA-1 shown under **Setup → App signing** in Play
Console.

## Set up Apple

1. You need a paid Apple Developer account. In **Certificates, Identifiers & Profiles**, turn on **Sign in
   with Apple** for each App ID.
2. Set `IOS_APPLE_SIGN_IN=true` in each environment's `.env` and run
   `bundle exec ruby scripts/ios/configure-environments.rb`. It adds the entitlement.
3. Rebuild. On the simulator, sign in to an Apple Account in Settings first.

## What your backend must do

`POST /auth/social` gets JSON like this:

```json
{
  "provider": "apple",
  "idToken": "eyJ…",
  "nonce": "…",
  "authorizationCode": "…",
  "name": "Ada Lovelace"
}
```

`nonce`, `authorizationCode` and `name` come only from Apple, and `name` only on the first sign-in.

1. **Check the token.** Verify the signature with the provider's keys
   (`https://appleid.apple.com/auth/keys`, `https://www.googleapis.com/oauth2/v3/certs`), the issuer
   (`https://appleid.apple.com`, `https://accounts.google.com`), the audience (your bundle ids for Apple, the
   web client id for Google) and the expiry. Use a JWT library; don't parse it yourself.
2. **Check Apple's nonce.** The token's `nonce` claim must equal the SHA-256 (hex) of the `nonce` the app sent.
3. **Find the account by the token's `sub`**, not by email. Apple users can hide their email behind a relay
   address.
4. **Save the name** Apple sends on the first sign-in; it won't come again.
5. **Same email, other method:** link the accounts or refuse with error code `account_exists`. The app shows
   a message for that code.
6. **On account deletion,** revoke the Apple token: trade the stored `authorizationCode` for a refresh token
   at `https://appleid.apple.com/auth/token`, then call `/auth/revoke`. Apple requires this.

Return `200` (or `201` for a new account) with `{ "tokens": { "accessToken", "refreshToken" }, "user": … }`,
and `401` with code `invalid_token` when the check fails.

## Known limitations

- On Android, the free Google library uses Google's legacy Sign-In API, which Google has deprecated in
  favour of Credential Manager. A Credential Manager adapter (the paid library, or your own) only replaces
  `native-social-sign-in.ts`.
- Real Apple sign-in hasn't been tested from this template yet: it needs a paid Apple team. The build, the
  button and the mock flow are tested.
- No screen links a provider to an existing account; that's left to your backend.
