/**
 * 歌词渲染器注册表 — Folia's player draws lyrics through a registry of renderers
 * (`VisualizerRenderer` per style) instead of styling one DOM list. Starting here:
 * a style is `{ id, labelKey, glyph, render(props) }`, the page asks the registry
 * for one, and today's DOM look becomes the `classic` entry rather than the only
 * way the panel can draw.
 */

var MP_STYLE_REGISTRY = []

function mpRegisterStyle(entry) {
  if (typeof window !== 'undefined') window.__mpStyleIds = (window.__mpStyleIds || []).concat([entry && entry.id])
  if (!entry || typeof entry.id !== 'string') return
  // DOM styles provide render; canvas/pixi/three styles provide create instead.
  if (typeof entry.render !== 'function' && typeof entry.create !== 'function') return
  for (var index = 0; index < MP_STYLE_REGISTRY.length; index += 1) {
    if (MP_STYLE_REGISTRY[index].id === entry.id) {
      MP_STYLE_REGISTRY[index] = entry
      return
    }
  }
  MP_STYLE_REGISTRY.push(entry)
}

function mpStyleOf(id) {
  for (var index = 0; index < MP_STYLE_REGISTRY.length; index += 1) {
    if (MP_STYLE_REGISTRY[index].id === id) return MP_STYLE_REGISTRY[index]
  }
  return MP_STYLE_REGISTRY.length > 0 ? MP_STYLE_REGISTRY[0] : null
}

function mpStyleCatalog() {
  return MP_STYLE_REGISTRY.map(function (entry) {
    return { id: entry.id, labelKey: entry.labelKey, glyph: entry.glyph || 'note', order: entry.order }
  }).sort(function (a, b) {
    var left = typeof a.order === 'number' ? a.order : 1000
    var right = typeof b.order === 'number' ? b.order : 1000
    return left - right
  })
}

/**
 * Old preferences stored a CSS variant (standard/glow/outline/karaoke/mirror).
 * They now select the `classic` renderer with that variant, so nobody's setting
 * is lost in the move.
 */
function mpStyleFromPrefs(pref) {
  var value = typeof pref === 'string' ? pref : ''
  if (mpStyleOf(value) !== null && mpStyleOf(value).id === value) return { id: value, variant: '' }
  return { id: 'monet', variant: '' }
}

/** The style id the page paints for a stored preference (legacy variants → monet). */
function mpStyleIdOf(pref) {
  return mpStyleFromPrefs(pref).id
}
/** The style's display name for a stored preference (legacy variants read 经典). */
function mpStyleLabelOf(pref) {
  var entry = mpStyleOf(mpStyleFromPrefs(pref).id)
  return entry === null ? '' : t(entry.labelKey)
}


