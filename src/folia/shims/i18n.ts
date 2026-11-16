// src/render/folia/shims/i18n.ts
// Folia uses react-i18next; the plugin's t() lives in the client factory. The ported
// renderers only use t() for optional labels, so identity is a safe boundary.

export const useTranslation = () => ({
    t: (key: string) => key,
    i18n: { language: 'zh', changeLanguage: async () => undefined },
});

export const Trans = (props: { children?: unknown }) => (props && props.children) || null;

export default { t: (key: string) => key, language: 'zh' };
