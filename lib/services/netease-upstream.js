/**
 * Policies applied to the upstream NetEase package before it starts.
 *
 * Folia's desktop side does the same thing by replacing the package's own module
 * exports before the server boots (`electron/netease/neteaseApiStartup.cjs`,
 * `withoutImplicitClientIp`). The plugin hosts the package in a worker thread, so
 * the patch is installed there, from this module.
 *
 * Why: the package stamps every request with `X-Real-IP` / `X-Forwarded-For` taken
 * from the calling socket. For a local service that socket is always 127.0.0.1, and
 * NetEase reads a loopback source as a spoofed one — Folia measured that the QR
 * *confirm* step then fails. The header is only kept where a request explicitly asks
 * for a random domestic IP (`randomCNIP`).
 *
 * @module dsh-music-panel/services/netease-upstream
 */

/**
 * Wrap the package's request function so the client IP is only forwarded when the
 * caller asked for a random domestic IP.
 *
 * @param {(uri: string, data: object, options?: object) => Promise<unknown>} request
 */
export function withoutImplicitClientIp(request) {
  return (uri, data, options = {}) => request(uri, data, options.randomCNIP ? options : { ...options, ip: '' })
}

/**
 * Replace the package's `util/request` export in the require cache.
 *
 * The package's own modules (`server.js`, `main.js`) read the export at load time, so
 * this has to run before either is required: the worker calls it first.
 *
 * @param {NodeRequire} requireFn
 * @param {string} requestPath resolved path of `@neteasecloudmusicapienhanced/api/util/request.js`
 */
export function installClientIpPolicy(requireFn, requestPath) {
  // Populate the cache first: the package reads this module synchronously and there
  // is nothing to replace until it has been loaded once.
  if (requireFn.cache?.[requestPath] === undefined) requireFn(requestPath)
  const entry = requireFn.cache[requestPath]
  if (entry === undefined) throw new Error('the NetEase request module did not load')
  entry.exports = withoutImplicitClientIp(entry.exports)
  return requestPath
}
