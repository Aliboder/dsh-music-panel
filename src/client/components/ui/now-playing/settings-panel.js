function NpSettingsPanel(props) {
  var prefs = props.prefs
  var setPrefs = props.setPrefs
  var lyricSize = props.lyricSize
  var track = props.track
  var offsetMs = props.offsetMs
  var settingsRef = props.settingsRef
  var settingsPos = props.settingsPos
  var applyOffset = props.applyOffset
  var writeLyricsBack = props.writeLyricsBack
  var openOnlineLyric = props.openOnlineLyric

  return h(
          'div',
          {
            className: 'mp-np-settings',
            ref: settingsRef,
            style: settingsPos
              ? { left: settingsPos.left + 'px', bottom: settingsPos.bottom + 'px', width: settingsPos.width + 'px', right: 'auto', top: 'auto' }
              : undefined,
          },
          h(
            'div',
            { className: 'mp-np-setting' },
            h(
              'div',
              { className: 'mp-np-setting-head' },
              h('span', null, t('page.lyricSize')),
              h('span', { className: 'mp-set-val' }, lyricSize + ' px'),
            ),
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 14,
              max: 40,
              step: 1,
              value: lyricSize,
              onChange: function (event) {
                setPrefs({ lyricSize: Number(event.target.value) })
              },
            }),
          ),
          h(
            'div',
            { className: 'mp-np-setting' },
            h(
              'div',
              { className: 'mp-np-setting-head' },
              h('span', null, t('page.lyricGap')),
              h('span', { className: 'mp-set-val' }, (Number(prefs.lyricGap) || 6) + ' px'),
            ),
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 2,
              max: 16,
              step: 1,
              value: Number(prefs.lyricGap) || 6,
              onChange: function (event) {
                setPrefs({ lyricGap: Number(event.target.value) })
              },
            }),
          ),
          h(
            'div',
            { className: 'mp-np-setting-head' },
            // The editor is a dark surface too; inherit its light ink (the head sets it)
            // instead of the host label token, which is dark ink in the light theme.
            h('span', { style: { fontSize: '12px' } }, t('page.translationScale')),
            h('span', { className: 'mp-set-val' }, String(prefs.translationScale || 80) + '%'),
          ),
          h('input', {
            type: 'range',
            className: 'mp-range',
            min: 50,
            max: 100,
            step: 5,
            value: prefs.translationScale || 80,
            onChange: function (event) {
              setPrefs({ translationScale: Number(event.target.value) })
            },
          }),
          h(
            'div',
            { className: 'mp-np-setting' },
            h('div', { className: 'mp-np-setting-head' }, h('span', null, t('settings.lyricAlign'))),
            h(
              'div',
              { className: 'mp-np-align-row' },
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
                    className: cx(
                      'mp-chip',
                      (prefs.lyricAlign || 'left') === item[0] && 'is-on',
                    ),
                    onClick: function () {
                      setPrefs({ lyricAlign: item[0] })
                    },
                  },
                  t(item[1]),
                )
              }),
            ),
          ),
          h(
            SetRow,
            { label: t('page.lyricBlur') },
            h(Switch, {
              value: prefs.lyricBlur === true,
              onChange: function (value) {
                setPrefs({ lyricBlur: value })
              },
            }),
          ),
          h(
            SetRow,
            { label: t('page.translation') },
            h(Switch, {
              value: prefs.showTranslation === true,
              onChange: function (value) {
                setPrefs({ showTranslation: value })
              },
            }),
          ),
          track && !track.onlineProvider
            ? h(
                'div',
                { className: 'mp-np-setting' },
                h(
                  'div',
                  { className: 'mp-np-setting-head' },
                  h('span', null, t('page.lyricOffset')),
                  h('span', { className: 'mp-set-val' }, (offsetMs / 1000).toFixed(1) + ' s'),
                ),
                h(
                  'div',
                  { className: 'mp-np-offset-actions' },
                  h(
                    Button,
                    {
                      variant: 'ghost',
                      onClick: function () {
                        applyOffset(-500)
                      },
                    },
                    '−0.5s',
                  ),
                  h(
                    Button,
                    {
                      variant: 'ghost',
                      onClick: function () {
                        applyOffset(500)
                      },
                    },
                    '+0.5s',
                  ),
                  h(Button, { onClick: writeLyricsBack }, t('page.writeLyrics')),
                ),
                h('div', { className: 'mp-np-setting-hint' }, t('page.lyricOffsetHint')),
              )
            : null,
          track && !track.onlineProvider
            ? h(Button, { icon: 'search', onClick: openOnlineLyric }, t('page.onlineLyrics'))
            : null,
        )
}
