import { defineUseFunction } from './base'
import { useStorage } from '../storage'
import { useDialog } from './dialog'
import { API_BASE } from './apiBase'

/**
 * Zentraler REST-Client.
 *
 * In EC-Verwaltung steht `fetch(...)` an rund fünfzehn Stellen einzeln; hier
 * lohnt der Wrapper, weil das ganze Portal über REST läuft und sonst
 * 401-Behandlung und Fehler-Parsing achtfach dupliziert wären.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public path: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** false = ohne Authorization-Header (Login, Passwort-Links) */
  auth?: boolean
  /** true = keinen Fehlerdialog zeigen, nur werfen */
  quiet?: boolean
  signal?: AbortSignal
}

export const useApi = defineUseFunction(() => {
  const { authToken } = useStorage()
  const { error } = useDialog()

  /**
   * Was bei 401/403 passieren soll. Als Hook und nicht als direkter
   * Router-Aufruf, weil `api.ts` den Router NICHT importieren darf:
   * pages/*.vue -> api.ts -> router.ts -> routes.ts -> import.meta.glob über
   * pages/** wäre ein Zyklus. Das Layout registriert den echten Handler in
   * onMounted; bis dahin greift dieser Notnagel.
   */
  let onUnauthorized: () => void = () => {
    authToken.value = ''
    window.location.hash = '#/login'
  }

  async function request<T>(
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    const headers: Record<string, string> = {}
    // Roher Token ohne "Bearer " -- so erwartet es die API (src/auth.ts).
    if (opts.auth !== false && authToken.value) {
      headers.authorization = authToken.value
    }
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json'
    }

    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal
      })
    } catch (e) {
      const err = new ApiError('Keine Verbindung zur API.', 0, 'NETWORK', path)
      if (!opts.quiet) error({ title: 'Verbindungsfehler', text: err.message })
      throw err
    }

    if (!res.ok) {
      throw await baueFehler(res, path, opts)
    }

    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  /**
   * Nicht jeder Fehler kommt aus dem Portal-Handler.
   *
   * /portal/* antwortet mit JSON ({error:{code,message}}), die übrige API mit
   * text/plain (helpers/error.ts), ein Express-404 mit HTML und der
   * Rate-Limiter mit einem nackten Satz. Alle vier müssen zu einer brauchbaren
   * Meldung führen -- eine rohe HTML-Seite im Fehlerdialog wäre unbrauchbar.
   */
  async function baueFehler(
    res: Response,
    path: string,
    opts: RequestOptions
  ): Promise<ApiError> {
    const ct = res.headers.get('content-type') ?? ''
    let msg = ''
    let code = 'ERROR'

    if (ct.includes('application/json')) {
      const j = await res.json().catch(() => null)
      msg = j?.error?.message ?? j?.message ?? ''
      code = j?.error?.code ?? code
    } else {
      msg = (await res.text().catch(() => '')).trim()
      if (msg.startsWith('<')) msg = '' // HTML-Fehlerseite: nicht anzeigbar
    }

    if (res.status === 429) {
      msg = 'Zu viele Anfragen — bitte einen Moment warten.'
      code = 'RATE_LIMIT'
    }
    if (!msg) msg = `Unerwarteter Fehler (HTTP ${res.status}).`

    const err = new ApiError(msg, res.status, code, path)

    if (res.status === 401 || res.status === 403) {
      // 401 heißt abgemeldet; 403 heißt angemeldet, aber nicht zuständig --
      // nur ersteres darf ausloggen.
      if (res.status === 401) {
        onUnauthorized()
      } else if (!opts.quiet) {
        error({ title: 'Keine Berechtigung', text: msg })
      }
      return err
    }

    if (!opts.quiet) error({ title: 'Fehler', text: msg })
    return err
  }

  return {
    request,
    get: <T>(path: string, o?: RequestOptions) => request<T>(path, o),
    post: <T>(path: string, body: unknown, o?: RequestOptions) =>
      request<T>(path, { ...o, method: 'POST', body }),
    setUnauthorizedHandler: (fn: () => void) => {
      onUnauthorized = fn
    }
  }
})
