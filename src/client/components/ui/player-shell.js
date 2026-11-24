/**
 * Folia PanelShell base — the card surface, its backdrop catcher and motion.
 *
 * Ported from Folia: src/components/panelTab/shell/PanelShell.tsx
 * Adapted: surface colours and motion wiring use the plugin's DSH tokens;
 * the header/body/dock are supplied by player-sheet.
 */

var MP_PANEL_SHELL = {
  width: 360,
  topMargin: 56,
  padding: 12,
  dockHeight: 34,
  dockGap: 12,
  folded: 48,
  radius: 20,
  unfoldSeconds: 0.3,
  moveSeconds: 0.22,
  fastSeconds: 0.12,
}

function FoliaPanelShell(props) {
  var framer = props.framer || null
  var style = {
    position: 'absolute',
    right: props.right || '22px',
    bottom: props.bottom || '24px',
    width: String(MP_PANEL_SHELL.width) + 'px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: props.maxHeight || 'none',
    display: 'flex',
    flexDirection: 'column',
    padding: String(MP_PANEL_SHELL.padding) + 'px',
    borderRadius: 'var(--dsw-radius-xl,20px)',
    pointerEvents: 'auto',
    background: 'color-mix(in srgb, var(--dsw-alias-bg-layer-1, #232324) 95%, transparent)',
    backdropFilter: 'blur(40px) saturate(1.3)',
    border: 0,
    boxShadow: 'var(--dsw-elevation-prominent,0 30px 80px rgba(0,0,0,.55))' ,
    transformOrigin: 'calc(100% - 24px) calc(100% + 24px)',
    overflow: 'hidden',
  }
  var surfaceProps = framer
    ? {
        className: 'mp-card',
        initial: framer.enter,
        animate: Object.assign({}, framer.shown, { transition: framer.transition }),
        exit: Object.assign({}, framer.leave, { transition: framer.leaveTransition }),
        style: style,
        onClick: function (event) { event.stopPropagation() },
      }
    : {
        className: 'mp-card',
        style: Object.assign({}, style, {
          animation: 'mp-card-in ' + String(MP_PANEL_SHELL.unfoldSeconds) + 's cubic-bezier(.22,1,.36,1) backwards',
        }),
        onClick: function (event) { event.stopPropagation() },
      }
  var Surface = framer ? framer.surface : 'div'
  return h(
    'div',
    {
      className: 'mp-card-root',
      'data-card-motion': framer ? 'framer' : 'css',
      role: 'dialog',
      'aria-modal': 'false',
      style: { position: 'fixed', inset: '0', zIndex: String(MP_Z.page), pointerEvents: 'none' },
    },
    h('div', {
      className: 'mp-card-catcher',
      onClick: props.onClose,
      style: { position: 'absolute', inset: '0', pointerEvents: 'auto', background: 'transparent' },
    }),
    h(
      Surface,
      surfaceProps,
      h('style', null,
        '@keyframes mp-card-in{from{opacity:0;scale:.92}to{opacity:1;scale:1}}' +
          '@keyframes mp-page-in{from{opacity:0;transform:translateY(6px)}}',
      ),
      props.header,
      props.body,
      props.dock,
    ),
  )
}
