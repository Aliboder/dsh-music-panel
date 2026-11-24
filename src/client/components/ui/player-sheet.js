/**
 * Floating player card — the layout of Folia's `panelTab/shell` with its motion.
 *
 * Motion is now driven by the same library Folia uses (framer-motion, bundled into
 * `src/vendor/framer.bundle.js`), so the dynamics match rather than approximate:
 *
 *   surface   motion.div, initial { opacity:0, scale:.92 } → { 1, 1 } over .3s
 *             `ease: [0.22, 1, 0.36, 1]` (KIT_EASE.out), exit over .22s, inside
 *             AnimatePresence (kitTransition('unfold' | 'move'))
 *   tab mark  motion.span with the same `layoutId` inside whichever tab is open:
 *             framer animates position AND width as one shared element (.22s)
 *   tab body  keyed page remounts with `.st-page-in` (opacity 0 + translateY 6px,
 *             .22s out) — Folia's kit.css
 *   surface h body = 12 + 1px hairline + 8 + measured content, animated .3s out
 *
 * When the host's React cannot host framer (a thin runtime, the test harness) the
 * vendor bundle fails to load and this falls back to the CSS-only card.
 */

var MP_EASE_OUT = [0.22, 1, 0.36, 1]
var MP_DUR_FAST = 0.12
var MP_DUR_MOVE = 0.22
var MP_DUR_UNFOLD = 0.3

var MP_PADDING = 12
var MP_DOCK_HEIGHT = 34
var MP_DOCK_GAP = 12
var MP_BODY_GAP = 12
var MP_BODY_LINE = 1
var MP_BODY_UNDER = 8
var MP_FOLDED = 48
var MP_COVER_GAP = 14
var MP_MIN_COVER = 96
var MP_TOP_MARGIN = 56
var MP_BOTTOM_GAP = 24
// The card is bottom-anchored at the real anchor offset, so its body room is
// viewport - top margin - bottom offset - card chrome. Using the fixed bottom gap here
// ignored that offset and let the dock slide under the clipped edge.
function clampCardBodyHeight(measured, viewport, bottom) {
  var height = viewport > 0 ? viewport : (typeof window === 'undefined' ? 800 : window.innerHeight || 800)
  var gap = bottom >= 0 ? bottom : MP_BOTTOM_GAP
  var room = height - MP_TOP_MARGIN - gap - MP_PADDING * 2 - MP_FOLDED - MP_DOCK_HEIGHT - MP_DOCK_GAP - MP_BODY_GAP - MP_BODY_LINE - MP_BODY_UNDER
  return Math.max(0, Math.min(measured, room))
}

function PlayerSheet(props) {
  var framer = motion !== null && AnimatePresence !== null
  if (!framer) return props.open === true ? h(PlayerSheetInner, props) : null
  return h(
    AnimatePresence,
    null,
    props.open === true
      ? h(
          PlayerSheetInner,
          Object.assign({}, props, {
            key: 'mp-card-sheet',
            framer: {
              surface: motion.div,
                enter: { opacity: 0, scale: 0.92 },
              shown: { opacity: 1, scale: 1 },
              leave: { opacity: 0, scale: 0.92 },
              transition: { duration: MP_DUR_UNFOLD, ease: MP_EASE_OUT },
              leaveTransition: { duration: MP_DUR_MOVE, ease: MP_EASE_OUT },
              },
          }),
        )
      : null,
  )
}

