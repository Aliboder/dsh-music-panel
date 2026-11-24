// Plugin shim: the Machi renderer assumes Folia's player view; the plugin only mounts it there.
const STATE = { view: 'player' as const }
export const useAppViewStore = <T,>(selector?: (state: typeof STATE) => T): T => (
    typeof selector === 'function' ? selector(STATE) : STATE as unknown as T
)
useAppViewStore.getState = () => STATE
