# Recent History

A local recent-files plugin for Eidos Lite hosts implementing Plugin API 3.7. [Chinese](README.zh-CN.md)

Requires Eidos Lite 0.29.0 or later and Plugin API 3.7.0. Names, commands, UI labels and bundled documentation follow
the host's English or Simplified Chinese language setting.

Enable the plugin and approve file-open metadata access and automatic startup.
It records file paths, opening counts and opening times whenever this Space is
open, including while the panel is closed. It does not read file contents or
access the network. Open **Recent History** in the sidebar, or run **Recent History: Open Panel**
from Cmd+K. Search by path, click any column header to toggle sorting, and click
a file to reopen it. The panel shows up to 200 matching files.

Changes are saved every 10 seconds to plugin-private storage on this device.
History is partitioned by Space; separate runs use separate keys so multiple
windows cannot overwrite each other's counts. Other windows' unsaved events
are not visible yet. History is not synced and existing Lite history is not
imported. Renamed files appear under a new path.

Disable the plugin to stop recording. Updates require renewed approval.
Closing a Space, updating, disabling or unexpectedly exiting may lose events
from the last unsaved interval. Failed saves retry and show an error in the
panel. Storage is limited to 16 MiB, with a 4 MiB limit per run object; records
are not automatically pruned.

## Development

The background subscribes through `ctx.events.on("file.opened", listener)`.
Events carry `id`, `timestamp` (Unix milliseconds) and a Space-relative `path`.
This requires `background.fileHistory: true` and host approval. Stopping the
background disposes its listeners; closing the panel leaves recording active.

This repository is the maintained source. Node >=22.12 and pnpm are required.
The lockfile pins published SDK/tools 0.9.0; no sibling Eidos checkout or
private toolchain archives are needed.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run check --json
pnpm run pack --json
```

The plugin archive and checksum are written to `dist/`. Load `plugin.json`
through Lite's **Load development source**, or install the `.eidos-plugin`
archive. A successful check is not proof of compatibility with an older Lite.

The plugin ID is `eidos.recent-history`. It has its own storage and enablement;
history from the earlier `example.recent-history` installation is not imported.
Host integration tests retain a frozen fixture in the Eidos repository;
product behavior and UI tests live in this directory.
