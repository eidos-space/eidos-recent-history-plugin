Recent History 1.0.0 automatically records file openings in an authorized Eidos Lite Space, including while its panel is closed.

- Search file paths, sort by latest visit or opening count, and click to reopen a file.
- Open the panel from the sidebar or Cmd+K.
- Saves changes every 10 seconds in local plugin-private storage. No file contents are read and no network access is requested.

Requires Eidos Lite 0.28.0 or later (Plugin API 3.6.0). Enable the plugin and approve file-open metadata access and automatic startup for each Space. Unsaved events from the last interval may be lost when the background stops. History is not synced.
