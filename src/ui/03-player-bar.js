/**
 * player bar: the persistent transport at the bottom of the panel.
 */

function playerLoopNext(loop) {
  if (loop === 'none') return 'all'
  if (loop === 'all') return 'one'
  return 'none'
}

function SleepChip(props) {
  var remaining = useCountdown(props.deadline)
  if (remaining <= 0) return null
  return h(
    'button',
    {
      type: 'button',
      className: 'mp-chip mp-sleep-chip',
      title: t('v2.sleepCancel'),
      onClick: function () {
        setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
      },
    },
    icon('clock', 12),
    fmtClock(remaining / 1000),
  )
}

function PlayerBar(props) {
  var snap = usePlayerSnapshot()
  var prefs = usePrefs()
  var time = usePlayerTime()
  var previewPair = useState(null)
  var preview = previewPair[0]
  var setPreview = previewPair[1]
  var current = snap.queue[snap.index] || null
  var duration = time.duration > 0 ? time.duration : current ? current.durationSec || 0 : 0
  var progressPercent =
    duration > 0 ? clamp(((preview !== null ? preview : time.currentTime) / duration) * 100, 0, 100) : 0
  // The bar, the lists and the card all read this same SongLike.
  var like = current === null ? { isLiked: false, disabled: true, reason: '', onLike: function () {} } : likeStateOf(current, props.favoriteSet)



  if (current === null) {
    return h(
      'div',
      { className: 'mp-playerbar is-empty' },
      h(
        'div',
        { className: 'mp-pb-track' },
        h('div', { className: 'mp-pb-cover' }, icon('note', 16)),
        h(
          'div',
          { className: 'mp-pb-meta' },
          h('div', { className: 'mp-pb-title' }, t('page.noTrack')),
          h('div', { className: 'mp-pb-artist' }, t('v2.pickTrack')),
        ),
      ),
      h(
        'div',
        { className: 'mp-pb-center' },
        h(
          'div',
          { className: 'mp-pb-controls' },
          h(IconButton, { icon: 'prev', title: t('page.prev'), disabled: true }),
          h('button', { type: 'button', className: 'mp-pb-play', disabled: true }, icon('play', 15)),
          h(IconButton, { icon: 'next', title: t('page.next'), disabled: true }),
        ),
      ),
      h('div', { className: 'mp-pb-right' }, h(SleepChip, { deadline: prefs.sleepDeadline })),
    )
  }

  return h(
    'div',
    {
      className: 'mp-playerbar',
      onClick: function (event) {
        var target = event.target
        if (target && target.closest && target.closest('button,input,a,[role="slider"],.mp-pb-queue-wrap')) return
        if (props.onOpenNowPlaying) props.onOpenNowPlaying()
      },
    },
    h(
      'div',
      { className: 'mp-pb-seek-full' },
      h(SeekBar, { fallbackDuration: current.durationSec || 0, onPreview: setPreview }),
    ),
    h(
      'div',
      { className: 'mp-pb-track' },
      h(
        'div',
        {
          className: 'mp-pb-cover',
          role: 'button',
          tabIndex: 0,
          title: t('page.openPlayer'),
          onClick: props.onOpenNowPlaying,
          onKeyDown: function (event) {
            if (event.key === 'Enter') props.onOpenNowPlaying()
          },
        },
        h(Cover, { src: trackCoverSrc(current), iconSize: 16 }),
        snap.playing
          ? h('span', { className: 'mp-pb-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
          : null,
      ),
      h(
        'div',
        { className: 'mp-pb-meta' },
        h('div', { className: 'mp-pb-title', title: trackTitleOf(current) }, trackTitleOf(current)),
        h('div', { className: 'mp-pb-artist', title: trackArtistOf(current) }, trackArtistOf(current)),
      ),
      h(IconButton, {
        key: 'like',
        icon: like.isLiked ? 'heartFill' : 'heart',
        size: 16,
        className: 'mp-pb-fav',
        active: like.isLiked,
        disabled: like.disabled === true,
        title: like.disabled === true ? like.reason : like.isLiked ? t('page.unfavorite') : t('page.favorite'),
        onClick: like.onLike,
      }),
    ),
    h(
      'div',
      { className: 'mp-pb-center' },
      h(
        'div',
        { className: 'mp-pb-controls' },
        h(IconButton, {
          icon: 'shuffle',
          size: 17,
          active: snap.order === 'random',
          title: t('page.shuffle'),
          onClick: function () {
            player.setOrder(snap.order === 'random' ? 'list' : 'random')
          },
        }),
        h(IconButton, {
          icon: 'prev',
          size: 17,
          title: t('page.prev'),
          tooltip: false,
          onClick: function () {
            player.prev()
          },
        }),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-pb-play',
            title: snap.playing ? t('page.pause') : t('page.play'),
            'aria-label': snap.playing ? t('page.pause') : t('page.play'),
            onClick: function () {
              player.toggle()
            },
          },
          icon(snap.playing ? 'pause' : 'play', 15),
        ),
        h(IconButton, {
          icon: 'next',
          size: 17,
          title: t('page.next'),
          tooltip: false,
          onClick: function () {
            player.next()
          },
        }),
        h(IconButton, {
          icon: snap.loop === 'one' ? 'repeatOne' : 'repeat',
          size: 17,
          active: snap.loop !== 'none',
          title:
            snap.loop === 'one'
              ? t('page.loopOne')
              : snap.loop === 'all'
                ? t('page.loopAll')
                : t('page.loopNone'),
          onClick: function () {
            player.setLoop(playerLoopNext(snap.loop))
          },
        }),
        h(
          'div',
          { className: 'mp-pb-queue-wrap' },
          h(IconButton, {
            icon: 'playlist',
            size: 17,
            active: props.queueOpen,
            title: t('page.queue'),
            onClick: props.onToggleQueue,
          }),
          props.queueOpen
            ? h(QueuePopover, {
                open: true,
                anchored: true,
                snap: snap,
                onClose: props.onToggleQueue,
              })
            : null,
        ),
      ),
    ),
    h(
      'div',
      { className: 'mp-pb-right' },
      h(
        'span',
        { className: cx('mp-time', 'mp-pb-time', preview !== null && 'is-preview') },
        fmtClock(preview !== null ? preview : time.currentTime) + ' / ' + fmtClock(duration),
      ),
      h(SleepChip, { deadline: prefs.sleepDeadline }),
      h(IconButton, {
        icon: 'target',
        size: 17,
        title: t('page.locateCurrent'),
        onClick: props.onLocate,
      }),
      h(
        'div',
        { className: 'mp-pb-vol' },
        h(IconButton, {
          icon: snap.muted || snap.volume === 0 ? 'mute' : snap.volume < 0.5 ? 'volumeLow' : 'volume',
          size: 16,
          title: t('page.mute'),
          onClick: function () {
            player.setMuted(!snap.muted)
          },
        }),
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          value: Math.round((snap.muted ? 0 : snap.volume) * 100),
          style: { '--mp-v': Math.round((snap.muted ? 0 : snap.volume) * 100) + '%' },
          'aria-label': t('page.volume'),
          onChange: function (event) {
            var value = Number(event.target.value) / 100
            if (snap.muted && value > 0) player.setMuted(false)
            player.setVolume(value)
          },
        }),
      ),
      h(IconButton, {
        icon: 'chevronDown',
        size: 17,
        className: 'mp-pb-expand',
        title: t('page.openPlayer'),
        onClick: props.onOpenNowPlaying,
      }),
    ),
  )
}



