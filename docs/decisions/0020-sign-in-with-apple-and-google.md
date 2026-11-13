# 0020. Sign in with Apple and Google

- Status: Accepted
- Date: 2026-11-13

## Context

Most consumer apps offer "Continue with Google", and an iOS app that does must also offer Sign in with Apple
(App Store Review Guideline 4.8). The template had email and password only. The template's rules still apply:
it runs with no accounts, vendor libraries sit behind ports, and the backend is any REST API.

Two libraries matter:

- **Google:** `@react-native-google-signin/google-signin` is free and maintained, but on Android it uses
  Google's legacy Sign-In API, which Google has deprecated in favour of Credential Manager. The same authors
  sell a version on Credential Manager ("Universal Sign In").
- **Apple:** `@invertase/react-native-apple-authentication` wraps `ASAuthorizationController`. It still uses
  the old native module API (the New Architecture runs it through the interop layer), and its last release
  was in March 2026.

## Decision

- **A `SocialSignIn` port** in `src/shared/ports` with `providers()`, `signIn(provider)` and `signOut()`.
  `signIn` returns an ID token (and, for Apple, the raw nonce, the authorization code and the name) or `null`
  when the user cancels. Adapters: native (both libraries), none (no buttons), and a mock in `src/mocks`.
- **The backend decides.** The app sends the token to `POST /auth/social` and gets the usual
  `{ tokens, user }` back. The server checks the token's signature against Apple's or Google's public keys,
  its issuer, audience (the client ids), expiry and, for Apple, the nonce. It creates the account on the first
  sign-in, so the same buttons sit on the sign-in and register screens.
- **Apple on iOS only.** On Android it would need a web flow with a Services ID and a server callback, and
  nothing requires it there.
- **Configured from `.env`, hidden until then.** `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` (public values)
  and `IOS_APPLE_SIGN_IN`. `scripts/ios/configure-environments.rb` adds the Apple entitlement and Google's URL
  scheme per environment, like the push entitlement. With nothing set, the native modules aren't even loaded.
- **Mock providers with the mock backend.** When `API_MOCKS` is on (and in the demo APK), the buttons return
  a mock token that the mock backend accepts, so the flow works with no Google Cloud project or Apple team.
- **The providers' own buttons** (`AppleButton`, `GoogleSigninButton`), so the branding follows their rules.
- **Free Google library.** The deprecated Android API is a known limitation; the port makes swapping in the
  paid library, or a Credential Manager adapter, a change to one file.
- **Sign-out** also signs out of Google, so the account chooser shows next time.

## Consequences

- Two native dependencies, linked in every app even when the buttons are off. Both add little to the app
  (GoogleSignIn pulls AppAuth and GTMSessionFetcher on iOS).
- Real Apple sign-in needs a paid Apple team and the capability on the App ID; it can't be tried on a free
  account. Real Google sign-in needs OAuth clients in Google Cloud and, on Android, the signing key's SHA-1
  registered for each package name (`.dev`, `.staging`, prod).
- Account deletion must revoke the Apple token on the server (Guideline 5.1.1(v)), using the authorization code
  the app sends at sign-in. `docs/social-sign-in.md` lists what the backend must do.
- Linking a provider to an existing email account is the server's choice. The app shows a message for an
  `account_exists` error and offers no linking screen.
- Track B: `expo-apple-authentication` and the google-signin config plugin replace the native setup.

## Alternatives considered

- **Paid Google library (Credential Manager)** — the modern Android API, but a licence cost in a free
  template. Easy to add later behind the port.
- **`react-native-app-auth` (OAuth in a browser sheet)** — no deprecated APIs and works for any provider, but
  a browser sheet instead of the native account picker, and Apple still needs its own module on iOS.
- **Firebase Authentication** — handles tokens for us, but makes Firebase required, where today it's optional
  (ADR 0010), and ties the backend to Firebase.
- **A local Swift module for Apple** — about a hundred lines, kept in reserve if the Invertase library stops
  building.
