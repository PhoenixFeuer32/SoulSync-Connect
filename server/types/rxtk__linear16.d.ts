declare module '@rxtk/linear16' {
  export class MulawDecoder {
    constructor();
    decode(buffer: Buffer): Buffer;
  }
}
