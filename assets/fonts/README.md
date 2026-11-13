# Fonts

`SignInSans-Medium.ttf` is used only by the "Continue with Google" button, whose text Google's branding
guidelines set in Google Sans Medium, 14/20 ([ADR 0020](../../docs/decisions/0020-sign-in-with-apple-and-google.md)).

It's a modified copy of [Google Sans](https://github.com/google/fonts/tree/main/ofl/googlesans) 14.000
(SIL Open Font License 1.1, [OFL.txt](OFL.txt)): a static Medium instance (`wght=500`, `GRAD=0`,
`opsz=17`) of the variable font, cut to Latin and Devanagari (188 KB instead of 5 MB). It's renamed
SignInSans because the Google Sans trademark terms don't let a modified font keep that name.

The app uses two copies of the same file: this one for iOS (listed in `ios/<App>/Info.plist` under
`UIAppFonts` and in the Xcode project's resources) and `android/app/src/main/assets/fonts/` for Android. A
test checks they're identical.

To rebuild it (fontTools 4.59):

```sh
fonttools varLib.instancer "GoogleSans[GRAD,opsz,wght].ttf" wght=500 GRAD=0 opsz=17 -o medium.ttf
pyftsubset medium.ttf --layout-features='*' --name-IDs='*' --notdef-outline --output-file=subset.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-205E,U+20B9,U+0900-097F,U+A8E0-A8FF,U+200C-200D,U+25CC"
```

Then set the family name (name IDs 1, 4, 6, 16) to SignInSans / SignInSans Medium / SignInSans-Medium.
