/**
 * 组件测试页示例（通用模板）。
 *
 * 每个用例 = 适配层名（data-adapter）+ 实际控件 + 可复制的调用代码。
 * 依赖：h / cx / t / hostComponent / IconButton / Button / Switch / KitInput /
 *       KitCheckbox / KitSegmented / KitSegmentedTabs / KitPill / KitTag /
 *       KitStateDot / KitModal / SetRow。
 */

var GALLERY_SECTIONS = [
  { key: 'buttons', labelKey: 'gallery.secButtons' },
  { key: 'form', labelKey: 'gallery.secForm' },
  { key: 'navigation', labelKey: 'gallery.secNav' },
  { key: 'overlays', labelKey: 'gallery.secOverlays' },
  { key: 'states', labelKey: 'gallery.secStates' },
]

/** 一个参考用例：适配层名、实际控件、可复制的调用。 */
function GalleryCase(props) {
  return h('div', {
    className: cx('ui-gallery-case', props.wide === true && 'is-wide'),
    'data-adapter': props.adapter || undefined,
  },
    h('div', { className: 'ui-gallery-case-title' }, props.title,
      props.adapter ? h('span', { className: 'ui-gallery-adapter' }, props.adapter) : null),
    h('div', { className: 'ui-gallery-row' }, props.children),
    props.code ? h('pre', { className: 'ui-gallery-code' }, h('code', null, props.code)) : null,
  )
}

