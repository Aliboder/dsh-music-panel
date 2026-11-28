# Third-party providers

`navidrome.js` and `vendor/qrcode.mjs` are ported from the MIT-licensed project
[kendu76/dsh-music-player](https://github.com/kendu76/dsh-music-player)
(see `LICENSE` in this directory for the original license text).

`navidrome.js` speaks OpenSubsonic (search3 / album / playlist / starred / lyrics) and is
the only platform module left in this directory.

NetEase Cloud Music, QQ Music, KuGou, Bodian and Qishui are **not** here any more: each is
the ported Folia source module (`folia/sources/<platform>/`, mirrored verbatim),
driven in the Host through `src/host/providers/sources/<platform>-folia/`. The old
self-written NetEase/QQ protocol modules (request signing, QR login, stream and lyric
lookup) and the old Bodian/Qishui adapters were retired with their tests once the ported
sources answered every call.

`index.js` in this directory is our own adapter. It hands Navidrome to the routes and
delegates every `kugou` / `kugouLite` call to the ported KuGou source
(`sources/kugou-folia/`) one line at a time; NetEase and QQ never reach it.

These endpoints are unofficial and can change or rate-limit at any time.
Failures must stay inside the online view and never affect the local library.
