# A_other

Non-plugin material kept out of the plugin root. The plugin itself stays at the
repository root (`index.js`, `client.js`, `src/**`, `locale/**`, `scripts/**`,
`test/**`, package/config files).

| Folder | Contents |
|---|---|
| `releases/` | Historical `dsh-music-panel-*.tgz` release artifacts. |
| `design/` | UI prototypes, screenshots and design specs. |
| `docs/` | Architecture, migration, Folia porting, release and pitfall docs. |
| `shared/` | Root-level shared source that is not part of the plugin build (kept for reference). |
| `upstream/folia-major-main/` | Read-only Folia upstream checkout used by `scripts/build-icu-folia.mjs` and comparisons. |

These folders are not shipped by `package.json.files` and do not affect the
installed plugin at runtime.
