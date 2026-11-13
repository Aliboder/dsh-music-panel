/**
 * eq-panel: the equalizer surface inside the audio-effects popover.
 *
 * Three tabs, mirroring how desktop players organise this: factory presets,
 * the user's saved curves, and the editor (response curve + faders + preamp).
 * All state lives in prefs through `player.setEq`, so the panel stays a pure
 * view of a single source of truth.
 */

var EQ_TABS = [
  { id: 'presets', labelKey: 'eq.tabPresets' },
  { id: 'mine', labelKey: 'eq.tabMine' },
  { id: 'edit', labelKey: 'eq.tabEdit' },
]

function eqFormatDb(value) {
  var db = Number(value) || 0
  if (Math.abs(db) < 0.05) return '0'
  return (db > 0 ? '+' : '') + String(Math.round(db))
}

function eqFrequencyLabel(freq) {
  return freq >= 1000 ? String(freq / 1000) + 'k' : String(freq)
}

/** Tiny ten-bar thumbnail of a curve, used in the preset and saved lists. */
function EqMiniBars(props) {
  var bands = props.bands || []
  return h(
    'span',
    { className: 'mp-eq-bars', 'aria-hidden': 'true' },
    EQ_FREQS.map(function (_, index) {
      var db = clamp(Number(bands[index]) || 0, -EQ_MAX_DB, EQ_MAX_DB)
      return h('i', { key: index, style: { height: Math.round(50 + (db / EQ_MAX_DB) * 50) + '%' } })
    }),
  )
}

/** Real magnitude response of the current chain, drawn as a line. */
function EqCurve(props) {
  var bands = props.bands || []
  var samples = eqCurveSamples(bands, props.preamp, 72, 44100)
  var width = 300
  var height = 64
  var span = EQ_MAX_DB + 6
  var lowLog = Math.log(EQ_MIN_HZ)
  var highLog = Math.log(EQ_MAX_HZ)
  var points = samples.map(function (sample) {
    var x = ((Math.log(sample.freq) - lowLog) / (highLog - lowLog)) * width
    var y = height / 2 - (sample.db / span) * (height / 2)
    return x.toFixed(1) + ',' + clamp(y, 0, height).toFixed(1)
  })
  return h(
    'svg',
    {
      className: 'mp-eq-curve',
      viewBox: '0 0 ' + width + ' ' + height,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    },
    h('line', {
      x1: 0,
      y1: height / 2,
      x2: width,
      y2: height / 2,
      className: 'mp-eq-curve-zero',
      vectorEffect: 'non-scaling-stroke',
    }),
    h('polyline', {
      points: points.join(' '),
      className: 'mp-eq-curve-line',
      vectorEffect: 'non-scaling-stroke',
    }),
  )
}

function EqFader(props) {
  return h(
    'div',
    { className: cx('mp-eq-fader', (Number(props.value) || 0) !== 0 && 'is-active') },
    h('span', { className: 'mp-eq-fader-value' }, eqFormatDb(props.value)),
    h('input', {
      type: 'range',
      min: -EQ_MAX_DB,
      max: EQ_MAX_DB,
      step: 1,
      value: Number(props.value) || 0,
      'aria-label': props.label + ' Hz',
      title: props.label + ' Hz',
      onChange: function (event) {
        props.onChange(Number(event.target.value))
      },
      onDoubleClick: function () {
        props.onChange(0)
      },
    }),
    h('span', { className: 'mp-eq-fader-label' }, props.label),
  )
}

function EqPresetTile(props) {
  return h(
    'button',
    {
      type: 'button',
      className: cx('mp-eq-preset', props.active === true && 'is-on'),
      onClick: props.onClick,
      title: props.name,
    },
    h('span', { className: 'mp-eq-preset-name' }, props.name),
    h(EqMiniBars, { bands: props.bands }),
  )
}

/**
 * audio-effects: one popover with two views.
 *
 * The volume controls and the equalizer are content of the same panel, not two
 * popovers that swap under the button, so the panel keeps its position and
 * chrome while the view changes.
 */

var AUDIO_FX_VIEWS = [
  { id: 'audio', labelKey: 'page.volume' },
  { id: 'eq', labelKey: 'eq.title' },
]

