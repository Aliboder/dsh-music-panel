/**
 * In-view search (issue #13): the content header magnifier opens its own field
 * and filters the list below, instead of jumping to the global online search.
 *
 * The matching rules are pure (src/client/components/library/filter.js), so they are tested directly.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const source = readFileSync(join(root, 'src/client/components/library/filter.js'), 'utf8')
const factory = new Function(`${source}
  return { matchesContentFilter, filterTracksByQuery, contentFilterText }`)
const filter = factory()

const songs = [
  { path: 'a', title: 'Blind Justice', artist: 'Zektbach', album: 'beatmania IIDX' },
  { path: 'b', title: 'Odd Dice', artist: 'millsage', album: 'Odd Dice' },
  { path: 'c', title: '开往早晨的午夜', artist: '张碧晨', album: '开往早晨的午夜' },
  { path: 'd', title: 'By Your Side.', artist: 'OMOCAT', album: 'Omori OST' },
]

// Title / artist / album all match, case-insensitively.
assert.equal(filter.matchesContentFilter(songs[0], 'blind'), true)
assert.equal(filter.matchesContentFilter(songs[0], 'ZEKTBACH'), true)
assert.equal(filter.matchesContentFilter(songs[0], 'iidx'), true)
assert.equal(filter.matchesContentFilter(songs[0], 'nothing'), false)
assert.equal(filter.matchesContentFilter(songs[2], '张碧晨'), true)
assert.equal(filter.matchesContentFilter(songs[2], '午夜'), true)

// Whitespace around the query is ignored; empty matches everything.
assert.equal(filter.matchesContentFilter(songs[1], '  odd  '), true)
assert.equal(filter.matchesContentFilter(songs[1], '   '), true)
assert.equal(filter.matchesContentFilter(null, 'odd'), false)

// The same array identity is returned when there is no query, so React does
// not see a new list on every render.
assert.equal(filter.filterTracksByQuery(songs, ''), songs)
assert.equal(filter.filterTracksByQuery(songs, '   '), songs)
assert.deepEqual(
  filter.filterTracksByQuery(songs, 'odd').map((track) => track.path),
  ['b'],
)
assert.deepEqual(
  filter.filterTracksByQuery(songs, 'omori').map((track) => track.path),
  ['d'],
)
assert.equal(filter.filterTracksByQuery(songs, 'zzz').length, 0)
assert.deepEqual(filter.filterTracksByQuery(null, 'x'), [])

// Wiring: typing enters the search page; the search page consumes the shared
// filter for local tracks and the online search endpoint.
const shell = readFileSync(join(root, 'src/client/panel-v3/p3-shell.js'), 'utf8')
assert.match(shell, /p3SetSearchQuery/, 'typing enters the search page')
assert.match(shell, /p3-search/, 'the top bar owns the search field')

const pages = readFileSync(join(root, 'src/client/panel-v3/p3-pages.js'), 'utf8')
assert.match(pages, /function P3SearchPage/, 'the search page exists')
assert.match(pages, /filterTracks\(p3LocalTracks/, 'local search uses the shared filter')
assert.match(pages, /searchOnline\(query\)/, 'online search uses the provider endpoint')

const build = readFileSync(join(root, 'src/client/manifest.json'), 'utf8')
assert.match(build, /src\/client\/components\/library\/filter\.js/, 'the filter fragment is part of the bundle')
assert.match(build, /src\/client\/panel-v3\/p3-pages\.js/, 'the v3 pages fragment is part of the bundle')

console.log('in-view-search.test.mjs ok')






