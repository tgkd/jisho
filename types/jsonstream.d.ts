declare module 'JSONStream' {
  import { Transform } from 'stream';

  interface JSONStreamModule {
  parse(pattern?: string | RegExp | (string | number)[]): Transform;
    stringify(open?: string, sep?: string, close?: string): Transform;
  }

  const JSONStream: JSONStreamModule;
  export default JSONStream;
}