function AudioEffectsPanel(props) {
  var snap = props.snap || {}
  var prefs = props.prefs || {}
  var track = props.track || null
  var view = props.view === 'eq' ? 'eq' : 'audio'
  var volume = clamp(Number(snap.volume), 0, 1)
  if (!isFinite(volume)) volume = 1
  var muted = snap.muted === true

  function show(next) {
    if (typeof props.onView === 'function') props.onView(next)
  }

  var body =
    view === 'audio'
      ? h(
          'div',
          { className: 'mp-fx-body' },
          h(
            'div',
            { className: 'mp-fx-row' },
            h('span', { className: 'mp-fx-label' }, t('page.volume')),
            h('span', { className: 'mp-fx-value' }, Math.round((muted ? 0 : volume) * 100) + '%'),
          ),
          h('input', {
            type: 'range',
            className: 'mp-range mp-fx-range',
            min: 0,
            max: 1,
            step: 0.01,
            value: volume,
            'aria-label': t('page.volume'),
            onChange: function (event) {
              player.setVolume(Number(event.target.value))
            },
          }),
          h(
            'div',
            { className: 'mp-np-extra-row' },
            h('span', null, t('settings.volumeNormalize')),
            h(Switch, {
              value: prefs.normalizeVolume !== false,
              onChange: function (value) {
                setPrefs({ normalizeVolume: value })
              },
            }),
          ),
          h(
            'div',
            { className: 'mp-np-extra-hint' },
            track && track.qualityHint ? track.qualityHint : t('online.qualityStandard'),
          ),
        )
      : h(EqPanel, {})

  return h(
    'div',
    { className: 'mp-np-extra-pop is-effects' },
    h(
      'div',
      { className: 'mp-fx-head' },
      h('span', { className: 'mp-fx-title' }, t('page.audioEffects')),
      h(
        'div',
        { className: 'mp-fx-seg', role: 'tablist' },
        AUDIO_FX_VIEWS.map(function (item) {
          return h(
            'button',
            {
              key: item.id,
              type: 'button',
              role: 'tab',
              'aria-selected': view === item.id,
              className: cx('mp-fx-seg-btn', view === item.id && 'is-on'),
              onClick: function () {
                show(item.id)
              },
            },
            t(item.labelKey),
          )
        }),
      ),
    ),
    body,
  )
}

