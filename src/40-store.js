/**
 * store: the smallest possible subscription store used by every view.
 *
 * No React context: views read a module-level store through `useStore`, which
 * keeps the panel a single tree and avoids provider plumbing.
 */

function createStore(initial) {
  var state = initial
  var listeners = []
  return {
    get: function () {
      return state
    },
    set: function (patch) {
      var next = typeof patch === 'function' ? patch(state) : Object.assign({}, state, patch)
      if (next === state) return state
      state = next
      listeners.slice().forEach(function (fn) {
        try {
          fn(state)
        } catch (error) {
          // A broken listener must not stop the others.
        }
      })
      return state
    },
    subscribe: function (fn) {
      listeners.push(fn)
      return function () {
        var at = listeners.indexOf(fn)
        if (at >= 0) listeners.splice(at, 1)
      }
    },
  }
}

function useStore(store) {
  var pair = useState(store.get())
  var state = pair[0]
  var setState = pair[1]
  useEffect(
    function () {
      setState(store.get())
      return store.subscribe(setState)
    },
    [store],
  )
  return state
}
