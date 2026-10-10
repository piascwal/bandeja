/**
 * Synthèse Web Audio : aucun fichier son, tout est fabriqué à partir de bruit
 * filtré et d'oscillateurs. Le contexte audio n'est créé qu'au premier geste
 * de l'utilisateur (exigence des navigateurs).
 */
export class MoteurSon {
  private ac: AudioContext | null = null;
  private sortie: GainNode | null = null;
  private foule: GainNode | null = null;
  private bruit: AudioBuffer | null = null;

  constructor(private actif: boolean) {}

  init(): void {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = (this.ac = new AC());
    const comp = ac.createDynamicsCompressor();
    this.sortie = ac.createGain();
    this.sortie.gain.value = this.actif ? 0.7 : 0;
    this.sortie.connect(comp);
    comp.connect(ac.destination);
    const n = ac.sampleRate * 1.5;
    this.bruit = ac.createBuffer(1, n, ac.sampleRate);
    const d = this.bruit.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // la rumeur de la foule, en continu
    const src = ac.createBufferSource();
    src.buffer = this.bruit;
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 650;
    bp.Q.value = 0.5;
    this.foule = ac.createGain();
    this.foule.gain.value = 0.025;
    src.connect(bp);
    bp.connect(this.foule);
    this.foule.connect(this.sortie);
    src.start();
  }

  active(oui: boolean): void {
    this.actif = oui;
    if (this.sortie) this.sortie.gain.value = oui ? 0.7 : 0;
  }

  private pret(): AudioContext | null {
    return this.actif && this.ac && this.sortie ? this.ac : null;
  }

  private souffle(
    dur: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    vol: number,
    delai = 0,
  ): void {
    const ac = this.pret();
    if (!ac || !this.bruit) return;
    const t = ac.currentTime + delai;
    const s = ac.createBufferSource();
    s.buffer = this.bruit;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const gn = ac.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(gn);
    gn.connect(this.sortie!);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  private ton(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    vers: number | null = null,
    delai = 0,
  ): void {
    const ac = this.pret();
    if (!ac) return;
    const t = ac.currentTime + delai;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (vers) o.frequency.exponentialRampToValueAtTime(vers, t + dur);
    const gn = ac.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn);
    gn.connect(this.sortie!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Le « pop » creux de la pala. */
  frappe(p: number): void {
    this.souffle(0.05, 'bandpass', 1500 + p * 1500, 1.4, 0.3 + 0.5 * p);
    this.ton(330 + 120 * p, 0.06, 'triangle', 0.28);
  }

  smash(): void {
    this.frappe(1);
    this.souffle(0.2, 'lowpass', 300, 0.7, 0.8);
    this.ton(90, 0.18, 'sine', 0.45, 45);
  }

  /** Un coup parfait : deux notes qui montent. */
  parfait(): void {
    this.ton(660, 0.08, 'triangle', 0.12);
    this.ton(990, 0.14, 'triangle', 0.12, null, 0.07);
  }

  /** La jauge du super coup est pleine : une petite fanfare. */
  superPret(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.ton(f, 0.16, 'square', 0.06, null, i * 0.08));
    this.ton(1568, 0.4, 'triangle', 0.1, null, 0.34);
  }

  /** Le super coup : l'impact, puis une montée qui change avec la variante. */
  superCoup(variante: number): void {
    this.smash();
    this.ton(180 + variante * 70, 0.55, 'sawtooth', 0.14, 1800);
    this.souffle(0.5, 'highpass', 2500, 1, 0.45, 0.05);
  }

  sol(): void {
    this.ton(190, 0.05, 'sine', 0.22);
    this.souffle(0.04, 'lowpass', 900, 1, 0.12);
  }

  vitre(p: number): void {
    this.ton(620, 0.09, 'square', 0.06 + 0.06 * p);
    this.souffle(0.12, 'bandpass', 2400, 2, 0.25 + 0.3 * p);
    this.ton(140, 0.12, 'sine', 0.25 * p + 0.1);
  }

  grille(): void {
    for (let i = 0; i < 4; i++) this.souffle(0.05, 'bandpass', 3800, 3, 0.22, i * 0.035);
    this.ton(260, 0.18, 'sawtooth', 0.04);
  }

  filet(): void {
    this.souffle(0.16, 'lowpass', 420, 0.8, 0.5);
  }

  clic(): void {
    this.ton(700, 0.04, 'square', 0.06);
  }

  point(bon: boolean): void {
    if (bon) {
      this.ton(880, 0.12, 'square', 0.07);
      this.ton(1320, 0.2, 'square', 0.07, null, 0.1);
    } else {
      this.ton(330, 0.16, 'square', 0.06);
      this.ton(220, 0.24, 'square', 0.06, null, 0.12);
    }
  }

  /** La foule s'enflamme, puis retombe en trois secondes. */
  ovation(niveau: number): void {
    const ac = this.pret();
    if (!ac || !this.foule) return;
    const gn = this.foule.gain;
    const t = ac.currentTime;
    gn.cancelScheduledValues(t);
    gn.setValueAtTime(gn.value, t);
    gn.linearRampToValueAtTime(0.025 + 0.28 * niveau, t + 0.25);
    gn.linearRampToValueAtTime(0.025, t + 3);
  }
}

export function vibre(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* non supporté */
  }
}