function EqPanel(props) {
  var prefs = usePrefs()
  var eq = normalizeEqPrefs(prefs)
  var tabPair = useState(
    props.initialTab === 'mine' || props.initialTab === 'edit' ? props.initialTab : 'presets',
  )
  var tab = tabPair[0]
  var setTab = tabPair[1]
  var namingPair = useState(false)
  var naming = namingPair[0]
  var setNaming = namingPair[1]
  var draftPair = useState('')
  var draft = draftPair[0]
  var setDraft = draftPair[1]
  var custom = Array.isArray(prefs.eqCustom) ? prefs.eqCustom : []
  var available = player.getEq().available
  var activePreset = eqPresetForBands(eq.bands)

  function usePreset(preset) {
    player.setEq({ preset: preset.id, bands: eqBandsForPreset(preset.id), enabled: true })
  }

  function changeBand(index, value) {
    var bands = eq.bands.slice()
    bands[index] = clamp(Number(value) || 0, -EQ_MAX_DB, EQ_MAX_DB)
    player.setEq({ bands: bands, preset: eqPresetForBands(bands), enabled: true })
  }

  function useSaved(entry) {
    if (entry === null || typeof entry !== 'object') return
    if (!Array.isArray(entry.bands)) return
    player.setEq({
      bands: entry.bands,
      preamp: entry.preamp,
      preset: eqPresetForBands(entry.bands),
      enabled: true,
    })
  }

  function saveCurrent() {
    var name = String(draft || '').trim()
    if (name === '') {
      showToast(t('eq.needName'))
      return
    }
    var entry = {
      id: 'u' + Date.now().toString(36),
      name: name.slice(0, 24),
      bands: eq.bands.slice(),
      preamp: eq.preamp,
      at: Date.now(),
    }
    var list = custom.filter(function (item) {
      return item && item.name !== entry.name
    })
    list.unshift(entry)
    setPrefs({ eqCustom: list.slice(0, EQ_CUSTOM_LIMIT) })
    setNaming(false)
    setDraft('')
    showToast(t('eq.saved'))
  }

  function removeSaved(id) {
    setPrefs({
      eqCustom: custom.filter(function (item) {
        return item && item.id !== id
      }),
    })
  }

  var body = null
  if (tab === 'presets') {
    body = h(
      'div',
      { className: 'mp-eq-grid' },
      EQ_PRESETS.map(function (preset) {
        return h(EqPresetTile, {
          key: preset.id,
          name: eqPresetName(preset),
          bands: eqBandsForPreset(preset.id),
          active: activePreset === preset.id && eq.enabled,
          onClick: function () {
            usePreset(preset)
          },
        })
      }),
    )
  } else if (tab === 'mine') {
    body = h(
      'div',
      { className: 'mp-eq-mine' },
      custom.length === 0
        ? h(
            'div',
            { className: 'mp-eq-empty' },
            h('span', { className: 'mp-eq-empty-title' }, t('eq.empty')),
            h('span', { className: 'mp-eq-empty-hint' }, t('eq.emptyHint')),
          )
        : h(
            'div',
            { className: 'mp-eq-saved' },
            custom.map(function (entry) {
              return h(
                'div',
                { key: entry.id, className: 'mp-eq-saved-row' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-eq-saved-main',
                    onClick: function () {
                      useSaved(entry)
                    },
                  },
                  h('span', { className: 'mp-eq-saved-name' }, entry.name),
                  h(EqMiniBars, { bands: entry.bands }),
                ),
                h(IconButton, {
                  icon: 'trash',
                  size: 13,
                  title: t('eq.delete'),
                  onClick: function () {
                    removeSaved(entry.id)
                  },
                }),
              )
            }),
          ),
      naming
        ? h(
            'div',
            { className: 'mp-eq-save-form' },
            h('input', {
              type: 'text',
              className: 'mp-kit-input mp-eq-save-input',
              value: draft,
              maxLength: 24,
              autoFocus: true,
              placeholder: t('eq.savePlaceholder'),
              onChange: function (event) {
                setDraft(event.target.value)
              },
              onKeyDown: function (event) {
                if (event.key === 'Enter') saveCurrent()
                if (event.key === 'Escape') setNaming(false)
              },
            }),
            h(Button, { onClick: saveCurrent, className: 'mp-eq-save-ok' }, t('eq.save')),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-eq-save-cancel',
                onClick: function () {
                  setNaming(false)
                },
              },
              t('eq.cancel'),
            ),
          )
        : h(
            'button',
            {
              type: 'button',
              className: 'mp-eq-add',
              onClick: function () {
                setNaming(true)
              },
            },
            icon('plus', 13),
            h('span', null, t('eq.saveCurrent')),
          ),
    )
  } else {
    body = h(
      'div',
      { className: 'mp-eq-edit' },
      h(EqCurve, { bands: eq.bands, preamp: eq.preamp }),
      h(
        'div',
        { className: 'mp-eq-faders' },
        EQ_FREQS.map(function (freq, index) {
          return h(EqFader, {
            key: freq,
            label: eqFrequencyLabel(freq),
            value: eq.bands[index],
            offset: eq.bands[index],
            onChange: function (value) {
              changeBand(index, value)
            },
          })
        }),
      ),
      h(
        'div',
        { className: 'mp-eq-preamp' },
        h('span', { className: 'mp-eq-preamp-label' }, t('eq.preamp')),
        h('input', {
          type: 'range',
          min: -EQ_PREAMP_MAX,
          max: EQ_PREAMP_MAX,
          step: 1,
          className: 'mp-range',
          value: eq.preamp,
          'aria-label': t('eq.preamp'),
          onChange: function (event) {
            player.setEq({ preamp: Number(event.target.value), enabled: true })
          },
        }),
        h('span', { className: 'mp-eq-preamp-value' }, eqFormatDb(eq.preamp) + ' dB'),
      ),
      h('div', { className: 'mp-eq-hint' }, t('eq.preampHint')),
      h(
        'div',
        { className: 'mp-eq-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'mp-eq-action',
            onClick: function () {
              player.setEq({ preset: 'flat', bands: zeroEqBands(), preamp: 0 })
            },
          },
          t('eq.reset'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-eq-action',
            onClick: function () {
              setTab('mine')
              setNaming(true)
            },
          },
          t('eq.saveCurrent'),
        ),
      ),
    )
  }

  return h(
    'div',
    { className: 'mp-eqp' },
    h(
      'div',
      { className: 'mp-eq-tabs-row' },
      h(
        'div',
        { className: 'mp-eq-tabs', role: 'tablist' },
        EQ_TABS.map(function (item) {
          return h(
            'button',
            {
              key: item.id,
              type: 'button',
              role: 'tab',
              'aria-selected': tab === item.id,
              className: cx('mp-eq-tab', tab === item.id && 'is-on'),
              onClick: function () {
                setTab(item.id)
              },
            },
            t(item.labelKey),
          )
        }),
      ),
      h(Switch, {
        value: eq.enabled,
        label: t('eq.enable'),
        title: t('eq.enable'),
        onChange: function (value) {
          player.setEq({ enabled: value })
        },
      }),
    ),
    eq.enabled && !available ? h('div', { className: 'mp-eq-warn' }, t('eq.unavailable')) : null,
    h('div', { className: 'mp-eq-body' }, body),
  )
}