function ComponentGallery(props) {
  var sectionPair = useState('buttons')
  var section = sectionPair[0]
  var setSection = sectionPair[1]
  var modalPair = useState(false)
  var modalOpen = modalPair[0]
  var setModalOpen = modalPair[1]
  var inputPair = useState('')
  var inputValue = inputPair[0]
  var setInputValue = inputPair[1]
  var switchPair = useState(true)
  var switchOn = switchPair[0]
  var setSwitchOn = switchPair[1]
  var checkPair = useState(true)
  var checked = checkPair[0]
  var setChecked = checkPair[1]
  var segmentPair = useState('all')
  var segmentValue = segmentPair[0]
  var setSegmentValue = segmentPair[1]
  var tabsPair = useState('one')
  var tabsValue = tabsPair[0]
  var setTabsValue = tabsPair[1]
  var hostKit = hostComponent('Button') !== null ? 'native' : 'fallback'

  var segmentOptions = [
    { value: 'all', label: t('gallery.all') },
    { value: 'active', label: t('gallery.active') },
    { value: 'done', label: t('gallery.done') },
  ]
  var tabItems = [
    { value: 'one', label: t('gallery.tabOne'), id: 'ui-gallery-tab-one', panelId: 'ui-gallery-panel-one' },
    { value: 'two', label: t('gallery.tabTwo'), id: 'ui-gallery-tab-two', panelId: 'ui-gallery-panel-two' },
  ]

  function buttonsSection() {
    return h('div', { className: 'ui-gallery-grid' },
      h(GalleryCase, {
        title: t('gallery.caseButton'),
        adapter: 'Button',
        code: "h(Button, { variant: 'primary' }, label)",
      }, h(Button, { variant: 'primary' }, t('gallery.primary')),
         h(Button, { variant: 'outline' }, t('gallery.outline')),
         h(Button, { variant: 'ghost' }, t('gallery.ghost'))),
      h(GalleryCase, {
        title: t('gallery.caseButtonSize'),
        adapter: 'Button',
        code: "h(Button, { size: 'md' }, label)",
      }, h(Button, { size: 'md' }, t('gallery.medium')),
         h(Button, { size: 'sm' }, t('gallery.small'))),
      h(GalleryCase, {
        title: t('gallery.caseDisabled'),
        adapter: 'Button',
        code: "h(Button, { disabled: true }, label)",
      }, h(Button, { disabled: true }, t('gallery.disabled')),
         h(Button, { variant: 'primary', disabled: true }, t('gallery.disabled'))),
      h(GalleryCase, {
        title: t('gallery.caseIconButton'),
        adapter: 'IconButton',
        code: "h(IconButton, { icon: 'play', title: label })",
      }, h(IconButton, { icon: 'play', title: t('gallery.iconButton') }),
         h(IconButton, { icon: 'more', title: t('gallery.iconButton'), active: true })),
    )
  }

  function formSection() {
    return h('div', { className: 'ui-gallery-grid' },
      h(GalleryCase, {
        title: t('gallery.caseInput'),
        adapter: 'KitInput',
        code: "h(KitInput, { value, placeholder, icon: 'search', label, onChange })",
      }, h(KitInput, { value: inputValue, placeholder: t('gallery.placeholder'),
        icon: 'search', label: t('gallery.caseInput'), onChange: setInputValue })),
      h(GalleryCase, {
        title: t('gallery.caseSwitch'),
        adapter: 'Switch',
        code: "h(Switch, { value, label, onChange })",
      }, h(Switch, { value: switchOn, label: t('gallery.caseSwitch'), onChange: setSwitchOn }),
         h(Switch, { value: false, label: t('gallery.caseSwitch'), disabled: true })),
      h(GalleryCase, {
        title: t('gallery.caseCheckbox'),
        adapter: 'KitCheckbox',
        code: "h(KitCheckbox, { checked, label, onChange })",
      }, h(KitCheckbox, { checked: checked, label: t('gallery.caseCheckbox'), onChange: setChecked })),
    )
  }

  function navigationSection() {
    return h('div', { className: 'ui-gallery-grid' },
      h(GalleryCase, {
        title: t('gallery.caseSegmented'),
        adapter: 'KitSegmented',
        code: "h(KitSegmented, { id, value, label, options, onChange })",
      }, h(KitSegmented, { id: 'gallery-segmented', value: segmentValue,
        label: t('gallery.caseSegmented'), options: segmentOptions, onChange: setSegmentValue })),
      h(GalleryCase, {
        title: t('gallery.caseTabs'),
        adapter: 'KitSegmentedTabs',
        code: "h(KitSegmentedTabs, { items, value, label, onChange })",
      }, h(KitSegmentedTabs, { items: tabItems, value: tabsValue,
        label: t('gallery.caseTabs'), onChange: setTabsValue })),
      h(GalleryCase, {
        title: t('gallery.caseTag'),
        adapter: 'KitTag',
        code: "h(KitTag, { tone: 'success' }, label)",
      }, h(KitTag, { tone: 'success' }, t('gallery.success')),
         h(KitTag, { tone: 'neutral' }, t('gallery.neutral')),
         h(KitTag, { tone: 'outline' }, t('gallery.outline'))),
    )
  }

  function overlaysSection() {
    return h('div', { className: 'ui-gallery-grid' },
      h(GalleryCase, {
        title: t('gallery.caseModal'),
        adapter: 'KitModal',
        code: "h(KitModal, { title, onClose, footer }, body)",
      }, h(Button, { onClick: function () { setModalOpen(true) } }, t('gallery.openModal'))),
      h(GalleryCase, {
        title: t('gallery.caseToast'),
        adapter: 'showToast',
        code: "showToast(text)",
      }, h(Button, { onClick: function () { showToast(t('gallery.toastText')) } },
        t('gallery.showToast'))),
    )
  }

  function statesSection() {
    return h('div', { className: 'ui-gallery-grid' },
      h(GalleryCase, {
        title: t('gallery.caseState'),
        adapter: 'KitStateDot',
        code: "h(KitStateDot, { state: 'done' })",
      }, h(KitStateDot, { state: 'done' }),
         h(KitStateDot, { state: 'warning' }),
         h(KitStateDot, { state: 'error' })),
      h(GalleryCase, {
        title: t('gallery.caseSpinner'),
        adapter: 'Spinner',
        code: "h(Spinner)",
      }, h(Spinner)),
      h(GalleryCase, {
        title: t('gallery.caseSetRow'),
        adapter: 'SetRow',
        code: "h(SetRow, { label, desc }, control)",
        wide: true,
      }, h(SetRow, { label: t('gallery.caseSetRow'), desc: t('gallery.caseSetRowDesc') },
        h(Button, null, t('gallery.action')))),
    )
  }

  function sectionBody() {
    if (section === 'form') return formSection()
    if (section === 'navigation') return navigationSection()
    if (section === 'overlays') return overlaysSection()
    if (section === 'states') return statesSection()
    return buttonsSection()
  }

  return h('div', { className: 'ui-gallery' },
    h('div', { className: 'ui-gallery-head' },
      h(IconButton, { icon: 'chevronLeft', title: t('gallery.back'), onClick: props.onClose }),
      h('div', { className: 'ui-gallery-title' }, t('gallery.title')),
      h('span', { className: 'ui-gallery-hint' }, t('gallery.usageHint')),
      h('span', { className: 'ui-gallery-hint' },
        t('gallery.hostKit') + ': ' + (hostKit === 'native' ? t('gallery.native') : t('gallery.fallback')))),
    h('div', { className: 'ui-gallery-body' },
      h('div', { className: 'ui-gallery-nav', role: 'tablist', 'aria-label': t('gallery.title') },
        GALLERY_SECTIONS.map(function (entry) {
          return h('button', {
            key: entry.key,
            type: 'button',
            role: 'tab',
            'aria-selected': section === entry.key ? 'true' : 'false',
            className: cx('ui-gallery-navbtn', section === entry.key && 'is-on'),
            onClick: function () { setSection(entry.key) },
          }, t(entry.labelKey))
        })),
      h('div', { className: 'ui-gallery-main', role: 'tabpanel' }, sectionBody())),
    modalOpen
      ? h(KitModal, {
          title: t('gallery.modalTitle'),
          onClose: function () { setModalOpen(false) },
          footer: [
            h(Button, { key: 'cancel', onClick: function () { setModalOpen(false) } },
              t('gallery.cancel')),
            h(Button, { key: 'ok', variant: 'primary', onClick: function () { setModalOpen(false) } },
              t('gallery.ok')),
          ],
        }, h('p', null, t('gallery.modalBody')))
      : null)
}
