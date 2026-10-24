import { expect, it, vi } from "vitest"
import type { FileOpenedEvent } from "@eidos.space/plugin-sdk"

it("records file.opened timestamps and periodically saves deduplicated history", async () => {
  vi.useFakeTimers()
  let opened!: (event: FileOpenedEvent) => void
  const write = vi.fn(async () => {})
  const on = vi.fn((type: string, listener: typeof opened) => {
    expect(type).toBe("file.opened")
    opened = listener
    return { dispose() {} }
  })
  vi.stubGlobal("ctx", {
    spaceId: "space", instanceId: "run", events: { on },
    storage: { list: async () => [], write },
  })
  vi.stubGlobal("addEventListener", vi.fn())
  vi.stubGlobal("postMessage", vi.fn())
  try {
    await import("../background")
    const event = { id: "1", timestamp: 123, path: "notes/a.md" }
    opened(event)
    opened(event)
    expect(write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(10000)
    expect(write).toHaveBeenCalledTimes(1)
    const [key, bytes] = (write.mock.calls as unknown as [string, Uint8Array][])[0]!
    expect(key).toBe("history/space/run")
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual([
      { path: "notes/a.md", count: 1, lastOpenedAt: 123 },
    ])
  } finally {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})
