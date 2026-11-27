/**
 * Render smoke test for panel-v3.
 *
 * Loads the generated client bundle with a minimal React mock, seeds the stores
 * and walks the rendered tree. Effects do not run; the test catches reference
 * errors and structural regressions in every page branch.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const registrations = []
const components = new Map()

global.window = {
  __ModuleLoader__: {
    load(definition) { globalThis.__dshMusicDef = definition },
  },
  localStorage: {
    _data: new Map([['music.startupGuide.intro.v1', '1']]),
    getItem(key) { return this._data.has(key) ? this._data.get(key) : null },
    setItem(key, value) { this._data.set(key, String(value)) },
    removeItem(key) { this._data.delete(key) },
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  requestAnimationFrame(callback) { return setTimeout(callback, 0) },
  cancelAnimationFrame(id) { clearTimeout(id) },
  setTimeout(callback) { return setTimeout(callback, 0) },
  clearTimeout(id) { clearTimeout(id) },
  innerWidth: 1400,
  innerHeight: 900,
  location: { href: 'http://127.0.0.1/' },
  matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} } },
}

global.HTMLElement = class HTMLElement {}
global.ResizeObserver = undefined
global.document = {
  head: { appendChild() {} },
  body: { appendChild() {} },
  activeElement: null,
  createElement() { return { dataset: {}, textContent: '', remove() {}, appendChild() {} } },
  documentElement: { getAttribute: () => 'zh-CN' },
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
  querySelector() { return null },
  querySelectorAll() { return [] },
}

if (typeof global.navigator === 'undefined') global.navigator = { language: 'zh-CN' }

const React = {
  createElement: (type, props, ...children) => {
    const next = props ? { ...props } : {}
    const kids = children.length > 0 ? children : next.children === undefined ? [] : Array.isArray(next.children) ? next.children : [next.children]
    if (kids.length > 0) next.children = kids.length === 1 ? kids[0] : kids
    return { type, props: next, children: kids }
  },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
  useLayoutEffect() {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (factory) => factory(),
  useCallback: (factory) => factory,
  Fragment: 'fragment',
  Component: class Component { constructor(props) { this.props = props; this.state = {} } setState() {} },
}

await import('../../client.js')

const definition = globalThis.__dshMusicDef
assert.ok(definition, 'client.js must register through window.__ModuleLoader__')
const api = definition.factory((name) => {
  assert.equal(name, 'react', 'unexpected host module: ' + name)
  return React
})

api.apply({
  effect(factory) { const dispose = factory(); registrations.push(dispose); return dispose },
  slots: {
    inject(name, callback) { callback(); return () => {} },
    register(registration, component) { components.set(registration.name + ':' + (registration.id || registration.key || ''), component); return () => {} },
  },
})

function walk(node, visit) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) { node.forEach((item) => walk(item, visit)); return }
  if (typeof node !== 'object') return
  if (node.type) visit(node)
  if (Array.isArray(node.children)) node.children.forEach((child) => walk(child, visit))
}

function isClassComponent(type) {
  if (typeof type !== 'function' || !type.prototype) return false
  if (type.prototype.isReactComponent) return true
  return /^class\b/.test(Function.prototype.toString.call(type))
}

function expand(node) {
  if (node === null || node === undefined) return node
  if (Array.isArray(node)) return node.map(expand)
  if (typeof node !== 'object') return node
  if (typeof node.type === 'function') {
    if (isClassComponent(node.type)) return expand(node.children || (node.props && node.props.children))
    return expand(node.type(node.props || {}))
  }
  return Object.assign({}, node, { children: Array.isArray(node.children) ? node.children.map(expand) : node.children })
}

function classesOf(tree) {
  const classes = new Set()
  walk(expand(tree), (node) => {
    const className = node.props && node.props.className
    if (typeof className === 'string') className.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name))
  })
  return classes
}

function nodesWithClass(tree, name) {
  const out = []
  walk(expand(tree), (node) => {
    const className = node.props && node.props.className
    if (typeof className === 'string' && className.split(/\s+/).filter(Boolean).includes(name)) out.push(node)
  })
  return out
}

function textOf(tree) {
  const parts = []
  function collect(value) {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) { value.forEach(collect); return }
    if (typeof value === 'string' || typeof value === 'number') { parts.push(String(value)); return }
    if (typeof value === 'object' && Array.isArray(value.children)) value.children.forEach(collect)
  }
  collect(expand(tree))
  return parts.join(' ')
}

const internals = api.__internals
assert.ok(internals, 'internals are exposed for tests')

const TRACKS = [
  { path: 'D:/Music/a.mp3', name: 'a.mp3', title: 'Alpha', artist: 'Artist A', album: 'Album One', folder: 'Pop', durationSec: 200, hasCover: false, size: 1000, mtime: 1, plays: 3 },
  { path: 'D:/Music/b.mp3', name: 'b.mp3', title: 'Beta', artist: 'Artist B', album: 'Album Two', folder: 'Rock', durationSec: 180, hasCover: false, size: 2000, mtime: 2, plays: 1 },
  { path: 'D:/Music/c.mp3', name: 'c.mp3', title: 'Gamma', artist: 'Artist A', album: 'Album One', folder: 'Pop', durationSec: 240, hasCover: false, size: 3000, mtime: 3, plays: 9 },
]

internals.libraryStore.set({
  phase: 'ready', tracks: TRACKS, roots: ['D:/Music'], favorites: ['D:/Music/a.mp3'],
  playlists: [{ id: 'p1', name: 'Commute', trackPaths: ['D:/Music/a.mp3', 'D:/Music/c.mp3'] }],
  config: { roots: ['D:/Music'], depth: 3 }, stats: {}, statsRange: 'all',
})
internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { layout: 'top' }))
internals.p3RouteStore.set({ source: 'local', page: 'songs', param: null, filter: null, query: '', history: [], scroll: {} })
internals.player.playList(TRACKS, 0)

const panel = components.get('main:music')
assert.equal(typeof panel, 'function', 'the main seat must register panel-v3')

const local = panel()
const localClasses = classesOf(local)
for (const name of ['mpv3-root', 'mpv3-topbar', 'mpv3-workspace', 'mpv3-content', 'mpv3-player']) {
  assert.ok(localClasses.has(name), 'expected class ' + name)
}
const localText = textOf(local)
assert.ok(localText.includes('Alpha'), 'the first track title is rendered')
assert.ok(localText.includes('Gamma'), 'visible tracks are rendered')

internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { layout: 'rail' }))
const railTree = panel()
assert.ok(classesOf(railTree).has('mpv3-rail'), 'rail layout renders the left rail')
assert.ok(!classesOf(railTree).has('mpv3-tabs'), 'rail layout does not duplicate the tab strip')
internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { layout: 'top' }))

for (const page of ['favorites', 'playlists', 'stats', 'albums', 'artists', 'folders']) {
  internals.p3RouteStore.set({ source: 'local', page, param: null, filter: null, query: '', history: [], scroll: {} })
  const tree = panel()
  assert.ok(classesOf(tree).has('mpv3-content'), 'view ' + page + ' renders content')
}

internals.p3RouteStore.set({ source: 'local', page: 'playlist', param: 'p1', filter: null, query: '', history: [], scroll: {} })
assert.ok(classesOf(panel()).has('mpv3-hero'), 'playlist detail renders a hero')

internals.p3RouteStore.set({ source: 'local', page: 'album', param: 'Artist A|Album One', filter: null, query: '', history: [], scroll: {} })
assert.ok(classesOf(panel()).has('mpv3-hero'), 'album detail renders a hero')

internals.p3RouteStore.set({ source: 'local', page: 'artist', param: 'Artist A', filter: null, query: '', history: [], scroll: {} })
assert.ok(classesOf(panel()).has('mpv3-hero'), 'artist detail renders a hero')

// 在线歌手页：热门 10 首 + 「全部歌曲」入口（Folia 的两层结构）；完整列表在另一层翻页。
internals.onlineStore.set({
  providers: { kugouLite: { loggedIn: true, capabilities: { artists: true, search: true, userPlaylists: true } } },
  provider: 'kugouLite',
  artistName: 'Udit Narayan',
  artistProvider: 'kugouLite',
  artistId: '123',
  artistPhase: 'ready',
  artistTotal: 417,
  artistHasMore: true,
  artistSongs: Array.from({ length: 10 }, (_, index) => ({
    provider: 'kugouLite',
    id: 'k' + index,
    title: '歌 ' + index,
    artist: 'Udit Narayan',
    album: '专辑',
    durationSec: 200,
  })),
  artistAllSongs: [],
  artistAllPhase: 'idle',
})
internals.p3RouteStore.set({ source: 'kugouLite', page: 'artist', param: 'kugouLite:Udit Narayan', filter: null, query: '', history: [], scroll: {} })
const onlineArtist = panel()
assert.ok(textOf(onlineArtist).includes('全部歌曲'), 'the artist page offers the paged full list')
assert.ok(textOf(onlineArtist).includes('417'), 'the header carries the platform total, not the ten shown')
assert.equal(nodesWithClass(onlineArtist, 'mpv3-row').length, 10, 'the page itself keeps Folia top ten')
const p3Pages = readFileSync(new URL('../../src/client/panel-v3/p3-pages.js', import.meta.url), 'utf8')
// A provider that answered the whole list on the first request (no next page) still gets
// the entry: 「no more pages」 is not 「no second layer」.
internals.onlineStore.set({
  artistSongs: Array.from({ length: 20 }, (_, index) => ({
    provider: 'kugouLite',
    id: 'f' + index,
    title: '兜底 ' + index,
    artist: 'Udit Narayan',
    album: '专辑',
    durationSec: 200,
  })),
  artistTotal: 20,
  artistHasMore: false,
})
const fullyLoadedArtist = panel()
assert.ok(textOf(fullyLoadedArtist).includes('全部歌曲'), 'a fully loaded list still offers the full view')
assert.equal(nodesWithClass(fullyLoadedArtist, 'mpv3-row').length, 10, 'the hot section stays at ten')
assert.match(p3Pages, /openArtistSongsList\(/, 'the full list is the artist_songs layer')
assert.match(p3Pages, /type: 'artistSongs'/, 'the layer is a pushed collection, like Folia\'s artist_songs')
assert.match(p3Pages, /props\.online\.artistAllHasMore === true/, 'the layer pages through P3List')
assert.doesNotMatch(p3Pages, /items\.slice\(0, 10\)/, 'the artist page no longer hard-cuts the loaded list at ten')

// The layer itself: a pushed navigation level with its own cursor (Folia's #918 shape).
internals.p3PushCollection({
  type: 'artistSongs',
  source: 'online',
  provider: 'kugouLite',
  id: '123',
  param: 'kugouLite:123',
  artist: 'Udit Narayan',
  artistId: '123',
  name: '全部歌曲 · Udit Narayan',
  coverUrl: '',
})
internals.onlineStore.set({
  artistAllProvider: 'kugouLite',
  artistAllArtist: 'Udit Narayan',
  artistAllArtistId: '123',
  artistAllPhase: 'ready',
  artistAllSongs: Array.from({ length: 30 }, (_, index) => ({
    provider: 'kugouLite',
    id: 'a' + index,
    title: '全部 ' + index,
    artist: 'Udit Narayan',
    album: '专辑',
    durationSec: 200,
  })),
  artistAllTotal: 3196,
  artistAllHasMore: true,
  artistAllOffset: 30,
  artistAllLoading: false,
  artistAllError: '',
})
const artistLayer = panel()
assert.ok(textOf(artistLayer).includes('全部歌曲 · Udit Narayan'), 'the layer names the artist')
assert.ok(textOf(artistLayer).includes('3196'), 'the layer carries the platform total')
assert.ok(nodesWithClass(artistLayer, 'mpv3-row').length > 10, 'the layer lists the paged songs')
internals.p3GoBack()
const onlineSource = readFileSync(new URL('../../src/client/components/online/online.js', import.meta.url), 'utf8')
assert.match(onlineSource, /searchHasMore: body\.hasMore === true/, 'the search page learns whether a next page exists')
assert.match(onlineSource, /artistsDetail: Array\.isArray\(track\.artistsDetail\)/, 'recent history keeps the artist ids a song carries')
assert.match(onlineSource, /albumDetail: track\.albumDetail/, 'recent history keeps the album refs a song carries')
assert.match(p3Pages, /props\.online\.searchHasMore === true/, 'search load more is gated by the host')

internals.p3RouteStore.set({ source: 'local', page: 'search', param: null, filter: null, query: 'Artist', history: [], scroll: {} })
const searchTree = panel()
assert.ok(textOf(searchTree).includes('Alpha'), 'local search renders matching tracks')
assert.ok(classesOf(searchTree).has('mpv3-search-artist'), 'local search puts the best artist first')
assert.equal(nodesWithClass(searchTree, 'mpv3-search-artist').length, 1, 'only one artist is shown')
assert.ok(classesOf(searchTree).has('mpv3-hrow'), 'local search renders a horizontal album row')
const searchHeads = nodesWithClass(searchTree, 'mpv3-section-head').map((node) => textOf(node))
assert.ok(searchHeads[0] && searchHeads[0].includes('歌手'), 'artist section is first')
assert.ok(searchHeads[1] && searchHeads[1].includes('专辑'), 'album section is second')
assert.ok(searchHeads[2] && searchHeads[2].includes('歌曲'), 'song section is last')
assert.ok(!classesOf(searchTree).has('mpv3-search-kinds'), 'search no longer shows kind tabs')
assert.ok(!classesOf(searchTree).has('mpv3-tabs'), 'search page hides the library tab strip')
internals.p3RouteStore.set({ source: 'local', page: 'search', param: null, filter: null, query: '', history: [], scroll: {} })
assert.ok(textOf(panel()).includes('返回'), 'empty search page offers a centered back action')

assert.ok(internals.p3Tabs('netease').indexOf('recent') >= 0, 'online sources expose recent')
assert.ok(internals.p3Tabs('netease').indexOf('songs') < 0, 'Chinese platforms do not expose a library songs page')
assert.ok(internals.p3Tabs('netease').indexOf('albums') < 0, 'Chinese platforms do not expose an album browse tab')
assert.ok(internals.p3Tabs('netease').indexOf('artists') < 0, 'Chinese platforms do not expose an artist browse tab')
assert.ok(internals.p3Tabs('navidrome').indexOf('songs') >= 0, 'Navidrome exposes its library songs page')
internals.onlineStore.set({ providers: { navidrome: { loggedIn: true, capabilities: { browseAlbums: true, browseArtists: true, userPlaylists: true } } } })
assert.ok(internals.p3Tabs('navidrome').indexOf('albums') >= 0, 'Navidrome exposes its album browse tab')
assert.ok(internals.p3Tabs('navidrome').indexOf('artists') >= 0, 'Navidrome exposes its artist browse tab')

// 歌词设置：只有一条文字大小滑杆（翻译行固定为歌词字号的 90%，不再有第二个滑杆）。
{
  const sheet = internals.SettingsSheet({ open: true, initialTab: 'lyrics' })
  const tree = expand(sheet)
  const text = textOf(tree)
  assert.ok(text.includes('歌词字号'), 'the lyric tab shows the font multiplier row')
  assert.ok(!text.includes('翻译字体缩放'), 'the relative translation size row is gone')
  assert.ok(!text.includes('歌词间距'), 'the dead line-spacing row is gone')
  assert.ok(!text.includes('模糊非当前歌词'), 'the dead blur row is gone')
  assert.ok(!text.includes('歌词对齐方式'), 'the dead alignment row is gone')
  // Folia's groups, with the plugin's own group last.
  for (const group of ['歌词来源', '时间与过滤', '本地歌词文件格式优先级', '插件']) {
    assert.ok(text.includes(group), 'the lyric page shows the ' + group + ' group')
  }
  for (const row of ['保留平台自带的逐字歌词', '全局时间偏移', '歌词过滤', '格式顺序']) {
    assert.ok(text.includes(row), 'the lyric page shows the ' + row + ' row')
  }
  assert.ok(text.includes('0 ms'), 'the global offset row shows its value')
  const buttonTexts = []
  walk(tree, (node) => {
    if (node.type === 'button') buttonTexts.push(textOf(node))
  })
  assert.ok(buttonTexts.some((label) => label.includes('调整')), 'the offset row opens its window')
  assert.ok(buttonTexts.some((label) => label.includes('编辑')), 'the filter row opens its window')
  const ranges = []
  walk(tree, (node) => {
    if (node.type === 'input' && node.props && node.props.type === 'range') ranges.push(node)
  })
  const fontRange = ranges.find((node) => node.props.min === 70 && node.props.max === 150)
  assert.ok(fontRange, 'the font-size row is a 70–150% slider')
  fontRange.props.onChange({ target: { value: '120' } })
  assert.equal(internals.prefsStore.get().lyricsFontScale, 1.2, 'dragging it writes the multiplier')
  internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { lyricStyle: 'monet' }))
  const monetText = textOf(expand(internals.SettingsSheet({ open: true, initialTab: 'lyrics' })))
  assert.ok(monetText.includes('不受这个开关影响'), '莫奈 explains why the subtitle background does nothing here')
  internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { lyricStyle: 'tilt' }))
  const tiltText = textOf(expand(internals.SettingsSheet({ open: true, initialTab: 'lyrics' })))
  assert.ok(tiltText.includes('为底部歌词加一层随主题的柔和背景'), 'a subtitle-overlay style keeps the normal description')
  internals.prefsStore.set(Object.assign({}, internals.prefsStore.get(), { lyricStyle: 'monet', lyricsFontScale: 1 }))
}

// 存储与备份：Folia 的四组 + 危险操作；缓存目录、缓存详情与备份窗口都有入口。
{
  const sheet = internals.SettingsSheet({ open: true, initialTab: 'cache' })
  const tree = expand(sheet)
  const text = textOf(tree)
  assert.ok(text.includes('存储与备份'), 'the page is named after Folia\'s 存储与备份')
  for (const group of ['媒体缓存', '缓存详情', '本地文件夹监视', '备份与导入', '危险操作']) {
    assert.ok(text.includes(group), 'the storage page shows the ' + group + ' group')
  }
  for (const row of ['缓存歌曲', '缓存目录', '缓存上限', '已缓存歌曲', '歌单数据', '歌词', '封面', '媒体文件', '分析数据', '智能平衡数据', '自动扫描已导入文件夹']) {
    assert.ok(text.includes(row), 'the storage page shows the ' + row + ' row')
  }
  const buttons = []
  walk(tree, (node) => {
    if (node.type === 'button') buttons.push(textOf(node))
  })
  assert.ok(buttons.some((label) => label.includes('全部清空')), 'the details group can be cleared at once')
  assert.ok(buttons.some((label) => label.includes('选择文件夹')), 'the cache folder can be chosen')
  assert.ok(buttons.some((label) => label.includes('管理')), 'backup & import has an entry')
}

// 播放控制：Folia 的三个分组，插件自有的项在「插件」组。
{
  const sheet = internals.SettingsSheet({ open: true, initialTab: 'playback' })
  const tree = expand(sheet)
  const text = textOf(tree)
  for (const group of ['Folia 智能过渡', '声音与设备', '播放行为', '插件']) {
    assert.ok(text.includes(group), 'the playback page shows the ' + group + ' group')
  }
  for (const row of [
    '过渡',
    '当前播放声卡',
    'ReplayGain 模式（响度平衡）',
    '暂停/播放淡入淡出',
    '加入队列的默认位置',
    '无法播放时自动跳过',
    '一轮不重复',
    '播放时阻止休眠',
    '语音输入时暂停播放',
  ]) {
    assert.ok(text.includes(row), 'the playback page shows the ' + row + ' row')
  }
  assert.ok(text.includes('播放控制'), 'the tab and page title read 播放控制')
  assert.ok(!text.includes('播放与音频'), 'the old tab name is gone')
}

// The source menu must not list local twice, and must not grow after the provider
// metadata arrives: known platforms are placeholders while the request is in flight.
{
  internals.onlineStore.set({ providers: { local: {}, netease: {}, qq: {}, kugouLite: {}, navidrome: {} }, providersPhase: 'loading' })
  const loadingSources = internals.p3SourceList()
  assert.equal(loadingSources.filter((item) => item.id === 'local').length, 1, 'local appears once')
  assert.ok(loadingSources.some((item) => item.id === 'bodian' && item.pending === true), 'known sources are placeholders while loading')
  internals.onlineStore.set({ providers: { local: {}, netease: {}, qq: {}, kugouLite: {}, navidrome: {}, bodian: {}, qishui: {} }, providersPhase: 'ready' })
  const readySources = internals.p3SourceList()
  assert.equal(readySources.filter((item) => item.id === 'local').length, 1, 'loaded providers never add a second local')
  assert.deepEqual(readySources.map((item) => item.id), ['local', 'netease', 'qq', 'kugouLite', 'navidrome', 'bodian', 'qishui'])
}

internals.p3RouteStore.set({ source: 'netease', page: 'recent', param: null, filter: null, query: '', history: [], scroll: {} })
internals.onlineStore.set({
  provider: 'netease', phase: 'ready', providers: { netease: { loggedIn: true, nickname: 'Tester', vip: true, vipExpiresAt: '2027-01-01', capabilities: { recent: true, userPlaylists: true, searchAlbums: true, search: true, recommendations: true, userCloud: true, listeningRank: true } } },
  history: [{ provider: 'netease', id: '42', title: 'Online Song', artist: 'Online Artist', album: 'Online Album', durationSec: 210, coverUrl: '', qualityHint: '', playedAt: Date.now() }],
})
const onlineTree = panel()
const onlineText = textOf(onlineTree)
assert.ok(onlineText.includes('Online Song'), 'online history rows render')
assert.ok(classesOf(onlineTree).has('mpv3-source-avatar'), 'platform and account share one avatar control')
assert.ok(classesOf(onlineTree).has('mpv3-source-badge'), 'the platform logo badges the account avatar')
assert.ok(classesOf(onlineTree).has('mp-provider-logo'), 'the platform logo image is rendered')
assert.ok(classesOf(onlineTree).has('mpv3-source-vip'), 'the account VIP badge is shown')
const neteaseTabs = internals.p3Tabs('netease')
assert.ok(neteaseTabs.indexOf('playlists') >= 0, 'online tabs expose playlists')
assert.ok(neteaseTabs.indexOf('playlists') < neteaseTabs.indexOf('recent'), 'playlists come before recent')
assert.ok(neteaseTabs.indexOf('discover') >= 0, 'recommendation-capable sources expose Discover')
assert.ok(neteaseTabs.indexOf('cloud') >= 0, 'cloud-capable sources expose Cloud')
internals.p3SwitchSource('netease')
assert.equal(internals.p3BrowseStore.get().tab, 'playlists', 'online sources default to playlists')
internals.p3SwitchSource('local')
assert.ok(!classesOf(onlineTree).has('mpv3-account-btn'), 'the separate account button is gone')

internals.onlineStore.set({
  provider: 'netease', phase: 'ready', searchTotal: 1, searchPage: 1,
  providers: { netease: { loggedIn: true, capabilities: { recent: true, searchAlbums: true, searchPlaylists: true, search: true } } },
  results: [{ provider: 'netease', id: '42', title: 'Online Song', artist: 'Online Artist', album: 'Online Album', durationSec: 210, coverUrl: '', qualityHint: '' }],
})
internals.p3RouteStore.set({ source: 'netease', page: 'search', param: null, filter: null, query: 'Online', history: [], scroll: {} })
const onlineSearch = panel()
assert.ok(classesOf(onlineSearch).has('mpv3-search-artist'), 'online search puts the best artist first')
assert.ok(!classesOf(onlineSearch).has('mpv3-search-kinds'), 'online search has no kind tabs')
assert.ok(textOf(onlineSearch).includes('Online Song'), 'online song search renders results')

internals.p3RouteStore.set({ source: 'local', page: 'songs', filter: null, query: '', history: [], scroll: {} })

// Play the middle track. Folia's queue is the whole queue in order, the playing row marked
// where it stands: everything already played must still be there (the list used to drop it).
internals.player.playList(TRACKS, 1)
const queueTree = internals.P3Queue({
  open: true,
  onClose: function () {},
  onLocate: function () {},
})
assert.ok(classesOf(queueTree).has('mpv3-queue'), 'queue popover renders')
const queueRows = nodesWithClass(queueTree, 'mpv3-queue-row')
const rowNames = queueRows.map((row) => textOf(nodesWithClass(row, 'mpv3-queue-name')[0]).trim())
assert.deepEqual(rowNames, ['Alpha', 'Beta', 'Gamma'], 'the whole queue renders in play order, played rows included')
const currentRow = queueRows.filter((row) => String(row.props.className).includes('is-cur'))
assert.equal(currentRow.length, 1, 'exactly one current row')
assert.equal(textOf(nodesWithClass(currentRow[0], 'mpv3-queue-name')[0]).trim(), 'Beta', 'the current row is the one playing')
// Row numbers are the queue positions, so the played rows above keep their place.
const rowIndices = queueRows.map((row) => textOf(nodesWithClass(row, 'mpv3-queue-idx')[0]).trim())
assert.deepEqual(rowIndices, ['1', '', '3'], 'positions stay, the playing row shows a wave instead')
// The playing row's index is live bars, not a number: it says which row is sounding.
const currentIdx = nodesWithClass(currentRow[0], 'mpv3-queue-idx')[0]
const currentWave = nodesWithClass(currentIdx, 'mpv3-queue-wave')[0]
assert.ok(currentWave, 'the playing row shows a wave instead of its number')
const waveBars = (Array.isArray(currentWave.children) ? currentWave.children : []).flat()
assert.equal(waveBars.length, 4, 'the wave has one bar per band')
assert.equal(waveBars[0].type, 'i', 'each band is a bar element')
assert.equal(textOf(currentIdx).trim(), '', 'no number is left behind the wave')
assert.ok(!textOf(queueTree).includes('接下来播放'), 'no split section that hides what was played')
// The player page keeps its own queue popover: opening it must not leave the page,
// and it must be the same queue surface, anchored to the control that opened it.
const npQueueTree = internals.NowPlaying({
  open: true,
  queueOpen: true,
  favoriteSet: new Set(),
  onToggleQueue: function () {},
  onClose: function () {},
  onLocate: function () {},
  onHome: function () {},
  onOpenSettings: function () {},
})
const npQueue = nodesWithClass(npQueueTree, 'mpv3-queue')[0]
assert.ok(npQueue, 'the player page renders the queue')
assert.ok(String(npQueue.props.className).includes('is-floating'), 'it floats over the page')
assert.ok(/px$/.test(String(npQueue.props.style.right)), 'it is anchored at explicit coordinates')
const npClosed = internals.NowPlaying({
  open: true,
  queueOpen: false,
  favoriteSet: new Set(),
  onToggleQueue: function () {},
  onClose: function () {},
  onLocate: function () {},
  onHome: function () {},
  onOpenSettings: function () {},
})
assert.equal(nodesWithClass(npClosed, 'mpv3-queue').length, 0, 'the queue is absent until asked for')

const removeButtons = nodesWithClass(queueTree, 'mpv3-queue-remove')
assert.ok(removeButtons.length > 0, 'queue rows expose a remove action')
const queueBefore = internals.player.getSnapshot().queue.length
removeButtons[0].props.onClick({ stopPropagation: function () {} })
assert.equal(internals.player.getSnapshot().queue.length, queueBefore - 1, 'remove action drops one queue row')

internals.openP3Playlist('create')
const playlistDialog = internals.P3PlaylistDialogHost()
assert.ok(classesOf(playlistDialog).has('mp-overlay'), 'playlist dialog renders through the kit modal')
assert.ok(textOf(playlistDialog).includes('新建歌单'), 'playlist dialog shows its title')
internals.closeP3Playlist()

internals.overlayStore.set({ layers: [{ kind: 'menu', props: { track: TRACKS[0], x: 40, y: 40 } }] })
assert.ok(classesOf(panel()).has('mp-ctx'), 'the context menu renders')

internals.overlayStore.set({ layers: [{ kind: 'settings', props: {} }] })
assert.ok(classesOf(panel()).has('mp-sheet'), 'the settings sheet renders')

// Folia's audio effect window, opened from the control tab's 「音频效果器」 tile.
internals.overlayStore.set({ layers: [{ kind: 'equalizer', props: {} }] })
const eqWindow = panel()
const eqClasses = classesOf(eqWindow)
assert.ok(eqClasses.has('mp-eqwin'), 'the audio effect window renders')
assert.equal(nodesWithClass(eqWindow, 'mp-eqwin-chip').length, 9, 'six built-in presets, the device preset tab and two custom slots')
assert.equal(nodesWithClass(eqWindow, 'mp-eq-fader').length, 10, 'ten band faders')
assert.ok(textOf(eqWindow).includes('频段增益'), 'the band section is titled')
assert.ok(textOf(eqWindow).includes('效果链'), 'the effect chain is titled')
// A chip writes its preset and switches processing on.
nodesWithClass(eqWindow, 'mp-eqwin-chip')[2].props.onClick()
assert.equal(internals.player.getEq().preset, 'radio', 'a chip applies its preset')
assert.equal(internals.player.getEq().enabled, true, 'a chip switches processing on')
// A band edit lands in the first custom slot (Folia's writeCustomDraft).
const fader = nodesWithClass(panel(), 'mp-eq-fader')[0]
const bandInput = (fader.children || []).find((child) => child && child.type === 'input')
assert.ok(bandInput, 'a band fader has its range input')
bandInput.props.onChange({ target: { value: '6' } })
const afterEdit = internals.player.getEq()
assert.equal(afterEdit.preset, 'custom1', 'an edit goes into the first custom slot')
assert.equal(afterEdit.enabled, true, 'an edit switches processing on')
assert.equal(afterEdit.bands[0], 6, 'the band takes the new gain')
// The panel reads prefs: the same store must hold the edit, or the sliders would sit still
// while the engine played the new sound (the two-evaluation case is guarded by the reload).
assert.equal(internals.prefsStore.get().eqBands[0], 6, 'the edit reaches the prefs store the panel reads')
// Reset clears the chosen custom slot only.
const resetButton = nodesWithClass(panel(), 'mp-eqwin-reset')[0]
resetButton.props.onClick()
assert.equal(internals.player.getEq().bands[0], 0, 'reset clears the custom slot')
assert.equal(internals.player.getEq().preset, 'custom1', 'reset keeps the chosen custom slot')

internals.overlayStore.set({ layers: [] })

internals.p3SelectBrowseTab('songs')
internals.p3OpenSearch()
internals.p3SetSearchQuery('Alpha')
assert.equal(internals.p3RouteStore.get().page, 'search', 'typing opens the search view')
assert.ok(!classesOf(internals.P3Shell()).has('mpv3-tabs'), 'search view hides the library tabs')

internals.p3PushCollection({ type: 'artist', source: 'local', id: 'Artist A', param: 'Artist A', name: 'Artist A', artist: 'Artist A' })
assert.equal(internals.p3RouteStore.get().page, 'artist', 'artist detail is a collection layer')
assert.ok(internals.p3CanGoBack(), 'a collection layer can go back')
assert.ok(!classesOf(internals.P3Shell()).has('mpv3-tabs'), 'detail view hides the library tabs')
const detailBack = nodesWithClass(internals.P3Shell(), 'mpv3-back-btn')[0]
assert.ok(detailBack, 'detail view has a back control')
assert.ok(textOf(detailBack).includes('返回'), 'the back control has a visible label')
assert.notEqual(detailBack.props.disabled, true, 'detail back control is enabled')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'search', 'back from detail restores search')
assert.equal(internals.p3RouteStore.get().query, 'Alpha', 'back from detail keeps the search query')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'songs', 'back from search restores browse')

internals.p3OpenSearch()
internals.p3SetSearchQuery('Alpha')
internals.p3SetSearchQuery('')
assert.equal(internals.p3RouteStore.get().page, 'songs', 'deleting the whole query exits search')
assert.equal(internals.p3SearchStore.get().open, false, 'empty search does not leave a blank overlay')

internals.p3SelectBrowseTab('albums')
assert.ok(textOf(internals.P3Shell()).includes('Album One'), 'albums tab lists every album')
internals.p3PushCollection({ type: 'album', source: 'local', id: 'Artist A|Album One', param: 'Artist A|Album One', name: 'Album One', artist: 'Artist A' })
assert.equal(internals.p3RouteStore.get().page, 'album', 'album detail opens from the albums tab')
assert.ok(!classesOf(internals.P3Shell()).has('mpv3-tabs'), 'album detail hides the library tabs')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'albums', 'album detail returns to the full album grid')

internals.p3OpenSearch()
internals.p3SetSearchQuery('Alpha')
internals.p3PushCollection({ type: 'artist', source: 'local', id: 'Artist A', param: 'Artist A', name: 'Artist A', artist: 'Artist A' })
const savedNav = JSON.parse(window.localStorage.getItem('music.ui.v4'))
assert.equal(savedNav.v, 4, 'navigation snapshot is versioned')
assert.equal(savedNav.collection.origin, 'search', 'collection remembers search as its origin')
assert.equal(savedNav.search.open, true, 'search overlay stays open under a collection')
internals.p3InitNav()
assert.equal(internals.p3RouteStore.get().page, 'artist', 'v4 restores the collection layer')
assert.equal(internals.p3RouteStore.get().query, '', 'collection projection has no search query')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'search', 'restored collection returns to search')
assert.equal(internals.p3RouteStore.get().query, 'Alpha', 'restored search keeps the submitted query')
internals.p3SelectBrowseTab('songs')

const multiArtistRow = internals.P3Row({
  track: { path: 'online:test:1', title: 'Multi', artist: '周杰伦 / 李硕 / 张鑫', album: 'Live', durationSec: 120, onlineProvider: 'kugouLite', id: '1' },
  index: 0,
  list: [],
  currentPath: '',
  playing: false,
  favoriteSet: {},
  selected: false,
  tabIndex: -1,
})
assert.equal(nodesWithClass(multiArtistRow, 'mpv3-artist-link').length, 3, 'each artist gets its own hover link')

window.localStorage.setItem('music.ui.v3', JSON.stringify({ source: 'local', page: 'album', param: 'Artist A|Album One' }))
window.localStorage.removeItem('music.ui.v4')
internals.p3InitNav()
assert.equal(internals.p3RouteStore.get().page, 'album', 'v3 detail routes migrate into the collection stack')
assert.equal(internals.p3BrowseStore.get().tab, 'albums', 'v3 detail keeps its parent tab')
internals.p3GoBack()
assert.equal(internals.p3RouteStore.get().page, 'albums', 'migrated collection returns to its parent tab')
window.localStorage.removeItem('music.ui.v3')
internals.p3SelectBrowseTab('songs')

// Recent rows expose the existing history removal through the context menu.
const pagesSource = readFileSync(new URL('../../src/client/panel-v3/p3-pages.js', import.meta.url), 'utf8')
const coreSource = readFileSync(new URL('../../src/client/panel-v3/p3-core.js', import.meta.url), 'utf8')
const stylesSource = readFileSync(new URL('../../src/client/panel-v3/p3-styles.js', import.meta.url), 'utf8')
assert.match(pagesSource, /onRemove: removeRecent/, 'recent page passes its remove handler to P3List')
assert.match(pagesSource, /removeHistory\(\{ provider: track\.onlineProvider, id: track\.onlineId \}\)/, 'recent remove uses the shared history store')
assert.match(coreSource, /p3OpenTrackMenu\(track, event, props\.list, props\.onRemove\)/, 'row context menu carries the remove action')
assert.match(coreSource, /onRemove: function \(\) \{ onRemove\(track\) \}/, 'menu action is bound to the row track')
// The virtualizer and the CSS must carry the same 76px row height (90% of 84,
// rounded to a whole pixel for the absolutely positioned virtual rows).
assert.match(coreSource, /var rowHeight = 76/, 'virtual list row height is 76px')
assert.match(stylesSource, /height: 76px;/, 'row CSS height matches the virtualizer')
assert.match(stylesSource, /\.mpv3-row-cover \{ width: 54px; height: 54px;/, 'row cover is scaled with the row')
assert.match(stylesSource, /\.mpv3-row-title \{[^}]*font-size: 18px; line-height: 27px;/, 'row title is scaled with the row')
assert.match(stylesSource, /grid-template-columns: 54px minmax\(0, 1\.6fr\) minmax\(0, 1fr\) 86px 120px;/, 'row grid columns are scaled with the row')
assert.match(stylesSource, /\.mpv3-row-acts \.mp-iconbtn \{ width: 38px; height: 38px;/, 'row actions are scaled with the row')
assert.match(coreSource, /iconSize: 21/, 'row cover icon scales with the cover')
assert.doesNotMatch(stylesSource, /max-width: 1280px/, 'list no longer centres a 1280px island')
assert.doesNotMatch(stylesSource, /scrollbar-gutter: stable/, 'no reserved right gutter')

// 右键 → 详细信息（issue #25）：菜单打开的面板读库里完整记录，而不是只带 path 的
// 收藏/歌单快照；路径、大小、专辑都要真的渲染出来。
internals.overlayStore.set({ layers: [{ kind: 'details', props: { track: { path: 'D:/Music/a.mp3', title: 'Alpha' } } }] })
const detailsTree = panel()
const detailsClasses = classesOf(detailsTree)
assert.ok(detailsClasses.has('mp-detail'), 'the details dialog renders its field list')
assert.ok(detailsClasses.has('mp-detail-row'), 'the field rows render')
assert.ok(detailsClasses.has('mp-detail-link'), 'the path renders as the reveal control')
const detailsText = textOf(detailsTree)
assert.ok(detailsText.includes('D:/Music/a.mp3'), 'the path row shows the file path from the library record')
assert.ok(detailsText.includes('1000 B'), 'the size row comes from the stat, not the snapshot')
assert.ok(detailsText.includes('Album One'), 'the album comes from the library record')
internals.overlayStore.set({ layers: [] })

console.log('panel.render.test.mjs ok')
