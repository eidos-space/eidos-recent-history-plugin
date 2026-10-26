// @vitest-environment jsdom
import { expect, it, vi } from "vitest"
import mount from "../page"
import type { Disposable } from "@eidos.space/plugin-sdk"
import { testI18n } from "./i18n"

it("searches paths and toggles each column while retaining sort on background updates", async () => {
  const disposables: Disposable[] = []
  const openFile = vi.fn(async () => {})
  const i18n = testI18n()
  let receive: ((message: unknown) => void) | undefined
  const rows = [
    { path: "notes/z.md", count: 2, lastOpenedAt: 3000 },
    { path: "notes/a.md", count: 8, lastOpenedAt: 1000 },
    { path: "docs/b.md", count: 4, lastOpenedAt: 2000 },
  ]
  const root = document.createElement("div")
  mount(
    {
      i18n,
      capabilities: {
        ui: { openFile },
        background: {
          isRunning: async () => true,
          request: async () => ({ rows }),
          onMessage: async (listener: (message: unknown) => void) => {
            receive = listener
            return { dispose() {} }
          },
        },
      },
      subscriptions: { add: (value: Disposable) => disposables.push(value) },
    } as unknown as Parameters<typeof mount>[0],
    root
  )
  const paths = () =>
    Array.from(
      root.querySelectorAll("tbody button"),
      (button) => button.textContent
    )
  const sort = (key: string) =>
    root.querySelector<HTMLButtonElement>(`[data-sort="${key}"]`)!.click()
  try {
    await vi.waitFor(() =>
      expect(paths()).toEqual(["notes/z.md", "docs/b.md", "notes/a.md"])
    )
    expect(root.querySelector("select")).toBeNull()
    sort("lastOpenedAt")
    expect(paths()).toEqual(["notes/a.md", "docs/b.md", "notes/z.md"])
    sort("path")
    expect(paths()).toEqual(["docs/b.md", "notes/a.md", "notes/z.md"])
    sort("path")
    expect(paths()).toEqual(["notes/z.md", "notes/a.md", "docs/b.md"])
    sort("count")
    expect(paths()).toEqual(["notes/a.md", "docs/b.md", "notes/z.md"])
    sort("count")
    expect(paths()).toEqual(["notes/z.md", "docs/b.md", "notes/a.md"])
    expect(root.querySelectorAll("th[aria-sort]")).toHaveLength(1)
    expect(root.querySelector("th[aria-sort]")!.getAttribute("aria-sort")).toBe(
      "ascending"
    )
    const search = root.querySelector("input")!
    search.value = "NOTES/"
    search.dispatchEvent(new Event("input"))
    expect(paths()).toEqual(["notes/z.md", "notes/a.md"])
    receive!({
      type: "history",
      data: {
        rows: [...rows, { path: "notes/c.md", count: 3, lastOpenedAt: 4000 }],
      },
    })
    expect(paths()).toEqual(["notes/z.md", "notes/c.md", "notes/a.md"])
    root.querySelector<HTMLButtonElement>("tbody button")!.click()
    expect(openFile).toHaveBeenCalledWith("notes/z.md")
    i18n.setLocale("en")
    expect(root.querySelector("input")).toBe(search)
    expect(search.value).toBe("NOTES/")
    expect(root.querySelector('[data-sort="count"]')!.textContent).toContain(
      "Opens"
    )
    expect(paths()).toEqual(["notes/z.md", "notes/c.md", "notes/a.md"])
    i18n.setLocale("zh-CN")
    search.value = "missing"
    search.dispatchEvent(new Event("input"))
    expect(paths()).toEqual([])
    expect(root.querySelector<HTMLElement>("[data-empty]")!.hidden).toBe(false)
    expect(root.querySelector("[data-empty]")!.textContent).toBe(
      "没有匹配的文件"
    )
  } finally {
    disposables.forEach((item) => item.dispose())
  }
})

it.each([true, false])(
  "automatically connects (initially running: %s), without recording controls",
  async (initial) => {
    let running = initial
    const disposables: Disposable[] = []
    const dispose = vi.fn()
    const background = {
      start: vi.fn(async () => {
        running = true
      }),
      stop: vi.fn(async () => {}),
      isRunning: vi.fn(async () => running),
      request: vi.fn(async () => ({
        rows: [],
        pending: 0,
        running: true,
        instanceId: "run",
      })),
      onMessage: vi.fn(async () => ({ dispose })),
    }
    const root = document.createElement("div")
    mount(
      {
        i18n: testI18n(),
        capabilities: { background },
        subscriptions: { add: (value: Disposable) => disposables.push(value) },
      } as unknown as Parameters<typeof mount>[0],
      root
    )
    try {
      await vi.waitFor(() =>
        expect(root.querySelector("[data-status]")!.textContent).toBe("")
      )
      expect(background.start).toHaveBeenCalledTimes(initial ? 0 : 1)
      expect(root.querySelector("[data-start]")).toBeNull()
      expect(root.querySelector("[data-save]")).toBeNull()
      expect(root.querySelector("[data-run]")).toBeNull()
      expect(root.querySelector("[data-stop]")).toBeNull()
      expect(background.onMessage).toHaveBeenCalledTimes(1)
      const calls = background.request.mock.calls.length
      running = false
      await vi.waitFor(
        () =>
          expect(root.querySelector("[data-status]")!.textContent).toContain(
            "暂不可用"
          ),
        { timeout: 3000 }
      )
      expect(background.start).toHaveBeenCalledTimes(initial ? 0 : 1)
      expect(background.request).toHaveBeenCalledTimes(calls)
    } finally {
      disposables.forEach((item) => item.dispose())
    }
    expect(background.stop).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledTimes(1)
  }
)
