/**
 * 歌词样式面板 — a dedicated editor for lyric styles and their Folia tunings.
 *
 * Opened from the appearance settings or the player card. The left column previews
 * the selected style and lists the real style thumbnails; the right column holds
 * the Folia-style groups (animation / background / font / subtitle / global).
 */

var MP_STUDIO_TABS = [
  { value: 'animation', label: 'studio.animation' },
  { value: 'background', label: 'studio.background' },
  { value: 'font', label: 'studio.font' },
  { value: 'subtitle', label: 'studio.subtitle' },
  { value: 'global', label: 'studio.global' },
]

function LyricStyleStudio(props) {
  var prefs = usePrefs()
  var snap = usePlayerSnapshot()
  var tabPair = useState('animation')
  var tab = tabPair[0]
  var setTab = tabPair[1]
  var styleId = mpStyleIdOf(prefs.lyricStyle)
  var track = snap.queue[snap.index] || null
  var cover = track === null ? '' : trackCoverSrc(track)
  var close = function () { popLayer() }
  var pick = function (id) { setPrefs({ lyricStyle: id, lyricStyleChosen: true }) }
  var catalog = mpStylePickerCatalog()
  var thumb = mpLyricStyleThumb(styleId)

  function seg(value, options, onChange) {
    return h(KitSegmented, { value: String(value), label: props.label || '', options: options, onChange: onChange })
  }
  function row(label, control, desc) {
    return h(SetRow, { label: label, desc: desc }, control)
  }
  function animationPanel() {
    return h('div', { className: 'mp-studio-panel' },
      row('settings.lyricIntensity', seg(
        ['calm', 'normal', 'chaotic'].indexOf(prefs.lyricIntensity) >= 0 ? prefs.lyricIntensity : 'normal',
        [
          { value: 'calm', label: t('settings.lyricIntensityCalm') },
          { value: 'normal', label: t('settings.lyricIntensityNormal') },
          { value: 'chaotic', label: t('settings.lyricIntensityChaotic') },
        ],
        function (value) { setPrefs({ lyricIntensity: value }) },
      )),
      h('div', { className: 'mp-studio-hint' }, t('studio.animationHint')),
    )
  }

  function backgroundPanel() {
    var bg = prefs.bgMode || 'latent'
    return h('div', { className: 'mp-studio-panel' },
      h('div', { className: 'mp-studio-label' }, t('sheet.background')),
      h(LookChoiceGrid, {
        kind: 'bgMode',
        value: bg,
        cover: cover,
        onPick: function (next) { setPrefs({ bgMode: next }) },
      }),
      bg === 'latent' ? h('div', { className: 'mp-studio-sub' },
        row('studio.latentLayers', seg(
          prefs.latentDisplayMode || 'both',
          [
            { value: 'dithering', label: 'studio.latentDither' },
            { value: 'mesh', label: 'studio.latentMesh' },
            { value: 'both', label: 'studio.latentBoth' },
          ],
          function (value) { setPrefs({ latentDisplayMode: value }) },
        )),
        row('studio.latentColor', seg(
          prefs.latentColorSource || 'cover-theme',
          [
            { value: 'cover-theme', label: 'studio.latentCoverTheme' },
            { value: 'cover-only', label: 'studio.latentCoverOnly' },
          ],
          function (value) { setPrefs({ latentColorSource: value }) },
        )),
      ) : null,
    )
  }

  function fontPanel() {
    var value = Math.round((Number(prefs.lyricsFontScale) || 1) * 100)
    return h('div', { className: 'mp-studio-panel' },
      row('settings.lyricFontScale', h('input', {
        type: 'range', className: 'mp-range', min: '70', max: '150', step: '5',
        value: String(value), 'aria-label': t('settings.lyricFontScale'),
        onChange: function (event) { setPrefs({ lyricsFontScale: Number(event.target.value) / 100 }) },
      }), value + '%'),
    )
  }

  function subtitlePanel() {
    return h('div', { className: 'mp-studio-panel' },
      row('sheet.showTranslation', h(Switch, { value: prefs.showTranslation === true, label: t('sheet.showTranslation'), onChange: function (value) { setPrefs({ showTranslation: value }) } })),
      row('settings.subtitleOverlayBackground', h(Switch, { value: prefs.subtitleOverlayBackground !== false, label: t('settings.subtitleOverlayBackground'), onChange: function (value) { setPrefs({ subtitleOverlayBackground: value }) } })),
    )
  }

  function globalPanel() {
    return h('div', { className: 'mp-studio-panel' },
      row('sheet.themeSource', seg(
        MP_THEME_SOURCES.indexOf(prefs.themeSource) >= 0 ? prefs.themeSource : 'default',
        [
          { value: 'default', label: t('sheet.sourceDefault') },
          { value: 'cover', label: t('sheet.sourceAI') },
          { value: 'custom', label: t('sheet.sourceCustom') },
        ],
        function (value) { setPrefs({ themeSource: value }) },
      )),
      row('settings.playerChromeMode', seg(
        ['always-visible', 'auto-hide', 'always-hidden'].indexOf(prefs.playerChromeVisibilityMode) >= 0 ? prefs.playerChromeVisibilityMode : 'always-visible',
        [
          { value: 'always-visible', label: t('settings.playerChromeAlwaysVisible') },
          { value: 'auto-hide', label: t('settings.playerChromeAutoHide') },
          { value: 'always-hidden', label: t('settings.playerChromeAlwaysHidden') },
        ],
        function (value) { setPrefs({ playerChromeVisibilityMode: value }) },
      )),
    )
  }

  var panel = tab === 'background' ? backgroundPanel() : tab === 'font' ? fontPanel() : tab === 'subtitle' ? subtitlePanel() : tab === 'global' ? globalPanel() : animationPanel()

  return h('div', { className: 'mp-studio-backdrop', onMouseDown: function (event) { if (event.target === event.currentTarget) close() } },
    h('section', { className: 'mp-studio', role: 'dialog', 'aria-label': t('studio.title') },
      h('header', { className: 'mp-studio-head' },
        h('h2', null, t('studio.title')),
        h('button', { type: 'button', className: 'mp-studio-close', title: t('sheet.close'), onClick: close }, icon('x', 18)),
      ),
      h('div', { className: 'mp-studio-body' },
        h('div', { className: 'mp-studio-left' },
          h('div', {
            className: 'mp-studio-preview',
            style: thumb !== '' ? { backgroundImage: 'url("' + thumb + '")' } : undefined,
          },
            thumb === '' ? h('div', { className: 'mp-studio-preview-fallback' }, icon((mpStyleOf(styleId) || {}).glyph || 'note', 56), h('span', null, mpStyleLabelOf(prefs.lyricStyle))) : null,
          ),
          h('div', { className: 'mp-studio-count' }, t('studio.styles', { count: String(catalog.length) })),
          h('div', { className: 'mp-studio-grid' }, catalog.map(function (entry) {
            var selected = entry.id === styleId
            var src = mpLyricStyleThumb(entry.id)
            return h('button', {
              key: entry.id,
              type: 'button',
              className: 'mp-studio-cell' + (selected ? ' is-on' : ''),
              onClick: function () { pick(entry.id) },
            },
              h('span', { className: 'mp-studio-cell-art', style: src !== '' ? { backgroundImage: 'url("' + src + '")' } : undefined },
                src === '' ? icon(entry.glyph || 'note', 22) : null,
              ),
              h('span', { className: 'mp-studio-cell-name' }, t(entry.labelKey)),
            )
          })),
        ),
        h('div', { className: 'mp-studio-right' },
          h(KitSegmentedTabs, {
            items: MP_STUDIO_TABS.map(function (item) { return { value: item.value, label: t(item.label), id: 'mp-studio-tab-' + item.value, panelId: 'mp-studio-panel-' + item.value } }),
            value: tab,
            size: 'sm',
            label: t('studio.title'),
            onChange: function (next) { setTab(next) },
          }),
          h('div', { id: 'mp-studio-panel-' + tab, role: 'tabpanel', className: 'mp-studio-tab-body' }, panel),
        ),
      ),
    ),
  )
}
