import type {
  Mount,
  Disposable,
  BackgroundMessage,
} from "@eidos.space/plugin-sdk"
import { readRows, type HistoryRow } from "./history"
const mount: Mount = (ctx, root) => {
  const t = (key: string) => ctx.i18n.t(key)
  root.innerHTML = `<style>
    .history { box-sizing: border-box; padding: 16px; font: 13px/1.5 system-ui; color: var(--foreground); }
    .history p { margin: 12px 0; } .history p:empty { display: none; }
    .history button,.history input { font: inherit; color: inherit; }
    .history input { box-sizing: border-box; width: 100%; margin-bottom: 12px; padding: 7px 10px; background: var(--background); border: 1px solid var(--border); border-radius: 6px; }
    .history button { cursor: pointer; border: 0; background: transparent; text-align: left; }
    .history button:focus-visible,.history input:focus-visible { outline: 2px solid var(--ring, var(--foreground)); outline-offset: 2px; }
    .history .table-scroll { overflow-x: auto; }
    .history table { width: 100%; border-collapse: collapse; text-align: left; }
    .history td,.history th { border-bottom: 1px solid var(--border); padding: 8px; }
    .history th { color: var(--muted-foreground); font-weight: 500; white-space: nowrap; }
    .history th button { display: flex; align-items: center; gap: 6px; width: 100%; padding: 0; font-weight: inherit; }
    .history th [data-direction] { width: 1em; font-size: 12px; }
    .history th[aria-sort] { color: var(--foreground); }
    .history th:nth-child(2),.history td:nth-child(2) { text-align: right; font-variant-numeric: tabular-nums; }
    .history th:nth-child(2) button { justify-content: flex-end; }
    .history td:first-child { width: 100%; min-width: 120px; overflow-wrap: anywhere; }
    .history td button { padding: 0; overflow-wrap: anywhere; }
    .history td:last-child { white-space: nowrap; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
    .history tbody tr:hover { background: var(--muted); }
    .history .error { color: var(--destructive); }
  </style><section class="history">
  <input type="search" placeholder="搜索文件路径…" aria-label="搜索文件">
  <p data-status role="status">加载中…</p><p class="error" data-error role="alert"></p>
  <div class="table-scroll"><table><thead><tr><th scope="col"><button data-sort="path"><span data-i18n="file"></span><span data-direction aria-hidden="true"></span></button></th><th scope="col"><button data-sort="count"><span data-i18n="count"></span><span data-direction aria-hidden="true"></span></button></th><th scope="col" aria-sort="descending"><button data-sort="lastOpenedAt"><span data-i18n="recent"></span><span data-direction aria-hidden="true">↓</span></button></th></tr></thead><tbody></tbody></table></div><p data-empty hidden></p></section>`
  const select = <T extends Element>(selector: string) =>
    root.querySelector<T>(selector)!
  const search = select<HTMLInputElement>("input")
  type SortKey = "path" | "count" | "lastOpenedAt"
  let sortKey: SortKey = "lastOpenedAt"
  let ascending = false
  const status = select<HTMLElement>("[data-status]")
  const error = select<HTMLElement>("[data-error]")
  let rows: HistoryRow[] = []
  let loaded = false
  let unavailable = false
  let active = false
  let disposed = false
  let busy = false
  let subscription: Disposable | undefined
  function stopped() {
    active = false
    subscription?.dispose()
    subscription = undefined
    if (disposed) return
    unavailable = true
    status.textContent = t("unavailable")
  }
  function render() {
    const filtered = rows
      .filter((row) =>
        row.path.toLowerCase().includes(search.value.toLowerCase())
      )
      .sort((a, b) => {
        const comparison =
          sortKey === "path"
            ? a.path.localeCompare(b.path, undefined, { numeric: true })
            : a[sortKey] - b[sortKey]
        return (
          (ascending ? comparison : -comparison) || a.path.localeCompare(b.path)
        )
      })
    const body = select<HTMLTableSectionElement>("tbody")
    body.replaceChildren()
    for (const row of filtered.slice(0, 200)) {
      const tr = document.createElement("tr")
      const file = document.createElement("td")
      const button = document.createElement("button")
      button.textContent = row.path
      button.onclick = () => {
        void ctx.capabilities.ui.openFile!(row.path).catch((cause: Error) => {
          if (!disposed) error.textContent = cause.message
        })
      }
      file.append(button)
      const count = document.createElement("td")
      count.textContent = String(row.count)
      const date = document.createElement("td")
      date.textContent = new Date(row.lastOpenedAt).toLocaleString(
        ctx.i18n.locale
      )
      tr.append(file, count, date)
      body.append(tr)
    }
    const empty = select<HTMLElement>("[data-empty]")
    empty.hidden = filtered.length > 0
    empty.textContent = t(search.value ? "noMatches" : "empty")
  }
  async function request(command = "status") {
    if (!(await ctx.capabilities.background!.isRunning())) {
      stopped()
      return
    }
    if (disposed) return
    const value = await ctx.capabilities.background!.request({ command })
    if (
      command === "prepare-stop" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.error
    )
      throw new Error(String(value.error))
    accept(value)
  }
  function accept(value: BackgroundMessage) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(t("invalidData"))
    if (disposed) return
    if (!Array.isArray(value.rows))
      throw new Error(String(value.error || t("readError")))
    const nextRows = readRows(value.rows)
    const changed = JSON.stringify(rows) !== JSON.stringify(nextRows)
    rows = nextRows
    error.textContent = value.error ? String(value.error) : ""
    const initial = !loaded
    loaded = true
    unavailable = false
    status.textContent = ""
    if (changed || initial) render()
  }
  async function run(action: () => Promise<void>) {
    if (busy) return
    busy = true
    try {
      await action()
    } catch (cause) {
      if (!disposed) {
        status.textContent = ""
        error.textContent =
          cause instanceof Error ? cause.message : String(cause)
      }
    } finally {
      busy = false
    }
  }
  async function connect() {
    if (disposed) return
    active = true
    subscription?.dispose()
    subscription = await ctx.capabilities.background!.onMessage((message) => {
      if (
        !message ||
        typeof message !== "object" ||
        Array.isArray(message) ||
        message.type !== "history"
      )
        return
      try {
        accept(message.data!)
      } catch (cause) {
        if (!disposed)
          error.textContent =
            cause instanceof Error ? cause.message : String(cause)
      }
    })
    if (disposed) {
      subscription.dispose()
      return
    }
    await request()
  }
  search.oninput = render
  function localize() {
    root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n!)
    })
    search.placeholder = t("search")
    search.setAttribute("aria-label", t("search"))
    select<HTMLTableElement>("table").setAttribute(
      "aria-label",
      t("plugin.name")
    )
    status.textContent = unavailable
      ? t("unavailable")
      : loaded
        ? ""
        : t("loading")
    if (loaded) render()
  }
  localize()
  ctx.subscriptions.add(ctx.i18n.onDidChangeLocale(localize))
  root.querySelectorAll<HTMLButtonElement>("[data-sort]").forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.sort as SortKey
      ascending = key === sortKey ? !ascending : key === "path"
      sortKey = key
      root
        .querySelectorAll<HTMLButtonElement>("[data-sort]")
        .forEach((header) => {
          const selected = header === button
          if (selected)
            header.parentElement!.setAttribute(
              "aria-sort",
              ascending ? "ascending" : "descending"
            )
          else header.parentElement!.removeAttribute("aria-sort")
          header.querySelector("[data-direction]")!.textContent = selected
            ? ascending
              ? "↑"
              : "↓"
            : ""
        })
      render()
    }
  })
  const refresh = () =>
    run(async () => {
      const running = await ctx.capabilities.background!.isRunning()
      if (disposed) return
      if (!running) stopped()
      else if (!active) await connect()
    })
  const timer = setInterval(() => {
    void refresh()
  }, 2000)
  void run(async () => {
    if (!(await ctx.capabilities.background!.isRunning())) {
      if (disposed) return
      await ctx.capabilities.background!.start()
    }
    await connect()
  })
  ctx.subscriptions.add({
    dispose() {
      disposed = true
      clearInterval(timer)
      subscription?.dispose()
    },
  })
}
export default mount
