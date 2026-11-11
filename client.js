/**
 * dsh-music-panel — Web Client half.
 *
 * GENERATED FILE. Edit src/** instead, then run: node scripts/build-client.mjs
 */

window.__ModuleLoader__.load({
  id: 'dsh-music-panel',
  factory: function (require) {
    'use strict'
    var APP_VERSION = "0.26.0"

    // ── src/00-runtime.js
    /**
     * runtime: React bindings, plugin constants.
     *
     * Every other fragment runs in the same factory scope, so these names are
     * shared by all of them; the build script fails on duplicate declarations.
     */
    
    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef
    var useMemo = React.useMemo
    var useCallback = React.useCallback
    var useLayoutEffect = React.useLayoutEffect || React.useEffect
    
    var PANEL_ID = 'music'
    var PREFS_EVENT = 'dsh-music:prefs-changed'

    // ── src/00-host-ui.js
    /**
     * Optional host UI kit.
     *
     * DSH exposes its own primitives to plugin bundles. We prefer them so controls
     * look and behave exactly like the host, but the load is best-effort: tests,
     * the harness, or a future DSH without this module fall back to the local
     * primitives (same markup we render today).
     *
     * Rules: docs/theme-guidelines.md.
     */
    
    var hostUi = null
    try {
      hostUi = require('@deepseek-ai/dsh-client-ui-primitives')
    } catch (error) {
      hostUi = null
    }
    
    function hostComponent(name) {
      if (!hostUi) return null
      var value = hostUi[name]
      if (typeof value === 'function') return value
      if (value && typeof value === 'object' && value.$$typeof) return value
      return null
    }
    
    /** Local icon name -> host icon component. Unmapped names keep the local SVG. */
    var HOST_ICON_MAP = {
      search: 'IconSearchOutlineRegular',
      settings: 'IconSettingsOutlineRegular',
      plus: 'IconPlusOutlineRegular',
      trash: 'IconTrashOutlineRegular',
      user: 'IconUserOutlineRegular',
      refresh: 'IconRefreshOutlineRegular',
      play: 'IconPlayOutlineRegular',
      pause: 'IconPauseOutlineRegular',
      info: 'IconInfoOutlineRegular',
      warning: 'IconWarningOutlineRegular',
      download: 'IconDownloadOutlineRegular',
      edit: 'IconEditOutlineRegular',
      copy: 'IconCopyOutlineRegular',
      clock: 'IconClockOutlineRegular',
      folder: 'IconFolderOpenOutlineRegular',
      check: 'IconCheckOutlineRegular',
      checkCircle: 'IconCheckCircleOutlineRegular',
      x: 'IconCloseOutlineRegular',
      more: 'IconEllipsisOutlineRegular',
      chevronDown: 'IconChevronDownOutlineRegular',
      chevronLeft: 'IconChevronLeftOutlineRegular',
      chevronRight: 'IconChevronRightOutlineRegular',
      chevronUp: 'IconChevronUpOutlineRegular',
      sort: 'IconChevronsUpDownOutlineRegular',
      list: 'IconQueueOutlineRegular',
    }

    // ── src/05-i18n.js
    /**
     * locale dictionaries, language detection and t().
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */
    
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
        'page.locateCurrent': '定位到当前播放',
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
        'page.tabSongs': '本地歌曲',
        'page.tabLocal': '本地音乐',
        'page.tabFavorites': '我喜欢',
        'page.favorite': '喜欢',
        'page.unfavorite': '取消喜欢',
        'page.favoritesEmpty': '还没有收藏',
        'page.favoritesHint': '点歌曲右侧的爱心加入喜欢。',
        'settings.tabOnline': '在线',
        'online.settingsHint': '登录后可播放高音质与更多曲目；未登录只能播放免费曲目。Cookie 只保存在本机。',
        'online.loggedIn': '已登录',
        'online.loggedOut': '未登录',
        'online.login': '登录',
        'online.loginWechat': '微信登录',
        'online.loginQq': 'QQ 登录',
        'online.logout': '退出',
        'online.loginHint': '扫码登录：用对应 App 扫描弹出的二维码并确认，登录状态保存在本机。',
        'online.loginTitle': '登录 {provider}',
        'online.statuswaiting': '等待扫码',
        'online.statusscanned': '已扫码，请在 App 中确认',
        'online.statussuccess': '登录成功',
        'online.statusexpired': '二维码已过期，请重新登录',
        'online.statusfailed': '登录失败',
        'online.loginSuccess': '登录成功',
        'online.logoutDone': '已退出登录',
        'online.providerNetease': '网易云',
        'online.providerQq': 'QQ 音乐',
        'online.providerKugou': '酷狗',
        'online.searchPlaceholder': '搜索在线音乐…',
        'online.searching': '搜索中…',
        'online.hint': '选择平台并搜索。未登录可播放免费曲目；登录后可用高音质（设置 → 在线音乐）。',
        'online.vip': 'VIP',
        'online.recent': '最近播放',
        'online.myPlaylists': '我的歌单',
        'online.viewAll': '查看全部',
        'online.searchResults': '搜索结果',
        'online.emptyResults': '没有找到歌曲',
        'online.locatePlaying': '定位到正在播放',
        'online.noPlaying': '当前没有正在播放的歌曲',
        'online.clearUnplayable': '清除无法播放的歌曲',
        'online.clearedUnplayable': '已移除 {n} 首无法播放的歌曲',
        'online.removeFromHistory': '从最近播放中移除',
        'online.removedFromHistory': '已从最近播放中移除',
        'online.vipOnly': 'VIP / 付费曲目无法播放（需要会员）',
        'online.quality': '音质',
        'online.qualityStandard': '标准',
        'online.qualityHigh': '高音质',
        'online.qualityLossless': '无损',
        'online.qualitySaved': '音质设置已保存',
        'online.cache': '缓存',
        'online.cacheSize': '已缓存 {files} 项 · {n}',
        'online.refresh': '刷新',
        'online.clearCache': '清空缓存',
        'online.cacheCleared': '缓存已清空',
        'online.cached': '已缓存',
        'online.cacheProgress': '缓存中 {pct}%',
        'online.cacheList': '缓存列表',
        'online.cacheEmpty': '还没有缓存的歌曲',
        'online.removeCache': '删除缓存',
        'online.cacheRemoved': '已删除该缓存',
        'online.hasLyric': '含歌词',
        'online.networkError': '网络请求失败，请检查网络后重试',
        'online.loginExpired': '登录已过期，请重新登录（设置 → 在线）',
        'online.playFailed': '在线播放失败，已自动跳过',
        'online.online': '在线',
        'online.modeSearch': '搜索',
        'online.modePlaylists': '我的歌单',
        'online.back': '返回',
        'online.playlistsHint': '登录后可在这里查看「我的歌单」；请先在 设置 → 在线 扫码登录。',
        'page.tabStats': '统计',
        'page.tabAlbums': '专辑',
        'page.tabArtists': '艺术家',
        'page.tabFolders': '文件夹',
        'page.folder': '文件夹',
        'page.folderEmpty': '没有找到文件夹',
        'page.unknownAlbum': '未知专辑',
        'page.clearFilter': '清除',
        'page.trackCountUnit': '{n} 首',
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
        'page.favoriteSelected': '喜欢选中',
        'page.batchEdit': '批量编辑',
        'page.batchHint': '将修改选中的 {n} 首歌曲，留空的字段保持不变',
        'page.batchSaved': '已更新 {n} 首',
        'page.batchEmpty': '没有要修改的字段',
        'page.keepEmpty': '留空则不修改',
        'page.duplicates': '重复 {n} 组',
        'page.duplicatesTitle': '重复歌曲',
        'page.duplicatesHint': '标题、艺术家与时长相同，可能是重复文件',
        'page.deleteDuplicates': '删除重复（保留音质最好的）',
        'page.deleteDuplicatesConfirm': '按码率 → 采样率 → 文件大小保留最好的一首，把其余 {n} 个移到插件回收站（可恢复），继续？',
        'page.duplicatesRemoved': '已移除 {n} 个文件',
        'page.onlineLyrics': '在线歌词',
        'page.onlineLyricsAction': '搜索',
        'page.lyricsSearch': '搜索',
        'page.lyricsSearchPlaceholder': '歌名 艺术家',
        'page.lyricsNoResults': '没有找到歌词',
        'page.lyricsPreviewHint': '选择一首歌查看歌词',
        'page.lyricsSave': '保存为 .lrc',
        'page.lyricsApply': '应用',
        'page.lyricsSaved': '歌词已写入文件内嵌',
        'settings.sleepTimer': '睡眠定时',
        'settings.sleepOff': '关闭',
        'settings.sleepTimerDone': '睡眠定时已到，已暂停播放',
        'onboarding.title': '欢迎使用音乐插件',
        'onboarding.skip': '跳过',
        'onboarding.back': '上一步',
        'onboarding.next': '下一步',
        'onboarding.start': '开始使用',
        'onboarding.pickFolder': '选择文件夹',
        'onboarding.reopen': '查看使用引导',
        'onboarding.step1Icon': '📂',
        'onboarding.step1Title': '添加你的音乐文件夹',
        'onboarding.step1Text': '在空曲库页面点「添加文件夹」，选择你的音乐目录。插件会扫描歌曲、封面和标签，全程在你本机完成。',
        'onboarding.step2Icon': '▶️',
        'onboarding.step2Title': '双击播放',
        'onboarding.step2Text': '双击任意歌曲开始播放；底栏可以切歌、打开队列、切换随机。空格暂停 / 继续，Ctrl/⌘ + ←/→ 切歌。',
        'onboarding.step3Icon': '🎧',
        'onboarding.step3Title': '让曲库更完整',
        'onboarding.step3Text': '右键歌曲可编辑元数据、在线匹配封面与标签、搜索在线歌词；播放页「Aa」调整歌词样式，设置页管理外观与播放行为。',
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
        'settings.foldersTitle': '音乐文件夹',
        'settings.scannedTracks': '已扫描 {n} 首',
        'settings.scanSettings': '扫描设置',
        'settings.openTrash': '打开',
        'settings.formatsHint': '支持 MP3 / FLAC / M4A / AAC / OGG / OPUS / WAV / AIFF / WMA / APE',
        'settings.scanWarnings': '{n} 条扫描警告',
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
        'page.locateCurrent': 'Locate current track',
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
        'page.tabSongs': 'Local songs',
        'page.tabLocal': 'Local',
        'page.tabFavorites': 'Liked',
        'page.favorite': 'Like',
        'page.unfavorite': 'Unlike',
        'page.favoritesEmpty': 'No liked songs yet',
        'page.favoritesHint': 'Tap the heart next to a song to add it here.',
        'settings.tabOnline': 'Online',
        'online.settingsHint': 'Sign in for higher quality and more tracks; free tracks play without an account. Cookies stay on this machine.',
        'online.loggedIn': 'Signed in',
        'online.loggedOut': 'Signed out',
        'online.login': 'Sign in',
        'online.loginWechat': 'WeChat sign-in',
        'online.loginQq': 'QQ sign-in',
        'online.logout': 'Sign out',
        'online.loginHint': 'Scan the QR code with the matching app, then confirm in the app. The login stays on this machine.',
        'online.loginTitle': 'Sign in to {provider}',
        'online.statuswaiting': 'Waiting for scan',
        'online.statusscanned': 'Scanned — confirm in the app',
        'online.statussuccess': 'Signed in',
        'online.statusexpired': 'QR expired — try again',
        'online.statusfailed': 'Sign-in failed',
        'online.loginSuccess': 'Signed in',
        'online.logoutDone': 'Signed out',
        'online.providerNetease': 'NetEase',
        'online.providerQq': 'QQ Music',
        'online.providerKugou': 'KuGou',
        'online.searchPlaceholder': 'Search online music…',
        'online.searching': 'Searching…',
        'online.hint': 'Pick a provider and search. Free tracks play without signing in; sign in (Settings → Online) for higher quality.',
        'online.vip': 'VIP',
        'online.recent': 'Recently played',
        'online.myPlaylists': 'My playlists',
        'online.viewAll': 'View all',
        'online.searchResults': 'Results',
        'online.emptyResults': 'No tracks found',
        'online.locatePlaying': 'Locate playing track',
        'online.noPlaying': 'Nothing is playing right now',
        'online.clearUnplayable': 'Remove unplayable tracks',
        'online.clearedUnplayable': 'Removed {n} unplayable track(s)',
        'online.removeFromHistory': 'Remove from recently played',
        'online.removedFromHistory': 'Removed from recently played',
        'online.vipOnly': 'VIP / paid tracks cannot play without a membership',
        'online.quality': 'Quality',
        'online.qualityStandard': 'Standard',
        'online.qualityHigh': 'High',
        'online.qualityLossless': 'Lossless',
        'online.qualitySaved': 'Quality saved',
        'online.cache': 'Cache',
        'online.cacheSize': '{files} items · {n}',
        'online.refresh': 'Refresh',
        'online.clearCache': 'Clear cache',
        'online.cacheCleared': 'Cache cleared',
        'online.cached': 'Cached',
        'online.cacheProgress': 'Caching {pct}%',
        'online.cacheList': 'Cache',
        'online.cacheEmpty': 'Nothing cached yet',
        'online.removeCache': 'Remove from cache',
        'online.cacheRemoved': 'Removed',
        'online.hasLyric': 'lyrics',
        'online.networkError': 'Network request failed, please retry',
        'online.loginExpired': 'Sign-in expired, please sign in again (Settings → Online)',
        'online.playFailed': 'Online playback failed — skipped',
        'online.online': 'Online',
        'online.modeSearch': 'Search',
        'online.modePlaylists': 'My playlists',
        'online.back': 'Back',
        'online.playlistsHint': 'Sign in to see your playlists here; use Settings → Online to scan a QR code.',
        'page.tabStats': 'Stats',
        'page.tabAlbums': 'Albums',
        'page.tabArtists': 'Artists',
        'page.tabFolders': 'Folders',
        'page.folder': 'Folder',
        'page.folderEmpty': 'No folders found',
        'page.unknownAlbum': 'Unknown album',
        'page.clearFilter': 'Clear',
        'page.trackCountUnit': '{n} songs',
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
        'page.favoriteSelected': 'Like selected',
        'page.batchEdit': 'Batch edit',
        'page.batchHint': 'Applies to {n} selected songs; empty fields are left untouched',
        'page.batchSaved': 'Updated {n} songs',
        'page.batchEmpty': 'No fields to change',
        'page.keepEmpty': 'Leave empty to keep',
        'page.duplicates': '{n} duplicates',
        'page.duplicatesTitle': 'Duplicate songs',
        'page.duplicatesHint': 'Same title, artist and duration — possibly the same file twice',
        'page.deleteDuplicates': 'Delete duplicates (keep best quality)',
        'page.deleteDuplicatesConfirm': 'Keep the best of each group by bitrate → sample rate → file size, and move the other {n} files to the plugin trash (recoverable)?',
        'page.duplicatesRemoved': 'Moved {n} files',
        'page.onlineLyrics': 'Online lyrics',
        'page.onlineLyricsAction': 'Search',
        'page.lyricsSearch': 'Search',
        'page.lyricsSearchPlaceholder': 'title artist',
        'page.lyricsNoResults': 'No lyrics found',
        'page.lyricsPreviewHint': 'Pick a result to preview',
        'page.lyricsSave': 'Save as .lrc',
        'page.lyricsApply': 'Apply',
        'page.lyricsSaved': 'Lyrics written into the file',
        'settings.sleepTimer': 'Sleep timer',
        'settings.sleepOff': 'Off',
        'settings.sleepTimerDone': 'Sleep timer finished — playback paused',
        'onboarding.title': 'Welcome to dsh-music-panel',
        'onboarding.skip': 'Skip',
        'onboarding.back': 'Back',
        'onboarding.next': 'Next',
        'onboarding.start': 'Get started',
        'onboarding.pickFolder': 'Pick a folder',
        'onboarding.reopen': 'Show the guide',
        'onboarding.step1Icon': '📂',
        'onboarding.step1Title': 'Add your music folder',
        'onboarding.step1Text': 'On the empty library page, click "Add folder" and pick your music directory. Everything is scanned locally — covers, tags and all.',
        'onboarding.step2Icon': '▶️',
        'onboarding.step2Title': 'Double-click to play',
        'onboarding.step2Text': 'Double-click any song to start; the bar below handles next/previous, the queue and shuffle. Space pauses, Ctrl/⌘ + ←/→ skips.',
        'onboarding.step3Icon': '🎧',
        'onboarding.step3Title': 'Make the library complete',
        'onboarding.step3Text': 'Right-click a song to edit tags, match covers and metadata online, or search online lyrics. The "Aa" panel on the player page tunes the lyric style.',
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
        'settings.foldersTitle': 'Music folders',
        'settings.scannedTracks': '{n} tracks scanned',
        'settings.scanSettings': 'Scan settings',
        'settings.openTrash': 'Open',
        'settings.formatsHint': 'MP3 / FLAC / M4A / AAC / OGG / OPUS / WAV / AIFF / WMA / APE',
        'settings.scanWarnings': '{n} scan warnings',
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

    // ── src/06-strings.js
    /**
     * strings: keys introduced by the v2 UI.
     *
     * The large zh/en dictionaries from 0.11.1 stay in 05-i18n; this file only adds
     * the labels the new shell needs, so both languages keep working.
     */
    
    var EXTRA_STRINGS = {
      zh: {
        'v2.songs': '歌曲',
        'v2.albums': '专辑',
        'v2.artists': '歌手',
        'v2.folders': '文件夹',
        'v2.favorites': '喜欢',
        'v2.playlists': '歌单',
        'v2.stats': '统计',
        'v2.recent': '最近播放',
        'v2.cache': '缓存',
        'v2.sectionLibrary': '音乐库',
        'v2.sectionCollection': '收藏',
        'v2.sectionOnline': '在线',
        'v2.allSongs': '全部歌曲',
        'v2.layout': '布局',
        'v2.layoutTop': '顶栏分区',
        'v2.layoutRail': '左侧导航',
        'v2.layoutHint': '顶栏分区不会和宿主左侧栏重复；左侧导航适合歌单很多时常驻浏览。',
        'v2.clearFilter': '全部',
        'v2.loading': '正在加载…',
        'v2.scanning': '正在扫描曲库…',
        'v2.scanFailed': '曲库加载失败',
        'v2.noTracks': '还没有音乐',
        'v2.noTracksHint': '在设置 → 音乐库添加文件夹，然后点刷新。',
        'v2.noFavorites': '还没有喜欢的歌',
        'v2.noFavoritesHint': '点歌曲右侧的爱心加入喜欢。',
        'v2.noPlaylistTracks': '这个歌单还没有歌',
        'v2.noHistory': '还没有播放记录',
        'v2.noHistoryHint': '在线播放过的歌会出现在这里。',
        'v2.noPlaylists': '还没有歌单',
        'v2.newPlaylist': '新建歌单',
        'v2.playlistName': '歌单名称',
        'v2.rename': '重命名',
        'v2.delete': '删除',
        'v2.close': '关闭',
        'v2.back': '全部',
        'v2.cached': '已缓存',
        'v2.cacheProgress': '缓存中 {pct}%',
        'v2.sortTitle': '标题',
        'v2.sortArtist': '歌手',
        'v2.sortDuration': '时长',
        'v2.sortAdded': '添加时间',
        'v2.sortRecent': '最近播放',
        'v2.appearance': '外观',
        'v2.lyrics': '歌词',
        'v2.playback': '播放',
        'v2.library': '音乐库',
        'v2.folderAdd': '添加文件夹',
        'v2.folderPick': '选择文件夹',
        'v2.folderUp': '上一级',
        'v2.folderHere': '使用此文件夹',
        'v2.folderHidden': '已隐藏',
        'v2.folderVisible': '显示中',
        'v2.folderHideHint': '隐藏这个文件夹里的歌曲',
        'v2.folderAdded': '已添加文件夹',
        'v2.folderEmpty': '没有子文件夹',
        'v2.folderBrowse': '浏览…',
        'online.addedToCloudPlaylist': '已加入歌单',
        'online.noCloudPlaylists': '还没有云端歌单',
        'online.addToCloudPlaylist': '添加到歌单',
    
        'v2.online': '在线',
        'v2.cacheTab': '缓存',
        'v2.about': '关于',
        'online.cacheSongs': '缓存歌曲',
        'online.qqAccount': 'QQ 音乐用户',
        'online.cacheNoSongs': '还没有缓存的歌曲',
        'v2.playlistSort': '歌单排序',
        'v2.sortSource': '平台顺序',
        'v2.sortName': '名称',
        'v2.sortCount': '歌曲数',
        'about.tagline': '本地与在线音乐，一个面板。',
        'about.version': '版本',
        'about.project': '项目',
        'about.license': '许可证',
        'about.author': '作者',
        'about.feedback': '问题反馈',
        'about.description': '多目录曲库、网易云 / QQ / 酷狗在线播放、歌词翻译、标签与封面编辑、音频缓存、统计与回收站。',
        'about.source': 'GitHub 源码',
        'about.npm': 'npm 包',
        'settings.volumeNormalize': '音量均衡',
        'settings.volumeNormalizeOff': '已关闭',
        'settings.volumeNormalizeReady': '已生效 · 内置 EBU R128 分析',
        'settings.volumeNormalizeMissing': '未生效 · 浏览器不支持 Web Audio',
        'settings.volumeNormalizeMissingHint': '请使用支持 Web Audio 的 DSH Web / Desktop。',
        'settings.volumeNormalizeOff': 'Disabled',
        'settings.volumeNormalizeReady': 'Active · built-in EBU R128 analysis',
        'settings.volumeNormalizeMissing': 'Not active · Web Audio unsupported',
        'settings.volumeNormalizeMissingHint': 'Use a DSH Web / Desktop build with Web Audio support.',
        'settings.volumeNormalizeHint': '浏览器内置 EBU R128 分析，按曲目响度自动调整增益；首次分析需要几秒。',
        'v2.listenTime': '累计播放时长',
        'v2.totalPlays': '总播放次数',
        'v2.trackedTracks': '有记录曲目',
        'v2.rangeAll': '全部时间',
        'v2.rangeWeek': '最近一周',
        'v2.rangeMonth': '最近一月',
        'v2.playing': '正在播放',
        'v2.lyricSettings': '歌词设置',
        'v2.removeSelectedConfirm': '把选中的 {n} 首移到回收站（可恢复）？',
        'v2.removed': '已移除 {n} 首',
        'v2.match': '在线匹配',
        'v2.minutes': '{n} 分钟',
        'v2.pickTrack': '从列表里选一首歌开始播放',
        'v2.selAll': '全部选择',
        'v2.hostKit': '宿主组件',
        'v2.hostKitDesc': 'native = 正在使用 DSH 官方组件；fallback = 本地回退实现',
        'v2.hostKitNative': 'native',
        'v2.hostKitFallback': 'fallback',
        'v2.selNone': '全部取消',
        'v2.selRange': '区域选择',
        'v2.selInvert': '反向选择',
        'v2.rangePickHint': '区域选择：先点起点，再点终点',
        'v2.searchFocus': '搜索',
        'v2.sleepRemaining': '剩余 {time}',
        'v2.sleepCancel': '取消定时',
        'v2.cover': '封面',
        'v2.matchHint': '点整行应用全部；点字段只应用该字段',
        'v2.trash': '回收站',
        'v2.trashHint': '删除的曲目会移到这里，可随时恢复',
        'v2.trashEmpty': '回收站是空的',
        'v2.restore': '恢复',
        'v2.restored': '已恢复：{name}',
        'v2.trashNoPath': '原路径未知',
        'v2.spin': '封面旋转',
        'v2.spinDesc': '播放时唱片转动',
        'v2.roundCover': '圆形封面',
        'v2.vinylRing': '黑胶环',
        'v2.vinylRingDesc': '圆形封面外圈的唱片纹路',
        'v2.roundCoverDesc': '列表行使用圆形封面',
        'v2.paused': '已暂停',
        'v2.filters': '筛选',
        'v2.albumFilter': '专辑：{name}',
        'v2.artistFilter': '歌手：{name}',
        'v2.folderFilter': '文件夹：{name}',
        'v2.playAllHint': '从第一首开始播放',
        'v2.queueHint': '点击播放，右键更多操作',
        'v2.loginNeeded': '登录后可查看歌单',
        'v2.relogin': '重新登录',
        'v2.logout': '退出登录',
      },
      en: {
        'v2.songs': 'Songs',
        'v2.albums': 'Albums',
        'v2.artists': 'Artists',
        'v2.folders': 'Folders',
        'v2.favorites': 'Favorites',
        'v2.playlists': 'Playlists',
        'v2.stats': 'Stats',
        'v2.recent': 'Recent',
        'v2.cache': 'Cache',
        'v2.sectionLibrary': 'Library',
        'v2.sectionCollection': 'Collection',
        'v2.sectionOnline': 'Online',
        'v2.allSongs': 'All songs',
        'v2.layout': 'Layout',
        'v2.layoutTop': 'Top sections',
        'v2.layoutRail': 'Left rail',
        'v2.layoutHint': 'Top sections avoid a second sidebar next to the host; the left rail is better for many playlists.',
        'v2.clearFilter': 'All',
        'v2.loading': 'Loading…',
        'v2.scanning': 'Scanning library…',
        'v2.scanFailed': 'Failed to load library',
        'v2.noTracks': 'No music yet',
        'v2.noTracksHint': 'Add a folder in Settings → Library, then refresh.',
        'v2.noFavorites': 'No favorites yet',
        'v2.noFavoritesHint': 'Use the heart on a row to add one.',
        'v2.noPlaylistTracks': 'This playlist is empty',
        'v2.noHistory': 'No history yet',
        'v2.noHistoryHint': 'Tracks you play online show up here.',
        'v2.noPlaylists': 'No playlists yet',
        'v2.newPlaylist': 'New playlist',
        'v2.playlistName': 'Playlist name',
        'v2.rename': 'Rename',
        'v2.delete': 'Delete',
        'v2.close': 'Close',
        'v2.back': 'All',
        'v2.cached': 'Cached',
        'v2.cacheProgress': 'Caching {pct}%',
        'v2.sortTitle': 'Title',
        'v2.sortArtist': 'Artist',
        'v2.sortDuration': 'Duration',
        'v2.sortAdded': 'Date added',
        'v2.sortRecent': 'Recently played',
        'v2.appearance': 'Appearance',
        'v2.lyrics': 'Lyrics',
        'v2.playback': 'Playback',
        'v2.library': 'Library',
        'v2.folderAdd': 'Add folder',
        'v2.folderPick': 'Choose folder',
        'v2.folderUp': 'Up',
        'v2.folderHere': 'Use this folder',
        'v2.folderHidden': 'Hidden',
        'v2.folderVisible': 'Visible',
        'v2.folderHideHint': 'Hide songs inside this folder',
        'v2.folderAdded': 'Folder added',
        'v2.folderEmpty': 'No subfolders',
        'v2.folderBrowse': 'Browse…',
        'online.addedToCloudPlaylist': 'Added to playlist',
        'online.noCloudPlaylists': 'No cloud playlists yet',
        'online.addToCloudPlaylist': 'Add to playlist',
    
        'v2.online': 'Online',
        'v2.cacheTab': 'Cache',
        'v2.about': 'About',
        'online.cacheSongs': 'Cached songs',
        'online.qqAccount': 'QQ Music user',
        'online.cacheNoSongs': 'No cached songs yet',
        'v2.playlistSort': 'Playlist order',
        'v2.sortSource': 'Platform order',
        'v2.sortName': 'Name',
        'v2.sortCount': 'Song count',
        'about.tagline': 'Local and online music, one panel.',
        'about.version': 'Version',
        'about.project': 'Project',
        'about.license': 'License',
        'about.author': 'Author',
        'about.feedback': 'Issues',
        'about.description': 'Multi-folder library, NetEase / QQ / KuGou playback, lyric translation, tag and cover editing, audio cache, stats and trash.',
        'about.source': 'GitHub source',
        'about.npm': 'npm package',
        'settings.volumeNormalize': 'Volume leveling',
        'settings.volumeNormalizeHint': 'Built-in EBU R128 analysis adjusts each track to avoid jumps between songs; the first analysis takes a few seconds.',
        'v2.listenTime': 'Listening time',
        'v2.totalPlays': 'Total plays',
        'v2.trackedTracks': 'Tracks tracked',
        'v2.rangeAll': 'All time',
        'v2.rangeWeek': 'Last week',
        'v2.rangeMonth': 'Last month',
        'v2.playing': 'Playing',
        'v2.lyricSettings': 'Lyric settings',
        'v2.removeSelectedConfirm': 'Move {n} selected tracks to the trash (recoverable)?',
        'v2.removed': 'Removed {n} tracks',
        'v2.match': 'Online match',
        'v2.minutes': '{n} min',
        'v2.pickTrack': 'Pick a track from the list to start',
        'v2.selAll': 'Select all',
        'v2.hostKit': 'Host components',
        'v2.hostKitDesc': 'native = using DSH primitives; fallback = local implementations',
        'v2.hostKitNative': 'native',
        'v2.hostKitFallback': 'fallback',
        'v2.selNone': 'Clear selection',
        'v2.selRange': 'Range select',
        'v2.selInvert': 'Invert selection',
        'v2.rangePickHint': 'Range select: click the start, then the end',
        'v2.searchFocus': 'Search',
        'v2.sleepRemaining': '{time} left',
        'v2.sleepCancel': 'Cancel timer',
        'v2.cover': 'Cover',
        'v2.matchHint': 'Click a row to apply everything, or a field chip for just that field',
        'v2.trash': 'Trash',
        'v2.trashHint': 'Removed tracks land here and can be restored',
        'v2.trashEmpty': 'The trash is empty',
        'v2.restore': 'Restore',
        'v2.restored': 'Restored: {name}',
        'v2.trashNoPath': 'Original path unknown',
        'v2.spin': 'Cover rotation',
        'v2.spinDesc': 'The disc spins while playing',
        'v2.roundCover': 'Round covers',
        'v2.vinylRing': 'Vinyl ring',
        'v2.vinylRingDesc': 'Record grooves around a circular cover',
        'v2.roundCoverDesc': 'Use round covers in lists',
        'v2.paused': 'Paused',
        'v2.filters': 'Filters',
        'v2.albumFilter': 'Album: {name}',
        'v2.artistFilter': 'Artist: {name}',
        'v2.folderFilter': 'Folder: {name}',
        'v2.playAllHint': 'Start from the first track',
        'v2.queueHint': 'Click to play, right-click for more',
        'v2.loginNeeded': 'Sign in to see playlists',
        'v2.relogin': 'Sign in again',
        'v2.logout': 'Sign out',
      },
    }
    
    Object.keys(EXTRA_STRINGS).forEach(function (lang) {
      if (!DICTS[lang]) return
      Object.keys(EXTRA_STRINGS[lang]).forEach(function (key) {
        DICTS[lang][key] = EXTRA_STRINGS[lang][key]
      })
    })

    // ── src/10-base.js
    /**
     * base: formatting, storage and small pure helpers.
     *
     * The playback engine (50-player) calls `clamp` and `pad2` directly and the
     * rest of the UI leans on the formatters, so these names are part of the
     * internal contract.
     */
    
    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max)
    }
    
    function pad2(value) {
      return value < 10 ? '0' + value : String(value)
    }
    
    /** Duration for track lists: unknown durations read as `--:--`. */
    function fmtTime(seconds) {
      if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return '--:--'
      var total = Math.floor(seconds)
      var s = total % 60
      var m = Math.floor(total / 60) % 60
      var hours = Math.floor(total / 3600)
      return hours > 0 ? hours + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s)
    }
    
    /** Player clock: always a number, zero reads as `0:00`. */
    function fmtClock(seconds) {
      var total = Math.floor(isFinite(seconds) && seconds > 0 ? seconds : 0)
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
    
    function fmtKbps(bitrate) {
      if (typeof bitrate !== 'number' || !isFinite(bitrate) || bitrate <= 0) return ''
      return Math.round(bitrate / 1000) + ' kbps'
    }
    
    function fmtBytes(bytes) {
      var n = Number(bytes)
      if (!isFinite(n) || n <= 0) return '0 B'
      var units = ['B', 'KB', 'MB', 'GB', 'TB']
      var i = 0
      while (n >= 1024 && i < units.length - 1) {
        n = n / 1024
        i += 1
      }
      return (i === 0 ? String(Math.round(n)) : n.toFixed(1)) + ' ' + units[i]
    }
    
    /** Last.fm / MusicBee play threshold: half the track or four minutes. */
    function playThresholdOf(durationSec) {
      var duration = Number(durationSec)
      if (!isFinite(duration) || duration <= 0) return 240
      if (duration <= 30) return duration + 0.5
      return Math.min(duration / 2, 240)
    }
    
    function clampPref(value, min, max, fallback) {
      var number = Number(value)
      if (!isFinite(number)) return fallback
      return Math.min(max, Math.max(min, Math.round(number)))
    }
    
    /** Class name joiner: falsy values are dropped. */
    function cx() {
      var out = []
      for (var i = 0; i < arguments.length; i += 1) {
        var part = arguments[i]
        if (typeof part === 'string' && part !== '') out.push(part)
      }
      return out.join(' ')
    }
    
    function storageGet(key, fallback) {
      try {
        var raw = window.localStorage.getItem(key)
        if (raw === null || raw === undefined) return fallback
        return JSON.parse(raw)
      } catch (error) {
        return fallback
      }
    }
    
    function storageSet(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch (error) {
        // Private mode / quota: best effort only.
      }
    }
    
    function errorText(error) {
      if (error === null || error === undefined) return ''
      if (typeof error === 'string') return error
      if (typeof error.message === 'string' && error.message !== '') return error.message
      return String(error)
    }
    
    /** Absolute directory of a track (backslashes kept for display). */
    function trackDirOf(track) {
      var path = String((track && track.path) || '')
      var at = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
      return at > 0 ? path.slice(0, at) : path
    }
    
    /** Last path segment of a directory; drive roots fall back to "D:". */
    function folderNameOf(dir) {
      var text = String(dir || '').replace(/[\\/]+$/, '')
      var at = Math.max(text.lastIndexOf('\\'), text.lastIndexOf('/'))
      var name = at >= 0 ? text.slice(at + 1) : text
      return name || text || '/'
    }
    
    /** Stable, case-insensitive search across metadata, path and pinyin. */
    function trackHaystack(track) {
      return [
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
    }
    
    function filterTracks(list, query) {
      var text = String(query || '').trim().toLowerCase()
      if (text === '') return list
      var needles = text.split(/\s+/).filter(Boolean)
      if (needles.length === 0) return list
      return list.filter(function (track) {
        var hay = trackHaystack(track)
        for (var i = 0; i < needles.length; i += 1) {
          if (hay.indexOf(needles[i]) < 0) return false
        }
        return true
      })
    }
    
    function sortTracks(list, key, dir) {
      var out = list.slice()
      var desc = dir === 'desc'
      out.sort(function (left, right) {
        var a
        var b
        switch (key) {
          case 'artist':
            a = String(left.artist || '')
            b = String(right.artist || '')
            break
          case 'album':
            a = String(left.album || '')
            b = String(right.album || '')
            break
          case 'duration':
            a = left.durationSec || 0
            b = right.durationSec || 0
            break
          case 'added':
            a = left.addedAt || 0
            b = right.addedAt || 0
            break
          case 'plays':
            a = left.plays || 0
            b = right.plays || 0
            break
          case 'recent':
            a = left.lastPlayedAt || 0
            b = right.lastPlayedAt || 0
            break
          default:
            a = String(left.title || '')
            b = String(right.title || '')
        }
        if (typeof a === 'number' && typeof b === 'number') return desc ? b - a : a - b
        var result = String(a).localeCompare(String(b), 'zh')
        return desc ? -result : result
      })
      return out
    }
    
    function basename(path) {
      var text = String(path || '')
      var slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'))
      return slash >= 0 ? text.slice(slash + 1) : text
    }

    // ── src/15-icons.js
    /**
     * inline SVG icon set (Feather/Lucide paths, MIT).
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */
    
    // ── icons (Feather/Lucide paths, MIT) ─────────────────────────────────
    
    var ICONS = {
      check: { parts: [['path', { d: 'M20 6L9 17l-5-5' }]] },
      clock: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 9 }],
          ['path', { d: 'M12 7v5l3 2' }],
        ],
      },
      download: {
        parts: [
          ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
          ['path', { d: 'M7 10l5 5 5-5' }],
          ['path', { d: 'M12 15V3' }],
        ],
      },
      target: {
        parts: [
          ['circle', { cx: 12, cy: 12, r: 7 }],
          ['circle', { cx: 12, cy: 12, r: 2.5 }],
          ['path', { d: 'M12 2v3M12 19v3M2 12h3M19 12h3' }],
        ],
      },
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
      heartFill: {
        fill: true,
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
      var hostName = HOST_ICON_MAP && HOST_ICON_MAP[name]
      var HostIcon = hostName ? hostComponent(hostName) : null
      if (HostIcon !== null) {
        return h(HostIcon, { size: size || 18, 'aria-hidden': 'true', focusable: 'false' })
      }
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

    // ── src/16-lyrics.js
    /**
     * LRC parsing, translation merge and online path helpers.
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */
    
    // ── online lyric helpers ──────────────────────────────────────────────
    // The Host returns raw LRC for online tracks (local tracks get parsed lines
    // from /lyrics), so the client needs a small parser of its own.
    function parseLrcText(text) {
      var lines = []
      String(text || '')
        .split(/\r?\n/)
        .forEach(function (raw) {
          var match = /^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/.exec(raw.trim())
          if (match === null) return
          var time = Number(match[1]) * 60 + Number(match[2])
          if (!isFinite(time)) return
          var content = match[3].trim()
          for (var i = 0; i < lines.length; i += 1) {
            if (lines[i].time === time) {
              if (lines[i].text === '' && content !== '') lines[i].text = content
              return
            }
          }
          lines.push({ time: time, text: content, translation: '' })
        })
      lines.sort(function (left, right) {
        return left.time - right.time
      })
      return lines
    }
    
    function mergeLyricTranslation(lines, translationText) {
      var map = {}
      parseLrcText(translationText).forEach(function (item) {
        map[item.time.toFixed(2)] = item.text
      })
      lines.forEach(function (line) {
        var hit = map[line.time.toFixed(2)]
        if (hit !== undefined) line.translation = hit
      })
      return lines
    }
    
    /** Split `online:<provider>:<id>` (null when the path is a local one). */
    function onlinePathOf(path) {
      var match = /^online:([^:]+):(.+)$/.exec(String(path || ''))
      return match === null ? null : { provider: match[1], id: match[2] }
    }

    // ── src/17-list.js
    /**
     * windowed list (fixed row height).
     *
     * Renders the visible slice inside an absolutely positioned spacer. The list is
     * the single scroll container for a track view; `resetKey` decides when the
     * scroll position should go back to the top (view / filter / query change), so
     * a scan that adds or removes a track no longer jumps the list.
     */
    
    function VirtualList(props) {
      var rowHeight = props.rowHeight || 56
      var overscan = props.overscan === undefined ? 6 : props.overscan
      var topPair = useState(props.initialScroll || 0)
      var scrollTop = topPair[0]
      var setScrollTop = topPair[1]
      var viewPair = useState(600)
      var viewport = viewPair[0]
      var setViewport = viewPair[1]
      var ref = useRef(null)
    
      useEffect(function () {
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
      }, [])
    
      useEffect(
        function () {
          var element = ref.current
          var start = props.initialScroll || 0
          if (element !== null) element.scrollTop = start
          setScrollTop(start)
        },
        [props.resetKey],
      )
    
      var items = props.items || []
    
      useEffect(
        function () {
          if (!props.focusPath) return
          var index = -1
          for (var i = 0; i < items.length; i += 1) {
            if (items[i].path === props.focusPath) {
              index = i
              break
            }
          }
          if (index < 0) return
          var top = Math.max(0, index * rowHeight - Math.max(0, viewport / 2 - rowHeight / 2))
          if (ref.current !== null) ref.current.scrollTop = top
          setScrollTop(top)
        },
        [props.focusPath],
      )
    
      function onScroll(event) {
        var top = event.currentTarget.scrollTop
        setScrollTop(top)
        if (typeof props.onScrollTop === 'function') props.onScrollTop(top)
      }
    
      if (items.length === 0) {
        return h(
          'div',
          { className: props.className, ref: ref, onScroll: onScroll },
          props.empty || null,
        )
      }
    
      var total = items.length * rowHeight
      var start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
      var end = Math.min(items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan)
      var slice = items.slice(start, end)
    
      return h(
        'div',
        { className: props.className, ref: ref, onScroll: onScroll },
        h(
          'div',
          { className: 'mp-vlist-inner', style: { height: total + 'px' } },
          slice.map(function (item, offset) {
            var index = start + offset
            return h(
              'div',
              {
                key: props.itemKey ? props.itemKey(item, index) : index,
                className: 'mp-vlist-row',
                style: { height: rowHeight + 'px', top: index * rowHeight + 'px' },
              },
              props.renderRow(item, index),
            )
          }),
        ),
      )
    }

    // ── src/18-stats.js
    /**
     * stats formatting and folder helpers.
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */
    
    function basenameOf(path) {
      var parts = String(path || '').split(/[\\/]/)
      return parts.length > 0 ? parts[parts.length - 1] : String(path || '')
    }
    
    /** File name without its extension — the fallback "title" for untagged files. */
    function stemOf(path) {
      var name = basenameOf(path)
      var dot = name.lastIndexOf('.')
      return dot > 0 ? name.slice(0, dot) : name
    }
    
    /** Normalized folder (directory) part of a track path, no trailing slash. */
    function folderOf(filePath) {
      var normalized = String(filePath || '').replace(/\\/g, '/')
      var index = normalized.lastIndexOf('/')
      if (index <= 0) return ''
      return normalized.slice(0, index)
    }
    
    /** Human label for a folder: path relative to its scan root when possible. */
    function folderLabelOf(folder, roots) {
      var normalized = String(folder || '').replace(/\\/g, '/')
      for (var index = 0; index < roots.length; index += 1) {
        var root = String(roots[index] || '')
          .replace(/\\/g, '/')
          .replace(/\/+$/, '')
        if (root !== '' && (normalized === root || normalized.indexOf(root + '/') === 0)) {
          var relative = normalized.slice(root.length).replace(/^\/+/, '')
          return relative === '' ? root.split('/').pop() : relative
        }
      }
      var parts = normalized.split('/')
      return parts[parts.length - 1] || normalized
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

    // ── src/19-extra-icons.js
    /**
     * extra icons used by the v2 shell (the 0.11.1 set stays in 15-icons).
     */
    
    ICONS.user = { parts: [['circle', { cx: 12, cy: 8, r: 3.6 }], ['path', { d: 'M5 20a7 7 0 0 1 14 0' }]] }
    ICONS.chart = { parts: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M21 20H2' }]] }
    ICONS.disc = { parts: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 2.2 }]] }
    ICONS.qr = {
      parts: [
        ['rect', { x: 4, y: 4, width: 6, height: 6 }],
        ['rect', { x: 14, y: 4, width: 6, height: 6 }],
        ['rect', { x: 4, y: 14, width: 6, height: 6 }],
        ['path', { d: 'M14 14h3v3h-3zM19 17v3M14 20h2' }],
      ],
    }
    ICONS.translate = {
      parts: [
        ['path', { d: 'M3 6h8M7 6v2c0 4-2 7-4 8' }],
        ['path', { d: 'M5 12c1 2 3 3 5 3' }],
        ['path', { d: 'M13 20l4-10 4 10M14.5 16h5' }],
      ],
    }
    ICONS.logout = {
      parts: [
        ['path', { d: 'M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8' }],
        ['path', { d: 'M17 8l4 4-4 4M21 12H10' }],
      ],
    }
    ICONS.chevronRight = { parts: [['path', { d: 'M9 6l6 6-6 6' }]] }
    
    ICONS.playlist = {
      parts: [
        ['path', { d: 'M4 6h11' }],
        ['path', { d: 'M4 12h8' }],
        ['path', { d: 'M4 18h6' }],
        ['path', { d: 'M17 5v10.5' }],
        ['circle', { cx: 15.5, cy: 17.5, r: 2.5 }],
      ],
    }

    // ── src/20-api.js
    /**
     * api: every call into the Host half lives here.
     *
     * The playback engine expects `API`, `getJson`, `postJson`, `streamUrl` and
     * `coverUrl` under these exact names.
     */
    
    var API = 'music/'
    
    function streamUrl(path) {
      return API + 'stream?path=' + encodeURIComponent(path)
    }
    
    function coverUrl(path) {
      return API + 'cover?path=' + encodeURIComponent(path)
    }
    
    function onlineStreamUrl(provider, id) {
      return API + 'online/stream?provider=' + encodeURIComponent(provider) + '&id=' + encodeURIComponent(id)
    }
    
    async function getJson(url) {
      var response = await fetch(url, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      var body = null
      try {
        body = await response.json()
      } catch (error) {
        body = null
      }
      if (!response.ok || body === null || body.ok !== true) {
        var message =
          body !== null && body.error && body.error.message ? body.error.message : 'HTTP ' + response.status
        throw new Error(message)
      }
      return body
    }
    
    function postJson(url, payload) {
      return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload === undefined ? {} : payload),
      }).then(function (response) {
        return response
          .json()
          .catch(function () {
            return null
          })
          .then(function (body) {
            if (!response.ok || body === null || body.ok !== true) {
              var error = new Error(
                body !== null && body.error && body.error.message
                  ? body.error.message
                  : 'HTTP ' + response.status,
              )
              error.body = body
              throw error
            }
            return body
          })
      })
    }
    
    /** PATCH / DELETE with the same envelope as postJson. */
    function sendJson(method, url, payload) {
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
              var error = new Error(
                body !== null && body.error && body.error.message
                  ? body.error.message
                  : 'HTTP ' + response.status,
              )
              error.body = body
              throw error
            }
            return body
          })
      })
    }
    
    /** Cover URL for a library or online track ('' when it has no art). */
    function trackCoverSrc(track) {
      if (!track) return ''
      if (track.onlineProvider) {
        return typeof track.coverUrl === 'string' && track.coverUrl !== ''
          ? API + 'online/cover?url=' + encodeURIComponent(track.coverUrl)
          : ''
      }
      if (track.hasCover === true && track.path) return coverUrl(track.path)
      return ''
    }
    
    /** Map one online search / playlist result into the queue's track shape. */
    function onlineTrackOf(result) {
      var provider = result.provider
      return {
        path: 'online:' + provider + ':' + result.id,
        title: result.title,
        artist: result.artist,
        album: result.album,
        durationSec: result.durationSec,
        hasCover: false,
        coverUrl: result.coverUrl || '',
        onlineUrl: onlineStreamUrl(provider, result.id),
        onlineProvider: provider,
        onlineId: result.id,
        qualityHint: result.qualityHint || '',
        sampleRate: 0,
        size: 0,
        mtime: 0,
      }
    }
    
    function onlineCoverSrc(result) {
      if (!result || typeof result.coverUrl !== 'string' || result.coverUrl === '') return ''
      return API + 'online/cover?url=' + encodeURIComponent(result.coverUrl)
    }

    // ── src/30-prefs.js
    /**
     * prefs: user preferences, persisted in localStorage.
     *
     * The playback engine calls `readPrefs()` / `savePrefs()` directly, so the
     * shape below must stay compatible with 0.11.1 (loop / order / volume /
     * resumeOnStart / rememberPerTrack / sleepTimerMinutes).
     */
    
    var PREFS_KEY = 'music.prefs.v2'
    var LEGACY_PREFS_KEY = 'dsh-music.prefs'
    
    var PREF_DEFAULTS = {
      layout: 'top',
      sortBy: 'title',
      sortDir: 'asc',
      circularCover: true,
      vinylRing: false,
      npLookMigrated: true,
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
      volume: 1,
      loop: 'none',
      order: 'list',
      resumeOnStart: true,
      sleepTimerMinutes: 0,
      sleepDeadline: 0,
      autoResume: false,
      rememberPerTrack: false,
      normalizeVolume: true,
      onlinePlaylistSort: 'source',
      onboardingDone: true,
    }
    
    function readPrefs() {
      var merged = {}
      Object.keys(PREF_DEFAULTS).forEach(function (key) {
        merged[key] = PREF_DEFAULTS[key]
      })
      var raw = null
      try {
        raw = window.localStorage.getItem(PREFS_KEY)
      } catch (error) {
        raw = null
      }
      // One-time migration from the 0.11 key so nobody loses their settings.
      if (raw === null) {
        try {
          raw = window.localStorage.getItem(LEGACY_PREFS_KEY)
          if (raw !== null) window.localStorage.setItem(PREFS_KEY, raw)
        } catch (error) {
          raw = null
        }
      }
      if (raw === null) return merged
      try {
        var parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return merged
        Object.keys(parsed).forEach(function (key) {
          if (parsed[key] !== undefined && parsed[key] !== null) merged[key] = parsed[key]
        })
      } catch (error) {
        // Corrupt value: defaults stand.
      }
      merged.composerLyricPlace =
        String(merged.composerLyricPlace || '').indexOf('above') === 0 ? 'above' : 'input-left'
      // 0.12.0 briefly defaulted to square covers; restore the 0.11 player look once.
      if (merged.npLookMigrated !== true) {
        merged.circularCover = PREF_DEFAULTS.circularCover
        merged.npLookMigrated = true
        try {
          window.localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
        } catch (error) {
          // Best effort only.
        }
      }
      return merged
    }
    
    function savePrefs(patch) {
      var next = readPrefs()
      if (patch !== null && typeof patch === 'object') {
        Object.keys(patch).forEach(function (key) {
          next[key] = patch[key]
        })
      }
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch (error) {
        // Private mode / quota: preferences are best effort.
      }
      if (prefsStore !== undefined) prefsStore.set(next)
      return next
    }
    
    var prefsStore = createStore(readPrefs())
    
    function setPrefs(patch) {
      return savePrefs(patch)
    }

    // ── src/35-loudness.js
    /**
     * Self-contained EBU R128 integrated-loudness analysis.
     *
     * The browser's own decoder + OfflineAudioContext provide the K-weighting
     * filters, so no ffmpeg or npm runtime is required. Results are cached by
     * track path + file size and applied through the player's GainNode.
     */
    
    var LOUDNESS_CACHE_KEY = 'music.loudness.v1'
    var LOUDNESS_TARGET = -16
    var loudnessDecoder = null
    var loudnessCache = readLoudnessCache()
    
    function readLoudnessCache() {
      try {
        var raw = window.localStorage.getItem(LOUDNESS_CACHE_KEY)
        var parsed = raw === null ? null : JSON.parse(raw)
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch (error) {
        return {}
      }
    }
    
    function writeLoudnessCache(cache) {
      try {
        window.localStorage.setItem(LOUDNESS_CACHE_KEY, JSON.stringify(cache))
      } catch (error) {
        // Quota/private mode: in-memory cache still works.
      }
    }
    
    function loudnessCacheKey(item, blob) {
      return String(item.path || '') + '|' + String(blob.size || 0)
    }
    
    function lookupLoudnessGain(key) {
      var row = loudnessCache[key]
      var gain = row && Number(row.gainDb)
      return Number.isFinite(gain) ? gain : null
    }
    
    function storeLoudnessGain(key, gainDb) {
      loudnessCache[key] = { gainDb: gainDb, at: Date.now() }
      var keys = Object.keys(loudnessCache)
      if (keys.length > 1200) {
        keys
          .sort(function (left, right) {
            return (loudnessCache[left].at || 0) - (loudnessCache[right].at || 0)
          })
          .slice(0, keys.length - 1200)
          .forEach(function (old) {
            delete loudnessCache[old]
          })
      }
      writeLoudnessCache(loudnessCache)
    }
    
    function loudnessContext() {
      if (loudnessDecoder !== null) return loudnessDecoder
      var Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) return null
      try {
        loudnessDecoder = new Ctor()
      } catch (error) {
        loudnessDecoder = null
      }
      return loudnessDecoder
    }
    
    /** Integrated loudness in LUFS, following ITU-R BS.1770-4 / EBU R128. */
    function lufsFromAudioBuffer(buffer) {
      var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
      if (!Offline) return Promise.reject(new Error('OfflineAudioContext unavailable'))
      return new Promise(function (resolve, reject) {
        var offline
        try {
          offline = new Offline(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
          var source = offline.createBufferSource()
          source.buffer = buffer
          var shelf = offline.createBiquadFilter()
          shelf.type = 'highshelf'
          shelf.frequency.value = 1681.974450955533
          shelf.gain.value = 3.999843853973347
          shelf.Q.value = 0.7071752369554196
          var highpass = offline.createBiquadFilter()
          highpass.type = 'highpass'
          highpass.frequency.value = 38.13547087602444
          highpass.Q.value = 0.5003270373238773
          source.connect(shelf)
          shelf.connect(highpass)
          highpass.connect(offline.destination)
          source.start()
        } catch (error) {
          reject(error)
          return
        }
        offline
          .startRendering()
          .then(function (rendered) {
            var lufs = integratedLoudnessOf(rendered)
            if (lufs === null) reject(new Error('no gated loudness blocks'))
            else resolve(lufs)
          })
          .catch(reject)
      })
    }
    
    /** Mean square per gated 400 ms block, with surround channel weights. */
    function integratedLoudnessOf(buffer) {
      var sampleRate = buffer.sampleRate
      var blockSize = Math.round(0.4 * sampleRate)
      var step = Math.round(0.1 * sampleRate)
      if (blockSize <= 0 || buffer.length < blockSize) return null
      var channels = []
      for (var channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        channels.push(buffer.getChannelData(channel))
      }
      var weights = channels.map(function (_, index) {
        return index === 3 || index === 4 ? 1.41 : 1
      })
      var blocks = []
      for (var start = 0; start + blockSize <= buffer.length; start += step) {
        var energy = 0
        for (var ch = 0; ch < channels.length; ch += 1) {
          var data = channels[ch]
          var sum = 0
          for (var i = start; i < start + blockSize; i += 1) sum += data[i] * data[i]
          energy += weights[ch] * (sum / blockSize)
        }
        var loudness = -0.691 + 10 * Math.log10(energy)
        if (loudness > -70) blocks.push({ loudness: loudness, energy: energy })
      }
      if (blocks.length === 0) return null
      var absoluteEnergy =
        blocks.reduce(function (sum, block) {
          return sum + block.energy
        }, 0) / blocks.length
      var relativeGate = -0.691 + 10 * Math.log10(absoluteEnergy) - 10
      var gated = blocks.filter(function (block) {
        return block.loudness > relativeGate
      })
      if (gated.length === 0) return null
      var finalEnergy =
        gated.reduce(function (sum, block) {
          return sum + block.energy
        }, 0) / gated.length
      return -0.691 + 10 * Math.log10(finalEnergy)
    }
    
    function analyzeLoudnessBlob(item, blob, isCurrent, onGain) {
      if (!item || !blob || typeof isCurrent !== 'function' || typeof onGain !== 'function') return
      var key = loudnessCacheKey(item, blob)
      var cached = lookupLoudnessGain(key)
      if (cached !== null) {
        if (isCurrent()) onGain(cached)
        return
      }
      var decoder = loudnessContext()
      if (decoder === null) return
      blob
        .arrayBuffer()
        .then(function (bytes) {
          return decoder.decodeAudioData(bytes)
        })
        .then(function (buffer) {
          if (!isCurrent()) return null
          return lufsFromAudioBuffer(buffer)
        })
        .then(function (lufs) {
          if (lufs === null || !isCurrent()) return
          var gainDb = clamp(LOUDNESS_TARGET - lufs, -15, 6)
          storeLoudnessGain(key, gainDb)
          onGain(gainDb)
        })
        .catch(function () {
          // Corrupt/unsupported file: keep the user volume.
        })
    }

    // ── src/35-provider-logos.js
    /** Official provider app icons (resized to 256px WebP for inline use). */
    var PROVIDER_LOGOS = {"netease":"data:image/webp;base64,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","qq":"data:image/webp;base64,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","kugou":"data:image/webp;base64,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"}
    
    function providerLogo(provider, size) {
      var src = PROVIDER_LOGOS[provider] || PROVIDER_LOGOS.netease
      return h('img', { className: 'mp-provider-logo', src: src, width: size || 20, height: size || 20, alt: '' })
    }

    // ── src/40-store.js
    /**
     * store: the smallest possible subscription store used by every view.
     *
     * No React context: views read a module-level store through `useStore`, which
     * keeps the panel a single tree and avoids provider plumbing.
     */
    
    function createStore(initial) {
      var state = initial
      var listeners = []
      return {
        get: function () {
          return state
        },
        set: function (patch) {
          var next = typeof patch === 'function' ? patch(state) : Object.assign({}, state, patch)
          if (next === state) return state
          state = next
          listeners.slice().forEach(function (fn) {
            try {
              fn(state)
            } catch (error) {
              // A broken listener must not stop the others.
            }
          })
          return state
        },
        subscribe: function (fn) {
          listeners.push(fn)
          return function () {
            var at = listeners.indexOf(fn)
            if (at >= 0) listeners.splice(at, 1)
          }
        },
      }
    }
    
    function useStore(store) {
      var pair = useState(store.get())
      var state = pair[0]
      var setState = pair[1]
      useEffect(
        function () {
          setState(store.get())
          return store.subscribe(setState)
        },
        [store],
      )
      return state
    }

    // ── src/45-ui.js
    /**
     * ui state: source, section, filter, query and the two panel-level toggles.
     *
     * Persisted subset: source / nav / playlistId (localStorage `music.ui.v2`),
     * migrated once from the 0.11 keys `mu.source` and `mu.view`.
     */
    
    var UI_KEY = 'music.ui.v2'
    var LEGACY_UI_KEYS = ['mu.source', 'mu.view']
    
    function isOnlineSource(source) {
      return source === 'netease' || source === 'qq' || source === 'kugou'
    }
    
    function sourceLabelOf(source) {
      if (source === 'netease') return t('online.providerNetease')
      if (source === 'qq') return t('online.providerQq')
      if (source === 'kugou') return t('online.providerKugou')
      return t('page.tabLocal')
    }
    
    function rawStorageGet(key, fallback) {
      try {
        var value = window.localStorage.getItem(key)
        return value === null || value === undefined ? fallback : String(value)
      } catch (error) {
        return fallback
      }
    }
    
    function readUiState() {
      var saved = storageGet(UI_KEY, null)
      if (saved === null || typeof saved !== 'object') {
        // Migrate the 0.11 keys once so the panel opens where it was left.
        var legacySource = rawStorageGet(LEGACY_UI_KEYS[0], '')
        var legacyView = rawStorageGet(LEGACY_UI_KEYS[1], '')
        var source = ['local', 'netease', 'qq', 'kugou'].indexOf(legacySource) >= 0 ? legacySource : 'local'
        var nav = 'songs'
        if (source !== 'local') nav = 'recent'
        else if (['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'stats'].indexOf(legacyView) >= 0) {
          nav = legacyView
        }
        return { source: source, nav: nav, playlistId: '' }
      }
      var source = ['local', 'netease', 'qq', 'kugou'].indexOf(saved.source) >= 0 ? saved.source : 'local'
      var nav = typeof saved.nav === 'string' && saved.nav !== '' ? saved.nav : 'songs'
      var playlistId = typeof saved.playlistId === 'string' ? saved.playlistId : ''
      if (nav === 'playlists') nav = source === 'local' ? 'songs' : 'recent'
      if (nav === 'playlist' && (source !== 'local' || playlistId === '')) nav = source === 'local' ? 'songs' : 'recent'
      return { source: source, nav: nav, playlistId: playlistId }
    }
    
    var uiStore = createStore(
      Object.assign(
        {
          filter: null,
          query: '',
          queueOpen: false,
          npOpen: false,
        },
        readUiState(),
      ),
    )
    
    function setUi(patch) {
      return uiStore.set(patch)
    }
    
    function isLocalNav(nav) {
      return ['songs', 'albums', 'artists', 'folders', 'favorites', 'playlists', 'playlist', 'stats'].indexOf(nav) >= 0
    }
    
    /** Section groups for the current source (rail or top bar). */
    /** Online playlist ordering is local-only; the platform order is kept as "source". */
    function onlinePlaylistSortMode() {
      var mode = prefsStore.get().onlinePlaylistSort
      return mode === 'name' || mode === 'count' ? mode : 'source'
    }
    
    function onlinePlaylistSortLabel(mode) {
      if (mode === 'name') return t('v2.sortName')
      if (mode === 'count') return t('v2.sortCount')
      return t('v2.sortSource')
    }
    
    function sortOnlinePlaylists(list) {
      var mode = onlinePlaylistSortMode()
      var copy = (list || []).slice()
      if (mode === 'name') {
        copy.sort(function (left, right) {
          return String(left.name || '').localeCompare(String(right.name || ''), 'zh')
        })
      } else if (mode === 'count') {
        copy.sort(function (left, right) {
          var delta = (Number(right.trackCount) || 0) - (Number(left.trackCount) || 0)
          return delta !== 0
            ? delta
            : String(left.name || '').localeCompare(String(right.name || ''), 'zh')
        })
      }
      return copy
    }
    
    function cycleOnlinePlaylistSort() {
      var mode = onlinePlaylistSortMode()
      var next = mode === 'source' ? 'name' : mode === 'name' ? 'count' : 'source'
      setPrefs({ onlinePlaylistSort: next })
    }
    
    function navGroupsFor(source, favoritesCount) {
      var library = libraryStore.get()
      if (isOnlineSource(source)) {
        var online = onlineStore.get()
        var playlists = sortOnlinePlaylists(online.playlists || [])
        var signedIn = (online.providers[source] || {}).loggedIn === true
        var groups = [
          {
            label: t('v2.sectionOnline'),
            items: [
              { key: 'recent', label: t('v2.recent'), icon: 'clock', count: null },
              { key: 'cache', label: t('v2.cache'), icon: 'download', count: null },
            ],
          },
        ]
        if (signedIn) {
          groups.push({
            label: t('v2.playlists'),
            showLabel: true,
            action: {
              icon: 'sort',
              title: t('v2.playlistSort') + ': ' + onlinePlaylistSortLabel(onlinePlaylistSortMode()),
              run: cycleOnlinePlaylistSort,
            },
            items: playlists.map(function (playlist) {
              return {
                key: 'online-playlist:' + playlist.id,
                label: playlist.name || '',
                icon: 'list',
                count: playlist.trackCount || 0,
                onlinePlaylist: playlist,
              }
            }),
          })
        }
        return groups
      }
      return [
        {
          label: t('v2.sectionLibrary'),
          items: [
            { key: 'songs', label: t('v2.songs'), icon: 'note', count: library.tracks.length },
            { key: 'albums', label: t('v2.albums'), icon: 'disc', count: null },
            { key: 'artists', label: t('v2.artists'), icon: 'user', count: null },
            { key: 'folders', label: t('v2.folders'), icon: 'folder', count: null },
          ],
        },
        {
          label: t('v2.sectionCollection'),
          items: [
            { key: 'favorites', label: t('v2.favorites'), icon: 'heart', count: favoritesCount },
            { key: 'stats', label: t('v2.stats'), icon: 'chart', count: null },
          ],
        },
        {
          label: t('v2.playlists'),
          showLabel: true,
          action: {
            icon: 'plus',
            title: t('v2.newPlaylist'),
            run: function () {
              pushLayer('newPlaylist')
            },
          },
          items: (library.playlists || []).map(function (playlist) {
            return {
              key: 'local-playlist:' + playlist.id,
              label: playlist.name || '',
              icon: 'list',
              count: (playlist.trackPaths || []).length,
              localPlaylistId: playlist.id,
              playlist: playlist,
            }
          }),
        },
      ]
    }
    
    /** One click path for every nav shape: plain sections, local/online playlists. */
    function activateNavItem(item) {
      if (item.localPlaylistId) {
        openLocalPlaylist(item.localPlaylistId)
        return
      }
      if (item.onlinePlaylist) {
        void openOnlinePlaylist(item.onlinePlaylist)
        setNav('playlist')
        return
      }
      setNav(item.key)
    }
    
    function activeNavKey(nav) {
      var ui = uiStore.get()
      if (nav === 'playlist') {
        if (isOnlineSource(ui.source)) return 'online-playlist:' + (onlineStore.get().playlistId || '')
        return 'local-playlist:' + (ui.playlistId || '')
      }
      return nav
    }
    
    function sectionTitleOf(ui) {
      switch (ui.nav) {
        case 'songs':
          return t('v2.allSongs')
        case 'albums':
          return t('v2.albums')
        case 'artists':
          return t('v2.artists')
        case 'folders':
          return t('v2.folders')
        case 'favorites':
          return t('v2.favorites')
        case 'playlists':
          return t('v2.playlists')
        case 'playlist':
          return (playlistById(ui.playlistId) || {}).name || t('v2.playlists')
        case 'stats':
          return t('v2.stats')
        case 'recent':
          return t('v2.recent')
        case 'cache':
          return t('v2.cache')
        default:
          return t('v2.songs')
      }
    }
    
    function setSource(source) {
      var ui = uiStore.get()
      if (ui.source === source) return
      selectionStore.set({ active: false, paths: [] })
      uiStore.set({
        source: source,
        nav: isOnlineSource(source) ? 'recent' : 'songs',
        filter: null,
        query: '',
        playlistId: '',
      })
      onlineStore.set({
        provider: isOnlineSource(source) ? source : onlineStore.get().provider,
        playlists: [],
        playlistsPhase: 'idle',
        playlistsProvider: '',
        liked: {},
        playlistId: '',
        playlistName: '',
        playlistSongs: [],
        playlistPhase: 'idle',
        query: '',
        results: [],
        phase: 'idle',
        error: '',
      })
      if (isOnlineSource(source)) void loadProviders()
    }
    
    function setNav(nav) {
      selectionStore.set({ active: false, paths: [] })
      uiStore.set({ nav: nav, filter: null, playlistId: nav === 'playlist' ? uiStore.get().playlistId : '' })
    }
    
    function openLocalPlaylist(id) {
      selectionStore.set({ active: false, paths: [] })
      uiStore.set({ nav: 'playlist', playlistId: id, filter: null, query: '' })
    }
    
    function openOnlineSection(nav) {
      closeOnlinePlaylist()
      uiStore.set({ nav: nav, filter: null })
    }
    
    uiStore.subscribe(function (state) {
      storageSet(UI_KEY, {
        source: state.source,
        nav: state.nav,
        playlistId: state.playlistId,
      })
    })

    // ── src/50-player.js
    /**
     * playback engine moved verbatim from 0.11.1. It relies on the helpers in 10-base / 20-api / 30-prefs keeping their names.
     *
     * Extracted from client.js at the 0.11.1 baseline (3931c14).
     */
    
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
      var gainNode = null
      var waveData = null
      var normalizeGain = 1
      var loudnessToken = 0
      /** Active `blob:` URL for the loaded track (local media seeks reliably). */
      var objectUrl = null
      var currentLoudnessBlob = null
      /** In-flight track download. */
      var fetchAbort = null
      /** Bumped per load so a stale download cannot overwrite a newer track. */
      var loadToken = 0
      var pendingAutoplay = false
      var randomOrder = []
      var listeners = []
      var timeListeners = []
      var errorListeners = []
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
        var failedTrack = state.queue[state.index] || null
        errorListeners.forEach(function (fn) {
          try {
            fn({ track: failedTrack, streak: errorStreak })
          } catch {
            /* a listener must never break playback */
          }
        })
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
      /** Element volume when normalization is applied without a Web Audio graph. */
      function effectiveVolume() {
        var trim = gainNode === null ? Math.min(1, normalizeGain) : 1
        return clamp(state.volume * trim, 0, 1)
      }
    
      function applyOutputVolume() {
        if (audio) audio.volume = effectiveVolume()
      }
    
      function applyNormalizeGain(linear) {
        normalizeGain = Number.isFinite(linear) && linear > 0 ? linear : 1
        if (gainNode !== null && audioContext !== null) {
          try {
            var now = audioContext.currentTime
            gainNode.gain.cancelScheduledValues(now)
            gainNode.gain.setTargetAtTime(normalizeGain, now, 0.12)
          } catch {
            gainNode.gain.value = normalizeGain
          }
        } else {
          applyOutputVolume()
        }
      }
    
      /** Analyse the downloaded blob in-browser and apply the per-track gain. */
      function scheduleLoudness(item, blob) {
        var token = (loudnessToken += 1)
        currentLoudnessBlob = blob || null
        applyNormalizeGain(1)
        if (readPrefs().normalizeVolume === false || !item || !blob) return
        analyzeLoudnessBlob(
          item,
          blob,
          function () {
            return token === loudnessToken
          },
          function (gainDb) {
            if (token !== loudnessToken) return
            applyNormalizeGain(Math.pow(10, clamp(gainDb, -15, 6) / 20))
          },
        )
      }
    
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
        currentLoudnessBlob = null
        loudnessToken += 1
        applyNormalizeGain(1)
        if (audio === null) return
    
        cancelPendingFetch()
        // Online providers stream through the Host. The Desktop media stack
        // silently drops `currentTime` writes on this HTTP stream (seeking
        // restarted the track), so download the file first — when it is cached
        // this is a local read — and play from a blob like local tracks.
        if (typeof item.onlineUrl === 'string' && item.onlineUrl !== '') {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
          releaseObjectUrl()
          var onlineToken = token
          var onlineController =
            typeof AbortController !== 'undefined' ? new AbortController() : null
          fetchAbort = onlineController
          if (item.onlineProvider && item.onlineId) {
            void postJson(API + 'online/cache/meta', {
              provider: item.onlineProvider,
              id: item.onlineId,
              title: item.title || '',
              artist: item.artist || '',
              album: item.album || '',
              coverUrl: item.coverUrl || '',
              durationSec: item.durationSec || 0,
            }).catch(function () {})
          }
          fetch(item.onlineUrl, onlineController === null ? {} : { signal: onlineController.signal })
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status)
              return response.blob()
            })
            .then(function (blob) {
              if (onlineToken !== loadToken) return
              fetchAbort = null
              if (audio === null) return
              releaseObjectUrl()
              objectUrl = URL.createObjectURL(blob)
              audio.src = objectUrl
              audio.load()
              scheduleLoudness(item, blob)
              if (pendingAutoplay) {
                pendingAutoplay = false
                audio.play().catch(function () {
                  if (state.playing) patch({ playing: false })
                })
              }
            })
            .catch(function () {
              if (onlineToken !== loadToken) return
              fetchAbort = null
              if (audio === null) return
              // Streaming fallback: playback still starts even if the prefetch
              // failed (seeking may be less reliable in this rare path).
              audio.src = item.onlineUrl
              audio.load()
              if (pendingAutoplay) {
                pendingAutoplay = false
                audio.play().catch(function () {
                  if (state.playing) patch({ playing: false })
                })
              }
            })
          return
        }
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
            scheduleLoudness(item, blob)
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
        subscribeError: function (fn) {
          errorListeners.push(fn)
          return function () {
            errorListeners = errorListeners.filter(function (item) {
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
            gainNode = audioContext.createGain()
            analyser = audioContext.createAnalyser()
            analyser.fftSize = 256
            analyser.smoothingTimeConstant = 0.82
            source.connect(gainNode)
            gainNode.connect(analyser)
            analyser.connect(audioContext.destination)
            if (audio) audio.volume = state.volume
            applyNormalizeGain(normalizeGain)
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
          gainNode = null
          waveData = null
          audio = el
          if (el === null) return
          bind(el)
          el.preload = 'metadata'
          el.volume = effectiveVolume()
          el.muted = state.muted
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
          var item = currentItem()
          if (readPrefs().normalizeVolume !== false && item && !item.onlineProvider) {
            var context = api.ensureAnalyser()
            if (context !== null && audioContext !== null && audioContext.state === 'suspended') {
              audioContext.resume().catch(function () {
                // If the context cannot start, leave the media element untouched.
              })
            }
          }
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
        setNormalize: function (value) {
          savePrefs({ normalizeVolume: value !== false })
          if (value === false) {
            loudnessToken += 1
            applyNormalizeGain(1)
          } else if (currentItem()) {
            scheduleLoudness(currentItem(), currentLoudnessBlob)
          }
        },
        setVolume: function (value) {
          var next = clamp(value, 0, 1)
          state = Object.assign({}, state, { volume: next, muted: next > 0 ? state.muted : false })
          applyOutputVolume()
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

    // ── src/60-library.js
    /**
     * library: scanned tracks, favorites, playlists, stats and config.
     *
     * Views read this store; actions are plain async functions so they can be
     * called from event handlers without a hook layer.
     */
    
    var libraryStore = createStore({
      phase: 'idle', // idle | loading | ready | error
      tracks: [],
      roots: [],
      warnings: [],
      error: '',
      scannedAt: 0,
      config: null,
      favorites: [],
      playlists: [],
      stats: {},
      statsRange: 'all',
    })
    
    var libraryToken = 0
    
    async function loadLibrary(refresh) {
      var token = (libraryToken += 1)
      libraryStore.set({ phase: 'loading', error: '' })
      try {
        var body = await getJson(API + 'library' + (refresh === true ? '?refresh=1' : ''))
        if (token !== libraryToken) return
        libraryStore.set({
          phase: 'ready',
          tracks: Array.isArray(body.tracks) ? body.tracks : [],
          roots: Array.isArray(body.roots) ? body.roots : [],
          warnings: Array.isArray(body.warnings) ? body.warnings : [],
          scannedAt: body.scannedAt || 0,
          config: body.config || libraryStore.get().config,
          error: '',
        })
      } catch (error) {
        if (token !== libraryToken) return
        libraryStore.set({ phase: 'error', error: errorText(error) })
      }
    }
    
    function tracksNow() {
      return libraryStore.get().tracks
    }
    
    function trackByPath(path) {
      var list = tracksNow()
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].path === path) return list[i]
      }
      return null
    }
    
    function favoriteSet() {
      var set = {}
      var list = libraryStore.get().favorites
      for (var i = 0; i < list.length; i += 1) set[list[i]] = true
      return set
    }
    
    async function loadFavorites() {
      try {
        var body = await getJson(API + 'favorites')
        libraryStore.set({ favorites: Array.isArray(body.favorites) ? body.favorites : [] })
      } catch (error) {
        // Favorites are optional; the panel still works without them.
      }
    }
    
    async function toggleFavorite(path) {
      if (!path) return
      try {
        var body = await postJson(API + 'favorites', { path: path })
        libraryStore.set({ favorites: Array.isArray(body.favorites) ? body.favorites : [] })
      } catch (error) {
        showToast(errorText(error))
      }
    }
    
    async function loadPlaylists() {
      try {
        var body = await getJson(API + 'playlists')
        libraryStore.set({ playlists: Array.isArray(body.playlists) ? body.playlists : [] })
      } catch (error) {
        libraryStore.set({ playlists: [] })
      }
    }
    
    async function createPlaylist(name) {
      try {
        var body = await postJson(API + 'playlists', { name: name })
        await loadPlaylists()
        return body.playlist
      } catch (error) {
        showToast(errorText(error))
        return null
      }
    }
    
    async function patchPlaylist(id, patch) {
      try {
        await sendJson('PATCH', API + 'playlists/' + encodeURIComponent(id), patch)
        await loadPlaylists()
        return true
      } catch (error) {
        showToast(errorText(error))
        return false
      }
    }
    
    async function removePlaylist(id) {
      try {
        await sendJson('DELETE', API + 'playlists/' + encodeURIComponent(id))
        await loadPlaylists()
        return true
      } catch (error) {
        showToast(errorText(error))
        return false
      }
    }
    
    async function addToPlaylist(id, paths) {
      var list = Array.isArray(paths) ? paths : [paths]
      return patchPlaylist(id, { add: list })
    }
    
    async function loadStats(range) {
      var next = range === 'week' || range === 'month' ? range : 'all'
      libraryStore.set({ statsRange: next })
      try {
        var body = await getJson(API + 'stats?range=' + encodeURIComponent(next))
        libraryStore.set({ stats: body.tracks || {} })
      } catch (error) {
        libraryStore.set({ stats: {} })
      }
    }
    
    async function loadConfig() {
      try {
        var body = await getJson(API + 'config')
        libraryStore.set({ config: body.config || null })
        return body.config || null
      } catch (error) {
        return null
      }
    }
    
    async function saveConfig(patch) {
      try {
        var body = await postJson(API + 'config', patch)
        libraryStore.set({ config: body.config || null })
        await loadLibrary(true)
        return true
      } catch (error) {
        showToast(errorText(error))
        return false
      }
    }
    
    function playlistTracks(playlist) {
      if (!playlist || !Array.isArray(playlist.trackPaths)) return []
      var out = []
      for (var i = 0; i < playlist.trackPaths.length; i += 1) {
        var track = trackByPath(playlist.trackPaths[i])
        if (track !== null) out.push(track)
      }
      return out
    }
    
    function playlistById(id) {
      var list = libraryStore.get().playlists
      for (var i = 0; i < list.length; i += 1) {
        if (list[i].id === id) return list[i]
      }
      return null
    }

    // ── src/70-online.js
    /**
     * online: NetEase / QQ / KuGou state.
     *
     * Only the client half lives here: the Host performs every provider request.
     */
    
    var ONLINE_HISTORY_KEY = 'mu.onlineHistory'
    var ONLINE_HISTORY_MAX = 50
    
    function readOnlineHistory() {
      var list = storageGet(ONLINE_HISTORY_KEY, [])
      return Array.isArray(list) ? list : []
    }
    
    function writeOnlineHistory(list) {
      storageSet(ONLINE_HISTORY_KEY, list.slice(0, ONLINE_HISTORY_MAX))
    }
    
    function onlineHistoryOfProvider(provider) {
      return onlineStore.get().history.filter(function (item) {
        return item.provider === provider
      })
    }
    
    var onlineStore = createStore({
      provider: 'netease',
      phase: 'idle', // idle | searching | ready | error
      query: '',
      results: [],
      error: '',
      playlistsPhase: 'idle',
      playlistsProvider: '',
      playlistsRefreshing: false,
      playlists: [],
      playlistId: '',
      playlistName: '',
      playlistSongs: [],
      playlistPhase: 'idle',
      playlistRefreshing: false,
      history: readOnlineHistory(),
      liked: {},
      cache: {},
      progress: {},
      providers: {},
    })
    
    var onlineSearchToken = 0
    var playlistLoadToken = 0
    var playlistCache = new Map()
    var playlistInflight = new Map()
    var PLAYLIST_CACHE_TTL = 60 * 1000
    
    async function searchOnline(text) {
      var query = String(text || '').trim()
      if (query === '') return
      var state = onlineStore.get()
      var provider = state.provider
      var token = (onlineSearchToken += 1)
      onlineStore.set({ phase: 'searching', query: query, error: '', results: [] })
      try {
        var body = await getJson(
          API +
            'online/search?provider=' +
            encodeURIComponent(provider) +
            '&q=' +
            encodeURIComponent(query),
        )
        if (token !== onlineSearchToken) return
        var results = Array.isArray(body.results) ? body.results : []
        onlineStore.set({ phase: 'ready', results: results })
        void refreshCacheStatus(provider, results.map(function (item) { return item.id }))
      } catch (error) {
        if (token !== onlineSearchToken) return
        onlineStore.set({ phase: 'error', error: errorText(error) })
      }
    }
    
    async function refreshCacheStatus(provider, ids) {
      var list = (ids || []).filter(Boolean).slice(0, 120)
      if (list.length === 0) return
      try {
        var body = await getJson(
          API +
            'online/cache/status?provider=' +
            encodeURIComponent(provider) +
            '&ids=' +
            encodeURIComponent(list.join(',')),
        )
        var state = onlineStore.get()
        onlineStore.set({
          cache: Object.assign({}, state.cache, body.cached || {}),
          progress: Object.assign({}, state.progress, body.progress || {}),
        })
      } catch (error) {
        // Cache badges are cosmetic.
      }
    }
    
    function mergePlaylists(previous, incoming) {
      var next = new Map()
      ;(incoming || []).forEach(function (item) {
        if (item && item.id !== undefined) next.set(String(item.id), item)
      })
      var merged = []
      ;(previous || []).forEach(function (item) {
        var fresh = next.get(String(item.id))
        if (fresh) {
          merged.push(Object.assign({}, item, fresh))
          next.delete(String(item.id))
        }
      })
      next.forEach(function (item) {
        merged.push(item)
      })
      return merged
    }
    
    async function loadMyPlaylists(provider) {
      var target = provider || onlineStore.get().provider
      var token = (playlistLoadToken += 1)
      var snapshot = onlineStore.get()
      var keep = snapshot.playlistsProvider === target && (snapshot.playlists || []).length > 0
      onlineStore.set(
        keep
          ? { playlistsPhase: 'ready', playlistsRefreshing: true, playlistsProvider: target, error: '' }
          : { playlistsPhase: 'loading', playlistsRefreshing: false, playlistsProvider: target, playlists: [] },
      )
      try {
        var body = await getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(target))
        if (token !== playlistLoadToken) return
        var incoming = Array.isArray(body.playlists) ? body.playlists : []
        var current = onlineStore.get()
        onlineStore.set({
          playlistsPhase: 'ready',
          playlistsRefreshing: false,
          playlistsProvider: target,
          playlists: keep ? mergePlaylists(current.playlists, incoming) : incoming,
          error: '',
        })
      } catch (error) {
        if (token !== playlistLoadToken) return
        var state = onlineStore.get()
        if (state.playlistsProvider === target && (state.playlists || []).length > 0) {
          // Stale-while-revalidate: keep the last good list visible.
          onlineStore.set({ playlistsPhase: 'ready', playlistsRefreshing: false, error: errorText(error) })
        } else {
          onlineStore.set({
            playlistsPhase: 'error',
            playlistsRefreshing: false,
            playlistsProvider: target,
            playlists: [],
            error: errorText(error),
          })
        }
      }
    }
    
    /** Re-read the likes playlist after a cloud like/unlike from any surface. */
    function refreshLikedPlaylist(delta) {
      var state = onlineStore.get()
      var liked = (state.playlists || []).find(function (item) {
        return item.isLike === true
      }) || (state.playlists || []).find(function (item) {
        return item.kind === 'default' || item.isDefault === true
      })
      if (liked) {
        var count = Math.max(0, (Number(liked.trackCount) || 0) + (Number(delta) || 0))
        var playlists = (state.playlists || []).map(function (item) {
          return String(item.id) === String(liked.id) ? Object.assign({}, item, { trackCount: count }) : item
        })
        onlineStore.set({ playlists: playlists, playlistsRefreshing: true })
        if (String(state.playlistId) === String(liked.id)) void openOnlinePlaylist(Object.assign({}, liked, { trackCount: count }), true)
      }
      void loadMyPlaylists(state.provider)
    }
    
    function playlistCacheKey(provider, id) {
      return String(provider || '') + ':' + String(id || '')
    }
    
    function trimPlaylistCache() {
      if (playlistCache.size <= 24) return
      var old = []
      playlistCache.forEach(function (value, key) {
        old.push({ key: key, at: value.at || 0 })
      })
      old
        .sort(function (left, right) {
          return left.at - right.at
        })
        .slice(0, playlistCache.size - 24)
        .forEach(function (row) {
          playlistCache.delete(row.key)
        })
    }
    
    function fetchPlaylistSongs(provider, id, force) {
      var key = playlistCacheKey(provider, id)
      if (!force && playlistInflight.has(key)) return playlistInflight.get(key)
      var request = getJson(
        API +
          'online/playlist-songs?provider=' +
          encodeURIComponent(provider) +
          '&id=' +
          encodeURIComponent(id),
      )
        .then(function (body) {
          var songs = Array.isArray(body.songs) ? body.songs : []
          playlistCache.set(key, {
            songs: songs,
            name: body.name || '',
            at: Date.now(),
          })
          trimPlaylistCache()
          return { songs: songs, name: body.name || '' }
        })
        .finally(function () {
          if (playlistInflight.get(key) === request) playlistInflight.delete(key)
        })
      playlistInflight.set(key, request)
      return request
    }
    
    /** Warm the cache when the pointer/focus reaches a playlist nav item. */
    function prefetchOnlinePlaylist(playlist) {
      if (!playlist || !playlist.id) return
      var provider = onlineStore.get().provider
      var key = playlistCacheKey(provider, playlist.id)
      var hit = playlistCache.get(key)
      if (hit && Date.now() - (hit.at || 0) < PLAYLIST_CACHE_TTL) return
      void fetchPlaylistSongs(provider, playlist.id, false).catch(function () {
        // Prefetch is best effort.
      })
    }
    
    async function openOnlinePlaylist(playlist, force) {
      if (!playlist || !playlist.id) return
      var provider = onlineStore.get().provider
      var key = playlistCacheKey(provider, playlist.id)
      var hit = playlistCache.get(key)
      var fresh = hit && Date.now() - (hit.at || 0) < PLAYLIST_CACHE_TTL
      onlineStore.set({
        playlistId: playlist.id,
        playlistName: playlist.name || (hit && hit.name) || '',
        playlistPhase: hit ? 'ready' : 'loading',
        playlistSongs: hit ? hit.songs : [],
        playlistRefreshing: false,
      })
      if (fresh && force !== true) return
      if (hit) onlineStore.set({ playlistRefreshing: true })
      try {
        var body = await fetchPlaylistSongs(provider, playlist.id, force === true)
        var state = onlineStore.get()
        if (String(state.playlistId) !== String(playlist.id) || state.provider !== provider) return
        onlineStore.set({
          playlistPhase: 'ready',
          playlistRefreshing: false,
          playlistName: body.name || playlist.name || '',
          playlistSongs: body.songs,
          error: '',
        })
        void refreshCacheStatus(provider, body.songs.map(function (item) { return item.id }))
      } catch (error) {
        var current = onlineStore.get()
        if (String(current.playlistId) !== String(playlist.id) || current.provider !== provider) return
        if (hit) {
          onlineStore.set({ playlistPhase: 'ready', playlistRefreshing: false, error: errorText(error) })
        } else {
          onlineStore.set({ playlistPhase: 'error', playlistRefreshing: false, playlistSongs: [], error: errorText(error) })
        }
      }
    }
    
    function closeOnlinePlaylist() {
      onlineStore.set({ playlistId: '', playlistName: '', playlistSongs: [], playlistPhase: 'idle' })
    }
    
    async function loadProviders() {
      try {
        var body = await getJson(API + 'online/providers')
        onlineStore.set({ providers: body.providers || {} })
      } catch (error) {
        // Provider status only drives labels.
      }
    }
    
    function rememberOnline(track) {
      var entry = {
        provider: track.onlineProvider,
        id: track.onlineId || '',
        title: track.title || '',
        artist: track.artist || '',
        album: track.album || '',
        durationSec: track.durationSec || 0,
        coverUrl: track.coverUrl || '',
        qualityHint: track.qualityHint || '',
        playedAt: Date.now(),
      }
      if (!entry.provider || entry.id === '') return
      var state = onlineStore.get()
      var next = [entry].concat(
        state.history.filter(function (item) {
          return !(item.provider === entry.provider && item.id === entry.id)
        }),
      )
      onlineStore.set({ history: next })
      writeOnlineHistory(next)
    }
    
    function removeHistory(entry) {
      var state = onlineStore.get()
      var next = state.history.filter(function (item) {
        return !(item.provider === entry.provider && item.id === entry.id)
      })
      onlineStore.set({ history: next })
      writeOnlineHistory(next)
    }
    
    function playOnlineResults(results, index) {
      var list = Array.isArray(results) ? results : []
      var wanted = list[index]
      // Never pre-block VIP tracks on the client: whether a track is playable
      // depends on the signed-in account, and the Host resolves that with cookies.
      var provider = (wanted && wanted.provider) || (list[0] && list[0].provider) || ''
      var account = onlineStore.get().providers[provider] || {}
      var accountKnown = account.loggedIn === true || account.loggedIn === false
      // Allow an attempt while login/VIP state is still loading; once the account
      // summary is known, only members may request VIP tracks.
      var allowVip = !accountKnown
        ? true
        : account.loggedIn === true
          ? account.vip !== false
          : false
      var playable = list.filter(function (item) {
        return item && item.id && (item.qualityHint !== 'VIP' || allowVip)
      })
      if (playable.length === 0) {
        showToast(t('online.vipOnly'))
        return
      }
      var at = 0
      if (wanted) {
        for (var i = 0; i < playable.length; i += 1) {
          if (playable[i].provider === wanted.provider && playable[i].id === wanted.id) {
            at = i
            break
          }
        }
        if (wanted.qualityHint === 'VIP' && !allowVip) {
          showToast(t('online.vipOnly'))
          return
        }
      }
      var tracks = playable.map(onlineTrackOf)
      player.playList(tracks, at)
      rememberOnline(tracks[at])
      if (tracks[at] && tracks[at].onlineProvider) {
        void refreshCacheStatus(tracks[at].onlineProvider, [tracks[at].onlineId])
      }
    }
    
    function playHistoryEntry(entry) {
      var track = onlineTrackOf(entry)
      player.playList([track], 0)
      rememberOnline(track)
    }
    
    async function startProviderLogin(provider, mode) {
      var body = await postJson(API + 'online/login/start', { provider: provider, mode: mode })
      return body
    }
    
    async function checkProviderLogin(provider, key, mode) {
      var body = await getJson(
        API +
          'online/login/status?provider=' +
          encodeURIComponent(provider) +
          '&key=' +
          encodeURIComponent(key) +
          '&mode=' +
          encodeURIComponent(mode || 'qq'),
      )
      return body.status
    }
    
    async function logoutProvider(provider) {
      try {
        await postJson(API + 'online/logout', { provider: provider })
        await loadProviders()
        showToast(t('online.logoutDone'))
      } catch (error) {
        showToast(errorText(error))
      }
    }

    // ── src/80-overlay.js
    /**
     * overlay: the single layer stack plus toast.
     *
     * Every popover, dialog and sheet pushes onto this stack; Escape pops the top
     * one. Nothing else in the UI is allowed to invent a z-index.
     */
    
    var overlayStore = createStore({ layers: [] })
    var toastStore = createStore({ text: '', seq: 0 })
    var toastTimer = null
    
    function pushLayer(kind, props) {
      var layers = overlayStore.get().layers.filter(function (layer) {
        return layer.kind !== kind
      })
      layers.push({ kind: kind, props: props || {} })
      overlayStore.set({ layers: layers })
    }
    
    function popLayer() {
      var layers = overlayStore.get().layers
      if (layers.length === 0) return false
      overlayStore.set({ layers: layers.slice(0, layers.length - 1) })
      return true
    }
    
    function removeLayer(kind) {
      var layers = overlayStore.get().layers
      var next = layers.filter(function (layer) {
        return layer.kind !== kind
      })
      if (next.length !== layers.length) overlayStore.set({ layers: next })
    }
    
    function topLayer() {
      var layers = overlayStore.get().layers
      return layers.length > 0 ? layers[layers.length - 1] : null
    }
    
    function hasLayer(kind) {
      return overlayStore.get().layers.some(function (layer) {
        return layer.kind === kind
      })
    }
    
    function showToast(text) {
      var message = String(text || '')
      if (message === '') return
      var seq = toastStore.get().seq + 1
      toastStore.set({ text: message, seq: seq })
      if (toastTimer !== null) clearTimeout(toastTimer)
      toastTimer = setTimeout(function () {
        toastTimer = null
        if (toastStore.get().seq === seq) toastStore.set({ text: '', seq: seq })
      }, 1800)
    }

    // ── src/85-select.js
    /**
     * selection + bulk actions + duplicate detection.
     */
    
    var selectionStore = createStore({ active: false, paths: [] })
    
    function selectedPaths() {
      return selectionStore.get().paths.slice()
    }
    
    function selectedPathSet() {
      var set = {}
      selectionStore.get().paths.forEach(function (path) {
        set[path] = true
      })
      return set
    }
    
    function setSelectionMode(active) {
      var state = selectionStore.get()
      selectionStore.set({ active: active === true, paths: active === true ? state.paths : [] })
    }
    
    function toggleSelected(path) {
      var state = selectionStore.get()
      var list = state.paths.slice()
      var at = list.indexOf(path)
      if (at >= 0) list.splice(at, 1)
      else list.push(path)
      selectionStore.set({ active: list.length > 0 ? state.active : false, paths: list })
    }
    
    function clearSelection() {
      selectionStore.set({ active: false, paths: [] })
    }
    
    function selectAllPaths(paths) {
      selectionStore.set({ active: true, paths: (paths || []).slice() })
    }
    
    var rangePick = { active: false, anchor: '' }
    
    /** Select the whole current list (enters selection mode). */
    function selectAllIn(list) {
      selectionStore.set({
        active: true,
        paths: (list || []).map(function (track) {
          return track.path
        }),
      })
    }
    
    /** Invert the selection within the current list. */
    function invertSelectionIn(list) {
      var selected = selectedPathSet()
      selectionStore.set({
        active: true,
        paths: (list || [])
          .map(function (track) {
            return track.path
          })
          .filter(function (path) {
            return selected[path] !== true
          }),
      })
    }
    
    function beginRangePick() {
      rangePick.active = true
      rangePick.anchor = ''
      selectionStore.set({ active: true })
      showToast(t('v2.rangePickHint'))
    }
    
    function cancelRangePick() {
      rangePick.active = false
      rangePick.anchor = ''
    }
    
    /**
     * Click handler for list rows/cards: replace (or toggle with Ctrl), or handle
     * one range pick when the user chose 区域选择.
     */
    function selectTrackIn(list, track, additive) {
      var paths = (list || []).map(function (item) {
        return item.path
      })
      if (rangePick.active) {
        if (rangePick.anchor === '') {
          rangePick.anchor = track.path
          selectionStore.set({ active: true, paths: [track.path] })
          return
        }
        var start = paths.indexOf(rangePick.anchor)
        var end = paths.indexOf(track.path)
        if (start < 0 || end < 0) {
          rangePick.anchor = track.path
          selectionStore.set({ active: true, paths: [track.path] })
          return
        }
        var from = Math.min(start, end)
        var to = Math.max(start, end)
        selectionStore.set({ active: true, paths: paths.slice(from, to + 1) })
        rangePick.active = false
        rangePick.anchor = ''
        return
      }
      var state = selectionStore.get()
      if (additive) {
        if (!state.active) selectionStore.set({ active: true, paths: [track.path] })
        else toggleSelected(track.path)
        return
      }
      if (state.active && state.paths.length === 1 && state.paths[0] === track.path) {
        clearSelection()
        return
      }
      selectionStore.set({ active: true, paths: [track.path] })
    }
    
    async function batchEditTags(paths, patch) {
      var done = 0
      var failed = 0
      for (var i = 0; i < paths.length; i += 1) {
        try {
          var body = await getJson(API + 'tags?path=' + encodeURIComponent(paths[i]))
          var tags = Object.assign({}, body.tags || {}, patch)
          await sendJson('PUT', API + 'tags', { path: paths[i], tags: tags })
          done += 1
        } catch (error) {
          failed += 1
        }
      }
      return { done: done, failed: failed }
    }
    
    async function removeTracks(paths) {
      var body = await postJson(API + 'remove', { paths: paths })
      await loadLibrary(true)
      clearSelection()
      return body
    }
    
    /** Higher bitrate, then higher sample rate, then larger file wins. */
    function compareQuality(left, right) {
      var leftBitrate = Number(left.bitrate) || 0
      var rightBitrate = Number(right.bitrate) || 0
      if (leftBitrate !== rightBitrate) return rightBitrate - leftBitrate
      var leftRate = Number(left.sampleRate) || 0
      var rightRate = Number(right.sampleRate) || 0
      if (leftRate !== rightRate) return rightRate - leftRate
      return (Number(right.size) || 0) - (Number(left.size) || 0)
    }
    
    /** Same title + artist + rounded duration, at least two entries. */
    function duplicateGroupsOf(tracks) {
      var map = {}
      ;(tracks || []).forEach(function (track) {
        var duration = Math.round(Number(track.durationSec) || 0)
        var title = String(track.title || '').trim().toLowerCase()
        var artist = String(track.artist || '').trim().toLowerCase()
        if (title === '' || duration <= 0) return
        var key = title + '\u0000' + artist + '\u0000' + duration
        if (!map[key]) map[key] = []
        map[key].push(track)
      })
      return Object.keys(map)
        .map(function (key) {
          return map[key]
        })
        .filter(function (group) {
          return group.length > 1
        })
    }

    // ── src/90-theme.js
    /**
     * theme: one plugin-prefixed stylesheet.
     *
     * Every colour is a `--dsw-*` token with a neutral fallback, so the panel
     * follows the host's light/dark theme without hardcoded surfaces.
     */
    
    var THEME_CSS = [
      // ── shell ───────────────────────────────────────────────────────────────
      '.mp-root :focus-visible{outline:2px solid var(--dsw-focus-ring-color,#4176E6);outline-offset:2px}',
      '.mp-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base,#141417);color:var(--dsw-alias-label-primary,#f4f4f5);font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);font-size:13px;line-height:20px;user-select:none;isolation:isolate}',
      '.mp-root input,.mp-root textarea{user-select:text}',
      '.mp-topbar{display:flex;align-items:center;gap:12px;flex:none;height:48px;padding:0 16px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-1,#15151a)}',
      '.mp-brand{display:flex;align-items:center;gap:8px;font-weight:650;font-size:13.5px;white-space:nowrap}',
      '.mp-brand-dot{width:30px;height:30px;flex:none;border-radius:50%;display:grid;place-items:center;overflow:hidden;padding:2px;background:linear-gradient(135deg,#9CC3FF,#4169E1);box-shadow:0 2px 8px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176E6) 42%,transparent),inset 0 0 0 1px rgba(255,255,255,.28)}',
      '.mp-brand-logo{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}',
      '.mp-src-tabs{display:flex;gap:2px;padding:3px;border-radius:12px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-src-tab{height:26px;padding:0 11px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;cursor:pointer;white-space:nowrap}',
      '.mp-src-tab:hover{color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-src-tab.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600}',
      '.mp-search{position:relative;width:220px;margin-left:auto;flex:none}',
      '.mp-search svg{position:absolute;left:10px;top:9px;color:var(--dsw-alias-label-tertiary,#8a8a93);pointer-events:none}',
      '.mp-search-input{width:100%;height:32px;padding:0 10px 0 31px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font:inherit;font-size:13px;outline:none}',
      '.mp-search-input::placeholder{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-search-input:focus{border-color:var(--dsw-alias-state-business-primary,#4176E6);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 16%, transparent)}',
      '.mp-userchip{display:none;align-items:center;gap:6px;height:26px;padding:0 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);white-space:nowrap}',
      '.mp-userchip.is-on{display:inline-flex}',
      '.mp-userchip-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-userchip-out{color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;margin-left:2px}',
      '.mp-userchip-out:hover{color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-iconbtn{width:30px;height:30px;display:inline-grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer;flex:none}',
      '.mp-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-iconbtn.is-on{color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-btn{height:30px;padding:0 12px;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:8px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.05));color:var(--dsw-alias-label-primary,#f4f4f5);font-size:13px;cursor:pointer;white-space:nowrap}',
      '.mp-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-btn.is-primary{background:var(--dsw-alias-button-primary-fill,#0f1115);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}',
      '.mp-btn.is-primary:hover{background:var(--dsw-alias-button-primary-hover,#232324)}',
      '.mp-btn.is-ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mp-btn.is-ghost:hover{color:var(--dsw-alias-label-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-btn:disabled{opacity:.5;cursor:default}',
    
      // ── workspace ───────────────────────────────────────────────────────────
      '.mp-workspace{display:grid;grid-template-columns:188px minmax(0,1fr);flex:1;min-height:0}',
      '.mp-workspace.is-queue{grid-template-columns:188px minmax(0,1fr) 304px}',
      '.mp-root.is-top .mp-workspace,.mp-root.is-top .mp-workspace.is-queue{grid-template-columns:minmax(0,1fr)}',
      '.mp-root.is-top .mp-workspace.is-queue{grid-template-columns:minmax(0,1fr) 304px}',
      '.mp-root.is-top .mp-nav{display:none}',
      '.mp-nav{display:flex;flex-direction:column;gap:16px;min-height:0;overflow-y:auto;padding:12px 8px;border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-nav-group{display:flex;flex-direction:column;gap:1px}',
      '.mp-nav-label{padding:0 10px 6px;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8a93);font-weight:600}',
      '.mp-nav-item{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;cursor:pointer;text-align:left;min-width:0}',
      '.mp-nav-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-nav-item.is-on{background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 13%, transparent);color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600;box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-nav-item span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-nav-count{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums}',
      '.mp-sectionbar{display:none;align-items:center;gap:2px;flex:none;height:40px;padding:0 18px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));overflow-x:auto;scrollbar-width:none}',
      '.mp-sectionbar::-webkit-scrollbar{display:none}',
      '.mp-root.is-top .mp-sectionbar{display:flex}',
      '.mp-sec-item{height:26px;padding:0 9px;display:inline-flex;align-items:center;gap:6px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;cursor:pointer;white-space:nowrap}',
      '.mp-sec-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-sec-item.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600}',
      '.mp-sec-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums}',
      '.mp-sec-sep{flex:none;width:1px;height:14px;background:var(--dsw-alias-border-l2,rgba(255,255,255,.14));margin:0 6px}',
      '.mp-sec-spacer{margin-left:auto}',
      '.mp-sec-actions{display:inline-flex;align-items:center;gap:4px;flex:none}',
    
      // ── content ─────────────────────────────────────────────────────────────
      '.mp-content{display:flex;flex-direction:column;min-width:0;min-height:0}',
      '.mp-content-head{display:flex;align-items:center;gap:12px;padding:10px 22px 6px;min-height:0;flex:none}',
      '.mp-title{margin:0;font-size:20px;font-weight:650;letter-spacing:-.015em;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-count{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);padding-bottom:3px;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.mp-sel-count{margin-left:2px;padding:2px 9px;border-radius:999px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-business-primary,#7AAAFF);background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 12%, transparent)}',
      '.mp-head-actions{margin-left:auto;display:flex;align-items:center;gap:6px;flex:none}',
      '.mp-toolbar{display:flex;align-items:center;gap:8px;padding:0 22px 10px;min-height:34px;flex-wrap:wrap;flex:none}',
      '.mp-toolbar:empty{display:none}',
      '.mp-chip{height:26px;padding:0 10px;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;cursor:pointer;white-space:nowrap}',
      '.mp-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-chip.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.14))}',
      '.mp-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:0 12px 18px;outline:none}',
      '.mp-vlist-inner{position:relative;width:100%}',
      '.mp-vlist-row{position:absolute;left:0;right:0}',
      '.mp-vlist-row > .mp-row{width:100%;height:100%}',
      '.mp-filterbar{display:flex;align-items:center;gap:8px;padding:0 22px 8px;flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
    
      // ── rows ────────────────────────────────────────────────────────────────
      '.mp-row{display:grid;grid-template-columns:40px minmax(0,1.6fr) minmax(0,1fr) 74px 48px 54px;align-items:center;gap:12px;height:56px;padding:0 10px;border-radius:8px;color:var(--dsw-alias-label-primary,#f4f4f5);position:relative;cursor:default}',
      '.mp-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-row.is-cur{background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 12%, transparent)}',
      '.mp-row.is-selected{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}',
      '.mp-row.is-cur.is-selected{background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 18%, transparent)}',
      '.mp-row.is-cur::before{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);width:3px;height:20px;border-radius:2px;background:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-row-cover{position:relative;width:40px;height:40px;border-radius:8px;overflow:hidden;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#8a8a93);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(255,255,255,.06))}',
      '.mp-row-cover img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mp-row.is-round .mp-row-cover{border-radius:50%}',
      '.mp-cover-play{position:absolute;inset:0;display:grid;place-items:center;border:0;padding:0;font:inherit;cursor:pointer;background:rgba(0,0,0,.5);opacity:0;transition:opacity .12s;color:#fff}',
      '.mp-row:hover .mp-cover-play{opacity:1}',
      '.mp-row-main{min-width:0}',
      '.mp-row-title{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:6px}',
      '.mp-row.is-cur .mp-row-title{color:var(--dsw-alias-state-business-primary,#7AAAFF)}',
      '.mp-row-sub{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-row-album{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-row-time{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);text-align:right;font-variant-numeric:tabular-nums}',
      '.mp-row-acts{display:flex;align-items:center;justify-content:flex-end;gap:2px}',
      '.mp-row-acts .mp-iconbtn{width:26px;height:26px;opacity:0}',
      '.mp-row-acts .mp-fav{opacity:.55}',
      '.mp-row:hover .mp-row-acts .mp-fav,.mp-row-acts .mp-fav.is-on{opacity:1}',
      '.mp-row:hover .mp-row-acts .mp-iconbtn,.mp-row-acts .mp-iconbtn.is-on{opacity:1}',
      '.mp-badge{display:inline-flex;align-items:center;height:15px;padding:0 5px;border-radius:4px;font-size:9.5px;font-weight:700;letter-spacing:.02em;line-height:1;flex:none}',
      '.mp-badge.is-vip{color:#1a1405;background:linear-gradient(180deg,#ffd76e,#f2b62e)}',
      '.mp-badge.is-cache{color:var(--dsw-alias-label-secondary,#a1a1aa);background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));padding:0 4px}',
      '.mp-eq{display:inline-flex;align-items:flex-end;gap:2px;height:11px;flex:none}',
      '.mp-eq i{width:2px;background:var(--dsw-alias-state-business-primary,#4176E6);border-radius:1px;animation:mp-eq .9s ease-in-out infinite}',
      '.mp-eq i:nth-child(2){animation-delay:.18s}',
      '.mp-eq i:nth-child(3){animation-delay:.36s}',
      '@keyframes mp-eq{0%,100%{height:3px}50%{height:11px}}',
    
      // ── grid / simple rows / stats ──────────────────────────────────────────
      '.mp-srow{display:flex;align-items:center;gap:12px;height:56px;padding:0 10px;border-radius:8px;cursor:pointer;color:inherit;background:transparent;border:0;width:100%;text-align:left;font:inherit}',
      '.mp-srow:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-srow-cover{width:44px;height:44px;border-radius:8px;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#8a8a93);flex:none;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));overflow:hidden}',
      '.mp-srow-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-srow-cover.is-round{border-radius:50%}',
      '.mp-srow-main{min-width:0;flex:1}',
      '.mp-srow-title{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-srow-sub{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-srow-meta{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums;flex:none}',
      '.mp-stat-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;padding:6px 10px 16px}',
      '.mp-stat-card{padding:14px 16px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))}',
      '.mp-stat-k{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-stat-v{font-size:22px;font-weight:650;margin-top:6px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
      '.mp-rank{padding:0 10px}',
      '.mp-rank-row{display:grid;grid-template-columns:26px 34px minmax(0,1fr) 90px 74px;gap:10px;align-items:center;height:48px;border-radius:8px;padding:0 6px;cursor:pointer}',
      '.mp-rank-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-rank-n{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);text-align:center;font-variant-numeric:tabular-nums}',
      '.mp-rank-c{width:28px;height:28px;border-radius:8px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07))}',
      '.mp-rank-m{min-width:0}',
      '.mp-rank-bar{height:4px;border-radius:2px;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));overflow:hidden}',
      '.mp-rank-bar i{display:block;height:100%;background:var(--dsw-alias-state-business-primary,#4176E6);border-radius:2px}',
      '.mp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:64px 20px;color:var(--dsw-alias-label-tertiary,#8a8a93);text-align:center}',
      '.mp-empty strong{color:var(--dsw-alias-label-secondary,#a1a1aa);font-weight:600;font-size:13px}',
      '.mp-empty span{font-size:12px;max-width:44ch}',
      '.mp-spinner{width:18px;height:18px;border-radius:50%;border:2px solid var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12));border-top-color:var(--dsw-alias-state-business-primary,#4176E6);animation:mp-spin .8s linear infinite}',
      '@keyframes mp-spin{to{transform:rotate(360deg)}}',
    
      // ── player bar ──────────────────────────────────────────────────────────
      '.mp-playerbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);align-items:center;gap:16px;flex:none;height:68px;padding:0 14px;position:relative;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-1,#15151a);box-shadow:0 -10px 30px rgba(0,0,0,.08)}',
      '.mp-pb-track{display:flex;align-items:center;gap:12px;min-width:0;padding-right:4px;overflow:hidden}',
      '.mp-pb-cover{position:relative;width:40px;height:40px;border-radius:8px;display:grid;place-items:center;flex:none;color:var(--dsw-alias-label-tertiary,#8a8a93);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2),inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(255,255,255,.06));transition:transform .16s,box-shadow .16s}',
      '.mp-pb-cover:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.26),inset 0 0 0 1px var(--dsw-alias-border-l2,rgba(255,255,255,.1))}',
      '.mp-pb-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-pb-eq{position:absolute;right:5px;bottom:5px;display:flex;align-items:flex-end;gap:2px;padding:3px 4px;border-radius:8px;background:rgba(0,0,0,.52);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);pointer-events:none}',
      '.mp-pb-eq i{width:2px;height:4px;border-radius:2px;background:#fff;animation:mp-eq .9s ease-in-out infinite}',
      '.mp-pb-eq i:nth-child(2){animation-delay:.15s}',
      '.mp-pb-eq i:nth-child(3){animation-delay:.3s}',
      '@keyframes mp-eq{0%,100%{height:4px}50%{height:10px}}',
      '@media (prefers-reduced-motion:reduce){.mp-pb-eq i{animation:none;height:7px}}',
      '.mp-pb-meta{min-width:0;flex:0 1 auto;display:flex;flex-direction:column;justify-content:center;gap:1px}',
      '.mp-pb-title{font-size:13px;font-weight:600;line-height:18px;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-pb-artist{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-pb-fav{opacity:.55;margin-left:2px;transition:opacity .12s}',
      '.mp-fav.is-on,.mp-pb-fav.is-on{color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mp-fav.is-on{opacity:1}',
      '.mp-pb-track:hover .mp-pb-fav,.mp-pb-fav.is-on,.mp-pb-fav:focus-visible{opacity:1}',
      '.mp-pb-center{display:flex;flex-direction:column;gap:0;min-width:0;width:100%;max-width:580px;margin:0 auto}',
      '.mp-pb-controls{display:flex;align-items:center;justify-content:center;gap:6px}',
      '.mp-pb-controls .mp-iconbtn{width:30px;height:30px}',
      '.mp-pb-play{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:0;background:var(--dsw-alias-label-primary,#f4f4f5);color:var(--dsw-alias-bg-base,#141417);cursor:pointer;margin:0 6px;flex:none;box-shadow:0 4px 14px rgba(0,0,0,.22);transition:transform .14s,box-shadow .14s,background .14s}',
      '.mp-pb-play:hover{transform:scale(1.06);box-shadow:0 8px 22px rgba(0,0,0,.28)}',
      '.mp-pb-play:active{transform:scale(.96)}',
      '.mp-pb-play:disabled{opacity:.4;transform:none;box-shadow:none}',
      
      '.mp-time{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums;width:38px;text-align:center;flex:none;transition:color .12s}',
      '.mp-time.is-preview{color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-seek{position:relative;flex:1;height:16px;display:flex;align-items:center;min-width:0}',
      '.mp-seek input{-webkit-appearance:none;appearance:none;width:100%;height:16px;margin:0;background:transparent;cursor:pointer}',
      '.mp-seek input::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(90deg,var(--dsw-alias-state-business-primary,#4176E6) var(--mp-p,0%),var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12)) var(--mp-p,0%));transition:height .12s}',
      '.mp-seek:hover input::-webkit-slider-runnable-track{height:6px}',
      '.mp-seek input::-moz-range-track{height:4px;border-radius:2px;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12))}',
      '.mp-seek input::-moz-range-progress{height:4px;border-radius:2px;background:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-seek input::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);margin-top:-4px;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#15151a),0 1px 4px rgba(0,0,0,.3);opacity:0;transition:opacity .12s}',
      '.mp-seek:hover input::-webkit-slider-thumb,.mp-seek input:focus-visible::-webkit-slider-thumb{opacity:1}',
      '.mp-seek input::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#15151a);opacity:0}',
      '.mp-seek:hover input::-moz-range-thumb,.mp-seek input:focus-visible::-moz-range-thumb{opacity:1}',
      '.mp-pb-right{display:flex;align-items:center;justify-content:flex-end;gap:4px}',
      '.mp-pb-right .mp-iconbtn{width:30px;height:30px}',
      '.mp-pb-vol{display:flex;align-items:center;gap:6px;width:98px;margin:0 4px 0 2px;flex:none}',
      '.mp-pb-vol input{width:64px;height:16px;-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer}',
      '.mp-pb-vol input::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:linear-gradient(90deg,var(--dsw-alias-label-secondary,#a1a1aa) var(--mp-v,60%),var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12)) var(--mp-v,60%))}',
      '.mp-pb-vol input::-moz-range-track{height:3px;border-radius:2px;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12))}',
      '.mp-pb-vol input::-moz-range-progress{height:3px;border-radius:2px;background:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mp-pb-vol input::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);margin-top:-3px;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#15151a);opacity:0;transition:opacity .12s}',
      '.mp-pb-vol:hover input::-webkit-slider-thumb,.mp-pb-vol input:focus-visible::-webkit-slider-thumb{opacity:1}',
      '.mp-pb-vol input::-moz-range-thumb{width:10px;height:10px;border:0;border-radius:50%;background:var(--dsw-alias-label-primary,#f4f4f5);opacity:0}',
      '.mp-pb-vol:hover input::-moz-range-thumb,.mp-pb-vol input:focus-visible::-moz-range-thumb{opacity:1}',
      '.mp-playerbar.is-empty .mp-pb-cover{box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(255,255,255,.06))}',
      '.mp-playerbar.is-empty .mp-pb-play{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));color:var(--dsw-alias-label-tertiary,#8a8a93);box-shadow:none}',
    
      // ── queue (side panel and floating variant) ─────────────────────────────
      '.mp-queue{display:none;flex-direction:column;min-height:0;border-left:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-1,#15151a)}',
      '.mp-workspace.is-queue .mp-queue{display:flex}',
      '.mp-q-head{display:flex;align-items:center;gap:8px;padding:14px 12px 8px;flex:none}',
      '.mp-q-title{font-size:13px;font-weight:650}',
      '.mp-q-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-q-list{flex:1;min-height:0;overflow-y:auto;padding:0 6px 14px}',
      '.mp-q-row{display:flex;align-items:center;gap:10px;height:44px;padding:0 8px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-q-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.055))}',
      '.mp-q-row.is-cur{background:color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 12%, transparent)}',
      '.mp-q-row.is-cur .mp-q-name{color:var(--dsw-alias-state-business-primary,#7AAAFF)}',
      '.mp-q-idx{width:16px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);text-align:center;font-variant-numeric:tabular-nums;flex:none}',
      '.mp-q-cover{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none;color:var(--dsw-alias-label-tertiary,#8a8a93);background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));overflow:hidden}',
      '.mp-q-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-q-main{min-width:0;flex:1}',
      '.mp-q-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-q-artist{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-queue-pop{position:fixed;right:24px;bottom:96px;z-index:70;width:340px;max-height:56vh;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:16px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:0 16px 48px rgba(0,0,0,.5);overflow:hidden}',
      '.mp-queue-pop .mp-q-list{max-height:40vh}',
    
      // ── now playing (0.11.1 look) ───────────────────────────────────────────
      '.mp-np{position:absolute;inset:0;z-index:70;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base,#141417);color:var(--dsw-alias-label-primary,#f4f4f5);transform:translateY(100%);visibility:hidden;transition:transform .32s ease,visibility .32s;pointer-events:none;user-select:none;will-change:transform}',
      '.mp-np.is-open{transform:translateY(0);visibility:visible;pointer-events:auto}',
      '.mp-np-bg{position:absolute;inset:-40px;z-index:0;overflow:hidden}',
      '.mp-np-bg img{width:100%;height:100%;object-fit:cover;filter:blur(72px) saturate(1.35) brightness(.42);transform:scale(1.15)}',
      '.mp-np-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(10,10,12,.35),rgba(10,10,12,.72) 60%,rgba(10,10,12,.92));pointer-events:none}',
      '.mp-np-head{position:relative;z-index:2;display:flex;align-items:center;gap:8px;padding:16px 24px 8px}',
      '.mp-np-head-title{flex:1;min-width:0;text-align:center;font-size:14px;font-weight:600;opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-np-head-actions{margin-left:auto;display:flex;align-items:center;gap:6px}',
      '.mp-trans-toggle{width:auto;padding:0 8px;font-size:12px;font-weight:600;line-height:1}',
      '.mp-trans-toggle.is-on{color:var(--dsw-alias-brand-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1))}',
      '.mp-np-settings{position:absolute;top:52px;right:20px;z-index:6;width:320px;max-width:calc(100% - 40px);padding:14px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:12px;background:var(--dsw-alias-bg-layer-1,#1a1a1e);box-shadow:0 12px 32px rgba(0,0,0,.45)}',
      '.mp-np-setting{margin-bottom:14px}',
      '.mp-np-setting-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
      '.mp-np-body{position:relative;z-index:2;flex:1;min-height:0;display:grid;grid-template-columns:minmax(200px,38%) minmax(0,1fr);align-items:center;gap:24px;padding:8px 40px}',
      '.mp-np-left{display:flex;flex-direction:column;align-items:center;gap:18px;min-width:0}',
      '.mp-np-disc-wrap{position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:30px}',
      '.mp-np-disc{position:relative;width:min(380px,29vw);height:min(380px,29vw);flex:none;aspect-ratio:1;display:flex;align-items:center;justify-content:center;animation:mp-disc-spin 24s linear infinite;animation-play-state:paused}',
      '.mp-np-disc.is-playing{animation-play-state:running}',
      '.mp-np-disc.is-square{animation:none}',
      '.mp-np-vinyl{position:absolute;inset:-22px;aspect-ratio:1;border-radius:50%;clip-path:circle(50% at 50% 50%);background:repeating-radial-gradient(circle at 50% 50%,#141416 0 2px,#0b0b0d 2px 5px);box-shadow:inset 0 0 40px rgba(0,0,0,.85),0 18px 50px rgba(0,0,0,.5);z-index:0}',
      '.mp-np::after{content:"";position:absolute;inset:0;z-index:1;background:radial-gradient(50% 42% at 28% 26%,color-mix(in srgb, var(--dsw-alias-state-business-primary,#4176E6) 16%, transparent),transparent 72%),radial-gradient(40% 36% at 78% 74%,rgba(122,170,255,.08),transparent 70%);pointer-events:none}',
      '.mp-np-art{position:relative;z-index:1;width:min(340px,26vw);height:min(340px,26vw);border-radius:20px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#141416;color:#71717a;box-shadow:0 34px 80px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.07)}',
      '.mp-np-art::after{content:"";position:absolute;inset:0;border-radius:20px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset 0 -48px 70px rgba(0,0,0,.28);pointer-events:none;z-index:2}',
      '.mp-np-art img{width:100%;height:100%;object-fit:cover;display:block;border-radius:20px}',
      '.mp-np-disc.is-circle .mp-np-art{border-radius:170px;clip-path:circle(50% at 50% 50%)}',
      '.mp-np-disc.is-circle .mp-np-art img{border-radius:170px}',
      '.mp-align-left .mp-np-line{text-align:left}',
      '.mp-align-center .mp-np-line{text-align:center}',
      '.mp-align-right .mp-np-line{text-align:right}',
      '.mp-np-meta{text-align:center;min-width:0;max-width:420px}',
      '.mp-np-title{font-size:20px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-np-artist{font-size:13px;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-np-right{height:100%;min-height:0;display:flex;align-items:center;justify-content:center}',
      '.mp-np-lyrics{position:relative;width:100%;max-width:560px;height:100%;max-height:420px;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent,#000 16%,#000 84%,transparent);mask-image:linear-gradient(180deg,transparent,#000 16%,#000 84%,transparent)}',
      '.mp-np-lyrics.is-static{overflow-y:auto;-webkit-mask-image:none;mask-image:none}',
      '.mp-np-lyrics.is-static .mp-np-line{opacity:.7;cursor:default;transform:none}',
      '.mp-np-lyrics-inner{transition:transform .55s cubic-bezier(.22,.61,.36,1);padding:0 8px}',
      '.mp-np-lyrics-empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:13px;text-align:center;padding:0 24px;line-height:1.7}',
      '.mp-np-line{padding:8px 6px;border-radius:8px;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;transition:color .25s ease,opacity .3s ease,transform .5s cubic-bezier(.22,.61,.36,1);transition-delay:calc(var(--mp-line-stagger,0) * 22ms);text-align:center;opacity:.42;transform:translateY(4px)}',
      '.mp-np-line:hover{color:var(--dsw-alias-label-secondary,#c4c4cc);opacity:.72}',
      '.mp-np-line.is-past{opacity:.34;transform:translateY(-4px)}',
      '.mp-np-line.is-active{color:var(--dsw-alias-label-primary,#f4f4f5);opacity:1;transform:translateY(0)}',
      '.mp-np-line-text{font-size:var(--mp-lyric-size,18px);line-height:1.6;font-weight:var(--mp-lyric-weight,500);white-space:normal;word-break:break-word;overflow-wrap:anywhere;letter-spacing:.01em}',
      '.mp-np-line.is-active .mp-np-line-text{font-weight:700;text-shadow:0 0 24px rgba(255,255,255,.12)}',
      '.mp-np-line-trans{font-size:var(--mp-lyric-trans,13px);line-height:1.5;margin-top:4px;opacity:.66}',
      '.mp-np-line.is-active .mp-np-line-trans{opacity:.85}',
      '.mp-np.is-blur .mp-np-line:not(.is-active){opacity:.34;filter:blur(1.2px)}',
      '.mp-np-bottom{position:relative;z-index:2;margin:0 40px 18px;padding:12px 18px 14px;border:.5px solid rgba(255,255,255,.08);border-radius:20px;background:rgba(16,16,20,.5);-webkit-backdrop-filter:blur(20px) saturate(1.3);backdrop-filter:blur(20px) saturate(1.3);box-shadow:0 18px 44px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06)}',
      '.mp-np-progress{margin-bottom:6px}',
      '.mp-np-bar{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px}',
      '.mp-np-time{font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);font-variant-numeric:tabular-nums}',
      '.mp-np-time-sep{opacity:.6}',
      '.mp-np-controls{display:flex;align-items:center;gap:4px;justify-self:center}',
      '.mp-np-vol{display:flex;align-items:center;gap:8px;justify-self:end}',
      '.mp-quality{font-size:11px;color:var(--dsw-alias-label-tertiary,#a1a1aa);font-variant-numeric:tabular-nums;white-space:nowrap;padding:2px 6px;border-radius:8px;background:rgba(255,255,255,.06)}',
      '@keyframes mp-disc-spin{to{transform:rotate(360deg)}}',
    
      // ── overlays, sheet, dialogs, menu, toast ───────────────────────────────
      '.mp-overlay{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;pointer-events:none}',
      '.mp-overlay.is-on{pointer-events:auto}',
      '.mp-scrim{position:absolute;inset:0;background:rgba(0,0,0,.45)}',
    
    
      '.mp-set-status{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:-4px 0 8px 12px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-set-status i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#8a8a93);flex:none}',
      '.mp-set-status.is-on{color:var(--dsw-alias-state-success-primary,#2f9e44)}',
      '.mp-set-status.is-on i{background:var(--dsw-alias-state-success-primary,#2f9e44)}',
      '.mp-set-status.is-bad{color:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mp-set-status.is-bad i{background:var(--dsw-alias-state-error-primary,#e5484d)}',
      '.mp-set-status.is-off{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-set-status-hint{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
    
      '.mp-provider-name{display:flex;align-items:center;gap:8px}',
      '.mp-provider-icon{display:inline-flex;width:20px;height:20px;flex:none}',
      '.mp-provider-logo{width:100%;height:100%;object-fit:contain;border-radius:8px;display:block}',
      '.mp-account{display:flex;align-items:center;gap:8px}',
      '.mp-account-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08));flex:none}',
      '.mp-account-avatar.is-fallback{display:grid;place-items:center;font-size:12px;font-weight:650;color:var(--dsw-alias-label-secondary,#b4b4bd)}',
      '.mp-cache-block{margin-top:16px;display:flex;flex-direction:column;gap:8px}',
      '.mp-cache-heading{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary,#b4b4bd)}',
      '.mp-cache-heading span{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-cache-list{max-height:340px;overflow-y:auto;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:12px;background:var(--dsw-alias-bg-layer-2,#1e1e22)}',
      '.mp-cache-row{display:flex;align-items:center;gap:10px;padding:8px 10px;min-width:0}',
      '.mp-cache-row + .mp-cache-row{border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-cache-provider{display:inline-flex;width:18px;height:18px;flex:none}',
      '.mp-cache-main{min-width:0;flex:1}',
      '.mp-cache-title{font-size:12px;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-cache-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}',
      '.mp-cache-time,.mp-cache-size{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-variant-numeric:tabular-nums;flex:none}',
      '.mp-cache-size{min-width:52px;text-align:right}',
      '.mp-cache-tag{font-size:9px;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-tertiary,#8a8a93);flex:none}',
      '.mp-cache-empty{padding:18px 12px;text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);border:1px dashed var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:12px}',
    
      '.mp-set-page-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:4px}',
      '.mp-set-page-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);white-space:nowrap}',
      '.mp-set-card{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:16px;background:var(--dsw-alias-bg-layer-2,#1e1e22);margin-top:12px;overflow:hidden}',
      '.mp-set-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-set-card-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:650;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-set-card-body{padding:2px 12px}',
      '.mp-set-card-body .mp-set-row:last-child{border-bottom:0}',
      '.mp-root-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-set-card-body > .mp-root-row:first-child{border-top:0}',
      '.mp-root-row.is-hidden .mp-root-path{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-root-icon{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none;color:var(--dsw-alias-state-business-primary,#7AAAFF);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-root-main{min-width:0;flex:1}',
      '.mp-root-path{font-size:12px;color:var(--dsw-alias-label-primary,#f4f4f5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-root-state{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px}',
      '.mp-root-actions{display:flex;align-items:center;gap:6px;flex:none}',
      '.mp-root-add{display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));background:var(--dsw-alias-bg-layer-1,#15151a)}',
      '.mp-root-add .mp-kit-input{flex:1;min-width:0}',
      '.mp-set-empty-card{padding:18px 0;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-set-hint-line{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);padding:0 0 10px}',
      '.mp-about-card{display:flex;align-items:center;gap:14px;padding:16px;border-radius:16px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));background:var(--dsw-alias-bg-layer-2,#1e1e22)}',
      '.mp-about-logo{width:64px;height:64px;flex:none;border-radius:50%;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,.28)}',
      '.mp-about-main{min-width:0}',
      '.mp-about-name{font-size:15px;font-weight:700;letter-spacing:.01em}',
      '.mp-about-version{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px;font-variant-numeric:tabular-nums}',
      '.mp-about-tagline{font-size:12px;color:var(--dsw-alias-label-secondary,#b4b4bd);margin-top:6px}',
      '.mp-about-rows{display:flex;flex-direction:column;gap:0;margin-top:14px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:12px;overflow:hidden}',
      '.mp-about-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#b4b4bd)}',
      '.mp-about-row + .mp-about-row{border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}',
      '.mp-about-row strong{font-weight:550;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-about-row a,.mp-about-links a{color:var(--dsw-alias-state-business-primary,#7AAAFF);text-decoration:none}',
      '.mp-about-row a:hover,.mp-about-links a:hover{text-decoration:underline}',
      '.mp-about-links{display:flex;gap:16px;margin-top:14px;font-size:12px}',
      '.mp-sheet{position:relative;width:min(760px,calc(100vw - 48px));height:min(560px,calc(100vh - 96px));display:grid;grid-template-columns:180px minmax(0,1fr);background:var(--dsw-alias-bg-layer-1,#1a1a1e);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:16px;overflow:hidden;box-shadow:var(--dsw-elevation-panel,0 30px 80px rgba(0,0,0,.5))}',
      '.mp-sheet-nav{display:flex;flex-direction:column;gap:2px;padding:16px 10px;background:var(--dsw-alias-bg-layer-1,#15151a);border-right:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-sheet-title{padding:0 10px 10px;font-size:13px;font-weight:650}',
      '.mp-sheet-tab{height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:13px;text-align:left;cursor:pointer}',
      '.mp-sheet-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-sheet-tab.is-on{background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.1));color:var(--dsw-alias-label-primary,#f4f4f5);font-weight:600}',
      '.mp-sheet-body{overflow-y:auto;padding:18px 22px 26px}',
      '.mp-sheet-body h2{margin:0 0 14px;font-size:14px;font-weight:650}',
      '.mp-set-row{display:flex;align-items:center;gap:16px;padding:11px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-set-text{min-width:0;flex:1}',
      '.mp-set-label{font-size:13px}',
      '.mp-set-desc{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:2px}',
      '.mp-set-control{flex:none;display:flex;align-items:center;gap:8px}',
      '.mp-set-control select{height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font-size:12px}',
      '.mp-range{width:120px;accent-color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-set-val{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);width:44px;text-align:right;font-variant-numeric:tabular-nums}',
      '.mp-switch{position:relative;width:38px;height:22px;border-radius:999px;border:0;background:var(--dsw-alias-interactive-bg-active,rgba(255,255,255,.12));cursor:pointer;transition:background .15s;flex:none}',
      '.mp-switch i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}',
      '.mp-switch.is-on{background:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-switch.is-on i{transform:translateX(16px)}',
      '.mp-dialog{position:relative;width:min(640px,100%);max-height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#1a1a1e);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:16px;overflow:hidden;box-shadow:var(--dsw-elevation-panel,0 30px 80px rgba(0,0,0,.5))}',
      '.mp-dialog.is-sm{width:min(380px,100%)}',
      '.mp-d-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-d-title{font-size:13.5px;font-weight:650}',
      '.mp-d-head .mp-spacer{margin-left:auto}',
      '.mp-d-body{padding:16px 18px;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:12px}',
      '.mp-d-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-field{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.mp-field label{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-d-body > *{flex-shrink:0}',
      '.mp-field input,.mp-field textarea{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font:inherit;font-size:13px;outline:none}',
      '.mp-field input:focus,.mp-field textarea:focus{border-color:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-field textarea{resize:vertical;min-height:96px;font-size:12px;line-height:1.6}',
      '.mp-d-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.mp-qr{width:190px;height:190px;margin:4px auto;border-radius:12px;background:#fff;display:grid;place-items:center;overflow:hidden}',
      '.mp-qr img{width:100%;height:100%;object-fit:contain}',
      '.mp-qr-hint{text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-ctx{position:fixed;z-index:80;min-width:186px;padding:4px;border-radius:12px;background:var(--dsw-menu-surface-fill,rgba(26,26,30,.72));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px) saturate(1.3));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px) saturate(1.3));box-shadow:var(--dsw-elevation-panel,0 16px 44px rgba(0,0,0,.5));display:flex;flex-direction:column}',
      '.mp-ctx button{display:flex;align-items:center;gap:9px;height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font-size:13px;text-align:left;cursor:pointer}',
      '.mp-ctx button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-ctx hr{border:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));margin:4px 2px}',
      '.mp-toast{position:absolute;left:50%;bottom:100px;transform:translateX(-50%) translateY(6px);z-index:90;padding:8px 14px;border-radius:12px;background:var(--dsw-alias-toast-bg,#2c2c2e);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));color:var(--dsw-alias-toast-label,#fff);font-size:12px;box-shadow:var(--dsw-elevation-panel,0 12px 32px rgba(0,0,0,.45));opacity:0;transition:.18s;pointer-events:none;max-width:70%}',
      '.mp-toast.is-on{opacity:1;transform:translateX(-50%)}',
    
      // ── selection / batch / match / lyric search ───────────────────────────
      '.mp-row-check{position:static;width:20px;height:20px;margin-right:6px;padding:0;font:inherit;cursor:pointer;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:transparent;display:grid;place-items:center;color:#fff;opacity:0;transition:opacity .12s}',
      '.mp-row:hover .mp-row-check,.mp-row.is-selected .mp-row-check,.mp-row-check:focus-visible{opacity:1}',
      '.mp-row-check.is-on{background:var(--dsw-alias-button-primary-fill,#f4f4f5);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#141417)}',
      '.mp-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-tag-cover-row{display:flex;gap:12px;align-items:center}',
      '.mp-tag-cover{width:76px;height:76px;border-radius:12px;flex:none;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));display:grid;place-items:center;overflow:hidden;color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-tag-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-tag-cover-actions{display:flex;flex-direction:column;gap:8px;min-width:0;align-items:flex-start}',
      '.mp-tag-lyrics-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.mp-match{border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));border-radius:12px;padding:10px;max-height:260px;overflow:auto}',
      '.mp-match-head{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-bottom:6px}',
      '.mp-match-item{display:flex;gap:10px;align-items:center;width:100%;padding:6px 4px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer}',
      '.mp-match-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-match-cover{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.07));overflow:hidden;flex:none}',
      '.mp-match-cover img{width:100%;height:100%;object-fit:cover}',
      '.mp-match-main{min-width:0;flex:1}',
      '.mp-dupe-group{padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-dupe-row{display:flex;gap:8px;align-items:center;font-size:12px;padding:2px 0;min-width:0}',
      '.mp-dupe-row.is-keep{color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-dupe-row.is-drop{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-dupe-meta{margin-left:auto;color:var(--dsw-alias-label-tertiary,#8a8a93);flex:none;font-variant-numeric:tabular-nums}',
      '.mp-lyr-candidates{display:flex;flex-direction:column;gap:2px;max-height:320px;overflow:auto}',
      '.mp-lyr-candidate{display:flex;gap:10px;align-items:center;padding:8px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;width:100%}',
      '.mp-lyr-candidate:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-lyr-candidate-main{min-width:0;flex:1}',
      '.mp-lyr-preview{max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:4px;padding:4px 2px}',
      '.mp-lyr-line{display:flex;gap:8px;font-size:12px;color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-lyr-tr{color:var(--dsw-alias-label-tertiary,#8a8a93)}',
      '.mp-np-offset-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}',
      '.mp-np-setting-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);margin-top:6px;line-height:1.5}',
    
      // ── composer / sidebar ──────────────────────────────────────────────────
      '.mp-composer-lyrics{display:flex;align-items:center;gap:8px;box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px));max-width:var(--dsh-composer-card-max-width,100%);margin:0 auto;height:22px;padding:0 10px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;white-space:nowrap}',
      '.mp-composer-lyrics.is-empty{display:none}',
      '.mp-composer-cluster{display:flex;align-items:center;gap:2px}',
      '.mp-cbtn{height:28px;min-width:28px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:12px;cursor:pointer;max-width:150px;overflow:hidden}',
      '.mp-cbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-cbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-side-icon{position:relative;display:grid;place-items:center;width:16px;height:16px}',
      '.mp-side-dot{position:absolute;right:-3px;top:-3px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4176E6);box-shadow:0 0 0 2px var(--dsw-alias-bg-base,#141417)}',
      '.mp-audio-host{position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none}',
    
      // ── responsive ──────────────────────────────────────────────────────────
      '.mp-trash-list{display:flex;flex-direction:column;max-height:340px;overflow:auto}',
      '.mp-trash-row{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-trash-icon{color:var(--dsw-alias-label-tertiary,#8a8a93);flex:none;display:flex}',
      '.mp-trash-main{min-width:0;flex:1;font-size:13px}',
      '.mp-trash-path{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}',
      '.mp-match-row{display:flex;flex-direction:column;gap:2px}',
      '.mp-match-fields{display:flex;flex-wrap:wrap;gap:4px;padding:0 4px 6px 46px}',
      '.mp-match-chip{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer}',
      '.mp-match-chip:hover{border-color:var(--dsw-alias-state-business-primary,#4176E6);color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-sleep-chip{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}',
      '.mp-headmenu{position:relative;display:inline-flex}',
      '.mp-headmenu-pop{position:absolute;right:0;top:34px;z-index:30;min-width:156px;padding:6px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:12px;background:var(--dsw-menu-surface-fill,rgba(26,26,30,.72));-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px) saturate(1.3));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px) saturate(1.3));box-shadow:var(--dsw-elevation-panel,0 12px 32px rgba(0,0,0,.45))}',
      '.mp-headmenu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#f4f4f5);font:inherit;font-size:13px;text-align:left;cursor:pointer}',
      '.mp-headmenu-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-headmenu-item.is-on{color:var(--dsw-alias-state-business-primary,#7AAAFF)}',
      '.mp-headmenu-label{flex:1}',
      '.mp-headmenu-hint{color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:11px}',
      '.mp-headmenu-sep{margin:5px 6px;border:0;border-top:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))}',
      '.mp-modes{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.mp-pill{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-secondary,#a1a1aa);font:inherit;font-size:12px;cursor:pointer;transition:background .15s,color .15s,border-color .15s}',
      '.mp-pill:hover{color:var(--dsw-alias-label-primary,#f4f4f5);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07))}',
      '.mp-pill.is-on{color:var(--dsw-alias-label-primary,#f4f4f5);border-color:var(--dsw-alias-state-business-primary,#4176E6);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176E6) 14%,transparent)}',
      '.mp-pill.is-primary{background:var(--dsw-alias-state-business-primary,#4176E6);border-color:transparent;color:#fff}',
      '.mp-kit-modal{width:min(640px,calc(100vw - 48px))}',
      '.mp-kit-modal.is-sm{width:min(420px,calc(100vw - 48px))}',
      '.mp-kit-content{max-height:min(720px,calc(100vh - 80px))}',
      '.mp-kit-body{display:flex;flex-direction:column;gap:12px;min-height:0}',
      '.mp-kit-text{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#a1a1aa)}',
    
      '.mp-kit-input{flex:1;height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#f4f4f5);font:inherit;font-size:13px;outline:none}',
      '.mp-kit-center{display:flex;flex-direction:column;align-items:center;gap:8px}',
      '.mp-kit-modal.mp-kit-modal-headless{width:min(760px,calc(100vw - 48px));height:min(560px,calc(100vh - 96px));max-width:none;max-height:none;background:transparent;border:0;box-shadow:none;padding:0}',
    
      '.mp-nav-head{display:flex;align-items:center;justify-content:space-between;gap:4px;padding-right:6px}',
      '.mp-nav-head .mp-nav-label{flex:1;min-width:0;padding:0 0 6px 10px}',
      '.mp-nav-act{width:20px;height:20px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;flex:none}',
      '.mp-nav-act:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-sec-label{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8a93);font-weight:600;padding:0 2px 0 8px;flex:none}',
      '.mp-sec-act{width:22px;height:22px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a93);cursor:pointer;flex:none}',
      '.mp-sec-act:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
    
      '.mp-folder-path{padding:2px 0 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#8a8a93);word-break:break-all}',
      '.mp-folder-list{display:flex;flex-direction:column;gap:2px;max-height:320px;overflow:auto}',
      '.mp-folder-row{display:flex;align-items:center;gap:8px;height:32px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#a1a1aa);font:inherit;font-size:13px;text-align:left;cursor:pointer;min-width:0}',
      '.mp-folder-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.07));color:var(--dsw-alias-label-primary,#f4f4f5)}',
      '.mp-folder-row-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mp-folder-state{padding:24px 8px;color:var(--dsw-alias-label-tertiary,#8a8a93);font-size:13px}',
    
    
      '.mp-pb-line{position:absolute;left:0;right:0;top:3px;height:5px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#f4f4f5) 26%,transparent);pointer-events:none;z-index:1}',
      '.mp-pb-line i{display:block;height:100%;background:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-pb-seek-full:hover .mp-pb-line{height:7px;top:2px}',
      '.mp-pb-seek-full{position:absolute;left:0;right:0;top:0;height:12px;z-index:4}',
      '.mp-pb-seek-full .mp-seek{height:12px;width:100%}',
      '.mp-pb-seek-full .mp-seek input{height:12px}',
    
      '.mp-pb-seek-full .mp-seek::before{content:\'\';position:absolute;left:0;right:0;top:50%;height:4px;transform:translateY(-50%);background:color-mix(in srgb,var(--dsw-alias-label-primary,#f4f4f5) 16%,transparent);pointer-events:none}',
      '.mp-pb-seek-full .mp-seek::after{content:\'\';position:absolute;left:0;top:50%;height:4px;width:var(--mp-p,0%);transform:translateY(-50%);background:var(--dsw-alias-state-business-primary,#4176E6);pointer-events:none}',
      '.mp-pb-seek-full .mp-seek:hover::before,.mp-pb-seek-full .mp-seek:hover::after{height:6px}',
      '.mp-pb-seek-full .mp-seek input::-webkit-slider-runnable-track{background:transparent}',
      '.mp-pb-seek-full .mp-seek input::-moz-range-track{background:transparent}',
      '.mp-pb-seek-full .mp-seek input::-moz-range-progress{background:transparent}',
      '.mp-pb-seek-full .mp-seek input::-webkit-slider-runnable-track{height:4px;border-radius:0;background:linear-gradient(90deg,var(--dsw-alias-state-business-primary,#4176E6) var(--mp-p,0%),color-mix(in srgb,var(--dsw-alias-label-primary,#f4f4f5) 24%,transparent) var(--mp-p,0%))}',
      '.mp-pb-seek-full .mp-seek:hover input::-webkit-slider-runnable-track{height:6px}',
      '.mp-pb-seek-full .mp-seek input::-moz-range-track{height:4px;border-radius:0;background:color-mix(in srgb,var(--dsw-alias-label-primary,#f4f4f5) 24%,transparent)}',
      '.mp-pb-seek-full .mp-seek input::-moz-range-progress{height:4px;border-radius:0;background:var(--dsw-alias-state-business-primary,#4176E6)}',
      '.mp-pb-seek-full .mp-seek input::-webkit-slider-thumb{width:12px;height:12px;margin-top:-4px;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#15151a)}',
      '.mp-pb-seek-full .mp-seek input::-moz-range-thumb{width:10px;height:10px}',
      '.mp-pb-time{width:auto;min-width:0;margin-right:4px;white-space:nowrap}',
      '.mp-pb-queue-wrap{position:relative;display:flex;align-items:center}',
      '.mp-queue-pop.is-anchored{position:absolute;left:auto;right:0;bottom:calc(100% + 10px);width:340px;max-height:50vh;z-index:80}',
      '.mp-queue-pop.is-anchored .mp-q-list{max-height:calc(50vh - 56px)}',
      '@media (max-width:1240px){.mp-row{grid-template-columns:40px minmax(0,1.6fr) minmax(0,1fr) 66px 46px 50px}}',
      '@media (max-width:1080px){.mp-row-album{display:none}.mp-row{grid-template-columns:40px minmax(0,1fr) 68px 46px 50px}.mp-workspace.is-queue{grid-template-columns:188px minmax(0,1fr)}.mp-root.is-top .mp-workspace.is-queue{grid-template-columns:minmax(0,1fr)}.mp-queue{display:none!important}}',
      '@media (max-width:980px){.mp-np-body{grid-template-columns:1fr;gap:10px;padding:4px 20px}.mp-np-left{gap:10px}.mp-np-disc-wrap{margin-bottom:12px}.mp-np-right{width:100%;max-height:34vh}.mp-np-bottom{margin:0 16px 12px;padding:10px 12px 12px}.mp-np-head{padding:12px 16px 6px}.mp-np-title{font-size:16px}}',
      '@media (max-width:900px){.mp-workspace,.mp-workspace.is-queue{grid-template-columns:56px minmax(0,1fr)}.mp-root.is-top .mp-workspace{grid-template-columns:minmax(0,1fr)}.mp-nav{padding:10px 6px;align-items:center}.mp-nav-label,.mp-nav-item span,.mp-nav-count{display:none}.mp-nav-item{width:40px;justify-content:center;padding:0}.mp-search{width:160px}.mp-pb-vol{display:none}}',
      '@media (prefers-reduced-motion:reduce){.mp-root *,.mp-root *::before,.mp-root *::after{animation:none!important;transition:none!important}}',
    ]
    
    var THEME_TEXT = THEME_CSS.join('')

    // ── src/ui/01-primitives.js
    /**
     * primitives: the few shared UI atoms plus the player hooks.
     */
    
    function usePlayerSnapshot() {
      var pair = useState(player.getSnapshot())
      useEffect(function () {
        return player.subscribe(function () {
          pair[1](player.getSnapshot())
        })
      }, [])
      return pair[0]
    }
    
    function usePlayerTime() {
      var pair = useState(player.getTime())
      useEffect(function () {
        return player.subscribeTime(function () {
          pair[1](player.getTime())
        })
      }, [])
      return pair[0]
    }
    
    function usePrefs() {
      return useStore(prefsStore)
    }
    
    /** Milliseconds left until `deadline`, ticking once a second while it is set. */
    function useCountdown(deadline) {
      var pair = useState(Date.now())
      var now = pair[0]
      var setNow = pair[1]
      useEffect(
        function () {
          if (!deadline || deadline <= Date.now()) return undefined
          var timer = setInterval(function () {
            setNow(Date.now())
          }, 1000)
          return function () {
            clearInterval(timer)
          }
        },
        [deadline],
      )
      return Math.max(0, (Number(deadline) || 0) - now)
    }
    
    function IconButton(props) {
      var button = h(
        'button',
        {
          type: 'button',
          className: cx('mp-iconbtn', props.active === true && 'is-on', props.className),
          title: props.title,
          'aria-label': props.title || props.label || '',
          disabled: props.disabled === true,
          onClick: props.onClick,
          onContextMenu: props.onContextMenu,
        },
        icon(props.icon, props.size || 16),
      )
      var HostTooltip = hostComponent('Tooltip')
      if (HostTooltip !== null && typeof props.title === 'string' && props.title !== '') {
        return h(HostTooltip, { label: props.title, side: 'bottom', delayMs: 400 }, button)
      }
      return button
    }
    
    function Button(props) {
      return h(
        'button',
        {
          type: 'button',
          className: cx(
            'mp-btn',
            props.variant === 'primary' && 'is-primary',
            props.variant === 'ghost' && 'is-ghost',
            props.className,
          ),
          disabled: props.disabled === true,
          onClick: props.onClick,
          title: props.title,
        },
        props.icon ? icon(props.icon, 14) : null,
        props.children,
      )
    }
    
    function Cover(props) {
      var failedPair = useState(false)
      var failed = failedPair[0]
      var setFailed = failedPair[1]
      useEffect(
        function () {
          setFailed(false)
        },
        [props.src],
      )
      var source = failed ? '' : props.src || ''
      return h(
        'div',
        { className: props.className, style: props.style },
        source === ''
          ? icon(props.icon || 'note', props.iconSize || 15)
          : h('img', {
              src: source,
              alt: '',
              loading: 'lazy',
              draggable: false,
              onError: function () {
                setFailed(true)
              },
            }),
      )
    }
    
    function Spinner() {
      return h('span', { className: 'mp-spinner', 'aria-hidden': 'true' })
    }
    
    function Empty(props) {
      return h(
        'div',
        { className: 'mp-empty' },
        icon(props.icon || 'note', 26),
        h('strong', null, props.title),
        props.hint ? h('span', null, props.hint) : null,
      )
    }
    
    function SeekBar(props) {
      var time = usePlayerTime()
      var pair = useState(null)
      var seeking = pair[0]
      var setSeeking = pair[1]
      var duration = time.duration > 0 ? time.duration : props.fallbackDuration || 0
      var position = seeking !== null ? seeking : Math.min(time.currentTime, duration || 0)
      var percent = duration > 0 ? clamp(position / duration, 0, 1) * 100 : 0
    
      function commit() {
        if (seeking === null) return
        if (duration > 0) player.seek(seeking)
        setSeeking(null)
      }
    
      function preview(event) {
        if (duration <= 0 || typeof props.onPreview !== 'function') return
        var rect = event.currentTarget.getBoundingClientRect()
        var ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
        props.onPreview(ratio * duration)
      }
    
      return h(
        'div',
        {
          className: 'mp-seek',
          style: { '--mp-p': percent + '%' },
          onPointerMove: preview,
          onPointerLeave: function () {
            if (typeof props.onPreview === 'function') props.onPreview(null)
          },
        },
        h('input', {
          type: 'range',
          min: 0,
          max: duration > 0 ? duration : 1,
          step: 0.5,
          value: position,
          disabled: duration <= 0,
          style: { '--mp-p': percent + '%' },
          'aria-label': t('page.duration'),
          onChange: function (event) {
            setSeeking(Number(event.target.value))
          },
          onPointerUp: commit,
          onKeyUp: commit,
          onBlur: commit,
        }),
      )
    }
    
    function Switch(props) {
      var HostSwitch = hostComponent('Switch')
      if (HostSwitch !== null) {
        return h(HostSwitch, {
          checked: props.value === true,
          onChange: function (next) {
            if (typeof props.onChange === 'function') props.onChange(next === true)
          },
          label: props.label || '',
          title: props.title,
          disabled: props.disabled === true,
        })
      }
      return h(
        'button',
        {
          type: 'button',
          className: cx('mp-switch', props.value === true && 'is-on'),
          role: 'switch',
          'aria-checked': props.value === true,
          'aria-label': props.label || '',
          onClick: function () {
            if (props.onChange) props.onChange(!props.value)
          },
        },
        h('i'),
      )
    }
    
    function KitPill(props) {
      var HostPill = hostComponent('Pill')
      var content = [
        props.icon ? icon(props.icon, 13) : null,
        h('span', { key: 'label' }, props.children),
      ]
      if (HostPill !== null) {
        return h(
          HostPill,
          {
            active: props.active === true,
            className: props.className,
            title: props.title,
            onClick: props.onClick,
          },
          content,
        )
      }
      return h(
        'button',
        {
          type: 'button',
          className: cx('mp-pill', props.active === true && 'is-on', props.className),
          title: props.title,
          onClick: props.onClick,
        },
        content,
      )
    }
    
    /**
     * Dialog shell: the host Modal when available (focus trap, Escape, portal,
     * native chrome), otherwise the same overlay markup the plugin used before.
     */
    function KitModal(props) {
      var HostModal = hostComponent('Modal')
      if (HostModal !== null) {
        if (props.headless === true) {
          return h(HostModal, {
            open: true,
            onClose: props.onClose,
            headless: true,
            className: cx('mp-kit-modal', 'mp-kit-modal-headless', props.className),
            children: props.children,
          })
        }
        return h(
          HostModal,
          {
            open: true,
            onClose: props.onClose,
            title: props.title || '',
            closeLabel: t('v2.close'),
            children: h('div', { className: 'mp-kit-body' }, props.children),
            footer: props.footer,
            className: cx('mp-kit-modal', props.small === true && 'is-sm', props.className),
            contentClassName: 'mp-kit-content',
          },
        )
      }
      if (props.headless === true) {
        return h(
          'div',
          { className: 'mp-overlay is-on' },
          h('div', { className: 'mp-scrim', onClick: props.onClose }),
          props.children,
        )
      }
      return h(
        'div',
        { className: 'mp-overlay is-on' },
        h('div', { className: 'mp-scrim', onClick: props.onClose }),
        h(
          'div',
          {
            className: cx('mp-dialog', props.small === true && 'is-sm', props.className),
            role: 'dialog',
            'aria-label': props.title || '',
          },
          h(
            'div',
            { className: 'mp-d-head' },
            h('div', { className: 'mp-d-title' }, props.title || ''),
            props.onClose
              ? h(IconButton, { icon: 'x', size: 15, title: t('v2.close'), onClick: props.onClose })
              : null,
          ),
          h('div', { className: 'mp-d-body' }, props.children),
          props.footer ? h('div', { className: 'mp-d-foot' }, props.footer) : null,
        ),
      )
    }
    
    function SetRow(props) {
      return h(
        'div',
        { className: 'mp-set-row' },
        h(
          'div',
          { className: 'mp-set-text' },
          h('div', { className: 'mp-set-label' }, props.label),
          props.desc ? h('div', { className: 'mp-set-desc' }, props.desc) : null,
        ),
        h('div', { className: 'mp-set-control' }, props.children),
      )
    }

    // ── src/ui/02-track-row.js
    /**
     * track row / card: one renderer for local tracks, online results and queue
     * rows (the queue uses a compact variant in 05-queue).
     */
    
    function trackTitleOf(track) {
      if (!track) return ''
      return track.title || stemOf(track.path || '') || basename(track.path || '')
    }
    
    function trackArtistOf(track) {
      if (!track) return ''
      return track.artist || t('page.unknownArtist')
    }
    
    function TrackRow(props) {
      var track = props.track
      var current = props.currentPath !== '' && props.currentPath === track.path
      var online = typeof track.onlineProvider === 'string' && track.onlineProvider !== ''
      var vip = track.qualityHint === 'VIP'
      var selecting = props.selectionMode === true
      var selected = props.selected === true
    
      function play() {
        if (props.onPlay) props.onPlay(track)
      }
    
      // Single click selects, double click plays (the old 0.11 interaction).
      // The checkbox / Ctrl-click is the additive path.
      function handleClick(event) {
        if (event && event.detail > 1) return
        if (props.onSelect) {
          props.onSelect(track, event ? event.ctrlKey || event.metaKey : false)
          return
        }
        if (selecting) {
          if (props.onToggleSelect) props.onToggleSelect(track.path)
          return
        }
        play()
      }
    
      return h(
        'div',
        {
          className: cx('mp-row', current && 'is-cur', selected && 'is-selected'),
          role: 'row',
          tabIndex: 0,
          'aria-selected': selected ? 'true' : 'false',
          'aria-label': trackTitleOf(track) + ' · ' + trackArtistOf(track),
          onClick: handleClick,
          onDoubleClick: play,
          onContextMenu: function (event) {
            event.preventDefault()
            if (props.onMenu) props.onMenu(track, event)
          },
          onKeyDown: function (event) {
            if (event.key === 'Enter') play()
          },
        },
        h(
          'div',
          { className: 'mp-row-cover' },
          h(Cover, { src: trackCoverSrc(track), iconSize: 15 }),
          h(
            'button',
            {
              type: 'button',
              className: 'mp-cover-play',
              title: t('page.play'),
              onClick: function (event) {
                event.stopPropagation()
                play()
              },
              onDoubleClick: function (event) {
                event.stopPropagation()
              },
            },
            icon('play', 15),
          ),
        ),
        h(
          'div',
          { className: 'mp-row-main' },
          h(
            'div',
            { className: 'mp-row-title' },
            trackTitleOf(track),
            vip ? h('span', { className: 'mp-badge is-vip' }, 'VIP') : null,
            online && props.cached === true
              ? h('span', { className: 'mp-badge is-cache', title: t('v2.cached') }, icon('download', 10))
              : null,
            current && props.playing === true
              ? h('span', { className: 'mp-eq' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 })])
              : null,
          ),
          h('div', { className: 'mp-row-sub' }, trackArtistOf(track)),
        ),
        h('div', { className: 'mp-row-album' }, track.album || ''),
        h('div', { className: 'mp-row-time' }, fmtTime(track.durationSec)),
        h(
          'div',
          { className: 'mp-row-acts' },
          h(IconButton, {
                icon: props.favorite === true ? 'heartFill' : 'heart',
                size: 15,
                className: 'mp-fav',
                active: props.favorite === true,
                title: props.favorite === true ? t('page.unfavorite') : t('page.favorite'),
                onClick: function (event) {
                  event.stopPropagation()
                  if (props.onToggleFavorite) props.onToggleFavorite(track)
                },
              }),
        ),
        h(
          'div',
          { className: 'mp-row-acts' },
          selecting
            ? h(
                'button',
                {
                  type: 'button',
                  className: cx('mp-row-check', selected && 'is-on'),
                  title: t('page.select'),
                  onClick: function (event) {
                    event.stopPropagation()
                    if (props.onToggleSelect) props.onToggleSelect(track.path)
                  },
                },
                selected ? icon('check', 12) : null,
              )
            : h(IconButton, {
                icon: 'more',
                size: 15,
                title: t('page.more'),
                onClick: function (event) {
                  event.stopPropagation()
                  if (props.onMenu) props.onMenu(track, event)
                },
              }),
        ),
      )
    }
    
    var SCROLL_MEMORY = {}
    
    function TrackListBody(props) {
      var key = props.resetKey || 'tracks'
      return h(VirtualList, {
        className: 'mp-scroll',
        items: props.items || [],
        rowHeight: 56,
        resetKey: key,
        focusPath: props.focusPath || '',
        initialScroll: SCROLL_MEMORY[key] || 0,
        onScrollTop: function (top) {
          SCROLL_MEMORY[key] = top
        },
        itemKey: function (track, index) {
          return track.path + ':' + index
        },
        empty: props.empty,
        renderRow: function (track) {
          return h(TrackRow, {
            track: track,
            currentPath: props.currentPath || '',
            playing: props.playing === true,
            favorite: props.favoriteSet ? props.favoriteSet[track.path] === true : false,
            cached: props.cachedOf ? props.cachedOf(track) === true : false,
            selectionMode: props.selectionMode === true,
            selected: props.selectedSet ? props.selectedSet[track.path] === true : false,
            onToggleSelect: props.onToggleSelect,
            onSelect: props.onSelect,
            onPlay: props.onPlay,
            onMenu: props.onMenu,
            onToggleFavorite: props.onToggleFavorite,
          })
        },
      })
    }
    
    function ScrollBox(props) {
      var key = props.resetKey || 'box'
      var ref = useRef(null)
      useEffect(
        function () {
          var element = ref.current
          if (element === null) return undefined
          element.scrollTop = SCROLL_MEMORY[key] || 0
          function onScroll() {
            SCROLL_MEMORY[key] = element.scrollTop
          }
          element.addEventListener('scroll', onScroll, { passive: true })
          return function () {
            element.removeEventListener('scroll', onScroll)
          }
        },
        [key],
      )
      return h('div', { className: 'mp-scroll', ref: ref }, props.children)
    }

    // ── src/ui/03-player-bar.js
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
      var onlineLikedPair = useState(false)
      var onlineLiked = onlineLikedPair[0]
      var setOnlineLiked = onlineLikedPair[1]
      var duration = time.duration > 0 ? time.duration : current ? current.durationSec || 0 : 0
      var progressPercent =
        duration > 0 ? clamp(((preview !== null ? preview : time.currentTime) / duration) * 100, 0, 100) : 0
      var favorite = current !== null && props.favoriteSet[current.path] === true
    
      useEffect(
        function () {
          if (current === null || !current.onlineProvider) return undefined
          var cancelled = false
          getJson(
            API +
              'online/liked?provider=' +
              encodeURIComponent(current.onlineProvider) +
              '&id=' +
              encodeURIComponent(current.onlineId || ''),
          )
            .then(function (body) {
              if (!cancelled) setOnlineLiked(body.liked === true)
            })
            .catch(function () {
              // Not signed in: keep the neutral state.
            })
          return function () {
            cancelled = true
          }
        },
        [current ? current.path : '', current ? current.onlineProvider : '', current ? current.onlineId : ''],
      )
    
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
          h('div', { className: 'mp-pb-line' }, h('i', { style: { width: progressPercent + '%' } })),
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
          current.onlineProvider
            ? h(IconButton, {
                icon: onlineLiked ? 'heartFill' : 'heart',
                size: 16,
                className: 'mp-pb-fav',
                active: onlineLiked,
                title: onlineLiked ? t('page.unfavorite') : t('page.favorite'),
                onClick: function () {
                  var next = !onlineLiked
                  postJson(API + 'online/like', { provider: current.onlineProvider, song: current, on: next })
                    .then(function () {
                      setOnlineLiked(next)
                      refreshLikedPlaylist(next ? 1 : -1)
                      showToast(next ? t('page.favorite') : t('page.unfavorite'))
                    })
                    .catch(function (error) {
                      showToast(errorText(error))
                    })
                },
              })
            : h(IconButton, {
                icon: favorite ? 'heartFill' : 'heart',
                size: 16,
                className: 'mp-pb-fav',
                active: favorite,
                title: favorite ? t('page.unfavorite') : t('page.favorite'),
                onClick: function () {
                  if (props.onToggleFavorite) props.onToggleFavorite(current)
                },
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

    // ── src/ui/04-now-playing.js
    /**
     * now playing: the 0.11.1 full-panel player (square/circular disc, blurred
     * cover backdrop, floating transport panel) rebuilt on the v2 state layer.
     */
    
    function lyricActiveIndex(lines, seconds) {
      if (!Array.isArray(lines) || lines.length === 0) return -1
      if (lines[0].time < 0) return -1
      var low = 0
      var high = lines.length - 1
      var found = -1
      while (low <= high) {
        var mid = (low + high) >> 1
        if (lines[mid].time <= seconds + 0.05) {
          found = mid
          low = mid + 1
        } else {
          high = mid - 1
        }
      }
      return found
    }
    
    function NowPlaying(props) {
      var snap = usePlayerSnapshot()
      var time = usePlayerTime()
      var prefs = usePrefs()
      var track = snap.queue[snap.index] || null
      var trackPath = track ? track.path : ''
      var pair = useState([])
      var lyrics = pair[0]
      var setLyrics = pair[1]
      var errorPair = useState('')
      var lyricError = errorPair[0]
      var setLyricError = errorPair[1]
      var settingsPair = useState(false)
      var settingsOpen = settingsPair[0]
      var setSettingsOpen = settingsPair[1]
      var settingsRef = useRef(null)
      var settingsBtnRef = useRef(null)
      var offsetPair = useState(0)
      var offsetMs = offsetPair[0]
      var setOffsetMs = offsetPair[1]
      var reloadPair = useState(0)
      var lyricReload = reloadPair[0]
      var setLyricReload = reloadPair[1]
      var boxRef = useRef(null)
      var innerRef = useRef(null)
      var rowRefs = useRef([])
    
      useEffect(
        function () {
          if (!settingsOpen) return undefined
          function onDown(event) {
            var target = event.target
            if (settingsRef.current && settingsRef.current.contains(target)) return
            if (settingsBtnRef.current && settingsBtnRef.current.contains(target)) return
            setSettingsOpen(false)
          }
          function onKey(event) {
            if (event.key === 'Escape') setSettingsOpen(false)
          }
          document.addEventListener('pointerdown', onDown, true)
          window.addEventListener('keydown', onKey)
          return function () {
            document.removeEventListener('pointerdown', onDown, true)
            window.removeEventListener('keydown', onKey)
          }
        },
        [settingsOpen],
      )
      var cover = track ? trackCoverSrc(track) : ''
      var circular = prefs.circularCover === true
      var spinning = circular && prefs.coverSpin === true && snap.playing
      var vinyl = prefs.vinylRing === true && circular
      var lyricSize = prefs.lyricSize || 18
      var translationSize = Math.round((lyricSize * (prefs.translationScale || 80)) / 100)
      var lyricsTimed = lyrics.length > 0 && lyrics[0].time >= 0
    
      useEffect(
        function () {
          if (props.open !== true || trackPath === '') return undefined
          var cancelled = false
          setLyrics([])
          setLyricError('')
          var current = snap.queue[snap.index]
          async function load() {
            try {
              if (current.onlineProvider) {
                var body = await getJson(
                  API +
                    'online/lyric?provider=' +
                    encodeURIComponent(current.onlineProvider) +
                    '&id=' +
                    encodeURIComponent(current.onlineId || ''),
                )
                var lines = parseLrcText(body.lrc || '')
                if (body.translation) mergeLyricTranslation(lines, body.translation)
                if (!cancelled) {
                  setLyrics(lines)
                  setOffsetMs(0)
                }
                return
              }
              var order = Array.isArray(prefs.lyricOrder) ? prefs.lyricOrder.join(',') : 'embedded,lrc'
              var local = await getJson(
                API + 'lyrics?path=' + encodeURIComponent(current.path) + '&order=' + encodeURIComponent(order),
              )
              if (!cancelled) {
                setLyrics(Array.isArray(local.lines) ? local.lines : [])
                setOffsetMs(Number(local.offsetMs) || 0)
              }
            } catch (error) {
              if (!cancelled) setLyricError(errorText(error))
            }
          }
          load()
          return function () {
            cancelled = true
          }
        },
        [props.open, trackPath, lyricReload],
      )
    
      var active = lyricActiveIndex(lyrics, time.currentTime - offsetMs / 1000)
      var duration = time.duration > 0 ? time.duration : track ? track.durationSec || 0 : 0
      var favorite = track !== null && props.favoriteSet[track.path] === true
    
      // Keep the active line vertically centred, using real row heights.
      useEffect(
        function () {
          var box = boxRef.current
          var inner = innerRef.current
          if (box === null || inner === null) return
          if (lyrics.length === 0 || !lyricsTimed) {
            inner.style.transform = ''
            return
          }
          var index = active >= 0 ? active : 0
          var row = rowRefs.current[index]
          if (!row) return
          var offset = row.offsetTop - (box.clientHeight / 2 - row.offsetHeight / 2)
          inner.style.transform = 'translateY(' + -offset + 'px)'
        },
        [active, lyrics],
      )
    
      function seekLine(line) {
        if (!line || line.time < 0) return
        player.seek(line.time + offsetMs / 1000)
      }
    
      function applyOffset(delta) {
        if (!track || track.onlineProvider) return
        var next = Math.max(-60000, Math.min(60000, offsetMs + delta))
        setOffsetMs(next)
        postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: next }).catch(function (error) {
          setLyricError(errorText(error))
        })
      }
    
      function writeLyricsBack() {
        if (!track || track.onlineProvider) return
        postJson(API + 'lyrics/calibrate', { path: track.path, offsetMs: offsetMs, write: true })
          .then(function () {
            setLyricReload(function (value) {
              return value + 1
            })
            showToast(t('page.lyricsSaved'))
          })
          .catch(function (error) {
            setLyricError(errorText(error))
          })
      }
    
      function openOnlineLyric() {
        if (!track || track.onlineProvider) return
        pushLayer('onlineLyric', {
          track: { path: track.path, title: trackTitleOf(track), artist: trackArtistOf(track) },
          onApply: function (lrc) {
            postJson(API + 'lyrics/save', { path: track.path, lrc: lrc })
              .then(function () {
                setLyricReload(function (value) {
                  return value + 1
                })
                showToast(t('page.lyricsSaved'))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
      }
    
      return h(
        'div',
        {
          className: cx(
            'mp-np',
            props.open === true && 'is-open',
            prefs.lyricBlur === true && 'is-blur',
            'mp-align-' + (prefs.lyricAlign || 'center'),
          ),
          role: 'dialog',
          'aria-label': t('page.openPlayer'),
          'aria-hidden': props.open === true ? 'false' : 'true',
          style: {
            '--mp-lyric-size': lyricSize + 'px',
            '--mp-lyric-weight': String(prefs.lyricWeight || 500),
            '--mp-lyric-trans': translationSize + 'px',
          },
        },
        cover !== '' ? h('div', { className: 'mp-np-bg' }, h('img', { src: cover, alt: '' })) : null,
        h('div', { className: 'mp-np-shade' }),
        h(
          'div',
          { className: 'mp-np-head' },
          h(IconButton, { icon: 'chevronDown', size: 20, title: t('page.closePlayer'), onClick: props.onClose }),
          h('div', { className: 'mp-np-head-title' }, track ? trackTitleOf(track) : t('page.noTrack')),
          h(
            'div',
            { className: 'mp-np-head-actions' },
            h(
              'button',
              {
                type: 'button',
                ref: settingsBtnRef,
                className: cx('mp-iconbtn', 'mp-trans-toggle', settingsOpen && 'is-on'),
                title: t('v2.lyricSettings'),
                onClick: function () {
                  setSettingsOpen(!settingsOpen)
                },
              },
              'Aa',
            ),
            h(
              'button',
              {
                type: 'button',
                className: cx('mp-iconbtn', 'mp-trans-toggle', prefs.showTranslation === true && 'is-on'),
                title: t('page.translation'),
                onClick: function () {
                  setPrefs({ showTranslation: prefs.showTranslation !== true })
                },
              },
              '译',
            ),
          ),
        ),
        settingsOpen
          ? h(
              'div',
              { className: 'mp-np-settings', ref: settingsRef },
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
                  h('span', null, t('page.lyricWeight')),
                  h('span', { className: 'mp-set-val' }, String(prefs.lyricWeight || 500)),
                ),
                h('input', {
                  type: 'range',
                  className: 'mp-range',
                  min: 300,
                  max: 800,
                  step: 100,
                  value: prefs.lyricWeight || 500,
                  onChange: function (event) {
                    setPrefs({ lyricWeight: Number(event.target.value) })
                  },
                }),
              ),
              h(
                'div',
                { className: 'mp-np-setting-head' },
                h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary,#a1a1aa)' } }, t('page.translationScale')),
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
          : null,
        h(
          'div',
          { className: 'mp-np-body' },
          h(
            'div',
            { className: 'mp-np-left' },
            h(
              'div',
              { className: 'mp-np-disc-wrap' },
              h(
                'div',
                {
                  className: cx(
                    'mp-np-disc',
                    circular ? 'is-circle' : 'is-square',
                    spinning && 'is-playing',
                    vinyl && 'is-vinyl',
                  ),
                },
                vinyl ? h('div', { className: 'mp-np-vinyl' }) : null,
                h(
                  'div',
                  { className: 'mp-np-art' },
                  cover !== '' ? h('img', { src: cover, alt: '', draggable: false }) : icon('note', 96),
                ),
              ),
            ),
            h(
              'div',
              { className: 'mp-np-meta' },
              h('div', { className: 'mp-np-title' }, track ? trackTitleOf(track) : '—'),
              h('div', { className: 'mp-np-artist' }, track ? trackArtistOf(track) : ''),
            ),
          ),
          h(
            'div',
            { className: 'mp-np-right' },
            h(
              'div',
              { className: 'mp-np-lyrics' + (lyricsTimed ? '' : ' is-static'), ref: boxRef },
              lyrics.length === 0
                ? h('div', { className: 'mp-np-lyrics-empty' }, lyricError !== '' ? lyricError : t('page.noLyrics'))
                : h(
                    'div',
                    { className: 'mp-np-lyrics-inner', ref: innerRef },
                    lyrics.map(function (line, index) {
                      return h(
                        'div',
                        {
                          key: String(index),
                          ref: function (element) {
                            rowRefs.current[index] = element
                          },
                          className:
                            'mp-np-line' +
                            (index === active ? ' is-active' : '') +
                            (active >= 0 && index < active ? ' is-past' : ''),
                          style: {
                            '--mp-line-stagger': String(active >= 0 ? Math.min(Math.abs(index - active), 8) : 0),
                          },
                          onClick: function () {
                            seekLine(line)
                          },
                        },
                        h('div', { className: 'mp-np-line-text' }, line.text),
                        prefs.showTranslation === true && line.translation
                          ? line.translation.split('\n').map(function (part, partIndex) {
                              return h(
                                'div',
                                { key: 'translation-' + partIndex, className: 'mp-np-line-trans' },
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
          { className: 'mp-np-bottom' },
          h('div', { className: 'mp-np-progress' }, h(SeekBar, { fallbackDuration: track ? track.durationSec || 0 : 0 })),
          h(
            'div',
            { className: 'mp-np-bar' },
            h(
              'div',
              { className: 'mp-np-time' },
              h('span', null, fmtClock(time.currentTime)),
              h('span', { className: 'mp-np-time-sep' }, ' / '),
              h('span', null, fmtClock(duration)),
            ),
            h(
              'div',
              { className: 'mp-np-controls' },
              h(IconButton, {
                icon: playModeIcon(playModeOf(snap)),
                size: 17,
                title: t('page.loopAll'),
                onClick: function () {
                  cyclePlayMode(snap)
                },
              }),
              h(IconButton, {
                icon: 'prev',
                size: 18,
                title: t('page.prev'),
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
                  onClick: function () {
                    player.toggle()
                  },
                },
                icon(snap.playing ? 'pause' : 'play', 18),
              ),
              h(IconButton, {
                icon: 'next',
                size: 18,
                title: t('page.next'),
                onClick: function () {
                  player.next()
                },
              }),
              h(IconButton, {
                icon: 'list',
                size: 18,
                title: t('page.queue'),
                onClick: props.onQueue,
              }),
            ),
            h(
              'div',
              { className: 'mp-np-vol' },
              track && track.sampleRate ? h('span', { className: 'mp-quality' }, fmtKhz(track.sampleRate)) : null,
              track && !track.onlineProvider
                ? h(IconButton, {
                    icon: 'heart',
                    size: 18,
                    active: favorite,
                    title: favorite ? t('page.unfavorite') : t('page.favorite'),
                    onClick: function () {
                      if (props.onToggleFavorite) props.onToggleFavorite(track)
                    },
                  })
                : null,
            ),
          ),
        ),
      )
    }

    // ── src/ui/05-queue.js
    /**
     * queue: side panel inside the workspace, plus the floating variant used from
     * the chat composer. Both share QueueList so there is one row implementation.
     */
    
    function QueueList(props) {
      var snap = props.snap
      if (!snap || !snap.queue || snap.queue.length === 0) {
        return h(
          'div',
          { className: 'mp-empty', style: { padding: '36px 16px' } },
          icon('list', 24),
          h('strong', null, t('page.queueEmpty')),
        )
      }
      return h(
        'div',
        { className: 'mp-q-list' },
        snap.queue.map(function (track, index) {
          var current = index === snap.index
          return h(
            'div',
            {
              key: track.path + ':' + index,
              className: cx('mp-q-row', current && 'is-cur'),
              onClick: function () {
                player.playList(snap.queue, index)
              },
              title: trackTitleOf(track),
            },
            h(
              'div',
              { className: 'mp-q-idx' },
              current && snap.playing ? icon('play', 11) : String(index + 1),
            ),
            h('div', { className: 'mp-q-cover' }, h(Cover, { src: trackCoverSrc(track), iconSize: 12 })),
            h(
              'div',
              { className: 'mp-q-main' },
              h('div', { className: 'mp-q-name' }, trackTitleOf(track)),
              h('div', { className: 'mp-q-artist' }, trackArtistOf(track)),
            ),
            h('div', { className: 'mp-q-artist' }, fmtTime(track.durationSec)),
          )
        }),
      )
    }
    
    function QueuePanel(props) {
      return h(
        'aside',
        { className: 'mp-queue', 'aria-label': t('page.queue') },
        h(
          'div',
          { className: 'mp-q-head' },
          h(
            'div',
            null,
            h('div', { className: 'mp-q-title' }, t('page.queue')),
            h(
              'div',
              { className: 'mp-q-sub' },
              (props.snap.queue.length || 0) + ' · ' + (props.snap.order === 'random' ? t('page.shuffle') : t('page.modeSequence')),
            ),
          ),
          h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
          h(IconButton, {
            icon: 'target',
            size: 15,
            title: t('page.locateCurrent'),
            onClick: props.onLocate,
          }),
          h(IconButton, {
            icon: 'x',
            size: 15,
            title: t('v2.close'),
            onClick: props.onClose,
          }),
        ),
        h(QueueList, { snap: props.snap }),
      )
    }
    
    function QueuePopover(props) {
      if (props.open !== true) return null
      return h(
        'div',
        {
          className: cx('mp-queue-pop', props.anchored === true && 'is-anchored'),
          role: 'dialog',
          'aria-label': t('page.queue'),
        },
        h(
          'div',
          { className: 'mp-q-head' },
          h('div', { className: 'mp-q-title' }, t('page.queue')),
          h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
          h(IconButton, { icon: 'x', size: 14, title: t('v2.close'), onClick: props.onClose }),
        ),
        h(QueueList, { snap: props.snap }),
      )
    }

    // ── src/ui/06-settings.js
    /**
     * settings: one full-height sheet with six tabs.
     *
     * The layout switch lives here (Appearance → Layout) because the user asked for
     * a single, discoverable place to change it.
     */
    
    var SETTINGS_TABS = [
      { key: 'appearance', label: 'v2.appearance' },
      { key: 'lyrics', label: 'v2.lyrics' },
      { key: 'playback', label: 'v2.playback' },
      { key: 'online', label: 'v2.online' },
      { key: 'library', label: 'v2.library' },
      { key: 'cache', label: 'v2.cacheTab' },
      { key: 'about', label: 'v2.about' },
    ]
    
    function SettingsSheet(props) {
      var prefs = usePrefs()
      var sleepRemaining = useCountdown(prefs.sleepDeadline)
      var library = useStore(libraryStore)
      var online = useStore(onlineStore)
      var tabPair = useState('appearance')
      var tab = tabPair[0]
      var setTab = tabPair[1]
      var cachePair = useState(null)
      var cacheSongsPair = useState(null)
      var cacheSongs = cacheSongsPair[0]
      var setCacheSongs = cacheSongsPair[1]
      var builtinLoudness =
        typeof window !== 'undefined' &&
        (typeof window.OfflineAudioContext !== 'undefined' ||
          typeof window.webkitOfflineAudioContext !== 'undefined')
      var cache = cachePair[0]
      var setCache = cachePair[1]
      var pathPair = useState('')
      var rootDraft = pathPair[0]
      var setRootDraft = pathPair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
    
      useEffect(
        function () {
          if (tab !== 'online' || props.open !== true) return undefined
          void loadProviders()
          return undefined
        },
        [tab, props.open],
      )
    
      useEffect(
        function () {
          if (tab !== 'cache' || props.open !== true) return undefined
          var cancelled = false
          getJson(API + 'online/cache')
            .then(function (body) {
              if (!cancelled) setCache(body)
            })
            .catch(function () {
              if (!cancelled) setCache(null)
            })
          getJson(API + 'online/cache/list')
            .then(function (body) {
              if (!cancelled) setCacheSongs(Array.isArray(body.songs) ? body.songs : [])
            })
            .catch(function () {
              if (!cancelled) setCacheSongs([])
            })
          return function () {
            cancelled = true
          }
        },
        [tab, props.open],
      )
    
      if (props.open !== true) return null
    
      function patchPrefs(patch) {
        setPrefs(patch)
      }
    
      function layoutChoices() {
        return h(
          'div',
          { style: { display: 'flex', gap: '4px' } },
          h(
            'button',
            {
              type: 'button',
              className: cx('mp-chip', prefs.layout === 'top' && 'is-on'),
              onClick: function () {
                patchPrefs({ layout: 'top' })
              },
            },
            icon('list', 13),
            t('v2.layoutTop'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: cx('mp-chip', prefs.layout === 'rail' && 'is-on'),
              onClick: function () {
                patchPrefs({ layout: 'rail' })
              },
            },
            icon('list', 13),
            t('v2.layoutRail'),
          ),
        )
      }
    
      function appearanceTab() {
        return [
          h('h2', { key: 'h' }, t('v2.appearance')),
          h(
            SetRow,
            { key: 'layout', label: t('v2.layout'), desc: t('v2.layoutHint') },
            layoutChoices(),
          ),
          h(
            SetRow,
            { key: 'spin', label: t('v2.spin'), desc: t('v2.spinDesc') },
            h(Switch, {
              value: prefs.coverSpin === true,
              label: t('v2.spin'),
              onChange: function (value) {
                patchPrefs({ coverSpin: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'round', label: t('v2.roundCover'), desc: t('v2.roundCoverDesc') },
            h(Switch, {
              value: prefs.circularCover === true,
              label: t('v2.roundCover'),
              onChange: function (value) {
                patchPrefs({ circularCover: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'vinyl', label: t('v2.vinylRing'), desc: t('v2.vinylRingDesc') },
            h(Switch, {
              value: prefs.vinylRing === true,
              label: t('v2.vinylRing'),
              onChange: function (value) {
                patchPrefs({ vinylRing: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'hostkit', label: t('v2.hostKit'), desc: t('v2.hostKitDesc') },
            h(
              'span',
              { className: 'mp-chip', style: { cursor: 'default' } },
              hostUi ? t('v2.hostKitNative') : t('v2.hostKitFallback'),
            ),
          ),
        ]
      }
    
      function lyricsTab() {
        return [
          h('h2', { key: 'h' }, t('v2.lyrics')),
          h(
            SetRow,
            { key: 'tr', label: t('page.translation') },
            h(Switch, {
              value: prefs.showTranslation === true,
              onChange: function (value) {
                patchPrefs({ showTranslation: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'size', label: t('page.lyricSize') },
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 14,
              max: 26,
              step: 1,
              value: prefs.lyricSize,
              onChange: function (event) {
                patchPrefs({ lyricSize: Number(event.target.value) })
              },
            }),
            h('span', { className: 'mp-set-val' }, String(prefs.lyricSize) + ' px'),
          ),
          h(
            SetRow,
            { key: 'scale', label: t('page.translationScale') },
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 60,
              max: 100,
              step: 5,
              value: prefs.translationScale,
              onChange: function (event) {
                patchPrefs({ translationScale: Number(event.target.value) })
              },
            }),
            h('span', { className: 'mp-set-val' }, String(prefs.translationScale) + '%'),
          ),
          h(
            SetRow,
            { key: 'order', label: t('settings.lyricOrder') },
            h(
              'select',
              {
                value: (prefs.lyricOrder || []).join(','),
                onChange: function (event) {
                  patchPrefs({ lyricOrder: event.target.value.split(',') })
                },
              },
              h('option', { value: 'embedded,lrc' }, t('settings.lyricSourceEmbedded') + ' → LRC'),
              h('option', { value: 'lrc,embedded' }, 'LRC → ' + t('settings.lyricSourceEmbedded')),
            ),
          ),
          h(
            SetRow,
            { key: 'align', label: t('settings.lyricAlign') },
            h(
              'select',
              {
                value: prefs.lyricAlign || 'center',
                onChange: function (event) {
                  patchPrefs({ lyricAlign: event.target.value })
                },
              },
              h('option', { value: 'center' }, t('settings.alignCenter')),
              h('option', { value: 'left' }, t('settings.alignLeft')),
              h('option', { value: 'right' }, t('settings.alignRight')),
            ),
          ),
        ]
      }
    
      function playbackTab() {
        return [
          h('h2', { key: 'h' }, t('v2.playback')),
          h(
            SetRow,
            { key: 'resume', label: t('settings.resumeOnStart') },
            h(Switch, {
              value: prefs.resumeOnStart === true,
              onChange: function (value) {
                patchPrefs({ resumeOnStart: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'auto', label: t('settings.autoResume') },
            h(Switch, {
              value: prefs.autoResume === true,
              onChange: function (value) {
                patchPrefs({ autoResume: value })
              },
            }),
          ),
          h(
            SetRow,
            { key: 'per', label: t('settings.rememberPerTrack') },
            h(Switch, {
              value: prefs.rememberPerTrack === true,
              onChange: function (value) {
                patchPrefs({ rememberPerTrack: value })
              },
            }),
          ),
          h(
            SetRow,
            {
              key: 'normalize',
              label: t('settings.volumeNormalize'),
              desc: t('settings.volumeNormalizeHint'),
            },
            h(Switch, {
              value: prefs.normalizeVolume !== false,
              onChange: function (value) {
                patchPrefs({ normalizeVolume: value })
                if (player.setNormalize) player.setNormalize(value)
              },
            }),
          ),
          h(
            'div',
            {
              key: 'normalize-status',
              className: cx(
                'mp-set-status',
                prefs.normalizeVolume === false ? 'is-off' : builtinLoudness ? 'is-on' : 'is-bad',
              ),
            },
            h('i'),
            h(
              'span',
              null,
              prefs.normalizeVolume === false
                ? t('settings.volumeNormalizeOff')
                : builtinLoudness
                  ? t('settings.volumeNormalizeReady')
                  : t('settings.volumeNormalizeMissing'),
            ),
            prefs.normalizeVolume !== false && !builtinLoudness
              ? h('span', { className: 'mp-set-status-hint' }, t('settings.volumeNormalizeMissingHint'))
              : null,
          ),
          h(
            SetRow,
            { key: 'sleep', label: t('settings.sleepTimer') },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              h(
                'select',
                {
                  value: String(prefs.sleepTimerMinutes || 0),
                  onChange: function (event) {
                    var minutes = Number(event.target.value) || 0
                    patchPrefs({
                      sleepTimerMinutes: minutes,
                      sleepDeadline: minutes > 0 ? Date.now() + minutes * 60000 : 0,
                    })
                  },
                },
                [0, 15, 30, 60, 90].map(function (minutes) {
                  return h(
                    'option',
                    { key: minutes, value: String(minutes) },
                    minutes === 0 ? t('settings.sleepOff') : t('v2.minutes', { n: minutes }),
                  )
                }),
              ),
              sleepRemaining > 0
                ? h('span', { className: 'mp-set-val' }, t('v2.sleepRemaining', { time: fmtClock(sleepRemaining / 1000) }))
                : null,
              sleepRemaining > 0
                ? h(
                    Button,
                    {
                      variant: 'ghost',
                      onClick: function () {
                        patchPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
                      },
                    },
                    t('v2.sleepCancel'),
                  )
                : null,
            ),
          ),
        ]
      }
    
      function accountAvatar(info) {
        if (info.avatarUrl) {
          return h('img', {
            className: 'mp-account-avatar',
            src: API + 'online/cover?url=' + encodeURIComponent(info.avatarUrl),
            alt: '',
          })
        }
        return h('span', { className: 'mp-account-avatar is-fallback' }, (info.nickname || '?').slice(0, 1))
      }
    
      function onlineTab() {
        var providers = online.providers || {}
        var rows = ['netease', 'qq', 'kugou'].map(function (provider) {
          var info = providers[provider] || {}
          var label =
            provider === 'netease'
              ? t('online.providerNetease')
              : provider === 'qq'
                ? t('online.providerQq')
                : t('online.providerKugou')
          return h(
            SetRow,
            {
              key: provider,
              label: h(
                'span',
                { className: 'mp-provider-name' },
                h('span', { className: 'mp-provider-icon' }, providerLogo(provider, 20)),
                h('span', null, label),
              ),
              desc: info.loggedIn
                ? info.nickname || (provider === 'qq' ? t('online.qqAccount') : t('online.loggedIn'))
                : t('online.loggedOut'),
            },
            info.loggedIn
              ? h(
                  'div',
                  { className: 'mp-account' },
                  accountAvatar(info),
                  h(Button, {
                    variant: 'ghost',
                    icon: 'logout',
                    onClick: function () {
                      void logoutProvider(provider)
                    },
                    children: t('online.logout'),
                  }),
                )
              : h(Button, {
                  variant: 'primary',
                  icon: 'qr',
                  onClick: function () {
                    pushLayer('login', { provider: provider, mode: 'qq' })
                  },
                  children: t('online.login'),
                }),
          )
        })
        rows.unshift(h('h2', { key: 'h' }, t('v2.online')))
        rows.push(
          h(
            'p',
            { key: 'hint', className: 'mp-set-desc' },
            t('online.settingsHint'),
          ),
        )
        return rows
      }
    
      function libraryTab() {
        var config = library.config || { roots: [], hiddenRoots: [], depth: 4 }
        var roots = Array.isArray(config.roots) ? config.roots : []
        var hiddenRoots = Array.isArray(config.hiddenRoots) ? config.hiddenRoots : []
        var scanning = library.phase === 'loading'
        function setRootVisible(root, visible) {
          var next = hiddenRoots.slice()
          var at = next.indexOf(root)
          if (visible && at >= 0) next.splice(at, 1)
          if (!visible && at < 0) next.push(root)
          void saveConfig({ hiddenRoots: next })
        }
        function removeRoot(root) {
          pushLayer('confirm', {
            title: t('page.delete'),
            text: t('settings.removeConfirm'),
            onConfirm: function () {
              var next = roots.filter(function (item) {
                return item !== root
              })
              void saveConfig({ roots: next })
            },
          })
        }
        function rescan() {
          if (scanning) return
          void loadLibrary(true)
          showToast(t('page.scanning'))
        }
        var folderRows =
          roots.length === 0
            ? [h('div', { key: 'empty', className: 'mp-set-empty-card' }, t('v2.noTracksHint'))]
            : roots.map(function (root) {
                var hidden = hiddenRoots.indexOf(root) >= 0
                return h(
                  'div',
                  { key: root, className: cx('mp-root-row', hidden && 'is-hidden') },
                  h('span', { className: 'mp-root-icon' }, icon('folder', 16)),
                  h(
                    'div',
                    { className: 'mp-root-main' },
                    h('div', { className: 'mp-root-path', title: root }, root),
                    h('div', { className: 'mp-root-state' }, hidden ? t('v2.folderHidden') : t('v2.folderVisible')),
                  ),
                  h(
                    'div',
                    { className: 'mp-root-actions' },
                    h(Switch, {
                      value: !hidden,
                      label: hidden ? t('v2.folderHidden') : t('v2.folderVisible'),
                      onChange: function (visible) {
                        setRootVisible(root, visible)
                      },
                    }),
                    h(IconButton, {
                      icon: 'trash',
                      size: 15,
                      title: t('page.delete'),
                      onClick: function () {
                        removeRoot(root)
                      },
                    }),
                  ),
                )
              })
        return [
          h(
            'div',
            { key: 'head', className: 'mp-set-page-head' },
            h('h2', null, t('v2.library')),
            h(
              'span',
              { className: 'mp-set-page-meta' },
              t('settings.scannedTracks', { n: (library.tracks || []).length }),
              (library.warnings || []).length > 0
                ? ' · ' + t('settings.scanWarnings', { n: library.warnings.length })
                : '',
            ),
          ),
          h(
            'section',
            { key: 'folders', className: 'mp-set-card' },
            h(
              'div',
              { className: 'mp-set-card-head' },
              h('div', { className: 'mp-set-card-title' }, icon('folder', 13), t('settings.foldersTitle')),
              h(Button, {
                variant: 'ghost',
                icon: 'refresh',
                disabled: scanning,
                onClick: rescan,
                children: scanning ? t('page.scanning') : t('page.refresh'),
              }),
            ),
            h('div', { className: 'mp-set-card-body' }, folderRows),
            h(
              'div',
              { className: 'mp-root-add' },
              h('input', {
                type: 'text',
                className: 'mp-kit-input',
                value: rootDraft,
                placeholder: 'D:\\Music',
                onChange: function (event) {
                  setRootDraft(event.target.value)
                },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') addRoot()
                },
              }),
              h(
                Button,
                { variant: 'ghost', icon: 'folder', onClick: function () { pushLayer('folderPicker') } },
                t('v2.folderBrowse'),
              ),
              h(Button, {
                variant: 'primary',
                icon: 'plus',
                disabled: busy || rootDraft.trim() === '',
                onClick: addRoot,
                children: t('page.create'),
              }),
            ),
          ),
          h(
            'section',
            { key: 'scan', className: 'mp-set-card' },
            h(
              'div',
              { className: 'mp-set-card-head' },
              h('div', { className: 'mp-set-card-title' }, icon('settings', 13), t('settings.scanSettings')),
            ),
            h(
              'div',
              { className: 'mp-set-card-body' },
              h(
                SetRow,
                { key: 'depth', label: t('settings.depth'), desc: t('settings.depthHint') },
                h(
                  'select',
                  {
                    value: String(config.depth === undefined ? 4 : config.depth),
                    onChange: function (event) {
                      void saveConfig({ depth: Number(event.target.value) })
                    },
                  },
                  [0, 1, 2, 3, 4, 5, 6].map(function (n) {
                    return h('option', { key: n, value: String(n) }, String(n))
                  }),
                ),
              ),
              h('div', { className: 'mp-set-hint-line' }, t('settings.formatsHint')),
            ),
          ),
          h(
            'section',
            { key: 'trash', className: 'mp-set-card' },
            h(
              'div',
              { className: 'mp-set-card-head' },
              h('div', { className: 'mp-set-card-title' }, icon('trash', 13), t('v2.trash')),
              h(Button, { variant: 'ghost', icon: 'trash', onClick: function () { pushLayer('trash', {}) } }, t('settings.openTrash')),
            ),
            h('div', { className: 'mp-set-card-body' }, h('p', { className: 'mp-set-desc' }, t('v2.trashHint'))),
          ),
        ]
      }
    
      function addRoot() {
        var value = rootDraft.trim()
        if (value === '' || busy) return
        var config = library.config || { roots: [] }
        var roots = Array.isArray(config.roots) ? config.roots.slice() : []
        if (roots.indexOf(value) >= 0) return
        roots.push(value)
        setBusy(true)
        saveConfig({ roots: roots }).then(function (ok) {
          setBusy(false)
          if (ok) {
            setRootDraft('')
            showToast(t('page.addedCount', { n: roots.length }))
          }
        })
      }
    
      function cacheTab() {
        var stats = cache || { files: 0, bytes: 0, maxBytes: 0 }
        return [
          h('h2', { key: 'h' }, t('v2.cacheTab')),
          h(
            SetRow,
            { key: 'size', label: t('online.cacheSize', { files: stats.files || 0, n: fmtBytes(stats.bytes || 0) }), desc: t('online.cacheList') },
            h(Button, {
              variant: 'ghost',
              icon: 'trash',
              onClick: function () {
                postJson(API + 'online/cache', {})
                  .then(function () {
                    setCache({ files: 0, bytes: 0, maxBytes: stats.maxBytes || 0 })
                    setCacheSongs([])
                    showToast(t('online.cacheCleared'))
                  })
                  .catch(function (error) {
                    showToast(errorText(error))
                  })
              },
              children: t('online.clearCache'),
            }),
          ),
          h(
            'p',
            { key: 'hint', className: 'mp-set-desc' },
            'Cached audio is reused by the stream route; deleting it only costs a refetch.',
          ),
          h(
            'div',
            { key: 'songs', className: 'mp-cache-block' },
            h('div', { className: 'mp-cache-heading' }, t('online.cacheSongs'), h('span', null, String((cacheSongs || []).length))),
            (cacheSongs || []).length === 0
              ? h('div', { className: 'mp-cache-empty' }, t('online.cacheNoSongs'))
              : h(
                  'div',
                  { className: 'mp-cache-list' },
                  cacheSongs.map(function (song) {
                    return h(
                      'div',
                      { key: song.provider + ':' + song.id, className: 'mp-cache-row' },
                      h('span', { className: 'mp-cache-provider' }, providerLogo(song.provider, 18)),
                      h(
                        'div',
                        { className: 'mp-cache-main' },
                        h('div', { className: 'mp-cache-title' }, song.title || song.id),
                        h(
                          'div',
                          { className: 'mp-cache-sub' },
                          [song.artist, song.album].filter(Boolean).join(' · ') || t('page.unknownArtist'),
                        ),
                      ),
                      h('span', { className: 'mp-cache-time' }, fmtTime(song.durationSec)),
                      h('span', { className: 'mp-cache-size' }, fmtBytes(song.size || 0)),
                      song.hasLyric ? h('span', { className: 'mp-cache-tag' }, 'LRC') : null,
                    )
                  }),
                ),
          ),
        ]
      }
    
      function aboutTab() {
        return [
          h('h2', { key: 'h' }, t('v2.about')),
          h(
            'div',
            { key: 'card', className: 'mp-about-card' },
            h('img', { className: 'mp-about-logo', src: BRAND_LOGO, alt: '' }),
            h(
              'div',
              { className: 'mp-about-main' },
              h('div', { className: 'mp-about-name' }, 'dsh-music-panel'),
              h('div', { className: 'mp-about-version' }, t('about.version') + ' ' + APP_VERSION),
              h('div', { className: 'mp-about-tagline' }, t('about.tagline')),
            ),
          ),
          h(
            'div',
            { key: 'meta', className: 'mp-about-rows' },
            h('div', { className: 'mp-about-row' }, h('span', null, t('about.project')), h('strong', null, 'DeepSeek Harness Music Panel')),
            h('div', { className: 'mp-about-row' }, h('span', null, t('about.license')), h('strong', null, 'MIT')),
            h('div', { className: 'mp-about-row' }, h('span', null, t('about.author')), h('strong', null, 'Aliboder')),
            h(
              'div',
              { className: 'mp-about-row' },
              h('span', null, t('about.feedback')),
              h(
                'a',
                { href: 'https://github.com/Aliboder/dsh-music-panel/issues', target: '_blank', rel: 'noreferrer' },
                'GitHub Issues',
              ),
            ),
          ),
          h(
            'div',
            { key: 'links', className: 'mp-about-links' },
            h(
              'a',
              { href: 'https://github.com/Aliboder/dsh-music-panel', target: '_blank', rel: 'noreferrer' },
              t('about.source'),
            ),
            h(
              'a',
              { href: 'https://www.npmjs.com/package/dsh-music-panel', target: '_blank', rel: 'noreferrer' },
              t('about.npm'),
            ),
          ),
          h('p', { key: 'desc', className: 'mp-set-desc' }, t('about.description')),
        ]
      }
    
      var body =
        tab === 'appearance'
          ? appearanceTab()
          : tab === 'lyrics'
            ? lyricsTab()
            : tab === 'playback'
              ? playbackTab()
              : tab === 'online'
                ? onlineTab()
                : tab === 'library'
                  ? libraryTab()
                  : tab === 'cache'
                    ? cacheTab()
                    : aboutTab()
    
      return h(
        KitModal,
        { headless: true, onClose: props.onClose, className: 'mp-kit-sheet' },
        h(
          'div',
          { className: 'mp-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('page.settings') },
          h(
            'div',
            { className: 'mp-sheet-nav' },
            h('div', { className: 'mp-sheet-title' }, t('page.settings')),
            SETTINGS_TABS.map(function (item) {
              return h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  className: cx('mp-sheet-tab', tab === item.key && 'is-on'),
                  onClick: function () {
                    setTab(item.key)
                  },
                },
                t(item.label),
              )
            }),
            h(
              'div',
              { style: { marginTop: 'auto' } },
              h('button', { type: 'button', className: 'mp-sheet-tab', onClick: props.onClose }, t('v2.close')),
            ),
          ),
          h('div', { className: 'mp-sheet-body' }, body),
        ),
      )
    }

    // ── src/ui/07-dialogs.js
    /**
     * dialogs: context menu, login, tag editor, add-to-playlist, confirm and toast.
     */
    
    function ContextMenu(props) {
      var layer = props.layer
      var track = layer.props.track
      var online = typeof track.onlineProvider === 'string' && track.onlineProvider !== ''
      var favorite = libraryStore.get().favorites.indexOf(track.path) >= 0
      var items = []
      var likedPair = useState(false)
      var liked = likedPair[0]
      var setLiked = likedPair[1]
    
      useEffect(
        function () {
          if (!online) return undefined
          var cancelled = false
          getJson(
            API +
              'online/liked?provider=' +
              encodeURIComponent(track.onlineProvider) +
              '&id=' +
              encodeURIComponent(track.onlineId || ''),
          )
            .then(function (body) {
              if (!cancelled) setLiked(body.liked === true)
            })
            .catch(function () {
              // Not signed in / unavailable: keep the neutral state.
            })
          return function () {
            cancelled = true
          }
        },
        [online, track.onlineProvider, track.onlineId],
      )
    
      useEffect(function () {
        if (hostComponent('Menu') !== null) return undefined
        function onDown(event) {
          var node = event.target
          if (node && typeof node.closest === 'function' && node.closest('.mp-ctx')) return
          removeLayer('menu')
        }
        function onScroll() {
          removeLayer('menu')
        }
        document.addEventListener('pointerdown', onDown, true)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        return function () {
          document.removeEventListener('pointerdown', onDown, true)
          window.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', onScroll)
        }
      }, [])
    
      var selection = selectionStore.get()
      var multi =
        selection.active === true &&
        selection.paths.length > 0 &&
        selection.paths.indexOf(track.path) >= 0
      if (multi) {
        var selectedPaths = selection.paths.slice()
        if (online) {
          if (typeof layer.props.playSelected === 'function') {
            items.push({
              key: 'play',
              icon: 'play',
              label: t('page.playSelected'),
              run: function () {
                layer.props.playSelected()
              },
            })
          }
          items.push({
            key: 'select-none',
            icon: 'x',
            label: t('page.selectNone'),
            run: clearSelection,
          })
          items.push({
            key: 'done',
            icon: 'check',
            label: t('page.done'),
            run: function () {
              setSelectionMode(false)
            },
          })
          } else {
        var library = libraryStore.get()
        var favoriteSet = {}
        ;(library.favorites || []).forEach(function (path) {
          favoriteSet[path] = true
        })
        var allFavorite = selectedPaths.every(function (path) {
          return favoriteSet[path] === true
        })
        var selectedTracks = (library.tracks || []).filter(function (item) {
          return selectedPaths.indexOf(item.path) >= 0
        })
        if (Array.isArray(layer.props.visiblePaths) && layer.props.visiblePaths.length > 0) {
          var visiblePaths = layer.props.visiblePaths
          items.push({
            key: 'select-all',
            icon: 'checkCircle',
            label: t('page.selectAll'),
            run: function () {
              selectAllPaths(visiblePaths)
            },
          })
        }
        items.push({
          key: 'select-none',
          icon: 'x',
          label: t('page.selectNone'),
          run: clearSelection,
        })
        items.push({
          key: 'done',
          icon: 'check',
          label: t('page.done'),
          run: function () {
            setSelectionMode(false)
          },
        })
        items.push({ key: 'sep-select', separator: true })
        items.push({
          key: 'play',
          icon: 'play',
          label: t('page.playSelected'),
          run: function () {
            if (selectedTracks.length > 0) player.playList(selectedTracks, 0)
          },
        })
        items.push({
          key: 'fav',
          icon: 'heart',
          label: allFavorite ? t('page.unfavorite') : t('page.favoriteSelected'),
          run: function () {
            var targets = allFavorite
              ? selectedPaths.slice()
              : selectedPaths.filter(function (path) {
                  return favoriteSet[path] !== true
                })
            void (async function () {
              try {
                for (var index = 0; index < targets.length; index += 1) await toggleFavorite(targets[index])
                showToast(allFavorite ? t('page.unfavorite') : t('page.favoriteSelected'))
              } catch (error) {
                showToast(errorText(error))
              }
            })()
          },
        })
        items.push({
          key: 'add',
          icon: 'plus',
          label: t('page.addToPlaylist'),
          run: function () {
            pushLayer('addTo', { paths: selectedPaths.slice() })
          },
        })
        items.push({
          key: 'batch',
          icon: 'edit',
          label: t('page.batchEdit'),
          run: function () {
            pushLayer('batchEdit', { paths: selectedPaths.slice() })
          },
        })
        items.push({ key: 'sep-multi', separator: true })
        items.push({
          key: 'delete',
          icon: 'trash',
          label: t('page.delete'),
          danger: true,
          run: function () {
            var paths = selectedPaths.slice()
            pushLayer('confirm', {
              title: t('page.delete'),
              text: t('v2.removeSelectedConfirm', { n: paths.length }),
              onConfirm: function () {
                removeTracks(paths)
                  .then(function (body) {
                    showToast(t('v2.removed', { n: (body.moved || []).length }))
                  })
                  .catch(function (error) {
                    showToast(errorText(error))
                  })
              },
            })
          },
        })
        }
      } else {
      items.push({
        key: 'play',
        icon: 'play',
        label: t('page.play'),
        run: function () {
          if (layer.props.onPlay) layer.props.onPlay(track)
          else player.playList([track], 0)
        },
      })
      items.push({
        key: 'next',
        icon: 'list',
        label: t('page.next'),
        run: function () {
          player.enqueue(track)
          showToast(t('page.addedToPlaylist'))
        },
      })
      if (online) {
        items.push({
          key: 'fav',
          icon: liked ? 'heartFill' : 'heart',
          label: liked ? t('page.unfavorite') : t('page.favorite'),
          run: function () {
            var next = !liked
            postJson(API + 'online/like', { provider: track.onlineProvider, song: track, on: next })
              .then(function () {
                setLiked(next)
                refreshLikedPlaylist(next ? 1 : -1)
                showToast(next ? t('page.favorite') : t('page.unfavorite'))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
        items.push({
          key: 'add-cloud',
          icon: 'plus',
          label: t('online.addToCloudPlaylist'),
          run: function () {
            pushLayer('onlineAddTo', { track: track })
          },
        })
      } else {
        items.push({
          key: 'fav',
          icon: favorite ? 'heartFill' : 'heart',
          label: favorite ? t('page.unfavorite') : t('page.favorite'),
          run: function () {
            void toggleFavorite(track.path)
          },
        })
        items.push({
          key: 'add',
          icon: 'plus',
          label: t('page.addToPlaylist'),
          run: function () {
            pushLayer('addTo', { track: track })
          },
        })
      }
      if (layer.props.onRemove) {
        items.push({
          key: 'remove',
          icon: 'trash',
          label: online ? t('online.removeFromHistory') : t('page.removeTrack'),
          run: layer.props.onRemove,
        })
      }
      items.push({ key: 'sep1', separator: true })
      if (!online) {
        items.push({
          key: 'tags',
          icon: 'edit',
          label: t('page.editMeta'),
          run: function () {
            pushLayer('tag', { path: track.path })
          },
        })
        items.push({
          key: 'reveal',
          icon: 'folder',
          label: t('page.reveal'),
          run: function () {
            postJson(API + 'reveal', { path: track.path })
              .then(function () {
                showToast(t('page.revealed'))
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
      }
      if (!online) {
        items.push({
          key: 'copy',
          icon: 'copy',
          label: t('page.copyPath'),
          run: function () {
            var path = track.path
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                void navigator.clipboard.writeText(path)
              }
            } catch (error) {
              // Clipboard can be blocked; the toast still confirms the intent.
            }
            showToast(t('page.copied'))
          },
        })
      }
    
        }
    var width = 190
      var height = items.length * 32 + 8
      var left = Math.min(layer.props.x || 0, Math.max(8, window.innerWidth - width - 12))
      var top = Math.min(layer.props.y || 0, Math.max(8, window.innerHeight - height - 12))
    
      var HostMenu = hostComponent('Menu')
      if (HostMenu !== null) {
        var hostItems = items.map(function (item) {
          if (item.separator) return { type: 'separator', id: item.key }
          return { id: item.key, label: item.label, icon: icon(item.icon, 14) }
        })
        return h(HostMenu, {
          open: true,
          anchor: null,
          items: hostItems,
          contextual: true,
          portal: true,
          side: 'bottom',
          align: 'start',
          getAnchorRect: function () {
            return { left: left, top: top, right: left, bottom: top, width: 0, height: 0, x: left, y: top }
          },
          onSelect: function (id) {
            popLayer()
            var chosen = null
            items.forEach(function (item) {
              if (chosen === null && item.key === id) chosen = item
            })
            if (chosen !== null && typeof chosen.run === 'function') chosen.run()
          },
          onClose: function () {
            popLayer()
          },
        })
      }
    
      return h(
        'div',
        { className: 'mp-ctx', style: { left: left + 'px', top: top + 'px' }, role: 'menu' },
        items.map(function (item) {
          if (item.separator) return h('hr', { key: item.key })
          return h(
            'button',
            {
              key: item.key,
              type: 'button',
              role: 'menuitem',
              onClick: function () {
                popLayer()
                item.run()
              },
            },
            icon(item.icon, 14),
            item.label,
          )
        }),
      )
    }
    
    function AddToPlaylistDialog(props) {
      var library = useStore(libraryStore)
      var layerProps = props.layer.props || {}
      var paths = Array.isArray(layerProps.paths)
        ? layerProps.paths.slice()
        : layerProps.track
          ? [layerProps.track.path]
          : []
      var playlists = library.playlists
      var pair = useState('')
      var name = pair[0]
      var setName = pair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
    
      function addTo(id) {
        if (busy || paths.length === 0) return
        setBusy(true)
        addToPlaylist(id, paths).then(function (ok) {
          setBusy(false)
          if (ok) {
            popLayer()
            showToast(t('page.addedToPlaylist'))
          }
        })
      }
    
      function createAndAdd() {
        var value = name.trim()
        if (value === '' || busy) return
        setBusy(true)
        createPlaylist(value).then(function (created) {
          if (created && created.id) return addToPlaylist(created.id, paths)
          return false
        }).then(function (ok) {
          setBusy(false)
          if (ok !== false) {
            popLayer()
            showToast(t('page.addedToPlaylist'))
          }
        })
      }
    
      return h(
        KitModal,
        {
          title: t('page.addToPlaylist'),
          small: true,
          onClose: popLayer,
        },
        playlists.length === 0
          ? h('p', { className: 'mp-set-desc' }, t('v2.noPlaylists'))
          : playlists.map(function (playlist) {
              return h(
                'button',
                {
                  key: playlist.id,
                  type: 'button',
                  className: 'mp-srow',
                  onClick: function () {
                    addTo(playlist.id)
                  },
                },
                h('div', { className: 'mp-srow-cover' }, icon('list', 16)),
                h(
                  'div',
                  { className: 'mp-srow-main' },
                  h('div', { className: 'mp-srow-title' }, playlist.name),
                  h('div', { className: 'mp-srow-sub' }, (playlist.trackPaths || []).length + ''),
                ),
                icon('chevronRight', 14),
              )
            }),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', paddingTop: '6px' } },
          h('input', {
            type: 'text',
            value: name,
            placeholder: t('v2.newPlaylist'),
            className: 'mp-kit-input',
            onChange: function (event) {
              setName(event.target.value)
            },
          }),
          h(Button, { variant: 'primary', icon: 'plus', disabled: busy, onClick: createAndAdd }, t('page.create')),
        ),
      )
    }
    
    function LoginDialog(props) {
      var provider = props.layer.props.provider || 'netease'
      var mode = props.layer.props.mode || 'qq'
      var qrPair = useState(null)
      var qr = qrPair[0]
      var setQr = qrPair[1]
      var statusPair = useState('waiting')
      var status = statusPair[0]
      var setStatus = statusPair[1]
      var errorPair = useState('')
      var error = errorPair[0]
      var setError = errorPair[1]
    
      useEffect(
        function () {
          var cancelled = false
          var timer = null
          startProviderLogin(provider, mode)
            .then(function (body) {
              if (cancelled) return
              setQr(body)
              timer = setInterval(function () {
                checkProviderLogin(provider, body.key, body.mode || mode)
                  .then(function (next) {
                    if (cancelled) return
                    setStatus(next)
                    if (next === 'success') {
                      clearInterval(timer)
                      timer = null
                      void loadProviders()
                      showToast(t('online.loginSuccess'))
                      popLayer()
                    }
                    if (next === 'expired' || next === 'failed') {
                      clearInterval(timer)
                      timer = null
                    }
                  })
                  .catch(function (pollError) {
                    if (cancelled) return
                    setError(errorText(pollError))
                  })
              }, 2000)
            })
            .catch(function (startError) {
              if (cancelled) return
              setError(errorText(startError))
            })
          return function () {
            cancelled = true
            if (timer !== null) clearInterval(timer)
          }
        },
        [provider, mode],
      )
    
      var providerLabel =
        provider === 'netease'
          ? t('online.providerNetease')
          : provider === 'qq'
            ? t('online.providerQq')
            : t('online.providerKugou')
    
      return h(
        KitModal,
        {
          title: t('online.loginTitle', { provider: providerLabel }),
          small: true,
          onClose: popLayer,
        },
        h(
          'div',
          { className: 'mp-kit-center' },
          h(
            'div',
            { className: 'mp-qr' },
            qr && qr.imageDataUrl
              ? h('img', { src: qr.imageDataUrl, alt: '' })
              : h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary,#8a8a93)' } }, '…'),
          ),
          h('div', { className: 'mp-qr-hint' }, t('online.loginHint')),
          h(
            'div',
            { className: 'mp-qr-hint' },
            error !== ''
              ? error
              : status === 'scanned'
                ? t('online.statusscanned')
                : status === 'success'
                  ? t('online.statussuccess')
                  : status === 'expired'
                    ? t('online.statusexpired')
                    : t('online.statuswaiting'),
          ),
        ),
      )
    }
    
    var TAG_FIELDS = [
      ['title', 'page.metaTitle'],
      ['artist', 'page.artist'],
      ['album', 'page.album'],
      ['albumArtist', 'page.albumArtist'],
      ['year', 'page.year'],
      ['genre', 'page.genre'],
      ['track', 'page.trackNo'],
      ['disc', 'page.discNo'],
      ['composer', 'page.composer'],
      ['lyricist', 'page.lyricist'],
      ['comment', 'page.comment'],
    ]
    
    var TAG_MATCH_FIELDS = [
      ['title', 'page.metaTitle'],
      ['artist', 'page.artist'],
      ['album', 'page.album'],
      ['year', 'page.year'],
      ['genre', 'page.genre'],
      ['track', 'page.trackNo'],
      ['disc', 'page.discNo'],
    ]
    
    function tagSourceLabel(source) {
      if (source === 'netease') return t('page.sourceNetease')
      if (source === 'qq') return t('page.sourceQq')
      if (source === 'itunes') return t('page.sourceItunes')
      if (source === 'musicbrainz') return t('page.sourceMusicbrainz')
      return String(source || '')
    }
    
    function TagDialog(props) {
      var path = props.layer.props.path
      var tagsPair = useState(null)
      var tags = tagsPair[0]
      var setTags = tagsPair[1]
      var errorPair = useState('')
      var error = errorPair[0]
      var setError = errorPair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var formPair = useState({})
      var form = formPair[0]
      var setForm = formPair[1]
      var coverPair = useState(null)
      var coverPreview = coverPair[0]
      var setCoverPreview = coverPair[1]
      var matchPair = useState(false)
      var matchOpen = matchPair[0]
      var setMatchOpen = matchPair[1]
      var matchPhasePair = useState('idle')
      var matchPhase = matchPhasePair[0]
      var setMatchPhase = matchPhasePair[1]
      var matchListPair = useState([])
      var matchResults = matchListPair[0]
      var setMatchResults = matchListPair[1]
    
      useEffect(
        function () {
          var cancelled = false
          getJson(API + 'tags?path=' + encodeURIComponent(path))
            .then(function (body) {
              if (cancelled) return
              var loaded = body.tags || {}
              setTags(loaded)
              var next = {}
              TAG_FIELDS.forEach(function (entry) {
                var value = loaded[entry[0]]
                next[entry[0]] = value === undefined || value === null ? '' : String(value)
              })
              next.lyrics = typeof loaded.lyrics === 'string' ? loaded.lyrics : ''
              setForm(next)
            })
            .catch(function (loadError) {
              if (!cancelled) setError(errorText(loadError))
            })
          return function () {
            cancelled = true
          }
        },
        [path],
      )
    
      function setField(key, value) {
        setForm(function (previous) {
          var next = Object.assign({}, previous)
          next[key] = value
          return next
        })
      }
    
      function field(key) {
        return h(
          'div',
          { className: 'mp-field' },
          h('label', null, t(TAG_FIELDS.find(function (entry) { return entry[0] === key })[1])),
          h('input', {
            type: 'text',
            value: form[key] || '',
            onChange: function (event) {
              setField(key, event.target.value)
            },
          }),
        )
      }
    
      function runMatch() {
        if (matchPhase === 'loading') return
        setMatchOpen(true)
        setMatchPhase('loading')
        setMatchResults([])
        setError('')
        postJson(API + 'online-search', {
          title: form.title || '',
          artist: form.artist || '',
          album: form.album || '',
        })
          .then(function (body) {
            setMatchResults(Array.isArray(body.results) ? body.results : [])
            setMatchPhase('ready')
          })
          .catch(function (matchError) {
            setError(errorText(matchError))
            setMatchPhase('error')
          })
      }
    
      function pickMatch(item) {
        var next = Object.assign({}, form)
        ;['title', 'artist', 'album', 'year', 'track', 'disc', 'genre'].forEach(function (key) {
          if (item[key] !== undefined && item[key] !== null && String(item[key]) !== '') {
            next[key] = String(item[key])
          }
        })
        setForm(next)
        if (item.coverUrl) setCoverPreview(item.coverUrl)
        setMatchOpen(false)
        setMatchPhase('idle')
      }
    
      function applyMatchField(item, key) {
        if (key === 'cover') {
          if (item.coverUrl) setCoverPreview(item.coverUrl)
          return
        }
        if (item[key] === undefined || item[key] === null || String(item[key]) === '') return
        setField(key, String(item[key]))
      }
    
      function openOnlineLyric() {
        pushLayer('onlineLyric', {
          track: { path: path, title: form.title || '', artist: form.artist || '' },
          onApply: function (lrc) {
            setField('lyrics', lrc)
          },
        })
      }
    
      function save() {
        if (busy) return
        setBusy(true)
        setError('')
        var current = player.getSnapshot()
        var playingThis =
          current.index >= 0 && current.queue[current.index] && current.queue[current.index].path === path
        if (playingThis) player.suspend()
        function restorePlayback() {
          if (playingThis && !player.getSnapshot().playing) player.toggle()
        }
        sendJson('PUT', API + 'tags', {
          path: path,
          tags: form,
          coverUrl: coverPreview || '',
        })
          .then(function () {
            setBusy(false)
            restorePlayback()
            popLayer()
            showToast(t('page.metaSaved'))
            void loadLibrary(true)
          })
          .catch(function (saveError) {
            setBusy(false)
            restorePlayback()
            setError(errorText(saveError))
          })
      }
    
      var coverSrc =
        coverPreview !== null && coverPreview !== undefined
          ? API + 'online/cover?url=' + encodeURIComponent(coverPreview)
          : API + 'cover?path=' + encodeURIComponent(path)
    
      return h(
        KitModal,
        {
          title: t('page.editMeta'),
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'save',
                variant: 'primary',
                disabled: busy,
                onClick: save,
              },
              busy ? t('page.saving') : t('page.save'),
            ),
          ],
        },
    h(
            'div',
            { className: 'mp-kit-body' },
            error !== '' ? h('div', { className: 'mp-qr-hint' }, error) : null,
            h(
              'div',
              { className: 'mp-tag-cover-row' },
              h(Cover, { src: coverSrc, className: 'mp-tag-cover', iconSize: 44 }),
              h(
                'div',
                { className: 'mp-tag-cover-actions' },
                h(Button, { icon: 'search', onClick: runMatch, disabled: matchPhase === 'loading' }, t('v2.match')),
                coverPreview !== null
                  ? h(Button, { variant: 'ghost', icon: 'refresh', onClick: function () { setCoverPreview(null) } }, t('page.resetCover'))
                  : null,
                h('div', { className: 'mp-set-desc' }, t('page.metaHint')),
              ),
            ),
            matchOpen
              ? h(
                  'div',
                  { className: 'mp-match' },
                  h(
                    'div',
                    { className: 'mp-match-head' },
                    h('span', null, t('page.onlineResults')),
                    h('div', { className: 'mp-spacer', style: { marginLeft: 'auto' } }),
                    h(IconButton, {
                      icon: 'x',
                      size: 14,
                      title: t('v2.close'),
                      onClick: function () {
                        setMatchOpen(false)
                      },
                    }),
                  ),
                  matchPhase === 'loading'
                    ? h('div', { className: 'mp-empty', style: { padding: '18px' } }, h(Spinner), t('page.onlineLoading'))
                    : matchResults.length === 0
                      ? h('div', { className: 'mp-empty', style: { padding: '18px' } }, t('page.onlineEmpty'))
                      : matchResults.map(function (item, index) {
                          var chipFields = TAG_MATCH_FIELDS.filter(function (entry) {
                            return item[entry[0]] !== undefined && item[entry[0]] !== null && String(item[entry[0]]) !== ''
                          })
                          if (item.coverUrl) chipFields.push(['cover', 'v2.cover'])
                          return h(
                            'div',
                            { key: String(index), className: 'mp-match-row' },
                            h(
                              'button',
                              {
                                type: 'button',
                                className: 'mp-match-item',
                                onClick: function () {
                                  pickMatch(item)
                                },
                              },
                              item.coverUrl
                                ? h(Cover, {
                                    src: API + 'online/cover?url=' + encodeURIComponent(item.coverUrl),
                                    className: 'mp-match-cover',
                                    iconSize: 16,
                                  })
                                : h('div', { className: 'mp-match-cover' }, icon('note', 16)),
                              h(
                                'div',
                                { className: 'mp-match-main' },
                                h('div', { className: 'mp-srow-title' }, item.title || ''),
                                h(
                                  'div',
                                  { className: 'mp-srow-sub' },
                                  [item.artist, item.album, item.year, tagSourceLabel(item.source)]
                                    .filter(function (part) {
                                      return part !== '' && part !== undefined && part !== null
                                    })
                                    .join(' · '),
                                ),
                              ),
                            ),
                            chipFields.length > 0
                              ? h(
                                  'div',
                                  { className: 'mp-match-fields' },
                                  chipFields.map(function (entry) {
                                    return h(
                                      'button',
                                      {
                                        key: entry[0],
                                        type: 'button',
                                        className: 'mp-match-chip',
                                        onClick: function () {
                                          applyMatchField(item, entry[0])
                                        },
                                      },
                                      t(entry[1]),
                                    )
                                  }),
                                )
                              : null,
                          )
                        }),
                  h('div', { className: 'mp-np-setting-hint' }, t('v2.matchHint')),
                  h('div', { className: 'mp-np-setting-hint' }, t('page.onlineHint')),
    
                )
              : null,
            h(
              'div',
              { className: 'mp-d-grid' },
              field('title'),
              field('artist'),
              field('album'),
              field('albumArtist'),
            ),
            h(
              'div',
              { className: 'mp-d-grid' },
              field('year'),
              field('genre'),
              field('track'),
              field('disc'),
            ),
            h(
              'div',
              { className: 'mp-d-grid' },
              field('composer'),
              field('lyricist'),
            ),
            h(
              'div',
              { className: 'mp-field' },
              h('label', null, t('page.comment')),
              h('input', {
                type: 'text',
                value: form.comment || '',
                onChange: function (event) {
                  setField('comment', event.target.value)
                },
              }),
            ),
            h(
              'div',
              { className: 'mp-field' },
              h(
                'div',
                { className: 'mp-tag-lyrics-head' },
                h('label', null, t('page.lyrics')),
                h(Button, { variant: 'ghost', icon: 'search', onClick: openOnlineLyric }, t('page.onlineLyrics')),
              ),
              h('textarea', {
                rows: 6,
                value: form.lyrics || '',
                onChange: function (event) {
                  setField('lyrics', event.target.value)
                },
              }),
            ),
            h('div', { className: 'mp-set-desc' }, (tags && tags.format) || ''),
          ),
          
      )
    }
    
    function ConfirmDialog(props) {
      var layer = props.layer
      return h(
        KitModal,
        {
          title: layer.props.title || '',
          small: true,
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'ok',
                variant: 'primary',
                onClick: function () {
                  var action = layer.props.onConfirm
                  popLayer()
                  if (typeof action === 'function') action()
                },
              },
              t('page.done'),
            ),
          ],
        },
        h('p', { className: 'mp-kit-text' }, layer.props.text || ''),
      )
    }
    
    function Toast(props) {
      var toast = useStore(toastStore)
      var HostToast = hostComponent('Toast')
      if (HostToast !== null && toast.text !== '') {
        return h(HostToast, {
          key: toast.seq,
          text: toast.text,
          holdMs: 1800,
          onDone: function () {
            if (toastStore.get().seq === toast.seq) toastStore.set({ text: '', seq: toast.seq })
          },
        })
      }
      return h(
        'div',
        { className: cx('mp-toast', toast.text !== '' && 'is-on'), role: 'status' },
        toast.text,
      )
    }

    // ── src/ui/08-local.js
    /**
     * local views: songs, albums, artists, folders, favorites, playlists, stats.
     *
     * One header + one toolbar + one scrolling body per view; the body is either
     * the shared virtual list or a plain scroll box for grids/statistics.
     */
    
    function filterLabelOf(ui) {
      if (!ui.filter) return ''
      if (ui.filter.kind === 'album') return t('v2.albumFilter', { name: ui.filter.value })
      if (ui.filter.kind === 'artist') return t('v2.artistFilter', { name: ui.filter.value })
      return t('v2.folderFilter', { name: ui.filter.value })
    }
    
    function applyUiFilter(list, filter) {
      if (!filter) return list
      return list.filter(function (track) {
        if (filter.kind === 'album') return (track.album || t('page.unknownAlbum')) === filter.value
        if (filter.kind === 'artist') return (track.artist || t('page.unknownArtist')) === filter.value
        if (filter.kind === 'folder') return trackDirOf(track) === filter.value || track.folder === filter.value
        return true
      })
    }
    
    function groupTracks(list, keyOf) {
      var map = {}
      var order = []
      list.forEach(function (track) {
        var key = keyOf(track)
        if (!map[key]) {
          map[key] = { key: key, tracks: [] }
          order.push(key)
        }
        map[key].tracks.push(track)
      })
      return order.map(function (key) {
        return map[key]
      })
    }
    
    function playListFrom(list) {
      if (!list || list.length === 0) return
      player.playList(list, 0)
    }
    
    function shuffleListFrom(list) {
      if (!list || list.length === 0) return
      player.setOrder('random')
      player.playList(list, Math.floor(Math.random() * list.length))
    }
    
    function sortSelect(prefs) {
      return h(
        'select',
        {
          className: 'mp-chip',
          value: prefs.sortBy,
          title: t('page.sort'),
          'aria-label': t('page.sort'),
          onChange: function (event) {
            setPrefs({ sortBy: event.target.value })
          },
        },
        h('option', { value: 'title' }, t('v2.sortTitle')),
        h('option', { value: 'artist' }, t('v2.sortArtist')),
        h('option', { value: 'duration' }, t('v2.sortDuration')),
        h('option', { value: 'added' }, t('v2.sortAdded')),
        h('option', { value: 'recent' }, t('v2.sortRecent')),
      )
    }
    
    function LocalContent(props) {
      var ui = props.ui
      var library = props.library
      var prefs = props.prefs
      var favorites = props.favoriteSet
      var allTracks = library.tracks || []
      var visible = []
      var title = ''
      var count = 0
      var actions = null
      var toolbarExtras = []
      var body = null
      var empty = null
      var selectionList = []
      var playAll = null
      var selection = useStore(selectionStore)
      var selecting = selection.active === true
      var selectedSet = useMemo(
        function () {
          var set = {}
          selection.paths.forEach(function (path) {
            set[path] = true
          })
          return set
        },
        [selection.paths],
      )
      var duplicateGroups = useMemo(
        function () {
          if (ui.source !== 'local' || ui.nav !== 'songs' || ui.filter || ui.query !== '') return []
          return duplicateGroupsOf(library.tracks || [])
        },
        [ui.source, ui.nav, ui.filter, ui.query, library.tracks],
      )
    
      function selectTrack(track, additive) {
        selectTrackIn(selectionList, track, additive)
      }
    
      function listFor(view) {
        var base = allTracks
        if (view === 'favorites') {
          base = allTracks.filter(function (track) {
            return favorites[track.path] === true
          })
        } else if (view === 'playlist') {
          base = playlistTracks(playlistById(ui.playlistId))
        }
        base = applyUiFilter(base, ui.filter)
        return sortTracks(filterTracks(base, ui.query), prefs.sortBy, prefs.sortDir)
      }
    
      function trackBody(list, resetKey) {
        return h(TrackListBody, {
          items: list,
          resetKey: resetKey,
          focusPath: props.locatePath || '',
          currentPath: props.currentPath,
          playing: props.playing,
          favoriteSet: favorites,
          selectionMode: selecting,
          selectedSet: selectedSet,
          onToggleSelect: function (path) {
            toggleSelected(path)
          },
          onSelect: selectTrack,
          onPlay: function (track) {
            var index = list.indexOf(track)
            player.playList(list, index < 0 ? 0 : index)
          },
          onMenu: function (track, event) {
            props.onMenu(track, event, {
              visiblePaths: list.map(function (item) {
                return item.path
              }),
            })
          },
          onToggleFavorite: props.onToggleFavorite,
          empty: empty,
        })
      }
    
      if (ui.nav === 'songs' || ui.nav === 'favorites' || ui.nav === 'playlist') {
        visible = listFor(ui.nav)
        selectionList = visible
        playAll = visible.length
          ? function () {
              playListFrom(visible)
            }
          : null
        title = ui.filter
          ? ui.filter.value
          : ui.nav === 'favorites'
            ? t('v2.favorites')
            : ui.nav === 'playlist'
              ? (playlistById(ui.playlistId) || {}).name || t('v2.playlists')
              : t('v2.allSongs')
        count = visible.length
        toolbarExtras = []
        if (ui.filter) {
          toolbarExtras.push(
            h(
              'button',
              {
                key: 'clear',
                type: 'button',
                className: 'mp-chip',
                onClick: function () {
                  setUi({ filter: null })
                },
              },
              icon('x', 12),
              t('v2.clearFilter'),
            ),
          )
        }
        if (ui.query !== '') {
          toolbarExtras.push(
            h(
              'button',
              {
                key: 'clearq',
                type: 'button',
                className: 'mp-chip',
                onClick: function () {
                  setUi({ query: '' })
                },
              },
              icon('x', 12),
              t('page.clearFilter') || t('v2.clearFilter'),
            ),
          )
        }
        if (duplicateGroups.length > 0 && !selecting) {
          toolbarExtras.push(
            h(
              'button',
              {
                key: 'dupes',
                type: 'button',
                className: 'mp-chip',
                onClick: function () {
                  pushLayer('duplicates', { groups: duplicateGroups })
                },
              },
              icon('info', 13),
              t('page.duplicates', { n: duplicateGroups.length }),
            ),
          )
        }
        empty =
          ui.nav === 'favorites'
            ? h(Empty, { title: t('v2.noFavorites'), hint: t('v2.noFavoritesHint'), icon: 'heart' })
            : ui.nav === 'playlist'
              ? h(Empty, { title: t('v2.noPlaylistTracks'), hint: t('page.playlistNoTracksHint'), icon: 'list' })
              : ui.query !== '' || ui.filter
                ? h(Empty, { title: t('page.noResults'), hint: '', icon: 'search' })
                : h(Empty, { title: t('v2.noTracks'), hint: t('v2.noTracksHint'), icon: 'note' })
        body = trackBody(visible, [ui.source, ui.nav, ui.playlistId, ui.filter ? ui.filter.kind + ':' + ui.filter.value : '', ui.query].join('|'))
      } else if (ui.nav === 'albums') {
        var albums = groupTracks(filterTracks(applyUiFilter(allTracks, ui.filter), ui.query), function (track) {
          return track.album || t('page.unknownAlbum')
        })
        count = albums.length
        title = t('v2.albums')
        body = h(
          ScrollBox,
          { resetKey: 'albums:' + ui.query },
          albums.map(function (group) {
            var coverTrack = group.tracks.find(function (track) {
              return track.hasCover === true
            })
            return h(
              'button',
              {
                key: group.key,
                type: 'button',
                className: 'mp-srow',
                onClick: function () {
                  setUi({ nav: 'songs', filter: { kind: 'album', value: group.key } })
                },
              },
              h(
                'div',
                { className: 'mp-srow-cover' },
                h(Cover, { src: coverTrack ? trackCoverSrc(coverTrack) : '', iconSize: 18 }),
              ),
              h(
                'div',
                { className: 'mp-srow-main' },
                h('div', { className: 'mp-srow-title' }, group.key),
                h('div', { className: 'mp-srow-sub' }, (group.tracks[0].artist || '') + ' · ' + group.tracks.length),
              ),
              h('div', { className: 'mp-srow-meta' }, String(group.tracks.length)),
              icon('chevronRight', 14),
            )
          }),
        )
        empty = h(Empty, { title: t('page.noResults'), icon: 'disc' })
      } else if (ui.nav === 'artists' || ui.nav === 'folders') {
        var isArtists = ui.nav === 'artists'
        var groups = groupTracks(filterTracks(allTracks, ui.query), function (track) {
          return isArtists ? track.artist || t('page.unknownArtist') : trackDirOf(track)
        }).sort(function (left, right) {
          return String(left.key).localeCompare(String(right.key), 'zh')
        })
        count = groups.length
        title = isArtists ? t('v2.artists') : t('v2.folders')
        if (!isArtists) {
          toolbarExtras = [
            h(
              Button,
              {
                key: 'add-folder',
                icon: 'plus',
                onClick: function () {
                  pushLayer('folderPicker')
                },
              },
              t('v2.folderAdd'),
            ),
          ]
        }
        body = h(
          ScrollBox,
          { resetKey: ui.nav + ':' + ui.query },
          groups.map(function (group) {
            var coverTrack = group.tracks.find(function (track) {
              return track.hasCover === true
            })
            return h(
              'button',
              {
                key: group.key,
                type: 'button',
                className: 'mp-srow',
                onClick: function () {
                  setUi({
                    nav: 'songs',
                    filter: isArtists ? { kind: 'artist', value: group.key } : { kind: 'folder', value: group.key },
                  })
                },
              },
              isArtists
                ? h(
                    'div',
                    { className: 'mp-srow-cover is-round' },
                    h(Cover, { src: coverTrack ? trackCoverSrc(coverTrack) : '', iconSize: 18 }),
                  )
                : h('div', { className: 'mp-srow-cover' }, icon('folder', 18)),
              h(
                'div',
                { className: 'mp-srow-main' },
                h('div', { className: 'mp-srow-title' }, isArtists ? group.key : folderNameOf(group.key)),
                isArtists
                  ? h('div', { className: 'mp-srow-sub' }, group.tracks.length + ' · ' + t('v2.songs'))
                  : h('div', { className: 'mp-srow-sub' }, group.key),
              ),
              h('div', { className: 'mp-srow-meta' }, String(group.tracks.length)),
              icon('chevronRight', 14),
            )
          }),
        )
        empty = h(Empty, { title: t('page.noResults'), icon: isArtists ? 'user' : 'folder' })
      } else if (ui.nav === 'playlists') {
        var playlists = library.playlists || []
        count = playlists.length
        title = t('v2.playlists')
        actions = [
          h(
            Button,
            {
              key: 'new',
              variant: 'primary',
              icon: 'plus',
              onClick: function () {
                pushLayer('newPlaylist')
              },
            },
            t('v2.newPlaylist'),
          ),
        ]
        body = h(
          ScrollBox,
          { resetKey: 'playlists' },
          playlists.length === 0
            ? h(Empty, { title: t('v2.noPlaylists'), hint: t('page.playlistEmptyHint'), icon: 'list' })
            : playlists.map(function (playlist) {
                var coverTrack = (playlistTracks(playlist)[0] || null)
                return h(
                  'div',
                  {
                    key: playlist.id,
                    role: 'button',
                    tabIndex: 0,
                    className: 'mp-srow',
                    onClick: function () {
                      openLocalPlaylist(playlist.id)
                    },
                    onKeyDown: function (event) {
                      if (event.key === 'Enter') openLocalPlaylist(playlist.id)
                    },
                  },
                  h(
                    'div',
                    { className: 'mp-srow-cover' },
                    coverTrack ? h(Cover, { src: trackCoverSrc(coverTrack), iconSize: 18 }) : icon('list', 18),
                  ),
                  h(
                    'div',
                    { className: 'mp-srow-main' },
                    h('div', { className: 'mp-srow-title' }, playlist.name),
                    h('div', { className: 'mp-srow-sub' }, (playlist.trackPaths || []).length + ' · ' + t('v2.songs')),
                  ),
                  h(
                    'span',
                    { className: 'mp-srow-meta' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mp-iconbtn',
                        title: t('page.delete'),
                        onClick: function (event) {
                          event.stopPropagation()
                          pushLayer('confirm', {
                            title: t('page.delete'),
                            text: t('page.deleteConfirm', { name: playlist.name }),
                            onConfirm: function () {
                              void removePlaylist(playlist.id)
                            },
                          })
                        },
                      },
                      icon('trash', 14),
                    ),
                  ),
                  icon('chevronRight', 14),
                )
              }),
        )
      } else if (ui.nav === 'stats') {
        title = t('v2.stats')
        count = 0
        var stats = library.stats || {}
        var entries = Object.keys(stats)
          .map(function (path) {
            var track = trackByPath(path)
            if (!track) return null
            var item = stats[path] || {}
            return { track: track, plays: item.plays || 0, seconds: item.playSeconds || 0 }
          })
          .filter(Boolean)
          .sort(function (left, right) {
            return right.seconds - left.seconds
          })
        var totalSeconds = entries.reduce(function (sum, entry) {
          return sum + entry.seconds
        }, 0)
        var totalPlays = entries.reduce(function (sum, entry) {
          return sum + entry.plays
        }, 0)
        var topSeconds = entries.length > 0 ? entries[0].seconds : 1
        toolbarExtras = [
          ['all', 'v2.rangeAll'],
          ['week', 'v2.rangeWeek'],
          ['month', 'v2.rangeMonth'],
        ].map(function (item) {
          return h(
            'button',
            {
              key: item[0],
              type: 'button',
              className: cx('mp-chip', library.statsRange === item[0] && 'is-on'),
              onClick: function () {
                void loadStats(item[0])
              },
            },
            t(item[1]),
          )
        })
        body = h(
          ScrollBox,
          { resetKey: 'stats:' + library.statsRange },
          h(
            'div',
            { className: 'mp-stat-cards' },
            h(
              'div',
              { className: 'mp-stat-card' },
              h('div', { className: 'mp-stat-k' }, t('v2.listenTime')),
              h('div', { className: 'mp-stat-v' }, Math.floor(totalSeconds / 3600) + ' h ' + Math.floor((totalSeconds % 3600) / 60) + ' m'),
            ),
            h(
              'div',
              { className: 'mp-stat-card' },
              h('div', { className: 'mp-stat-k' }, t('v2.totalPlays')),
              h('div', { className: 'mp-stat-v' }, String(totalPlays)),
            ),
            h(
              'div',
              { className: 'mp-stat-card' },
              h('div', { className: 'mp-stat-k' }, t('v2.trackedTracks')),
              h('div', { className: 'mp-stat-v' }, String(entries.length)),
            ),
          ),
          h(
            'div',
            { className: 'mp-rank' },
            entries.slice(0, 12).map(function (entry, index) {
              return h(
                'div',
                {
                  key: entry.track.path,
                  className: 'mp-rank-row',
                  onClick: function () {
                    player.playList(
                      entries.map(function (item) {
                        return item.track
                      }),
                      index,
                    )
                  },
                },
                h('div', { className: 'mp-rank-n' }, String(index + 1)),
                h('div', { className: 'mp-rank-c' }, h(Cover, { src: trackCoverSrc(entry.track), iconSize: 12 })),
                h(
                  'div',
                  { className: 'mp-rank-m' },
                  h('div', { className: 'mp-row-title' }, trackTitleOf(entry.track)),
                  h('div', { className: 'mp-row-sub' }, trackArtistOf(entry.track)),
                ),
                h(
                  'div',
                  { className: 'mp-rank-bar' },
                  h('i', { style: { width: Math.round((entry.seconds / (topSeconds || 1)) * 100) + '%' } }),
                ),
                h('div', { className: 'mp-row-time' }, entry.plays + ' · ' + Math.floor(entry.seconds / 60) + 'm'),
              )
            }),
          ),
        )
      } else {
        title = t('v2.allSongs')
        body = h(Empty, { title: t('page.noResults'), icon: 'note' })
      }
    
      return [
        h(ContentHeader, {
          key: 'head',
          title: title,
          count: count,
          onAll: function () {
            selectAllIn(selectionList)
          },
          onNone: function () {
            setSelectionMode(false)
          },
          onRange: beginRangePick,
          onInvert: function () {
            invertSelectionIn(selectionList)
          },
          selecting: selecting,
          selectedCount: selection.paths.length,
        }),
        h(
          'div',
          { className: 'mp-toolbar', key: 'toolbar' },
          h(PlayModePills),
          toolbarExtras,
          playAll
            ? h(
                'button',
                {
                  key: 'playall',
                  type: 'button',
                  className: 'mp-chip',
                  style: { marginLeft: 'auto' },
                  onClick: playAll,
                },
                icon('play', 13),
                t('page.playAll'),
              )
            : null,
        ),
        h('div', { className: 'mp-content-body', key: 'body', style: { display: 'contents' } }, body),
      ]
    }

    // ── src/ui/09-online.js
    /**
     * online views: recent history, my playlists, one playlist, cache and search.
     */
    
    function onlineEntriesForHistory(online, provider) {
      return (online.history || []).filter(function (entry) {
        return entry.provider === provider
      })
    }
    
    function OnlineContent(props) {
      var ui = props.ui
      var online = props.online
      var provider = online.provider
      var nav = ui.nav
      var showingSearch = online.query !== '' && (online.phase === 'searching' || online.phase === 'ready' || online.phase === 'error')
      var cachePair = useState(null)
      var cacheList = cachePair[0]
      var setCacheList = cachePair[1]
      var cachePhasePair = useState('idle')
      var cachePhase = cachePhasePair[0]
      var setCachePhase = cachePhasePair[1]
      var prefs = usePrefs()
      var selection = useStore(selectionStore)
      var selecting = selection.active === true
      var selectedSet = useMemo(
        function () {
          var set = {}
          selection.paths.forEach(function (path) {
            set[path] = true
          })
          return set
        },
        [selection.paths],
      )
      var onlineSelectionList = []
      var currentEntries = []
      var likedSet = online.liked || {}
    
      function toggleOnlineFavorite(track) {
        var path = track.path
        var next = likedSet[path] !== true
        postJson(API + 'online/like', { provider: track.onlineProvider, song: track, on: next })
          .then(function () {
            var map = Object.assign({}, onlineStore.get().liked)
            if (next) map[path] = true
            else delete map[path]
            onlineStore.set({ liked: map })
            refreshLikedPlaylist(next ? 1 : -1)
            showToast(next ? t('page.favorite') : t('page.unfavorite'))
          })
          .catch(function (error) {
            showToast(errorText(error))
          })
      }
    
      useEffect(
        function () {
          var cancelled = false
          getJson(API + 'online/liked-ids?provider=' + encodeURIComponent(provider))
            .then(function (body) {
              if (cancelled) return
              var map = {}
              ;(Array.isArray(body.ids) ? body.ids : []).forEach(function (path) {
                map[path] = true
              })
              onlineStore.set({ liked: map })
            })
            .catch(function () {
              // Not signed in: every heart stays neutral.
            })
          return function () {
            cancelled = true
          }
        },
        [provider, (online.providers[provider] || {}).loggedIn],
      )
      var playAll = null
    
      function sortOnlineTracks(entries) {
        return sortTracks((entries || []).map(onlineTrackOf), prefs.sortBy, prefs.sortDir)
      }
    
      function playSelectedOnline() {
        var picked = {}
        selection.paths.forEach(function (path) {
          picked[path] = true
        })
        var chosen = (currentEntries || []).filter(function (entry) {
          return picked['online:' + (entry.provider || provider) + ':' + entry.id] === true
        })
        if (chosen.length > 0) {
          playOnlineResults(chosen, 0)
          return
        }
        var tracks = onlineSelectionList.filter(function (track) {
          return picked[track.path] === true
        })
        if (tracks.length > 0) player.playList(tracks, 0)
      }
    
      function setPlayAll(entries) {
        currentEntries = entries || []
        playAll = currentEntries.length > 0
          ? function () {
              playOnlineResults(currentEntries, 0)
            }
          : null
      }
    
      useEffect(
        function () {
          if (online.playlistsPhase === 'idle' || online.playlistsProvider !== provider) {
            void loadMyPlaylists(provider)
          }
        },
        [provider, online.playlistsPhase, online.playlistsProvider],
      )
    
      useEffect(
        function () {
          if (nav !== 'cache') {
            setCachePhase('idle')
            return undefined
          }
          var cancelled = false
          setCachePhase('loading')
          getJson(API + 'online/cache/list?provider=' + encodeURIComponent(provider))
            .then(function (body) {
              if (cancelled) return
              setCacheList(Array.isArray(body.songs) ? body.songs : [])
              setCachePhase('ready')
            })
            .catch(function () {
              if (cancelled) return
              setCacheList([])
              setCachePhase('error')
            })
          return function () {
            cancelled = true
          }
        },
        [nav, provider],
      )
    
      var title = t('v2.recent')
      var count = 0
      var actions = null
      var body = null
      var resetKey = ''
      var empty = null
    
      if (showingSearch) {
        title = t('online.searchResults')
        var results = online.results || []
        count = results.length
        resetKey = 'search:' + provider + ':' + online.query
    
        if (online.phase === 'searching') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('online.searching')))
        } else if (online.phase === 'error') {
          body = h(Empty, { title: t('online.networkError'), hint: online.error, icon: 'info' })
        } else if (results.length === 0) {
          body = h(Empty, { title: t('online.emptyResults'), hint: '', icon: 'search' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(results), (onlineSelectionList = sortOnlineTracks(results))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            cachedOf: function (track) {
              return online.cache[track.onlineId] === true
            },
            onPlay: function (track) {
              var index = results.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(results, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, { playSelected: playSelectedOnline })
            },
            onToggleFavorite: toggleOnlineFavorite,
            empty: empty,
          })
        }
      } else if (nav === 'playlists') {
        title = t('online.myPlaylists')
        var playlists = online.playlists || []
        count = playlists.length
        resetKey = 'online-playlists'
        var signedIn = (online.providers[provider] || {}).loggedIn === true
        if (!signedIn && online.playlistsPhase !== 'loading') {
          body = h(
            Empty,
            {
              title: t('v2.loginNeeded'),
              hint: t('online.playlistsHint'),
              icon: 'user',
            },
          )
          actions = [
            h(
              Button,
              {
                key: 'login',
                variant: 'primary',
                icon: 'qr',
                onClick: function () {
                  pushLayer('login', { provider: provider, mode: 'qq' })
                },
              },
              t('online.login'),
            ),
          ]
        } else if (online.playlistsPhase === 'loading') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (playlists.length === 0) {
          body = h(Empty, { title: t('v2.noPlaylists'), icon: 'list' })
        } else {
          body = h(
            ScrollBox,
            { resetKey: resetKey },
            playlists.map(function (playlist) {
              return h(
                'button',
                {
                  key: playlist.id,
                  type: 'button',
                  className: 'mp-srow',
                  onClick: function () {
                    void openOnlinePlaylist(playlist)
                  },
                },
                h(
                  'div',
                  { className: 'mp-srow-cover' },
                  playlist.cover
                    ? h(Cover, { src: onlineCoverSrc({ coverUrl: playlist.cover }), iconSize: 18 })
                    : icon('list', 18),
                ),
                h(
                  'div',
                  { className: 'mp-srow-main' },
                  h('div', { className: 'mp-srow-title' }, playlist.name || ''),
                  h('div', { className: 'mp-srow-sub' }, (playlist.trackCount || 0) + ' · ' + t('v2.songs')),
                ),
                icon('chevronRight', 14),
              )
            }),
          )
        }
      } else if (nav === 'playlist') {
        title = online.playlistName || t('online.myPlaylists')
        var songs = online.playlistSongs || []
        count = songs.length
        resetKey = 'online-playlist:' + online.playlistId
        actions = [h(Button, { key: 'back', variant: 'ghost', icon: 'chevronLeft', onClick: function () {
                    closeOnlinePlaylist()
                    setNav('recent')
                  } }, t('v2.back'))]
        if (online.playlistPhase === 'loading') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (songs.length === 0) {
          body = h(Empty, { title: t('online.emptyResults'), icon: 'list' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(songs), (onlineSelectionList = sortOnlineTracks(songs))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            cachedOf: function (track) {
              return online.cache[track.onlineId] === true
            },
            onPlay: function (track) {
              var index = songs.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(songs, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, { playSelected: playSelectedOnline })
            },
            onToggleFavorite: toggleOnlineFavorite,
          })
        }
      } else if (nav === 'cache') {
        title = t('v2.cache')
        var entries = cacheList || []
        count = entries.length
        resetKey = 'online-cache'
        if (cachePhase === 'loading') {
          body = h('div', { className: 'mp-empty' }, h(Spinner), h('span', null, t('v2.loading')))
        } else if (entries.length === 0) {
          body = h(Empty, { title: t('online.cacheEmpty'), icon: 'download' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(entries), (onlineSelectionList = sortOnlineTracks(entries))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            onToggleFavorite: toggleOnlineFavorite,
            cachedOf: function () {
              return true
            },
            onPlay: function (track) {
              var index = entries.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(entries, index < 0 ? 0 : index)
            },
          })
        }
      } else {
        var history = onlineEntriesForHistory(online, provider)
        title = t('v2.recent')
        count = history.length
        resetKey = 'online-recent:' + provider
    
        if (history.length === 0) {
          body = h(Empty, { title: t('v2.noHistory'), hint: t('v2.noHistoryHint'), icon: 'clock' })
        } else {
          body = h(TrackListBody, {
            items: (setPlayAll(history), (onlineSelectionList = sortOnlineTracks(history))),
            resetKey: resetKey,
            selectionMode: selecting,
            selectedSet: selectedSet,
            onToggleSelect: toggleSelected,
            onSelect: function (track, additive) {
              selectTrackIn(onlineSelectionList, track, additive)
            },
            focusPath: props.locatePath || '',
            currentPath: props.currentPath,
            playing: props.playing,
            favoriteSet: likedSet,
            onPlay: function (track) {
              var index = history.findIndex(function (item) {
                return 'online:' + item.provider + ':' + item.id === track.path
              })
              playOnlineResults(history, index < 0 ? 0 : index)
            },
            onMenu: function (track, event) {
              props.onMenu(track, event, {
                playSelected: playSelectedOnline,
                onRemove: function () {
                  var match = /^online:([^:]+):(.+)$/.exec(track.path)
                  if (match === null) return
                  removeHistory({ provider: match[1], id: match[2] })
                  showToast(t('online.removedFromHistory'))
                },
              })
            },
            onToggleFavorite: toggleOnlineFavorite,
          })
        }
      }
    
      return [
        h(ContentHeader, {
          key: 'head',
          title: title,
          count: count,
          onAll: function () {
            selectAllIn(onlineSelectionList)
          },
          onNone: function () {
            setSelectionMode(false)
          },
          onRange: beginRangePick,
          onInvert: function () {
            invertSelectionIn(onlineSelectionList)
          },
          selecting: selecting,
          selectedCount: selection.paths.length,
        }),
        h(
          'div',
          { className: 'mp-toolbar', key: 'toolbar' },
          h(PlayModePills),
          h(
            'div',
            { style: { marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' } },
            playAll
              ? h(
                  'button',
                  { type: 'button', className: 'mp-chip', onClick: playAll },
                  icon('play', 13),
                  t('page.playAll'),
                )
              : null,
            actions || [],
          ),
        ),
        h('div', { className: 'mp-content-body', key: 'body', style: { display: 'contents' } }, body),
      ]
    }

    // ── src/ui/10-navigation.js
    /**
     * navigation: one model, two shapes (top section bar or left rail).
     *
     * Both shapes render `navGroupsFor`, so switching the layout never changes
     * what is reachable — only where it sits. Playlists are first-class items,
     * not a "playlists" list page.
     */
    
    function navItemContextMenu(item, active) {
      if (!item.localPlaylistId) return undefined
      return function (event) {
        event.preventDefault()
        var id = item.localPlaylistId
        var name = item.label
        pushLayer('confirm', {
          title: t('page.delete'),
          text: t('page.deleteConfirm', { name: name }),
          onConfirm: function () {
            if (active === item.key) setNav('songs')
            void removePlaylist(id)
          },
        })
      }
    }
    
    function NavRail(props) {
      var groups = navGroupsFor(props.source, props.favoritesCount)
      var active = activeNavKey(props.nav)
      return h(
        'nav',
        { className: 'mp-nav', 'aria-label': t('page.tabLocal') },
        groups.map(function (group) {
          return h(
            'div',
            { className: 'mp-nav-group', key: group.label },
            h(
              'div',
              { className: 'mp-nav-head' },
              h('div', { className: 'mp-nav-label' }, group.label),
              group.action
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'mp-nav-act',
                      title: group.action.title,
                      'aria-label': group.action.title,
                      onClick: group.action.run,
                    },
                    icon(group.action.icon, 12),
                  )
                : null,
            ),
            group.items.map(function (item) {
              return h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  className: cx('mp-nav-item', active === item.key && 'is-on'),
                  'aria-current': active === item.key ? 'page' : undefined,
                  title: item.label,
                  onClick: function () {
                    activateNavItem(item)
                  },
                  onContextMenu: navItemContextMenu(item, active),
                  onMouseEnter: item.onlinePlaylist
                    ? function () {
                        prefetchOnlinePlaylist(item.onlinePlaylist)
                      }
                    : undefined,
                  onFocus: item.onlinePlaylist
                    ? function () {
                        prefetchOnlinePlaylist(item.onlinePlaylist)
                      }
                    : undefined,
                },
                icon(item.icon, 15),
                h('span', null, item.label),
                item.count !== null && item.count !== undefined
                  ? h('em', { className: 'mp-nav-count' }, String(item.count))
                  : null,
              )
            }),
          )
        }),
      )
    }
    
    function SectionBar(props) {
      var groups = navGroupsFor(props.source, props.favoritesCount)
      var active = activeNavKey(props.nav)
      return h(
        'div',
        { className: 'mp-sectionbar', role: 'tablist', 'aria-label': t('page.tabLocal') },
        groups.map(function (group, groupIndex) {
          return h(
            'span',
            { key: group.label, style: { display: 'contents' } },
            groupIndex > 0 ? h('span', { className: 'mp-sec-sep' }) : null,
            group.showLabel ? h('span', { className: 'mp-sec-label' }, group.label) : null,
            group.action
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'mp-sec-act',
                    title: group.action.title,
                    'aria-label': group.action.title,
                    onClick: group.action.run,
                  },
                  icon(group.action.icon, 12),
                )
              : null,
            group.items.map(function (item) {
              return h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  role: 'tab',
                  title: item.label,
                  'aria-selected': active === item.key,
                  className: cx('mp-sec-item', active === item.key && 'is-on'),
                  onClick: function () {
                    activateNavItem(item)
                  },
                  onContextMenu: navItemContextMenu(item, active),
                  onMouseEnter: item.onlinePlaylist
                    ? function () {
                        prefetchOnlinePlaylist(item.onlinePlaylist)
                      }
                    : undefined,
                  onFocus: item.onlinePlaylist
                    ? function () {
                        prefetchOnlinePlaylist(item.onlinePlaylist)
                      }
                    : undefined,
                },
                item.label,
                item.count !== null && item.count !== undefined
                  ? h('span', { className: 'mp-sec-count' }, String(item.count))
                  : null,
              )
            }),
          )
        }),
      )
    }

    // ── src/ui/11-panel.js
    /**
     * panel: the single composition point (top bar, workspace, player bar, layers).
     */
    
    class MusicBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
    
      static getDerivedStateFromError() {
        return { failed: true }
      }
    
      componentDidCatch() {
        // A broken render must never take the host UI down with it.
      }
    
      render() {
        if (this.state.failed) return null
        return this.props.children
      }
    }
    
    class SilentBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
    
      static getDerivedStateFromError() {
        return { failed: true }
      }
    
      componentDidCatch() {}
    
      render() {
        if (this.state.failed) return null
        return this.props.children
      }
    }
    
    function TopBar(props) {
      var ui = props.ui
      var online = props.online
      var inputRef = useRef(null)
      var textPair = useState(ui.source === 'local' ? ui.query : '')
      var text = textPair[0]
      var setText = textPair[1]
    
      useEffect(
        function () {
          setText(ui.source === 'local' ? ui.query : '')
        },
        [ui.source],
      )
    
      useEffect(
        function () {
          function onKey(event) {
            var tag = event.target && event.target.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
            if (event.key === '/') {
              event.preventDefault()
              if (inputRef.current) inputRef.current.focus()
            }
          }
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('keydown', onKey)
          }
        },
        [],
      )
    
      function submit() {
        if (isOnlineSource(ui.source)) {
          void searchOnline(text)
        }
      }
    
      var providerInfo = isOnlineSource(ui.source) ? (online.providers[ui.source] || {}) : null
    
      return h(
        'header',
        { className: 'mp-topbar' },
        h('div', { className: 'mp-brand' }, h('span', { className: 'mp-brand-dot' }, h('img', { className: 'mp-brand-logo', src: BRAND_LOGO, alt: '' })), t('nav.label')),
        h(
          'div',
          { className: 'mp-src-tabs', role: 'tablist' },
          [
            ['local', t('page.tabLocal')],
            ['netease', t('online.providerNetease')],
            ['qq', t('online.providerQq')],
            ['kugou', t('online.providerKugou')],
          ].map(function (entry) {
            return h(
              'button',
              {
                key: entry[0],
                type: 'button',
                role: 'tab',
                'aria-selected': ui.source === entry[0],
                className: cx('mp-src-tab', ui.source === entry[0] && 'is-on'),
                onClick: function () {
                  setSource(entry[0])
                },
              },
              entry[1],
            )
          }),
        ),
        h(
          'div',
          { className: 'mp-search' },
          icon('search', 14),
          h('input', {
            ref: inputRef,
            className: 'mp-search-input',
            type: 'search',
            value: text,
            placeholder: isOnlineSource(ui.source) ? t('online.searchPlaceholder') : t('page.searchPlaceholder'),
            onChange: function (event) {
              var value = event.target.value
              setText(value)
              if (!isOnlineSource(ui.source)) {
                setUi({ query: value })
              } else if (value === '') {
                onlineStore.set({ query: '', results: [], phase: 'idle', error: '' })
              }
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') submit()
            },
          }),
        ),
        providerInfo !== null
          ? h(
              'div',
              { className: 'mp-userchip is-on' },
              h('span', { className: 'mp-userchip-dot' }),
              h('span', null, providerInfo.loggedIn ? providerInfo.nickname || t('online.loggedIn') : t('online.loggedOut')),
              providerInfo.loggedIn
                ? h(
                    'span',
                    {
                      className: 'mp-userchip-out',
                      role: 'button',
                      tabIndex: 0,
                      onClick: function () {
                        void logoutProvider(ui.source)
                      },
                    },
                    t('online.logout'),
                  )
                : h(
                    'span',
                    {
                      className: 'mp-userchip-out',
                      role: 'button',
                      tabIndex: 0,
                      onClick: function () {
                        pushLayer('login', { provider: ui.source, mode: 'qq' })
                      },
                    },
                    t('online.login'),
                  ),
            )
          : null,
        h(IconButton, {
          icon: 'refresh',
          title: t('page.refresh'),
          onClick: function () {
            if (isOnlineSource(ui.source)) {
              void loadProviders()
              void loadMyPlaylists(ui.source)
              showToast(t('online.refresh'))
            } else {
              void loadLibrary(true)
              showToast(t('page.scanning'))
            }
          },
        }),
        h(IconButton, {
          icon: 'settings',
          title: t('page.settings'),
          onClick: function () {
            pushLayer('settings')
          },
        }),
      )
    }
    
    function ContentArea(props) {
      if (isOnlineSource(props.ui.source)) return h(OnlineContent, props)
      return h(LocalContent, props)
    }
    
    function AudioHost() {
      var ref = useRef(null)
      useEffect(function () {
        player.attachAudio(ref.current)
        player.tryRestore()
        return function () {
          player.attachAudio(null)
        }
      }, [])
      return h('audio', { ref: ref, className: 'mp-audio-host', preload: 'metadata', 'aria-hidden': 'true' })
    }
    
    function applyControlAction(action) {
      if (!action || typeof action.action !== 'string') return
      if (action.action === 'pause') {
        player.pause()
        return
      }
      if (action.action === 'next') {
        player.next()
        return
      }
      if (action.action === 'previous' || action.action === 'prev') {
        player.prev()
        return
      }
      if (action.action !== 'play') return
      var query = String(action.query || '').trim()
      if (query === '') return
      var source =
        action.source === 'netease' || action.source === 'qq' || action.source === 'kugou'
          ? action.source
          : 'local'
      if (source === 'local') {
        var tracks = libraryStore.get().tracks
        var needle = query.toLowerCase()
        var hit = null
        for (var i = 0; i < tracks.length; i += 1) {
          var hay = (String(tracks[i].title || '') + ' ' + String(tracks[i].artist || '')).toLowerCase()
          if (hay.indexOf(needle) >= 0) {
            hit = tracks[i]
            break
          }
        }
        if (hit !== null) player.playList([hit], 0)
        return
      }
      getJson(API + 'online/search?provider=' + encodeURIComponent(source) + '&q=' + encodeURIComponent(query))
        .then(function (body) {
          var results = Array.isArray(body.results) ? body.results : []
          if (results.length > 0) playOnlineResults(results, 0)
        })
        .catch(function () {
          // The model action is best effort.
        })
    }
    
    function OverlayRoot() {
      var overlay = useStore(overlayStore)
      var layers = overlay.layers || []
      return layers.map(function (layer) {
        if (layer.kind === 'menu') return h(ContextMenu, { key: 'menu', layer: layer })
        if (layer.kind === 'login') return h(LoginDialog, { key: 'login', layer: layer })
        if (layer.kind === 'tag') return h(TagDialog, { key: 'tag', layer: layer })
        if (layer.kind === 'addTo') return h(AddToPlaylistDialog, { key: 'addTo', layer: layer })
        if (layer.kind === 'batchEdit') return h(BatchEditDialog, { key: 'batchEdit', layer: layer })
        if (layer.kind === 'duplicates') return h(DuplicatesDialog, { key: 'duplicates', layer: layer })
        if (layer.kind === 'onlineLyric') return h(OnlineLyricDialog, { key: 'onlineLyric', layer: layer })
        if (layer.kind === 'trash') return h(TrashDialog, { key: 'trash', layer: layer })
        if (layer.kind === 'confirm') return h(ConfirmDialog, { key: 'confirm', layer: layer })
        if (layer.kind === 'newPlaylist') return h(NewPlaylistDialog, { key: 'newPlaylist', layer: layer })
        if (layer.kind === 'folderPicker') return h(FolderPickerDialog, { key: 'folderPicker', layer: layer })
        if (layer.kind === 'onlineAddTo') return h(OnlineAddToDialog, { key: 'onlineAddTo', layer: layer })
        if (layer.kind === 'settings') {
          return h(SettingsSheet, {
            key: 'settings',
            open: true,
            onClose: function () {
              removeLayer('settings')
            },
          })
        }
        return null
      })
    }
    
    var BRAND_LOGO = 'data:image/webp;base64,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'
    
    function Panel() {
      var ui = useStore(uiStore)
      var library = useStore(libraryStore)
      var online = useStore(onlineStore)
      var prefs = usePrefs()
      var snap = usePlayerSnapshot()
      var locatePair = useState('')
      var locatePath = locatePair[0]
      var setLocatePath = locatePair[1]
      var current = snap.queue[snap.index] || null
      var favorites = useMemo(function () {
        return favoriteSet()
      }, [library.favorites])
      var favoriteCount = library.favorites.length
    
      useEffect(
        function () {
          var deadline = Number(prefs.sleepDeadline) || 0
          var minutes = Number(prefs.sleepTimerMinutes) || 0
          if (deadline <= 0 && minutes > 0) {
            // Older prefs only stored minutes; turn them into a deadline once.
            setPrefs({ sleepDeadline: Date.now() + minutes * 60000 })
            return undefined
          }
          if (deadline <= 0) return undefined
          var delay = deadline - Date.now()
          if (delay <= 0) {
            player.pause()
            setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
            showToast(t('settings.sleepTimerDone'))
            return undefined
          }
          var timer = setTimeout(function () {
            player.pause()
            setPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
            showToast(t('settings.sleepTimerDone'))
          }, delay)
          return function () {
            clearTimeout(timer)
          }
        },
        [prefs.sleepDeadline, prefs.sleepTimerMinutes],
      )
    
      useEffect(function () {
        void loadLibrary(false)
        void loadFavorites()
        void loadPlaylists()
        void loadConfig()
        void loadProviders()
      }, [])
    
      useEffect(
        function () {
          if (isOnlineSource(ui.source)) {
            onlineStore.set({ provider: ui.source })
            void loadProviders()
          }
        },
        [ui.source],
      )
    
      useEffect(function () {
        var timer = setInterval(function () {
          getJson(API + 'control/pending')
            .then(function (body) {
              ;(body.actions || []).forEach(applyControlAction)
            })
            .catch(function () {
              // The queue endpoint is optional.
            })
        }, 2000)
        return function () {
          clearInterval(timer)
        }
      }, [])
    
      useEffect(
        function () {
          if (current === null || !current.onlineProvider) return undefined
          var provider = current.onlineProvider
          var id = current.onlineId
          var timer = setInterval(function () {
            void refreshCacheStatus(provider, [id])
          }, 3000)
          return function () {
            clearInterval(timer)
          }
        },
        [current ? current.path : ''],
      )
    
      useEffect(function () {
        function onKey(event) {
          var tag = event.target && event.target.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            if (event.key === 'Escape' && event.target.blur) event.target.blur()
            return
          }
          if (event.key === 'Escape') {
            if (typeof document !== 'undefined') {
              var hostModal = document.querySelector('[role="dialog"][aria-modal="true"]')
              if (hostModal !== null && hostModal.closest('.mp-root') === null) return
            }
            if (isRangePicking()) {
              cancelRangePick()
              return
            }
            if (popLayer()) return
            if (selectionStore.get().active === true) {
              setSelectionMode(false)
              return
            }
            if (uiStore.get().queueOpen) {
              uiStore.set({ queueOpen: false })
              return
            }
            if (uiStore.get().npOpen) uiStore.set({ npOpen: false })
            return
          }
          if (event.code === 'Space') {
            event.preventDefault()
            player.toggle()
            return
          }
          if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowRight') {
            event.preventDefault()
            player.next()
            return
          }
          if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowLeft') {
            event.preventDefault()
            player.prev()
          }
        }
        window.addEventListener('keydown', onKey)
        return function () {
          window.removeEventListener('keydown', onKey)
        }
      }, [])
    
      function openTrackMenu(track, event, extra) {
        pushLayer('menu', {
          track: track,
          x: event ? event.clientX : 20,
          y: event ? event.clientY : 20,
          visiblePaths: extra && Array.isArray(extra.visiblePaths) ? extra.visiblePaths : null,
          playSelected: extra && typeof extra.playSelected === 'function' ? extra.playSelected : null,
          onRemove: extra && typeof extra.onRemove === 'function' ? extra.onRemove : null,
        })
      }
    
      function locateCurrent() {
        if (current === null) {
          showToast(t('page.noTrack'))
          return
        }
        if (current.onlineProvider) {
          setSource(current.onlineProvider)
          setUi({ nav: 'recent', filter: null, query: '' })
        } else {
          setSource('local')
          setUi({ nav: 'songs', filter: null, query: '' })
        }
        setLocatePath(current.path)
        setTimeout(function () {
          setLocatePath('')
        }, 1200)
      }
    
      var contentProps = {
        ui: ui,
        library: library,
        online: online,
        prefs: prefs,
        currentPath: current ? current.path : '',
        playing: snap.playing,
        favoriteSet: favorites,
        locatePath: locatePath,
        onMenu: openTrackMenu,
        onToggleFavorite: function (track) {
          void toggleFavorite(track.path)
        },
      }
    
      return h(
        'div',
        { className: cx('mp-root', prefs.layout === 'top' && 'is-top') },
        h(TopBar, { ui: ui, online: online, prefs: prefs }),
        h(
          'div',
          { className: 'mp-workspace' },
          h(NavRail, { source: ui.source, nav: ui.nav, favoritesCount: favoriteCount }),
          h(
            'div',
            { className: 'mp-content' },
            h(SectionBar, { source: ui.source, nav: ui.nav, favoritesCount: favoriteCount }),
            h(ContentArea, contentProps),
          ),
        ),
        h(PlayerBar, {
          favoriteSet: favorites,
          queueOpen: ui.queueOpen,
          onToggleQueue: function () {
            setUi({ queueOpen: !ui.queueOpen })
          },
          onOpenNowPlaying: function () {
            setUi({ npOpen: true })
          },
          onLocate: locateCurrent,
          onToggleFavorite: function (track) {
            void toggleFavorite(track.path)
          },
        }),
        h(NowPlaying, {
          open: ui.npOpen === true,
          favoriteSet: favorites,
          onClose: function () {
            setUi({ npOpen: false })
          },
          onQueue: function () {
            setUi({ npOpen: false, queueOpen: true })
          },
          onToggleFavorite: function (track) {
            void toggleFavorite(track.path)
          },
        }),
        h(OverlayRoot),
        h(Toast),
      )
    }

    // ── src/ui/12-composer.js
    /**
     * composer seats: the inline lyric line and the compact transport next to the
     * chat input. Both are optional and disappear when nothing is playing.
     */
    
    var globalQueueStore = createStore({ open: false })
    
    function ComposerLyrics() {
      var prefs = usePrefs()
      var snap = usePlayerSnapshot()
      var time = usePlayerTime()
      var track = snap.queue[snap.index] || null
      var trackPath = track ? track.path : ''
      var pair = useState([])
      var lines = pair[0]
      var setLines = pair[1]
    
      useEffect(
        function () {
          if (prefs.composerLyrics !== true || trackPath === '') {
            setLines([])
            return undefined
          }
          var cancelled = false
          var active = snap.queue[snap.index]
          if (!active) return undefined
          async function load() {
            try {
              if (active.onlineProvider) {
                var body = await getJson(
                  API +
                    'online/lyric?provider=' +
                    encodeURIComponent(active.onlineProvider) +
                    '&id=' +
                    encodeURIComponent(active.onlineId || ''),
                )
                if (!cancelled) setLines(parseLrcText(body.lrc || ''))
                return
              }
              var local = await getJson(
                API + 'lyrics?path=' + encodeURIComponent(active.path) + '&order=embedded,lrc',
              )
              if (!cancelled) setLines(Array.isArray(local.lines) ? local.lines : [])
            } catch (error) {
              if (!cancelled) setLines([])
            }
          }
          load()
          return function () {
            cancelled = true
          }
        },
        [prefs.composerLyrics, trackPath],
      )
    
      if (prefs.composerLyrics !== true || track === null) return null
      var index = lyricActiveIndex(lines, time.currentTime)
      var line = index >= 0 ? lines[index] : null
      return h(
        'div',
        { className: 'mp-composer-lyrics' },
        icon('note', 12),
        h('span', null, line ? line.text : trackTitleOf(track)),
        prefs.showTranslation === true && line && line.translation
          ? h('span', { style: { opacity: 0.65 } }, '· ' + line.translation)
          : null,
      )
    }
    
    function ComposerCluster() {
      var snap = usePlayerSnapshot()
      var queueState = useStore(globalQueueStore)
      var track = snap.queue[snap.index] || null
      if (track === null) return null
      return h(
        'div',
        { className: 'mp-composer-cluster' },
        h(
          'button',
          {
            type: 'button',
            className: 'mp-cbtn',
            title: snap.playing ? t('page.pause') : t('page.play'),
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
            className: 'mp-cbtn',
            title: t('page.queue'),
            onClick: function () {
              globalQueueStore.set({ open: !queueState.open })
            },
          },
          icon('list', 14),
          h('span', null, trackTitleOf(track)),
        ),
      )
    }
    
    function GlobalQueueHost() {
      var state = useStore(globalQueueStore)
      var snap = usePlayerSnapshot()
      useEffect(
        function () {
          function onKey(event) {
            if (event.key === 'Escape' && globalQueueStore.get().open) {
              globalQueueStore.set({ open: false })
            }
          }
          window.addEventListener('keydown', onKey)
          return function () {
            window.removeEventListener('keydown', onKey)
          }
        },
        [],
      )
      return h(QueuePopover, {
        open: state.open === true,
        snap: snap,
        onClose: function () {
          globalQueueStore.set({ open: false })
        },
      })
    }

    // ── src/ui/13-batch.js
    /**
     * batch edit and duplicate cleanup dialogs.
     */
    
    function BatchEditDialog(props) {
      var paths = props.layer.props.paths || []
      var pair = useState({ artist: '', album: '', genre: '', albumArtist: '' })
      var form = pair[0]
      var setForm = pair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
    
      function field(key, label) {
        return h(
          'div',
          { className: 'mp-field' },
          h('label', null, label),
          h('input', {
            type: 'text',
            value: form[key] || '',
            placeholder: t('page.keepEmpty'),
            onChange: function (event) {
              var value = event.target.value
              setForm(function (previous) {
                var next = Object.assign({}, previous)
                next[key] = value
                return next
              })
            },
          }),
        )
      }
    
      function save() {
        if (busy) return
        var patch = {}
        ;['artist', 'album', 'genre', 'albumArtist'].forEach(function (key) {
          var value = String(form[key] || '').trim()
          if (value !== '') patch[key] = value
        })
        if (Object.keys(patch).length === 0) {
          showToast(t('page.batchEmpty'))
          return
        }
        setBusy(true)
        batchEditTags(paths, patch).then(function (result) {
          setBusy(false)
          popLayer()
          showToast(t('page.batchSaved', { n: result.done }))
          void loadLibrary(true)
        })
      }
    
      return h(
        KitModal,
        {
          title: t('page.batchEdit'),
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'save',
                variant: 'primary',
                disabled: busy,
                onClick: save,
              },
              busy ? t('page.saving') : t('page.save'),
            ),
          ],
        },
    h(
            'div',
            { className: 'mp-kit-body' },
            h('div', { className: 'mp-set-desc' }, t('page.batchHint', { n: paths.length })),
            h(
              'div',
              { className: 'mp-d-grid' },
              field('artist', t('page.artist')),
              field('album', t('page.album')),
              field('genre', t('page.genre')),
              field('albumArtist', t('page.albumArtist')),
            ),
          ),
          
      )
    }
    
    function DuplicatesDialog(props) {
      var groups = props.layer.props.groups || []
      var removals = []
      var rows = groups.map(function (group) {
        var sorted = group.slice().sort(compareQuality)
        sorted.slice(1).forEach(function (track) {
          removals.push(track.path)
        })
        return { keep: sorted[0], drop: sorted.slice(1) }
      })
    
      function clean() {
        if (removals.length === 0) return
        pushLayer('confirm', {
          title: t('page.duplicatesTitle'),
          text: t('page.deleteDuplicatesConfirm', { n: removals.length }),
          onConfirm: function () {
            removeTracks(removals)
              .then(function (body) {
                showToast(t('page.duplicatesRemoved', { n: (body.moved || []).length }))
                removeLayer('duplicates')
              })
              .catch(function (error) {
                showToast(errorText(error))
              })
          },
        })
      }
    
      return h(
        KitModal,
        {
          title: t('page.duplicatesTitle') + ' · ' + groups.length,
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { removeLayer('duplicates') } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'clean',
                variant: 'primary',
                disabled: removals.length === 0,
                onClick: clean,
              },
              t('page.deleteDuplicates'),
            ),
          ],
        },
    h(
            'div',
            { className: 'mp-kit-body' },
            h('div', { className: 'mp-set-desc' }, t('page.duplicatesHint')),
            rows.map(function (row, index) {
              return h(
                'div',
                { key: String(index), className: 'mp-dupe-group' },
                h(
                  'div',
                  { className: 'mp-dupe-row is-keep' },
                  icon('check', 13),
                  h('span', { className: 'mp-ellipsis' }, trackTitleOf(row.keep) + ' · ' + trackArtistOf(row.keep)),
                  h('span', { className: 'mp-dupe-meta' }, fmtKbps(row.keep.bitrate) || fmtKhz(row.keep.sampleRate) || ''),
                ),
                row.drop.map(function (track) {
                  return h(
                    'div',
                    { key: track.path, className: 'mp-dupe-row is-drop' },
                    icon('trash', 12),
                    h('span', { className: 'mp-ellipsis' }, track.path),
                    h('span', { className: 'mp-dupe-meta' }, fmtKbps(track.bitrate) || fmtKhz(track.sampleRate) || ''),
                  )
                }),
              )
            }),
          ),
          
      )
    }

    // ── src/ui/14-online-lyric.js
    /**
     * online lyric search: pick a candidate, preview the LRC, hand it back.
     *
     * Used from the tag editor (fills the lyrics box) and from the player (writes
     * the lyrics straight into the file).
     */
    
    function OnlineLyricDialog(props) {
      var track = props.layer.props.track || {}
      var onApply = props.layer.props.onApply
      var queryPair = useState(((track.title || '') + ' ' + (track.artist || '')).trim())
      var query = queryPair[0]
      var setQuery = queryPair[1]
      var phasePair = useState('idle')
      var phase = phasePair[0]
      var setPhase = phasePair[1]
      var listPair = useState([])
      var candidates = listPair[0]
      var setCandidates = listPair[1]
      var previewPair = useState(null)
      var preview = previewPair[0]
      var setPreview = previewPair[1]
      var errorPair = useState('')
      var error = errorPair[0]
      var setError = errorPair[1]
    
      function search() {
        var text = String(query || '').trim()
        if (text === '' || phase === 'loading') return
        setPhase('loading')
        setError('')
        setCandidates([])
        setPreview(null)
        getJson(API + 'lyrics/search?q=' + encodeURIComponent(text))
          .then(function (body) {
            setCandidates(Array.isArray(body.candidates) ? body.candidates : [])
            setPhase('ready')
          })
          .catch(function (searchError) {
            setError(errorText(searchError))
            setPhase('error')
          })
      }
    
      function choose(candidate) {
        if (!candidate || !candidate.id) return
        setError('')
        setPhase('loading')
        getJson(API + 'lyrics/fetch?id=' + encodeURIComponent(candidate.id))
          .then(function (body) {
            var lines = parseLrcText(body.lrc || '')
            if (body.translation) mergeLyricTranslation(lines, body.translation)
            setPreview({ lrc: body.lrc || '', lines: lines, title: candidate.title, artist: candidate.artist })
            setPhase('ready')
          })
          .catch(function (fetchError) {
            setError(errorText(fetchError))
            setPhase('error')
          })
      }
    
      function apply() {
        if (!preview || preview.lrc.trim() === '') return
        popLayer()
        if (typeof onApply === 'function') onApply(preview.lrc)
      }
    
      return h(
        KitModal,
        {
          title: t('page.onlineLyrics'),
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(Button, { key: 'apply', variant: 'primary', disabled: preview === null, onClick: apply }, t('page.lyricsApply')),
          ],
        },
    h(
            'div',
            { className: 'mp-kit-body' },
            h(
              'div',
              { style: { display: 'flex', gap: '8px' } },
              h('input', {
                type: 'search',
                value: query,
                placeholder: t('page.lyricsSearchPlaceholder'),
                style: {
                  flex: '1',
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
                  background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
                  color: 'inherit',
                  font: 'inherit',
                  outline: 'none',
                },
                onChange: function (event) {
                  setQuery(event.target.value)
                },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') search()
                },
              }),
              h(Button, { variant: 'primary', disabled: phase === 'loading', onClick: search }, t('page.lyricsSearch')),
            ),
            error !== '' ? h('div', { className: 'mp-set-desc', style: { color: 'var(--dsw-alias-state-error-primary,#f87171)' } }, error) : null,
            phase === 'loading' ? h('div', { className: 'mp-empty', style: { padding: '20px' } }, h(Spinner)) : null,
            preview === null
              ? phase === 'ready' && candidates.length === 0
                ? h('div', { className: 'mp-empty', style: { padding: '24px' } }, h('span', null, t('page.lyricsNoResults')))
                : h(
                    'div',
                    { className: 'mp-lyr-candidates' },
                    candidates.map(function (candidate) {
                      return h(
                        'button',
                        {
                          key: String(candidate.id),
                          type: 'button',
                          className: 'mp-lyr-candidate',
                          onClick: function () {
                            choose(candidate)
                          },
                        },
                        h(
                          'div',
                          { className: 'mp-lyr-candidate-main' },
                          h('div', { className: 'mp-srow-title' }, candidate.title || ''),
                          h('div', { className: 'mp-srow-sub' }, candidate.artist || ''),
                        ),
                        h('div', { className: 'mp-srow-meta' }, fmtTime(candidate.durationSec)),
                      )
                    }),
                  )
              : h(
                  'div',
                  { className: 'mp-lyr-preview' },
                  h(
                    'div',
                    { className: 'mp-set-desc' },
                    (preview.title || '') + ' · ' + (preview.artist || ''),
                  ),
                  preview.lines.length === 0
                    ? h('div', { className: 'mp-set-desc' }, t('page.lyricsNoResults'))
                    : preview.lines.map(function (line, index) {
                        return h(
                          'div',
                          { key: String(index), className: 'mp-lyr-line' },
                          h('span', null, line.text || '♪'),
                          line.translation ? h('span', { className: 'mp-lyr-tr' }, line.translation) : null,
                        )
                      }),
                ),
          ),
          
      )
    }

    // ── src/ui/15-trash.js
    /**
     * trash: restore tracks that were moved out of the library.
     */
    
    function TrashDialog(props) {
      var statePair = useState({ phase: 'loading', entries: [] })
      var state = statePair[0]
      var setState = statePair[1]
      var busyPair = useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]
    
      useEffect(function () {
        var cancelled = false
        getJson(API + 'trash')
          .then(function (body) {
            if (cancelled) return
            setState({ phase: 'ready', entries: Array.isArray(body.entries) ? body.entries : [] })
          })
          .catch(function (error) {
            if (cancelled) return
            setState({ phase: 'error', entries: [], error: errorText(error) })
          })
        return function () {
          cancelled = true
        }
      }, [])
    
      function restore(entry) {
        if (busy !== '') return
        setBusy(entry.id)
        postJson(API + 'trash/restore', { id: entry.id })
          .then(function () {
            setBusy('')
            setState(function (previous) {
              return {
                phase: previous.phase,
                entries: previous.entries.filter(function (item) {
                  return item.id !== entry.id
                }),
              }
            })
            showToast(t('v2.restored', { name: entry.name }))
            void loadLibrary(true)
          })
          .catch(function (error) {
            setBusy('')
            showToast(errorText(error))
          })
      }
    
      var count = state.phase === 'ready' ? state.entries.length : 0
      var body = h('div', { className: 'mp-set-desc' }, t('v2.trashHint'))
      if (state.phase === 'loading') {
        body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, h(Spinner))
      } else if (state.phase === 'error') {
        body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, state.error || '')
      } else if (state.entries.length === 0) {
        body = h('div', { className: 'mp-empty', style: { padding: '24px' } }, t('v2.trashEmpty'))
      } else {
        body = h(
          'div',
          { className: 'mp-trash-list' },
          state.entries.map(function (entry) {
            return h(
              'div',
              { key: entry.id, className: 'mp-trash-row' },
              h('span', { className: 'mp-trash-icon' }, icon('trash', 14)),
              h(
                'div',
                { className: 'mp-trash-main' },
                h('div', { className: 'mp-ellipsis' }, entry.name),
                h(
                  'div',
                  { className: 'mp-trash-path' },
                  (entry.originalPath || t('v2.trashNoPath')) +
                    ' · ' +
                    fmtBytes(entry.size) +
                    ' · ' +
                    new Date(entry.mtime).toLocaleString(),
                ),
              ),
              h(
                Button,
                {
                  variant: 'primary',
                  disabled: busy !== '',
                  onClick: function () {
                    restore(entry)
                  },
                },
                busy === entry.id ? t('page.saving') : t('v2.restore'),
              ),
            )
          }),
        )
      }
    
      return h(
        KitModal,
        {
          title: t('v2.trash') + (state.phase === 'ready' ? ' · ' + count : ''),
          onClose: popLayer,
          footer: h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('v2.close')),
        },
        h('div', { className: 'mp-set-desc' }, t('v2.trashHint')),
        body,
      )
    }

    // ── src/ui/16-header.js
    /**
     * shared content header: title + count, select / sort / search actions, and the
     * play-mode pills row used by both the local and online libraries.
     */
    
    function focusGlobalSearch() {
      try {
        var input = document.querySelector('.mp-search-input')
        if (input) {
          input.focus()
          if (typeof input.select === 'function') input.select()
        }
      } catch (error) {
        // Search focus is best-effort only.
      }
    }
    
    function HeadMenu(props) {
      var openPair = useState(false)
      var open = openPair[0]
      var setOpen = openPair[1]
      var ref = useRef(null)
    
      useEffect(
        function () {
          if (!open) return undefined
          if (hostComponent('Menu') !== null) return undefined
          function onDown(event) {
            if (ref.current && ref.current.contains(event.target)) return
            setOpen(false)
          }
          function onKey(event) {
            if (event.key === 'Escape') setOpen(false)
          }
          document.addEventListener('pointerdown', onDown, true)
          window.addEventListener('keydown', onKey)
          return function () {
            document.removeEventListener('pointerdown', onDown, true)
            window.removeEventListener('keydown', onKey)
          }
        },
        [open],
      )
    
      var trigger = h(IconButton, {
        icon: props.icon,
        size: 17,
        title: props.title,
        active: open,
        onClick: function () {
          setOpen(!open)
        },
      })
      var HostMenu = hostComponent('Menu')
      if (HostMenu !== null) {
        var hostItems = props.items.map(function (item) {
          if (item.separator) return { type: 'separator', id: item.key }
          return {
            id: item.key,
            label: item.label,
            icon: item.icon ? icon(item.icon, 13) : undefined,
            disabled: item.disabled === true,
            danger: item.danger === true,
          }
        })
        var selectedId
        props.items.forEach(function (item) {
          if (item.active === true && selectedId === undefined) selectedId = item.key
        })
        return h(HostMenu, {
          open: open,
          anchor: trigger,
          items: hostItems,
          selectedId: selectedId,
          onSelect: function (id) {
            setOpen(false)
            var chosen = null
            props.items.forEach(function (item) {
              if (chosen === null && item.key === id) chosen = item
            })
            if (chosen !== null && typeof chosen.run === 'function') chosen.run()
          },
          onClose: function () {
            setOpen(false)
          },
          side: 'bottom',
          align: 'end',
          portal: true,
          compact: true,
          className: 'mp-headmenu-host',
        })
      }
    
      return h(
        'div',
        { className: 'mp-headmenu', ref: ref },
        trigger,
        open
          ? h(
              'div',
              { className: 'mp-headmenu-pop', role: 'menu' },
              props.items.map(function (item) {
                if (item.separator) return h('hr', { key: item.key, className: 'mp-headmenu-sep' })
                return h(
                  'button',
                  {
                    key: item.key,
                    type: 'button',
                    role: 'menuitem',
                    className: cx('mp-headmenu-item', item.active === true && 'is-on'),
                    onClick: function () {
                      setOpen(false)
                      if (typeof item.run === 'function') item.run()
                    },
                  },
                  item.icon ? icon(item.icon, 13) : null,
                  h('span', { className: 'mp-headmenu-label' }, item.label),
                  item.hint ? h('span', { className: 'mp-headmenu-hint' }, item.hint) : null,
                )
              }),
            )
          : null,
      )
    }
    
    function SelectMenu(props) {
      return h(HeadMenu, {
        icon: 'checkCircle',
        title: t('page.select'),
        items: [
          { key: 'all', icon: 'check', label: t('v2.selAll'), run: props.onAll },
          { key: 'none', icon: 'x', label: t('v2.selNone'), run: props.onNone },
          { key: 'range', icon: 'target', label: t('v2.selRange'), run: props.onRange },
          { key: 'invert', icon: 'refresh', label: t('v2.selInvert'), run: props.onInvert },
        ],
      })
    }
    
    function SortMenu() {
      var prefs = usePrefs()
      var fields = [
        ['title', t('v2.sortTitle')],
        ['artist', t('v2.sortArtist')],
        ['duration', t('v2.sortDuration')],
        ['added', t('v2.sortAdded')],
        ['recent', t('v2.sortRecent')],
      ]
      var items = fields.map(function (entry) {
        return {
          key: entry[0],
          label: entry[1],
          active: prefs.sortBy === entry[0],
          run: function () {
            setPrefs({ sortBy: entry[0] })
          },
        }
      })
      items.push({ key: 'sep', separator: true })
      items.push({
        key: 'asc',
        label: t('page.sortAsc'),
        hint: '↑',
        active: prefs.sortDir === 'asc',
        run: function () {
          setPrefs({ sortDir: 'asc' })
        },
      })
      items.push({
        key: 'desc',
        label: t('page.sortDesc'),
        hint: '↓',
        active: prefs.sortDir === 'desc',
        run: function () {
          setPrefs({ sortDir: 'desc' })
        },
      })
      return h(HeadMenu, { icon: 'sort', title: t('page.sort'), items: items })
    }
    
    function PlayModePills(props) {
      var snap = usePlayerSnapshot()
      var active =
        snap.order === 'random' ? 'random' : snap.loop === 'one' ? 'one' : snap.loop === 'none' ? 'order' : 'loop'
      var modes = [
        ['loop', 'repeat', t('page.loopAll')],
        ['order', 'next', t('page.modeSequence')],
        ['random', 'shuffle', t('page.shuffle')],
      ]
    
      function apply(mode) {
        if (mode === 'random') {
          player.setOrder('random')
          player.setLoop('all')
        } else if (mode === 'order') {
          player.setOrder('list')
          player.setLoop('none')
        } else {
          player.setOrder('list')
          player.setLoop('all')
        }
      }
    
      return h(
        'div',
        { className: 'mp-modes' },
        modes.map(function (mode) {
          return h(
            KitPill,
            {
              key: mode[0],
              active: active === mode[0],
              icon: mode[1],
              title: mode[2],
              onClick: function () {
                apply(mode[0])
              },
            },
            mode[2],
          )
        }),
      )
    }
    
    function ContentHeader(props) {
      return h(
        'header',
        { className: 'mp-content-head' },
        h('h1', { className: 'mp-title', title: props.title }, props.title),
        h('span', { className: 'mp-count' }, props.count > 0 ? t('page.trackCountUnit', { n: props.count }) : ''),
        props.selecting === true && (props.selectedCount || 0) > 0
          ? h('span', { className: 'mp-sel-count' }, t('page.selectedCount', { n: props.selectedCount }))
          : null,
        h(
          'div',
          { className: 'mp-head-actions' },
          h(SelectMenu, {
            onAll: props.onAll,
            onNone: props.onNone,
            onRange: props.onRange,
            onInvert: props.onInvert,
          }),
          h(SortMenu),
          h(IconButton, { icon: 'search', size: 17, title: t('v2.searchFocus'), onClick: focusGlobalSearch }),
        ),
      )
    }

    // ── src/ui/17-folder-picker.js
    /**
     * folder picker: read-only directory browser backed by GET /browse.
     *
     * Used from Settings → 音乐库 and from the folder view quick-add button.
     */
    
    function FolderPickerDialog(props) {
      var statePair = useState({ phase: 'loading', path: '', parent: null, dirs: [], error: '' })
      var state = statePair[0]
      var setState = statePair[1]
    
      function load(target) {
        setState(function (previous) {
          return Object.assign({}, previous, { phase: 'loading', error: '' })
        })
        getJson(API + 'browse?path=' + encodeURIComponent(target))
          .then(function (body) {
            setState({
              phase: 'ready',
              path: body.path || '',
              parent: body.parent === undefined ? null : body.parent,
              dirs: Array.isArray(body.dirs) ? body.dirs : [],
              error: '',
            })
          })
          .catch(function (error) {
            setState(function (previous) {
              return Object.assign({}, previous, { phase: 'error', error: errorText(error) })
            })
          })
      }
    
      useEffect(function () {
        load('')
      }, [])
    
      function useHere() {
        if (state.path === '') return
        var config = libraryStore.get().config || {}
        var roots = Array.isArray(config.roots) ? config.roots.slice() : []
        if (roots.indexOf(state.path) < 0) roots.push(state.path)
        var after = function (ok) {
          if (!ok) return
          showToast(t('v2.folderAdded'))
          popLayer()
        }
        saveConfig({ roots: roots }).then(after)
      }
    
      var list = null
      if (state.phase === 'loading') {
        list = h('div', { className: 'mp-folder-state' }, h(Spinner), h('span', null, t('v2.loading')))
      } else if (state.phase === 'error') {
        list = h('div', { className: 'mp-folder-state' }, state.error || t('page.loadFailed'))
      } else if (state.dirs.length === 0) {
        list = h('div', { className: 'mp-folder-state' }, t('v2.folderEmpty'))
      } else {
        list = h(
          'div',
          { className: 'mp-folder-list' },
          state.parent !== null && state.parent !== undefined
            ? h(
                'button',
                { type: 'button', className: 'mp-folder-row', onClick: function () { load(state.parent) } },
                icon('chevronLeft', 14),
                h('span', null, t('v2.folderUp')),
              )
            : null,
          state.dirs.map(function (dir) {
            return h(
              'button',
              {
                key: dir.path,
                type: 'button',
                className: 'mp-folder-row',
                onClick: function () {
                  load(dir.path)
                },
              },
              icon('folder', 16),
              h('span', { className: 'mp-folder-row-name', title: dir.name }, dir.name),
            )
          }),
        )
      }
    
      return h(
        KitModal,
        {
          title: t('v2.folderPick'),
          onClose: popLayer,
          footer: [
            h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(
              Button,
              {
                key: 'here',
                variant: 'primary',
                icon: 'check',
                disabled: state.path === '' || state.phase !== 'ready',
                onClick: useHere,
              },
              t('v2.folderHere'),
            ),
          ],
        },
        h(
          'div',
          { className: 'mp-folder-path', title: state.path },
          state.path === '' ? t('v2.folderPick') : state.path,
        ),
        list,
      )
    }

    // ── src/ui/18-online-add.js
    /**
     * add one online song to one of the signed-in account's cloud playlists.
     */
    
    function OnlineAddToDialog(props) {
      var layerProps = props.layer.props || {}
      var track = layerProps.track || null
      var provider = track && track.onlineProvider ? track.onlineProvider : ''
      var statePair = useState({ phase: 'loading', playlists: [], error: '' })
      var state = statePair[0]
      var setState = statePair[1]
      var busyPair = useState('')
      var busy = busyPair[0]
      var setBusy = busyPair[1]
    
      useEffect(
        function () {
          if (provider === '') return undefined
          var cancelled = false
          getJson(API + 'online/my-playlists?provider=' + encodeURIComponent(provider))
            .then(function (body) {
              if (cancelled) return
              setState({
                phase: 'ready',
                playlists: Array.isArray(body.playlists) ? body.playlists : [],
                error: '',
              })
            })
            .catch(function (error) {
              if (cancelled) return
              setState({ phase: 'error', playlists: [], error: errorText(error) })
            })
          return function () {
            cancelled = true
          }
        },
        [provider],
      )
    
      function addTo(playlist) {
        if (busy !== '' || track === null) return
        setBusy(playlist.id)
        postJson(API + 'online/playlist-add', {
          provider: provider,
          playlistId: playlist.id,
          song: track,
        })
          .then(function () {
            setBusy('')
            showToast(t('online.addedToCloudPlaylist'))
            popLayer()
          })
          .catch(function (error) {
            setBusy('')
            showToast(errorText(error))
          })
      }
    
      var body = null
      if (state.phase === 'loading') {
        body = h('div', { className: 'mp-folder-state' }, h(Spinner), h('span', null, t('v2.loading')))
      } else if (state.phase === 'error') {
        body = h('div', { className: 'mp-folder-state' }, state.error || t('page.loadFailed'))
      } else if (state.playlists.length === 0) {
        body = h('div', { className: 'mp-folder-state' }, t('online.noCloudPlaylists'))
      } else {
        body = h(
          'div',
          { className: 'mp-folder-list' },
          state.playlists.map(function (playlist) {
            return h(
              'button',
              {
                key: playlist.id,
                type: 'button',
                className: 'mp-srow',
                disabled: busy !== '',
                onClick: function () {
                  addTo(playlist)
                },
              },
              h(
                'div',
                { className: 'mp-srow-cover' },
                playlist.cover
                  ? h(Cover, { src: onlineCoverSrc({ coverUrl: playlist.cover }), iconSize: 18 })
                  : icon('list', 18),
              ),
              h(
                'div',
                { className: 'mp-srow-main' },
                h('div', { className: 'mp-srow-title' }, playlist.name || ''),
                h('div', { className: 'mp-srow-sub' }, (playlist.trackCount || 0) + ' · ' + t('v2.songs')),
              ),
              busy === playlist.id ? h(Spinner) : icon('plus', 14),
            )
          }),
        )
      }
    
      return h(
        KitModal,
        {
          title: t('online.addToCloudPlaylist'),
          onClose: popLayer,
          footer: h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('v2.close')),
        },
        h('div', { className: 'mp-set-desc' }, track ? track.title || '' : ''),
        body,
      )
    }

    // ── src/99-plugin.js
    /**
     * plugin: seat registration and lifecycle.
     */
    
    function MusicSideIcon() {
      var snap = usePlayerSnapshot()
      return h(
        'span',
        { className: 'mp-side-icon' },
        icon('note', 16),
        snap.queue.length > 0 ? h('span', { className: 'mp-side-dot' }) : null,
      )
    }
    
    function NewPlaylistDialog(props) {
      var pair = useState('')
      var name = pair[0]
      var setName = pair[1]
      var busyPair = useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
    
      function create() {
        var value = name.trim()
        if (value === '' || busy) return
        setBusy(true)
        createPlaylist(value).then(function (created) {
          setBusy(false)
          if (created) {
            popLayer()
            openLocalPlaylist(created.id)
          }
        })
      }
    
      return h(
        'div',
        { className: 'mp-overlay is-on' },
        h('div', { className: 'mp-scrim', onClick: function () { popLayer() } }),
        h(
          'div',
          { className: 'mp-dialog is-sm', role: 'dialog', 'aria-label': t('v2.newPlaylist') },
          h(
            'div',
            { className: 'mp-d-head' },
            h('div', { className: 'mp-d-title' }, t('v2.newPlaylist')),
            h('div', { className: 'mp-spacer' }),
            h(IconButton, { icon: 'x', title: t('v2.close'), onClick: function () { popLayer() } }),
          ),
          h(
            'div',
            { className: 'mp-d-body' },
            h('input', {
              type: 'text',
              value: name,
              placeholder: t('v2.playlistName'),
              autoFocus: true,
              style: {
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
                background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
                color: 'inherit',
                font: 'inherit',
                outline: 'none',
              },
              onChange: function (event) {
                setName(event.target.value)
              },
              onKeyDown: function (event) {
                if (event.key === 'Enter') create()
              },
            }),
          ),
          h(
            'div',
            { className: 'mp-d-foot' },
            h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
            h(Button, { variant: 'primary', disabled: busy, onClick: create }, t('page.create')),
          ),
        ),
      )
    }
    
    function apply(ctx) {
      try {
        if (typeof console !== 'undefined' && console.info) {
          console.info('[dsh-music-panel] host UI kit:', hostUi ? 'native' : 'fallback')
        }
      } catch (error) {
        // Logging is best-effort.
      }
      try {
        var htmlLang = document.documentElement.getAttribute('lang') || ''
        if (htmlLang !== '') LANG = String(htmlLang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
      } catch (error) {
        // Keep the initial guess.
      }
    
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
        style.textContent = THEME_TEXT
        document.head.appendChild(style)
        return function () {
          style.remove()
        }
      })
    
      ctx.effect(function () {
        return function () {
          player.suspend()
        }
      })
    
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
            return new Promise(function () {})
          }
          function becomeLeader() {
            player.setLeader(true)
            return hold()
          }
          navigator.locks
            .request(LOCK, { mode: 'exclusive', ifAvailable: true }, function (lock) {
              if (lock !== null && lock !== undefined) return becomeLeader()
              player.setLeader(false)
              return navigator.locks.request(LOCK, becomeLeader)
            })
            .catch(function () {
              player.setLeader(true)
            })
        } catch (error) {
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
    
      mount('shell.overlay', { name: 'shell.overlay', id: 'music-player', order: 15 }, AudioHost)
      mount('shell.overlay', { name: 'shell.overlay', id: 'music-queue', order: 16 }, GlobalQueueHost)
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
        MusicSideIcon,
      )
      mount('main', { name: 'main', key: PANEL_ID }, function () {
        return h(MusicBoundary, null, h(Panel))
      })
      mount('conversation.input.dock', { name: 'conversation.input.dock', id: 'music-lyrics-above' }, function () {
        return h(SilentBoundary, null, h(ComposerLyrics))
      })
      mount(
        'conversation.input.right',
        { name: 'conversation.input.right', id: 'music-composer-cluster', order: 10 },
        function () {
          return h(SilentBoundary, null, h(ComposerCluster))
        },
      )
    }

    var plugin = {
      name: 'dsh-music-panel',
      inject: ['slots', 'locale'],
      apply: apply,
    }
    // Non-enumerable handles for tests and debugging; the host never sees them.
    try {
      Object.defineProperty(plugin, '__internals', {
        value: {
          uiStore: uiStore,
          libraryStore: libraryStore,
          onlineStore: onlineStore,
          prefsStore: prefsStore,
          overlayStore: overlayStore,
          selectionStore: selectionStore,
          player: player,
          lufsFromAudioBuffer: lufsFromAudioBuffer,
          analyzeLoudnessBlob: analyzeLoudnessBlob,
        },
        enumerable: false,
      })
    } catch (error) {
      // Older engines without defineProperty simply skip the hook.
    }
    return plugin
  },
})
