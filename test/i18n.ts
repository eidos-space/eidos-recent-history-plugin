import en from "../locales/en.json"
import zh from "../locales/zh-CN.json"
export function testI18n() {
  let locale = "zh-CN"
  const listeners = new Set<() => void>()
  return {
    get locale() {
      return locale
    },
    t(key: string) {
      return (locale === "zh-CN" ? zh : en)[key as keyof typeof en] ?? key
    },
    onDidChangeLocale(listener: () => void) {
      listeners.add(listener)
      return {
        dispose: () => {
          listeners.delete(listener)
        },
      }
    },
    setLocale(value: string) {
      locale = value
      listeners.forEach((listener) => listener())
    },
  }
}
