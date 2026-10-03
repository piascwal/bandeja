/** Écriture d'un message binaire de taille fixe connue d'avance (little-endian). */
export class Ecrivain {
  private readonly vue: DataView;
  private pos = 0;

  constructor(taille: number) {
    this.vue = new DataView(new ArrayBuffer(taille));
  }

  u8(v: number): this {
    this.vue.setUint8(this.pos++, Math.max(0, Math.min(255, Math.round(v))));
    return this;
  }

  i8(v: number): this {
    this.vue.setInt8(this.pos++, Math.max(-128, Math.min(127, Math.round(v))));
    return this;
  }

  u16(v: number): this {
    this.vue.setUint16(this.pos, Math.max(0, Math.min(65535, Math.round(v))), true);
    this.pos += 2;
    return this;
  }

  f32(v: number): this {
    this.vue.setFloat32(this.pos, v, true);
    this.pos += 4;
    return this;
  }

  /** Les huit drapeaux d'un octet, du premier (bit 0) au dernier. */
  bits(...b: boolean[]): this {
    return this.u8(b.reduce((n, x, i) => n | (x ? 1 << i : 0), 0));
  }

  fin(): ArrayBuffer {
    return this.vue.buffer as ArrayBuffer;
  }
}

/** Message tronqué ou valeur hors limites : le paquet est ignoré en entier. */
export class MessageInvalide extends Error {}

/** Lecture d'un message binaire reçu du réseau : tout ce qui sort des limites lève `MessageInvalide`. */
export class Lecteur {
  private readonly vue: DataView;
  private pos = 0;

  constructor(buf: ArrayBuffer) {
    this.vue = new DataView(buf);
  }

  private suivant(n: number): number {
    if (this.pos + n > this.vue.byteLength) throw new MessageInvalide('message trop court');
    const p = this.pos;
    this.pos += n;
    return p;
  }

  u8(): number {
    return this.vue.getUint8(this.suivant(1));
  }

  i8(): number {
    return this.vue.getInt8(this.suivant(1));
  }

  u16(): number {
    return this.vue.getUint16(this.suivant(2), true);
  }

  /** Un flottant fini et de grandeur raisonnable (jamais NaN ni Infinity). */
  f32(max = 1e5): number {
    const v = this.vue.getFloat32(this.suivant(4), true);
    if (!Number.isFinite(v) || Math.abs(v) > max) throw new MessageInvalide('valeur hors limites');
    return v;
  }

  bits(): boolean[] {
    const n = this.u8();
    return Array.from({ length: 8 }, (_, i) => (n & (1 << i)) !== 0);
  }

  /** Un indice dans une liste de `n` valeurs. */
  enumere(n: number): number {
    const v = this.u8();
    if (v >= n) throw new MessageInvalide('indice hors liste');
    return v;
  }

  /** Il ne doit rien rester : un message trop long est suspect. */
  fini(): void {
    if (this.pos !== this.vue.byteLength) throw new MessageInvalide('octets en trop');
  }
}
