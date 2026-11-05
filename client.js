/**
 * Web Client half of dsh-music-panel.
 *
 * Three seats:
 *   - `sidebar.panellist`  the music note icon in the left rail (id = `music`)
 *   - `main`               the full player page dispatched by that id
 *   - `settings.section`   folder/depth configuration
 *
 * Playback follows the semantics local players (APlayer, Salt Player) agree
 * on: `loop` is all/one/none, `order` is list/random, `ended` dispatches on
 * both, and `seek` clamps into the loaded duration.
 */

window.__ModuleLoader__.load({
  id: 'dsh-music-panel',
  factory: function (require) {
    'use strict'

    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef
    var useMemo = React.useMemo
    var useCallback = React.useCallback

    var PANEL_ID = 'music'
    var API = 'music/'
    var PREFS_KEY = 'dsh-music.prefs'
    var CONFIG_EVENT = 'dsh-music:config-changed'
    var PREFS_EVENT = 'dsh-music:prefs-changed'

    /** Defaults for every appearance / lyric preference. */
    var PREF_DEFAULTS = {
      miniPlayer: true,
      viewMode: 'list',
      queuePos: null,
      composerQueueButton: true,
      circularCover: true,
      vinylRing: false,
      coverSpin: true,
      lyricOrder: ['embedded', 'lrc'],
      lyricAlign: 'center',
      lyricSize: 18,
      lyricWeight: 500,
      lyricBlur: true,
      showTranslation: true,
      translationScale: 80,
      composerLyrics: false,
      composerLyricPlace: 'input-left',
      // Resume behaviour follows mainstream desktop players: restore the queue
      // and position on start, but stay paused until the user asks to play.
      resumeOnStart: true,
      autoResume: false,
      rememberPerTrack: false,
    }

    // ── locale ────────────────────────────────────────────────────────────

    var DICTS = {
      zh: {
        'nav.label': '音乐',
        'page.title': '歌曲',
        'page.refresh': '重新扫描',
        'page.scanning': '扫描中…',
        'page.loadFailed': '加载失败',
        'page.retry': '重试',
        'page.emptyTitle': '还没有音乐',
        'page.emptyHint': '在 设置 → 音乐 里添加音乐文件夹，然后回到这里刷新。',
        'page.emptyFolder': '这些文件夹里没有找到音频文件',
        'page.search': '搜索',
        'page.searchPlaceholder': '搜索歌曲、歌手或专辑',
        'page.sort': '排序',
        'page.sortAsc': '升序',
        'page.sortDesc': '降序',
        'page.settings': '设置',
        'page.listSize': '列表大小',
        'page.moreSettings': '音乐目录等更多设置见「设置 → 音乐」。',
        'page.select': '多选',
        'page.selectAll': '全选',
        'page.selectNone': '取消全选',
        'page.playSelected': '播放选中',
        'page.done': '完成',
        'page.clear': '清空列表',
        'page.loopAll': '列表循环',
        'page.modeSequence': '顺序播放',
        'page.modeRandom': '随机播放',
        'page.modeOne': '单曲循环',
        'page.loopOne': '单曲循环',
        'page.loopNone': '不循环',
        'page.shuffle': '随机播放',
        'page.play': '播放',
        'page.pause': '暂停',
        'page.prev': '上一首',
        'page.next': '下一首',
        'page.queue': '播放队列',
        'page.clearQueue': '清空队列',
        'page.moveUp': '上移',
        'page.moveDown': '下移',
        'page.dragSort': '拖动排序',
        'page.more': '更多',
        'page.copyPath': '复制文件路径',
        'page.copied': '已复制',
        'page.volume': '音量',
        'page.mute': '静音',
        'page.sortTitle': '标题',
        'page.sortArtist': '歌手',
        'page.sortAlbum': '专辑',
        'page.sortDuration': '时长',
        'page.sortName': '文件名',
        'page.sortSize': '大小',
        'page.sortYear': '年份',
        'page.sortFolder': '文件夹',
        'page.sortPlays': '播放次数',
        'page.sortMtime': '修改时间',
        'page.sortAdded': '添加时间',
        'page.asc': '升序',
        'page.desc': '降序',
        'page.unknownArtist': '未知歌手',
        'page.warnings': '部分文件夹无法读取',
        'page.queueEmpty': '队列是空的',
        'page.noTrack': '未在播放',
        'page.format': '格式',
        'page.bitrate': '码率',
        'page.sampleRate': '采样率',
        'page.artist': '歌手',
        'page.album': '专辑',
        'page.duration': '时长',
        'page.size': '文件大小',
        'page.plays': '播放次数',
        'page.none': '—',
        'page.selectedCount': '已选 {n} 首',
        'page.noResults': '没有匹配的歌曲',
        'page.skipError': '音频加载失败，已跳到下一首',
        'page.audioError': '音频加载失败',
        'page.openPlayer': '打开播放页',
        'page.closePlayer': '收起播放页',
        'page.noLyrics': '暂无歌词。把同名 .lrc 文件放到歌曲旁边即可显示。',
        'page.translation': '显示 / 隐藏翻译',
        'page.lyricOffset': '歌词偏移',
        'page.writeLyrics': '写回文件',
        'page.otherTabPlaying': '另一个标签页正在播放',
        'page.lyricOffsetHint': '仅 MP3 / FLAC 支持写回内嵌歌词；其他格式只保存偏移。',
        'page.lyricSize': '字体大小',
        'page.lyricWeight': '字体粗细',
        'page.lyricBlur': '模糊非当前歌词',
        'page.translationScale': '翻译字体缩放',
        'stats.rangeWeek': '最近一周',
        'stats.modeRanking': '收听排行',
        'stats.modeRecent': '最近播放',
        'stats.rangeMonth': '最近一月',
        'stats.rangeAll': '全部时间',
        'stats.sortTime': '按时长',
        'stats.sortPlays': '按次数',
        'stats.sortRecent': '按最近',
        'stats.totalTime': '累计播放时长',
        'stats.totalPlays': '总播放次数',
        'stats.trackCount': '有记录曲目',
        'stats.plays': '{n} 次',
        'stats.empty': '还没有播放记录',
        'stats.loading': '加载中…',
        'stats.loadFailed': '统计加载失败',
        'stats.retry': '重试',
        'stats.unavailable': '文件已不可用',
        'page.tabSongs': '全部歌曲',
        'page.tabFavorites': '我喜欢',
        'page.favorite': '收藏',
        'page.unfavorite': '取消收藏',
        'page.favoritesEmpty': '还没有收藏',
        'page.favoritesHint': '点歌曲右侧的爱心加入「我喜欢」。',
        'page.tabStats': '统计',
        'page.tabPlaylists': '播放列表',
        'page.newPlaylist': '新建播放列表',
        'page.playlistName': '播放列表名称',
        'page.create': '创建',
        'page.delete': '删除',
        'page.cancel': '取消',
        'page.deleteConfirm': '删除「{name}」？此操作不可撤销。',
        'page.back': '返回',
        'page.playAll': '播放全部',
        'page.addTo': '添加到歌单',
        'page.addToPlaylist': '添加到播放列表',
        'page.addedToPlaylist': '已添加到播放列表',
        'page.reveal': '在文件夹中显示',
        'page.revealed': '已在文件夹中打开',
        'page.details': '详细信息',
        'page.noPlaylists': '还没有歌单',
        'page.newPlaylistAdd': '新建歌单并添加',
        'page.editMeta': '编辑元数据',
        'page.metaTitle': '标题',
        'page.year': '年份',
        'page.trackNo': '音轨号',
        'page.discNo': '碟号',
        'page.genre': '风格',
        'page.albumArtist': '专辑艺术家',
        'page.composer': '作曲',
        'page.lyricist': '作词',
        'page.comment': '注释',
        'page.lyrics': '歌词',
        'page.save': '保存',
        'page.saving': '保存中…',
        'page.metaSaved': '元数据已保存',
        'page.metaHint': '修改会直接写入音频文件标签（FLAC / MP3）；封面与未编辑的标签会保留。',
        'page.metaBasic': '基本信息',
        'page.metaDetail': '制作信息',
        'page.onlineMatch': '在线匹配',
        'page.onlineHint': '在线匹配使用网易云 / QQ 音乐（非官方接口）与 iTunes / MusicBrainz；结果可能不完整或随时失效。',
        'page.onlineLoading': '在线搜索中…',
        'page.onlineEmpty': '没有找到匹配结果',
        'page.onlineResults': '在线搜索结果',
        'page.sourceNetease': '网易云',
        'page.sourceQq': 'QQ 音乐',
        'page.sourceItunes': 'iTunes',
        'page.sourceMusicbrainz': 'MusicBrainz',
        'page.results': '个结果',
        'page.replaceCover': '更换封面',
        'page.resetCover': '恢复原封面',
        'page.coverPending': '已选择在线封面，保存后写入',
        'page.matchField': '搜索替换',
        'page.gridView': '网格视图',
        'page.listView': '列表视图',
        'page.addedCount': '已添加 {n} 首',
        'page.trackCount': '{n} 首',
        'page.removeTrack': '从歌单移除',
        'page.playlistEmpty': '还没有播放列表',
        'page.playlistEmptyHint': '点顶部的 + 新建一个播放列表。',
        'page.playlistNoTracks': '这个播放列表还没有歌曲',
        'page.playlistNoTracksHint': '到「歌曲」里多选，再添加到播放列表。',
        'page.rename': '保存',
        'settings.label': '音乐',
        'settings.title': '音乐文件夹',
        'settings.hint': '添加包含音频文件的文件夹，支持 mp3 / flac / m4a / wav / ogg / opus / aac。',
        'settings.roots': '文件夹',
        'settings.add': '添加文件夹',
        'settings.remove': '删除',
        'settings.placeholder': '例如 D:\\Music 或 ~/Music',
        'settings.depth': '子文件夹深度',
        'settings.depthHint': '0 表示只扫描所选文件夹本身，默认 4 层。',
        'settings.save': '保存',
        'settings.saving': '保存中…',
        'settings.saved': '已保存',
        'settings.failed': '保存失败',
        'settings.badRoot': '这些目录不可用：',
        'settings.empty': '还没有添加文件夹。',
        'settings.note': '设置保存在本机 DSH 目录下的 music/settings.json。',
        'settings.tabAppearance': '外观',
        'settings.tabLyrics': '歌词',
        'settings.tabLibrary': '音乐库',
        'settings.tabPlayback': '播放',
        'settings.resumeOnStart': '启动时恢复上次播放',
        'settings.autoResume': '恢复后自动播放',
        'settings.rememberPerTrack': '每首歌记住播放位置',
        'settings.playbackHint': '播放次数按 Last.fm 规则记录：曲目超过 30 秒，且播放到一半或 4 分钟（先到为准）才算一次；播放时长只累计真正在播放的时间。',
        'settings.libraryHint': '音乐文件夹（自动保存）',
        'settings.removeConfirm': '确定移除这个音乐文件夹？不会删除文件。',
        'settings.up': '↑ 上级',
        'settings.chooseFolder': '选择此文件夹',
        'settings.pickEmpty': '没有选中文件夹。',
        'settings.pickFailed': '无法读取文件夹路径，请重试或手动填写。',
        'settings.miniPlayer': '迷你浮窗',
        'settings.composerQueueButton': '输入框播放列表按钮',
        'settings.circularCover': '播放页圆形封面',
        'settings.vinylRing': '圆形封面黑胶底盘',
        'settings.coverSpin': '圆形封面旋转',
        'settings.lyricOrder': '歌词获取顺序',
        'settings.lyricSourceEmbedded': '内嵌歌词',
        'settings.lyricSourceLrc': 'LRC 文件',
        'settings.lyricAlign': '歌词对齐方式',
        'settings.alignCenter': '居中',
        'settings.alignLeft': '左对齐',
        'settings.alignRight': '右对齐',
        'settings.lyricSize': '歌词字体大小',
        'settings.lyricWeight': '歌词字体粗细',
        'settings.lyricBlur': '模糊非当前歌词',
        'settings.lyricTranslation': '歌词翻译',
        'settings.translationScale': '翻译字体缩放',
        'settings.composerLyrics': '输入框歌词',
        'settings.composerLyricPlace': '输入框歌词位置',
        'settings.placeInputLeft': '输入框内（播放列表按钮左侧）',
        'settings.placeAbove': '输入框上方',
      },
      en: {
        'nav.label': 'Music',
        'page.title': 'Songs',
        'page.refresh': 'Rescan',
        'page.scanning': 'Scanning…',
        'page.loadFailed': 'Failed to load',
        'page.retry': 'Retry',
        'page.emptyTitle': 'No music yet',
        'page.emptyHint': 'Add a music folder in Settings → Music, then come back and refresh.',
        'page.emptyFolder': 'No audio files found in those folders',
        'page.search': 'Search',
        'page.searchPlaceholder': 'Search title, artist or album',
        'page.sort': 'Sort',
        'page.sortAsc': 'Ascending',
        'page.sortDesc': 'Descending',
        'page.settings': 'Settings',
        'page.listSize': 'List size',
        'page.moreSettings': 'Folders and more: Settings → Music.',
        'page.select': 'Select',
        'page.selectAll': 'Select all',
        'page.selectNone': 'Clear selection',
        'page.playSelected': 'Play selected',
        'page.done': 'Done',
        'page.clear': 'Clear list',
        'page.loopAll': 'Repeat all',
        'page.modeSequence': 'Play in order',
        'page.modeRandom': 'Shuffle',
        'page.modeOne': 'Repeat one',
        'page.loopOne': 'Repeat one',
        'page.loopNone': 'No repeat',
        'page.shuffle': 'Shuffle',
        'page.play': 'Play',
        'page.pause': 'Pause',
        'page.prev': 'Previous',
        'page.next': 'Next',
        'page.queue': 'Queue',
        'page.clearQueue': 'Clear queue',
        'page.moveUp': 'Move up',
        'page.moveDown': 'Move down',
        'page.dragSort': 'Drag to reorder',
        'page.more': 'More',
        'page.copyPath': 'Copy file path',
        'page.copied': 'Copied',
        'page.volume': 'Volume',
        'page.mute': 'Mute',
        'page.sortTitle': 'Title',
        'page.sortArtist': 'Artist',
        'page.sortAlbum': 'Album',
        'page.sortDuration': 'Duration',
        'page.sortName': 'File name',
        'page.sortSize': 'Size',
        'page.sortYear': 'Year',
        'page.sortFolder': 'Folder',
        'page.sortPlays': 'Play count',
        'page.sortMtime': 'Modified',
        'page.sortAdded': 'Date added',
        'page.asc': 'Ascending',
        'page.desc': 'Descending',
        'page.unknownArtist': 'Unknown artist',
        'page.warnings': 'Some folders could not be read',
        'page.queueEmpty': 'The queue is empty',
        'page.noTrack': 'Nothing playing',
        'page.format': 'Format',
        'page.bitrate': 'Bitrate',
        'page.sampleRate': 'Sample rate',
        'page.artist': 'Artist',
        'page.album': 'Album',
        'page.duration': 'Duration',
        'page.size': 'File size',
        'page.plays': 'Plays',
        'page.none': '—',
        'page.selectedCount': '{n} selected',
        'page.noResults': 'No matching songs',
        'page.skipError': 'Audio failed to load; skipped to the next track',
        'page.audioError': 'Audio failed to load',
        'page.openPlayer': 'Open player',
        'page.closePlayer': 'Close player',
        'page.noLyrics': 'No lyrics yet. Drop a matching .lrc file next to the track.',
        'page.translation': 'Show / hide translation',
        'page.lyricOffset': 'Lyric offset',
        'page.writeLyrics': 'Write to file',
        'page.otherTabPlaying': 'Playing in another tab',
        'page.lyricOffsetHint': 'Writing back works for MP3 / FLAC only; other formats keep the offset in settings.',
        'page.lyricSize': 'Font size',
        'page.lyricWeight': 'Font weight',
        'page.lyricBlur': 'Blur inactive lines',
        'page.translationScale': 'Translation scale',
        'stats.rangeWeek': 'Last week',
        'stats.modeRanking': 'Ranking',
        'stats.modeRecent': 'Recently played',
        'stats.rangeMonth': 'Last month',
        'stats.rangeAll': 'All time',
        'stats.sortTime': 'By time',
        'stats.sortPlays': 'By plays',
        'stats.sortRecent': 'By recent',
        'stats.totalTime': 'Listening time',
        'stats.totalPlays': 'Total plays',
        'stats.trackCount': 'Tracks',
        'stats.plays': '{n} plays',
        'stats.empty': 'No listening history yet',
        'stats.loading': 'Loading…',
        'stats.loadFailed': 'Failed to load statistics',
        'stats.retry': 'Retry',
        'stats.unavailable': 'File unavailable',
        'page.tabSongs': 'All songs',
        'page.tabFavorites': 'Liked',
        'page.favorite': 'Like',
        'page.unfavorite': 'Unlike',
        'page.favoritesEmpty': 'No liked songs yet',
        'page.favoritesHint': 'Tap the heart next to a song to add it here.',
        'page.tabStats': 'Stats',
        'page.tabPlaylists': 'Playlists',
        'page.newPlaylist': 'New playlist',
        'page.playlistName': 'Playlist name',
        'page.create': 'Create',
        'page.delete': 'Delete',
        'page.cancel': 'Cancel',
        'page.deleteConfirm': 'Delete “{name}”? This cannot be undone.',
        'page.back': 'Back',
        'page.playAll': 'Play all',
        'page.addTo': 'Add to playlist',
        'page.addToPlaylist': 'Add to play queue',
        'page.addedToPlaylist': 'Added to play queue',
        'page.reveal': 'Show in folder',
        'page.revealed': 'Opened in folder',
        'page.details': 'Details',
        'page.noPlaylists': 'No playlists yet',
        'page.newPlaylistAdd': 'New playlist and add',
        'page.editMeta': 'Edit metadata',
        'page.metaTitle': 'Title',
        'page.year': 'Year',
        'page.trackNo': 'Track no.',
        'page.discNo': 'Disc no.',
        'page.genre': 'Genre',
        'page.albumArtist': 'Album artist',
        'page.composer': 'Composer',
        'page.lyricist': 'Lyricist',
        'page.comment': 'Comment',
        'page.lyrics': 'Lyrics',
        'page.save': 'Save',
        'page.saving': 'Saving…',
        'page.metaSaved': 'Metadata saved',
        'page.metaHint': 'Changes are written to the audio file tags (FLAC / MP3). Cover art and untouched tags are preserved.',
        'page.metaBasic': 'Basic info',
        'page.metaDetail': 'Credits',
        'page.onlineMatch': 'Match online',
        'page.onlineHint': 'Online matching uses NetEase / QQ Music (unofficial endpoints) plus iTunes / MusicBrainz. Results can be incomplete or stop working at any time.',
        'page.onlineLoading': 'Searching online…',
        'page.onlineEmpty': 'No matching result',
        'page.onlineResults': 'Online results',
        'page.sourceNetease': 'NetEase',
        'page.sourceQq': 'QQ Music',
        'page.sourceItunes': 'iTunes',
        'page.sourceMusicbrainz': 'MusicBrainz',
        'page.results': 'results',
        'page.replaceCover': 'Change cover',
        'page.resetCover': 'Reset cover',
        'page.coverPending': 'Online cover selected — saved with tags',
        'page.matchField': 'Search & replace',
        'page.gridView': 'Grid view',
        'page.listView': 'List view',
        'page.addedCount': '{n} added',
        'page.trackCount': '{n} tracks',
        'page.removeTrack': 'Remove from playlist',
        'page.playlistEmpty': 'No playlists yet',
        'page.playlistEmptyHint': 'Use the + button above to create one.',
        'page.playlistNoTracks': 'This playlist has no tracks',
        'page.playlistNoTracksHint': 'Select tracks under Songs, then add them here.',
        'page.rename': 'Save',
        'settings.label': 'Music',
        'settings.title': 'Music folders',
        'settings.hint': 'Add folders with audio files. Supports mp3 / flac / m4a / wav / ogg / opus / aac.',
        'settings.roots': 'Folders',
        'settings.add': 'Add folder',
        'settings.remove': 'Remove',
        'settings.placeholder': 'e.g. D:\\Music or ~/Music',
        'settings.depth': 'Subfolder depth',
        'settings.depthHint': '0 scans only the selected folders; the default is 4 levels.',
        'settings.save': 'Save',
        'settings.saving': 'Saving…',
        'settings.saved': 'Saved',
        'settings.failed': 'Save failed',
        'settings.badRoot': 'These folders are not usable:',
        'settings.empty': 'No folders added yet.',
        'settings.note': 'Settings are stored in music/settings.json under your DSH home.',
        'settings.tabAppearance': 'Appearance',
        'settings.tabLyrics': 'Lyrics',
        'settings.tabLibrary': 'Library',
        'settings.tabPlayback': 'Playback',
        'settings.resumeOnStart': 'Resume last playback on start',
        'settings.autoResume': 'Start playing after restore',
        'settings.rememberPerTrack': 'Remember each track position',
        'settings.playbackHint': 'Play counts follow the Last.fm rule: a track longer than 30 seconds counts once after half its duration or 4 minutes, whichever comes first. Listening time only counts time actually played.',
        'settings.libraryHint': 'Music folders (auto-saved)',
        'settings.removeConfirm': 'Remove this music folder? Files are not deleted.',
        'settings.up': '↑ Up',
        'settings.chooseFolder': 'Choose this folder',
        'settings.pickEmpty': 'No folder selected.',
        'settings.pickFailed': 'Could not read the folder path. Try again or type it manually.',
        'settings.miniPlayer': 'Mini player window',
        'settings.composerQueueButton': 'Playlist button in composer',
        'settings.circularCover': 'Circular cover on player page',
        'settings.vinylRing': 'Vinyl ring behind the cover',
        'settings.coverSpin': 'Rotate the cover',
        'settings.lyricOrder': 'Lyric source order',
        'settings.lyricSourceEmbedded': 'Embedded',
        'settings.lyricSourceLrc': 'LRC file',
        'settings.lyricAlign': 'Lyric alignment',
        'settings.alignCenter': 'Center',
        'settings.alignLeft': 'Left',
        'settings.alignRight': 'Right',
        'settings.lyricSize': 'Lyric font size',
        'settings.lyricWeight': 'Lyric font weight',
        'settings.lyricBlur': 'Blur inactive lines',
        'settings.lyricTranslation': 'Lyric translation',
        'settings.translationScale': 'Translation scale',
        'settings.composerLyrics': 'Composer lyrics',
        'settings.composerLyricPlace': 'Composer lyric position',
        'settings.placeInputLeft': 'Left of the queue button',
        'settings.placeAbove': 'Above input',
      },
    }

    var LANG = (function () {
      var lang = ''
      try {
        lang = document.documentElement.getAttribute('lang') || (navigator && navigator.language) || ''
      } catch (error) {
        lang = ''
      }
      return String(lang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
    })()

    /**
     * Bound to the host locale service when the plugin applies; null keeps the
     * built-in dictionary plus the document-language guess.
     */
    var localeTranslate = null

    function t(key, vars) {
      var text = null
      if (localeTranslate !== null) {
        try {
          text = localeTranslate(key, vars)
        } catch (error) {
          text = null
        }
      }
      if (typeof text !== 'string' || text === '' || text === key) {
        var dict = DICTS[LANG] || DICTS.zh
        text = dict[key] !== undefined ? dict[key] : DICTS.zh[key] !== undefined ? DICTS.zh[key] : key
      }
      if (vars !== undefined && vars !== null) {
        Object.keys(vars).forEach(function (name) {
          text = text.split('{' + name + '}').join(String(vars[name]))
        })
      }
      return text
    }

    // ── tiny helpers ──────────────────────────────────────────────────────

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max)
    }

    function pad2(value) {
      return value < 10 ? '0' + value : String(value)
    }

    function fmtTime(seconds) {
      if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return '--:--'
      var total = Math.floor(seconds)
      var s = total % 60
      var m = Math.floor(total / 60) % 60
      var hours = Math.floor(total / 3600)
      return hours > 0 ? hours + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s)
    }

    function fmtKhz(sampleRate) {
      if (typeof sampleRate !== 'number' || !isFinite(sampleRate) || sampleRate <= 0) return ''
      var khz = Math.round(sampleRate / 100) / 10
      return String(khz).replace(/\.0$/, '') + ' kHz'
    }

    /**
     * Last.fm / MusicBee play threshold: half the track or four minutes,
     * whichever comes first. Tracks of 30 seconds or less never count.
     */
    function playThresholdOf(durationSec) {
      var duration = Number(durationSec)
      if (!isFinite(duration) || duration <= 0) return 240
      if (duration <= 30) return duration + 0.5
      return Math.min(duration / 2, 240)
    }

    /** Clamp a stored preference to a sane numeric range. */
    function clampPref(value, min, max, fallback) {
      var number = Number(value)
      if (!isFinite(number)) return fallback
      return Math.min(max, Math.max(min, Math.round(number)))
    }

    /** Comparable value for one sort key: numbers compare numerically. */    function sortValueOf(track, key) {
      switch (key) {
        case 'duration':
          return track.durationSec || 0
        case 'size':
          return track.size || 0
        case 'year':
          return track.year || 0
        case 'plays':
          return track.plays || 0
        case 'mtime':
          return track.mtime || 0
        case 'addedAt':
          return track.addedAt || 0
        default:
          return String(track[key] || '')
      }
    }

    function fmtKbps(bitrate) {
      if (typeof bitrate !== 'number' || !isFinite(bitrate) || bitrate <= 0) return ''
      return Math.round(bitrate / 1000) + ' kbps'
    }

    function readPrefs() {
      var merged = {}
      Object.keys(PREF_DEFAULTS).forEach(function (key) {
        merged[key] = PREF_DEFAULTS[key]
      })
      try {
        var raw = window.localStorage.getItem(PREFS_KEY)
        if (!raw) return merged
        var parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return merged
        Object.keys(parsed).forEach(function (key) {
          if (parsed[key] !== undefined && parsed[key] !== null) merged[key] = parsed[key]
        })
      } catch (error) {
        // Private mode / corrupt value: defaults stand.
      }
      // Only two composer-lyric positions exist: inline and above. Fold the
      // retired above-left/above-center/above-right values into `above`.
      merged.composerLyricPlace = String(merged.composerLyricPlace || '').indexOf('above') === 0 ? 'above' : 'input-left'
      return merged
    }

    function savePrefs(patch) {
      try {
        var next = {}
        var current = readPrefs()
        Object.keys(current).forEach(function (key) {
          next[key] = current[key]
        })
        Object.keys(patch).forEach(function (key) {
          next[key] = patch[key]
        })
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch (error) {
        // Private mode / quota: preferences are best effort.
      }
      try {
        var event
        try {
          event = new CustomEvent(PREFS_EVENT)
        } catch (eventError) {
          event = new Event(PREFS_EVENT)
        }
        window.dispatchEvent(event)
      } catch (dispatchError) {
        // No window (tests): nothing to notify.
      }
    }

    function streamUrl(path) {
      return API + 'stream?path=' + encodeURIComponent(path)
    }

    function coverUrl(path) {
      return API + 'cover?path=' + encodeURIComponent(path)
    }

    async function getJson(url) {
      var response = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      var body = null
      try {
        body = await response.json()
      } catch (error) {
        body = null
      }
      if (!response.ok || body === null || body.ok !== true) {
        var message = body !== null && body.error && body.error.message ? body.error.message : 'HTTP ' + response.status
        throw new Error(message)
      }
      return body
    }

    function postJson(url, payload) {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (response) {
        return response.json().catch(function () {
          return null
        }).then(function (body) {
          if (!response.ok || body === null || body.ok !== true) {
            var error = new Error(
              body !== null && body.error && body.error.message ? body.error.message : 'HTTP ' + response.status,
            )
            error.body = body
            throw error
          }
          return body
        })
      })
    }

    // ── icons (Feather/Lucide paths, MIT) ─────────────────────────────────

    var ICONS = {
      check: { parts: [['path', { d: 'M20 6L9 17l-5-5' }]] },
      refresh: {
        parts: [
          ['path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }],
          ['path', { d: 'M21 3v6h-6' }],
        ],
      },
      settings: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 3 }],
          [
            'path',
            {
              d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
            },
          ],
        ],
      },
      checkCircle: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 10 }],
          ['path', { d: 'M8 12.5l2.5 2.5L16 9.5' }],
        ],
      },
      sort: {
        parts: [
          ['path', { d: 'M7 4v16' }],
          ['path', { d: 'M4 7l3-3 3 3' }],
          ['path', { d: 'M17 20V4' }],
          ['path', { d: 'M14 17l3 3 3-3' }],
        ],
      },
      search: {
        parts: [
          ['circle', { cx: 11, cy: 11, r: 7 }],
          ['path', { d: 'M21 21l-4.3-4.3' }],
        ],
      },
      repeat: {
        parts: [
          ['path', { d: 'M17 2l4 4-4 4' }],
          ['path', { d: 'M3 11V9a4 4 0 014-4h14' }],
          ['path', { d: 'M7 22l-4-4 4-4' }],
          ['path', { d: 'M21 13v2a4 4 0 01-4 4H3' }],
        ],
      },
      repeatOne: {
        parts: [
          ['path', { d: 'M17 2l4 4-4 4' }],
          ['path', { d: 'M3 11V9a4 4 0 014-4h14' }],
          ['path', { d: 'M7 22l-4-4 4-4' }],
          ['path', { d: 'M21 13v2a4 4 0 01-4 4H3' }],
          ['path', { d: 'M12 10v4' }],
          ['path', { d: 'M11 11l1-1' }],
        ],
      },
      shuffle: {
        parts: [
          ['path', { d: 'M16 3h5v5' }],
          ['path', { d: 'M4 20L21 3' }],
          ['path', { d: 'M21 16v5h-5' }],
          ['path', { d: 'M15 15l6 6' }],
          ['path', { d: 'M4 4l5 5' }],
        ],
      },
      x: {
        parts: [
          ['path', { d: 'M18 6L6 18' }],
          ['path', { d: 'M6 6l12 12' }],
        ],
      },
      prev: {
        parts: [
          ['path', { d: 'M19 20L9 12l10-8v16z' }],
          ['path', { d: 'M5 19V5' }],
        ],
      },
      next: {
        parts: [
          ['path', { d: 'M5 4l10 8-10 8V4z' }],
          ['path', { d: 'M19 5v14' }],
        ],
      },
      play: { fill: true, parts: [['path', { d: 'M7 4.5v15l13-7.5-13-7.5z' }]] },
      pause: {
        fill: true,
        parts: [
          ['rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }],
          ['rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 }],
        ],
      },
      list: {
        parts: [
          ['path', { d: 'M8 6h13' }],
          ['path', { d: 'M8 12h13' }],
          ['path', { d: 'M8 18h13' }],
          ['path', { d: 'M3 6h.01' }],
          ['path', { d: 'M3 12h.01' }],
          ['path', { d: 'M3 18h.01' }],
        ],
      },
      grid: {
        parts: [
          ['rect', { x: 3, y: 3, width: 7, height: 7 }],
          ['rect', { x: 14, y: 3, width: 7, height: 7 }],
          ['rect', { x: 3, y: 14, width: 7, height: 7 }],
          ['rect', { x: 14, y: 14, width: 7, height: 7 }],
        ],
      },
      more: {
        parts: [
          ['circle', { cx: 5, cy: 12, r: 1.4 }],
          ['circle', { cx: 12, cy: 12, r: 1.4 }],
          ['circle', { cx: 19, cy: 12, r: 1.4 }],
        ],
      },
      volume: {
        parts: [
          ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
          ['path', { d: 'M15.5 8.5a5 5 0 010 7' }],
          ['path', { d: 'M18.5 5.5a9 9 0 010 13' }],
        ],
      },
      volumeLow: {
        parts: [
          ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
          ['path', { d: 'M15.5 8.5a5 5 0 010 7' }],
        ],
      },
      mute: {
        parts: [
          ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
          ['path', { d: 'M22 9l-6 6' }],
          ['path', { d: 'M16 9l6 6' }],
        ],
      },
      note: {
        parts: [
          ['path', { d: 'M9 18V5l12-2v13' }],
          ['circle', { cx: 6, cy: 18, r: 3 }],
          ['circle', { cx: 18, cy: 16, r: 3 }],
        ],
      },
      heart: {
        parts: [
          ['path', { d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' }],
        ],
      },
      chevronDown: {
        parts: [['path', { d: 'M6 9l6 6 6-6' }]],
      },
      chevronLeft: {
        parts: [['path', { d: 'M15 18l-6-6 6-6' }]],
      },
      trash: {
        parts: [
          ['path', { d: 'M3 6h18' }],
          ['path', { d: 'M8 6V4h8v2' }],
          ['path', { d: 'M19 6l-1 14H6L5 6' }],
        ],
      },
      plus: {
        parts: [
          ['path', { d: 'M12 5v14' }],
          ['path', { d: 'M5 12h14' }],
        ],
      },
      folder: {
        parts: [['path', { d: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' }]],
      },
      copy: {
        parts: [
          ['rect', { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }],
          ['path', { d: 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1' }],
        ],
      },
      info: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 10 }],
          ['path', { d: 'M12 16v-4' }],
          ['path', { d: 'M12 8h.01' }],
        ],
      },
      edit: {
        parts: [
          ['path', { d: 'M12 20h9' }],
          ['path', { d: 'M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z' }],
        ],
      },
    }

    function merge(base, extra) {
      var out = {}
      Object.keys(base).forEach(function (key) {
        out[key] = base[key]
      })
      if (extra) {
        Object.keys(extra).forEach(function (key) {
          out[key] = extra[key]
        })
      }
      return out
    }

    function icon(name, size, extra) {
      var spec = ICONS[name] || ICONS.note
      var children = spec.parts.map(function (part, index) {
        return h(part[0], merge({ key: String(index) }, part[1]))
      })
      var props = {
        width: size || 18,
        height: size || 18,
        viewBox: '0 0 24 24',
        'aria-hidden': 'true',
        focusable: 'false',
        fill: spec.fill === true ? 'currentColor' : 'none',
        stroke: spec.fill === true ? 'none' : 'currentColor',
        strokeWidth: 1.75,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }
      return h('svg', merge(props, extra), children)
    }

    // ── cover thumbnail ───────────────────────────────────────────────────

    function Cover(props) {
      var [failed, setFailed] = useState(false)
      var size = props.size || 42
      var radius = props.radius === undefined ? 6 : props.radius

      useEffect(
        function () {
          setFailed(false)
        },
        [props.track ? props.track.path : ''],
      )
      var wrapStyle = {
        width: size + 'px',
        height: size + 'px',
        borderRadius: radius + 'px',
      }
      if (!props.track || props.track.hasCover !== true || failed) {
        return h('div', { className: 'mu-cover', style: wrapStyle }, icon('note', Math.round(size * 0.42)))
      }
      return h(
        'div',
        { className: 'mu-cover', style: wrapStyle },
        h('img', {
          src: coverUrl(props.track.path),
          alt: '',
          loading: 'lazy',
          draggable: 'false',
          onError: function () {
            setFailed(true)
          },
        }),
      )
    }

    /**
     * Spectrum bars. Bars are log-spaced and smoothed the way mature
     * visualizers do it (audvis / audioMotion-analyzer), and drawing happens in
     * requestAnimationFrame without React state so the host never re-renders.
     */
    function BarWave(props) {
      var width = props && Number(props.width) > 0 ? Number(props.width) : 96
      var height = props && Number(props.height) > 0 ? Number(props.height) : 26
      var barCount = props && Number(props.bars) > 0 ? Math.round(Number(props.bars)) : 28
      var className = 'mu-bar-wave' + (props && props.className ? ' ' + props.className : '')
      var canvasRef = useRef(null)
      useEffect(function () {
        var canvas = canvasRef.current
        if (canvas === null) return undefined
        var ctx2d = canvas.getContext('2d')
        if (ctx2d === null) return undefined
        var dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        var levels = new Float32Array(barCount)
        var gradient = ctx2d.createLinearGradient(0, canvas.height, 0, 0)
        gradient.addColorStop(0, 'rgba(86,134,254,0.35)')
        gradient.addColorStop(0.6, 'rgba(86,134,254,0.8)')
        gradient.addColorStop(1, 'rgba(122,170,255,1)')
        var raf = 0
        function frame() {
          raf = requestAnimationFrame(frame)
          var data = player.getWave()
          ctx2d.clearRect(0, 0, canvas.width, canvas.height)
          if (data === null) return
          var binCount = data.length
          var barWidth = canvas.width / barCount
          for (var i = 0; i < barCount; i += 1) {
            var lo = Math.floor(Math.pow(i / barCount, 1.8) * binCount * 0.72)
            var hi = Math.max(
              lo + 1,
              Math.floor(Math.pow((i + 1) / barCount, 1.8) * binCount * 0.72),
            )
            var sum = 0
            var count = 0
            for (var j = lo; j < hi && j < binCount; j += 1) {
              sum += data[j]
              count += 1
            }
            var target = count > 0 ? sum / count / 255 : 0
            levels[i] = levels[i] * 0.62 + target * 0.38
            var barHeight = Math.max(2 * dpr, levels[i] * canvas.height * 0.92)
            ctx2d.fillStyle = gradient
            ctx2d.fillRect(
              i * barWidth + 1,
              canvas.height - barHeight,
              Math.max(1, barWidth - 2),
              barHeight,
            )
          }
        }
        raf = requestAnimationFrame(frame)
        return function () {
          cancelAnimationFrame(raf)
        }
      }, [width, height, barCount])
      return h('canvas', {
        className: className,
        ref: canvasRef,
        style: { width: width + 'px', height: height + 'px' },
        'aria-hidden': 'true',
      })
    }

    /** Full-width spectrum painted behind the player bar. */
    function BarWaveFull() {
      var canvasRef = useRef(null)
      useEffect(function () {
        var canvas = canvasRef.current
        if (canvas === null) return undefined
        var parent = canvas.parentElement
        var ctx2d = canvas.getContext('2d')
        if (parent === null || ctx2d === null) return undefined
        var dpr = Math.min(window.devicePixelRatio || 1, 2)
        var barCount = 0
        var levels = new Float32Array(1)
        var gradient = null
        function resize() {
          var rect = parent.getBoundingClientRect()
          var cssWidth = Math.max(1, Math.round(rect.width))
          var cssHeight = Math.max(1, Math.round(rect.height))
          canvas.width = Math.round(cssWidth * dpr)
          canvas.height = Math.round(cssHeight * dpr)
          barCount = Math.max(32, Math.round(cssWidth / 8))
          levels = new Float32Array(barCount)
          gradient = ctx2d.createLinearGradient(0, canvas.height, 0, 0)
          gradient.addColorStop(0, 'rgba(86,134,254,0.06)')
          gradient.addColorStop(0.55, 'rgba(86,134,254,0.2)')
          gradient.addColorStop(1, 'rgba(122,170,255,0.38)')
        }
        resize()
        var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
        if (observer !== null) observer.observe(parent)
        var raf = 0
        function frame() {
          raf = requestAnimationFrame(frame)
          var data = player.getWave()
          ctx2d.clearRect(0, 0, canvas.width, canvas.height)
          if (data === null || barCount === 0 || gradient === null) return
          var binCount = data.length
          var barWidth = canvas.width / barCount
          for (var i = 0; i < barCount; i += 1) {
            var lo = Math.floor(Math.pow(i / barCount, 1.8) * binCount * 0.72)
            var hi = Math.max(
              lo + 1,
              Math.floor(Math.pow((i + 1) / barCount, 1.8) * binCount * 0.72),
            )
            var sum = 0
            var count = 0
            for (var j = lo; j < hi && j < binCount; j += 1) {
              sum += data[j]
              count += 1
            }
            var target = count > 0 ? sum / count / 255 : 0
            levels[i] = levels[i] * 0.62 + target * 0.38
            var barHeight = Math.max(1, levels[i] * canvas.height)
            ctx2d.fillStyle = gradient
            ctx2d.fillRect(
              i * barWidth + 1,
              canvas.height - barHeight,
              Math.max(1, barWidth - 3),
              barHeight,
            )
          }
        }
        raf = requestAnimationFrame(frame)
        return function () {
          cancelAnimationFrame(raf)
          if (observer !== null) observer.disconnect()
        }
      }, [])
      return h('canvas', { className: 'mu-bar-wave-bg', ref: canvasRef, 'aria-hidden': 'true' })
    }

    // ── sidebar icon ──────────────────────────────────────────────────────

    function MusicSideIcon(props) {
      var size = props && props.size ? props.size : 16
      var [snap, setSnap] = useState(player.getSnapshot())
      var [anchor, setAnchor] = useState(null)
      var [wavePos, setWavePos] = useState(null)
      var hideTimer = useRef(null)
      var iconRef = useRef(null)

      useEffect(function () {
        return player.subscribe(function () {
          setSnap(player.getSnapshot())
        })
      }, [])

      // Bind to the whole sidebar row (not just the 16px icon) so hovering
      // anywhere on the row reveals the controls, anchored to the row's right edge.
      // Defensive: the host rail DOM is not ours, so any probe failure must not
      // take the sidebar entry down with it.
      useEffect(function () {
        var icon = iconRef.current
        if (icon === null) return undefined

        var row = icon
        try {
          while (row !== null && row !== document.body) {
            if (row.getBoundingClientRect().width > 120) break
            row = row.parentElement
          }
        } catch (error) {
          row = icon
        }
        if (row === null || row === document.body) row = icon

        function measureWave() {
          try {
            var rect = row.getBoundingClientRect()
            // Sit just left of the hover controls, after the row label.
            setWavePos({ top: rect.top + rect.height / 2, left: Math.max(8, rect.right - 78 - 46) })
          } catch (error) {
            // Host rail DOM unavailable: the wave simply stays hidden.
          }
        }
        measureWave()
        window.addEventListener('resize', measureWave)

        function keepOpen() {
          if (hideTimer.current !== null) {
            clearTimeout(hideTimer.current)
            hideTimer.current = null
          }
        }

        function scheduleHide() {
          if (hideTimer.current !== null) clearTimeout(hideTimer.current)
          hideTimer.current = setTimeout(function () {
            hideTimer.current = null
            setAnchor(null)
          }, 180)
        }

        function onEnter() {
          keepOpen()
          try {
            var rect = row.getBoundingClientRect()
            setAnchor({ top: rect.top + rect.height / 2, left: Math.max(8, rect.right - 78) })
          } catch (error) {
            // Host rail DOM unavailable: keep the row usable without controls.
          }
        }

        row.addEventListener('mouseenter', onEnter)
        row.addEventListener('mouseleave', scheduleHide)
        return function () {
          row.removeEventListener('mouseenter', onEnter)
          row.removeEventListener('mouseleave', scheduleHide)
          window.removeEventListener('resize', measureWave)
          if (hideTimer.current !== null) {
            clearTimeout(hideTimer.current)
            hideTimer.current = null
          }
        }
      }, [])

      function keepOpen() {
        if (hideTimer.current !== null) {
          clearTimeout(hideTimer.current)
          hideTimer.current = null
        }
      }

      function scheduleHide() {
        if (hideTimer.current !== null) clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(function () {
          hideTimer.current = null
          setAnchor(null)
        }, 180)
      }

      var hasTrack = snap.index >= 0
      var owner = props || {}

      return h(
        'span',
        {
          ref: iconRef,
          className: 'mu-side-icon' + (owner.active ? ' is-active' : ''),
        },
        icon('note', size),
        hasTrack && snap.playing && wavePos !== null
          ? h(
              'span',
              {
                className: 'mu-side-wave-float',
                style: { top: wavePos.top + 'px', left: wavePos.left + 'px' },
              },
              h(BarWave, { width: 40, height: 14, bars: 12 }),
            )
          : null,
        hasTrack && anchor !== null
          ? h(
              'span',
              {
                className: 'mu-side-controls',
                style: { top: anchor.top + 'px', left: anchor.left + 'px' },
                onMouseEnter: keepOpen,
                onMouseLeave: scheduleHide,
              },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-side-btn',
                  title: t('page.prev'),
                  onClick: function (event) {
                    event.stopPropagation()
                    player.prev()
                  },
                },
                icon('prev', 12),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-side-btn',
                  title: snap.playing ? t('page.pause') : t('page.play'),
                  onClick: function (event) {
                    event.stopPropagation()
                    player.toggle()
                  },
                },
                icon(snap.playing ? 'pause' : 'play', 12),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-side-btn',
                  title: t('page.next'),
                  onClick: function (event) {
                    event.stopPropagation()
                    player.next()
                  },
                },
                icon('next', 12),
              ),
            )
          : null,
      )
    }

    // ── main panel ────────────────────────────────────────────────────────

    function randomOrderOf(size) {
      var order = []
      for (var i = 0; i < size; i += 1) order.push(i)
      for (var j = order.length - 1; j > 0; j -= 1) {
        var k = Math.floor(Math.random() * (j + 1))
        var tmp = order[j]
        order[j] = order[k]
        order[k] = tmp
      }
      return order
    }

    // Three playback modes, mapped onto the engine's loop/order pair:
    //   sequence → in order, stop at the end
    //   random   → shuffled, looping
    //   one      → repeat the current track
    var PLAY_MODES = ['sequence', 'random', 'one']

    function playModeOf(snap) {
      if (snap.loop === 'one') return 'one'
      if (snap.order === 'random') return 'random'
      return 'sequence'
    }

    function playModeLabel(mode) {
      return mode === 'one'
        ? t('page.modeOne')
        : mode === 'random'
          ? t('page.modeRandom')
          : t('page.modeSequence')
    }

    function playModeIcon(mode) {
      return mode === 'one' ? 'repeatOne' : mode === 'random' ? 'shuffle' : 'list'
    }

    function applyPlayMode(mode) {
      if (mode === 'one') {
        player.setLoop('one')
        player.setOrder('list')
        return
      }
      if (mode === 'random') {
        player.setLoop('all')
        player.setOrder('random')
        return
      }
      player.setLoop('none')
      player.setOrder('list')
    }

    function cyclePlayMode(snap) {
      var current = playModeOf(snap)
      applyPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(current) + 1) % PLAY_MODES.length])
    }

    function nextIndexOf(index, order, size, randomOrder) {
      if (size <= 1) return 0
      if (order === 'random') {
        var pos = randomOrder.indexOf(index)
        return randomOrder[(pos + 1) % randomOrder.length]
      }
      return (index + 1) % size
    }

    function prevIndexOf(index, order, size, randomOrder) {
      if (size <= 1) return 0
      if (order === 'random') {
        var pos = randomOrder.indexOf(index)
        return randomOrder[(pos - 1 + randomOrder.length) % randomOrder.length]
      }
      return (index - 1 + size) % size
    }

    // ── playback engine (module-level: survives panel unmount) ───────────
    // The <audio> element lives here rather than in the React tree, so
    // selecting another main panel keeps the current track playing.

    function sameQueue(left, right) {
      if (left.length !== right.length) return false
      for (var i = 0; i < left.length; i += 1) {
        if (!right[i] || left[i].path !== right[i].path) return false
      }
      return true
    }

    // One engine per page. Client modules can be re-executed by HMR or by a
    // module-table rebuild; a second engine would own a second <audio> and
    // play on top of the first. Every execution reuses the same instance.
    var PLAYER_KEY = '__dshMusicPlayer'

    /**
     * Playback engine, one per page.
     *
     * The <audio> element is owned by the `shell.overlay` seat (a resident
     * floating layer) and handed in through `attachAudio`. That keeps the
     * element inside the document — browsers treat detached media elements
     * differently for background playback, system media keys and autoplay —
     * while this engine stays the single source of playback state.
     */
    function createPlayer() {
      if (typeof window !== 'undefined' && window[PLAYER_KEY]) return window[PLAYER_KEY]
      var prefs = readPrefs()
      var audio = null
      /** Web Audio graph used by the bar visualizer (lazy, user-gesture bound). */
      var audioContext = null
      var analyser = null
      var waveData = null
      /** Active `blob:` URL for the loaded track (local media seeks reliably). */
      var objectUrl = null
      /** In-flight track download. */
      var fetchAbort = null
      /** Bumped per load so a stale download cannot overwrite a newer track. */
      var loadToken = 0
      var pendingAutoplay = false
      var randomOrder = []
      var listeners = []
      var timeListeners = []
      var errorStreak = 0
      var state = {
        queue: [],
        index: -1,
        playing: false,
        loop: prefs.loop === 'one' ? 'one' : 'none',
        order: prefs.order === 'random' && prefs.loop !== 'one' ? 'random' : 'list',
        // Volume follows the system mixer: the plugin no longer exposes its own.
        volume: 1,
        muted: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
      }

      // ── resume + listening statistics ───────────────────────────────────
      // Counting follows the Last.fm / MusicBee rule (half the track or four
      // minutes, whichever comes first); resume follows the NetEase / Spotify
      // pattern (restore the queue and position, then stay paused). The clock
      // only counts time that naturally advanced while playing, so dragging
      // the seek bar never inflates the statistics.
      var session = { path: '', seconds: 0, pending: 0, lastTime: 0, counted: false }
      var lastStateSave = 0
      var restoreAttempted = false
      var pendingResumeSeconds = null
      /** Only the tab holding the player lock may produce sound / write stats. */
      var leader = true

      function resetSession(item) {
        session = {
          path: item ? item.path : '',
          seconds: 0,
          pending: 0,
          lastTime: 0,
          counted: false,
        }
      }

      function durationOf(item) {
        if (audio !== null && isFinite(audio.duration) && audio.duration > 0) return audio.duration
        return item && item.durationSec > 0 ? item.durationSec : 0
      }

      function recordStatsPlay(item) {
        try {
          postJson(API + 'play', { path: item.path }).catch(function () {})
        } catch (error) {
          // Statistics never block playback.
        }
      }

      /** Flush the seconds that have not been reported yet (>= 30s only). */
      function flushListening(force) {
        if (session.path === '' || session.pending <= 0) return
        if (session.seconds < 30) {
          if (force) session.pending = 0
          return
        }
        var seconds = session.pending
        session.pending = 0
        try {
          postJson(API + 'playback', { path: session.path, seconds: seconds }).catch(function () {})
        } catch (error) {
          // Best effort.
        }
      }

      function flushSessionPosition() {
        if (session.path === '' || readPrefs().rememberPerTrack !== true) return
        var item = currentItem()
        if (item === null || item.path !== session.path) return
        var seconds = state.currentTime
        if (!(seconds > 0)) return
        try {
          postJson(API + 'position', { path: session.path, seconds: seconds }).catch(function () {})
        } catch (error) {
          // Best effort.
        }
      }

      function savePlaybackState() {
        if (!leader) return
        var item = currentItem()
        if (item === null) return
        var duration = state.duration > 0 ? state.duration : item.durationSec || 0
        // Keep the saved queue bounded (playback.json caps at 500): store a
        // window around the current track so restore never picks the wrong one.
        var queuePaths = state.queue.map(function (track) {
          return track.path
        })
        var index = state.index
        if (queuePaths.length > 500) {
          var start = Math.max(0, Math.min(index - 250, queuePaths.length - 500))
          queuePaths = queuePaths.slice(start, start + 500)
          index -= start
        }
        try {
          postJson(API + 'state', {
            queue: queuePaths,
            index: index,
            positionSec: state.currentTime,
            durationSec: duration,
            loop: state.loop,
            order: state.order,
          }).catch(function () {})
        } catch (error) {
          // Best effort.
        }
      }

      function trackListening() {
        if (audio === null) return
        var item = currentItem()
        if (item === null) return
        if (session.path !== item.path) resetSession(item)

        var current = audio.currentTime
        if (state.playing && !audio.paused) {
          var delta = current - session.lastTime
          // A seek produces a large or negative jump; only natural playback
          // advances count toward listening time.
          if (delta > 0 && delta <= 3) {
            session.seconds += delta
            session.pending += delta
          }
        }
        session.lastTime = current

        var duration = durationOf(item)
        var threshold = playThresholdOf(duration)
        if (!session.counted && duration > 30 && session.seconds >= threshold) {
          session.counted = true
          recordStatsPlay(item)
        }

        if (session.seconds >= 30 && session.pending >= 10) flushListening(false)

        var now = Date.now()
        if (now - lastStateSave >= 5000) {
          lastStateSave = now
          savePlaybackState()
        }
      }

      function restorePlayback(saved, tracks) {
        if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return false
        if (!Array.isArray(tracks) || tracks.length === 0) return false
        var byPath = {}
        tracks.forEach(function (track) {
          byPath[track.path] = track
        })
        var queue = []
        saved.queue.forEach(function (path) {
          if (byPath[path] !== undefined) queue.push(byPath[path])
        })
        if (queue.length === 0) return false
        var wantedPath = saved.queue[saved.index]
        var index = 0
        for (var i = 0; i < queue.length; i += 1) {
          if (typeof wantedPath === 'string' && queue[i].path === wantedPath) {
            index = i
            break
          }
        }
        state = Object.assign({}, state, {
          queue: queue,
          index: index,
          loop: saved.loop === 'one' ? 'one' : saved.order === 'random' ? 'all' : 'none',
          order: saved.order === 'random' && saved.loop !== 'one' ? 'random' : 'list',
          currentTime: saved.positionSec > 0 ? saved.positionSec : 0,
          duration: saved.durationSec > 0 ? saved.durationSec : 0,
          playing: false,
        })
        randomOrder = randomOrderOf(queue.length)
        emit()
        syncMediaSession()
        resetSession(queue[index])
        pendingResumeSeconds = saved.positionSec > 0 ? saved.positionSec : null
        // Paused by default (NetEase/Spotify behaviour); the setting can ask
        // for playback to start right after restore.
        load(index, readPrefs().autoResume === true)
        return true
      }

      function tryRestore() {
        if (restoreAttempted) return
        restoreAttempted = true
        if (readPrefs().resumeOnStart !== true) return
        Promise.all([getJson(API + 'state'), getJson(API + 'library')])
          .then(function (results) {
            var saved = results[0] !== null && results[0].state !== undefined ? results[0].state : null
            var tracks = results[1] !== null && Array.isArray(results[1].tracks) ? results[1].tracks : []
            restorePlayback(saved, tracks)
          })
          .catch(function () {
            // Resume is best effort.
          })
      }

      function flushOnHide() {
        flushListening(true)
        flushSessionPosition()
        savePlaybackState()
      }

      function emit() {
        listeners.forEach(function (fn) {
          fn()
        })
        timeListeners.forEach(function (fn) {
          fn()
        })
      }

      function emitTime() {
        timeListeners.forEach(function (fn) {
          fn()
        })
      }

      function patch(next) {
        state = Object.assign({}, state, next)
        emit()
      }

      function currentItem() {
        return state.index >= 0 && state.queue[state.index] ? state.queue[state.index] : null
      }

      // ── media session (system media keys, lock screen, OS media panel) ──

      function syncMediaSession() {
        if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
        var item = currentItem()
        try {
          if (item === null) {
            navigator.mediaSession.metadata = null
          } else if (typeof MediaMetadata !== 'undefined') {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: item.title,
              artist: item.artist || '',
              album: item.album || '',
              artwork: item.hasCover
                ? [{ src: new URL(coverUrl(item.path), window.location.href).href, sizes: '512x512' }]
                : [],
            })
          }
          if (typeof navigator.mediaSession.setPlaybackState === 'function') {
            navigator.mediaSession.setPlaybackState(state.playing ? 'playing' : 'paused')
          }
        } catch (error) {
          // Media Session is best effort.
        }
      }

      function syncMediaHandlers() {
        if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
        try {
          navigator.mediaSession.setActionHandler('play', function () {
            api.play()
          })
          navigator.mediaSession.setActionHandler('pause', function () {
            api.pause()
          })
          navigator.mediaSession.setActionHandler('previoustrack', function () {
            api.prev()
          })
          navigator.mediaSession.setActionHandler('nexttrack', function () {
            api.next()
          })
          navigator.mediaSession.setActionHandler('seekto', function (details) {
            if (details && typeof details.seekTime === 'number') api.seek(details.seekTime)
          })
        } catch (error) {
          // Older browsers expose a partial action list.
        }
      }

      // ── audio element wiring ───────────────────────────────────────────

      function onTime() {
        if (audio === null) return
        state = Object.assign({}, state, { currentTime: audio.currentTime })
        emitTime()
        trackListening()
      }

      function onDuration() {
        if (audio === null) return
        state = Object.assign({}, state, { duration: isFinite(audio.duration) ? audio.duration : 0 })
        emitTime()
      }

      function onProgress() {
        if (audio === null) return
        if (audio.buffered && audio.buffered.length > 0) {
          state = Object.assign({}, state, {
            buffered: audio.buffered.end(audio.buffered.length - 1),
          })
          emitTime()
        }
      }

      function onPlaying() {
        errorStreak = 0
      }

      function onPlay() {
        if (!state.playing) {
          patch({ playing: true })
          syncMediaSession()
        }
      }

      function onPause() {
        flushListening(true)
        flushSessionPosition()
        savePlaybackState()
        if (state.playing) {
          patch({ playing: false })
          syncMediaSession()
        }
      }

      function onEnded() {
        flushListening(true)
        flushSessionPosition()
        if (state.queue.length === 0) return
        if (state.loop === 'one') {
          resetSession(currentItem())
          if (audio) {
            audio.currentTime = 0
            audio.play().catch(function () {})
          }
          return
        }
        if (state.loop === 'none') {
          if (state.order === 'random') {
            if (randomOrder.length === 0 || randomOrder[randomOrder.length - 1] === state.index) {
              patch({ playing: false })
              return
            }
          } else if (state.index >= state.queue.length - 1) {
            patch({ playing: false })
            return
          }
        }
        load(nextIndexOf(state.index, state.order, state.queue.length, randomOrder), true)
      }

      function onError() {
        errorStreak += 1
        if (errorStreak > 3 || state.queue.length <= 1) {
          errorStreak = 0
          patch({ playing: false })
          return
        }
        load(nextIndexOf(state.index, state.order, state.queue.length, randomOrder), true)
      }

      function bind(el) {
        el.addEventListener('timeupdate', onTime)
        el.addEventListener('durationchange', onDuration)
        el.addEventListener('loadedmetadata', onDuration)
        el.addEventListener('progress', onProgress)
        el.addEventListener('canplay', onProgress)
        el.addEventListener('playing', onPlaying)
        el.addEventListener('play', onPlay)
        el.addEventListener('pause', onPause)
        el.addEventListener('ended', onEnded)
        el.addEventListener('error', onError)
      }

      function unbind(el) {
        el.removeEventListener('timeupdate', onTime)
        el.removeEventListener('durationchange', onDuration)
        el.removeEventListener('loadedmetadata', onDuration)
        el.removeEventListener('progress', onProgress)
        el.removeEventListener('canplay', onProgress)
        el.removeEventListener('playing', onPlaying)
        el.removeEventListener('play', onPlay)
        el.removeEventListener('pause', onPause)
        el.removeEventListener('ended', onEnded)
        el.removeEventListener('error', onError)
      }

      function releaseObjectUrl() {
        if (objectUrl === null) return
        try {
          URL.revokeObjectURL(objectUrl)
        } catch (error) {
          // Revoking twice is harmless.
        }
        objectUrl = null
      }

      function cancelPendingFetch() {
        if (fetchAbort === null) return
        try {
          fetchAbort.abort()
        } catch (error) {
          // Already settled.
        }
        fetchAbort = null
      }

      /**
       * Load one track through a local Blob URL.
       *
       * Playing from `blob:` is deliberate: on the Desktop (Electron) media
       * stack, writes to `currentTime` on this plugin's HTTP stream are
       * silently dropped while readyState is already 4, so seeking restarted
       * the track. A Blob is local media and seeks reliably. The download is a
       * loopback request, so it costs one disk read, not a network hop.
       */
      function load(at, autoplay) {
        var item = state.queue[at]
        if (!item) return
        // Close the previous listening session before switching tracks.
        flushListening(true)
        flushSessionPosition()
        var token = (loadToken += 1)
        state = Object.assign({}, state, { index: at, currentTime: 0, duration: 0, buffered: 0 })
        emit()
        syncMediaSession()
        pendingAutoplay = autoplay === true
        // A new session starts here. The play count is recorded later, and
        // only when the Last.fm / MusicBee threshold is reached.
        resetSession(item)
        if (audio === null) return

        cancelPendingFetch()
        // Detach the old blob before revoking it: a revoked URL still
        // assigned to the element fires a spurious `error`.
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        releaseObjectUrl()
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        fetchAbort = controller

        fetch(streamUrl(item.path), controller === null ? {} : { signal: controller.signal })
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.blob()
          })
          .then(function (blob) {
            if (token !== loadToken) return
            fetchAbort = null
            if (audio === null) return
            releaseObjectUrl()
            objectUrl = URL.createObjectURL(blob)
            audio.src = objectUrl
            audio.load()
            if (pendingResumeSeconds !== null) {
              var resumeAt = pendingResumeSeconds
              pendingResumeSeconds = null
              api.seek(resumeAt)
            } else if (readPrefs().rememberPerTrack === true) {
              getJson(API + 'position?path=' + encodeURIComponent(item.path))
                .then(function (body) {
                  if (token !== loadToken) return
                  var seconds = Number(body.lastPositionSec)
                  if (isFinite(seconds) && seconds > 1) api.seek(seconds)
                })
                .catch(function () {})
            }
            if (pendingAutoplay) {
              pendingAutoplay = false
              audio.play().catch(function () {
                if (state.playing) patch({ playing: false })
              })
            }
          })
          .catch(function (error) {
            if (token !== loadToken) return
            fetchAbort = null
            if (error && error.name === 'AbortError') return
            onError()
          })
      }

      var api = {
        subscribe: function (fn) {
          listeners.push(fn)
          return function () {
            listeners = listeners.filter(function (item) {
              return item !== fn
            })
          }
        },
        subscribeTime: function (fn) {
          timeListeners.push(fn)
          return function () {
            timeListeners = timeListeners.filter(function (item) {
              return item !== fn
            })
          }
        },
        getSnapshot: function () {
          return state
        },
        getTime: function () {
          return { currentTime: state.currentTime, duration: state.duration, buffered: state.buffered }
        },
        /** Queue indices in the current playback order (random mode). */
        getPlayOrder: function () {
          return randomOrder.slice()
        },
        /** Restore the last queue/position once (called by the resident host). */
        tryRestore: tryRestore,
        /** Flush statistics + resume state when the page is hidden/closed. */
        flushOnHide: flushOnHide,
        /**
         * Lazily build the analyser graph. Called from a user gesture so the
         * AudioContext can start; connecting a media element source silences
         * the element until the context runs, so it must never be automatic.
         */
        ensureAnalyser: function () {
          if (audio === null) return null
          if (analyser !== null) return analyser
          try {
            var Ctx = window.AudioContext || window.webkitAudioContext
            if (!Ctx) return null
            if (audioContext === null) audioContext = new Ctx()
            var source = audioContext.createMediaElementSource(audio)
            analyser = audioContext.createAnalyser()
            analyser.fftSize = 256
            analyser.smoothingTimeConstant = 0.82
            source.connect(analyser)
            analyser.connect(audioContext.destination)
            waveData = new Uint8Array(analyser.frequencyBinCount)
            if (audioContext.state === 'suspended') audioContext.resume().catch(function () {})
          } catch (error) {
            analyser = null
            return null
          }
          return analyser
        },
        /** Latest frequency data (0..255 per bin) or null when unavailable. */
        getWave: function () {
          if (analyser === null || waveData === null) return null
          analyser.getByteFrequencyData(waveData)
          return waveData
        },
        /** Hand the resident <audio> element to the engine (null detaches). */
        attachAudio: function (el) {
          if (audio === el) return
          if (audio !== null) unbind(audio)
          // A new media element needs a fresh source node; close the old graph.
          if (audioContext !== null) {
            try {
              audioContext.close()
            } catch (error) {
              // Already closed.
            }
          }
          audioContext = null
          analyser = null
          waveData = null
          audio = el
          if (el === null) return
          bind(el)
          el.preload = 'metadata'
          el.volume = 1
          el.muted = false
          var item = currentItem()
          if (item !== null) {
            if (objectUrl !== null) {
              el.src = objectUrl
              el.load()
              if (pendingAutoplay) {
                pendingAutoplay = false
                el.play().catch(function () {})
              }
            } else {
              load(state.index, pendingAutoplay || state.playing)
            }
          }
          syncMediaSession()
        },
        setQueue: function (list) {
          // Never replace a queue that is already playing or paused mid-track.
          if (state.index >= 0) return
          state = Object.assign({}, state, { queue: list.slice(), index: -1 })
          randomOrder = randomOrderOf(list.length)
          emit()
        },
        playList: function (list, at) {
          if (!list || list.length === 0) return
          state = Object.assign({}, state, { queue: list.slice(), index: at })
          randomOrder = randomOrderOf(list.length)
          load(at, true)
        },
        /** Append one track to the queue without interrupting playback. */
        enqueue: function (track) {
          if (track === null || track === undefined || typeof track.path !== 'string' || track.path === '') return
          if (state.queue.length === 0) {
            api.playList([track], 0)
            return
          }
          state = Object.assign({}, state, {
            queue: state.queue.concat([track]),
            index: state.index < 0 ? 0 : state.index,
          })
          randomOrder = randomOrderOf(state.queue.length)
          emit()
          savePlaybackState()
        },
        select: function (list, at) {
          if (!list || list.length === 0 || at < 0) return
          if (at === state.index && sameQueue(list, state.queue)) {
            if (state.playing) api.pause()
            else api.play()
            return
          }
          if (!sameQueue(list, state.queue)) {
            state = Object.assign({}, state, { queue: list.slice(), index: at })
            randomOrder = randomOrderOf(list.length)
            load(at, true)
            return
          }
          load(at, true)
        },
        clearQueue: function () {
          if (audio !== null) audio.pause()
          state = Object.assign({}, state, {
            queue: [],
            index: -1,
            playing: false,
            currentTime: 0,
            duration: 0,
          })
          randomOrder = []
          emit()
          savePlaybackState()
        },
        moveQueue: function (from, to) {
          var length = state.queue.length
          if (from < 0 || from >= length || to < 0 || to >= length || from === to) return
          var list = state.queue.slice()
          var moved = list.splice(from, 1)[0]
          list.splice(to, 0, moved)
          var index = state.index
          if (from === index) {
            index = to
          } else {
            if (from < index) index -= 1
            if (to <= index) index += 1
          }
          state = Object.assign({}, state, { queue: list, index: index })
          randomOrder = randomOrderOf(length)
          emit()
          savePlaybackState()
        },
        /**
         * Reorder the queue to match the displayed order (drag & drop).
         * `indices` are original queue indices in their new visual order.
         * In random mode the new visual order becomes the play order too.
         */
        reorderQueue: function (indices) {
          var length = state.queue.length
          if (!Array.isArray(indices) || indices.length !== length) return
          var seen = {}
          for (var i = 0; i < length; i += 1) {
            var at = indices[i]
            if (!Number.isInteger(at) || at < 0 || at >= length || seen[at] === true) return
            seen[at] = true
          }
          var list = indices.map(function (at) {
            return state.queue[at]
          })
          var current = state.index >= 0 ? indices.indexOf(state.index) : -1
          state = Object.assign({}, state, { queue: list, index: current })
          randomOrder =
            state.order === 'random'
              ? list.map(function (_, position) {
                  return position
                })
              : randomOrderOf(length)
          emit()
          savePlaybackState()
        },
        removeQueueAt: function (at) {
          var length = state.queue.length
          if (at < 0 || at >= length) return
          var list = state.queue.slice()
          list.splice(at, 1)
          if (list.length === 0) {
            api.clearQueue()
            return
          }
          if (at === state.index) {
            var nextIndex = Math.min(at, list.length - 1)
            var shouldPlay = state.playing === true
            state = Object.assign({}, state, { queue: list })
            randomOrder = randomOrderOf(list.length)
            load(nextIndex, shouldPlay)
            return
          }
          var index = at < state.index ? state.index - 1 : state.index
          state = Object.assign({}, state, { queue: list, index: index })
          randomOrder = randomOrderOf(list.length)
          emit()
          savePlaybackState()
        },
        /** Move a queue entry to play right after the current track. */
        playNext: function (at) {
          var length = state.queue.length
          if (at < 0 || at >= length || state.index < 0) return
          var target = Math.min(state.index + 1, length - 1)
          if (at === state.index || at === target) return
          api.moveQueue(at, target)
        },
        play: function () {
          if (!leader) return
          if (state.index < 0) {
            if (state.queue.length > 0) load(0, true)
            return
          }
          if (audio === null) return
          audio.play().catch(function () {})
        },
        /** Called by the cross-tab coordinator; never plays in a follower tab. */
        setLeader: function (value) {
          var next = value === true
          if (leader === next) return
          leader = next
          if (!leader) {
            if (audio !== null) audio.pause()
            if (state.playing) patch({ playing: false })
          }
          emit()
        },
        isLeader: function () {
          return leader
        },
        pause: function () {
          if (audio) audio.pause()
        },
        toggle: function () {
          if (state.playing) api.pause()
          else api.play()
        },
        next: function () {
          if (state.queue.length === 0) return
          load(nextIndexOf(state.index, state.order, state.queue.length, randomOrder), true)
        },
        prev: function () {
          if (state.queue.length === 0) return
          load(prevIndexOf(state.index, state.order, state.queue.length, randomOrder), true)
        },
        seek: function (seconds) {
          if (audio === null) return
          var el = audio
          var item = currentItem()
          // Media duration is unavailable until metadata lands; the scanned
          // track duration is the correct fallback, never a 1-second guess.
          var limit = isFinite(el.duration) && el.duration > 0
            ? el.duration
            : item && item.durationSec > 0
              ? item.durationSec
              : 0
          var target = clamp(seconds, 0, limit > 0 ? limit : seconds)
          if (!isFinite(target)) return

          function apply() {
            try {
              el.currentTime = target
            } catch (error) {
              return
            }
            state = Object.assign({}, state, { currentTime: target })
            emitTime()
          }

          if (el.readyState >= 1) {
            apply()
            return
          }
          var once = function () {
            el.removeEventListener('loadedmetadata', once)
            apply()
          }
          el.addEventListener('loadedmetadata', once)
          try {
            el.currentTime = target
          } catch (error) {
            // The listener above retries once metadata is ready.
          }
        },
        setVolume: function (value) {
          var next = clamp(value, 0, 1)
          state = Object.assign({}, state, { volume: next, muted: next > 0 ? state.muted : false })
          if (audio) audio.volume = next
          savePrefs({ volume: next })
          emit()
        },
        setMuted: function (value) {
          state = Object.assign({}, state, { muted: value })
          if (audio) audio.muted = value
          emit()
        },
        setLoop: function (value) {
          state = Object.assign({}, state, { loop: value })
          savePrefs({ loop: value })
          emit()
        },
        setOrder: function (value) {
          var next = value === 'random' ? 'random' : 'list'
          if (next === 'random' && state.queue.length > 1) {
            // Fresh shuffle whenever random is selected, so the queue panel's
            // displayed order is the actual playback order.
            randomOrder = randomOrderOf(state.queue.length)
          }
          state = Object.assign({}, state, { order: next })
          savePrefs({ order: next })
          emit()
        },
        clear: function () {
          loadToken += 1
          cancelPendingFetch()
          releaseObjectUrl()
          if (audio) {
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
          }
          state = Object.assign({}, state, {
            queue: [],
            index: -1,
            playing: false,
            currentTime: 0,
            duration: 0,
            buffered: 0,
          })
          randomOrder = []
          emit()
          syncMediaSession()
        },
        suspend: function () {
          if (audio) audio.pause()
        },
        destroy: function () {
          loadToken += 1
          cancelPendingFetch()
          releaseObjectUrl()
          if (audio) {
            unbind(audio)
            audio.pause()
            audio.removeAttribute('src')
            audio = null
          }
        },
      }

      syncMediaHandlers()
      if (typeof window !== 'undefined') window[PLAYER_KEY] = api
      return api
    }

    var player = createPlayer()

    /**
     * Resident audio host. It lives in `shell.overlay`, so the media element
     * stays mounted (and playing) while the Music main panel is closed.
     */
    function AudioHost() {
      var ref = useRef(null)
      useEffect(function () {
        player.attachAudio(ref.current)
        player.tryRestore()
        return function () {
          player.attachAudio(null)
        }
      }, [])
      return h('audio', {
        ref: ref,
        className: 'mu-audio-host',
        preload: 'metadata',
        'aria-hidden': 'true',
      })
    }

    // ── composer lyrics (above the chat input) ────────────────────────────
    // Shows the line being sung. Fetches lyrics for the current track itself,
    // so it works even when the player page is not open.

    function ComposerLyrics(props) {
      var slot = props && props.place === 'above' ? 'above' : 'inline'
      var [prefs, setPrefs] = useState(function () {
        return readPrefs()
      })
      var [lines, setLines] = useState([])
      var [timed, setTimed] = useState(false)
      var [text, setText] = useState('')
      var [lyricOffset, setLyricOffset] = useState(0)
      var [track, setTrack] = useState(null)
      var pathRef = useRef('')

      useEffect(function () {
        function onChange() {
          setPrefs(readPrefs())
        }
        window.addEventListener(PREFS_EVENT, onChange)
        return function () {
          window.removeEventListener(PREFS_EVENT, onChange)
        }
      }, [])

      useEffect(function () {
        function sync() {
          var snap = player.getSnapshot()
          var track = snap.index >= 0 ? snap.queue[snap.index] : null
          var path = track ? track.path : ''
          if (path === pathRef.current) return
          pathRef.current = path
          setTrack(track)
          setLines([])
          setTimed(false)
          setText('')
          if (path === '') return
          var order = Array.isArray(readPrefs().lyricOrder) ? readPrefs().lyricOrder.join(',') : 'embedded,lrc'
          getJson(API + 'lyrics?path=' + encodeURIComponent(path) + '&order=' + encodeURIComponent(order))
            .then(function (body) {
              if (pathRef.current !== path) return
              setLines(Array.isArray(body.lines) ? body.lines : [])
              setTimed(body.timed === true)
              setLyricOffset(Number(body.offsetMs) || 0)
            })
            .catch(function () {})
        }
        sync()
        return player.subscribe(sync)
      }, [])

      useEffect(
        function () {
          if (!timed || lines.length === 0) return undefined
          return player.subscribeTime(function () {
            var index = activeLineAt(lines, player.getTime().currentTime - lyricOffset / 1000)
            var line = index >= 0 ? lines[index] : null
            setText(line ? line.text : '')
          })
        },
        [timed, lines, lyricOffset],
      )

      var place = prefs.composerLyricPlace === 'above' ? 'above' : 'input-left'
      var above = place === 'above'
      if (slot === 'above' ? !above : above) return null
      if (prefs.composerLyrics !== true) return null
      if (text === '' && track === null) return null

      // Above the composer: a music bar — track info left, current lyric right.
      // The shell (width/background/border/radius) mirrors `dsh-music-player`'s
      // dock bar so it reads as one card aligned with the input box.
      if (slot === 'above') {
        var name = track ? track.title || '' : ''
        var artist = track && track.artist ? ' - ' + track.artist : ''
        return h(
          'div',
          { className: 'mu-composer-bar-wrap' },
          h(
            'div',
            { className: 'mu-composer-bar' },
            h(
              'div',
              { className: 'mu-composer-bar-left' },
              h('span', { className: 'mu-composer-note' }, icon('note', 14)),
              h('span', { className: 'mu-composer-track', title: name + artist }, name + artist),
            ),
            h('div', { className: 'mu-composer-lyric-inline', title: text }, text),
          ),
        )
      }

      // Inline: one line next to the model picker.
      return h('div', { className: 'mu-composer-lyric', title: text }, text)
    }

    // ── mini player (draggable floating window) ────────────────────────────

    // ── shared playback list (queue overlay) ──────────────────────────────
    // Opened from the composer button and the player bar. The mini player is
    // no longer a standalone floating window: it lives in this overlay header.

    var queueOverlayOpen = false
    var queueOverlayListeners = []

    function queueOverlaySnapshot() {
      return queueOverlayOpen
    }

    function toggleQueueOverlay(next) {
      queueOverlayOpen = next === undefined ? !queueOverlayOpen : next === true
      queueOverlayListeners.slice().forEach(function (listener) {
        listener()
      })
    }

    function subscribeQueueOverlay(listener) {
      queueOverlayListeners = queueOverlayListeners.concat([listener])
      return function () {
        queueOverlayListeners = queueOverlayListeners.filter(function (item) {
          return item !== listener
        })
      }
    }

    /** [{ track, originalIndex }] in actual playback order. */
    function buildQueueView(snap, playOrder) {
      if (snap.order === 'random' && Array.isArray(playOrder) && playOrder.length === snap.queue.length) {
        return playOrder.map(function (originalIndex) {
          return { track: snap.queue[originalIndex], originalIndex: originalIndex }
        })
      }
      return snap.queue.map(function (track, originalIndex) {
        return { track: track, originalIndex: originalIndex }
      })
    }

    function QueueNowPlaying() {
      var [snap, setSnap] = useState(player.getSnapshot())
      useEffect(function () {
        return player.subscribe(function () {
          setSnap(player.getSnapshot())
        })
      }, [])
      var track = snap.index >= 0 && snap.queue[snap.index] ? snap.queue[snap.index] : null
      if (track === null) {
        return h('div', { className: 'mu-qoverlay-now is-empty' }, t('page.noTrack'))
      }
      return h(
        'div',
        { className: 'mu-qoverlay-now' },
        h(Cover, { track: track, size: 44, radius: 8 }),
        h(
          'div',
          { className: 'mu-qoverlay-now-main' },
          h('div', { className: 'mu-qoverlay-now-title mu-ellipsis' }, track.title),
          h('div', { className: 'mu-qoverlay-now-artist mu-ellipsis' }, track.artist || t('page.unknownArtist')),
        ),
        h(
          'div',
          { className: 'mu-qoverlay-now-controls' },
          h(
            'button',
            { type: 'button', className: 'mu-icon-btn', title: t('page.prev'), onClick: function () { player.ensureAnalyser(); player.prev() } },
            icon('prev', 16),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mu-icon-btn',
              title: snap.playing ? t('page.pause') : t('page.play'),
              onClick: function () { player.ensureAnalyser(); player.toggle() },
            },
            icon(snap.playing ? 'pause' : 'play', 18),
          ),
          h(
            'button',
            { type: 'button', className: 'mu-icon-btn', title: t('page.next'), onClick: function () { player.ensureAnalyser(); player.next() } },
            icon('next', 16),
          ),
        ),
      )
    }

    function QueueOverlay() {
      var [open, setOpen] = useState(queueOverlaySnapshot())
      var [snap, setSnap] = useState(player.getSnapshot())
      var [pos, setPos] = useState(function () {
        var saved = readPrefs().queuePos
        if (saved === null || typeof saved !== 'object') return null
        if (!isFinite(saved.x) || !isFinite(saved.y)) return null
        return { x: Number(saved.x), y: Number(saved.y) }
      })
      // Drag state lives entirely in refs/DOM classes so React never
      // re-renders the dragged row mid-drag (Chromium cancels that).
      var dragFromRef = useRef(null)
      var dragOverRef = useRef(null)
      var suppressClickRef = useRef(0)
      var ref = useRef(null)
      var listRef = useRef(null)

      useEffect(function () {
        return subscribeQueueOverlay(function () {
          setOpen(queueOverlaySnapshot())
        })
      }, [])
      useEffect(function () {
        return player.subscribe(function () {
          setSnap(player.getSnapshot())
        })
      }, [])
      // Keep the playing row visible when the track changes.
      useEffect(
        function () {
          if (!open) return
          var list = listRef.current
          if (list === null) return
          var row = list.querySelector('.mu-queue-row.is-current')
          if (row === null) return
          var rowRect = row.getBoundingClientRect()
          var listRect = list.getBoundingClientRect()
          if (rowRect.top < listRect.top || rowRect.bottom > listRect.bottom) {
            list.scrollTop +=
              rowRect.top - listRect.top - (list.clientHeight - rowRect.height) / 2
          }
        },
        [snap.index, snap.queue.length, open],
      )
      useEffect(function () {
        if (!open) return undefined
        function onKey(event) {
          if (event.key === 'Escape') toggleQueueOverlay(false)
        }
        function onPointerDown(event) {
          if (ref.current !== null && ref.current.contains(event.target)) return
          toggleQueueOverlay(false)
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onPointerDown)
        return function () {
          document.removeEventListener('keydown', onKey)
          document.removeEventListener('mousedown', onPointerDown)
        }
      }, [open])

      if (!open) return null
      var queueView = buildQueueView(snap, player.getPlayOrder())

      function clearDragMarks() {
        var list = listRef.current
        if (list === null) return
        var rowEls = list.querySelectorAll('.mu-queue-row')
        for (var i = 0; i < rowEls.length; i += 1) {
          rowEls[i].classList.remove('is-dragging', 'is-drop-target')
        }
      }

      function moveRow(from, to) {
        if (from === null || from === to || from < 0 || to < 0) return
        if (from >= queueView.length || to >= queueView.length) return
        var order = queueView.map(function (item) {
          return item.originalIndex
        })
        var moved = order.splice(from, 1)[0]
        order.splice(to, 0, moved)
        player.reorderQueue(order)
      }

      // Pointer-driven reorder (SortableJS' approach). The harness hosts this
      // overlay inside the composer area, where HTML5 dragstart is unreliable;
      // DSH's sidebar rows use HTML5 DnD with a custom drag preview, so this
      // keeps the same before/after marker semantics but with pointer events.
      var dragMoved = false
      function startDrag(event, position) {
        if (event.button !== undefined && event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        var list = listRef.current
        if (list === null) return
        dragFromRef.current = position
        dragOverRef.current = position
        dragMoved = false
        var sourceRow = event.currentTarget.closest('.mu-queue-row')
        if (sourceRow !== null) sourceRow.classList.add('is-dragging')
        document.body.style.userSelect = 'none'

        function mark(target) {
          dragOverRef.current = target
          var rowEls = list.querySelectorAll('.mu-queue-row')
          for (var i = 0; i < rowEls.length; i += 1) {
            rowEls[i].classList.toggle('is-drop-target', i === target)
          }
        }

        function onMove(moveEvent) {
          dragMoved = true
          var rowEls = list.querySelectorAll('.mu-queue-row')
          if (rowEls.length === 0) return
          var target = rowEls.length - 1
          for (var i = 0; i < rowEls.length; i += 1) {
            var rect = rowEls[i].getBoundingClientRect()
            if (moveEvent.clientY < rect.top + rect.height / 2) {
              target = i
              break
            }
            target = i
          }
          mark(target)
        }

        function onUp() {
          document.removeEventListener('pointermove', onMove)
          document.removeEventListener('pointerup', onUp)
          document.removeEventListener('pointercancel', onUp)
          document.body.style.userSelect = ''
          var from = dragFromRef.current
          var to = dragOverRef.current
          dragFromRef.current = null
          dragOverRef.current = null
          clearDragMarks()
          if (dragMoved && from !== null && to !== null) {
            suppressClickRef.current = Date.now() + 250
            moveRow(from, to)
          }
        }

        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('pointercancel', onUp)
      }

      // Drag the whole panel by its header strip (buttons and queue rows keep
      // their own gestures). Position is remembered in prefs.
      function startPanelDrag(event) {
        if (event.button !== undefined && event.button !== 0) return
        var target = event.target
        if (target === null || target === undefined || typeof target.closest !== 'function') return
        if (target.closest('button, .mu-queue-row, .mu-queue-grip') !== null) return
        if (target.closest('.mu-qoverlay-now, .mu-qoverlay-head') === null) return
        var el = ref.current
        if (el === null) return
        var rect = el.getBoundingClientRect()
        var start = {
          x: event.clientX,
          y: event.clientY,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          moved: false,
        }
        event.preventDefault()
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
        el.classList.add('is-dragging-panel')

        function clamp(value, min, max) {
          return Math.max(min, Math.min(max, value))
        }

        function onMove(moveEvent) {
          start.moved = true
          var x = clamp(
            start.left + (moveEvent.clientX - start.x),
            8,
            Math.max(8, window.innerWidth - start.width - 8),
          )
          var y = clamp(
            start.top + (moveEvent.clientY - start.y),
            8,
            Math.max(8, window.innerHeight - start.height - 8),
          )
          el.style.left = x + 'px'
          el.style.top = y + 'px'
          el.style.right = 'auto'
          el.style.bottom = 'auto'
        }

        function onUp() {
          document.removeEventListener('pointermove', onMove)
          document.removeEventListener('pointerup', onUp)
          document.removeEventListener('pointercancel', onUp)
          document.body.style.userSelect = ''
          document.body.style.cursor = ''
          el.classList.remove('is-dragging-panel')
          if (start.moved) {
            var next = el.getBoundingClientRect()
            var position = { x: Math.round(next.left), y: Math.round(next.top) }
            setPos(position)
            savePrefs({ queuePos: position })
          }
        }

        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('pointercancel', onUp)
      }

      var rows = queueView.map(function (entry, position) {
        var track = entry.track
        var originalIndex = entry.originalIndex
        var visibleCurrent = originalIndex === snap.index
        return h(
          'div',
          {
            key: position + ':' + track.path,
            className: 'mu-queue-row' + (visibleCurrent ? ' is-current' : ''),
            onClick: function () {
              if (Date.now() < suppressClickRef.current) return
              player.ensureAnalyser()
              player.select(snap.queue, originalIndex)
            },
          },
          h(
            'span',
            {
              className: 'mu-queue-grip',
              title: t('page.dragSort'),
              onPointerDown: function (event) {
                startDrag(event, position)
              },
            },
            '⋮⋮',
          ),
          h(
            'span',
            { className: 'mu-queue-index' },
            visibleCurrent && snap.playing
              ? h(BarWave, { width: 18, height: 10, bars: 5, className: 'mu-queue-wave' })
              : String(position + 1),
          ),
          h('span', { className: 'mu-ellipsis' }, track.title),
          h('span', { className: 'mu-queue-artist mu-ellipsis' }, track.artist || ''),
          h(
            'span',
            { className: 'mu-queue-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'mu-queue-btn',
                title: t('page.removeTrack'),
                onClick: function (event) {
                  event.stopPropagation()
                  player.removeQueueAt(originalIndex)
                },
              },
              '×',
            ),
          ),
        )
      })

      return h(
        'div',
        {
          className: 'mu-qoverlay',
          ref: ref,
          style:
            pos !== null
              ? { left: pos.x + 'px', top: pos.y + 'px', right: 'auto', bottom: 'auto' }
              : undefined,
          onPointerDown: function (event) {
            startPanelDrag(event)
          },
        },
        h(QueueNowPlaying, null),
        h(
          'div',
          { className: 'mu-qoverlay-head' },
          h('span', null, t('page.queue')),
          h('span', { className: 'mu-queue-mode' }, playModeLabel(playModeOf(snap))),
          h(
            'button',
            { type: 'button', className: 'mu-icon-btn mu-icon-btn-sm', onClick: function () { toggleQueueOverlay(false) } },
            icon('x', 14),
          ),
        ),
        h(
          'div',
          {
            className: 'mu-qoverlay-list',
            ref: listRef,
          },
          snap.queue.length === 0 ? h('div', { className: 'mu-state-sub' }, t('page.queueEmpty')) : rows,
        ),
      )
    }

    function ComposerQueueButton() {
      var [snap, setSnap] = useState(player.getSnapshot())
      var [enabled, setEnabled] = useState(function () {
        return readPrefs().composerQueueButton !== false
      })
      var [open, setOpen] = useState(queueOverlaySnapshot())
      useEffect(function () {
        return player.subscribe(function () {
          setSnap(player.getSnapshot())
        })
      }, [])
      useEffect(function () {
        function onChange() {
          setEnabled(readPrefs().composerQueueButton !== false)
        }
        window.addEventListener(PREFS_EVENT, onChange)
        return function () {
          window.removeEventListener(PREFS_EVENT, onChange)
        }
      }, [])
      useEffect(function () {
        return subscribeQueueOverlay(function () {
          setOpen(queueOverlaySnapshot())
        })
      }, [])
      if (!enabled) return null
      return h(
        'button',
        {
          type: 'button',
          className: 'mu-composer-queue-btn' + (open ? ' is-on' : '') + (snap.playing ? ' is-playing' : ''),
          title: t('page.queue'),
          onClick: function () {
            toggleQueueOverlay()
          },
        },
        icon('list', 16),
      )
    }

    /** Composer cluster: current lyric + queue button, left of the send button. */
    function ComposerCluster() {
      return h(
        'div',
        { className: 'mu-composer-cluster' },
        h(ComposerLyrics, { place: 'inline' }),
        h(ComposerQueueButton, null),
      )
    }

    function sourceLabel(source) {
      if (source === 'netease') return t('page.sourceNetease')
      if (source === 'qq') return t('page.sourceQq')
      if (source === 'itunes') return t('page.sourceItunes')
      if (source === 'musicbrainz') return t('page.sourceMusicbrainz')
      return source || ''
    }

    /** One online-match candidate: cover, title/artist/album and source badges. */
    function MatchItem(props) {
      var [size, setSize] = useState('')
      var item = props.item
      return h(
        'button',
        { type: 'button', className: 'mu-match-item', onClick: props.onPick },
        h(
          'span',
          { className: 'mu-match-thumb' },
          item.coverUrl
            ? h('img', {
                className: 'mu-match-cover',
                src: item.coverUrl,
                loading: 'lazy',
                alt: '',
                onLoad: function (event) {
                  var el = event.target
                  if (el && el.naturalWidth > 0) setSize(el.naturalWidth + '×' + el.naturalHeight)
                },
              })
            : h('span', { className: 'mu-match-cover is-empty' }, icon('note', 18)),
        ),
        h(
          'span',
          { className: 'mu-match-info' },
          h('span', { className: 'mu-match-title mu-ellipsis' }, item.title || ''),
          h('span', { className: 'mu-match-artist mu-ellipsis' }, item.artist || ''),
          h('span', { className: 'mu-match-album mu-ellipsis' }, item.album || ''),
          h(
            'span',
            { className: 'mu-match-meta' },
            item.year ? h('span', { className: 'mu-match-badge', key: 'year' }, item.year) : null,
            size !== '' ? h('span', { className: 'mu-match-badge', key: 'size' }, size) : null,
            item.track ? h('span', { className: 'mu-match-badge', key: 'track' }, 'Track ' + item.track) : null,
            item.disc ? h('span', { className: 'mu-match-badge', key: 'disc' }, 'Disc ' + item.disc) : null,
            item.genre ? h('span', { className: 'mu-match-badge', key: 'genre' }, item.genre) : null,
            h('span', { className: 'mu-match-badge is-source', key: 'source' }, sourceLabel(item.source)),
          ),
        ),
      )
    }

    function MiniPlayer() {
      var [enabled, setEnabled] = useState(function () {
        return readPrefs().miniPlayer === true
      })
      var [snap, setSnap] = useState(player.getSnapshot())
      var [pos, setPos] = useState(function () {
        var saved = readPrefs().miniPos
        var valid =
          saved !== null &&
          typeof saved === 'object' &&
          typeof saved.x === 'number' &&
          typeof saved.y === 'number' &&
          isFinite(saved.x) &&
          isFinite(saved.y)
        return valid ? { x: saved.x, y: saved.y } : null
      })
      var posRef = useRef(pos)
      posRef.current = pos
      var dragRef = useRef(null)

      useEffect(function () {
        function onChange() {
          setEnabled(readPrefs().miniPlayer === true)
        }
        window.addEventListener(PREFS_EVENT, onChange)
        return function () {
          window.removeEventListener(PREFS_EVENT, onChange)
        }
      }, [])

      useEffect(function () {
        return player.subscribe(function () {
          setSnap(player.getSnapshot())
        })
      }, [])

      if (!enabled) return null

      var track = snap.index >= 0 && snap.queue[snap.index] ? snap.queue[snap.index] : null
      var style =
        pos !== null
          ? { left: Math.max(8, pos.x) + 'px', top: Math.max(8, pos.y) + 'px', right: 'auto', bottom: 'auto' }
          : {}

      function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return
        var rect = event.currentTarget.getBoundingClientRect()
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          originX: rect.left,
          originY: rect.top,
        }
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch (error) {
          // Pointer capture is best effort.
        }
      }

      function onPointerMove(event) {
        var drag = dragRef.current
        if (drag === null) return
        var width = 260
        var height = 56
        var x = Math.max(8, Math.min(window.innerWidth - width - 8, drag.originX + event.clientX - drag.startX))
        var y = Math.max(8, Math.min(window.innerHeight - height - 8, drag.originY + event.clientY - drag.startY))
        setPos({ x: x, y: y })
      }

      function onPointerUp() {
        if (dragRef.current === null) return
        dragRef.current = null
        var current = posRef.current
        if (current !== null) savePrefs({ miniPos: current })
      }

      return h(
        'div',
        {
          className: 'mu-mini' + (pos === null ? ' is-corner' : ''),
          style: style,
          onPointerDown: onPointerDown,
          onPointerMove: onPointerMove,
          onPointerUp: onPointerUp,
          onPointerCancel: onPointerUp,
        },
        h(Cover, { track: track, size: 36, radius: 8 }),
        h(
          'div',
          { className: 'mu-mini-info' },
          h('div', { className: 'mu-mini-title' }, track ? track.title : t('page.noTrack')),
          h('div', { className: 'mu-mini-artist' }, track ? track.artist || '' : ''),
        ),
        h(
          'div',
          { className: 'mu-mini-controls' },
          h(
            'button',
            {
              type: 'button',
              className: 'mu-icon-btn mu-icon-btn-sm',
              title: t('page.prev'),
              onPointerDown: function (event) {
                event.stopPropagation()
              },
              onClick: function () {
                player.prev()
              },
            },
            icon('prev', 14),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mu-icon-btn mu-icon-btn-sm',
              title: snap.playing ? t('page.pause') : t('page.play'),
              onPointerDown: function (event) {
                event.stopPropagation()
              },
              onClick: function () {
                player.toggle()
              },
            },
            icon(snap.playing ? 'pause' : 'play', 14),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mu-icon-btn mu-icon-btn-sm',
              title: t('page.next'),
              onPointerDown: function (event) {
                event.stopPropagation()
              },
              onClick: function () {
                player.next()
              },
            },
            icon('next', 14),
          ),
        ),
      )
    }

    // ── seek bar (own subscription: time updates do not re-render the list) ──

    function SeekBar(props) {
      var [, setTick] = useState(0)
      var [seeking, setSeeking] = useState(null)

      useEffect(
        function () {
          return props.player.subscribeTime(function () {
            setTick(function (n) {
              return n + 1
            })
          })
        },
        [props.player],
      )

      var time = props.player.getTime()
      var trackDuration = props.track && props.track.durationSec > 0 ? props.track.durationSec : 0
      var duration = time.duration > 0 ? time.duration : trackDuration
      var position = seeking !== null ? seeking : Math.min(time.currentTime, duration || 0)
      var progress = duration > 0 ? (clamp(position, 0, duration) / duration) * 100 : 0
      var buffered = duration > 0 ? (clamp(time.buffered, 0, duration) / duration) * 100 : 0

      function commit() {
        if (seeking === null) return
        if (duration > 0) props.player.seek(seeking)
        setSeeking(null)
      }

      return h(
        'div',
        { className: 'mu-seekwrap' + (props.className ? ' ' + props.className : '') },
        h('div', { className: 'mu-bar-buffer', style: { width: buffered + '%' } }),
        h('input', {
          type: 'range',
          className: 'mu-seek',
          min: 0,
          max: duration > 0 ? duration : 1,
          step: 0.1,
          value: position,
          disabled: duration <= 0,
          style: { '--mu-p': progress + '%' },
          onChange: function (event) {
            setSeeking(Number(event.target.value))
          },
          onPointerUp: commit,
          onKeyUp: commit,
          onClick: commit,
        }),
      )
    }

    // ── now playing page ─────────────────────────────────────────────────
    // Full-screen player: spinning disc on the left, scrolling lyrics on the
    // right. The disc is a CSS animation whose play state follows playback;
    // the lyric list translates so the active line sits in the middle — the
    // layout APlayer / Apple-Music-style players converge on.

    function activeLineAt(lines, time) {
      if (lines.length === 0 || lines[0].time < 0) return -1
      var low = 0
      var high = lines.length - 1
      var found = -1
      while (low <= high) {
        var mid = (low + high) >> 1
        if (lines[mid].time <= time + 0.05) {
          found = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      }
      return found
    }

    function NowPlaying(props) {
      var player = props.player
      var snap = props.snapshot
      var track = snap.index >= 0 && snap.queue[snap.index] ? snap.queue[snap.index] : null

      var [lyrics, setLyrics] = useState([])
      var [lyricsTimed, setLyricsTimed] = useState(false)
      var [active, setActive] = useState(-1)
      var boxRef = useRef(null)
      var innerRef = useRef(null)
      var rowRefs = useRef([])
      var timeRef = useRef(null)
      var closeRef = useRef(props.onClose)
      closeRef.current = props.onClose
      var trackPath = track ? track.path : ''
      var [prefs, setPrefs] = useState(function () {
        return readPrefs()
      })
      var [lyricSettingsOpen, setLyricSettingsOpen] = useState(false)
      var [lyricOffset, setLyricOffset] = useState(0)
      var [lyricError, setLyricError] = useState('')

      function applyLyricOffset(delta) {
        if (track === null) return
        var next = Math.max(-60_000, Math.min(60_000, lyricOffset + delta))
        setLyricOffset(next)
        setLyricError('')
        postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: next }).catch(function (error) {
          setLyricError(String((error && error.message) || error))
        })
      }

      function writeLyricsToFile() {
        if (track === null) return
        setLyricError('')
        postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: lyricOffset, write: true })
          .then(function () {
            var order = Array.isArray(prefs.lyricOrder) ? prefs.lyricOrder.join(',') : 'embedded,lrc'
            return getJson(API + 'lyrics?path=' + encodeURIComponent(track.path) + '&order=' + encodeURIComponent(order))
          })
          .then(function (body) {
            setLyrics(Array.isArray(body.lines) ? body.lines : [])
            setLyricsTimed(body.timed === true)
            setLyricOffset(Number(body.offsetMs) || 0)
          })
          .catch(function (error) {
            setLyricError(String((error && error.message) || error))
          })
      }

      useEffect(function () {
        function onChange() {
          setPrefs(readPrefs())
        }
        window.addEventListener(PREFS_EVENT, onChange)
        return function () {
          window.removeEventListener(PREFS_EVENT, onChange)
        }
      }, [])

      var showTranslation = prefs.showTranslation !== false
      var lyricSize = clampPref(prefs.lyricSize, 14, 40, 18)
      var lyricWeight = clampPref(prefs.lyricWeight, 300, 800, 500)
      var lyricBlur = prefs.lyricBlur !== false
      var translationScale = clampPref(prefs.translationScale, 50, 100, 80)
      var circularCover = prefs.circularCover !== false
      var vinylRing = prefs.vinylRing === true
      var coverSpin = prefs.coverSpin !== false
      var lyricAlign = prefs.lyricAlign === 'left' || prefs.lyricAlign === 'right' ? prefs.lyricAlign : 'center'
      var lyricOrderKey = Array.isArray(prefs.lyricOrder) ? prefs.lyricOrder.join(',') : 'embedded,lrc'

      useEffect(
        function () {
          setLyrics([])
          setLyricsTimed(false)
          setActive(-1)
          if (trackPath === '') return undefined
          var cancelled = false
          var order = Array.isArray(prefs.lyricOrder) ? prefs.lyricOrder.join(',') : 'embedded,lrc'
          getJson(API + 'lyrics?path=' + encodeURIComponent(trackPath) + '&order=' + encodeURIComponent(order))
            .then(function (body) {
              if (cancelled) return
              setLyrics(Array.isArray(body.lines) ? body.lines : [])
              setLyricsTimed(body.timed === true)
              setLyricOffset(Number(body.offsetMs) || 0)
            })
            .catch(function () {
              if (!cancelled) setLyrics([])
            })
          return function () {
            cancelled = true
          }
        },
        [trackPath, lyricOrderKey],
      )

      useEffect(
        function () {
          return player.subscribeTime(function () {
            var current = player.getTime().currentTime
            if (timeRef.current) timeRef.current.textContent = fmtTime(current)
            if (!lyricsTimed) return
            // Positive offset delays the lyrics: look up an earlier timestamp.
            var next = activeLineAt(lyrics, current - lyricOffset / 1000)
            setActive(function (previous) {
              return previous === next ? previous : next
            })
          })
        },
        [player, lyrics, lyricsTimed, lyricOffset],
      )

      useEffect(
        function () {
          var inner = innerRef.current
          var box = boxRef.current
          if (!inner || !box) return
          if (!lyricsTimed || lyrics.length === 0) {
            inner.style.transform = 'translateY(0px)'
            return
          }
          // Before the first timestamp the opening line is already "current",
          // and a negative offset is required to vertically center it.
          var index = active >= 0 ? active : 0
          var row = rowRefs.current[index]
          if (!row) return
          var offset = row.offsetTop - (box.clientHeight / 2 - row.offsetHeight / 2)
          inner.style.transform = 'translateY(' + -offset + 'px)'
        },
        [active, lyrics, lyricsTimed],
      )

      useEffect(
        function () {
          function onKey(event) {
            if (event.key === 'Escape') closeRef.current()
          }
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('keydown', onKey)
          }
        },
        [],
      )

      function cycleLoop() {
        cyclePlayMode(snap)
      }

      function loopLabel() {
        return playModeLabel(playModeOf(snap))
      }

      return h(
        'div',
        {
          className:
            'mu-np' +
            (props.visible ? ' is-open' : '') +
            (lyricBlur ? ' is-blur' : '') +
            ' mu-align-' +
            lyricAlign,
          role: 'dialog',
          'aria-label': t('page.openPlayer'),
          style: {
            '--mu-lyric-size': lyricSize + 'px',
            '--mu-lyric-weight': String(lyricWeight),
            '--mu-lyric-trans': Math.round((lyricSize * translationScale) / 100) + 'px',
          },
        },
        track && track.hasCover
          ? h('div', { className: 'mu-np-bg' }, h('img', { src: coverUrl(track.path), alt: '' }))
          : null,
        h('div', { className: 'mu-np-shade' }),

        h(
          'div',
          { className: 'mu-np-head' },
          h(
            'button',
            { type: 'button', className: 'mu-icon-btn', title: t('page.closePlayer'), onClick: props.onClose },
            icon('chevronDown', 20),
          ),
          h('div', { className: 'mu-np-head-title mu-ellipsis' }, track ? track.title : t('page.noTrack')),
          h(
            'div',
            { className: 'mu-np-head-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'mu-icon-btn mu-trans-toggle' + (lyricSettingsOpen ? ' is-on' : ''),
                title: t('page.lyricSettings'),
                onClick: function () {
                  setLyricSettingsOpen(!lyricSettingsOpen)
                },
              },
              'Aa',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mu-icon-btn mu-trans-toggle' + (showTranslation ? ' is-on' : ''),
                title: t('page.translation'),
                onClick: function () {
                  savePrefs({ showTranslation: !showTranslation })
                },
              },
              '译',
            ),
          ),
        ),

        lyricSettingsOpen
          ? h(
              'div',
              { className: 'mu-np-settings' },
              h(
                'div',
                { className: 'mu-np-setting' },
                h(
                  'div',
                  { className: 'mu-np-setting-head' },
                  h('span', null, t('page.lyricOffset')),
                  h('span', { className: 'mu-np-setting-value' }, (lyricOffset / 1000).toFixed(1) + ' s'),
                ),
                h(
                  'div',
                  { className: 'mu-np-offset-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-btn mu-btn-ghost mu-btn-sm',
                      onClick: function () {
                        applyLyricOffset(-500)
                      },
                    },
                    '−0.5s',
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-btn mu-btn-ghost mu-btn-sm',
                      onClick: function () {
                        applyLyricOffset(500)
                      },
                    },
                    '+0.5s',
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'mu-btn mu-btn-sm', onClick: writeLyricsToFile },
                    t('page.writeLyrics'),
                  ),
                ),
                h('div', { className: 'mu-np-setting-hint' }, t('page.lyricOffsetHint')),
                lyricError !== ''
                  ? h('div', { className: 'mu-np-setting-error' }, lyricError)
                  : null,
              ),
              h(
                'div',
                { className: 'mu-np-setting' },
                h(
                  'div',
                  { className: 'mu-np-setting-head' },
                  h('span', null, t('page.lyricSize')),
                  h('span', { className: 'mu-np-setting-value' }, lyricSize + ' px'),
                ),
                h('input', {
                  type: 'range',
                  className: 'mu-np-range',
                  min: 14,
                  max: 40,
                  step: 1,
                  value: lyricSize,
                  onChange: function (event) {
                    var next = Number(event.target.value)
                    if (!isFinite(next)) return
                    savePrefs({ lyricSize: next })
                  },
                }),
              ),
              h(
                'div',
                { className: 'mu-np-setting' },
                h(
                  'div',
                  { className: 'mu-np-setting-head' },
                  h('span', null, t('page.lyricWeight')),
                  h('span', { className: 'mu-np-setting-value' }, String(lyricWeight)),
                ),
                h('input', {
                  type: 'range',
                  className: 'mu-np-range',
                  min: 300,
                  max: 800,
                  step: 100,
                  value: lyricWeight,
                  onChange: function (event) {
                    var next = Number(event.target.value)
                    if (!isFinite(next)) return
                    savePrefs({ lyricWeight: next })
                  },
                }),
              ),
              h(
                'div',
                { className: 'mu-np-setting mu-np-setting-inline' },
                h('span', null, t('page.lyricBlur')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-np-toggle' + (lyricBlur ? ' is-on' : ''),
                    onClick: function () {
                      var next = !lyricBlur
                      savePrefs({ lyricBlur: next })
                    },
                  },
                  h('span', { className: 'mu-np-toggle-dot' }),
                ),
              ),
              h(
                'div',
                { className: 'mu-np-setting' },
                h(
                  'div',
                  { className: 'mu-np-setting-head' },
                  h('span', null, t('page.translationScale')),
                  h('span', { className: 'mu-np-setting-value' }, translationScale + '%'),
                ),
                h('input', {
                  type: 'range',
                  className: 'mu-np-range',
                  min: 50,
                  max: 100,
                  step: 5,
                  value: translationScale,
                  onChange: function (event) {
                    var next = Number(event.target.value)
                    if (!isFinite(next)) return
                    savePrefs({ translationScale: next })
                  },
                }),
              ),
            )
          : null,

        h(
          'div',
          { className: 'mu-np-body' },
          h(
            'div',
            { className: 'mu-np-left' },
            h(
              'div',
              { className: 'mu-np-disc-wrap' },
              h(
                'div',
                {
                  className:
                    'mu-np-disc' +
                    (circularCover ? ' is-circle' : ' is-square') +
                    (coverSpin && circularCover && snap.playing ? ' is-playing' : '') +
                    (vinylRing && circularCover ? ' is-vinyl' : ''),
                },
                vinylRing && circularCover ? h('div', { className: 'mu-np-vinyl' }) : null,
                h(
                  'div',
                  { className: 'mu-np-art' },
                  track && track.hasCover
                    ? h('img', {
                        src: coverUrl(track.path),
                        alt: '',
                        draggable: 'false',
                        onError: function (event) {
                          event.target.style.display = 'none'
                        },
                      })
                    : icon('note', 96),
                ),
              ),
            ),
            h(
              'div',
              { className: 'mu-np-meta' },
              h('div', { className: 'mu-np-title mu-ellipsis' }, track ? track.title : '—'),
              h(
                'div',
                { className: 'mu-np-artist mu-ellipsis' },
                track ? track.artist || t('page.unknownArtist') : '',
              ),
            ),
          ),
          h(
            'div',
            { className: 'mu-np-right' },
            h(
              'div',
              { className: 'mu-np-lyrics' + (lyricsTimed ? '' : ' is-static'), ref: boxRef },
              lyrics.length === 0
                ? h('div', { className: 'mu-np-lyrics-empty' }, t('page.noLyrics'))
                : h(
                    'div',
                    { className: 'mu-np-lyrics-inner', ref: innerRef },
                    lyrics.map(function (line, index) {
                      return h(
                        'div',
                        {
                          key: String(index),
                          ref: function (el) {
                            rowRefs.current[index] = el
                          },
                          className:
                            'mu-np-line' +
                            (index === active ? ' is-active' : '') +
                            (active >= 0 && index < active ? ' is-past' : ''),
                          style: {
                            '--mu-line-stagger': String(
                              active >= 0 ? Math.min(Math.abs(index - active), 8) : 0,
                            ),
                          },
                          onClick: function () {
                            if (line.time >= 0) player.seek(line.time + lyricOffset / 1000)
                          },
                        },
                        h('div', { className: 'mu-np-line-text' }, line.text),
                        showTranslation && line.translation !== ''
                          ? line.translation.split('\n').map(function (part, partIndex) {
                              return h(
                                'div',
                                { key: 'translation-' + partIndex, className: 'mu-np-line-trans' },
                                part,
                              )
                            })
                          : null,
                      )
                    }),
                  ),
            ),
          ),
        ),

        h(
          'div',
          { className: 'mu-np-bottom' },
          h(
            'div',
            { className: 'mu-np-progress' },
            h(SeekBar, { player: player, track: track, className: 'mu-seek-np' }),
          ),
          h(
            'div',
            { className: 'mu-np-bar' },
            h(
              'div',
              { className: 'mu-np-time' },
              h('span', { ref: timeRef }, fmtTime(player.getTime().currentTime)),
              h('span', { className: 'mu-np-time-sep' }, ' / '),
              h('span', null, fmtTime(track && track.durationSec > 0 ? track.durationSec : 0)),
            ),
            h(
              'div',
              { className: 'mu-np-controls' },
              h(
                'button',
                { type: 'button', className: 'mu-icon-btn', title: loopLabel(), onClick: cycleLoop },
                icon(playModeIcon(playModeOf(snap)), 18),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn',
                  title: t('page.prev'),
                  onClick: function () {
                    player.prev()
                  },
                },
                icon('prev', 20),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-play-btn mu-play-btn-lg',
                  title: snap.playing ? t('page.pause') : t('page.play'),
                  onClick: function () {
                    player.toggle()
                  },
                },
                icon(snap.playing ? 'pause' : 'play', 24),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn',
                  title: t('page.next'),
                  onClick: function () {
                    player.next()
                  },
                },
                icon('next', 20),
              ),
            ),
            h(
              'div',
              { className: 'mu-np-vol' },
              track && track.sampleRate ? h('span', { className: 'mu-quality' }, fmtKhz(track.sampleRate)) : null,
            ),
          ),
        ),
      )
    }

    // ── main panel ───────────────────────────────────────────────────────

    // ── windowed list (fixed row height) ──────────────────────────────────
    // Same approach as dscroll / react-window: render only the visible slice
    // plus a small overscan, absolutely positioned inside a spacer. Keeps a
    // 5000-track library from creating 5000 DOM rows.

    function VirtualList(props) {
      var rowHeight = props.rowHeight || 67
      var overscan = props.overscan === undefined ? 6 : props.overscan
      var [scrollTop, setScrollTop] = useState(0)
      var [viewport, setViewport] = useState(600)
      var ref = useRef(null)

      useEffect(
        function () {
          var element = ref.current
          if (element === null) return undefined
          function measure() {
            setViewport(element.clientHeight || 600)
          }
          measure()
          window.addEventListener('resize', measure)
          var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
          if (observer !== null) observer.observe(element)
          return function () {
            window.removeEventListener('resize', measure)
            if (observer !== null) observer.disconnect()
          }
        },
        [],
      )

      var items = props.items
      useEffect(
        function () {
          if (ref.current !== null) ref.current.scrollTop = 0
          setScrollTop(0)
        },
        [items.length],
      )
      if (items.length === 0) {
        return h(
          'div',
          {
            className: props.className,
            ref: ref,
            onScroll: function (event) {
              setScrollTop(event.currentTarget.scrollTop)
            },
          },
          props.empty,
        )
      }

      var total = items.length * rowHeight
      var start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
      var end = Math.min(items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan)
      var slice = items.slice(start, end)

      return h(
        'div',
        {
          className: props.className,
          ref: ref,
          onScroll: function (event) {
            setScrollTop(event.currentTarget.scrollTop)
          },
        },
        h(
          'div',
          { className: 'mu-vlist-inner', style: { height: total + 'px' } },
          slice.map(function (item, offset) {
            var index = start + offset
            return h(
              'div',
              {
                key: props.itemKey ? props.itemKey(item, index) : index,
                className: 'mu-vlist-row',
                style: { height: rowHeight + 'px', top: index * rowHeight + 'px' },
              },
              props.renderRow(item),
            )
          }),
        ),
      )
    }

    /**
     * Cover grid for the song list. Virtualised by row: the column count comes
     * from the measured width, so the grid reflows without a fixed card size.
     */
    function TrackGrid(props) {
      var items = Array.isArray(props.items) ? props.items : []
      var gap = 14
      var minCard = 148
      var [width, setWidth] = useState(0)
      var [scrollTop, setScrollTop] = useState(0)
      var ref = useRef(null)

      useEffect(function () {
        var el = ref.current
        if (el === null) return undefined
        function measure() {
          setWidth(el.clientWidth || 0)
        }
        measure()
        window.addEventListener('resize', measure)
        var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
        if (observer !== null) observer.observe(el)
        return function () {
          window.removeEventListener('resize', measure)
          if (observer !== null) observer.disconnect()
        }
      }, [])

      useEffect(function () {
        if (ref.current !== null) ref.current.scrollTop = 0
        setScrollTop(0)
      }, [items.length, props.resetKey])

      if (items.length === 0) {
        return h(
          'div',
          {
            className: 'mu-grid',
            ref: ref,
            onScroll: function (event) {
              setScrollTop(event.currentTarget.scrollTop)
            },
          },
          props.empty,
        )
      }

      var usable = Math.max(0, width - 32)
      var cols = Math.max(2, Math.floor((usable + gap) / (minCard + gap)))
      var cardWidth = Math.max(96, Math.floor((usable - gap * (cols - 1)) / cols))
      var rowHeight = cardWidth + 64
      var rows = Math.ceil(items.length / cols)
      var viewport = ref.current !== null ? ref.current.clientHeight || 600 : 600
      var start = Math.max(0, Math.floor(scrollTop / rowHeight) - 2)
      var end = Math.min(rows, Math.ceil((scrollTop + viewport) / rowHeight) + 2)

      var rowsOut = []
      for (var r = start; r < end; r += 1) {
        var slice = items.slice(r * cols, r * cols + cols)
        rowsOut.push(
          h(
            'div',
            {
              key: 'row-' + r,
              className: 'mu-grid-row',
              style: {
                top: r * rowHeight + 'px',
                gridTemplateColumns: 'repeat(' + cols + ', minmax(0, 1fr))',
              },
            },
            slice.map(function (track) {
              var isSelected = props.selected.indexOf(track.path) >= 0
              var isFavorite = props.isFavorite(track)
              var isCurrent = props.currentPath !== '' && props.currentPath === track.path
              return h(
                'div',
                {
                  key: track.path,
                  className:
                    'mu-card' +
                    (isSelected ? ' is-selected' : '') +
                    (isCurrent ? ' is-current' : ''),
                  onClick: function () {
                    props.onSelect(track)
                  },
                  onDoubleClick: function () {
                    props.onActivate(track)
                  },
                  onContextMenu: function (event) {
                    event.preventDefault()
                    event.stopPropagation()
                    props.onContextMenu(track, event.clientX, event.clientY)
                  },
                },
                h(
                  'div',
                  { className: 'mu-card-cover' },
                  h(Cover, { track: track, size: cardWidth, radius: 10 }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-card-play',
                      title: t('page.play'),
                      onClick: function (event) {
                        event.stopPropagation()
                        props.onActivate(track)
                      },
                    },
                    icon(isCurrent && props.playing ? 'pause' : 'play', 22),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-card-fav' + (isFavorite ? ' is-on' : ''),
                      title: t('page.favorite'),
                      onClick: function (event) {
                        event.stopPropagation()
                        props.onToggleFavorite(track)
                      },
                    },
                    icon('heart', 14),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-card-check' + (isSelected ? ' is-on' : ''),
                      'aria-label': track.title,
                      onClick: function (event) {
                        event.stopPropagation()
                        props.onToggleSelect(track)
                      },
                    },
                    isSelected ? icon('check', 12) : null,
                  ),
                ),
                h('div', { className: 'mu-card-title mu-ellipsis' }, track.title),
                h('div', { className: 'mu-card-artist mu-ellipsis' }, track.artist || ''),
              )
            }),
          ),
        )
      }

      return h(
        'div',
        {
          className: 'mu-grid',
          ref: ref,
          onScroll: function (event) {
            setScrollTop(event.currentTarget.scrollTop)
          },
        },
        h('div', { className: 'mu-vlist-inner', style: { height: rows * rowHeight + 'px' } }, rowsOut),
      )
    }

    // ── listening statistics (NetEase-style listening ranking) ────────────

    function basenameOf(path) {
      var parts = String(path || '').split(/[\\/]/)
      return parts.length > 0 ? parts[parts.length - 1] : String(path || '')
    }

    function fmtListenTime(seconds) {
      var total = Math.round(Number(seconds) || 0)
      if (total <= 0) return '—'
      var hours = Math.floor(total / 3600)
      var minutes = Math.floor((total % 3600) / 60)
      if (hours > 0) return hours + ' 小时 ' + minutes + ' 分'
      if (minutes > 0) return minutes + ' 分'
      return total + ' 秒'
    }

    function fmtRecent(ts) {
      var value = Number(ts)
      if (!isFinite(value) || value <= 0) return '—'
      var date = new Date(value)
      var now = new Date()
      var startOfDay = function (day) {
        return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
      }
      var days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
      if (days <= 0) return '今天'
      if (days === 1) return '昨天'
      if (days < 7) return days + ' 天前'
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
    }

    /**
     * Listening ranking: last week / month / all time, sorted by time, plays or
     * recency. Mirrors the NetEase "listening ranking" page, limited to what
     * the local library can know without a server.
     */
    function StatsView(props) {
      var t = props.t
      var [range, setRange] = useState('week')
      var [mode, setMode] = useState('ranking')
      var [sortBy, setSortBy] = useState('seconds')
      var [loading, setLoading] = useState(true)
      var [error, setError] = useState(null)
      var [rows, setRows] = useState([])
      var [reload, setReload] = useState(0)

      useEffect(
        function () {
          var alive = true
          setLoading(true)
          setError(null)
          getJson(API + 'stats?range=' + encodeURIComponent(range))
            .then(function (body) {
              if (!alive) return
              var map = body.tracks !== null && typeof body.tracks === 'object' ? body.tracks : {}
              var list = []
              Object.keys(map).forEach(function (path) {
                var stat = map[path]
                var track = props.trackByPath[path] || null
                var seconds = Number(stat.playSeconds) || 0
                var plays = Number(stat.plays) || 0
                if (seconds <= 0 && plays <= 0) return
                list.push({
                  path: path,
                  track: track,
                  title: track ? track.title : basenameOf(path),
                  artist: track ? track.artist || '' : '',
                  seconds: seconds,
                  plays: plays,
                  lastPlayedAt: Number(stat.lastPlayedAt) || 0,
                  missing: track === null,
                })
              })
              setRows(list)
              setLoading(false)
            })
            .catch(function (cause) {
              if (!alive) return
              setError(cause && cause.message ? cause.message : String(cause))
              setLoading(false)
            })
          return function () {
            alive = false
          }
        },
        [range, reload],
      )

      var sorted = useMemo(
        function () {
          var list = rows.slice()
          list.sort(function (left, right) {
            if (mode === 'recent') return right.lastPlayedAt - left.lastPlayedAt
            if (sortBy === 'recent') return right.lastPlayedAt - left.lastPlayedAt
            if (sortBy === 'plays') return right.plays - left.plays || right.seconds - left.seconds
            return right.seconds - left.seconds || right.plays - left.plays
          })
          return list
        },
        [rows, sortBy, mode],
      )

      var totals = useMemo(
        function () {
          var seconds = 0
          var plays = 0
          rows.forEach(function (row) {
            seconds += row.seconds
            plays += row.plays
          })
          return { seconds: seconds, plays: plays, tracks: rows.length }
        },
        [rows],
      )

      var ranges = [
        ['week', t('stats.rangeWeek')],
        ['month', t('stats.rangeMonth')],
        ['all', t('stats.rangeAll')],
      ]
      var sorts = [
        ['seconds', t('stats.sortTime')],
        ['plays', t('stats.sortPlays')],
        ['recent', t('stats.sortRecent')],
      ]
      var modes = [
        ['ranking', t('stats.modeRanking')],
        ['recent', t('stats.modeRecent')],
      ]

      return h(
        'div',
        { className: 'mu-stats' },
        h(
          'div',
          { className: 'mu-stats-toolbar' },
          modes.map(function (entry) {
            return h(
              'button',
              {
                key: entry[0],
                type: 'button',
                className: 'mu-chip mu-stats-chip' + (mode === entry[0] ? ' is-on' : ''),
                onClick: function () {
                  setMode(entry[0])
                  if (entry[0] === 'recent') setRange('all')
                },
              },
              entry[1],
            )
          }),
          h('span', { className: 'mu-stats-divider' }),
          ranges.map(function (entry) {
            return h(
              'button',
              {
                key: entry[0],
                type: 'button',
                className: 'mu-chip mu-stats-chip' + (range === entry[0] ? ' is-on' : ''),
                onClick: function () {
                  setRange(entry[0])
                },
              },
              entry[1],
            )
          }),
          h('span', { className: 'mu-stats-divider' }),
          sorts.map(function (entry) {
            return h(
              'button',
              {
                key: entry[0],
                type: 'button',
                className: 'mu-chip mu-stats-chip' + (sortBy === entry[0] ? ' is-on' : ''),
                onClick: function () {
                  setSortBy(entry[0])
                },
              },
              entry[1],
            )
          }),
        ),
        h(
          'div',
          { className: 'mu-stats-summary' },
          h(
            'div',
            { className: 'mu-stats-card' },
            h('div', { className: 'mu-stats-card-label' }, t('stats.totalTime')),
            h('div', { className: 'mu-stats-card-value' }, fmtListenTime(totals.seconds)),
          ),
          h(
            'div',
            { className: 'mu-stats-card' },
            h('div', { className: 'mu-stats-card-label' }, t('stats.totalPlays')),
            h('div', { className: 'mu-stats-card-value' }, String(totals.plays)),
          ),
          h(
            'div',
            { className: 'mu-stats-card' },
            h('div', { className: 'mu-stats-card-label' }, t('stats.trackCount')),
            h('div', { className: 'mu-stats-card-value' }, String(totals.tracks)),
          ),
        ),
        loading
          ? h('div', { className: 'mu-state' }, h('div', { className: 'mu-spinner' }), t('stats.loading'))
          : error !== null
            ? h(
                'div',
                { className: 'mu-state' },
                h('div', { className: 'mu-state-title' }, t('stats.loadFailed')),
                h('div', { className: 'mu-state-sub' }, error),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-btn',
                    onClick: function () {
                      setReload(reload + 1)
                    },
                  },
                  t('stats.retry'),
                ),
              )
            : sorted.length === 0
              ? h('div', { className: 'mu-state' }, h('div', { className: 'mu-state-sub' }, t('stats.empty')))
              : h(
                  'div',
                  { className: 'mu-stats-list' },
                  sorted.map(function (row) {
                    return h(
                      'div',
                      { className: 'mu-stats-row', key: row.path, title: row.path },
                      h(Cover, { track: row.track, size: 36, radius: 6 }),
                      h(
                        'div',
                        { className: 'mu-stats-main' },
                        h('div', { className: 'mu-stats-title' }, row.title),
                        h(
                          'div',
                          { className: 'mu-stats-artist' },
                          row.artist || (row.missing ? t('stats.unavailable') : ''),
                        ),
                      ),
                      h('div', { className: 'mu-stats-seconds' }, fmtListenTime(row.seconds)),
                      h('div', { className: 'mu-stats-plays' }, t('stats.plays', { n: row.plays })),
                      h('div', { className: 'mu-stats-last' }, fmtRecent(row.lastPlayedAt)),
                    )
                  }),
                ),
      )
    }

    function MusicPanel() {
      var prefs = useRef(readPrefs()).current
      var [snap, setSnap] = useState(player.getSnapshot())
      var leaderNow = player.isLeader()
      var [config, setConfig] = useState(null)
      var [tracks, setTracks] = useState([])
      var [loading, setLoading] = useState(true)
      var [error, setError] = useState(null)
      var [warnings, setWarnings] = useState([])
      var [query, setQuery] = useState('')
      var [searchHistory, setSearchHistory] = useState(function () {
        try {
          var raw = window.localStorage.getItem('dsh-music.search-history')
          var parsed = raw === null ? [] : JSON.parse(raw)
          return Array.isArray(parsed)
            ? parsed.filter(function (item) {
                return typeof item === 'string' && item !== ''
              }).slice(0, 8)
            : []
        } catch (error) {
          return []
        }
      })

      function pushSearchHistory(value) {
        var text = String(value || '').trim()
        if (text === '') return
        setSearchHistory(function (previous) {
          var next = [text]
            .concat(
              previous.filter(function (item) {
                return item !== text
              }),
            )
            .slice(0, 8)
          try {
            window.localStorage.setItem('dsh-music.search-history', JSON.stringify(next))
          } catch (error) {
            // Private mode: history stays in memory.
          }
          return next
        })
      }
      var [searchOpen, setSearchOpen] = useState(false)
      var [sortBy, setSortBy] = useState(prefs.sortBy || 'title')
      var [sortDir, setSortDir] = useState(prefs.sortDir === 'desc' ? 'desc' : 'asc')
      var [sortOpen, setSortOpen] = useState(false)
      var [selected, setSelected] = useState([])
      var [viewMode, setViewMode] = useState(function () {
        return readPrefs().viewMode === 'grid' ? 'grid' : 'list'
      })
      var [queueOpen, setQueueOpen] = useState(queueOverlaySnapshot())
      useEffect(function () {
        return subscribeQueueOverlay(function () {
          setQueueOpen(queueOverlaySnapshot())
        })
      }, [])
      useEffect(
        function () {
          if (ctxMenu === null) return undefined
          function onKey(event) {
            if (event.key === 'Escape') setCtxMenu(null)
          }
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('keydown', onKey)
          }
        },
        [ctxMenu],
      )
      var [ctxMenu, setCtxMenu] = useState(null)
      var [addToOpen, setAddToOpen] = useState(false)
      var [infoPath, setInfoPath] = useState(null)
      var [newPlaylistOpen, setNewPlaylistOpen] = useState(false)
      var [newPlaylistName, setNewPlaylistName] = useState('')
      var [tagEditPath, setTagEditPath] = useState(null)
      var [tagForm, setTagForm] = useState(null)
      var [tagSaving, setTagSaving] = useState(false)
      var [coverFailed, setCoverFailed] = useState(false)
      var [tagCoverPreview, setTagCoverPreview] = useState(null)
      var [matchField, setMatchField] = useState(null)
      var [onlineOpen, setOnlineOpen] = useState(false)
      var [onlineLoading, setOnlineLoading] = useState(false)
      var [onlineResults, setOnlineResults] = useState([])
      var [onlineSources, setOnlineSources] = useState([])
      var TAG_BASIC_ROWS = [
        ['title', 'page.metaTitle'],
        ['artist', 'page.artist'],
        ['album', 'page.album'],
        ['albumArtist', 'page.albumArtist'],
        ['year', 'page.year'],
        ['genre', 'page.genre'],
      ]
      var TAG_DETAIL_ROWS = [
        ['track', 'page.trackNo'],
        ['disc', 'page.discNo'],
        ['composer', 'page.composer'],
        ['lyricist', 'page.lyricist'],
        ['comment', 'page.comment'],
      ]
      var playlistTitleRef = useRef(null)
      var [moreOpen, setMoreOpen] = useState(false)
      var [toast, setToast] = useState('')
      var toastTimerRef = useRef(null)
      var [npOpen, setNpOpen] = useState(false)
      var [npVisible, setNpVisible] = useState(false)
      var npAnimRef = useRef(null)
      var [view, setView] = useState('songs')
      var [playlists, setPlaylists] = useState([])
      var [favorites, setFavorites] = useState([])
      var [playlistId, setPlaylistId] = useState(null)
      var [playlistDraft, setPlaylistDraft] = useState('')
      var [prefsOpen, setPrefsOpen] = useState(false)
      var [prefsTab, setPrefsTab] = useState('appearance')
      var [prefsUi, setPrefsUi] = useState(function () {
        return readPrefs()
      })

      /** Persist one preference from the in-panel settings popover. */
      function updatePref(key, value) {
        var patch = {}
        patch[key] = value
        savePrefs(patch)
        setPrefsUi(readPrefs())
      }

      // Music library folders live here now that the settings section is gone.
      var [roots, setRoots] = useState([])
      var [depth, setDepth] = useState(4)
      var [configSaving, setConfigSaving] = useState(false)
      var [configSaved, setConfigSaved] = useState(false)
      var [configError, setConfigError] = useState(null)

      useEffect(
        function () {
          getJson(API + 'config')
            .then(function (body) {
              var loadedRoots = Array.isArray(body.config.roots) ? body.config.roots.slice() : []
              rootsRef.current = loadedRoots
              depthRef.current = body.config.depth
              setRoots(loadedRoots)
              setDepth(body.config.depth)
            })
            .catch(function () {})
        },
        [],
      )

      // Latest library values for the debounced save: React state is stale
      // inside the timer callback, which used to submit an empty root list.
      var rootsRef = useRef([])
      var depthRef = useRef(4)

      function setRootsNow(next) {
        rootsRef.current = next
        setRoots(next)
      }

      function setDepthNow(next) {
        depthRef.current = next
        setDepth(next)
      }

      function saveConfig() {
        setConfigSaving(true)
        setConfigError(null)
        postJson(API + 'config', { roots: rootsRef.current, depth: depthRef.current })
          .then(function (body) {
            var savedRoots = body.config.roots.slice()
            rootsRef.current = savedRoots
            depthRef.current = body.config.depth
            setRoots(savedRoots)
            setDepth(body.config.depth)
            setConfigSaving(false)
            setConfigSaved(true)
            try {
              window.dispatchEvent(new CustomEvent(CONFIG_EVENT))
            } catch (eventError) {
              window.dispatchEvent(new Event(CONFIG_EVENT))
            }
          })
          .catch(function (failure) {
            setConfigSaving(false)
            setConfigError(String((failure && failure.message) || failure))
          })
      }

      // Library edits auto-save; the explicit save button is gone.
      var saveTimer = useRef(null)
      var [deleteRoot, setDeleteRoot] = useState(null)

      function scheduleSave() {
        if (saveTimer.current !== null) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(function () {
          saveTimer.current = null
          saveConfig()
        }, 500)
      }

      useEffect(function () {
        return function () {
          if (saveTimer.current !== null) clearTimeout(saveTimer.current)
        }
      }, [])

      function pickFolder() {
        var input = pickerRef.current
        if (input === null) return
        input.value = ''
        input.click()
      }

      // In-plugin folder browser: browser file APIs cannot hand us absolute
      // paths in this Electron build, so the host lists directories instead.
      var [browseOpen, setBrowseOpen] = useState(false)
      var [browsePath, setBrowsePath] = useState('')
      var [browseParent, setBrowseParent] = useState(null)
      var [browseDirs, setBrowseDirs] = useState([])
      var [browseLoading, setBrowseLoading] = useState(false)

      function loadBrowse(target) {
        setBrowseLoading(true)
        getJson(API + 'browse?path=' + encodeURIComponent(target || ''))
          .then(function (body) {
            setBrowsePath(body.path)
            setBrowseParent(body.parent)
            setBrowseDirs(Array.isArray(body.dirs) ? body.dirs : [])
            setBrowseLoading(false)
          })
          .catch(function (failure) {
            setBrowseLoading(false)
            setConfigError(String((failure && failure.message) || failure))
          })
      }

      function openBrowse() {
        setBrowseOpen(true)
        loadBrowse(roots.length > 0 ? roots[0] : '')
      }

      function chooseBrowsePath() {
        if (browsePath === '') return
        if (rootsRef.current.indexOf(browsePath) < 0) {
          setRootsNow(rootsRef.current.concat([browsePath]))
        }
        setBrowseOpen(false)
        scheduleSave()
      }

      function removeRootAt(index) {
        setRootsNow(
          rootsRef.current.filter(function (_entry, position) {
            return position !== index
          }),
        )
        setDeleteRoot(null)
        scheduleSave()
      }
      var [deleteConfirm, setDeleteConfirm] = useState(false)

      useEffect(
        function () {
          reloadPlaylists()
          reloadFavorites()
        },
        [],
      )
      var npTimerRef = useRef(null)

      var current = snap.index >= 0 && snap.queue[snap.index] ? snap.queue[snap.index] : null

      function openNowPlaying() {
        if (current === null) return
        if (npTimerRef.current !== null) {
          window.clearTimeout(npTimerRef.current)
          npTimerRef.current = null
        }
        if (npAnimRef.current !== null) {
          try {
            npAnimRef.current.cancel()
          } catch (error) {
            // Already finished.
          }
          npAnimRef.current = null
        }
        var barEl = document.querySelector('.mu-bar')
        if (barEl !== null) {
          barEl.getAnimations().forEach(function (item) {
            item.cancel()
          })
        }
        setNpOpen(true)
        setNpVisible(true)
        // Mature players (Spotify, YesPlayMusic, YouTube Music) slide the
        // full-screen view up from the bottom instead of morphing DOM nodes:
        // no measurement, no clones, nothing to misalign.
        window.requestAnimationFrame(function () {
          var page = document.querySelector('.mu-np')
          if (page === null) return
          page.style.transform = 'translateY(100%)'
          page.style.opacity = '0'
          window.requestAnimationFrame(function () {
            if (typeof page.animate !== 'function') {
              page.style.transform = ''
              page.style.opacity = ''
              return
            }
            page.style.transform = ''
            page.style.opacity = ''
            npAnimRef.current = page.animate(
              [
                { transform: 'translateY(100%)', opacity: 0 },
                { transform: 'translateY(0%)', opacity: 1 },
              ],
              { duration: 380, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' },
            )
            if (barEl !== null && typeof barEl.animate === 'function') {
              barEl.animate(
                [
                  { opacity: 1, transform: 'translateY(0px)' },
                  { opacity: 0, transform: 'translateY(10px)' },
                ],
                { duration: 240, easing: 'ease-out', fill: 'both' },
              )
            }
          })
        })
      }

      function closeNowPlaying() {
        var page = document.querySelector('.mu-np')
        var bar = document.querySelector('.mu-bar')
        var finished = false
        function finish() {
          if (finished) return
          finished = true
          npAnimRef.current = null
          setNpVisible(false)
          setNpOpen(false)
          if (page !== null) {
            page.getAnimations().forEach(function (item) {
              item.cancel()
            })
            page.style.transform = ''
            page.style.opacity = ''
          }
          if (bar !== null) {
            bar.getAnimations().forEach(function (item) {
              item.cancel()
            })
          }
        }
        if (page === null || typeof page.animate !== 'function') {
          finish()
          return
        }
        if (npAnimRef.current !== null) {
          try {
            npAnimRef.current.cancel()
          } catch (error) {
            // Already finished.
          }
          npAnimRef.current = null
        }
        page.getAnimations().forEach(function (item) {
          item.cancel()
        })
        page.style.transform = ''
        page.style.opacity = ''
        npAnimRef.current = page.animate(
          [
            { transform: 'translateY(0%)', opacity: 1 },
            { transform: 'translateY(100%)', opacity: 0.85 },
          ],
          { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' },
        )
        if (bar !== null && typeof bar.animate === 'function') {
          bar.animate(
            [
              { opacity: 0, transform: 'translateY(10px)' },
              { opacity: 1, transform: 'translateY(0px)' },
            ],
            { duration: 280, delay: 140, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' },
          )
        }
        npAnimRef.current.finished.then(finish, finish)
      }

      useEffect(
        function () {
          return player.subscribe(function () {
            setSnap(player.getSnapshot())
          })
        },
        [],
      )

      useEffect(
        function () {
          savePrefs({ sortBy: sortBy, sortDir: sortDir })
        },
        [sortBy, sortDir],
      )

      function showToast(text) {
        setToast(text)
        if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = window.setTimeout(function () {
          setToast('')
          toastTimerRef.current = null
        }, 1600)
      }

      var load = useCallback(function (refresh) {
        setLoading(true)
        setError(null)
        return getJson(API + 'config')
          .then(function (body) {
            setConfig(body.config)
            return getJson(API + 'library' + (refresh ? '?refresh=1' : ''))
          })
          .then(function (body) {
            var list = Array.isArray(body.tracks) ? body.tracks : []
            setTracks(list)
            setWarnings(Array.isArray(body.warnings) ? body.warnings : [])
            setLoading(false)
            if (player.getSnapshot().queue.length === 0 && list.length > 0) {
              player.setQueue(list)
            }
          })
          .catch(function (failure) {
            setError(String((failure && failure.message) || failure))
            setLoading(false)
          })
      }, [])

      useEffect(
        function () {
          load(false)
        },
        [load],
      )

      useEffect(
        function () {
          function onChanged() {
            load(true)
          }
          window.addEventListener(CONFIG_EVENT, onChanged)
          return function () {
            window.removeEventListener(CONFIG_EVENT, onChanged)
          }
        },
        [load],
      )

      function cycleLoop() {
        cyclePlayMode(snap)
      }

      function loopLabel() {
        return playModeLabel(playModeOf(snap))
      }

      function toggleSelect(track) {
        setSelected(function (list) {
          if (list.indexOf(track.path) >= 0) {
            return list.filter(function (path) {
              return path !== track.path
            })
          }
          return list.concat([track.path])
        })
      }

      function toggleViewMode() {
        var next = viewMode === 'grid' ? 'list' : 'grid'
        setViewMode(next)
        savePrefs({ viewMode: next })
      }

      function activate(track) {
        player.ensureAnalyser()
        var at = sortedCollection.findIndex(function (item) {
          return item.path === track.path
        })
        if (at < 0) return
        // Queue the whole playlist (ignores the search filter), starting here.
        player.playList(sortedCollection, at)
      }

      function clearList() {
        player.clear()
        setTracks([])
        setSelected([])
      }

      function copyPath(track) {
        var snapNow = player.getSnapshot()
        var fallback = snapNow.index >= 0 ? snapNow.queue[snapNow.index] : null
        var target = track && track.path ? track : fallback
        if (!target) return
        try {
          navigator.clipboard.writeText(target.path).then(
            function () {
              showToast(t('page.copied'))
            },
            function () {
              showToast(target.path)
            },
          )
        } catch (error) {
          showToast(target.path)
        }
      }

      function revealTrack(track) {
        if (!track) return
        requestJson('POST', API + 'reveal', { path: track.path })
          .then(function () {
            showToast(t('page.revealed'))
          })
          .catch(function (error) {
            showToast(String((error && error.message) || error))
          })
      }

      function createPlaylistWithSelection() {
        var paths = selectedTracks.map(function (track) {
          return track.path
        })
        if (paths.length === 0) return
        requestJson('POST', API + 'playlists', { name: '' })
          .then(function (body) {
            return patchPlaylist(body.playlist.id, { add: paths })
          })
          .then(function () {
            showToast(t('page.addedCount', { n: paths.length }))
          })
          .catch(function (error) {
            showToast(String((error && error.message) || error))
          })
      }

      function openTagEditor(path) {
        setTagEditPath(path)
        setTagForm(null)
        setCoverFailed(false)
        setTagCoverPreview(null)
        setMatchField(null)
        setOnlineOpen(false)
        setOnlineResults([])
        setOnlineSources([])
        getJson(API + 'tags?path=' + encodeURIComponent(path))
          .then(function (body) {
            setTagForm(Object.assign({}, body.tags))
          })
          .catch(function (error) {
            setTagEditPath(null)
            showToast(String((error && error.message) || error))
          })
      }

      function closeTagEditor() {
        if (tagSaving) return
        setTagEditPath(null)
        setTagForm(null)
        setOnlineOpen(false)
      }

      function searchOnlineForTags() {
        if (tagForm === null || onlineLoading) return
        setOnlineOpen(true)
        setOnlineLoading(true)
        setOnlineResults([])
        setOnlineSources([])
        requestJson('POST', API + 'online-search', {
          title: tagForm.title || '',
          artist: tagForm.artist || '',
          album: tagForm.album || '',
        })
          .then(function (body) {
            setOnlineResults(Array.isArray(body.results) ? body.results : [])
            setOnlineSources(Array.isArray(body.sources) ? body.sources : [])
            setOnlineLoading(false)
          })
          .catch(function (error) {
            setOnlineLoading(false)
            showToast(String((error && error.message) || error))
          })
      }

      function tagFieldLabel(field) {
        var rows = TAG_BASIC_ROWS.concat(TAG_DETAIL_ROWS)
        for (var i = 0; i < rows.length; i += 1) {
          if (rows[i][0] === field) return t(rows[i][1])
        }
        return field
      }

      function applyOnlineResult(item) {
        if (matchField !== null) {
          var field = matchField
          if (item[field]) {
            setTagForm(function (previous) {
              if (previous === null) return previous
              return Object.assign({}, previous, { [field]: item[field] })
            })
          }
          setOnlineOpen(false)
          setMatchField(null)
          return
        }
        setTagForm(function (previous) {
          if (previous === null) return previous
          var next = Object.assign({}, previous)
          if (item.title) next.title = item.title
          if (item.artist) next.artist = item.artist
          if (item.album) next.album = item.album
          if (item.year) next.year = item.year
          if (item.track) next.track = item.track
          if (item.disc) next.disc = item.disc
          if (item.genre) next.genre = item.genre
          return next
        })
        if (item.coverUrl) {
          setTagCoverPreview(item.coverUrl)
          setCoverFailed(false)
        }
        setOnlineOpen(false)
      }

      function saveTagEditor() {
        if (tagEditPath === null || tagForm === null || tagSaving) return
        setTagSaving(true)
        var snapNow = player.getSnapshot()
        var playingThis =
          snapNow.index >= 0 && snapNow.queue[snapNow.index] && snapNow.queue[snapNow.index].path === tagEditPath
        if (playingThis) player.suspend()
        requestJson('PUT', API + 'tags', {
          path: tagEditPath,
          tags: tagForm,
          coverUrl: tagCoverPreview || '',
        })
          .then(function () {
            showToast(t('page.metaSaved'))
            setTagSaving(false)
            setTagEditPath(null)
            setTagForm(null)
            return load(true)
          })
          .catch(function (error) {
            setTagSaving(false)
            showToast(String((error && error.message) || error))
          })
      }

      function renderTagField(key, labelKey) {
        return h(
          'label',
          { className: 'mu-tag-field', key: key },
          h(
            'span',
            { className: 'mu-tag-field-head' },
            h('span', { className: 'mu-tag-label' }, t(labelKey)),
            h(
              'button',
              {
                type: 'button',
                className: 'mu-tag-field-search',
                title: t('page.matchField'),
                onClick: function (event) {
                  event.preventDefault()
                  event.stopPropagation()
                  setMatchField(key)
                  searchOnlineForTags()
                },
              },
              icon('search', 11),
            ),
          ),
          h('input', {
            type: 'text',
            className: 'mu-input',
            value: tagForm[key] || '',
            onChange: function (event) {
              var value = event.target.value
              setTagForm(function (previous) {
                return Object.assign({}, previous, { [key]: value })
              })
            },
          }),
        )
      }

      var trackByPath = useMemo(function () {
        var map = {}
        tracks.forEach(function (track) {
          map[track.path] = track
        })
        return map
      }, [tracks])

      var activePlaylist = useMemo(function () {
        return playlists.find(function (item) {
          return item.id === playlistId
        })
      }, [playlists, playlistId])

      var favoritePaths = useMemo(
        function () {
          var set = {}
          favorites.forEach(function (entry) {
            set[entry.path] = true
          })
          return set
        },
        [favorites],
      )

      /** The collection the active tab shows: all songs, favourites, or one playlist. */
      var collectionTracks = useMemo(function () {
        if (view === 'favorites') {
          return favorites
            .map(function (entry) {
              return trackByPath[entry.path]
            })
            .filter(Boolean)
        }
        if (view !== 'playlists' || activePlaylist === undefined) return tracks
        return activePlaylist.trackPaths
          .map(function (path) {
            return trackByPath[path]
          })
          .filter(Boolean)
      }, [view, activePlaylist, tracks, trackByPath, favorites])

      useEffect(
        function () {
          if (!sortOpen) return undefined
          function onPointerDown(event) {
            var target = event.target
            if (target !== null && typeof target.closest === 'function') {
              if (target.closest('.mu-menu-sort') !== null) return
              if (target.closest('[data-sort-toggle]') !== null) return
            }
            setSortOpen(false)
          }
          document.addEventListener('mousedown', onPointerDown)
          return function () {
            document.removeEventListener('mousedown', onPointerDown)
          }
        },
        [sortOpen],
      )

      useEffect(
        function () {
          if (!prefsOpen) return undefined
          function onPointerDown(event) {
            var target = event.target
            if (target !== null && typeof target.closest === 'function') {
              if (target.closest('.mu-prefs-panel, .mu-prefs') !== null) return
              if (target.closest('[data-prefs-toggle]') !== null) return
            }
            setPrefsOpen(false)
          }
          document.addEventListener('mousedown', onPointerDown)
          return function () {
            document.removeEventListener('mousedown', onPointerDown)
          }
        },
        [prefsOpen],
      )

      useEffect(
        function () {
          if (!deleteConfirm) return undefined
          function onPointerDown(event) {
            var target = event.target
            if (target !== null && typeof target.closest === 'function') {
              if (target.closest('.mu-confirm') !== null) return
              if (target.closest('[data-delete-toggle]') !== null) return
            }
            setDeleteConfirm(false)
          }
          document.addEventListener('mousedown', onPointerDown)
          return function () {
            document.removeEventListener('mousedown', onPointerDown)
          }
        },
        [deleteConfirm],
      )

      // Full collection in display order (search is a filter on top of it).
      // Double-clicking a song queues this whole playlist, not just the
      // filtered results, which is what desktop players do.
      var sortedCollection = useMemo(
        function () {
          // "Liked" is ordered by when it was liked (newest first) unless the
          // user picks another sort, matching NetEase/Spotify liked songs.
          if (view === 'favorites' && sortBy === 'title' && sortDir === 'asc') {
            return collectionTracks
          }
          var direction = sortDir === 'desc' ? -1 : 1
          var keyed = collectionTracks.map(function (track, position) {
            return { track: track, position: position }
          })
          keyed.sort(function (left, right) {
            var a = left.track
            var b = right.track
            var aValue = sortValueOf(a, sortBy)
            var bValue = sortValueOf(b, sortBy)
            var compared =
              typeof aValue === 'number' && typeof bValue === 'number'
                ? aValue - bValue
                : String(aValue).localeCompare(String(bValue), LANG)
            if (compared === 0) compared = left.position - right.position
            return compared * direction
          })
          return keyed.map(function (entry) {
            return entry.track
          })
        },
        [collectionTracks, sortBy, sortDir, view],
      )

      var visible = useMemo(
        function () {
          var needles = query
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
          if (needles.length === 0) return sortedCollection
          return sortedCollection.filter(function (track) {
            // Search across metadata, folder/path and pinyin (full + initials),
            // the way desktop players let you type "zhoujielun" / "zjl".
            var haystack = [
              track.title,
              track.artist,
              track.album,
              track.name,
              track.folder,
              track.path,
              track.py,
              track.pyf,
            ]
              .map(function (part) {
                return String(part || '').toLowerCase()
              })
              .join('\n')
            return needles.every(function (needle) {
              return haystack.indexOf(needle) >= 0
            })
          })
        },
        [sortedCollection, query],
      )

      var selectedSet = useMemo(function () {
        var set = {}
        selected.forEach(function (path) {
          set[path] = true
        })
        return set
      }, [selected])

      var selectedTracks = useMemo(
        function () {
          return visible.filter(function (track) {
            return selectedSet[track.path] === true
          })
        },
        [visible, selectedSet],
      )


      var total = collectionTracks.length

      var emptyState = [
        loading && tracks.length === 0
          ? h('div', { className: 'mu-state' }, h('div', { className: 'mu-spinner' }), t('page.scanning'))
          : null,
        !loading && error !== null
          ? h(
              'div',
              { className: 'mu-state' },
              h('div', { className: 'mu-state-title' }, t('page.loadFailed')),
              h('div', { className: 'mu-state-sub' }, error),
              h(
                'button',
                { type: 'button', className: 'mu-btn', onClick: function () { load(true) } },
                t('page.retry'),
              ),
            )
          : null,
        !loading && error === null && total === 0
          ? h(
              'div',
              { className: 'mu-state' },
              icon(view === 'favorites' ? 'heart' : 'folder', 34),
              h(
                'div',
                { className: 'mu-state-title' },
                view === 'favorites' ? t('page.favoritesEmpty') : t('page.emptyTitle'),
              ),
              h(
                'div',
                { className: 'mu-state-sub' },
                view === 'favorites'
                  ? t('page.favoritesHint')
                  : config !== null && config.roots && config.roots.length > 0
                    ? t('page.emptyFolder')
                    : t('page.emptyHint'),
              ),
            )
          : null,
        !loading && error === null && total > 0 && visible.length === 0
          ? h('div', { className: 'mu-state' }, h('div', { className: 'mu-state-sub' }, t('page.noResults')))
          : null,
        warnings.length > 0
          ? h('div', { className: 'mu-warn' }, t('page.warnings') + '：' + warnings.slice(0, 3).join(' · '))
          : null,
      ]

      function renderRow(track) {
        var isCurrent = current !== null && current.path === track.path
        var isSelected = selectedSet[track.path] === true
        return h(
          'div',
          {
            className: 'mu-row' + (isCurrent ? ' is-current' : '') + (isSelected ? ' is-selected' : ''),
            key: track.path,
            // Clicking the row selects just this track; the circle toggles
            // additively. Double click plays.
            onClick: function () {
              setSelected(function (previous) {
                if (previous.length === 1 && previous[0] === track.path) return []
                return [track.path]
              })
            },
            onDoubleClick: function () {
              activate(track)
            },
            onContextMenu: function (event) {
              event.preventDefault()
              event.stopPropagation()
              setMoreOpen(false)
              setCtxMenu({ x: event.clientX, y: event.clientY, path: track.path, mode: 'main' })
            },
          },
          h(
            'button',
            {
              type: 'button',
              className: 'mu-row-play',
              title: t('page.play'),
              onClick: function (event) {
                event.stopPropagation()
                activate(track)
              },
              onDoubleClick: function (event) {
                event.stopPropagation()
              },
            },
            h(Cover, { track: track, size: 60, radius: 8 }),
            h('span', { className: 'mu-row-playmask' }, icon(isCurrent && snap.playing ? 'pause' : 'play', 16)),
          ),
          h(
            'div',
            { className: 'mu-row-main' },
            h(
              'div',
              { className: 'mu-row-title' },
              isCurrent
                ? h(
                    'span',
                    { className: 'mu-eq' + (snap.playing ? ' is-playing' : ''), 'aria-hidden': 'true' },
                    h('i', null),
                    h('i', null),
                    h('i', null),
                  )
                : null,
              track.title,
            ),
            h(
              'div',
              { className: 'mu-row-sub' },
              track.artist ? h('span', { className: 'mu-cd' }, 'CD') : null,
              h('span', { className: 'mu-ellipsis' }, track.artist || t('page.unknownArtist')),
            ),
          ),
          h('div', { className: 'mu-row-album mu-ellipsis' }, track.album || ''),
          h('div', { className: 'mu-row-dur' }, fmtTime(track.durationSec)),
          h(
            'div',
            { className: 'mu-row-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'mu-icon-btn mu-icon-btn-sm mu-fav' + (favoritePaths[track.path] ? ' is-on' : ''),
                title: favoritePaths[track.path] ? t('page.unfavorite') : t('page.favorite'),
                onClick: function (event) {
                  event.stopPropagation()
                  toggleFavorite(track)
                },
              },
              icon('heart', 14),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mu-check' + (isSelected ? ' is-on' : ''),
                'aria-label': track.title,
                onClick: function (event) {
                  event.stopPropagation()
                  toggleSelect(track)
                },
              },
              isSelected ? icon('check', 14) : null,
            ),
          ),
        )
      }

      var sortOptions = [
        ['title', 'page.sortTitle'],
        ['name', 'page.sortName'],
        ['album', 'page.sortAlbum'],
        ['artist', 'page.sortArtist'],
        ['size', 'page.sortSize'],
        ['year', 'page.sortYear'],
        ['folder', 'page.sortFolder'],
        ['plays', 'page.sortPlays'],
        ['duration', 'page.sortDuration'],
        ['mtime', 'page.sortMtime'],
        ['addedAt', 'page.sortAdded'],
      ]

      /** Persist a playlist rename from the head title input. */
      function commitPlaylistName() {
        if (activePlaylist === undefined) return
        var name = playlistDraft.trim()
        if (name === '') {
          setPlaylistDraft(activePlaylist.name)
          return
        }
        if (name === activePlaylist.name) return
        patchPlaylist(activePlaylist.id, { name: name })
          .then(function () {
            setPlaylistDraft(name)
          })
          .catch(function (error) {
            setPlaylistDraft(activePlaylist.name)
            showToast(String((error && error.message) || error))
          })
      }

      function reloadPlaylists() {
        return getJson(API + 'playlists')
          .then(function (body) {
            setPlaylists(Array.isArray(body.playlists) ? body.playlists : [])
          })
          .catch(function () {
            // A missing store is not an error: playlists simply stay empty.
          })
      }

      function reloadFavorites() {
        return getJson(API + 'favorites')
          .then(function (body) {
            setFavorites(Array.isArray(body.favorites) ? body.favorites : [])
          })
          .catch(function () {
            // Favourites are optional; an old host simply returns none.
          })
      }

      function toggleFavorite(track) {
        if (!track) return
        requestJson('POST', API + 'favorites', { path: track.path })
          .then(function (body) {
            setFavorites(Array.isArray(body.favorites) ? body.favorites : [])
          })
          .catch(function (error) {
            showToast(String((error && error.message) || error))
          })
      }

      function requestJson(method, url, payload) {
        return fetch(url, {
          method: method,
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: payload === undefined ? undefined : JSON.stringify(payload),
        }).then(function (response) {
          return response
            .json()
            .catch(function () {
              return null
            })
            .then(function (body) {
              if (!response.ok || body === null || body.ok !== true) {
                throw new Error(
                  body !== null && body.error && body.error.message
                    ? body.error.message
                    : 'HTTP ' + response.status,
                )
              }
              return body
            })
        })
      }

      function autoPlaylistName() {
        var base = t('page.newPlaylist')
        var taken = {}
        playlists.forEach(function (item) {
          taken[item.name] = true
        })
        if (taken[base] !== true) return base
        var index = 2
        while (taken[base + ' ' + index] === true) index += 1
        return base + ' ' + index
      }

      function createPlaylist(name) {
        var finalName = String(name || '').trim() || autoPlaylistName()
        requestJson('POST', API + 'playlists', { name: finalName })
          .then(function (body) {
            setPlaylists(function (list) {
              return [body.playlist].concat(list)
            })
            setView('playlists')
            setPlaylistId(body.playlist.id)
            setPlaylistDraft(body.playlist.name)
            setDeleteConfirm(false)
            setNewPlaylistOpen(false)
          })
          .catch(function (error) {
            showToast(String((error && error.message) || error))
          })
      }

      function openPlaylist(id) {
        var target = playlists.find(function (item) {
          return item.id === id
        })
        if (target === undefined) return
        setPlaylistId(id)
        setPlaylistDraft(target.name)
        setView('playlists')
        setDeleteConfirm(false)
      }

      function patchPlaylist(id, patch) {
        return requestJson('PATCH', API + 'playlists/' + encodeURIComponent(id), patch).then(function (body) {
          setPlaylists(function (list) {
            return list.map(function (item) {
              return item.id === id ? body.playlist : item
            })
          })
          return body.playlist
        })
      }

      function removePlaylist(id) {
        requestJson('DELETE', API + 'playlists/' + encodeURIComponent(id))
          .then(function () {
            setPlaylists(function (list) {
              return list.filter(function (item) {
                return item.id !== id
              })
            })
            if (playlistId === id) setPlaylistId(null)
          })
          .catch(function (error) {
            showToast(String((error && error.message) || error))
          })
      }

      function addSelectedTo(id) {
        var paths = selectedTracks.map(function (track) {
          return track.path
        })
        if (paths.length === 0) return
        patchPlaylist(id, { add: paths })
          .then(function () {
            showToast(t('page.addedCount', { n: paths.length }))
          })
          .catch(function (error) {
            showToast(String((error && error.message) || error))
          })
      }

      var tagTrack = tagEditPath !== null ? trackByPath[tagEditPath] || null : null
      var tagFormat = tagTrack ? (tagTrack.codec || tagTrack.ext || '').toUpperCase() : ''
      var tagCoverUrl = tagEditPath !== null ? API + 'cover?path=' + encodeURIComponent(tagEditPath) : ''

      return h(
        'div',
        { className: 'mu-root' },
        moreOpen
          ? h('div', {
              className: 'mu-scrim',
              onClick: function () {
                setMoreOpen(false)
              },
            })
          : null,
        addToOpen
          ? h('div', {
              className: 'mu-addto-scrim',
              onClick: function () {
                setAddToOpen(false)
              },
            })
          : null,
        h(
          'div',
          { className: 'mu-head' },
          h(
            'div',
            { className: 'mu-head-title' },
            view === 'playlists' && activePlaylist !== undefined
              ? h('input', {
                  type: 'text',
                  ref: playlistTitleRef,
                  className: 'mu-input mu-title-input',
                  value: playlistDraft,
                  placeholder: t('page.playlistName'),
                  title: t('page.playlistName'),
                  onChange: function (event) {
                    setPlaylistDraft(event.target.value)
                  },
                  onFocus: function (event) {
                    event.target.select()
                  },
                  onBlur: commitPlaylistName,
                  onKeyDown: function (event) {
                    if (event.key === 'Enter') event.target.blur()
                  },
                })
              : h('span', { className: 'mu-title' }, t('page.tabSongs')),
            view === 'playlists' && activePlaylist !== undefined
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-icon-btn mu-icon-btn-sm',
                    title: t('page.playlistName'),
                    onClick: function () {
                      var input = playlistTitleRef.current
                      if (input !== null) {
                        input.focus()
                        input.select()
                      }
                    },
                  },
                  icon('edit', 14),
                )
              : null,
            h('span', { className: 'mu-count' }, loading ? '…' : String(visible.length)),
          ),
          h(
            'div',
            { className: 'mu-head-actions' },
            view === 'playlists' && activePlaylist !== undefined
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-icon-btn' + (deleteConfirm ? ' is-on' : ''),
                    title: t('page.delete'),
                    'data-delete-toggle': 'true',
                    onClick: function () {
                      setDeleteConfirm(!deleteConfirm)
                      setPrefsOpen(false)
                      setSortOpen(false)
                    },
                  },
                  icon('trash', 18),
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'mu-icon-btn',
                title: t('page.refresh'),
                onClick: function () {
                  load(true)
                },
              },
              icon('refresh', 18),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mu-icon-btn' + (sortOpen ? ' is-on' : ''),
                title: t('page.sort'),
                'data-sort-toggle': 'true',
                onClick: function () {
                  setSortOpen(!sortOpen)
                  setMoreOpen(false)
                  setPrefsOpen(false)
                },
              },
              icon('sort', 18),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mu-icon-btn' + (prefsOpen ? ' is-on' : ''),
                title: t('page.settings'),
                'data-prefs-toggle': 'true',
                onClick: function () {
                  setPrefsOpen(!prefsOpen)
                  setSortOpen(false)
                  setMoreOpen(false)
                },
              },
              icon('settings', 18),
            ),
            searchOpen
              ? h(
                  'div',
                  { className: 'mu-search-inline' },
                  icon('search', 14),
                  h('input', {
                    type: 'text',
                    className: 'mu-search-input',
                    value: query,
                    autoFocus: true,
                    placeholder: t('page.searchPlaceholder'),
                    onChange: function (event) {
                      setQuery(event.target.value)
                    },
                    onKeyDown: function (event) {
                      if (event.key === 'Enter') {
                        pushSearchHistory(query)
                      }
                      if (event.key === 'Escape') {
                        setQuery('')
                        setSearchOpen(false)
                      }
                    },
                    onBlur: function () {
                      if (query.trim() === '') setSearchOpen(false)
                    },
                  }),
                  query !== ''
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'mu-icon-btn mu-icon-btn-sm',
                          title: t('page.done'),
                          onClick: function () {
                            setQuery('')
                          },
                        },
                        icon('x', 12),
                      )
                    : null,
                  query === '' && searchHistory.length > 0
                    ? h(
                        'div',
                        { className: 'mu-search-history' },
                        searchHistory.map(function (item) {
                          return h(
                            'button',
                            {
                              key: item,
                              type: 'button',
                              className: 'mu-chip mu-chip-sm',
                              onMouseDown: function (event) {
                                event.preventDefault()
                                setQuery(item)
                                pushSearchHistory(item)
                              },
                            },
                            item,
                          )
                        }),
                      )
                    : null,
                )
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-icon-btn' + (query !== '' ? ' is-on' : ''),
                    title: t('page.search'),
                    onClick: function () {
                      setSearchOpen(true)
                    },
                  },
                  icon('search', 18),
                ),
          ),
        ),

        h(
          'div',
          { className: 'mu-tabs' },
          h(
            'button',
            {
              type: 'button',
              className: 'mu-tab' + (view === 'songs' ? ' is-on' : ''),
              onClick: function () {
                setView('songs')
              },
            },
            t('page.tabSongs'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mu-tab' + (view === 'favorites' ? ' is-on' : ''),
              onClick: function () {
                setView('favorites')
              },
            },
            t('page.tabFavorites'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mu-tab' + (view === 'stats' ? ' is-on' : ''),
              onClick: function () {
                setView('stats')
              },
            },
            t('page.tabStats'),
          ),
          playlists.map(function (playlist) {
            var isOn = view === 'playlists' && playlistId === playlist.id
            return h(
              'button',
              {
                key: playlist.id,
                type: 'button',
                className: 'mu-tab mu-tab-pl' + (isOn ? ' is-on' : ''),
                title: playlist.name,
                onClick: function () {
                  openPlaylist(playlist.id)
                },
              },
              playlist.name,
            )
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'mu-tab mu-tab-add',
              title: t('page.newPlaylist'),
              onClick: function () {
                setNewPlaylistName(autoPlaylistName())
                setNewPlaylistOpen(true)
              },
            },
            icon('plus', 15),
          ),
        ),

        sortOpen
          ? h(
              'div',
              { className: 'mu-menu mu-menu-sort' },
              sortOptions.map(function (option) {
                return h(
                  'button',
                  {
                    type: 'button',
                    key: option[0],
                    className: 'mu-menu-item' + (sortBy === option[0] ? ' is-on' : ''),
                    onClick: function () {
                      if (sortBy === option[0]) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
                      else {
                        setSortBy(option[0])
                        setSortDir('asc')
                      }
                      setSortOpen(false)
                    },
                  },
                  h('span', null, t(option[1])),
                  sortBy === option[0] ? h('span', { className: 'mu-menu-hint' }, sortDir === 'asc' ? '↑' : '↓') : null,
                )
              }),
            )
          : null,

        prefsOpen
          ? h(
              'div',
              { className: 'mu-prefs-panel' },
              h(
                'div',
                { className: 'mu-prefs-tabs' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-prefs-tab' + (prefsTab === 'appearance' ? ' is-on' : ''),
                    onClick: function () {
                      setPrefsTab('appearance')
                    },
                  },
                  t('settings.tabAppearance'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-prefs-tab' + (prefsTab === 'lyrics' ? ' is-on' : ''),
                    onClick: function () {
                      setPrefsTab('lyrics')
                    },
                  },
                  t('settings.tabLyrics'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-prefs-tab' + (prefsTab === 'library' ? ' is-on' : ''),
                    onClick: function () {
                      setPrefsTab('library')
                    },
                  },
                  t('settings.tabLibrary'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-prefs-tab' + (prefsTab === 'playback' ? ' is-on' : ''),
                    onClick: function () {
                      setPrefsTab('playback')
                    },
                  },
                  t('settings.tabPlayback'),
                ),
              ),
              prefsTab === 'appearance'
                ? h(
                    'div',
                    { className: 'mu-prefs-body' },
                    settingToggle(t('settings.composerQueueButton'), prefsUi.composerQueueButton, function (value) {
                      updatePref('composerQueueButton', value)
                    }),
                    settingToggle(t('settings.circularCover'), prefsUi.circularCover, function (value) {
                      updatePref('circularCover', value)
                    }),
                    settingToggle(t('settings.vinylRing'), prefsUi.vinylRing, function (value) {
                      updatePref('vinylRing', value)
                    }),
                    settingToggle(t('settings.coverSpin'), prefsUi.coverSpin, function (value) {
                      updatePref('coverSpin', value)
                    }),
                  )
                : prefsTab === 'lyrics'
                  ? h(
                      'div',
                      { className: 'mu-prefs-body' },
                      settingOrder(
                      t('settings.lyricOrder'),
                      Array.isArray(prefsUi.lyricOrder) && prefsUi.lyricOrder.length > 0
                        ? prefsUi.lyricOrder
                        : ['embedded', 'lrc'],
                      {
                        embedded: t('settings.lyricSourceEmbedded'),
                        lrc: t('settings.lyricSourceLrc'),
                      },
                      function (order) {
                        updatePref('lyricOrder', order)
                      },
                    ),
                    settingChoice(
                      t('settings.lyricAlign'),
                      prefsUi.lyricAlign,
                      [
                        { value: 'center', label: t('settings.alignCenter') },
                        { value: 'left', label: t('settings.alignLeft') },
                        { value: 'right', label: t('settings.alignRight') },
                      ],
                      function (value) {
                        updatePref('lyricAlign', value)
                      },
                    ),
                    settingRange(t('settings.lyricSize'), prefsUi.lyricSize, 14, 40, 1, 'px', function (value) {
                      updatePref('lyricSize', value)
                    }),
                    settingRange(t('settings.lyricWeight'), prefsUi.lyricWeight, 300, 800, 100, '', function (value) {
                      updatePref('lyricWeight', value)
                    }),
                    settingToggle(t('settings.lyricBlur'), prefsUi.lyricBlur, function (value) {
                      updatePref('lyricBlur', value)
                    }),
                    settingToggle(t('settings.lyricTranslation'), prefsUi.showTranslation, function (value) {
                      updatePref('showTranslation', value)
                    }),
                    settingRange(t('settings.translationScale'), prefsUi.translationScale, 50, 100, 5, '%', function (value) {
                      updatePref('translationScale', value)
                    }),
                    settingToggle(t('settings.composerLyrics'), prefsUi.composerLyrics, function (value) {
                      updatePref('composerLyrics', value)
                    }),
                    settingChoice(
                      t('settings.composerLyricPlace'),
                      prefsUi.composerLyricPlace,
                      [
                        { value: 'input-left', label: t('settings.placeInputLeft') },
                        { value: 'above', label: t('settings.placeAbove') },
                      ],
                      function (value) {
                        updatePref('composerLyricPlace', value)
                      },
                    ),
                  )
                  : prefsTab === 'library'
                    ? h(
                      'div',
                      { className: 'mu-prefs-body' },
                      h('p', { className: 'mu-prefs-hint' }, t('settings.libraryHint')),
                      roots.length === 0
                        ? h('div', { className: 'mu-prefs-empty' }, t('settings.empty'))
                        : roots.map(function (root, position) {
                            return h(
                              'div',
                              { className: 'mu-prefs-folder', key: String(position) },
                              h('span', { className: 'mu-prefs-folder-path', title: root }, root),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'mu-icon-btn mu-icon-btn-sm',
                                  title: t('settings.remove'),
                                  onClick: function () {
                                    setDeleteRoot(position)
                                  },
                                },
                                '×',
                              ),
                            )
                          }),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'mu-btn mu-btn-ghost mu-btn-sm',
                          onClick: openBrowse,
                        },
                        '+ ' + t('settings.add'),
                      ),
                      browseOpen
                        ? h(
                            'div',
                            { className: 'mu-browse' },
                            h('input', {
                              type: 'text',
                              className: 'mu-input mu-input-sm mu-browse-path',
                              key: browsePath,
                              defaultValue: browsePath,
                              spellCheck: 'false',
                              onKeyDown: function (event) {
                                if (event.key !== 'Enter') return
                                var target = String(event.target.value || '').trim()
                                if (target !== '') loadBrowse(target)
                              },
                            }),
                            h(
                              'div',
                              { className: 'mu-browse-list' },
                              browseLoading
                                ? h('div', { className: 'mu-browse-empty' }, '…')
                                : browseDirs.map(function (entry) {
                                    return h(
                                      'button',
                                      {
                                        type: 'button',
                                        key: entry.path,
                                        className: 'mu-browse-item',
                                        onClick: function () {
                                          loadBrowse(entry.path)
                                        },
                                      },
                                      icon('folder', 14),
                                      h('span', null, entry.name),
                                    )
                                  }),
                            ),
                            h(
                              'div',
                              { className: 'mu-browse-actions' },
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'mu-btn mu-btn-ghost mu-btn-sm',
                                  disabled: browseParent === null,
                                  onClick: function () {
                                    loadBrowse(browseParent)
                                  },
                                },
                                t('settings.up'),
                              ),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'mu-btn mu-btn-ghost mu-btn-sm',
                                  onClick: function () {
                                    setBrowseOpen(false)
                                  },
                                },
                                t('page.cancel'),
                              ),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'mu-btn mu-btn-accent mu-btn-sm',
                                  onClick: chooseBrowsePath,
                                },
                                t('settings.chooseFolder'),
                              ),
                            ),
                          )
                        : null,
                      h(
                        'div',
                        { className: 'mu-prefs-field' },
                        h('span', { className: 'mu-prefs-field-label' }, t('settings.depth')),
                        h('input', {
                          type: 'number',
                          className: 'mu-input mu-input-sm mu-input-num',
                          min: 0,
                          max: 8,
                          value: depth,
                          onChange: function (event) {
                            setDepthNow(clamp(Number(event.target.value) || 0, 0, 8))
                            scheduleSave()
                          },
                        }),
                      ),
                      configError !== null ? h('div', { className: 'mu-prefs-error' }, configError) : null,
                      h(
                        'div',
                        { className: 'mu-prefs-actions' },
                        configSaving
                          ? h('span', { className: 'mu-prefs-saved' }, t('settings.saving'))
                          : configSaved
                            ? h('span', { className: 'mu-prefs-saved' }, t('settings.saved'))
                            : null,
                      ),
                      deleteRoot !== null
                        ? h(
                            'div',
                            { className: 'mu-prefs-confirm' },
                            h('span', null, t('settings.removeConfirm')),
                            h(
                              'div',
                              { className: 'mu-prefs-confirm-actions' },
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'mu-btn mu-btn-ghost mu-btn-sm',
                                  onClick: function () {
                                    setDeleteRoot(null)
                                  },
                                },
                                t('page.cancel'),
                              ),
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'mu-btn mu-btn-danger mu-btn-sm',
                                  onClick: function () {
                                    removeRootAt(deleteRoot)
                                  },
                                },
                                t('settings.remove'),
                              ),
                            ),
                          )
                        : null,
                    )
                  : h(
                      'div',
                      { className: 'mu-prefs-body' },
                      settingToggle(t('settings.resumeOnStart'), prefsUi.resumeOnStart, function (value) {
                        updatePref('resumeOnStart', value)
                      }),
                      settingToggle(t('settings.autoResume'), prefsUi.autoResume, function (value) {
                        updatePref('autoResume', value)
                      }),
                      settingToggle(t('settings.rememberPerTrack'), prefsUi.rememberPerTrack, function (value) {
                        updatePref('rememberPerTrack', value)
                      }),
                      h('p', { className: 'mu-prefs-hint' }, t('settings.playbackHint')),
                    ),
            )
          : null,

        deleteConfirm && activePlaylist !== undefined
          ? h(
              'div',
              { className: 'mu-menu mu-confirm' },
              h(
                'div',
                { className: 'mu-confirm-text' },
                t('page.deleteConfirm', { name: activePlaylist.name }),
              ),
              h(
                'div',
                { className: 'mu-confirm-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-btn',
                    onClick: function () {
                      setDeleteConfirm(false)
                    },
                  },
                  t('page.cancel'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-btn mu-btn-danger',
                    onClick: function () {
                      var id = activePlaylist.id
                      setDeleteConfirm(false)
                      removePlaylist(id)
                      setView('songs')
                    },
                  },
                  t('page.delete'),
                ),
              ),
            )
          : null,

        h(
              'div',
              { className: 'mu-view' },

        h(
          'div',
          { className: 'mu-chips', style: view === 'stats' ? { display: 'none' } : undefined },
          h(
            'button',
            { type: 'button', className: 'mu-chip', title: loopLabel(), onClick: cycleLoop },
            icon(playModeIcon(playModeOf(snap)), 15),
            h('span', null, loopLabel()),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mu-chip',
              onClick: function () {
                if (sortedCollection.length > 0) player.playList(sortedCollection, 0)
              },
            },
            icon('play', 13),
            h('span', null, t('page.playAll')),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'mu-chip mu-chip-icon',
              title: viewMode === 'grid' ? t('page.listView') : t('page.gridView'),
              onClick: toggleViewMode,
            },
            icon(viewMode === 'grid' ? 'list' : 'grid', 14),
          ),
          selected.length > 0
            ? h(
                'span',
                { className: 'mu-selected' },
                t('page.selectedCount', { n: selected.length }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-chip mu-chip-accent',
                    onClick: function () {
                      player.playList(selectedTracks, 0)
                    },
                  },
                  icon('play', 13),
                  h('span', null, t('page.playSelected')),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mu-chip',
                    onClick: function () {
                      if (selected.length === visible.length) setSelected([])
                      else
                        setSelected(
                          visible.map(function (track) {
                            return track.path
                          }),
                        )
                    },
                  },
                  selected.length === visible.length ? t('page.selectNone') : t('page.selectAll'),
                ),
                h(
                  'div',
                  { className: 'mu-addto' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-chip' + (addToOpen ? ' is-on' : ''),
                      onClick: function () {
                        setAddToOpen(!addToOpen)
                      },
                    },
                    icon('plus', 13),
                    h('span', null, t('page.addTo')),
                    icon('chevronDown', 12),
                  ),
                  addToOpen
                    ? h(
                        'div',
                        { className: 'mu-addto-menu' },
                        playlists.length === 0
                          ? h('div', { className: 'mu-addto-empty' }, t('page.noPlaylists'))
                          : playlists.map(function (playlist) {
                              return h(
                                'button',
                                {
                                  key: playlist.id,
                                  type: 'button',
                                  className: 'mu-addto-item',
                                  onClick: function () {
                                    addSelectedTo(playlist.id)
                                    setAddToOpen(false)
                                  },
                                },
                                icon('list', 12),
                                h('span', { className: 'mu-ellipsis' }, playlist.name),
                                h('span', { className: 'mu-addto-count' }, String(playlist.trackPaths.length)),
                              )
                            }),
                        h('div', { className: 'mu-addto-sep' }),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'mu-addto-item',
                            onClick: function () {
                              createPlaylistWithSelection()
                              setAddToOpen(false)
                            },
                          },
                          icon('plus', 12),
                          h('span', null, t('page.newPlaylistAdd')),
                        ),
                      )
                    : null,
                ),
              )
            : null,
        ),

        view === 'stats'
          ? h(
              'div',
              { className: 'mu-list is-stats' },
              h(StatsView, { tracks: tracks, trackByPath: trackByPath, t: t }),
            )
          : viewMode === 'grid'
            ? h(TrackGrid, {
                className: 'mu-grid',
                items: visible,
                resetKey: view + '|' + String(playlistId),
                selected: selected,
                isFavorite: function (track) {
                  return favorites.indexOf(track.path) >= 0
                },
                currentPath: current !== null ? current.path : '',
                playing: snap.playing,
                onSelect: function (track) {
                  setSelected(function (previous) {
                    return previous.length === 1 && previous[0] === track.path ? [] : [track.path]
                  })
                },
                onActivate: activate,
                onToggleFavorite: toggleFavorite,
                onToggleSelect: toggleSelect,
                onContextMenu: function (track, x, y) {
                  setMoreOpen(false)
                  setCtxMenu({ x: x, y: y, path: track.path, mode: 'main' })
                },
                empty: emptyState,
              })
            : h(VirtualList, {
              className: 'mu-list',
              items: visible,
              rowHeight: 72,
              itemKey: function (track) {
                return track.path
              },
              renderRow: renderRow,
              empty: emptyState,
            }),

        h(
          'div',
          {
            className: 'mu-bar mu-bar-openable',
            onClick: function (event) {
              var target = event.target
              // Buttons and the seek/volume inputs keep their own behaviour;
              // the left info block handles its own click; everything else on
              // the bar opens the player page.
              if (
                target &&
                typeof target.closest === 'function' &&
                target.closest('button, input, .mu-clickable') !== null
              ) {
                return
              }
              openNowPlaying()
            },
          },
          h(BarWaveFull, null),
          h(SeekBar, { player: player, track: current }),
          h(
            'div',
            { className: 'mu-bar-main' },
            h(
              'div',
              {
                className: 'mu-bar-left',
                role: 'button',
                tabIndex: 0,
                title: t('page.openPlayer'),
                onClick: openNowPlaying,
                onKeyDown: function (event) {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openNowPlaying()
                  }
                },
              },
              h(Cover, { track: current, size: 40, radius: 8 }),
              h(
                'div',
                { className: 'mu-bar-info' },
                h('div', { className: 'mu-bar-title mu-ellipsis' }, current ? current.title : t('page.noTrack')),
                h(
                  'div',
                  { className: 'mu-bar-artist mu-ellipsis' },
                  current ? current.artist || t('page.unknownArtist') : '—',
                ),
                leaderNow
                  ? null
                  : h('div', { className: 'mu-leader-hint' }, t('page.otherTabPlaying')),
              ),
            ),

            h(
              'div',
              { className: 'mu-bar-controls' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn',
                  title: loopLabel(),
                  onClick: cycleLoop,
                },
                icon(playModeIcon(playModeOf(snap)), 17),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn',
                  title: t('page.prev'),
                  onClick: function () {
                    player.ensureAnalyser()
                    player.prev()
                  },
                },
                icon('prev', 18),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-play-btn',
                  title: snap.playing ? t('page.pause') : t('page.play'),
                  onClick: function () {
                    player.ensureAnalyser()
                    player.toggle()
                  },
                },
                icon(snap.playing ? 'pause' : 'play', 20),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn',
                  title: t('page.next'),
                  onClick: function () {
                    player.ensureAnalyser()
                    player.next()
                  },
                },
                icon('next', 18),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn' + (queueOpen ? ' is-on' : ''),
                  title: t('page.queue'),
                  onClick: function () {
                    toggleQueueOverlay()
                    setMoreOpen(false)
                  },
                },
                icon('list', 18),
              ),
            ),

            h(
              'div',
              { className: 'mu-bar-right' },
              current && current.sampleRate ? h('span', { className: 'mu-quality' }, fmtKhz(current.sampleRate)) : null,
              current
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-icon-btn mu-fav' + (favoritePaths[current.path] ? ' is-on' : ''),
                      title: favoritePaths[current.path] ? t('page.unfavorite') : t('page.favorite'),
                      onClick: function () {
                        toggleFavorite(current)
                      },
                    },
                    icon('heart', 17),
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn' + (moreOpen ? ' is-on' : ''),
                  title: t('page.more'),
                  onClick: function () {
                    setMoreOpen(!moreOpen)
                    toggleQueueOverlay(false)
                  },
                },
                icon('more', 18),
              ),
            ),
          ),
        ),

        moreOpen
          ? h(
              'div',
              { className: 'mu-pop mu-more' },
              current
                ? h(
                    'div',
                    { className: 'mu-more-info' },
                    [
                      [t('page.format'), (current.codec || current.ext || '').toUpperCase()],
                      [t('page.bitrate'), fmtKbps(current.bitrate) || t('page.none')],
                      [t('page.sampleRate'), fmtKhz(current.sampleRate) || t('page.none')],
                    ].map(function (row) {
                      return h(
                        'div',
                        { className: 'mu-more-row', key: row[0] },
                        h('span', { className: 'mu-more-key' }, row[0]),
                        h('span', { className: 'mu-more-val mu-ellipsis' }, row[1]),
                      )
                    }),
                  )
                : h('div', { className: 'mu-state-sub' }, t('page.noTrack')),
              h(
                'button',
                { type: 'button', className: 'mu-menu-item', disabled: !current, onClick: function () { copyPath() } },
                h('span', null, t('page.copyPath')),
              ),
            )
          : null,

            ),

        ctxMenu !== null
          ? (function () {
              var target = trackByPath[ctxMenu.path] || null
              var winWidth = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1200
              var winHeight = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800
              var left = Math.max(8, Math.min(ctxMenu.x, winWidth - 220))
              var top = Math.max(8, Math.min(ctxMenu.y, winHeight - (ctxMenu.mode === 'playlists' ? 320 : 280)))
              function close() {
                setCtxMenu(null)
              }
              var children = []
              if (ctxMenu.mode === 'playlists') {
                children.push(
                  h('div', { className: 'mu-ctx-head', key: 'head' }, t('page.addTo')),
                  playlists.length === 0
                    ? h('div', { className: 'mu-addto-empty', key: 'empty' }, t('page.noPlaylists'))
                    : playlists.map(function (playlist) {
                        return h(
                          'button',
                          {
                            key: playlist.id,
                            type: 'button',
                            className: 'mu-ctx-item',
                            onClick: function () {
                              if (target === null) return
                              patchPlaylist(playlist.id, { add: [target.path] })
                                .then(function () {
                                  showToast(t('page.addedCount', { n: 1 }))
                                })
                                .catch(function (error) {
                                  showToast(String((error && error.message) || error))
                                })
                              close()
                            },
                          },
                          icon('list', 12),
                          h('span', { className: 'mu-ellipsis' }, playlist.name),
                          h('span', { className: 'mu-addto-count' }, String(playlist.trackPaths.length)),
                        )
                      }),
                )
              } else {
                children.push(
                  h(
                    'button',
                    {
                      key: 'add-to-playlist',
                      type: 'button',
                      className: 'mu-ctx-item',
                      onClick: function () {
                        setCtxMenu({ x: ctxMenu.x, y: ctxMenu.y, path: ctxMenu.path, mode: 'playlists' })
                      },
                    },
                    icon('list', 12),
                    h('span', { className: 'mu-ellipsis' }, t('page.addTo')),
                    h('span', { className: 'mu-ctx-arrow' }, '›'),
                  ),
                  h(
                    'button',
                    {
                      key: 'enqueue',
                      type: 'button',
                      className: 'mu-ctx-item',
                      onClick: function () {
                        if (target !== null) {
                          player.enqueue(target)
                          showToast(t('page.addedToPlaylist'))
                        }
                        close()
                      },
                    },
                    icon('plus', 12),
                    h('span', null, t('page.addToPlaylist')),
                  ),
                  h('div', { className: 'mu-ctx-sep', key: 'sep1' }),
                  h(
                    'button',
                    {
                      key: 'copy',
                      type: 'button',
                      className: 'mu-ctx-item',
                      onClick: function () {
                        copyPath(target)
                        close()
                      },
                    },
                    icon('copy', 12),
                    h('span', null, t('page.copyPath')),
                  ),
                  h(
                    'button',
                    {
                      key: 'reveal',
                      type: 'button',
                      className: 'mu-ctx-item',
                      onClick: function () {
                        revealTrack(target)
                        close()
                      },
                    },
                    icon('folder', 12),
                    h('span', null, t('page.reveal')),
                  ),
                  h(
                    'button',
                    {
                      key: 'details',
                      type: 'button',
                      className: 'mu-ctx-item',
                      onClick: function () {
                        setInfoPath(ctxMenu.path)
                        close()
                      },
                    },
                    icon('info', 12),
                    h('span', null, t('page.details')),
                  ),
                  h(
                    'button',
                    {
                      key: 'edit-meta',
                      type: 'button',
                      className: 'mu-ctx-item',
                      onClick: function () {
                        openTagEditor(ctxMenu.path)
                        close()
                      },
                    },
                    icon('edit', 12),
                    h('span', null, t('page.editMeta')),
                  ),
                  view === 'playlists' && activePlaylist !== undefined
                    ? h(
                        'button',
                        {
                          key: 'remove',
                          type: 'button',
                          className: 'mu-ctx-item is-danger',
                          onClick: function () {
                            if (target !== null) {
                              patchPlaylist(activePlaylist.id, { remove: [target.path] }).catch(function (error) {
                                showToast(String((error && error.message) || error))
                              })
                            }
                            close()
                          },
                        },
                        icon('x', 12),
                        h('span', null, t('page.removeTrack')),
                      )
                    : null,
                )
              }
              return h(
                'div',
                { key: 'ctx-layer' },
                h('div', { className: 'mu-ctx-scrim', onClick: close }),
                h('div', { className: 'mu-ctx', style: { left: left + 'px', top: top + 'px' } }, children),
              )
            })()
          : null,

        infoPath !== null
          ? (function () {
              var info = trackByPath[infoPath]
              if (!info) return null
              var rows = [
                [t('page.title'), info.title],
                [t('page.artist'), info.artist || t('page.unknownArtist')],
                [t('page.album'), info.album || t('page.none')],
                [t('page.duration'), fmtTime(info.durationSec)],
                [t('page.format'), (info.codec || info.ext || '').toUpperCase()],
                [t('page.bitrate'), fmtKbps(info.bitrate) || t('page.none')],
                [t('page.sampleRate'), fmtKhz(info.sampleRate) || t('page.none')],
                [t('page.size'), info.size > 0 ? (info.size / 1024 / 1024).toFixed(2) + ' MB' : t('page.none')],
                [t('page.plays'), String(info.plays || 0)],
                [t('page.path'), info.path],
              ]
              return h(
                'div',
                { className: 'mu-info-layer' },
                h('div', { className: 'mu-info-scrim', onClick: function () { setInfoPath(null) } }),
                h(
                  'div',
                  { className: 'mu-info' },
                  h(
                    'div',
                    { className: 'mu-info-head' },
                    h('span', { className: 'mu-info-title' }, t('page.details')),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mu-icon-btn mu-icon-btn-sm',
                        onClick: function () {
                          setInfoPath(null)
                        },
                      },
                      icon('x', 14),
                    ),
                  ),
                  rows.map(function (row) {
                    return h(
                      'div',
                      { className: 'mu-more-row', key: row[0] },
                      h('span', { className: 'mu-more-key' }, row[0]),
                      h('span', { className: 'mu-more-val mu-ellipsis', title: row[1] }, row[1]),
                    )
                  }),
                ),
              )
            })()
          : null,

        newPlaylistOpen
          ? h(
              'div',
              { className: 'mu-info-layer' },
              h('div', { className: 'mu-info-scrim', onClick: function () { setNewPlaylistOpen(false) } }),
              h(
                'div',
                { className: 'mu-info' },
                h(
                  'div',
                  { className: 'mu-info-head' },
                  h('span', { className: 'mu-info-title' }, t('page.newPlaylist')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-icon-btn mu-icon-btn-sm',
                      onClick: function () {
                        setNewPlaylistOpen(false)
                      },
                    },
                    icon('x', 14),
                  ),
                ),
                h('input', {
                  type: 'text',
                  className: 'mu-input',
                  value: newPlaylistName,
                  autoFocus: true,
                  placeholder: t('page.playlistName'),
                  onChange: function (event) {
                    setNewPlaylistName(event.target.value)
                  },
                  onKeyDown: function (event) {
                    if (event.key === 'Enter') createPlaylist(newPlaylistName)
                    if (event.key === 'Escape') setNewPlaylistOpen(false)
                  },
                }),
                h(
                  'div',
                  { className: 'mu-info-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-btn',
                      onClick: function () {
                        setNewPlaylistOpen(false)
                      },
                    },
                    t('page.cancel'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-btn mu-chip-accent',
                      onClick: function () {
                        createPlaylist(newPlaylistName)
                      },
                    },
                    t('page.create'),
                  ),
                ),
              ),
            )
          : null,

        tagEditPath !== null
          ? h(
              'div',
              { className: 'mu-info-layer' },
              h('div', {
                className: 'mu-info-scrim',
                onClick: function () {
                  if (!tagSaving) {
                    setTagEditPath(null)
                    setTagForm(null)
                  }
                },
              }),
              h(
                'div',
                { className: 'mu-info mu-tag-editor' },
                h(
                  'div',
                  { className: 'mu-info-head' },
                  h('span', { className: 'mu-info-title' }, t('page.editMeta')),
                  h(
                    'div',
                    { className: 'mu-tag-head-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mu-chip',
                        disabled: tagForm === null || onlineLoading,
                        onClick: function () {
                          setMatchField(null)
                          searchOnlineForTags()
                        },
                      },
                      icon('search', 13),
                      h('span', null, t('page.onlineMatch')),
                    ),
                    h(
                      'button',
                      { type: 'button', className: 'mu-icon-btn mu-icon-btn-sm', onClick: closeTagEditor },
                      icon('x', 14),
                    ),
                  ),
                ),
                tagForm === null
                  ? h('div', { className: 'mu-tag-body' }, h('div', { className: 'mu-state-sub' }, '…'))
                  : [
                      h(
                        'div',
                        { className: 'mu-tag-layout', key: 'layout' },
                        h(
                          'aside',
                          { className: 'mu-tag-aside' },
                          h(
                            'div',
                            { className: 'mu-tag-cover-box' },
                            coverFailed
                              ? h('div', { className: 'mu-tag-cover mu-tag-cover-empty' }, icon('note', 30))
                              : h('img', {
                                  className: 'mu-tag-cover',
                                  src: tagCoverPreview !== null ? tagCoverPreview : tagCoverUrl,
                                  alt: '',
                                  onError: function () {
                                    setCoverFailed(true)
                                  },
                                }),
                            h(
                              'div',
                              { className: 'mu-tag-cover-actions' },
                              h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'mu-tag-cover-btn',
                                  onClick: function () {
                                    setMatchField(null)
                                    searchOnlineForTags()
                                  },
                                },
                                icon('search', 12),
                                h('span', null, t('page.replaceCover')),
                              ),
                              tagCoverPreview !== null
                                ? h(
                                    'button',
                                    {
                                      type: 'button',
                                      className: 'mu-tag-cover-btn is-ghost',
                                      onClick: function () {
                                        setTagCoverPreview(null)
                                        setCoverFailed(false)
                                      },
                                    },
                                    t('page.resetCover'),
                                  )
                                : null,
                            ),
                            tagCoverPreview !== null
                              ? h('div', { className: 'mu-tag-cover-hint' }, t('page.coverPending'))
                              : null,
                          ),
                          h(
                            'div',
                            { className: 'mu-tag-aside-meta' },
                            h(
                              'div',
                              { className: 'mu-tag-aside-title mu-ellipsis' },
                              tagForm.title || t('page.noTrack'),
                            ),
                            h(
                              'div',
                              { className: 'mu-tag-aside-artist mu-ellipsis' },
                              tagForm.artist || '',
                            ),
                            h(
                              'div',
                              { className: 'mu-tag-badges' },
                              [
                                tagFormat !== ''
                                  ? h('span', { className: 'mu-tag-badge', key: 'format' }, tagFormat)
                                  : null,
                                tagTrack && tagTrack.durationSec > 0
                                  ? h(
                                      'span',
                                      { className: 'mu-tag-badge', key: 'duration' },
                                      fmtTime(tagTrack.durationSec),
                                    )
                                  : null,
                                tagTrack && fmtKhz(tagTrack.sampleRate) !== ''
                                  ? h(
                                      'span',
                                      { className: 'mu-tag-badge', key: 'rate' },
                                      fmtKhz(tagTrack.sampleRate),
                                    )
                                  : null,
                                tagTrack && fmtKbps(tagTrack.bitrate) !== ''
                                  ? h(
                                      'span',
                                      { className: 'mu-tag-badge', key: 'bitrate' },
                                      fmtKbps(tagTrack.bitrate),
                                    )
                                  : null,
                              ].filter(Boolean),
                            ),
                          ),
                          h('div', { className: 'mu-tag-aside-hint' }, t('page.metaHint')),
                        ),
                        h(
                          'div',
                          { className: 'mu-tag-main' },
                        h(
                          'div',
                          { className: 'mu-tag-section' },
                          h('div', { className: 'mu-tag-section-title' }, t('page.metaBasic')),
                          h(
                            'div',
                            { className: 'mu-tag-grid' },
                            TAG_BASIC_ROWS.map(function (row) {
                              return renderTagField(row[0], row[1])
                            }),
                          ),
                        ),
                        h(
                          'div',
                          { className: 'mu-tag-section' },
                          h('div', { className: 'mu-tag-section-title' }, t('page.metaDetail')),
                          h(
                            'div',
                            { className: 'mu-tag-grid' },
                            TAG_DETAIL_ROWS.map(function (row) {
                              return renderTagField(row[0], row[1])
                            }),
                          ),
                        ),
                        h(
                          'div',
                          { className: 'mu-tag-section' },
                          h('div', { className: 'mu-tag-section-title' }, t('page.lyrics')),
                          h('textarea', {
                            className: 'mu-input mu-tag-lyrics',
                            rows: 9,
                            value: tagForm.lyrics || '',
                            onChange: function (event) {
                              var value = event.target.value
                              setTagForm(function (previous) {
                                return Object.assign({}, previous, { lyrics: value })
                              })
                            },
                          }),
                        ),
                            h('p', { className: 'mu-tag-hint' }, t('page.metaHint')),
                        ),
                      ),
                      h(
                        'div',
                        { className: 'mu-tag-footer', key: 'footer' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'mu-btn',
                            disabled: tagSaving,
                            onClick: closeTagEditor,
                          },
                          t('page.cancel'),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'mu-btn mu-chip-accent',
                            disabled: tagSaving,
                            onClick: saveTagEditor,
                          },
                          tagSaving ? t('page.saving') : t('page.save'),
                        ),
                      ),
                    ],
              ),
            )
          : null,

        onlineOpen
          ? h(
              'div',
              { className: 'mu-info-layer mu-match-layer' },
              h('div', { className: 'mu-info-scrim', onClick: function () { setOnlineOpen(false) } }),
              h(
                'div',
                { className: 'mu-info mu-match-dialog' },
                h(
                  'div',
                  { className: 'mu-info-head' },
                  h(
                    'span',
                    { className: 'mu-info-title mu-ellipsis' },
                    t('page.onlineMatch') +
                      (matchField !== null ? ' · ' + tagFieldLabel(matchField) : '') +
                      (tagForm && tagForm.title ? ' · ' + tagForm.title : ''),
                  ),
                  h(
                    'div',
                    { className: 'mu-tag-head-actions' },
                    h(
                      'span',
                      { className: 'mu-match-count' },
                      onlineLoading
                        ? t('page.onlineLoading')
                        : String(onlineResults.length) + ' ' + t('page.results'),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mu-icon-btn mu-icon-btn-sm',
                        onClick: function () {
                          setOnlineOpen(false)
                        },
                      },
                      icon('x', 14),
                    ),
                  ),
                ),
                h(
                  'div',
                  { className: 'mu-match-list' },
                  onlineLoading
                    ? h('div', { className: 'mu-match-empty' }, t('page.onlineLoading'))
                    : onlineResults.length === 0
                      ? h('div', { className: 'mu-match-empty' }, t('page.onlineEmpty'))
                      : onlineResults.map(function (item, index) {
                          return h(MatchItem, {
                            key: (item.source || 'x') + ':' + (item.id || index),
                            item: item,
                            onPick: function () {
                              applyOnlineResult(item)
                            },
                          })
                        }),
                ),
                h(
                  'div',
                  { className: 'mu-match-foot' },
                  h(
                    'div',
                    { className: 'mu-tag-online-sources' },
                    onlineSources.length === 0
                      ? h('span', null, t('page.onlineHint'))
                      : onlineSources.map(function (source) {
                          return h(
                            'span',
                            { key: source.source },
                            sourceLabel(source.source) + (source.ok ? ' ✓' : ' ✕'),
                          )
                        }),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mu-btn',
                      onClick: function () {
                        setOnlineOpen(false)
                      },
                    },
                    t('page.cancel'),
                  ),
                ),
              ),
            )
          : null,

        toast !== '' ? h('div', { className: 'mu-toast' }, toast) : null,

        npOpen
          ? h(NowPlaying, {
              player: player,
              snapshot: snap,
              visible: npVisible,
              onClose: closeNowPlaying,
            })
          : null,
      )
    }

    // ── settings page ─────────────────────────────────────────────────────

    /** One labelled switch row. */
    function settingToggle(label, value, onChange) {
      return h(
        'div',
        { className: 'mu-set-item' },
        h('span', { className: 'mu-set-label' }, label),
        h(
          'button',
          {
            type: 'button',
            className: 'mu-switch' + (value ? ' is-on' : ''),
            role: 'switch',
            'aria-checked': value ? 'true' : 'false',
            onClick: function () {
              onChange(!value)
            },
          },
          h('span', { className: 'mu-switch-dot' }),
        ),
      )
    }

    /** One labelled slider row. */
    function settingRange(label, value, min, max, step, suffix, onChange) {
      return h(
        'div',
        { className: 'mu-set-item mu-set-item-col' },
        h(
          'div',
          { className: 'mu-set-item-head' },
          h('span', { className: 'mu-set-label' }, label),
          h('span', { className: 'mu-set-value' }, String(value) + (suffix || '')),
        ),
        h('input', {
          type: 'range',
          className: 'mu-range',
          min: min,
          max: max,
          step: step,
          value: value,
          onChange: function (event) {
            var next = Number(event.target.value)
            if (isFinite(next)) onChange(next)
          },
        }),
      )
    }

    /** One labelled segmented choice. */
    function settingChoice(label, value, options, onChange) {
      return h(
        'div',
        { className: 'mu-set-item mu-set-item-col' },
        h('span', { className: 'mu-set-label' }, label),
        h(
          'div',
          { className: 'mu-set-choices' },
          options.map(function (option) {
            return h(
              'button',
              {
                type: 'button',
                key: option.value,
                className: 'mu-choice' + (value === option.value ? ' is-on' : ''),
                onClick: function () {
                  onChange(option.value)
                },
              },
              option.label,
            )
          }),
        ),
      )
    }

    /** Ordered list with up/down controls. */
    function settingOrder(label, order, labels, onChange) {
      function move(index, delta) {
        var target = index + delta
        if (target < 0 || target >= order.length) return
        var next = order.slice()
        var tmp = next[index]
        next[index] = next[target]
        next[target] = tmp
        onChange(next)
      }
      return h(
        'div',
        { className: 'mu-set-item mu-set-item-col' },
        h('span', { className: 'mu-set-label' }, label),
        h(
          'div',
          { className: 'mu-set-order' },
          order.map(function (key, index) {
            return h(
              'div',
              { className: 'mu-order-row', key: key },
              h('span', { className: 'mu-order-text' }, index + 1 + '. ' + (labels[key] || key)),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn mu-icon-btn-sm',
                  disabled: index === 0,
                  title: '↑',
                  onClick: function () {
                    move(index, -1)
                  },
                },
                '↑',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'mu-icon-btn mu-icon-btn-sm',
                  disabled: index === order.length - 1,
                  title: '↓',
                  onClick: function () {
                    move(index, 1)
                  },
                },
                '↓',
              ),
            )
          }),
        ),
      )
    }

    // ── styles ────────────────────────────────────────────────────────────

    var STYLE = [
      // Surface + text follow the host palette; every color has a neutral fallback.
      '.mu-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base,#141417);color:var(--dsw-alias-label-primary,#f4f4f5);font-size:13px;line-height:1.5;user-select:none}',
      '.mu-root input,.mu-root textarea,.mu-set input,.mu-np input{user-select:text}',
      '.mu-head{display:flex;align-items:center;gap:10px;padding:16px 24px 8px;min-height:52px;box-sizing:border-box}',
      '.mu-head-title{display:flex;align-items:baseline;gap:10px;min-width:0}',
      '.mu-title{display:inline-flex;align-items:center;height:28px;font-size:20px;font-weight:600;line-height:28px}',
      '.mu-count{font-size:13px;color:var(--dsw-alias-label-secondary,#a1a1aa);font-variant-numeric:tabular-nums}',
      '.mu-head-actions{margin-left:auto;display:flex;align-items:center;gap:2px}',
      '.mu-icon-btn{display:inline-flex;flex:none;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);line-height:1;cursor:pointer}',
      '.mu-icon-btn:hover{color:var(--dsw-alias-label-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mu-icon-btn:active{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12))}',
      '.mu-icon-btn.is-on{color:var(--dsw-alias-brand-primary,#f4f4f5)}',
      '.mu-icon-btn-sm{width:24px;height:24px}',
      '.mu-chips{display:flex;align-items:center;gap:8px;padding:2px 24px 10px;flex-wrap:wrap}',
      '.mu-chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4,rgba(255,255,255,.14));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#e4e4e7);font-size:13px;cursor:pointer;white-space:nowrap}',
      '.mu-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mu-chip.is-on{color:var(--dsw-alias-brand-primary,#f4f4f5);border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.2))}',
      '.mu-chip-round{width:32px;padding:0;justify-content:center}',
      '.mu-tabs{display:flex;align-items:center;gap:4px;padding:0 24px 6px;overflow-x:auto;scrollbar-width:none}',
      '.mu-tabs::-webkit-scrollbar{display:none}',
      '.mu-tab{flex:none;max-width:168px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;height:30px;padding:0 12px;border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;cursor:pointer}',
      '.mu-tab-pl{text-align:left}',
      '.mu-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mu-tab.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600}',
      '.mu-tab-add{width:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:.5px solid var(--dsw-alias-border-l3,rgba(255,255,255,.12))}',
      '.mu-tab-add:hover{border-color:var(--dsw-alias-border-l4,rgba(255,255,255,.2))}',
      '.mu-list.is-stats{padding-top:4px}',
      '.mu-stats{display:flex;flex-direction:column;gap:12px;padding:2px 0 10px}',
      '.mu-stats-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.mu-stats-chip{height:26px;padding:0 10px;font-size:12px}',
      '.mu-stats-divider{width:1px;height:16px;background:var(--dsw-alias-border-l2,rgba(255,255,255,.12));margin:0 2px}',
      '.mu-stats-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '.mu-stats-card{border:.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1,#1b1b1e));padding:10px 12px;min-width:0}',
      '.mu-stats-card-label{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);white-space:nowrap}',
      '.mu-stats-card-value{font-size:17px;font-weight:600;margin-top:2px;color:var(--dsw-alias-label-primary,#f4f4f5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}',
      '.mu-stats-list{display:flex;flex-direction:column;gap:2px}',
      '.mu-stats-row{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:var(--dsw-radius-sm,6px);min-width:0}',
      '.mu-stats-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}',
      '.mu-stats-main{flex:1;min-width:0}',
      '.mu-stats-title{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mu-stats-artist{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}',
      '.mu-stats-seconds{flex:none;width:104px;text-align:right;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);font-variant-numeric:tabular-nums}',
      '.mu-stats-plays{flex:none;width:64px;text-align:right;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums}',
      '.mu-stats-last{flex:none;width:78px;text-align:right;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-view{flex:1;min-height:0;display:flex;flex-direction:column}',
      '.mu-pl-new{display:flex;gap:8px;padding:4px 24px 12px}',
      '.mu-pl-new .mu-input{flex:1}',
      '.mu-pl-row{display:grid;grid-template-columns:32px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--dsw-radius-md,8px);cursor:pointer}',
      '.mu-pl-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}',
      '.mu-pl-icon{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-pl-main{min-width:0}',
      '.mu-pl-name{font-size:13px;font-weight:600}',
      '.mu-pl-count{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-top:1px}',
      '.mu-pl-head{display:flex;align-items:center;gap:8px;padding:4px 24px 12px}',
      '.mu-pl-title{flex:1;max-width:320px}',
      '.mu-select{height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l4,rgba(255,255,255,.14));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#e4e4e7);font-size:12px;cursor:pointer}',
      '.mu-chip-accent{background:var(--dsw-alias-button-primary-fill,#f4f4f5);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#141417)}',
      '.mu-chip-accent:hover{background:var(--dsw-alias-button-primary-hover,#e4e4e7)}',
      '.mu-selected{display:inline-flex;align-items:center;gap:8px;margin-left:auto;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px}',
      '.mu-search-inline{position:relative;box-sizing:border-box;display:flex;align-items:center;gap:6px;height:28px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l3,rgba(255,255,255,.12));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-search-input{width:150px;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font-size:12px;font-family:inherit}',
      '.mu-search{display:flex;align-items:center;gap:8px;height:34px;margin:0 24px 10px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4,rgba(255,255,255,.14));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font-size:13px;font-family:inherit}',
      '.mu-list{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:0 16px 12px}',
      '.mu-chip-icon{padding:0 9px}',
      '.mu-grid{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:8px 16px 24px;position:relative}',
      '.mu-grid-row{position:absolute;left:0;right:0;display:grid;gap:14px}',
      '.mu-card{display:flex;flex-direction:column;gap:6px;min-width:0;padding:6px;border-radius:10px;cursor:pointer;transition:background .15s}',
      '.mu-card:hover{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03))}',
      '.mu-card.is-selected{background:color-mix(in srgb,var(--dsw-static-deepseek-450,#5686fe) 10%,transparent)}',
      '.mu-card-cover{position:relative;width:100%;aspect-ratio:1;border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06))}',
      '.mu-card-cover .mu-cover{width:100%!important;height:100%!important;border-radius:10px}',
      '.mu-card-cover .mu-cover img{width:100%;height:100%;object-fit:cover;border-radius:10px}',
      '.mu-card-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46px;height:46px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;opacity:0;transition:opacity .15s;cursor:pointer}',
      '.mu-card:hover .mu-card-play,.mu-card.is-current .mu-card-play{opacity:1}',
      '.mu-card-fav{position:absolute;right:8px;bottom:8px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;cursor:pointer;opacity:0;transition:opacity .15s}',
      '.mu-card:hover .mu-card-fav,.mu-card-fav.is-on{opacity:1}',
      '.mu-card-fav.is-on{color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mu-card-fav.is-on svg{fill:currentColor}',
      '.mu-card-check{position:absolute;left:8px;top:8px;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border:.5px solid rgba(255,255,255,.45);border-radius:50%;background:rgba(0,0,0,.35);color:#fff;cursor:pointer;opacity:0;transition:opacity .15s}',
      '.mu-card:hover .mu-card-check,.mu-card-check.is-on{opacity:1}',
      '.mu-card-check.is-on{background:var(--dsw-static-deepseek-450,#5686fe);border-color:transparent}',
      '.mu-card-title{font-size:13px;font-weight:600;line-height:1.35}',
      '.mu-card-artist{font-size:11px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-card.is-current .mu-card-cover{box-shadow:0 0 0 2px var(--dsw-static-deepseek-450,#5686fe)}',
      '.mu-card.is-current .mu-card-title{color:var(--dsw-static-deepseek-450,#5686fe)}',
      '.mu-vlist-inner{position:relative}',
      '.mu-vlist-row{position:absolute;left:0;right:0}',
      '.mu-row{display:grid;grid-template-columns:calc(var(--mu-row-size,60px) + 4px) minmax(0,1.15fr) minmax(0,.85fr) 56px auto;align-items:center;gap:12px;padding:6px 10px;border-radius:var(--dsw-radius-md,8px);height:72px;box-sizing:border-box;position:relative}',
      '.mu-prefs{min-width:240px;padding:12px}',
      '.mu-prefs-panel{position:absolute;top:56px;right:24px;z-index:50;width:360px;max-width:calc(100% - 48px);max-height:70vh;overflow-y:auto;padding:14px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:var(--dsw-radius-xl,20px);background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-panel,0 16px 40px rgba(0,0,0,.5))}',
      '.mu-prefs-tabs{display:flex;gap:2px;padding:3px;margin-bottom:12px;border-radius:9px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06))}',
      '.mu-prefs-tab{flex:1;height:28px;border:0;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;cursor:pointer}',
      '.mu-prefs-tab.is-on{background:var(--dsw-alias-bg-layer-2,#2a2a2e);color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.35)}',
      '.mu-prefs-body{display:flex;flex-direction:column}',
      '.mu-prefs-body .mu-set-item:last-child{border-bottom:0;padding-bottom:0}',
      '.mu-prefs-hint{margin:0 0 8px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-prefs-empty{padding:10px 0;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-prefs-folder{display:flex;align-items:center;gap:6px;margin-bottom:6px}',
      '.mu-prefs-folder-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-prefs-confirm{margin-top:10px;padding:10px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.05));font-size:12px}',
      '.mu-prefs-confirm-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}',
      '.mu-browse{margin-top:8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));overflow:hidden}',
      '.mu-browse-head{padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06));font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mu-browse-path{width:100%;margin:8px 10px 0;width:calc(100% - 20px);height:28px;font-size:12px}',
      '.mu-browse-list{max-height:220px;overflow-y:auto}',
      '.mu-browse-item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;border:0;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font-size:13px;text-align:left;cursor:pointer}',
      '.mu-browse-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}',
      '.mu-browse-empty{padding:12px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-browse-actions{display:flex;justify-content:flex-end;gap:8px;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))}',
      '.mu-prefs-field{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0 4px}',
      '.mu-prefs-field-label{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-prefs-error{margin-top:6px;font-size:12px;color:var(--dsw-alias-label-warning,#f0a35e)}',
      '.mu-prefs-actions{display:flex;align-items:center;gap:8px;margin-top:10px}',
      '.mu-prefs-saved{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-input-sm{height:28px;font-size:12px}',
      '.mu-btn-sm{height:28px;padding:0 10px;font-size:12px}',
      '.mu-prefs-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:10px}',
      '.mu-prefs-value{color:var(--dsw-alias-label-secondary,#a1a1aa);font-variant-numeric:tabular-nums}',
      '.mu-prefs-hint{margin-top:10px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-confirm{padding:12px;min-width:220px;max-width:280px}',
      '.mu-confirm-text{font-size:13px;line-height:1.6;margin-bottom:12px;word-break:break-word}',
      '.mu-confirm-actions{display:flex;justify-content:flex-end;gap:8px}',
      '.mu-btn-danger{background:var(--dsw-alias-state-error-primary,#c0392b);color:var(--dsw-alias-label-primary-foreground,#fff);border-color:transparent}',
      '.mu-btn-danger:hover{opacity:.9}',
      '.mu-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}',
      '.mu-row.is-current{background:color-mix(in srgb,var(--dsw-static-deepseek-450,#5686fe) 8%,transparent);border-radius:10px;position:relative}',
      '.mu-row.is-current::before{content:"";position:absolute;left:3px;top:50%;transform:translateY(-50%);width:3px;height:20px;border-radius:2px;background:var(--dsw-static-deepseek-450,#5686fe)}',
      '.mu-row.is-current:hover{background:color-mix(in srgb,var(--dsw-static-deepseek-450,#5686fe) 12%,transparent)}',
      '.mu-row.is-current .mu-row-title{color:var(--dsw-static-deepseek-450,#5686fe);font-weight:600}',
      '.mu-row.is-current .mu-row-sub,.mu-row.is-current .mu-row-album,.mu-row.is-current .mu-row-dur{color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-row-play{position:relative;width:var(--mu-row-size,60px);height:var(--mu-row-size,60px);border:0;padding:0;background:transparent;cursor:pointer;border-radius:var(--dsw-radius-sm,6px);display:flex;align-items:center;justify-content:center}',
      '.mu-row-playmask{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:var(--dsw-radius-sm,6px);background:rgba(0,0,0,.45);color:#fff;opacity:0;transition:opacity .12s ease}',
      '.mu-row-play:hover .mu-row-playmask,.mu-row.is-current .mu-row-playmask{opacity:1}',
      '.mu-row.is-current .mu-row-playmask{background:rgba(0,0,0,.35)}',
      '.mu-row.is-selected{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}',
      '.mu-row.is-current.is-selected{background:color-mix(in srgb,var(--dsw-static-deepseek-450,#5686fe) 8%,transparent)}',
      '.mu-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}',
      '.mu-check{width:20px;height:20px;margin:0;padding:0;border:1.5px solid var(--dsw-alias-border-l3,rgba(255,255,255,.24));border-radius:50%;background:transparent;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none;opacity:0;transition:opacity .12s ease}',
      '.mu-row:hover .mu-check,.mu-row.is-selected .mu-check,.mu-check:focus-visible{opacity:1}',
      '.mu-check:hover{border-color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-check.is-on{background:var(--dsw-alias-button-primary-fill,#f4f4f5);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#141417)}',
      '.mu-cover{flex:none;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#26262b);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#71717a)}',
      '.mu-cover img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mu-row-main{min-width:0}',
      '.mu-row-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mu-eq{display:inline-flex;align-items:flex-end;gap:2px;height:12px;margin-right:8px;flex:none}',
      '.mu-eq i{display:block;width:2px;height:4px;border-radius:1px;background:var(--dsw-static-deepseek-450,#5686fe);opacity:.95}',
      '.mu-eq.is-playing i{animation:mu-eq-bounce .9s ease-in-out infinite}',
      '.mu-eq.is-playing i:nth-child(2){animation-delay:.15s}',
      '.mu-eq.is-playing i:nth-child(3){animation-delay:.3s}',
      '@keyframes mu-eq-bounce{0%,100%{height:4px}50%{height:12px}}',
      '.mu-row-sub{display:flex;align-items:center;gap:6px;margin-top:1px;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);min-width:0}',
      '.mu-cd{flex:none;padding:0 4px;border-radius:var(--dsw-radius-xs,4px);border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.2));color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:9px;font-weight:600;line-height:13px;letter-spacing:.4px}',
      '.mu-ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mu-row-album{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-row-dur{text-align:right;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);font-variant-numeric:tabular-nums}',
      '.mu-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:56px 16px;color:var(--dsw-alias-label-tertiary,#a1a1aa);text-align:center}',
      '.mu-state-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#e4e4e7)}',
      '.mu-state-sub{font-size:12px;max-width:420px;line-height:1.6;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-spinner{width:20px;height:20px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,rgba(255,255,255,.18));border-top-color:var(--dsw-alias-brand-primary,#f4f4f5);animation:mu-spin .8s linear infinite}',
      '@keyframes mu-spin{to{transform:rotate(360deg)}}',
      '.mu-warn{padding:4px 24px 8px;font-size:12px;color:var(--dsw-alias-state-warn-label,#e0a030)}',
      '.mu-menu{position:absolute;top:56px;right:24px;z-index:50;min-width:160px;max-height:70vh;overflow-y:auto;padding:4px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.4))}',
      '.mu-menu-item{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:4px 7px;border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-primary,#e4e4e7);font-size:12px;text-align:left;cursor:pointer}',
      '.mu-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mu-menu-item.is-on{color:var(--dsw-alias-brand-primary,#f4f4f5)}',
      '.mu-menu-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-bar{position:relative;flex:none;margin:0 10px 10px;padding:8px 12px 9px;border:.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:14px;background:rgba(24,24,28,.52);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#1a1a1e) 55%,transparent);-webkit-backdrop-filter:blur(24px) saturate(1.4);backdrop-filter:blur(24px) saturate(1.4);box-shadow:0 12px 32px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.07);overflow:hidden;transition:background .2s ease,box-shadow .2s ease}',
      '.mu-bar:hover{background:rgba(30,30,34,.62);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#1a1a1e) 60%,transparent);box-shadow:0 14px 36px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.09)}',
      '.mu-bar::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);pointer-events:none;z-index:1}',
      '.mu-bar-openable{cursor:pointer}',
      // The whole bar opens the player, so the hover highlight must cover the
      // whole bar too (it used to come from `.mu-bar-left.mu-clickable`, which
      // only lit the left half). A gradient overlay keeps the bar's own
      // bg-layer fill underneath the translucent hover token.
      '.mu-bar-openable:hover{background-image:linear-gradient(var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05)),var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05)))}',
      '.mu-bar-left:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#f4f4f5);outline-offset:2px;border-radius:8px}',
      '.mu-bar-openable button,.mu-bar-openable input{cursor:pointer}',
      '.mu-bar-openable .mu-clickable{cursor:pointer}',
      '.mu-seekwrap{position:absolute;left:0;right:0;top:0;height:5px;z-index:2}',
      '.mu-bar-buffer{position:absolute;left:0;top:1px;height:3px;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12));pointer-events:none}',
      '.mu-seek{position:absolute;left:0;top:0;width:100%;height:5px;-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;margin:0;padding:0}',
      '.mu-seek::-webkit-slider-runnable-track{height:2px;border-radius:2px;background:linear-gradient(to right,rgba(255,255,255,.95) var(--mu-p,0%),rgba(255,255,255,.16) var(--mu-p,0%))}',
      '.mu-seek::-webkit-slider-thumb{-webkit-appearance:none;width:8px;height:8px;margin-top:-3px;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);opacity:0;transition:opacity .12s ease}',
      '.mu-seek:hover::-webkit-slider-thumb{opacity:1}',
      '.mu-seek:disabled{opacity:.4;cursor:default}',
      '.mu-bar-main{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;padding-top:6px}',
      '.mu-bar-left{display:flex;align-items:center;gap:10px;min-width:0}',
      '.mu-bar-info{min-width:0;max-width:260px}',
      '.mu-bar-title{font-size:12.5px;font-weight:600}',
      '.mu-bar-artist{font-size:11px;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-top:1px}',
      '.mu-bar-controls{display:flex;align-items:center;gap:4px;justify-self:center}',
      '.mu-bar-wave{display:block;pointer-events:none;opacity:.95}',
      '.mu-side-wave-float{position:fixed;transform:translateY(-50%);pointer-events:none;z-index:1;opacity:.9}',
      '.mu-bar-wave-bg{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.25;-webkit-mask-image:linear-gradient(180deg,transparent,#000 55%);mask-image:linear-gradient(180deg,transparent,#000 55%)}',
      '.mu-bar > *:not(.mu-bar-wave-bg){position:relative;z-index:1}',
      '.mu-play-btn{width:36px;height:36px;border-radius:999px;border:0;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-button-primary-fill,#f4f4f5);color:var(--dsw-alias-label-primary-foreground,#141417);cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}',
      '.mu-play-btn:hover{transform:scale(1.06);box-shadow:0 6px 18px rgba(255,255,255,.22)}',
      '.mu-bar .mu-cover{box-shadow:0 4px 12px rgba(0,0,0,.35)}',
      '.mu-bar .mu-icon-btn:hover{background:rgba(255,255,255,.08)}',
      '.mu-bar .mu-icon-btn.is-on{color:var(--dsw-static-deepseek-450,#5686fe);background:rgba(86,134,254,.14)}',
      '.mu-play-btn:hover{background:var(--dsw-alias-button-primary-hover,#e4e4e7)}',
      '.mu-bar-right{display:flex;align-items:center;gap:4px;justify-self:end}',
      '.mu-quality{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#a1a1aa);font-variant-numeric:tabular-nums;white-space:nowrap;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.06)}',
      '.mu-pop{position:absolute;right:16px;bottom:84px;z-index:40;width:330px;max-height:58%;display:flex;flex-direction:column;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1,#1a1a1e);border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));box-shadow:var(--dsw-elevation-prominent,0 16px 48px rgba(0,0,0,.5));overflow:hidden}',
      '.mu-qoverlay{position:fixed;right:24px;bottom:96px;z-index:70;width:360px;max-width:calc(100vw - 48px);max-height:62vh;display:flex;flex-direction:column;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:14px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-prominent,0 16px 48px rgba(0,0,0,.5));overflow:hidden;user-select:none}',
      '.mu-qoverlay.is-dragging-panel{cursor:grabbing}',
      '.mu-qoverlay-now,.mu-qoverlay-head{cursor:grab}',
      '.mu-qoverlay-now:active,.mu-qoverlay-head:active{cursor:grabbing}',
      '.mu-qoverlay-now{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mu-qoverlay-now.is-empty{padding:14px 12px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:12px}',
      '.mu-qoverlay-now-main{flex:1;min-width:0}',
      '.mu-qoverlay-now-title{font-size:13px;font-weight:600}',
      '.mu-qoverlay-now-artist{font-size:11px;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-top:1px}',
      '.mu-qoverlay-now-controls{display:flex;align-items:center;gap:2px}',
      '.mu-qoverlay-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));font-size:12px;font-weight:600}',
      '.mu-qoverlay-head .mu-icon-btn{margin-left:auto}',
      '.mu-qoverlay-list{flex:1;min-height:0;overflow-y:auto;padding:6px}',
      '.mu-composer-queue-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer;flex:none}',
      '.mu-composer-queue-btn:hover{color:var(--dsw-alias-label-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mu-composer-queue-btn.is-on{color:var(--dsw-alias-brand-primary,#f4f4f5)}',
      '.mu-composer-queue-btn.is-playing::after{content:"";position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-brand-primary,#f4f4f5)}',
      '.mu-pop-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;font-size:12px;font-weight:600}',
      '.mu-pop-body{overflow-y:auto;padding:0 6px 8px}',
      '.mu-queue-row{display:grid;grid-template-columns:14px 26px minmax(0,1fr) minmax(0,70px) auto;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--dsw-radius-sm,6px);font-size:12px;cursor:pointer}',
      '.mu-queue-grip{cursor:grab;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:12px;line-height:1;letter-spacing:-2px;text-align:center;user-select:none}',
      '.mu-queue-row.is-dragging{opacity:.4}',
      '.mu-queue-row.is-drop-target{box-shadow:inset 0 2px 0 var(--dsw-alias-brand-primary,#f4f4f5)}',
      '.mu-queue-mode{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));white-space:nowrap}',
      '.mu-queue-actions{display:inline-flex;align-items:center;gap:2px;justify-self:end}',
      '.mu-queue-btn{width:20px;height:20px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:12px;line-height:20px;cursor:pointer}',
      '.mu-queue-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mu-queue-btn:disabled{opacity:.35;cursor:default}',
      '.mu-fav.is-on{color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mu-fav.is-on svg{fill:currentColor}',
      '.mu-addto{position:relative}',
      '.mu-addto-menu{position:absolute;right:0;top:calc(100% + 4px);z-index:53;min-width:210px;max-height:280px;overflow-y:auto;padding:4px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.45))}',
      '.mu-addto-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font-size:12px;text-align:left;cursor:pointer}',
      '.mu-addto-item:hover{background:var(--dsw-alias-bg-layer-2,#2a2a2e)}',
      '.mu-addto-count{margin-left:auto;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:11px;font-variant-numeric:tabular-nums}',
      '.mu-addto-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mu-addto-empty{padding:10px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-addto-scrim{position:fixed;inset:0;z-index:52}',
      '.mu-ctx-scrim{position:fixed;inset:0;z-index:89}',
      '.mu-ctx{position:fixed;z-index:90;min-width:200px;max-height:320px;overflow-y:auto;padding:4px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-prominent,0 16px 40px rgba(0,0,0,.5))}',
      '.mu-ctx-head{padding:6px 10px 4px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-ctx-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font-size:12px;text-align:left;cursor:pointer}',
      '.mu-ctx-item:hover{background:var(--dsw-alias-bg-layer-2,#2a2a2e)}',
      '.mu-ctx-item.is-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 16%,transparent);color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mu-ctx-arrow{margin-left:auto;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:14px;line-height:1}',
      '.mu-ctx-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mu-info-layer{position:fixed;inset:0;z-index:94;pointer-events:none}',
      '.mu-info-scrim{position:absolute;inset:0;background:rgba(0,0,0,.35);pointer-events:auto}',
      '.mu-info{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:440px;max-width:calc(100vw - 48px);max-height:70vh;overflow-y:auto;padding:16px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:14px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-prominent,0 20px 60px rgba(0,0,0,.55));pointer-events:auto}',
      '.mu-info-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}',
      '.mu-info-title{font-size:14px;font-weight:600}',
      '.mu-info-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}',
      '.mu-tag-editor{width:860px;max-width:calc(100vw - 64px);height:min(720px,86vh);max-height:none;padding:0;display:flex;flex-direction:column;overflow:hidden}',
      '.mu-tag-editor .mu-info-head{flex:none;padding:16px 22px 14px;margin:0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mu-tag-layout{flex:1;min-height:0;display:grid;grid-template-columns:232px 1fr;overflow:hidden}',
      '.mu-tag-aside{display:flex;flex-direction:column;gap:14px;padding:20px 18px;border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:linear-gradient(180deg,color-mix(in srgb,var(--dsw-static-deepseek-450,#5686fe) 6%,transparent),transparent 42%)}',
      '.mu-tag-cover{width:100%;aspect-ratio:1;border-radius:12px;object-fit:cover;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));box-shadow:0 12px 32px rgba(0,0,0,.35)}',
      '.mu-tag-cover-empty{display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-tag-aside-meta{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.mu-tag-aside-title{font-size:14px;font-weight:600}',
      '.mu-tag-aside-artist{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-tag-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
      '.mu-tag-badge{font-size:10px;line-height:1;padding:5px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-tag-aside-hint{margin-top:auto;font-size:10px;line-height:1.6;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-tag-main{overflow-y:auto;padding:20px 22px;display:flex;flex-direction:column;gap:18px}',
      '.mu-tag-section{display:flex;flex-direction:column;gap:10px}',
      '.mu-tag-section-title{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-tag-section-title::before{content:"";width:3px;height:12px;border-radius:2px;background:var(--dsw-static-deepseek-450,#5686fe)}',
      '.mu-tag-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}',
      '.mu-tag-field{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.mu-tag-label{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-tag-field .mu-input{width:100%;box-sizing:border-box}',
      '.mu-tag-lyrics{min-height:150px;resize:vertical;padding:10px 12px;line-height:1.6;height:auto;font-family:inherit}',
      '.mu-tag-hint{margin:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-tag-head-actions{display:flex;align-items:center;gap:8px}',
      '.mu-tag-head-actions .mu-chip{height:26px;padding:0 10px;font-size:11px}',
      '.mu-tag-online{display:flex;flex-direction:column;gap:6px;padding:10px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03));max-height:240px;overflow-y:auto}',
      '.mu-tag-online-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-tag-online-empty{padding:10px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-online-item{display:flex;align-items:center;gap:10px;width:100%;padding:6px;border:0;border-radius:8px;background:transparent;cursor:pointer;text-align:left;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mu-online-item:hover{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.05))}',
      '.mu-online-cover{width:36px;height:36px;flex:none;border-radius:6px;object-fit:cover;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:11px}',
      '.mu-online-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.mu-online-title{font-size:12px}',
      '.mu-online-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-tag-online-hint{font-size:10px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-tag-online-sources{display:flex;gap:8px;font-size:10px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-tag-footer{flex:none;display:flex;justify-content:flex-end;gap:8px;padding:12px 22px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mu-tag-cover-box{position:relative;display:flex;flex-direction:column;gap:8px}',
      '.mu-tag-cover-actions{display:flex;flex-wrap:wrap;gap:8px}',
      '.mu-tag-cover-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:28px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:7px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font-size:11px;cursor:pointer;white-space:nowrap}',
      '.mu-tag-cover-btn:hover{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));border-color:var(--dsw-static-deepseek-450,#5686fe)}',
      '.mu-tag-cover-btn.is-ghost{background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '@media (max-width:760px){.mu-tag-layout{grid-template-columns:1fr}.mu-tag-aside{border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));flex-direction:row;align-items:flex-start}.mu-tag-cover-box{width:120px;flex:none}.mu-tag-aside-meta{flex:1}.mu-tag-aside-hint{display:none}}',
      '@media (max-width:980px){.mu-np-body{grid-template-columns:1fr;gap:10px;padding:4px 20px}.mu-np-left{gap:10px}.mu-np-disc-wrap{margin-bottom:12px}.mu-np-right{width:100%;max-height:34vh}.mu-np-bottom{margin:0 16px 12px;padding:10px 12px 12px}.mu-np-head{padding:12px 16px 6px}.mu-np-title{font-size:16px}}',
      '.mu-tag-cover-hint{font-size:10px;line-height:1.4;color:var(--dsw-static-deepseek-450,#5686fe)}',
      '.mu-tag-field-head{display:flex;align-items:center;justify-content:space-between;gap:6px}',
      '.mu-tag-field-search{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;opacity:0;transition:opacity .12s}',
      '.mu-tag-field:hover .mu-tag-field-search,.mu-tag-field-search:focus{opacity:1}',
      '.mu-tag-field-search:hover{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));color:var(--dsw-static-deepseek-450,#5686fe)}',
      '.mu-match-layer{z-index:96}',
      '.mu-match-dialog{width:860px;max-width:calc(100vw - 64px);height:min(740px,86vh);max-height:none;padding:0;display:flex;flex-direction:column;overflow:hidden}',
      '.mu-match-dialog .mu-info-head{flex:none;padding:12px 18px;margin:0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mu-match-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-match-list{flex:1;min-height:0;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:6px}',
      '.mu-match-empty{padding:36px 0;text-align:center;font-size:13px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-match-item{display:grid;grid-template-columns:72px 1fr;gap:10px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03));cursor:pointer;text-align:left;color:var(--dsw-alias-label-primary,#f4f4f5);transition:border-color .12s,background .12s}',
      '.mu-match-item:hover{border-color:color-mix(in srgb,var(--dsw-static-deepseek-450,#5686fe) 45%,transparent);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.05))}',
      '.mu-match-thumb{display:block;width:72px;height:72px}',
      '.mu-match-cover{width:72px;height:72px;border-radius:8px;object-fit:cover;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.06));display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-match-info{display:flex;flex-direction:column;gap:2px;min-width:0;padding:0}',
      '.mu-match-title{font-size:13.5px;font-weight:600;line-height:1.35}',
      '.mu-match-artist{font-size:12px;line-height:1.3;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-match-album{font-size:11px;line-height:1.3;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-match-meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}',
      '.mu-match-badge{font-size:9.5px;line-height:1;padding:3px 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08));color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-match-badge.is-source{color:var(--dsw-static-deepseek-450,#5686fe);background:color-mix(in srgb,var(--dsw-static-deepseek-450,#5686fe) 14%,transparent)}',
      '.mu-match-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mu-tag-editor .mu-input:focus{outline:none;border-color:var(--dsw-alias-border-l3,rgba(255,255,255,.18));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));box-shadow:none}',
      '.mu-tag-editor .mu-input:focus-visible{outline:none}',
      '.mu-chip-sm{height:24px;padding:0 8px;font-size:11px}',
      '.mu-search-history{position:absolute;top:34px;right:0;z-index:20;display:flex;flex-wrap:wrap;gap:4px;max-width:320px;padding:6px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:8px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.35))}',
      '.mu-queue-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}',
      '.mu-queue-row.is-current{color:var(--dsw-alias-brand-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.08))}',
      '.mu-queue-index{font-size:12px;color:var(--dsw-alias-label-tertiary,#a1a1aa);font-variant-numeric:tabular-nums;display:inline-flex;align-items:center;justify-content:center;min-width:18px}',
      '.mu-queue-wave{opacity:.95}',
      '.mu-queue-artist{color:var(--dsw-alias-label-secondary,#a1a1aa);text-align:right;font-size:12px}',
      '.mu-more{width:280px;padding:10px 12px}',
      '.mu-more-info{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}',
      '.mu-more-row{display:flex;justify-content:space-between;gap:12px;font-size:12px}',
      '.mu-more-key{color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-more-val{color:var(--dsw-alias-label-primary,#e4e4e7);text-align:right}',
      '.mu-toast{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);z-index:50;padding:7px 12px;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-toast-bg,#2a2a2e);color:var(--dsw-alias-toast-label,#f4f4f5);font-size:12px;box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.4));pointer-events:none}',
      '.mu-side-icon{position:relative;display:inline-flex;align-items:center;justify-content:center}',
      '.mu-side-controls{position:fixed;display:flex;align-items:center;gap:2px;background:transparent;box-shadow:none;padding:0;transform:translateY(-50%);z-index:1000}',
      '.mu-side-btn{width:20px;height:20px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}',
      '.mu-side-btn:hover{color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mu-side-icon.is-active{color:var(--dsw-alias-brand-primary,#f4f4f5)}',
      '.mu-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#e4e4e7);font-size:13px;cursor:pointer}',
      '.mu-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mu-btn:disabled{opacity:.5;cursor:default}',
      '.mu-btn-accent{background:var(--dsw-alias-button-primary-fill,#f4f4f5);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#141417)}',
      '.mu-btn-accent:hover{background:var(--dsw-alias-button-primary-hover,#e4e4e7)}',
      '.mu-btn-ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-btn-ghost:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mu-btn-wide{width:100%;justify-content:flex-start;height:36px}',
      '.mu-set{display:flex;flex-direction:column;gap:10px;padding:4px 2px 18px;max-width:720px}',
      '.mu-set-title{font-size:20px;font-weight:600;line-height:28px;margin:0}',
      '.mu-set-sep{height:1px;margin:16px 0 12px;background:var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mu-set-tabs{display:flex;gap:4px;margin-bottom:10px}',
      '.mu-set-tab{height:30px;padding:0 12px;border:0;border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;cursor:pointer}',
      '.mu-set-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mu-set-tab.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600}',
      '.mu-set-panel{display:flex;flex-direction:column}',
      '.mu-set-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))}',
      '.mu-set-item-col{flex-direction:column;align-items:stretch;gap:8px}',
      '.mu-set-item-head{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.mu-set-value{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);font-variant-numeric:tabular-nums}',
      '.mu-switch{position:relative;width:44px;height:24px;padding:0;border:0;border-radius:12px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.12));cursor:pointer;flex:none}',
      '.mu-switch-dot{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--dsw-alias-label-secondary,#a1a1aa);transition:transform .15s ease,background .15s ease}',
      '.mu-switch.is-on{background:var(--dsw-alias-button-primary-fill,#f4f4f5)}',
      '.mu-switch.is-on .mu-switch-dot{transform:translateX(20px);background:var(--dsw-alias-bg-base,#141417)}',
      '.mu-range{width:100%;height:18px;-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer}',
      '.mu-range::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.14))}',
      '.mu-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);box-shadow:0 1px 3px rgba(0,0,0,.4)}',
      '.mu-set-choices{display:flex;gap:6px;flex-wrap:wrap}',
      '.mu-choice{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;cursor:pointer}',
      '.mu-choice:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mu-choice.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12));color:var(--dsw-alias-label-primary,#f4f4f5);border-color:transparent}',
      '.mu-set-order{display:flex;flex-direction:column;gap:4px}',
      '.mu-order-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:6px}',
      '.mu-order-text{flex:1;font-size:12px}',
      '.mu-set-hint{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);line-height:1.6}',
      '.mu-set-hint-sm{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mu-set-row{display:flex;align-items:center;gap:8px}',
      '.mu-set-label{font-size:12px;min-width:96px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-input{flex:1;min-width:0;height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4,rgba(255,255,255,.14));border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));font-family:inherit;font-size:13px;color:var(--dsw-alias-label-primary,#f4f4f5);outline:none}',
      '.mu-title-input{flex:none;box-sizing:border-box;height:28px;padding:0 6px;min-width:6em;max-width:320px;border-color:transparent;background:transparent;font-size:20px;font-weight:700}',
      '.mu-title-input:hover{border-color:var(--dsw-alias-border-l3,rgba(255,255,255,.12))}',
      '.mu-title-input:focus{border-color:var(--dsw-alias-brand-primary,#f4f4f5);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04))}',
      '.mu-input:focus{border-color:var(--dsw-alias-border-l3,rgba(255,255,255,.18))}',
      '.mu-input-num{max-width:96px;flex:none}',
      '.mu-set-empty{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-set-error{font-size:12px;color:var(--dsw-alias-label-error,#ff6b6b);white-space:pre-wrap}',
      '.mu-set-actions{display:flex;align-items:center;gap:10px;margin-top:4px}',
      '.mu-set-saved{font-size:12px;color:var(--dsw-alias-state-success-primary,#4ade80)}',
      '.mu-set-note{font-size:12px;color:var(--dsw-alias-label-tertiary,#73737d);margin:6px 0 0}',
      '.mu-scrim{position:absolute;inset:0 0 80px 0;z-index:35}',
      '.mu-set{display:flex;flex-direction:column;gap:10px;max-width:640px;user-select:none}',
      '.mu-mini{position:fixed;right:20px;bottom:84px;z-index:60;display:flex;align-items:center;gap:10px;width:260px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));border-radius:12px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.45));cursor:grab;touch-action:none;user-select:none}',
      '.mu-mini.is-corner{right:20px;bottom:84px}',
      '.mu-mini-info{flex:1;min-width:0}',
      '.mu-mini-title{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mu-mini-artist{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mu-mini-controls{display:flex;align-items:center;gap:2px;flex:none}',
      '.mu-composer-lyric{max-width:280px;padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary,#a1a1aa);pointer-events:none;user-select:none}',
      '.mu-composer-cluster{display:inline-flex;align-items:center;gap:2px;min-width:0;max-width:360px}',
      // No shell at all: transparent row, aligned with the composer card and
      // sitting right above it (the negative margin only cancels the composer
      // stack gap, it does not tuck under the card).
      '.mu-composer-bar-wrap{box-sizing:border-box;width:100%;padding:0 var(--dsh-composer-side-clearance,16px);margin-bottom:calc(0px - var(--dsh-composer-stack-gap,6px))}',
      '.mu-composer-bar{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;max-width:var(--dsh-composer-card-max-width,780px);margin:0 auto;padding:4px 14px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary,#8a8f98);background:transparent;pointer-events:none;user-select:none}',
      '.mu-composer-bar-left{display:flex;align-items:center;min-width:0;flex:0 1 auto;max-width:36%}',
      '.mu-composer-note{display:inline-flex;flex:none;margin-right:4px;color:var(--dsw-alias-brand-primary,#2f9e6e)}',
      '.mu-composer-track{display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;vertical-align:middle}',
      '.mu-composer-lyric-inline{flex:1 1 auto;min-width:0;overflow:hidden;text-align:center;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:14px;line-height:20px;white-space:nowrap;text-overflow:ellipsis;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%)}',
      '.mu-audio-host{position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none}',
      '.mu-clickable{cursor:pointer;border-radius:8px;padding:4px 6px;margin:-4px -6px;min-width:0}',
      '.mu-clickable:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}',
      '.mu-clickable:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#f4f4f5);outline-offset:2px}',
      '.mu-np{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base,#141417);color:var(--dsw-alias-label-primary,#f4f4f5);opacity:0;pointer-events:none;user-select:none;will-change:transform,opacity}',
      '.mu-np.is-open{opacity:1;pointer-events:auto}',
      '.mu-np-bg{position:absolute;inset:-40px;z-index:0;overflow:hidden}',
      '.mu-np-bg img{width:100%;height:100%;object-fit:cover;filter:blur(72px) saturate(1.35) brightness(.42);transform:scale(1.15)}',
      '.mu-np-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(10,10,12,.35),rgba(10,10,12,.72) 60%,rgba(10,10,12,.92));pointer-events:none}',
      '.mu-np-head{position:relative;z-index:2;display:flex;align-items:center;gap:8px;padding:16px 24px 8px}',
      '.mu-np-head-title{flex:1;min-width:0;text-align:center;font-size:14px;font-weight:600;opacity:.9}',
      '.mu-np-body{position:relative;z-index:2;flex:1;min-height:0;display:grid;grid-template-columns:minmax(200px,38%) minmax(0,1fr);align-items:center;gap:24px;padding:8px 40px}',
      '.mu-np-left{display:flex;flex-direction:column;align-items:center;gap:18px;min-width:0}',
      '.mu-np-disc-wrap{position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:30px}',
      '.mu-np-art{position:relative;z-index:1;width:min(340px,26vw);height:min(340px,26vw);border-radius:20px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141416;color:#71717a;box-shadow:0 34px 80px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.07)}',
      '.mu-np-disc{position:relative;width:min(380px,29vw);height:min(380px,29vw);flex:none;aspect-ratio:1;display:flex;align-items:center;justify-content:center;animation:mu-disc-spin 24s linear infinite;animation-play-state:paused}',
      '.mu-np-disc.is-playing{animation-play-state:running}',
      '.mu-np-disc.is-square{animation:none}',
      '.mu-np-vinyl{position:absolute;inset:-22px;aspect-ratio:1;border-radius:50%;clip-path:circle(50% at 50% 50%);background:repeating-radial-gradient(circle at 50% 50%,#141416 0 2px,#0b0b0d 2px 5px);box-shadow:inset 0 0 40px rgba(0,0,0,.85),0 18px 50px rgba(0,0,0,.5);z-index:0}',
      '.mu-np::after{content:"";position:absolute;inset:0;z-index:1;background:radial-gradient(50% 42% at 28% 26%,rgba(86,134,254,.16),transparent 72%),radial-gradient(40% 36% at 78% 74%,rgba(122,170,255,.08),transparent 70%);pointer-events:none}',
      '.mu-np-art::after{content:"";position:absolute;inset:0;border-radius:20px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset 0 -48px 70px rgba(0,0,0,.28);pointer-events:none;z-index:2}',
      '.mu-np-disc.is-circle .mu-np-art{border-radius:170px;clip-path:circle(50% at 50% 50%)}',
      '.mu-np-art img{width:100%;height:100%;object-fit:cover;display:block;border-radius:20px}',
      '.mu-np-disc.is-circle .mu-np-art img{border-radius:170px}',
      '.mu-np.mu-align-left .mu-np-line{text-align:left}',
      '.mu-np.mu-align-center .mu-np-line{text-align:center}',
      '.mu-np.mu-align-right .mu-np-line{text-align:right}',
      '@keyframes mu-disc-spin{to{transform:rotate(360deg)}}',
      '.mu-np-meta{text-align:center;min-width:0;max-width:420px}',
      '.mu-np-title{font-size:20px;font-weight:650}',
      '.mu-np-artist{font-size:13px;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-top:4px}',
      '.mu-np-right{height:100%;min-height:0;display:flex;align-items:center;justify-content:center}',
      '.mu-np-lyrics{position:relative;width:100%;max-width:560px;height:100%;max-height:420px;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent,#000 16%,#000 84%,transparent);mask-image:linear-gradient(180deg,transparent,#000 16%,#000 84%,transparent)}',
      '.mu-np-lyrics.is-static{overflow-y:auto;-webkit-mask-image:none;mask-image:none}',
      '.mu-np-lyrics.is-static .mu-np-line{opacity:.7;cursor:default;transform:none}',
      '.mu-np-lyrics-inner{transition:transform .55s cubic-bezier(.22,.61,.36,1);padding:0 8px}',
      '.mu-np-lyrics-empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:13px;text-align:center;padding:0 24px;line-height:1.7}',
      '.mu-np-line{padding:8px 6px;border-radius:8px;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;transition:color .25s ease,opacity .3s ease,transform .5s cubic-bezier(.22,.61,.36,1);transition-delay:calc(var(--mu-line-stagger,0) * 22ms);text-align:center;opacity:.42;transform:translateY(4px)}',
      '.mu-np-line:hover{color:var(--dsw-alias-label-secondary,#c4c4cc);opacity:.72}',
      '.mu-np-line.is-past{opacity:.34;transform:translateY(-4px)}',
      '.mu-np-line.is-active{color:var(--dsw-alias-label-primary,#f4f4f5);opacity:1;transform:translateY(0)}',
      '.mu-np-line-text{font-size:var(--mu-lyric-size,18px);line-height:1.6;font-weight:var(--mu-lyric-weight,500);white-space:normal;word-break:break-word;overflow-wrap:anywhere;letter-spacing:.01em}',
      '.mu-np-line.is-active .mu-np-line-text{font-weight:700;text-shadow:0 0 24px rgba(255,255,255,.12)}',
      '.mu-np-line-trans{font-size:var(--mu-lyric-trans,13px);line-height:1.5;margin-top:4px;opacity:.66}',
      '.mu-np-line.is-active .mu-np-line-trans{opacity:.85}',
      '.mu-np.is-blur .mu-np-line:not(.is-active){opacity:.34;filter:blur(1.2px)}',
      '.mu-np-head-actions{margin-left:auto;display:flex;align-items:center;gap:6px}',
      '.mu-trans-toggle{width:auto;padding:0 8px;font-size:12px;font-weight:600;line-height:1}',
      '.mu-np-settings{position:absolute;top:52px;right:20px;z-index:6;width:320px;max-width:calc(100% - 40px);padding:14px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.45))}',
      '.mu-np-offset-actions{display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap}',
      '.mu-np-setting-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:6px;line-height:1.5}',
      '.mu-np-setting-error{font-size:11px;color:var(--dsw-alias-state-error,#e5484d);margin-top:4px;word-break:break-word}',
      '.mu-leader-hint{font-size:10px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mu-np-setting{margin-bottom:14px}',
      '.mu-np-setting:last-child{margin-bottom:0}',
      '.mu-np-setting-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-np-setting-inline{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mu-np-range{width:100%;accent-color:var(--dsw-alias-brand-primary,#f4f4f5);cursor:pointer}',
      '.mu-np-toggle{position:relative;width:44px;height:24px;padding:0;border:0;border-radius:12px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.12));cursor:pointer;flex:none}',
      '.mu-np-toggle-dot{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--dsw-alias-label-secondary,#a1a1aa);transition:transform .15s ease,background .15s ease}',
      '.mu-np-toggle.is-on{background:var(--dsw-alias-brand-primary,#f4f4f5)}',
      '.mu-np-toggle.is-on .mu-np-toggle-dot{transform:translateX(20px);background:var(--dsw-alias-bg-base,#141417)}',
      '.mu-trans-toggle.is-on{color:var(--dsw-alias-brand-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1))}',
      '.mu-np-bottom{position:relative;z-index:2;margin:0 40px 18px;padding:12px 18px 14px;border:.5px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(16,16,20,.5);-webkit-backdrop-filter:blur(20px) saturate(1.3);backdrop-filter:blur(20px) saturate(1.3);box-shadow:0 18px 44px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06)}',
      '.mu-np-progress{margin-bottom:6px}',
      '.mu-seek-np{position:relative;left:auto;top:auto;width:100%;height:16px;margin:0}',
      '.mu-seek-np .mu-bar-buffer{top:6px}',
      '.mu-seek-np .mu-seek{top:4px;height:8px}',
      '.mu-np-bar{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px}',
      '.mu-np-time{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);font-variant-numeric:tabular-nums}',
      '.mu-np-time-sep{opacity:.6}',
      '.mu-np-controls{display:flex;align-items:center;gap:10px;justify-self:center}',
      '.mu-play-btn-lg{width:48px;height:48px}',
      '.mu-np-vol{display:flex;align-items:center;gap:8px;justify-self:end}',
      '.mu-icon-btn:focus-visible,.mu-btn:focus-visible,.mu-chip:focus-visible,.mu-play-btn:focus-visible,.mu-row-play:focus-visible,.mu-check:focus-visible,.mu-menu-item:focus-visible,.mu-search input:focus-visible,.mu-seek:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#f4f4f5);outline-offset:2px}',
    ].join('\n')

    // ── error boundary ───────────────────────────────────────────────────
    // A render error used to blank the whole panel; show the message instead.

    class MusicBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error: error }
      }

      componentDidCatch(error, info) {
        if (window.console !== undefined && typeof window.console.error === 'function') {
          window.console.error('[dsh-music-panel]', error, info)
        }
      }

      render() {
        if (this.state.error !== null) {
          return h(
            'div',
            { className: 'mu-root' },
            h(
              'div',
              { className: 'mu-state' },
              h('div', { className: 'mu-state-title' }, '音乐面板渲染出错'),
              h(
                'div',
                { className: 'mu-state-sub' },
                String((this.state.error && this.state.error.message) || this.state.error),
              ),
            ),
          )
        }
        return this.props.children
      }
    }

    // Composer seats live inside the host conversation tree; a throw there used
    // to take the whole conversation plugin down, so this boundary stays silent.
    class SilentBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        try {
          window.console.error('[dsh-music-panel:lyrics]', error)
        } catch (ignored) {
          // Console unavailable: nothing to report.
        }
      }

      render() {
        if (this.state.failed) return null
        return this.props.children
      }
    }

    // ── plugin ────────────────────────────────────────────────────────────

    return {
      name: 'dsh-music-panel',
      inject: ['slots', 'locale'],
      apply: function (ctx) {
        // The document language is only trustworthy once the host rendered.
        try {
          var htmlLang = document.documentElement.getAttribute('lang') || ''
          if (htmlLang !== '') LANG = String(htmlLang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
        } catch (error) {
          // keep the initial guess
        }

        // Follow the host UI language through its locale service.
        var locale = ctx.locale
        if (
          locale !== null &&
          locale !== undefined &&
          typeof locale.register === 'function' &&
          typeof locale.bind === 'function'
        ) {
          ctx.effect(function () {
            var dispose = locale.register('dsh-music-panel', DICTS)
            return function () {
              if (typeof dispose === 'function') dispose()
            }
          })
          try {
            var bound = locale.bind('dsh-music-panel')
            if (typeof bound === 'function') localeTranslate = bound
          } catch (error) {
            localeTranslate = null
          }
        }

        ctx.effect(function () {
          var style = document.createElement('style')
          style.dataset.plugin = 'dsh-music-panel'
          style.textContent = STYLE
          document.head.appendChild(style)
          return function () {
            style.remove()
          }
        })

        // The engine outlives the panel on purpose. On unload (including an
        // HMR re-execution) pause instead of destroying: the next execution
        // reuses this same singleton, so its queue and position survive.
        ctx.effect(function () {
          return function () {
            player.suspend()
          }
        })

        // Flush resume state / listening seconds when the page goes away.
        ctx.effect(function () {
          function onVisibility() {
            if (document.visibilityState === 'hidden') player.flushOnHide()
          }
          function onUnload() {
            player.flushOnHide()
          }
          document.addEventListener('visibilitychange', onVisibility)
          window.addEventListener('beforeunload', onUnload)
          return function () {
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('beforeunload', onUnload)
          }
        })

        // Only one tab may play. Web Locks gives an origin-wide singleton:
        // the first tab holds the lock, later tabs queue for it and take over
        // when the leader closes (the same pattern web-player PWAs use).
        ctx.effect(function () {
          try {
            if (
              typeof navigator === 'undefined' ||
              navigator.locks === undefined ||
              typeof navigator.locks.request !== 'function'
            ) {
              return
            }
            if (window.__dshMusicLeaderBound === true) return
            window.__dshMusicLeaderBound = true
            var LOCK = 'dsh-music-panel.player'
            function hold() {
              // The lock is released when the page unloads.
              return new Promise(function () {})
            }
            function becomeLeader() {
              player.setLeader(true)
              return hold()
            }
            navigator.locks
              .request(LOCK, { mode: 'exclusive', ifAvailable: true }, function (lock) {
                if (lock !== null && lock !== undefined) return becomeLeader()
                // Another tab is playing: wait in the queue, then take over.
                player.setLeader(false)
                return navigator.locks.request(LOCK, becomeLeader)
              })
              .catch(function () {
                player.setLeader(true)
              })
          } catch (error) {
            // Cross-tab coordination must never break the plugin's UI.
            player.setLeader(true)
          }
        })

        function mount(name, registration, component) {
          ctx.effect(function () {
            var dispose = ctx.slots.inject(name, function () {
              return ctx.slots.register(registration, component)
            })
            return function () {
              if (typeof dispose === 'function') dispose()
            }
          })
        }

        // Resident audio host: stays mounted across main-panel switches.
        mount('shell.overlay', { name: 'shell.overlay', id: 'music-player', order: 15 }, AudioHost)

        mount(
          'sidebar.panellist',
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            label: function () {
              return t('nav.label')
            },
          },
          function (owner) {
            return h(MusicSideIcon, owner || {})
          },
        )

        mount('main', { name: 'main', key: PANEL_ID }, function () {
          return h(MusicBoundary, null, h(MusicPanel))
        })

        // Composer music cluster: the inline lyric and the playlist button are
        // one component, rendered before the submit action. The "above" lyric
        // stays in its own dock seat and is chosen by the position preference.
        mount(
          'conversation.input.dock',
          { name: 'conversation.input.dock', id: 'music-lyrics-above' },
          function () {
            return h(SilentBoundary, null, h(ComposerLyrics, { place: 'above' }))
          },
        )

        // Shared playback list overlay (the mini player lives in its header).
        mount('shell.overlay', { name: 'shell.overlay', id: 'music-queue', order: 16 }, QueueOverlay)
        mount(
          'conversation.input.right',
          { name: 'conversation.input.right', id: 'music-composer-cluster', order: 10 },
          ComposerCluster,
        )

      },
    }
  },
})
