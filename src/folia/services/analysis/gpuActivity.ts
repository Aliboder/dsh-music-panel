// Plugin shim: no GPU analysis service yet; Machi keeps its non-analysis path.
export const isGpuAnalysisActive = (_now: number): boolean => false
