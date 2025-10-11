declare module '@rxtk/linear16' {
  class MulawDecoder {
    constructor();
    decode(buffer: Buffer): Buffer;
  }

  const pkg: {
    MulawDecoder: typeof MulawDecoder;
  };

  export default pkg;
}
