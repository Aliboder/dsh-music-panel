/**
 * In-view search (issue #13): the content header magnifier opens its own field
 * and filters the list below, instead of jumping to the global online search.
 *
 * The matching rules are pure (src/44-filter.js), so they are tested directly.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const source = readFileSync(join(root, 'src/44-filter.js'), 'utf8')
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

// Wiring: the header owns an inline field, the list consumes the query.
const header = readFileSync(join(root, 'src/ui/16-header.js'), 'utf8')
assert.match(header, /mp-head-search/, 'the header renders an inline search field')
assert.match(header, /setContentFilter/, 'typing updates the in-view filter')
assert.doesNotMatch(header, /focusGlobalSearch/, 'the magnifier no longer jumps to the global search box')
assert.match(header, /clearContentFilter/, 'leaving the view clears the filter')

const list = readFileSync(join(root, 'src/ui/02-track-row.js'), 'utf8')
assert.match(list, /filterTracksByQuery/, 'the list applies the in-view filter')
assert.match(list, /page\.filterEmpty/, 'a filtered-out list explains itself')

const store = readFileSync(join(root, 'src/40-store.js'), 'utf8')
assert.match(store, /contentFilterStore/, 'the filter lives in its own tiny store')

const theme = readFileSync(join(root, 'src/90-theme.js'), 'utf8')
assert.match(
  theme,
  /\.mp-head-search\{[^']*box-sizing:border-box[^']*height:30px/,
  'the search box must not change the header height (border-box, same 30px)',
)

const build = readFileSync(join(root, 'scripts/build-client.mjs'), 'utf8')
assert.match(build, /src\/44-filter\.js/, 'the filter fragment is part of the bundle')

console.log('in-view-search.test.mjs ok')
