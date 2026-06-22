// Ambient declaration so TypeScript accepts side-effect CSS imports (e.g.
// `import './styles.css'`). Declared explicitly rather than via a triple-slash
// reference to vite/client, which the lint config disallows.
declare module '*.css' {}
