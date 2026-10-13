/** Font files bundled by Metro resolve to an asset id. */
declare module '*.woff2' {
  const asset: number;
  export default asset;
}
