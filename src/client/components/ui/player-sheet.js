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
// Room at the top of the window the card must leave free: the player page's fullscreen
// button (`.mp-np-fs`: top 22px + 36px tall) plus a 12px gap. Without it the card's top
// edge reaches the button and covers it (the card is bottom-anchored at the FAB offset).
var MP_TOP_MARGIN = 70
var MP_BOTTOM_GAP = 24
// The card is bottom-anchored at the real anchor offset, so its body room is
// viewport - top margin - bottom offset - card chrome. Using the fixed bottom gap here
// ignored that offset and let the dock slide under the clipped edge.
function clampCardBodyHeight(measured, viewport, bottom, topClearance) {
  var height = viewport > 0 ? viewport : (typeof window === 'undefined' ? 800 : window.innerHeight || 800)
  var gap = bottom >= 0 ? bottom : MP_BOTTOM_GAP
  var top = Number(topClearance) >= 0 && Number(topClearance) > 0 ? Number(topClearance) : MP_TOP_MARGIN
  var room = height - top - gap - MP_PADDING * 2 - MP_FOLDED - MP_DOCK_HEIGHT - MP_DOCK_GAP - MP_BODY_GAP - MP_BODY_LINE - MP_BODY_UNDER
  return Math.max(0, Math.min(measured, room))
}

/** Tuning labels: never truncate silently; scroll the text back and forth only when it cannot fit. */
function TuningLabel(props) {
  var ref = useRef(null)
  var overflowPair = useState(false)
  var overflow = overflowPair[0]
  var setOverflow = overflowPair[1]
  useEffect(function () {
    var el = ref.current
    if (el === null) return undefined
    function measure() {
      var inner = el.firstElementChild
      if (inner === null) return
      var shift = Math.max(0, inner.scrollWidth - el.clientWidth)
      el.style.setProperty('--mp-label-shift', String(shift + 4) + 'px')
      setOverflow(shift > 1)
    }
    measure()
    if (typeof ResizeObserver !== 'function') return undefined
    var observer = new ResizeObserver(measure)
    observer.observe(el)
    return function () { observer.disconnect() }
  }, [props.text])
  return h('span', { ref: ref, className: 'mp-tuning-label' + (overflow ? ' is-overflow' : ''), title: props.text },
    h('span', { className: 'mp-tuning-label-inner' }, props.text),
  )
}

/**
 * The appearance page's tuning slider.
 *
 * Same native range + wheel contract as the bottom bar's volume (primitives.js
 * `useWheelStep`): a notch is 5% of the range, snapped to `step`, and `preventDefault` keeps
 * the card from scrolling. Drag, keyboard and the accessibility tree stay the browser's own.
 *
 * This has to stay a module-level component: React reads the function as the element type, so
 * a component declared inside PlayerSheetInner is a NEW type on every render — React then
 * replaces the <input>, and a native range drag dies after its first step. The bottom bar's
 * VolumeControl is declared once in volume-control.js, which is exactly why its drag works.
 */
function TuningRange(props) {
  var controlProps = props.control && props.control.props ? props.control.props : {}
  var min = Number(controlProps.min)
  var max = Number(controlProps.max)
  var step = Number(controlProps.step)
  if (!isFinite(min)) min = 0
  if (!isFinite(max)) max = 1
  if (!isFinite(step) || step <= 0) step = (max - min) / 100
  var value = Number(controlProps.value)
  if (!isFinite(value)) value = min
  var disabled = controlProps.disabled === true
  var onChange = typeof controlProps.onChange === 'function' ? controlProps.onChange : null
  var rootRef = useRef(null)
  var live = useRef({ value: value, min: min, max: max, step: step, disabled: disabled, onChange: onChange })
  live.current = { value: value, min: min, max: max, step: step, disabled: disabled, onChange: onChange }
  function clean(next) {
    var config = live.current
    var steps = Math.round((next - config.min) / config.step)
    var result = config.min + steps * config.step
    result = Math.min(config.max, Math.max(config.min, result))
    var decimals = (String(config.step).split('.')[1] || '').length
    return Number(result.toFixed(Math.min(6, decimals + 2)))
  }
  function commit(next) {
    var config = live.current
    if (config.disabled || config.onChange === null) return
    var valueNow = clean(next)
    if (valueNow === config.value) return
    config.onChange({ target: { value: String(valueNow) }, currentTarget: { value: String(valueNow) } })
  }
  useWheelStep(rootRef, function (direction) {
    var config = live.current
    if (config.disabled || config.onChange === null) return false
    commit(mpSliderWheelValue(config.value, config.min, config.max, config.step, direction))
    return true
  })
  return h('span', {
    ref: rootRef,
    className: 'mp-tuning-slider' + (disabled ? ' is-disabled' : ''),
    onPointerDown: function (event) { event.stopPropagation() },
    onClick: function (event) { event.stopPropagation() },
  },
    h('input', {
      type: 'range',
      className: 'mp-range mp-tuning-range-input',
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value),
      disabled: disabled,
      'aria-label': controlProps['aria-label'] || 'slider',
      'aria-valuetext': String(value),
      onChange: onChange === null ? undefined : function (event) { commit(Number(event.target.value)) },
    }),
    h('span', { className: 'mp-tuning-range-value' }, String(value)),
  )
}

