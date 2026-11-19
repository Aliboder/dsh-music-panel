# 音频焦点

音频焦点分两条独立链路：

1. **Folia 语音输入暂停**：Windows 上检测系统/其他应用的麦克风占用，暂停播放并在占用结束后恢复。
2. **TTS/语音插件避让**：外部插件通过窗口 API 或 HTTP 接口请求降低音乐音量，结束后恢复。

两条链路都不改动用户保存的音量；避让只作用于当前可听增益。

## 1. Folia 语音输入暂停

实现取自 Folia 的 voiceInputPause.cjs：

- 轮询注册表
  HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone
- 应用的 LastUsedTimeStart 非 0 且 LastUsedTimeStop 为 0 时视为正在采集；
- 默认每 1000ms 采样一次；
- 开始连续 2 次确认，停止连续 3 次确认，避免设备探测和句子间隙造成抖动；
- 只在「设置 → 播放 → 音频焦点 → 语音输入时暂停播放」开启时轮询；
- 播放器只在原本正在播放、且有歌曲时暂停；只有这次暂停是语音输入造成的，才在结束后恢复。用户手动暂停不会被覆盖。

与 Folia 的差异：

- Folia 在 Electron 主进程通过 IPC 推送给渲染进程；本插件 Host 是独立 Node 进程，浏览器半通过 /music/audio-focus/status 轮询。
- Folia 排除自身可执行文件（它会打开麦克风枚举设备）；本插件不采集麦克风，**故意不排除 DSH 进程**，这样 DSH 自己的语音输入也能触发暂停。
- 仅在 Windows 生效；其他平台上设置项显示不可用。

## 2. TTS / 语音预览避让

同一窗口中的 Client 插件可以直接调用：

    window.__dshMusicAudioFocus.begin('tts', {
      level: 0.3,
      fadeMs: 300,
      ttlMs: 60000
    })

    window.__dshMusicAudioFocus.end('tts')

- level：避让后的剩余音量，0 到 1；默认取设置里的「避让后音量」；
- fadeMs：降低/恢复的渐变时间，默认取设置里的「渐变时间」；
- ttlMs：安全超时；即使调用方崩溃没有 end，也会在超时后自动恢复；
- 多个 reason 同时存在时取最低音量；
- 只改变当前增益，不写入用户保存的音量。

跨进程或不愿依赖窗口全局时，可用 Host 路由：

    POST /music/audio-focus/duck
    Content-Type: application/json

    {"reason":"tts","active":true,"level":0.3,"fadeMs":300,"ttlMs":60000}

    POST /music/audio-focus/duck
    {"reason":"tts","active":false}

接口仅接受本机、同源请求。查询状态：

    GET /music/audio-focus/status

返回 supported、voiceInputPause、voiceInputActive、duck。

**边界：音乐插件不会嗅探其他插件的音频输出。** TTS 插件需要显式调用上面的 API；这是 Folia 没有提供、由本插件补充的跨插件契约。没有调用方的避让不会发生。

## 3. 设置

设置 → 播放 → 音频焦点：

- 语音输入时暂停播放（默认关闭，Windows）；
- 外部语音避让（默认开启）；
- 避让后音量（默认 30%）；
- 渐变时间（默认 300ms，0 为立即切换）。

## 4. 测试

- test/host/audio-focus.test.mjs：注册表解析、2/3 次去抖、避让 TTL；
- test/integration/runtime.test.mjs：/music/audio-focus/status、config、duck 路由；
- test/client/settings-data.test.mjs：设置项与默认值防止被删。
