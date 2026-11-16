/**
 * 文本类渲染器 — kept for the legacy text variants; 静止/倾诉/浮名/群唱 now come from
 * the verbatim Folia styles in `src/render/styles/folia-styles.js`.
 */

function mpTextLines(props, styleId, decorate) {  var lines = Array.isArray(props.lines) ? props.lines : []
  var active = Number(props.active)
  var now = Number(props.now) || 0
  return h(
    'div',
    { className: 'mp-np-lyrics mp-style-' + styleId + ' is-full', ref: props.boxRef },
    h(
      'div',
      { className: 'mp-np-lyrics-inner', ref: props.innerRef },
      lines.map(function (line, index) {
        var isActive = index === active
        return h(
          'div',
          {
            key: String(index),
            ref: function (element) {
              if (Array.isArray(props.rowRefs)) props.rowRefs[index] = element
            },
            className: 'mp-np-line' + (isActive ? ' is-active' : '') + (active >= 0 && index < active ? ' is-past' : ''),
            style: { '--mp-line-stagger': String(Math.min(Math.abs(index - (active >= 0 ? active : 0)), 8)) },
            onClick: function () {
              if (typeof props.onSeekLine === 'function') props.onSeekLine(line, index)
            },
          },
          h(
            'div',
            { className: 'mp-np-line-text' },
            decorate === null
              ? line.text
              : (function () {
                  var spans = typeof props.wordSpans === 'function' ? props.wordSpans(line, now) : null
                  if (!isActive || spans === null) return line.text
                  return spans.map(function (word, wordIndex) {
                    return h(
                      'span',
                      {
                        key: 'w' + String(wordIndex),
                        className: 'mp-np-word' + (word.sung ? ' is-sung' : ''),
                        style: { '--mp-word-i': String(wordIndex) },
                      },
                      word.text,
                    )
                  })
                })(),
          ),
          line.translation
            ? h('div', { className: 'mp-np-line-trans', 'aria-hidden': isActive ? 'false' : 'true' },
                h('span', { className: 'mp-np-line-trans-inner' }, h('span', { className: 'mp-np-line-trans-text' }, line.translation)))
            : null,
        )
      }),
    ),
  )
}
