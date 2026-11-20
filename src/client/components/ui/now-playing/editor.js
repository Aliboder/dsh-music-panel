function NpEditor(props) {
  var prefs = usePrefs()
  var cover = typeof props.cover === 'string' ? props.cover : ''
  var title = typeof props.title === 'string' ? props.title : ''
  var artist = typeof props.artist === 'string' ? props.artist : ''
  var resetPair = useState(false)
  var resetConfirm = resetPair[0]
  var setResetConfirm = resetPair[1]

  useEffect(
    function () {
      if (props.open !== true) return undefined
      function onKey(event) {
        if (event.key === 'Escape') props.onClose()
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
      }
    },
    [props.open],
  )

  useEffect(
    function () {
      if (props.open !== true) setResetConfirm(false)
    },
    [props.open],
  )

  if (props.open !== true) return null

  function resetDefaults() {
    setPrefs({
      lyricSize: 35,
      lyricGap: 15,
      translationScale: 90,
      lyricAlign: 'left',
      lyricBlur: true,
      waveEnabled: true,
      showTranslation: true,
      lyricLocalPriority: 'local',
      lyricPreferredSource: 'qq',
      npPaneGap: 60,
      npLyricWidth: 560,
      npFlowBg: true,
      npAmbientOn: true,
      npAmbientDrift: 300,
      npAmbientSpeed: 400,
      npBeatSensitivity: 200,
      npBeatAmount: 300,
    })
  }

  function sectionHead(label) {
    return h(
      'div',
      { className: 'mp-npe-sec-head' },
      h('span', { className: 'mp-npe-sec-title' }, label),
      h('span', { className: 'mp-npe-sec-line' }),
    )
  }

  function rangeRow(label, value, min, max, step, unit, apply, hint) {
    return h(
      'div',
      { className: 'mp-npe-row' },
      h(
        'div',
        { className: 'mp-npe-range-head' },
        h('span', null, label),
        h('span', { className: 'mp-npe-val' }, value + unit),
      ),
      h('input', {
        type: 'range',
        className: 'mp-range',
        min: min,
        max: max,
        step: step,
        value: value,
        'aria-label': label,
        onChange: function (event) {
          apply(Number(event.target.value))
        },
      }),
      hint ? h('div', { className: 'mp-npe-hint' }, hint) : null,
    )
  }

  function switchRow(label, value, apply, hint) {
    return h(
      'div',
      { className: 'mp-npe-switch-row' + (hint ? ' has-hint' : '') },
      h(
        'span',
        { className: 'mp-npe-switch-text' },
        h('span', null, label),
        hint ? h('span', { className: 'mp-npe-hint' }, hint) : null,
      ),
      h(Switch, { value: value, onChange: apply }),
    )
  }

  function previewCard() {
    var align = prefs.lyricAlign || 'left'
    var size = Number(prefs.lyricSize) || 35
    var scale = Math.max(0.5, Math.min(1, (Number(prefs.translationScale) || 100) / 100))
    var activeSize = Math.max(13, Math.round(size * 0.5))
    var sideSize = Math.max(12, Math.round(size * 0.42))
    var transSize = Math.max(11, Math.round(size * 0.42 * scale))
    return h(
      'div',
      { className: 'mp-npe-preview' + (prefs.lyricBlur === true ? ' is-blur' : '') },
      h(
        'div',
        { className: 'mp-npe-preview-stage' },
        cover !== '' ? h('img', { className: 'mp-npe-preview-bg', src: cover, alt: '' }) : null,
        h('span', { className: 'mp-npe-preview-label' }, t('editor.preview')),
        h(
          'div',
          { className: 'mp-npe-preview-body' },
          h(
            'div',
            {
              className:
                'mp-npe-preview-cover',
              style:
                cover !== ''
                  ? { '--mp-preview-cover': 'url("' + cover.replace(/"/g, '%22') + '")' }
                  : undefined,
            },
            cover !== '' ? h('img', { src: cover, alt: '' }) : icon('note', 26),
          ),
          h(
            'div',
            { className: 'mp-npe-preview-text', style: { textAlign: align } },
            h('div', { className: 'mp-npe-preview-title' }, title || t('editor.sampleTitle')),
            artist !== '' ? h('div', { className: 'mp-npe-preview-artist' }, artist) : null,
            h(
              'div',
              { className: 'mp-npe-preview-line', style: { fontSize: sideSize + 'px' } },
              t('editor.samplePrev'),
            ),
            h(
              'div',
              { className: 'mp-npe-preview-line is-active', style: { fontSize: activeSize + 'px' } },
              t('editor.sampleLyric'),
            ),
            prefs.showTranslation === true
              ? h(
                  'div',
                  { className: 'mp-npe-preview-trans', style: { fontSize: transSize + 'px' } },
                  t('editor.sampleTranslation'),
                )
              : null,
            h(
              'div',
              { className: 'mp-npe-preview-line', style: { fontSize: sideSize + 'px' } },
              t('editor.sampleNext'),
            ),
          ),
        ),
      ),
    )
  }

  return h(
    'div',
    {
      className: 'mp-npe',
      onClick: function (event) {
        if (event.target === event.currentTarget) props.onClose()
      },
    },
    h(
      'div',
      {
        className: 'mp-npe-panel',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('editor.title'),
      },
      h(
        'div',
        { className: 'mp-npe-head' },
        h(
          'div',
          { className: 'mp-npe-head-text' },
          h('div', { className: 'mp-npe-title' }, t('editor.title')),
          h('div', { className: 'mp-npe-sub' }, t('editor.subtitle')),
        ),
        h(
          'div',
          { className: 'mp-npe-head-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'mp-npe-close',
              title: t('editor.close'),
              'aria-label': t('editor.close'),
              onClick: props.onClose,
            },
            icon('x', 18),
          ),
        ),
      ),
      resetConfirm
        ? h(
            'div',
            { className: 'mp-npe-confirm' },
            h(
              'div',
              { className: 'mp-npe-confirm-text' },
              h('div', { className: 'mp-npe-confirm-title' }, t('editor.resetConfirm')),
              h('div', { className: 'mp-npe-confirm-hint' }, t('editor.resetHint')),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-npe-confirm-btn',
                onClick: function () {
                  setResetConfirm(false)
                },
              },
              t('editor.cancel'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-npe-confirm-btn is-primary',
                onClick: function () {
                  resetDefaults()
                  setResetConfirm(false)
                },
              },
              t('editor.reset'),
            ),
          )
        : null,
      h(
        'div',
        { className: 'mp-npe-body' },
        previewCard(),
        h(
          'div',
          { className: 'mp-npe-section is-type' },
          sectionHead(t('editor.type')),
          rangeRow(t('page.lyricSize'), prefs.lyricSize || 25, 14, 40, 1, ' px', function (value) {
            setPrefs({ lyricSize: value })
          }),
          rangeRow(t('page.lyricGap'), Number(prefs.lyricGap) || 10, 2, 16, 1, ' px', function (value) {
            setPrefs({ lyricGap: value })
          }),
          rangeRow(t('editor.paneGap'), Number(prefs.npPaneGap) || 60, 12, 96, 4, ' px', function (value) {
            setPrefs({ npPaneGap: value })
          }, t('editor.paneGapHint')),
          rangeRow(
            t('page.translationScale'),
            prefs.translationScale || 100,
            50,
            100,
            5,
            '%',
            function (value) {
              setPrefs({ translationScale: value })
            },
          ),
          h(
            'div',
            { className: 'mp-npe-row' },
            h('div', { className: 'mp-npe-range-head' }, h('span', null, t('settings.lyricAlign'))),
            h(
              'div',
              { className: 'mp-npe-seg' },
              [
                ['left', 'settings.alignLeft'],
                ['center', 'settings.alignCenter'],
                ['right', 'settings.alignRight'],
              ].map(function (item) {
                return h(
                  'button',
                  {
                    key: item[0],
                    type: 'button',
                    className: cx('mp-npe-seg-btn', (prefs.lyricAlign || 'left') === item[0] && 'is-on'),
                    onClick: function () {
                      setPrefs({ lyricAlign: item[0] })
                    },
                  },
                  t(item[1]),
                )
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'mp-npe-section is-display' },
          sectionHead(t('editor.display')),
          switchRow(t('page.translation'), prefs.showTranslation === true, function (value) {
            setPrefs({ showTranslation: value })
          }),
          switchRow(t('page.lyricBlur'), prefs.lyricBlur === true, function (value) {
            setPrefs({ lyricBlur: value })
          }),
          switchRow(t('editor.wave'), prefs.waveEnabled !== false, function (value) {
            setPrefs({ waveEnabled: value })
          }),
        ),
      ),
      h(
        'div',
        { className: 'mp-npe-foot' },
        h(
          'button',
          {
            type: 'button',
            className: 'mp-npe-btn is-ghost',
            onClick: function () {
              setResetConfirm(true)
            },
          },
          t('editor.reset'),
        ),
        h(
          'button',
          { type: 'button', className: 'mp-npe-btn is-primary', onClick: props.onClose },
          t('editor.done'),
        ),
      ),
    ),
  )
}
