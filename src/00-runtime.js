/**
 * runtime: React bindings, plugin constants.
 *
 * Every other fragment runs in the same factory scope, so these names are
 * shared by all of them; the build script fails on duplicate declarations.
 */

var React = require('react')
var h = React.createElement
var useState = React.useState
var useEffect = React.useEffect
var useRef = React.useRef
var useMemo = React.useMemo
var useCallback = React.useCallback
var useLayoutEffect = React.useLayoutEffect || React.useEffect

var PANEL_ID = 'music'
var PREFS_EVENT = 'dsh-music:prefs-changed'
