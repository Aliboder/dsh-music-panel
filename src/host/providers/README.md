# Third-party providers

`netease.js`, `qq.js`, `qrc.js`, `krc.js`, `yrc.js` and
`vendor/qrcode.mjs` are ported from the MIT-licensed project
[kendu76/dsh-music-player](https://github.com/kendu76/dsh-music-player)
(see `LICENSE` in this directory for the original license text).

They implement the official client-side endpoints of NetEase Cloud Music and
QQ Music (request signing / encryption, QR login, stream lookup, lyric fetch).
Only interface adaptation was done here; no attempt is made to bypass paid
content — anonymous access plays free tracks, and signing in plays whatever
the account's own entitlement grants.

KuGou is **not** in this directory any more: it is the ported Folia source
module (`src/folia-mods/sources/kugou/`, mirrored verbatim) driven in the Host
through `src/host/providers/sources/kugou-folia/`, with KuGouMusicApi
(`src/host/vendor/kugoumusicapi/`) doing the platform requests.

`index.js` in this directory is our own adapter that exposes one small API
(`search` / `resolveStream` / `lyric`) to the Host routes.

These endpoints are unofficial and can change or rate-limit at any time.
Failures must stay inside the online view and never affect the local library.
