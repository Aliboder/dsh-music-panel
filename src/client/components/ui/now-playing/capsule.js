/**
 * 播放页底部的 Folia 式播放胶囊：播放/暂停、曲名、进度与时间、循环模式、队列。
 *
 * Folia 的胶囊是页面自己的 transport（`FloatingPlayerControls`）；这个插件在
 * `is-visualizer` 布局下会隐藏左侧栏，所以这里补一份页面级 transport。进度用
 * 全局 `SeekBar`，队列按钮交给面板里唯一那份队列，状态全部来自现有 player / props。
 */
function NowPlayingCapsule(props) {
  var snap = usePlayerSnapshot()
  var time = usePlayerTime()
  var track = snap.queue[snap.index] || null
  var duration = effectivePlayerDuration(time.duration, track ? track.durationSec : 0, time.preview === true)
  var position = Math.min(Number(time.currentTime) || 0, duration || 0)
  // 顺序 → 随机 → 单曲：和面板播放条、播放页右侧是同一个三段轮转。
  var mode = playModeOf(snap)
  return h(
    'div',
    { className: 'mp-cap' },
    h(
      'div',
      { className: 'mp-cap-inner' },
      h(
        'div',
        { className: 'mp-cap-transport' },
        h(
          'button',
          {
            type: 'button',
            className: 'mp-cap-skip',
            disabled: track === null,
            title: t('page.prev'),
            'aria-label': t('page.prev'),
            onClick: function () {
              player.prev()
            },
          },
          icon('prev', 18),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-cap-play',
            disabled: track === null,
            title: snap.playing ? t('page.pause') : t('page.play'),
            'aria-label': snap.playing ? t('page.pause') : t('page.play'),
            onClick: function () {
              player.toggle()
            },
          },
          icon(snap.playing ? 'pause' : 'play', 20),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-cap-skip',
            disabled: track === null,
            title: t('page.next'),
            'aria-label': t('page.next'),
            onClick: function () {
              player.next()
            },
          },
          icon('next', 18),
        ),
      ),
      h(
        'div',
        { className: 'mp-cap-body' },
        h('div', { className: 'mp-cap-title', title: track ? trackTitleOf(track) : '' }, track ? trackTitleOf(track) : t('page.noTrack')),
        h(
          'div',
          { className: 'mp-cap-seek' },
          h('span', { className: 'mp-cap-time' }, fmtClock(position)),
          h(SeekBar, { fallbackDuration: track ? Number(track.durationSec) || 0 : 0 }),
          h('span', { className: 'mp-cap-time' }, fmtClock(duration)),
        ),
      ),
      h(
        'div',
        { className: 'mp-cap-actions' },
        h(IconButton, {
          icon: playModeIcon(mode),
          size: 20,
          title: playModeLabel(mode),
          active: mode !== 'sequence',
          disabled: track === null,
          onClick: function () {
            cyclePlayMode(snap)
          },
        }),
        h(
          'div',
          { className: 'mp-pb-queue-wrap mp-cap-queue' },
          // The panel queue is the only queue surface; the owner closes this page first.
          h(IconButton, {
            icon: 'playlist',
            size: 20,
            title: t('page.queue'),
            onClick: props.onToggleQueue,
          }),
        ),
      ),
    ),
  )
}
