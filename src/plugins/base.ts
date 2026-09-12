// KOPIE aus EC-Verwaltung/src/plugins/base.ts (Stand de016c0).
// Aenderungen bitte in beiden Repos spiegeln, siehe DUPLIKATE.md.
export function defineUseFunction<T>(init: () => T) {
  let data: T = null

  return () => {
    if (!data) {
      data = init()
    }

    return data
  }
}
