/**
 * 在线平台底层换新的更新提示。
 *
 * 只显示给还没确认过本次换新的用户：勾选「不再显示」并点「我知道了」才记下；
 * 没勾就关掉的话，下次启动还会出现（需求就是必须手动勾选）。
 * 文案描述的是 DSH 宿主侧的底层替换：不彻底重启 + 重新登录会出现播放错误。
 */

// 换新标识：以后再有同类的底层替换，改这个 id 就会重新提示一次。
var ONLINE_RELAUNCH_NOTICE_ID = '2026-11-online-platforms'
var onlineRelaunchNoticeShown = false

function onlineRelaunchNoticeOpen(prefs) {
  if (onlineRelaunchNoticeShown) return false
  var ack = prefs && typeof prefs.onlineRelaunchNoticeAck === 'string' ? prefs.onlineRelaunchNoticeAck : ''
  if (ack === ONLINE_RELAUNCH_NOTICE_ID) return false
  onlineRelaunchNoticeShown = true
  return true
}

function OnlineRelaunchNotice(props) {
  var pair = useState(false)
  var dontShow = pair[0]
  var setDontShow = pair[1]
  var dontShowRef = useRef(false)

  function changeDontShow(next) {
    dontShowRef.current = next === true
    setDontShow(next === true)
  }

  useEffect(
    function () {
      if (props.open === true) changeDontShow(false)
    },
    [props.open],
  )

  if (props.open !== true) return null

  function done() {
    props.onDone(dontShowRef.current === true)
  }

  return h(
    KitModal,
    {
      title: t('notice.onlineRefreshTitle'),
      onClose: done,
      footer: h(Button, { variant: 'primary', onClick: done }, t('notice.gotIt')),
    },
    h(
      'div',
      { className: 'mp-online-refresh' },
      h('p', { style: { margin: '0 0 14px', lineHeight: '21px' } }, t('notice.onlineRefreshBody')),
      h(KitCheckbox, {
        checked: dontShow,
        label: t('notice.onlineRefreshDontShow'),
        onChange: changeDontShow,
      }),
    ),
  )
}