function TuningGrid(props) {
  return h('div', { className: 'mp-tuning-grid' }, props.children)
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
  // Which appearance picker is open under its row (Folia opens one at a time).
  var lookPickerPair = useState('')
  var lookPicker = lookPickerPair[0]
  var setLookPicker = lookPickerPair[1]

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
  var TABS = ['sheet.song', 'sheet.lyrics', 'sheet.queue', 'sheet.audio', 'sheet.look']
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
    var range = control && control.props && control.props.type === 'range'
    var toggle = control && control.type === Switch
    var segmented = control && control.type === KitSegmented
    var className = range ? 'mp-tuning-range' : toggle ? 'mp-tuning-toggle' : segmented ? 'mp-tuning-segmented' : ''
    var labelNode = range || toggle ? h(TuningLabel, { text: label }) : label
    var body = range
      ? h(TuningRange, { control: control, value: control.props.value })
      : control
    return h(SetRow, { label: labelNode, desc: hint, className: className }, body)
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
    var tuningBlocks = lyricTuningBlocks()
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
              'span',
              { style: { fontSize: '12px', opacity: '.75' } },
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
      tuningBlocks.length > 0
        ? mpSection(t('sheet.lyricStyleParams'), h(TuningGrid, null, tuningBlocks))
        : null,
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


  /** The selected style's Folia tuning, rendered in the 外观 tab. */
  function lyricTuningBlocks() {
    var style = mpStyleIdOf(prefs.lyricStyle)
    var blocks = []
    if (style === 'classic') blocks.push(classicTuningBlock())
    if (style === 'tilt') blocks.push(tiltTuningBlock())
    if (style === 'partita') blocks.push(partitaTuningBlock())
    if (style === 'fume') blocks.push(fumeTuningBlock())
    if (style === 'claddagh') blocks.push(claddaghTuningBlock())
    if (style === 'hanabi') blocks.push(hanabiTuningBlock())
    if (style === 'cadenza') blocks.push(cadenzaTuningBlock())
    if (style === 'sonnet') blocks.push(sonnetTuningBlock())
    if (style === 'monet') blocks.push(monetTuningBlock())
    if (style === 'machi') blocks.push(machiTuningBlock())
    if (style === 'lumiere') blocks.push(lumiereTuningBlock())
    if (style === 'pendolo') blocks.push(pendoloTuningBlock())
    if (style === 'diorama') blocks.push(dioramaTuningBlock())
    if (style === 'tempera') blocks.push(temperaTuningBlock())
    if (style === 'nebbia') blocks.push(nebbiaTuningBlock())
    if (style === 'metaphor') blocks.push(metaphorTuningBlock())
    return blocks
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
                setPrefs({ lyricStyle: next, lyricStyleChosen: true })
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
   * 播放列表 — Folia's QueueTab, with the plugin's player actions and DSH rows.
   * The panel body already scrolls, so the list lets that scroll (no nested scrollbar).
   */
  function cardQueuePane() {
    var queue = Array.isArray(snap.queue) ? snap.queue : []
    var current = Number(snap.index)
    // The queue's own order is the play order (a shuffle rewrites the queue itself).
    var order = queue.map(function (_, index) { return index })
    var listHeight = Math.max(320, Math.min(900, (typeof window !== 'undefined' ? window.innerHeight : 900) - 300))
    function move(index, target) {
      if (!Number.isInteger(index) || index < 0 || index >= queue.length) return
      var indices = queue.map(function (_, at) { return at })
      var from = indices.indexOf(index)
      if (from < 0) return
      var to = Math.max(0, Math.min(indices.length - 1, target))
      if (to === from) return
      var moved = indices.splice(from, 1)[0]
      indices.splice(to, 0, moved)
      player.reorderQueue(indices)
    }
    return h(
      'div',
      { key: 'queue-pane', className: 'mp-queue-pane' },
      h(
        'div',
        { className: 'mpv3-queue-head' },
        h('strong', null, t('page.queue')),
        h('span', null, String(queue.length) + ' ' + t('p3.unitSong') + ' · ' + playModeLabel(playModeOf(snap))),
        h('span', { className: 'mpv3-grow' }),
        queue.length > 0
          ? h(IconButton, {
              icon: 'trash',
              size: 15,
              title: t('p3.clearQueue'),
              onClick: function () {
                pushLayer('confirm', {
                  title: t('p3.clearQueue'),
                  text: t('p3.clearQueueConfirm'),
                  onConfirm: function () { player.clearQueue(); onClose() },
                })
              },
            })
          : null,
      ),
      queue.length === 0
        ? h('div', { className: 'mpv3-queue-empty' }, icon('playlist', 24), h('span', null, t('p3.queueEmpty')))
        : h('div', {
            className: 'mpv3-queue-list',
            style: { height: String(listHeight) + 'px', overflowY: 'auto' },
          },
            order.map(function (at, position) {
              var track = queue[at]
              if (track === null || typeof track !== 'object') return null
              var active = at === current
              return h(
                'div',
                {
                  key: String(track.path || at) + ':' + String(position),
                  className: 'mpv3-queue-row' + (active ? ' is-cur' : ''),
                  role: 'button',
                  tabIndex: 0,
                  onClick: function () { player.select(queue, at) },
                  onKeyDown: function (event) {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      player.select(queue, at)
                    }
                  },
                },
                h('span', { className: 'mpv3-queue-idx' }, active ? h(P3QueueWave, { playing: snap.playing }) : String(position + 1)),
                h('span', { className: 'mpv3-queue-cover' }, h(Cover, { src: trackCoverSrc(track), iconSize: 12 })),
                h('span', { className: 'mpv3-queue-main' },
                  h('span', { className: 'mpv3-queue-name' }, trackTitleOf(track)),
                  h('span', { className: 'mpv3-queue-artist' }, trackArtistOf(track)),
                ),
                h('span', { className: 'mpv3-queue-time' }, fmtClock(track.durationSec || 0)),
                h(IconButton, { icon: 'playlist', size: 13, title: t('p3.playNext'), className: 'mpv3-queue-remove', onClick: function (event) { event.stopPropagation(); move(at, current + 1) } }),
                h(IconButton, { icon: 'down', size: 13, title: t('p3.moveToEnd'), className: 'mpv3-queue-remove', onClick: function (event) { event.stopPropagation(); move(at, queue.length - 1) } }),
                h(IconButton, { icon: 'x', size: 13, title: t('p3.removeFromQueue'), className: 'mpv3-queue-remove', onClick: function (event) { event.stopPropagation(); player.removeQueueAt(at) } }),
              )
            }),
          ),
    )
  }
  /** Folia classic's own tuning controls (settings are DSH rows; values are Folia's). */
  function classicTuningBlock() {
    var tuning = prefs.classicTuning || {}
    function range(key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = 0
      return h('input', {
        type: 'range',
        className: 'mp-range',
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(value),
        'aria-label': t(key === 'breathingFloatMultiplier' ? 'settings.classicBreathing' : 'settings.classicWordSpacing'),
        onChange: function (event) {
          var next = Object.assign({}, tuning)
          next[key] = Number(event.target.value)
          setPrefs({ classicTuning: next })
        },
      })
    }
    return mpSection(
      t('settings.classicTuning'),
      h(
        'div',
        null,
        mpPanelRow(t('settings.classicWordRotation'), h(Switch, {
          value: tuning.enableWordRotation !== false,
          label: t('settings.classicWordRotation'),
          onChange: function (value) {
            setPrefs({ classicTuning: Object.assign({}, tuning, { enableWordRotation: value }) })
          },
        })),
        mpPanelRow(t('settings.classicBreathing'), range('breathingFloatMultiplier', 0, 2, 0.1)),
        mpPanelRow(t('settings.classicWordSpacing'), range('wordSpacing', 0, 2, 0.1)),
      ),
    )
  }
  /** Folia tilt's tuning: two probabilities plus its colour scheme. */
  function tiltTuningBlock() {
    var tuning = prefs.tiltTuning || {}
    function probability(key, label) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = 0
      return h('input', {
        type: 'range', className: 'mp-range', min: '0', max: '1', step: '0.05',
        value: String(value), 'aria-label': t(label),
        onChange: function (event) {
          setPrefs({ tiltTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) })
        },
      })
    }
    return mpSection(
      t('settings.tiltTuning'),
      h('div', null,
        mpPanelRow(t('settings.tiltSplit'), probability('splitProbability', 'settings.tiltSplit')),
        mpPanelRow(t('settings.tiltStyle'), probability('tiltStyleProbability', 'settings.tiltStyle')),
        mpPanelRow(t('settings.tiltColorScheme'), segmented(
          [
            { value: 'default', label: t('settings.optDefault') },
            { value: 'swap', label: t('settings.optSwap') },
            { value: 'accentAll', label: t('settings.optAccent') },
            { value: 'primaryAll', label: t('settings.optPrimary') },
          ],
          ['default', 'swap', 'accentAll', 'primaryAll'].indexOf(tuning.colorScheme) >= 0 ? tuning.colorScheme : 'default',
          function (value) { setPrefs({ tiltTuning: Object.assign({}, tuning, { colorScheme: value }) }) },
        )),
      ),
    )
  }
  /** Folia partita tuning: guide lines, semantic layout, stagger range and overlap. */
  function partitaTuningBlock() {
    var tuning = prefs.partitaTuning || {}
    function stagger(key, label) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = 0
      return h('input', {
        type: 'range', className: 'mp-range', min: '0', max: '180', step: '1',
        value: String(value), 'aria-label': t(label),
        onChange: function (event) {
          setPrefs({ partitaTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) })
        },
      })
    }
    return mpSection(
      t('settings.partitaTuning'),
      h('div', null,
        mpPanelRow(t('settings.partitaGuides'), h(Switch, { value: tuning.showGuideLines !== false, label: t('settings.partitaGuides'), onChange: function (value) { setPrefs({ partitaTuning: Object.assign({}, tuning, { showGuideLines: value }) }) } })),
        mpPanelRow(t('settings.partitaSemantic'), h(Switch, { value: tuning.useSemanticLayout !== false, label: t('settings.partitaSemantic'), onChange: function (value) { setPrefs({ partitaTuning: Object.assign({}, tuning, { useSemanticLayout: value }) }) } })),
        mpPanelRow(t('settings.partitaStaggerMin'), stagger('staggerMin', 'settings.partitaStaggerMin')),
        mpPanelRow(t('settings.partitaStaggerMax'), stagger('staggerMax', 'settings.partitaStaggerMax')),
        mpPanelRow(t('settings.partitaAvoidOverlap'), h(Switch, { value: tuning.avoidOverlap === true, label: t('settings.partitaAvoidOverlap'), onChange: function (value) { setPrefs({ partitaTuning: Object.assign({}, tuning, { avoidOverlap: value }) }) } })),
      ),
    )
  }
  /** Folia fume tuning: print, geometry, camera and glow. */
  function fumeTuningBlock() {
    var tuning = prefs.fumeTuning || {}
    function numberRow(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ fumeTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function switchRow(label, key, fallback) {
      var on = key === 'hidePrintSymbols' ? tuning[key] === true : tuning[key] !== false
      return mpPanelRow(t(label), h(Switch, { value: on, label: t(label), onChange: function (value) { setPrefs({ fumeTuning: Object.assign({}, tuning, { [key]: value }) }) } }))
    }
    return mpSection(
      t('settings.fumeTuning'),
      h('div', null,
        switchRow('settings.fumePrint', 'hidePrintSymbols', false),
        switchRow('settings.fumeGeo', 'disableGeometricBackground', true),
        numberRow('settings.fumeBgOpacity', 'backgroundObjectOpacity', 0, 1, 0.05),
        numberRow('settings.fumeHold', 'textHoldRatio', 0, 1, 0.05),
        mpPanelRow(t('settings.fumeCameraMode'), segmented([{ value: 'stepped', label: t('settings.optStepped') }, { value: 'smooth', label: t('settings.optSmooth') }], tuning.cameraTrackingMode === 'stepped' ? 'stepped' : 'smooth', function (value) { setPrefs({ fumeTuning: Object.assign({}, tuning, { cameraTrackingMode: value }) }) })),
        numberRow('settings.fumeCameraSpeed', 'cameraSpeed', 0.55, 1.85, 0.05),
        numberRow('settings.fumeGlow', 'glowIntensity', 0, 1.8, 0.05),
        numberRow('settings.fumeHeroScale', 'heroScale', 0.82, 1.32, 0.02),
      ),
    )
  }
  /** Folia claddagh tuning: ring geometry, text spacing and the translation row. */
  function claddaghTuningBlock() {
    var tuning = prefs.claddaghTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ claddaghTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function sw(label, key, fallback) {
      var value = key === 'showTranslation' ? tuning[key] === true : tuning[key] !== false
      return mpPanelRow(t(label), h(Switch, { value: value, label: t(label), onChange: function (next) { setPrefs({ claddaghTuning: Object.assign({}, tuning, { [key]: next }) }) } }))
    }
    return mpSection(t('settings.claddaghTuning'), h('div', null,
      num('settings.claddaghFocus', 'focusScaleRatio', 0, 1.5, 0.05),
      num('settings.claddaghRadius', 'radiusScale', 0.5, 1.5, 0.05),
      num('settings.claddaghTilt', 'ellipseTiltDeg', 0, 60, 1),
      sw('settings.claddaghAxis', 'showAxisLine', true),
      num('settings.claddaghSpacing', 'letterSpacingOffset', -5, 20, 1),
      num('settings.claddaghPositionX', 'positionX', -40, 40, 1),
      num('settings.claddaghPositionY', 'positionY', -40, 40, 1),
      sw('settings.claddaghTranslation', 'showTranslation', false),
      num('settings.claddaghTranslationScale', 'translationFontScale', 0.5, 2, 0.05),
      num('settings.claddaghTranslationSpacing', 'translationLetterSpacingOffset', -5, 20, 1),
    ))
  }
  /** Folia hanabi tuning: amounts, switches and colour mode. */
  function hanabiTuningBlock() {
    var tuning = prefs.hanabiTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ hanabiTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function sw(label, key, fallback) {
      var value = fallback ? tuning[key] !== false : tuning[key] === true
      return mpPanelRow(t(label), h(Switch, { value: value, label: t(label), onChange: function (next) { setPrefs({ hanabiTuning: Object.assign({}, tuning, { [key]: next }) }) } }))
    }
    return mpSection(t('settings.hanabiTuning'), h('div', null,
      mpPanelRow(t('settings.hanabiColorMode'), segmented([{ value: 'theme', label: t('settings.optTheme') }, { value: 'vivid', label: t('settings.optVivid') }, { value: 'mixed', label: t('settings.optMixed') }], ['theme', 'vivid', 'mixed'].indexOf(tuning.hanabiColorMode) >= 0 ? tuning.hanabiColorMode : 'mixed', function (value) { setPrefs({ hanabiTuning: Object.assign({}, tuning, { hanabiColorMode: value }) }) })),
      num('settings.hanabiSpark', 'sparkAmount', 0, 2, 0.05),
      num('settings.hanabiOrnament', 'ornamentAmount', 0, 2, 0.05),
      num('settings.hanabiTextMotion', 'textMotion', 0, 2, 0.05),
      num('settings.hanabiBlockOpacity', 'blockOpacity', 0, 1, 0.05),
      num('settings.hanabiRise', 'riseSpeed', 0, 2, 0.05),
      num('settings.hanabiSpin', 'spin', 0, 2, 0.05),
      num('settings.hanabiAmbient', 'ambient', 0, 2, 0.05),
      num('settings.hanabiGlow', 'glow', 0, 2, 0.05),
      num('settings.hanabiBloom', 'bloom', 0, 2, 0.05),
      num('settings.hanabiChorusBloom', 'chorusBloom', 0, 2, 0.05),
      sw('settings.hanabiLaunches', 'launches', true),
      sw('settings.hanabiOverlay', 'overlayFrame', true),
      sw('settings.hanabiTextOnly', 'textOnly', false),
      num('settings.hanabiSky', 'sky', 0, 1, 0.05),
      num('settings.hanabiCollage', 'collage', 0, 2, 0.05),
    ))
  }
  /** Folia cadenza tuning: font/width ratio, motion and glow. */
  function cadenzaTuningBlock() {
    var tuning = prefs.cadenzaTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ cadenzaTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    return mpSection(t('settings.cadenzaTuning'), h('div', null,
      num('settings.cadenzaFontScale', 'fontScale', 0.7, 1.5, 0.01),
      num('settings.cadenzaWidthRatio', 'widthRatio', 0.3, 1, 0.01),
      num('settings.cadenzaMotion', 'motionAmount', 0, 2, 0.05),
      num('settings.cadenzaGlow', 'glowIntensity', 0, 2, 0.05),
    ))
  }
  /** Folia sonnet tuning: camera, typography, scene switches and post-process. */
  function sonnetTuningBlock() {
    var tuning = prefs.sonnetTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ sonnetTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function sw(label, key) {
      return mpPanelRow(t(label), h(Switch, { value: tuning[key] === true, label: t(label), onChange: function (next) { setPrefs({ sonnetTuning: Object.assign({}, tuning, { [key]: next }) }) } }))
    }
    return mpSection(t('settings.sonnetTuning'), h('div', null,
      num('settings.sonnetCamera', 'cameraIntensity', 0, 2, 0.05),
      num('settings.sonnetTypography', 'typographyMotion', 0, 2, 0.05),
      num('settings.sonnetMgDensity', 'mgDensity', 0, 2, 0.05),
      sw('settings.sonnetOnlyText', 'showOnlyText'),
      sw('settings.sonnetGuide', 'showGuide'),
      sw('settings.sonnetBgMg', 'showBackgroundMg'),
      sw('settings.sonnetFixedGeo', 'showFixedGeo'),
      sw('settings.sonnetGiantText', 'showGiantDecorativeText'),
      sw('settings.sonnetDecor', 'showBackgroundDecor'),
      sw('settings.sonnetTransitions', 'enableTransitions'),
      mpPanelRow(t('settings.sonnetFrame'), segmented([{ value: 'none', label: t('settings.optNone') }, { value: 'frame', label: t('settings.optFrame') }, { value: 'full', label: t('settings.optFull') }], ['none', 'frame', 'full'].indexOf(tuning.outerFrameMode) >= 0 ? tuning.outerFrameMode : 'full', function (value) { setPrefs({ sonnetTuning: Object.assign({}, tuning, { outerFrameMode: value }) }) })),
      num('settings.sonnetTexture', 'textureResolution', 0.5, 4, 0.1),
      sw('settings.sonnetPost', 'postProcessEnabled'),
      num('settings.sonnetGrain', 'postProcessGrain', 0, 1, 0.01),
      num('settings.sonnetContrast', 'postProcessContrast', 0, 1, 0.01),
      num('settings.sonnetRgb', 'postProcessRgbShift', 0, 1, 0.01),
      num('settings.sonnetHalftone', 'postProcessHalftone', 0, 1, 0.01),
      num('settings.sonnetVignette', 'postProcessVignette', 0, 2, 0.01),
      num('settings.sonnetLens', 'postProcessLensDistortion', 0, 2, 0.01),
      num('settings.sonnetDispersion', 'postProcessLensDispersion', 0, 1, 0.01),
    ))
  }
  /** Folia monet tuning: description, audio strip, portrait and mirror. */
  function monetTuningBlock() {
    var tuning = prefs.monetTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ monetTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function sw(label, key) {
      return mpPanelRow(t(label), h(Switch, { value: tuning[key] === true, label: t(label), onChange: function (next) { setPrefs({ monetTuning: Object.assign({}, tuning, { [key]: next }) }) } }))
    }
    return mpSection(t('settings.monetTuning'), h('div', null,
      sw('settings.monetKeyword', 'keywordColoringEnabled'),
      sw('settings.monetDescription', 'showDescription'),
      sw('settings.monetAudio', 'showAudioVisualization'),
      mpPanelRow(t('settings.monetAudioStyle'), segmented([{ value: 'bar', label: t('settings.optBar') }, { value: 'line', label: t('settings.optLine') }], tuning.audioStyle === 'line' ? 'line' : 'bar', function (value) { setPrefs({ monetTuning: Object.assign({}, tuning, { audioStyle: value }) }) })),
      num('settings.monetFontScale', 'fontScale', 0.7, 1.5, 0.01),
      mpPanelRow(t('settings.monetPortrait'), segmented([{ value: 'cover', label: t('settings.optCover') }, { value: 'none', label: t('settings.optNone') }], tuning.portraitSource === 'none' ? 'none' : 'cover', function (value) { setPrefs({ monetTuning: Object.assign({}, tuning, { portraitSource: value }) }) })),
      mpPanelRow(t('settings.monetPortraitStyle'), segmented([{ value: 'square', label: t('settings.optSquare') }, { value: 'rectangular', label: t('settings.optRect') }], tuning.portraitStyle === 'rectangular' ? 'rectangular' : 'square', function (value) { setPrefs({ monetTuning: Object.assign({}, tuning, { portraitStyle: value }) }) })),
      num('settings.monetPortraitOffset', 'portraitOffsetX', -150, 0, 1),
      sw('settings.monetHanger', 'showPortraitDragHanger'),
      sw('settings.monetMirror', 'mirrorLayout'),
    ))
  }
  /** Folia machi tuning: scene, time, weather, camera and lens. */
  function machiTuningBlock() {
    var tuning = prefs.machiTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ machiTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function choice(label, key, options) {
      var current = options.some(function (item) { return item.value === tuning[key] }) ? tuning[key] : options[0].value
      return mpPanelRow(t(label), segmented(options, current, function (value) { setPrefs({ machiTuning: Object.assign({}, tuning, { [key]: value }) }) }))
    }
    return mpSection(t('settings.machiTuning'), h('div', null,
      choice('settings.machiScene', 'scene', [{ value: 'auto', label: t('settings.optAuto') }, { value: 'konbini', label: t('settings.optKonbini') }, { value: 'station', label: t('settings.optStation') }, { value: 'kowloon', label: t('settings.optKowloon') }]),
      choice('settings.machiTime', 'timeOfDay', [{ value: 'auto', label: t('settings.optAuto') }, { value: 'day', label: t('settings.optDay') }, { value: 'dusk', label: t('settings.optDusk') }, { value: 'night', label: t('settings.optNight') }]),
      choice('settings.machiWeather', 'weather', [{ value: 'auto', label: t('settings.optAuto') }, { value: 'clear', label: t('settings.optClear') }, { value: 'rain', label: t('settings.optRain') }, { value: 'snow', label: t('settings.optSnow') }, { value: 'fog', label: t('settings.optFog') }]),
      choice('settings.machiCamera', 'camera', [{ value: 'default', label: t('settings.optDefault') }, { value: 'custom', label: t('settings.optCustom') }]),
      mpPanelRow(t('settings.machiMotion'), h(Switch, { value: tuning.motion === true, label: t('settings.machiMotion'), onChange: function (value) { setPrefs({ machiTuning: Object.assign({}, tuning, { motion: value }) }) } })),
      num('settings.machiMotionSpeed', 'motionSpeed', 0.25, 3, 0.05),
      num('settings.machiAperture', 'aperture', 1.4, 16, 0.1),
      num('settings.machiDof', 'dof', 0, 2, 0.05),
      num('settings.machiDofRange', 'dofRange', 0.3, 3, 0.05),
      num('settings.machiTilt', 'tiltShift', 0, 1, 0.01),
      choice('settings.machiFocus', 'focus', [{ value: 'center', label: t('settings.optCenter') }, { value: 'lyrics', label: t('settings.optLyrics') }, { value: 'manual', label: t('settings.optManual') }]),
      num('settings.machiFocusOffset', 'focusOffset', -10, 10, 0.1),
      mpPanelRow(t('settings.machiBeat'), h(Switch, { value: tuning.simulatedBeat !== false, label: t('settings.machiBeat'), onChange: function (value) { setPrefs({ machiTuning: Object.assign({}, tuning, { simulatedBeat: value }) }) } })),
    ))
  }
  /** Folia lumiere tuning: light field, effects and switches. */
  function lumiereTuningBlock() {
    var tuning = prefs.lumiereTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ lumiereTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function sw(label, key) {
      return mpPanelRow(t(label), h(Switch, { value: tuning[key] === true, label: t(label), onChange: function (next) { setPrefs({ lumiereTuning: Object.assign({}, tuning, { [key]: next }) }) } }))
    }
    return mpSection(t('settings.lumiereTuning'), h('div', null,
      num('settings.lumiereLight', 'lightIntensity', 0.3, 2, 0.05),
      num('settings.lumiereAudio', 'audioResponse', 0, 2, 0.05),
      num('settings.lumiereFog', 'fogDensity', 0, 2, 0.05),
      num('settings.lumiereDark', 'darkField', 0, 1, 0.01),
      num('settings.lumiereMote', 'moteAmount', 0, 2, 0.05),
      num('settings.lumiereBloom', 'bloom', 0, 2, 0.05),
      num('settings.lumiereTextBloom', 'textBloom', 0, 2, 0.05),
      num('settings.lumiereUnlit', 'unlitOpacity', 0.05, 0.6, 0.01),
      num('settings.lumiereNeighbors', 'windowNeighbors', 1, 2, 1),
      num('settings.lumiereDecay', 'decay', 0, 2, 0.05),
      num('settings.lumiereEcho', 'echo', 0, 2, 0.05),
      num('settings.lumiereFogOctaves', 'fogOctaves', 1, 8, 1),
      sw('settings.lumiereLineArt', 'lineArt'),
      sw('settings.lumiereBokeh', 'frontBokeh'),
      sw('settings.lumiereTrails', 'trails'),
      sw('settings.lumiereHideTrails', 'hideTrails'),
      sw('settings.lumiereSeamless', 'seamlessTransitions'),
      sw('settings.lumiereFrame', 'overlayFrame'),
      sw('settings.lumiereTextOnly', 'textOnly'),
      sw('settings.lumiereKeyword', 'keywordColors'),
      sw('settings.lumiereIcons', 'themeIcons'),
      num('settings.lumiereMix', 'themeColorMix', 0, 1, 0.01),
      mpPanelRow(t('settings.lumiereTuning'), segmented([{ value: 'full', label: t('settings.lumiereFull') }, { value: 'balanced', label: t('settings.optBalanced') }, { value: 'low', label: t('settings.optLow') }], ['full', 'balanced', 'low'].indexOf(tuning.renderQuality) >= 0 ? tuning.renderQuality : 'full', function (value) { setPrefs({ lumiereTuning: Object.assign({}, tuning, { renderQuality: value }) }) })),
    ))
  }
  /** Folia pendolo tuning: arc geometry, tick response and tilt. */
  function pendoloTuningBlock() {
    var tuning = prefs.pendoloTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ pendoloTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    return mpSection(t('settings.pendoloTuning'), h('div', null,
      num('settings.pendoloArcRadius', 'arcRadius', 0.2, 0.6, 0.01),
      num('settings.pendoloArcAngle', 'arcAngleDeg', 30, 180, 1),
      num('settings.pendoloCenterX', 'wheelCenterX', -0.5, 0.5, 0.01),
      num('settings.pendoloCenterY', 'wheelCenterY', 0, 1, 0.01),
      num('settings.pendoloSnappiness', 'tickSnappiness', 0.5, 4, 0.05),
      num('settings.pendoloActiveScale', 'activeScale', 0.8, 1.6, 0.01),
      num('settings.pendoloTilt', 'tiltDeg', -45, 45, 1),
      num('settings.pendoloParallax', 'parallaxDepth', 0, 2, 0.05),
      mpPanelRow(t('settings.pendoloMirror'), h(Switch, { value: tuning.mirrorLayout === true, label: t('settings.pendoloMirror'), onChange: function (value) { setPrefs({ pendoloTuning: Object.assign({}, tuning, { mirrorLayout: value }) }) } })),
    ))
  }
  /** Folia diorama tuning: camera, particles and follow-singing effects. */
  function dioramaTuningBlock() {
    var tuning = prefs.dioramaTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ dioramaTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function sw(label, key, fallback) {
      var value = fallback ? tuning[key] !== false : tuning[key] === true
      return mpPanelRow(t(label), h(Switch, { value: value, label: t(label), onChange: function (next) { setPrefs({ dioramaTuning: Object.assign({}, tuning, { [key]: next }) }) } }))
    }
    return mpSection(t('settings.dioramaTuning'), h('div', null,
      num('settings.dioramaCamera', 'cameraSpeed', 0.55, 1.85, 0.05),
      num('settings.dioramaMotion', 'motionAmount', 0.4, 1.6, 0.05),
      num('settings.dioramaAudio', 'audioReactivity', 0, 1.5, 0.05),
      num('settings.dioramaDensity', 'particleDensity', 32, 2048, 32),
      num('settings.dioramaScale', 'particleScale', 0.5, 2, 0.05),
      sw('settings.dioramaParticleGlow', 'particleGlowEnabled', true),
      num('settings.dioramaParticleGlowIntensity', 'particleGlowIntensity', 0, 1.5, 0.05),
      sw('settings.dioramaParticles', 'showParticles', true),
      num('settings.dioramaBgCircumference', 'backgroundParticleCircumference', 4, 64, 1),
      num('settings.dioramaBgRadial', 'backgroundParticleRadial', 1, 8, 1),
      sw('settings.dioramaGlow', 'glowEnabled', true),
      num('settings.dioramaGlowIntensity', 'glowIntensity', 0.1, 1.5, 0.05),
      sw('settings.dioramaSoul', 'soulEnabled', true),
      num('settings.dioramaSoulIntensity', 'soulIntensity', 0.1, 1.5, 0.05),
      sw('settings.dioramaSoulActive', 'soulActiveEnabled', false),
      sw('settings.dioramaGradient', 'gradientEnabled', false),
      num('settings.dioramaGradientIntensity', 'gradientIntensity', 0.1, 1.5, 0.05),
      sw('settings.dioramaKeyword', 'keywordColoringEnabled', true),
    ))
  }
  /** Folia tempera tuning: camera, colour mode and print passes. */
  function temperaTuningBlock() {
    var tuning = prefs.temperaTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ temperaTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function sw(label, key, fallback) {
      var value = fallback ? tuning[key] !== false : tuning[key] === true
      return mpPanelRow(t(label), h(Switch, { value: value, label: t(label), onChange: function (next) { setPrefs({ temperaTuning: Object.assign({}, tuning, { [key]: next }) }) } }))
    }
    return mpSection(t('settings.temperaTuning'), h('div', null,
      num('settings.temperaCamera', 'cameraIntensity', 0, 2, 0.05),
      num('settings.temperaGlyphMotion', 'glyphMotion', 0, 2, 0.05),
      sw('settings.temperaWholeLine', 'wholeLineLyrics', false),
      num('settings.temperaStretch', 'glyphSettleStretch', 0, 1, 0.01),
      num('settings.temperaDof', 'depthOfField', 0, 2, 0.05),
      num('settings.temperaDepthPan', 'depthPan', 0, 2, 0.05),
      num('settings.temperaGlyphDepth', 'glyphDepth', 0, 2, 0.05),
      mpPanelRow(t('settings.temperaColorMode'), segmented([{ value: 'duo', label: t('settings.optDuo') }, { value: 'mono', label: t('settings.optMono') }], tuning.temperaColorMode === 'mono' ? 'mono' : 'duo', function (value) { setPrefs({ temperaTuning: Object.assign({}, tuning, { temperaColorMode: value }) }) })),
      sw('settings.temperaBlocks', 'showBlocks', true),
      sw('settings.temperaDecor', 'showDecor', true),
      sw('settings.temperaCorners', 'showCornerMarks', true),
      sw('settings.temperaInversion', 'textInversion', true),
      sw('settings.temperaTransitions', 'enableTransitions', true),
      num('settings.temperaTexture', 'textureResolution', 0.5, 4, 0.1),
      sw('settings.temperaPost', 'postProcessEnabled', true),
      sw('settings.temperaCompression', 'postProcessTextureCompression', false),
      num('settings.temperaGrain', 'postProcessGrain', 0, 1, 0.01),
      num('settings.temperaContrast', 'postProcessContrast', 0, 1, 0.01),
      num('settings.temperaRgb', 'postProcessRgbShift', 0, 1, 0.01),
      num('settings.temperaVignette', 'postProcessVignette', 0, 2, 0.01),
      num('settings.temperaLens', 'postProcessLensDistortion', 0, 2, 0.01),
    ))
  }
  /** Folia metaphor tuning: camera cutting, the ink and the inversions. */
  function metaphorTuningBlock() {
    var tuning = prefs.metaphorTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ metaphorTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function sw(label, key, fallback) {
      var value = fallback ? tuning[key] !== false : tuning[key] === true
      return mpPanelRow(t(label), h(Switch, { value: value, label: t(label), onChange: function (next) { setPrefs({ metaphorTuning: Object.assign({}, tuning, { [key]: next }) }) } }))
    }
    return mpSection(t('settings.metaphorTuning'), h('div', null,
      num('settings.metaphorCutPace', 'cutPace', 0.4, 2, 0.05),
      num('settings.metaphorCameraMotion', 'cameraMotion', 0, 2, 0.05),
      num('settings.metaphorFlow', 'flow', 0, 2, 0.05),
      num('settings.metaphorBlobs', 'blobs', 0, 2, 0.05),
      num('settings.metaphorHalftone', 'halftone', 0.5, 2.5, 0.05),
      num('settings.metaphorGrain', 'grain', 0, 2, 0.05),
      sw('settings.metaphorNegative', 'negative', true),
      sw('settings.metaphorFlip', 'flip', false),
      sw('settings.metaphorKeywordColors', 'keywordColors', false),
      sw('settings.metaphorTransitions', 'transitions', true),
    ))
  }
  /** Folia nebbia tuning: window/glass and the handwriting core. */
  function nebbiaTuningBlock() {
    var tuning = prefs.nebbiaTuning || {}
    function num(label, key, min, max, step) {
      var value = Number(tuning[key])
      if (!isFinite(value)) value = min
      return mpPanelRow(t(label), h('input', {
        type: 'range', className: 'mp-range', min: String(min), max: String(max), step: String(step),
        value: String(value), 'aria-label': t(label),
        onChange: function (event) { setPrefs({ nebbiaTuning: Object.assign({}, tuning, { [key]: Number(event.target.value) }) }) },
      }))
    }
    function choice(label, key, options) {
      var current = options.some(function (item) { return item.value === tuning[key] }) ? tuning[key] : options[0].value
      return mpPanelRow(t(label), segmented(options, current, function (value) { setPrefs({ nebbiaTuning: Object.assign({}, tuning, { [key]: value }) }) }))
    }
    function listRow(label, key, options, minOne) {
      var current = Array.isArray(tuning[key]) ? tuning[key] : []
      return h('div', { key: key },
        h('div', { className: 'mp-set-label', style: { paddingTop: '8px' } }, t(label)),
        options.map(function (item) {
          var on = current.indexOf(item.value) >= 0
          return mpPanelRow(item.text, h(Switch, {
            value: on,
            label: item.text,
            onChange: function (next) {
              var list = current.filter(function (value) { return value !== item.value })
              if (next) list.push(item.value)
              if (minOne && list.length === 0) return
              setPrefs({ nebbiaTuning: Object.assign({}, tuning, { [key]: list }) })
            },
          }))
        }),
      )
    }
    return mpSection(t('settings.nebbiaTuning'), h('div', null,
      listRow('settings.nebbiaAppear', 'appear', [{ value: 'write', text: t('settings.nebbiaAppearWrite') }, { value: 'fade', text: t('settings.nebbiaAppearFade') }, { value: 'breath', text: t('settings.nebbiaAppearBreath') }], true),
      listRow('settings.nebbiaFade', 'fade', [{ value: 'fog', text: t('settings.nebbiaFadeFog') }, { value: 'fingers', text: t('settings.nebbiaFadeFingers') }], true),
      listRow('settings.nebbiaLayouts', 'layouts', [{ value: 'ribbon', text: t('settings.nebbiaLayoutRibbon') }, { value: 'lines2', text: t('settings.nebbiaLayoutLines2') }, { value: 'lines3', text: t('settings.nebbiaLayoutLines3') }, { value: 'cross', text: t('settings.nebbiaLayoutCross') }, { value: 'pillar', text: t('settings.nebbiaLayoutPillar') }, { value: 'header', text: t('settings.nebbiaLayoutHeader') }, { value: 'badge', text: t('settings.nebbiaLayoutBadge') }, { value: 'columns', text: t('settings.nebbiaLayoutColumns') }, { value: 'orbit', text: t('settings.nebbiaLayoutOrbit') }], true),
      listRow('settings.nebbiaScenery', 'scenery', [{ value: 'spot', text: t('settings.nebbiaScenerySpot') }, { value: 'buildings', text: t('settings.nebbiaSceneryBuildings') }, { value: 'lights', text: t('settings.nebbiaSceneryLights') }, { value: 'cars', text: t('settings.nebbiaSceneryCars') }, { value: 'road', text: t('settings.nebbiaSceneryRoad') }], false),
      choice('settings.nebbiaBehind', 'behind', [{ value: 'night', label: t('settings.nebbiaBehindNight') }, { value: 'aquarium', label: t('settings.nebbiaBehindAquarium') }, { value: 'backdrop', label: t('settings.nebbiaBehindBackdrop') }]),
      choice('settings.nebbiaGlass', 'glass', [{ value: 'rain', label: t('settings.nebbiaGlassRain') }, { value: 'dew', label: t('settings.nebbiaGlassDew') }, { value: 'snow', label: t('settings.nebbiaGlassSnow') }]),
      choice('settings.nebbiaRain', 'rain', [{ value: 'slant', label: t('settings.nebbiaRainSlant') }, { value: 'straight', label: t('settings.nebbiaRainStraight') }, { value: 'off', label: t('settings.nebbiaRainOff') }]),
      mpPanelRow(t('settings.nebbiaCredits'), h(Switch, { value: tuning.credits !== false, label: t('settings.nebbiaCredits'), onChange: function (value) { setPrefs({ nebbiaTuning: Object.assign({}, tuning, { credits: value }) }) } })),
      num('settings.nebbiaJitter', 'jitter', 0, 1.5, 0.05),
      num('settings.nebbiaWarp', 'warp', 0, 1.5, 0.05),
      num('settings.nebbiaMist', 'mist', 0.2, 1, 0.01),
      num('settings.nebbiaHold', 'hold', 0, 6, 0.1),
      num('settings.nebbiaRefog', 'refog', 0.5, 12, 0.1),
      num('settings.nebbiaStroke', 'strokeWidth', 0.04, 0.16, 0.005),
      num('settings.nebbiaWriteSpeed', 'writeSpeed', 0.4, 2.5, 0.05),
      num('settings.nebbiaDoodle', 'doodle', 0, 1, 0.05),
      num('settings.nebbiaBusSpeed', 'busSpeed', 0, 3, 0.05),
      num('settings.nebbiaNeon', 'neon', 0, 2, 0.05),
      num('settings.nebbiaSpot', 'spot', 0, 2, 0.05),
      num('settings.nebbiaSpotX', 'spotX', 0, 1, 0.01),
      num('settings.nebbiaRainHit', 'rainHit', 0, 3, 0.05),
      num('settings.nebbiaRainBig', 'rainBig', 0, 2, 0.05),
      num('settings.nebbiaBump', 'bump', 0, 2.5, 0.05),
      num('settings.nebbiaJellies', 'jellies', 0, 24, 1),
      num('settings.nebbiaJellySize', 'jellySize', 0.5, 1.8, 0.05),
      num('settings.nebbiaBubbles', 'bubbles', 0, 1, 0.01),
      num('settings.nebbiaDew', 'dew', 0, 1.5, 0.01),
      num('settings.nebbiaDewSize', 'dewSize', 0.5, 2, 0.05),
      num('settings.nebbiaDewGlint', 'dewGlint', 0, 2, 0.05),
      num('settings.nebbiaSnow', 'snow', 0, 3, 0.05),
      num('settings.nebbiaSnowSize', 'snowSize', 0.5, 2, 0.05),
      num('settings.nebbiaSnowMelt', 'snowMelt', 0.25, 3, 0.05),
    ))
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
      // 播放模式只有一个入口：底栏那颗按钮（顺序 → 单曲 → 随机）。这里不再放第二套控件。
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
        t('settings.playerChromeMode'),
        segmented(
          [
            { value: 'always-visible', label: t('settings.playerChromeAlwaysVisible') },
            { value: 'auto-hide', label: t('settings.playerChromeAutoHide') },
            { value: 'always-hidden', label: t('settings.playerChromeAlwaysHidden') },
          ],
          ['always-visible', 'auto-hide', 'always-hidden'].indexOf(prefs.playerChromeVisibilityMode) >= 0
            ? prefs.playerChromeVisibilityMode
            : (prefs.autoHidePlayerChrome === true ? 'auto-hide' : 'always-visible'),
          function (value) {
            setPrefs({
              playerChromeVisibilityMode: value,
              autoHidePlayerChrome: value === 'auto-hide',
              playerChromeModeChosen: true,
            })
          },
        ),
        t('settings.autoHidePlayerChromeDesc'),
      ),
      mpPanelRow(
        t('sheet.effects'),
        cardButton(t('sheet.open'), function () {
          pushLayer('equalizer', {})
        }),
        t(normalizeEqPrefs(prefs).enabled ? 'eq.procOn' : 'eq.procOff'),
      ),
    )
  }
  var bodies = [null, cardLyricsPane(), cardQueuePane(), cardAudioPane(), cardLookPane()]

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

  return h(FoliaPanelShell, {
    framer: framer,
    right: props.anchor && props.anchor.right >= 0 ? String(props.anchor.right) + 'px' : '22px',
    bottom: String(cardBottom) + 'px',
    // The card root is `position:fixed;inset:0` inside the player page, and the fullscreen
    // button (`.mp-np-fs`, top 22 + 36 tall) lives in that same box: 100% is that box's height.
    // Expressing the bound as a percentage keeps the two in one coordinate space, so the card
    // cannot reach the button no matter where the page sits in the window (title bar, scale).
    maxHeight: 'max(240px, calc(100% - ' + String(MP_TOP_MARGIN) + 'px - ' + String(cardBottom) + 'px))',
    onClose: onClose,
    header: header,
    body: body,
    dock: dock,
  })
}






