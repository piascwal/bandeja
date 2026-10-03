/**
 * Les formats de partie en réseau. Quatre sièges, un par joueur de la piste :
 * 0 = A1 (l'hôte, équipe A), 1 = A2, 2 = B1, 3 = B2 (équipe B). Un siège que
 * personne n'occupe est tenu par le CPU. Les formats ne sont que la liste des
 * sièges ouverts aux humains.
 */
export type Format = 'coop' | '1v1' | '2v1' | '1v2' | '2v2';

export const FORMATS: readonly Format[] = ['coop', '1v1', '2v1', '1v2', '2v2'];

export const NOMS_FORMATS: Record<Format, string> = {
  coop: 'COOP CONTRE CPU',
  '1v1': '1 CONTRE 1',
  '2v1': '2 CONTRE 1',
  '1v2': '1 CONTRE 2',
  '2v2': '2 CONTRE 2',
};

/** Sièges ouverts aux humains dans chaque format. */
const OUVERTS: Record<Format, readonly number[]> = {
  coop: [0, 1],
  '1v1': [0, 2],
  '2v1': [0, 1, 2],
  '1v2': [0, 2, 3],
  '2v2': [0, 1, 2, 3],
};

export const estFormat = (v: unknown): v is Format =>
  typeof v === 'string' && (FORMATS as readonly string[]).includes(v);

export const siegesOuverts = (f: Format): readonly number[] => OUVERTS[f];

export const siegeOuvert = (f: Format, siege: number): boolean => OUVERTS[f].includes(siege);

/** Nom d'un siège dans le salon : « A1 » à « B2 ». */
export const nomSiege = (s: number): string => `${s < 2 ? 'A' : 'B'}${(s % 2) + 1}`;

/**
 * La partie peut-elle être lancée ? Il faut quelqu'un en face (ou, en coop, le
 * second siège de l'équipe) : sinon l'hôte jouerait seul contre le CPU, ce qui
 * se fait déjà sans réseau.
 */
export function peutLancer(f: Format, occupes: readonly boolean[]): boolean {
  if (f === 'coop') return !!occupes[0] && !!occupes[1];
  return !!occupes[0] && (!!occupes[2] || !!occupes[3]);
}