function PlayerSheetInner(props) {
  var onClose = props.onClose
  var track = props.track || null
  var favoriteSet = props.favoriteSet || {}
  var prefs = usePrefs()
  var ui = useStore(uiStore)
  var library = useStore(libraryStore)
  var online = useStore(onlineStore)
  var snap = usePlayerSnapshot()
  var framer = props.framer || null
  // The locally generated theme for this song (null until the page has made one).
  var localThemeState = useMpLocalTheme(typeof props.lyricsPath === 'string' ? props.lyricsPath : '')

  var indexPair = useState(0)
  var index = indexPair[0]
  var setIndex = indexPair[1]
  // Controls tab state: the theme source and light/dark.
  // Which appearance picker is open under its row (Folia opens one at a time).
  var lookPickerPair = useState('')
  var lookPicker = lookPickerPair[0]
  var setLookPicker = lookPickerPair[1]
  var themeSourcePair = useState('default')
  var themeSource = themeSourcePair[0]
  var setThemeSource = themeSourcePair[1]
  var modePair = useState('dark')
  var colorMode = modePair[0]
  var setColorMode = modePair[1]

  var bodyHPair = useState(0)
  var bodyH = bodyHPair[0]
  var setBodyH = bodyHPair[1]
  // Both the viewport and the real anchor offset decide the maximum expanded height.
  // Resizing the window must re-clamp the body, otherwise it keeps its old height.
  var viewportPair = useState(0)
  var viewportH = viewportPair[0]
  var setViewportH = viewportPair[1]
  var cardBottom = props.anchor && props.anchor.bottom >= 0 ? props.anchor.bottom : MP_BOTTOM_GAP

  var contentRef = useRef(null)
  var underRef = useRef(null)
  // The under-cover block grows when a long title wraps to a second line; the header cannot
  // reserve a fixed height for it or the block slides up over the cover. Measure it.
  var underHPair = useState(0)
  var underH = underHPair[0]
  var setUnderH = underHPair[1]

  // Four pages, one subject each: the song, the lyrics, the sound, the look. The source
  // tab used to follow the song (本地 / 歌词 / server name); it is the lyrics page now, and
  // a server name is a hint inside its source row instead of a tab label.
  var isOnlineTrack = track !== null && Boolean(track.onlineProvider)
  var isNavidromeTrack = isOnlineTrack && track.onlineProvider === 'navidrome'
  var TABS = ['sheet.song', 'sheet.lyrics', 'sheet.audio', 'sheet.look']
  var isCover = index === 0

  useEffect(
    function () {
      if (props.open !== true) return undefined
      function onKey(event) {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
      }
    },
    [props.open, onClose],
  )

  useEffect(
    function () {
      if (props.open !== true) return undefined
      function update() {
        setViewportH(window.innerHeight || 800)
      }
      update()
      window.addEventListener('resize', update)
      return function () {
        window.removeEventListener('resize', update)
      }
    },
    [props.open],
  )

  useLayoutEffect(
    function () {
      if (props.open !== true) return
      var el = contentRef.current
      if (el === null) return
      setBodyH(clampCardBodyHeight(el.scrollHeight, viewportH, cardBottom))
    },
    [props.open, index, viewportH, cardBottom],
  )

  // The under-cover block changes height with the title (one line, two lines, no album);
  // the header follows it so the block never climbs into the cover.
  useLayoutEffect(
    function () {
      var el = underRef.current
      if (el === null) return undefined
      setUnderH(el.offsetHeight)
      if (typeof ResizeObserver !== 'function') return undefined
      var observer = new ResizeObserver(function () {
        setUnderH(el.offsetHeight)
      })
      observer.observe(el)
      return function () {
        observer.disconnect()
      }
    },
    [props.open, track ? track.path : ''],
  )

  useEffect(
    function () {
      if (props.open !== true) return undefined
      var el = contentRef.current
      if (el === null || typeof ResizeObserver !== 'function') return undefined
      var observer = new ResizeObserver(function () {
        setBodyH(clampCardBodyHeight(el.scrollHeight, viewportH, cardBottom))
      })
      observer.observe(el)
      return function () {
        observer.disconnect()
      }
    },
    [props.open, index, viewportH, cardBottom],
  )

  // The page computes the cover (local file cover or the provider's URL); the card
  // must not read `track.cover`, which the player object never carries.
  var cover = typeof props.cover === 'string' && props.cover !== '' ? props.cover : ''
  var likeInfo = props.like || null
  var favorite = likeInfo !== null ? likeInfo.isLiked === true : track !== null && favoriteSet[track.path] === true
  var title = track ? track.title || '' : ''
  var artist = track ? track.artist || '' : ''
  var album = track && track.album ? track.album : ''

  /** DSH icon button: host Tooltip + `.mp-iconbtn` fallback (主题规范 §3.1). */
  function iconButton(key, label, glyph, active) {
    return h(IconButton, {
      key: key,
      icon: glyph,
      size: 17,
      title: label,
      active: active === true,
      onClick: function (event) {
        event.stopPropagation()
        if (typeof props.onAction === 'function') props.onAction(key)
      },
    })
  }

  function coverArt(size, radius) {
    return h(
      'div',
      {
        className: 'mp-card-art',
        onClick: isCover
          ? undefined
          : function () {
              setIndex(0)
            },
        style: {
          width: size === 'fill' ? '100%' : String(size) + 'px',
          height: size === 'fill' ? '100%' : String(size) + 'px',
          flex: '0 0 auto',
          overflow: 'hidden',
          borderRadius: String(radius) + 'px',
          background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
          cursor: isCover ? 'default' : 'pointer',
          transition: 'width ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1), height ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1)',
        },
      },
      cover !== ''
        ? h('img', {
            src: cover,
            alt: '',
            draggable: false,
            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
          })
        : h(
            'div',
            { style: { width: '100%', height: '100%', display: 'grid', placeItems: 'center', opacity: '.5' } },
            icon('music', size === 'fill' ? 44 : 18),
          ),
    )
  }

  // SongCredits (the block under the cover): 18/26 semibold title, 13/20 artists
  // separated by a dim slash, 12/18 album.
  function metaBlock(compact) {
    return h(
      'div',
      {
        className: 'mp-card-meta',
        style: {
          minWidth: '0',
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: compact ? '0' : '2px',
        },
      },
      h(
        'div',
        {
          style: {
            fontSize: compact ? '14px' : '18px',
            fontWeight: '600',
            lineHeight: compact ? '20px' : '26px',
            display: '-webkit-box',
            WebkitLineClamp: compact ? '1' : '2',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          },
        },
        title,
      ),
      h(
        'div',
        {
          style: {
            marginTop: compact ? '0' : '2px',
            fontSize: compact ? '12px' : '13px',
            lineHeight: compact ? '18px' : '20px',
            opacity: '.72',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        },
        artist,
      ),
      !compact && album !== ''
        ? h(
            'div',
            {
              style: {
                fontSize: '12px',
                lineHeight: '18px',
                opacity: '.5',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            },
            album,
          )
        : null,
    )
  }

  function actionsRow() {
    return h(
      'div',
      {
        className: 'mp-card-actions',
        style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', flex: '0 0 auto' },
      },
      // DSH IconButton for the like state (active is the accent), 收藏 and the device.
      iconButton(
        'favorite',
        likeInfo !== null && likeInfo.disabled === true ? String(likeInfo.reason || '') || t('page.favorite') : t('page.favorite'),
        favorite ? 'heartFill' : 'heart',
        favorite,
      ),
      iconButton('addToPlaylist', t('page.addToPlaylist'), 'star', false),
      // The collection the queue came from, like Folia's "playing from" pill.
      props.canLocate === false
        ? null
        : h(
            Button,
            {
              key: 'locate',
              variant: 'ghost',
              icon: 'target',
              title: t('page.locateCurrent'),
              onClick: function (event) {
                event.stopPropagation()
                if (typeof props.onAction === 'function') props.onAction('locate')
              },
            },
            t('page.locateCurrent'),
          ),
      h('div', { style: { flex: '1 1 auto' } }),
      // The output device, not another play control: it opens 设置 · 播放控制, where the
      // sound card row lives (the Folia device list is the same list).
      iconButton('outputDevice', t('sheet.outputDevice'), 'speaker', false),
    )
  }

  // SongHeader sizing and the two transition vocabularies it uses (Folia's
  // `st-t-unfold` for the cover/height morph, `st-t-move`/`st-t-fast` for the fades).
  // The under block is bottom-anchored inside the header, so a fixed reserve slides it up
  // over the cover as soon as the title wraps. Its measured height is the reserve instead;
  // 114px is the one-line case, used for the frame before the measurement lands.
  var underHForLayout = underH > 0 ? underH : 114
  // The card never grows past the viewport: viewport - top margin - real bottom anchor.
  // The cover is capped by the room left after padding, dock, gap and the title block,
  // otherwise a tall cover pushes the dock under the clipped edge on short windows.
  var viewportForLayout = viewportH > 0 ? viewportH : 800
  var cardMaxH = Math.max(240, viewportForLayout - MP_TOP_MARGIN - cardBottom)
  var coverRoom = cardMaxH - MP_PADDING * 2 - MP_DOCK_HEIGHT - MP_DOCK_GAP - MP_COVER_GAP - underHForLayout
  var coverBig = 'min(336px, 52vh, ' + String(Math.max(140, coverRoom)) + 'px)'
  var headerH = isCover
    ? 'calc(' + coverBig + ' + ' + String(MP_COVER_GAP) + 'px + ' + String(underHForLayout) + 'px)'
    : String(MP_FOLDED) + 'px'
  var tMorph =
    'width ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1), height ' + MP_DUR_UNFOLD +
    's cubic-bezier(.22,1,.36,1), border-radius ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1)'
  var tFadeMove =
    'opacity ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1), transform ' + MP_DUR_MOVE +
    's cubic-bezier(.22,1,.36,1), visibility ' + MP_DUR_MOVE + 's'
  var tFadeFast =
    'opacity ' + MP_DUR_FAST + 's cubic-bezier(.4,0,.2,1), transform ' + MP_DUR_FAST +
    's cubic-bezier(.4,0,.2,1), visibility ' + MP_DUR_FAST + 's'

  var header = h(
    'header',
    {
      className: 'mp-card-header',
      style: {
        position: 'relative',
        flex: '0 0 auto',
        height: headerH,
        overflow: 'hidden',
        transition: 'height ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1)',
      },
    },
    // Cover: the same element at two sizes.
    h(
      'div',
      {
        className: 'mp-card-art',
        onClick: isCover
          ? undefined
          : function () {
              setIndex(0)
            },
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          width: isCover ? '100%' : String(MP_FOLDED) + 'px',
          height: isCover ? coverBig : String(MP_FOLDED) + 'px',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          borderRadius: isCover ? '10px' : '8px',
          background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
          cursor: isCover ? 'default' : 'pointer',
          transition: tMorph,
        },
      },
      cover !== ''
        ? h('img', {
            src: cover,
            alt: '',
            draggable: false,
            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
          })
        : h(
            'div',
            { style: { width: '100%', height: '100%', display: 'grid', placeItems: 'center', opacity: '.5' } },
            icon('music', isCover ? 40 : 20),
          ),
    ),
    // Folded line: title + artist beside the 48px cover.
    h(
      'button',
      {
        type: 'button',
        className: 'mp-card-folded-line',
        onClick: function () {
          setIndex(0)
        },
        style: {
          position: 'absolute',
          left: '60px',
          right: '44px',
          top: '5px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          border: '0',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          padding: '0',
          cursor: 'pointer',
          opacity: isCover ? '0' : '1',
          transform: isCover ? 'translateY(-4px)' : 'translateY(0)',
          visibility: isCover ? 'hidden' : 'visible',
          transition: tFadeMove,
          pointerEvents: isCover ? 'none' : 'auto',
        },
      },
      h(
        'span',
        {
          style: {
            fontSize: '14px',
            fontWeight: '600',
            lineHeight: '20px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          },
        },
        title,
      ),
      h(
        'span',
        {
          style: {
            fontSize: '12px',
            lineHeight: '18px',
            opacity: '.72',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          },
        },
        artist,
      ),
    ),
    // Like: folded form only, at the right end.
    h(
      'button',
      {
        type: 'button',
        className: 'mp-card-like',
        title: t('page.favorite'),
        onClick: function (event) {
          event.stopPropagation()
          if (typeof props.onAction === 'function') props.onAction('favorite')
        },
        style: {
          position: 'absolute',
          right: '0',
          top: '8px',
          width: '28px',
          height: '28px',
          display: 'grid',
          placeItems: 'center',
          border: '0',
          borderRadius: '999px',
          background: 'transparent',
          color: 'inherit',
          opacity: isCover ? '0' : favorite === true ? '1' : '.6',
          transform: isCover ? 'translateY(-4px)' : 'translateY(0)',
          visibility: isCover ? 'hidden' : 'visible',
          cursor: 'pointer',
          transition: tFadeMove,
          pointerEvents: isCover ? 'none' : 'auto',
        },
      },
      icon(favorite ? 'heartFill' : 'heart', 16),
    ),
    // Big form's own block: meta under the cover, then the action row.
    h(
      'div',
      {
        className: 'mp-card-under',
        ref: underRef,
        style: {
          position: 'absolute',
          left: '4px',
          right: '4px',
          bottom: '0',
          display: 'flex',
          flexDirection: 'column',
          opacity: isCover ? '1' : '0',
          transform: isCover ? 'translateY(0)' : 'translateY(8px)',
          visibility: isCover ? 'visible' : 'hidden',
          transition: isCover ? tFadeMove : tFadeFast,
          pointerEvents: isCover ? 'auto' : 'none',
        },
      },
      metaBlock(false),
      actionsRow(),
    ),
  )
  // ── panes ────────────────────────────────────────────────────────────────
  // Content mirrors Folia's panelTab/*: the playing song's files (local), the
  // sound/appearance/theme groups (controls), the queue, and the streaming account.

  // PanelRow (the panel's own 44px row) and FactList (a name/value grid) from Folia.
  /** Folia's `‹ glyph name / value ›` row: the whole line opens the picker. */
  function mpNavRow(label, value, glyph, onOpen) {
    return h(
      'button',
      {
        key: 'nav-' + String(label),
        type: 'button',
        className: 'mp-set-row',
        onClick: onOpen,
        style: {
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 0,
          borderBottom: '.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
        },
      },
      h('div', { className: 'mp-set-text' }, h('div', { className: 'mp-set-label' }, label)),
      h(
        'div',
        { className: 'mp-set-control' },
        icon(glyph, 16),
        h('span', { className: 'mp-set-val' }, value),
        h('span', { style: { display: 'flex', opacity: '.45' } }, '\u203a'),
      ),
    )
  }

  /** One DSH settings row: .mp-set-row label/desc on the left, the control on the right. */
  function mpPanelRow(label, control, hint) {
    return h(SetRow, { label: label, desc: hint }, control)
  }

  function cardButton(label, onClick, title) {
    return h(Button, { variant: 'ghost', size: 'sm', onClick: onClick, title: title }, label)
  }

  function mpSection(title, children) {
    return h(
      'div',
      { key: 'section-' + String(title), style: { marginBottom: '2px' } },
      h('div', { className: 'mp-set-label', style: { padding: '12px 0 2px', opacity: '.9' } }, title),
      children,
    )
  }

  // 外观 tab — the stage's look: background and theme. Sound (including volume) lives on the
  // audio page, so this page only paints.
  function cardLookPane() {
    return h(
      'div',
      { key: 'look-pane' },
      mpSection(
        t('sheet.backgroundSection'),
        h(
          'div',
          null,
          // Folia's rows: a glyph, the name, the current value and a chevron that opens
          // the same place the old 「打开」 button did.
          mpNavRow(
            t('sheet.background'),
            mpLookLabel(MP_BG_MODES, prefs.bgMode),
            'disc',
            function () {
              setLookPicker(lookPicker === 'bgMode' ? '' : 'bgMode')
            },
          ),
          lookPicker === 'bgMode'
            ? h(
                'div',
                { style: { padding: '2px 4px 10px 44px' } },
                h(LookChoiceGrid, {
                  kind: 'bgMode',
                  value: mpLookId(MP_BG_MODES, prefs.bgMode),
                  cover: cover,
                  onPick: function (next) {
                    setPrefs({ bgMode: next })
                  },
                }),
                mpLookId(MP_BG_MODES, prefs.bgMode) === 'url'
                  ? h(KitInput, {
                      type: 'url',
                      value: typeof prefs.bgUrl === 'string' ? prefs.bgUrl : '',
                      placeholder: 'https://…',
                      label: t('sheet.foliaBgUrl'),
                      onChange: function (value) {
                        setPrefs({ bgUrl: value })
                      },
                    })
                  : null,
              )
            : null,
          h(
            'div',
            {
              key: 'bg-quick',
              style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', padding: '2px 4px' },
            },
            segmented(
              [
                { value: 'dithering', label: t('sheet.latentDithering') },
                { value: 'mesh', label: t('sheet.latentMesh') },
                { value: 'both', label: t('sheet.latentBoth') },
              ],
              prefs.latentDisplayMode === 'dithering' || prefs.latentDisplayMode === 'mesh' ? prefs.latentDisplayMode : 'both',
              function (next) {
                setPrefs({ latentDisplayMode: next, bgMode: 'latent' })
              },
            ),
            cardButton(t('sheet.bgCoverOnly'), function () {
              setPrefs({ bgCoverOnly: prefs.bgCoverOnly !== true, latentColorSource: prefs.bgCoverOnly === true ? 'cover-theme' : 'cover-only' })
            }),
          ),
        ),
      ),
      mpSection(
        t('sheet.theme'),
        h(
          'div',
          null,
          mpPanelRow(
            t('sheet.themeSource'),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              segmented(
                [
                  { value: 'default', label: t('sheet.sourceDefault') },
                  { value: 'cover', label: t('sheet.sourceAI') },
                  { value: 'custom', label: t('sheet.sourceCustom') },
                ],
                MP_THEME_SOURCES.indexOf(prefs.themeSource) >= 0 ? prefs.themeSource : 'default',
                function (next) {
                  setPrefs({ themeSource: next })
                },
              ),
              cardButton('\u25a4', function () {
                if (typeof props.onAction === 'function') props.onAction('settings')
              }),
            ),
          ),
          mpPanelRow(
            t('sheet.themeName'),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h(
                'span',
                { style: { fontSize: '12px', opacity: '.75', marginRight: '2px' } },
                (prefs.themeSource === 'custom'
                  ? t('sheet.sourceCustom')
                  : prefs.themeSource === 'cover'
                    ? t('sheet.sourceAI')
                    : t('sheet.sourceDefault')) +
                  ' · ' +
                  (prefs.themeSource === 'cover' && localThemeState.theme
                    ? localThemeState.theme.name
                    : t('sheet.themeBuiltin')),
              ),
              segmented(
                [
                  { value: 'light', label: t('sheet.light') },
                  { value: 'dark', label: t('sheet.dark') },
                ],
                colorMode,
                setColorMode,
              ),
              cardButton('\u21c4', function () {
                setColorMode(colorMode === 'dark' ? 'light' : 'dark')
              }),
            ),
          ),
          // Local theme: cover palette + lyric mood, generated on this machine. No model,
          // no network; the button is a fresh variation, the page auto-fills on song change.
          mpPanelRow(
            t('sheet.genAI'),
            cardButton(t('sheet.genFromCover'), function () {
              setPrefs({ themeSource: 'cover' })
              if (typeof mpGenerateLocalThemeForSong !== 'function') return
              mpGenerateLocalThemeForSong({
                key: typeof props.lyricsPath === 'string' ? props.lyricsPath : '',
                cover: typeof props.cover === 'string' ? props.cover : '',
                lyricsText: typeof props.lyricsText === 'string' ? props.lyricsText : '',
                songTitle: typeof props.songTitle === 'string' ? props.songTitle : '',
                variation: Date.now(),
              }).then(
                function (theme) {
                  if (theme !== null && typeof showToast === 'function') showToast(t('sheet.themeGenerated'))
                },
                function () {
                  if (typeof showToast === 'function') showToast(t('sheet.themeFailed'))
                },
              )
            }),
          ),
        ),
      ),
    )
  }

  /**
   * Where the lyric comes from — Folia's source row for a local file: the file's own
   * lyrics, the matched online lyric, and the instrumental mark. The choice is stored on
   * the song, so the reset control appears only when this song has an explicit one.
   */
  function lyricSourceControl() {
    var info = props.lyricSources || null
    var onlineLabel = track && track.onlineProvider ? sourceLabelOf(track.onlineProvider) : t('sheet.srcOnline')
    var hasEmbedded = info !== null && info.embedded === true
    var hasLocal = info !== null && info.local === true
    var hasOnline = info !== null && info.online === true
    var hasImported = info !== null && info.imported === true
    var options = []
    var active = ''
    var explicit = false
    var resetVisible = false

    if (isOnlineTrack) {
      // Folia's online source row offers the platform's own lyric and an imported
      // one; pure music is a result of the lyric match, never a selectable source.
      if (hasOnline) options.push({ value: 'online', label: onlineLabel })
      if (hasImported) options.push({ value: 'imported', label: t('sheet.srcImported') })
      active = hasImported && info.active === 'imported' ? 'imported' : hasOnline ? 'online' : ''
      explicit = info !== null && (
        info.markedPureMusic === true ||
        (info.source !== null && info.source !== undefined) ||
        hasImported
      )
      resetVisible = explicit
    } else if (isNavidromeTrack) {
      if (hasOnline) options.push({ value: 'online', label: onlineLabel })
      if (hasLocal) options.push({ value: 'local', label: t('sheet.srcLocal') })
      active = hasOnline ? 'online' : hasLocal ? 'local' : ''
    } else {
      // Folia's local row: local file, embedded tag, matched online lyric. A
      // matched lyric is one choice; an instrumental mark is only a label.
      if (hasLocal) options.push({ value: 'local', label: t('sheet.srcLocal') })
      if (hasEmbedded) options.push({ value: 'embedded', label: t('sheet.srcEmbedded') })
      if (hasOnline) options.push({ value: 'online', label: onlineLabel })
      active = info !== null && info.active === 'online' && hasOnline
        ? 'online'
        : info !== null && info.active === 'embedded' && hasEmbedded
          ? 'embedded'
          : hasLocal
            ? 'local'
            : hasEmbedded
              ? 'embedded'
              : hasOnline
                ? 'online'
                : ''
    }

    if (options.length === 0) {
      var label = info !== null && info.markedPureMusic === true
        ? t('sheet.srcPureMusic')
        : (props.lyricSourceLabel || t('sheet.srcNone'))
      return h(
        'span',
        { style: { fontSize: '13px', opacity: '.75', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
        label,
      )
    }

    var choice = options.length > 1
      ? segmented(options, active, function (next) {
          if (typeof props.onSwitchLyricSource === 'function') props.onSwitchLyricSource(next)
        })
      : h(
          'span',
          { style: { fontSize: '13px', opacity: '.75', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
          options[0].label,
        )

    return h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
      resetVisible
        ? cardButton('\u21ba', function () {
            if (typeof props.onResetLyricSource === 'function') props.onResetLyricSource()
          })
        : null,
      choice,
    )
  }

  /**
   * One line under 音频增益 — Folia's ReplayGainControl: nothing for 关闭, 未检测到 ReplayGain
   * for a tag mode the source gave nothing to, otherwise the mode's name and the gain the
   * engine actually applied (after the peak cap), with 估计 while the balance stands on a
   * stand-in reading.
   */
  function gainHint() {
    var mode = typeof props.gainMode === 'string' ? props.gainMode : 'auto'
    if (mode === 'off') return ''
    if (mode !== 'auto' && props.gainAvailable === false) return t('sheet.gainUnavailable')
    var db = props.gainAppliedDb
    if (typeof db !== 'number' || !isFinite(db)) {
      // 智能平衡 always has a decision, even 0 dB; a missing figure means the engine is older
      // than this panel, and "no tags" would be a false statement about the song.
      return mode === 'auto' ? t('sheet.gainAutoHint') : t('sheet.gainUnavailable')
    }
    var label = mode === 'album' ? t('sheet.gainAlbum') : mode === 'track' ? t('sheet.gainTrack') : t('sheet.gainAuto')
    return (
      label + ' ' + (db > 0 ? '+' : '') + db.toFixed(1) + ' dB' +
      (mode === 'auto' && props.gainAutoEstimated === true ? ' · ' + t('sheet.gainEstimated') : '')
    )
  }

  // 本地 tab — Folia's SourceTab: lyric source, timeline offset, match + lyric file,
  // audio gain, then what is known about the file.
  // 歌词 tab — where the lyric comes from, its timeline, the match and the file, then the
  // word split and the style that paints it.
  function cardLyricsPane() {
    var offset = Number(props.offsetMs) || 0
    // A Navidrome song used to name its server in the tab label; the label is 歌词 now, so
    // the server rides along as the source row's hint instead.
    var navidromeServer =
      isNavidromeTrack && online.providers && online.providers.navidrome
        ? String(online.providers.navidrome.server || '')
        : ''

    function step(delta) {
      if (typeof props.onOffsetChange === 'function') props.onOffsetChange(offset + delta)
    }
    function reset() {
      if (typeof props.onOffsetChange === 'function') props.onOffsetChange(0)
    }

    var offsetStepper = h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px',
          borderRadius: 'var(--dsw-radius-md,12px)',
          background: 'var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))',
        },
      },
      h(
        Button,
        {
          variant: 'ghost',
          size: 'sm',
          title: '-',
          onClick: function () {
            step(-250)
          },
        },
        '-',
      ),
      h('input', {
        type: 'text',
        inputMode: 'numeric',
        'aria-label': t('sheet.lyricOffset'),
        value: (offset > 0 ? '+' : '') + String(offset),
        onChange: function (event) {
          var next = Number(String(event.target.value || '').replace(/[^0-9+-]/g, ''))
          if (typeof props.onOffsetChange === 'function') props.onOffsetChange(Number.isFinite(next) ? next : 0)
        },
        style: {
          width: '54px',
          minWidth: '0',
          border: '0',
          outline: '0',
          background: 'transparent',
          color: 'inherit',
          textAlign: 'center',
          font: 'inherit',
          fontSize: '12px',
          fontVariantNumeric: 'tabular-nums',
        },
      }),
      h('span', { className: 'mp-set-desc', style: { marginTop: 0 } }, 'ms'),
      h(
        Button,
        {
          variant: 'ghost',
          size: 'sm',
          title: '+',
          onClick: function () {
            step(250)
          },
        },
        '+',
      ),
    )

    return h(
      'div',
      { key: 'lyrics-pane' },
      mpPanelRow(
        t('sheet.lyrics'),
        lyricSourceControl(),
        navidromeServer !== '' ? navidromeServer : undefined,
      ),

      mpPanelRow(
        t('sheet.lyricOffset'),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          offset !== 0
            ? h(IconButton, { icon: 'refresh', size: 16, title: t('sheet.offsetReset'), onClick: reset })
            : null,
          offsetStepper,
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', padding: '8px 0 4px' } },
        h(
          Button,
          {
            variant: 'ghost',
            size: 'md',
            icon: 'search',
            onClick: function () {
              if (typeof props.onAction === 'function') props.onAction('matchOnline')
            },
          },
          t('sheet.matchOnline'),
        ),
        h(
          Button,
          {
            variant: 'ghost',
            size: 'md',
            icon: 'note',
            onClick: function () {
              if (typeof props.onOpenLyricFile === 'function') props.onOpenLyricFile()
            },
          },
          t('sheet.lyricFile'),
        ),
      ),

      lyricSegRow(),
      lyricLookBlock(),
    )
  }


  function segmented(options, value, onChange) {
    return h(KitSegmented, { options: options, value: String(value), onChange: onChange })
  }

  /**
   * 音频增益 — Folia's ReplayGainControl: the four modes, then the gain the engine applied
   * (after the peak cap); 智能平衡 keeps its reading even at 0 dB.
   */
  function gainBlock() {
    return h(
      'div',
      { key: 'gain-block' },
      mpPanelRow(
        t('sheet.audioGain'),
        segmented(
          [
            { value: 'off', label: t('sheet.gainOff') },
            { value: 'auto', label: t('sheet.gainAuto') },
            { value: 'track', label: t('sheet.gainTrack') },
            { value: 'album', label: t('sheet.gainAlbum') },
          ],
          typeof props.gainMode === 'string' ? props.gainMode : 'auto',
          function (next) {
            if (typeof props.onGainModeChange === 'function') props.onGainModeChange(next)
          },
        ),
      ),
      h('div', { style: { padding: '0 4px 6px', fontSize: '11px', opacity: '.45' } }, gainHint()),
    )
  }

  /**
   * 歌词分词 — the saved word split, for every song: it is stored per song, so a local file
   * keeps its own split too (the old quality pane only offered it to online tracks).
   */
  function lyricSegRow() {
    return mpPanelRow(
      t('sheet.lyricSegmentation'),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
        h(
          'span',
          { style: { fontSize: '12px', opacity: '.65' } },
          Number(props.lyricSegCount) > 0
            ? t('sheet.lyricSegCount', { count: String(props.lyricSegCount) })
            : t('sheet.lyricSegDefault'),
        ),
        cardButton(t('sheet.lyricSegOpen'), function () {
          if (typeof props.onOpenLyricSegmentation === 'function') props.onOpenLyricSegmentation()
        }),
      ),
    )
  }

  /** A labelled ±% stepper for the lyric display rows (no glyph-only buttons). */
  function mpScaleStepper(value, step, onChange) {
    return h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
      h(Button, { variant: 'ghost', size: 'sm', title: '-', onClick: function () { onChange(value - step) } }, '\u2212'),
      h('span', { className: 'mp-set-val', style: { minWidth: '42px', textAlign: 'center' } }, value + '%'),
      h(Button, { variant: 'ghost', size: 'sm', title: '+', onClick: function () { onChange(value + step) } }, '+'),
    )
  }

  /** 歌词样式 + 歌词显示 — the style picker and the display controls, each named in words. */
  function lyricLookBlock() {
    var intensity = ['calm', 'normal', 'chaotic'].indexOf(prefs.lyricIntensity) >= 0 ? prefs.lyricIntensity : 'normal'
    var lyricScale = Math.min(150, Math.max(50, Math.round((Number(prefs.lyricsFontScale) || 1) * 100)))
    return h(
      'div',
      { key: 'lyric-look' },
      mpNavRow(
        t('sheet.lyricStyle'),
        mpStyleLabelOf(prefs.lyricStyle),
        'note',
        function () {
          setLookPicker(lookPicker === 'lyricStyle' ? '' : 'lyricStyle')
        },
      ),
      lookPicker === 'lyricStyle'
        ? h(
            'div',
            { style: { padding: '2px 4px 10px 44px' } },
            h(LookChoiceGrid, {
              kind: 'lyricStyle',
              value: mpStyleIdOf(prefs.lyricStyle),
              onPick: function (next) {
                setPrefs({ lyricStyle: next })
              },
            }),
          )
        : null,
      mpSection(
        t('sheet.lyricDisplay'),
        h(
          'div',
          null,
          mpPanelRow(
            t('settings.lyricIntensity'),
            segmented(
              [
                { value: 'calm', label: t('settings.lyricIntensityCalm') },
                { value: 'normal', label: t('settings.lyricIntensityNormal') },
                { value: 'chaotic', label: t('settings.lyricIntensityChaotic') },
              ],
              intensity,
              function (value) {
                setPrefs({ lyricIntensity: value })
              },
            ),
          ),
          mpPanelRow(
            t('sheet.showTranslation'),
            h(Switch, {
              value: prefs.showTranslation === true,
              label: t('sheet.showTranslation'),
              onChange: function (value) {
                setPrefs({ showTranslation: value })
              },
            }),
          ),
          mpPanelRow(
            t('settings.lyricFontScale'),
            mpScaleStepper(lyricScale, 5, function (next) {
              setPrefs({ lyricsFontScale: Math.min(150, Math.max(50, next)) / 100 })
            }),
          ),
        ),
      ),
    )
  }

  /**
   * 音量 — the card's volume row, now on the audio page. It is the keyboard path; the player
   * page's edge rail is the fast one.
   */
  function volumeBlock() {
    var volume = Number(snap.volume)
    if (!isFinite(volume)) volume = 1
    var muted = snap.muted === true
    var heard = muted ? 0 : volume
    return h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h(IconButton, {
        icon: muted || heard === 0 ? 'mute' : heard < 0.5 ? 'volumeLow' : 'volume',
        size: 16,
        title: muted ? t('sheet.unmute') : t('sheet.mute'),
        onClick: function () {
          player.setMuted(!muted)
        },
      }),
      h('input', {
        type: 'range',
        className: 'mp-range',
        min: '0',
        max: '1',
        step: '0.01',
        value: String(heard),
        'aria-label': t('sheet.volume'),
        onChange: function (event) {
          player.setVolume(Number(event.target.value))
        },
        style: { width: '96px', minWidth: '0' },
      }),
      h('span', { className: 'mp-set-val', style: { width: '36px' } }, String(Math.round(heard * 100)) + '%'),
    )
  }

  // 音频 tab — quality, volume, how playback flows, the loudness fix and the effects window.
  function cardAudioPane() {
    var loop = snap.loop || 'none'
    var options = [
      { value: 'standard', label: t('sheet.qStandard') },
      { value: 'high', label: t('sheet.qHigh') },
      { value: 'lossless', label: t('sheet.qLossless') },
      { value: 'hires', label: t('sheet.qHires') },
    ]
    return h(
      'div',
      { key: 'audio-pane' },
      // AccountTab puts audio quality on a PanelRow with a Segments control.
      mpPanelRow(
        t('sheet.quality'),
        segmented(options, prefs.onlineQuality || 'high', function (value) {
          setPrefs({ onlineQuality: value })
        }),
      ),
      mpPanelRow(t('sheet.volume'), volumeBlock()),
      mpPanelRow(
        t('sheet.playMode'),
        segmented(
          [
            { value: 'none', label: t('sheet.loopOff') },
            { value: 'all', label: t('sheet.loopAll') },
            { value: 'one', label: t('sheet.loopOne') },
          ],
          loop,
          function (value) {
            player.setLoop(value)
          },
        ),
      ),
      mpPanelRow(
        t('sheet.smartFade'),
        h(Switch, {
          value: crossfadeFadeSeconds(prefs) > 0,
          label: t('sheet.smartFade'),
          onChange: function (value) {
            setPrefs({ crossfadeEnabled: value })
          },
        }),
      ),
      gainBlock(),
      mpPanelRow(
        t('sheet.effects'),
        cardButton(t('sheet.open'), function () {
          pushLayer('equalizer', {})
        }),
        t(normalizeEqPrefs(prefs).enabled ? 'eq.procOn' : 'eq.procOff'),
      ),
    )
  }
  var bodies = [null, cardLyricsPane(), cardAudioPane(), cardLookPane()]

  var bodyHeight = isCover ? 0 : MP_BODY_GAP + MP_BODY_LINE + MP_BODY_UNDER + (bodyH > 0 ? bodyH : 0)

  var body = h(
    'div',
    {
      className: 'mp-card-body-wrap',
      style: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '0',
        overflow: 'hidden',
        height: String(bodyHeight) + 'px',
        marginInline: String(-MP_PADDING) + 'px',
        transition: 'height ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1)',
      },
    },
    h('div', {
      style: {
        height: '.5px',
        flex: '0 0 auto',
        marginTop: String(MP_BODY_GAP) + 'px',
        marginInline: String(MP_PADDING) + 'px',
        background: 'var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
      },
    }),
    h(
      'div',
      {
        className: 'mp-card-scroll',
        style: {
          minHeight: '0',
          flex: '1 1 auto',
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          paddingTop: String(MP_BODY_UNDER) + 'px',
          paddingInline: String(MP_PADDING) + 'px',
        },
      },
      h(
        'div',
        {
          key: 'page-' + String(index),
          ref: contentRef,
          id: 'mp-card-panel-' + String(index),
          role: 'tabpanel',
          'aria-labelledby': 'mp-card-tab-' + String(index),
          className: 'mp-card-page',
          style: { animation: 'mp-page-in ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1) backwards' },
        },
        bodies[index],
      ),
    ),
  )

  // The card's pages are the official SegmentedTabs (sm): one control, one visual language.
  // The old custom dock drew its own background and a floating mark; both now come from the
  // host primitive (or its `.mp-segment` fallback).
  var dock = h(
    'div',
    { className: 'mp-card-tabs', style: { marginTop: String(MP_DOCK_GAP) + 'px', flex: '0 0 auto' } },
    h(KitSegmentedTabs, {
      items: TABS.map(function (key, tabIndex) {
        return {
          value: String(tabIndex),
          label: t(key),
          id: 'mp-card-tab-' + String(tabIndex),
          panelId: 'mp-card-panel-' + String(tabIndex),
        }
      }),
      value: String(index),
      size: 'sm',
      label: t('sheet.pages'),
      onChange: function (next) {
        var parsed = Number(next)
        if (Number.isFinite(parsed)) setIndex(parsed)
      },
    }),
  )

  var surfaceStyle = {
    position: 'absolute',
    right: (props.anchor && props.anchor.right >= 0 ? String(props.anchor.right) + 'px' : '22px'),
    bottom: String(cardBottom) + 'px',
    width: '360px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: String(cardMaxH) + 'px',
    display: 'flex',
    flexDirection: 'column',
    padding: String(MP_PADDING) + 'px',
    borderRadius: 'var(--dsw-radius-xl,20px)',
    pointerEvents: 'auto',
    background: 'color-mix(in srgb, var(--dsw-alias-bg-layer-1, #232324) 95%, transparent)',
    backdropFilter: 'blur(40px) saturate(1.3)',
    // §2.4: an elevated surface carries the elevation (its own hairline), never a border too.
    border: 0,
    boxShadow: 'var(--dsw-elevation-prominent,0 30px 80px rgba(0,0,0,.55))',
    transformOrigin: 'calc(100% - 24px) calc(100% + 24px)',
    overflow: 'hidden',
  }

  var surfaceProps = framer
    ? {
        className: 'mp-card',
        initial: framer.enter,
        animate: Object.assign({}, framer.shown, { transition: framer.transition }),
        exit: Object.assign({}, framer.leave, { transition: framer.leaveTransition }),
        style: surfaceStyle,
        onClick: function (event) {
          event.stopPropagation()
        },
      }
    : {
        className: 'mp-card',
        style: Object.assign({}, surfaceStyle, {
          animation: 'mp-card-in ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1) backwards',
        }),
        onClick: function (event) {
          event.stopPropagation()
        },
      }

  var Surface = framer ? framer.surface : 'div'

  return h(
    'div',
    {
      className: 'mp-card-root',
      'data-card-motion': framer ? 'framer' : 'css',
      role: 'dialog',
      'aria-modal': 'false',
      style: { position: 'fixed', inset: '0', zIndex: String(MP_Z.page), pointerEvents: 'none' },
    },
    h('div', {
      className: 'mp-card-catcher',
      onClick: onClose,
      style: { position: 'absolute', inset: '0', pointerEvents: 'auto', background: 'transparent' },
    }),
    h(
      Surface,
      surfaceProps,
      h(
        'style',
        null,
        '@keyframes mp-card-in{from{opacity:0;scale:.92}to{opacity:1;scale:1}}' +
          '@keyframes mp-page-in{from{opacity:0;transform:translateY(6px)}}',
      ),
      header,
      body,
      dock,
    ),
  )
}






