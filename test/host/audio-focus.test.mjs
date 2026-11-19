/**
 * Audio focus: Folia's microphone ConsentStore parser/debounce and the ducking
 * registry other plugins use. No real Windows registry or audio device is touched.
 */

import assert from 'node:assert/strict'
import {
  createAudioFocusService,
  createVoiceInputMonitor,
  isOwnProcessKey,
  parseMicrophoneConsentStoreInUse,
} from '../../src/host/services/audio-focus.js'

const REG_OUTPUT = [
  'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\\C:#Program Files#Other#voice.exe',
  '    LastUsedTimeStart    REG_QWORD    0x1',
  '    LastUsedTimeStop    REG_QWORD    0x0',
].join('\r\n')

assert.equal(parseMicrophoneConsentStoreInUse(REG_OUTPUT), true, 'an open capture is active')
assert.equal(
  parseMicrophoneConsentStoreInUse(REG_OUTPUT, 'C:\\Program Files\\Other\\voice.exe'),
  false,
  'the caller can exclude its own executable',
)
assert.equal(
  parseMicrophoneConsentStoreInUse(
    'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\\C:#Other#idle.exe\r\n    LastUsedTimeStart    REG_QWORD    0x1\r\n    LastUsedTimeStop    REG_QWORD    0x2',
  ),
  false,
  'a stopped capture is idle',
)
assert.equal(parseMicrophoneConsentStoreInUse(''), false)
assert.equal(isOwnProcessKey('HKEY_CURRENT_USER\\...\\NonPackaged\\C:#App#app.exe', 'C:\\App\\app.exe'), true)

// Folia's debounce: two samples to start, three to stop.
{
  const samples = [false, true, true, true, false, false, false]
  const changes = []
  const monitor = createVoiceInputMonitor({
    isSupported: true,
    isEnabled: () => true,
    queryInUse: async () => samples.shift(),
    onState: (active) => changes.push(active),
  })
  await monitor.pollNow()
  await monitor.pollNow()
  assert.deepEqual(changes, [], 'one active sample is not enough')
  await monitor.pollNow()
  assert.deepEqual(changes, [true], 'the second active sample starts the pause')
  await monitor.pollNow()
  await monitor.pollNow()
  await monitor.pollNow()
  assert.deepEqual(changes, [true], 'three idle samples are required to resume')
  await monitor.pollNow()
  assert.deepEqual(changes, [true, false], 'the third idle sample resumes')
  monitor.stop()
}

// Ducking is independent of the Windows mic monitor and carries a TTL so a
// crashed TTS caller cannot leave the player quiet forever.
{
  let clock = 1000
  const service = createAudioFocusService({
    platform: 'win32',
    now: () => clock,
    queryInUse: async () => false,
  })
  assert.equal(service.status().supported, true)
  assert.equal(service.status().duck.active, false)

  service.beginDuck({ reason: 'tts', level: 0.25, fadeMs: 400, ttlMs: 5000 })
  const ducked = service.status()
  assert.equal(ducked.duck.active, true)
  assert.equal(ducked.duck.level, 0.25)
  assert.equal(ducked.duck.fadeMs, 400)
  assert.deepEqual(ducked.duck.reasons, ['tts'])

  service.beginDuck({ reason: 'voice-preview', level: 0.5, fadeMs: 100, ttlMs: 5000 })
  assert.equal(service.status().duck.level, 0.25, 'the strongest duck wins')

  clock += 6000
  assert.equal(service.status().duck.active, false, 'expired ducks do not stick')

  service.beginDuck({ reason: 'tts', level: 0.2 })
  service.endDuck('tts')
  assert.equal(service.status().duck.active, false)
  service.dispose()
}

console.log('audio-focus.test.mjs ok')
