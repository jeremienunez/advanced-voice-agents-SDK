export class AudioBuffer {
  private chunks: Buffer[] = [];
  private _sequenceNumber = 0;

  append(chunk: Buffer): void {
    this.chunks.push(chunk);
  }

  flush(): Buffer {
    if (this.chunks.length === 0) {
      return Buffer.alloc(0);
    }
    const combined = Buffer.concat(this.chunks);
    this.chunks = [];
    return combined;
  }

  clear(): void {
    this.chunks = [];
  }

  get size(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.length, 0);
  }

  get chunkCount(): number {
    return this.chunks.length;
  }

  get isEmpty(): boolean {
    return this.chunks.length === 0;
  }

  nextSequence(): number {
    return this._sequenceNumber++;
  }

  resetSequence(): void {
    this._sequenceNumber = 0;
  }

  get currentSequence(): number {
    return this._sequenceNumber;
  }
}
