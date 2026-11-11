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

