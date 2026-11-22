/**
 * 悬浮音量条 — the player page's volume, always one gesture away.
 *
 * The card keeps a volume row (外观 · 音量) for keyboards and for discoverability; this rail
 * is the stage's fast path. It only takes the right edge strip, so dragging a lyric line or
 * the seek bar never hits it by accident, and it reaches full contrast on hover or focus.
 * Folia draws its volume on the transport; the page here has no transport bar of its own,
 * so the rail plays that role.
 */
function MpVolumeRail(props) {
  var prefs = usePrefs()
  var snap = usePlayerSnapshot()
  if (prefs.floatingVolume === false) return null
  var volume = Number(snap.volume)
  if (!isFinite(volume)) volume = 1
  var muted = snap.muted === true
  var heard = muted ? 0 : Math.max(0, Math.min(1, volume))
  return h(
    'div',
    {
      className: cx('mp-vol-rail', muted && 'is-muted'),
      role: 'group',
      'aria-label': t('sheet.volume'),
    },
    h(
      'button',
      {
        type: 'button',
        className: 'mp-vol-rail-btn',
        title: muted ? t('sheet.unmute') : t('sheet.mute'),
        onClick: function () {
          player.setMuted(!muted)
        },
      },
      icon(muted || heard === 0 ? 'mute' : heard < 0.5 ? 'volumeLow' : 'volume', 16),
    ),
    h('input', {
      type: 'range',
      className: 'mp-vol-rail-range',
      min: '0',
      max: '1',
      step: '0.01',
      value: String(heard),
      'aria-label': t('sheet.volume'),
      onChange: function (event) {
        player.setVolume(Number(event.target.value))
      },
    }),
    h('span', { className: 'mp-vol-rail-value', 'aria-hidden': 'true' }, String(Math.round(heard * 100)) + '%'),
  )
}
