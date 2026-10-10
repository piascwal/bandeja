import { describe, expect, it } from 'vitest';
import { physique } from '@core/balle';
import { ACCEL_MAX, HAUT_SMASH, PAS } from '@core/constants';
import { accelerationEchange, executeCoup } from '@core/coups';
import { xProf } from '@core/terrain';
import { appliqueCommande, cibleCoup, coupAerien, coupPrevu, directionVisee } from '@core/humain';
import { bouge } from '@core/deplacement';
import { pas } from '@core/partie';
import type { Commande } from '@core/types';
import { zonesBoutons } from '@input/disposition';
import { partieTest } from './outils';

const VIDE: Commande = { dx: 0, dy: 0, appuis: [] };

describe('un jeu d’arcade : on touche presque toujours la balle', () => {
  it('avec l’aide au déplacement, un simple appui renvoie la balle échange après échange', () => {
    const jeu = partieTest({ mode: 'match', jeux: 3, sieges: [0], niveau: 1, aide: true }, 31);
    let coups = 0;
    for (let i = 0; i < 120 * 90 && jeu.phase !== 'fin'; i++) {
      const appuie = jeu.phase === 'jeu' && jeu.balle.camp === 0 && i % 50 === 0;
      pas(jeu, PAS, () => (appuie ? { ...VIDE, appuis: ['plat'] } : VIDE));
      for (const e of jeu.evenements.splice(0)) if (e.type === 'frappe' && e.humain) coups++;
    }
    // les règles demandent de se placer et de déclencher au bon moment : un appui toutes les 0,4 s, au hasard, ne touche plus tout
    expect(coups).toBeGreaterThan(3);
  });

  it('le joueur est guidé vers la balle quand le joystick est au repos', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 8);
    const hum = jeu.joueurs[0]!;
    jeu.aide = true;
    jeu.phase = 'jeu';
    Object.assign(jeu.balle, { x: 4, y: 7, z: 1, vx: -2, vy: 0, vz: 0, camp: 0, sol: 1 });
    jeu.tPred = 100; // le plan posé à la main ne doit pas être recalculé
    hum.x = 8;
    hum.y = 2;
    jeu.plan[0] = { s: hum, x: 4, y: 7, z: 1, t: 1, sol: 1, ok: true, vitre: false, score: 0, sc: 0 };
    for (let i = 0; i < 120; i++) pas(jeu, PAS, () => VIDE);
    // à plus de 6 m au départ : il a bien avancé seul vers le point de frappe
    expect(Math.hypot(hum.x - 4, hum.y - 7)).toBeLessThan(4.2);
  });
});

describe('les boutons', () => {
  it('FRAPPE dans le coin, CHANGE à sa gauche, LOBE au-dessus, AMORTI au-dessus de CHANGE', () => {
    const solo = zonesBoutons(400, 200, { change: true, service: false });
    expect(Object.keys(solo).sort()).toEqual(['amorti', 'change', 'lobe', 'plat', 'smash']);
    for (const r of Object.values(solo)) expect(r!.r).toBeLessThanOrEqual(13);
    const { plat, change, lobe, amorti, smash } = solo;
    expect(change!.y).toBe(plat!.y);
    expect(change!.x).toBeLessThan(plat!.x);
    expect(lobe!.x).toBe(plat!.x);
    expect(lobe!.y).toBeLessThan(plat!.y);
    expect(amorti!.x).toBe(change!.x);
    expect(amorti!.y).toBe(lobe!.y);
    expect(smash!.x).toBe(lobe!.x);
    expect(smash!.y).toBeLessThan(lobe!.y);
    // le coin : FRAPPE est le bouton le plus en bas à droite
    for (const r of [change, lobe, amorti, smash]) expect(r!.x + r!.y).toBeLessThan(plat!.x + plat!.y);
    // à plusieurs : pas de CHANGE, AMORTI descend à gauche de FRAPPE, LOBE reste au-dessus
    const multi = zonesBoutons(400, 200, { change: false, service: false });
    expect(multi.change).toBeUndefined();
    expect(multi.amorti).toEqual(change);
    expect(multi.lobe!.y).toBeLessThan(multi.plat!.y);
    expect(multi.lobe!.x).toBe(multi.plat!.x);
    // au service : PLAT dans le coin, COUPE au-dessus
    const serv = zonesBoutons(400, 200, { change: false, service: true });
    expect(Object.keys(serv).sort()).toEqual(['amorti', 'plat']);
    expect(serv.amorti).toEqual(multi.lobe);
  });

  it('FRAPPE peu chargé est un coup coupé, chargé un coup plat', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 2);
    const s = jeu.joueurs[0]!;
    jeu.balle.z = 0.8;
    expect(coupPrevu(jeu, s, 'plat', 0.1)).toBe('coupe');
    expect(coupPrevu(jeu, s, 'plat', 0.9)).toBe('plat');
    // sur une balle haute, le joueur est en position d'attaque : FRAPPE donne le coup aérien, comme SMASH
    jeu.balle.z = HAUT_SMASH + 0.5;
    s.x = 8;
    expect(coupPrevu(jeu, s, 'plat', 0.9)).toBe('smash');
    expect(['smash', 'vibora', 'bandeja']).toContain(coupPrevu(jeu, s, 'plat', 0.1));
    expect(coupPrevu(jeu, s, 'lobe', 0.9)).toBe('lobe');
    jeu.balle.z = 0.8;
    expect(coupPrevu(jeu, s, 'lobe', 0.1)).toBe('lobe');
    expect(coupPrevu(jeu, s, 'amorti', 0.1)).toBe('amorti');
  });

  it('SMASH choisit seul selon la place et le timing', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 2);
    const s = jeu.joueurs[0]!;
    jeu.balle.z = HAUT_SMASH + 0.5;
    s.x = 8; // au filet
    expect(coupAerien(s, 0.9)).toBe('smash');
    expect(coupAerien(s, 0.3)).toBe('bandeja');
    s.x = 5; // à mi-court
    expect(coupAerien(s, 0.8)).toBe('vibora');
    expect(coupAerien(s, 0.3)).toBe('bandeja');
    s.x = 1; // au fond : on garde l'échange
    expect(coupAerien(s, 1)).toBe('bandeja');
    expect(coupPrevu(jeu, s, 'smash', 0.5)).toBe('bandeja');
    // balle basse : un coup à plat appuyé
    jeu.balle.z = 0.8;
    expect(coupPrevu(jeu, s, 'smash', 0.5)).toBe('plat');
  });
});

describe('la direction du coup', () => {
  it('le côté vient du joystick, et on peut le relâcher juste avant de frapper', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 2);
    const s = jeu.joueurs[0]!;
    s.y = 5;
    jeu.phase = 'jeu';
    pas(jeu, PAS, () => ({ ...VIDE, dy: -1 }));
    expect(cibleCoup(s, 'plat').ty).toBeLessThan(2);
    // joystick lâché : la direction tient encore un instant
    pas(jeu, PAS, () => VIDE);
    expect(directionVisee(s).y).toBe(-1);
    expect(cibleCoup(s, 'plat').ty).toBeLessThan(2);
    for (let i = 0; i < 120; i++) pas(jeu, PAS, () => VIDE);
    expect(directionVisee(s)).toEqual({ x: 0, y: 0 });
    pas(jeu, PAS, () => ({ ...VIDE, dy: 1 }));
    expect(cibleCoup(s, 'plat').ty).toBeGreaterThan(8);
  });

  it('poussé vers le filet, le coup est plus long ; tiré en arrière, plus court', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 2);
    const s = jeu.joueurs[0]!;
    jeu.phase = 'jeu';
    const long = (dx: number) => {
      pas(jeu, PAS, () => ({ ...VIDE, dx }));
      // équipe 0 : le miroir inverse dx, donc dx négatif = vers le filet (x croissant)
      return cibleCoup(s, 'plat').tx;
    };
    expect(long(-1)).toBeGreaterThan(long(1));
  });
});

describe('le jeu de vitre du padel', () => {
  it('un coup chargé rebondit, tape la vitre et revient en hauteur ; peu chargé, il garde la balle basse', () => {
    const retour = (p: number): number => {
      const jeu = partieTest({ mode: 'match', sieges: [0] }, 5);
      const s = jeu.joueurs[0]!;
      s.err = 0;
      s.x = 6;
      s.y = 5;
      Object.assign(jeu.balle, { x: 6.5, y: 5, z: 0.8, vx: 5, vy: 0, vz: 0, sol: 1, camp: 0 });
      jeu.phase = 'jeu';
      executeCoup(jeu, s, 'plat', p, xProf(1, 2.8), 5);
      let vitre = false;
      let zMax = 0;
      for (let i = 0; i < 240 * 4; i++) {
        physique(jeu.balle, 1 / 240, (t) => {
          if (t === 'vitre') vitre = true;
        });
        if (vitre && jeu.balle.x < 16) zMax = Math.max(zMax, jeu.balle.z);
      }
      expect(vitre).toBe(true);
      return zMax;
    };
    expect(retour(0.9)).toBeGreaterThan(retour(0.55) + 0.8);
  });

  it('le joueur n’est pas guidé quand la balle va d’abord rebondir sur une vitre', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 8);
    const hum = jeu.joueurs[0]!;
    jeu.phase = 'jeu';
    jeu.aide = true;
    jeu.tPred = 100;
    Object.assign(jeu.balle, { x: 4, y: 7, z: 1, vx: -2, vy: 0, vz: 0, camp: 0, sol: 1 });
    hum.x = 8;
    hum.y = 2;
    jeu.plan[0] = { s: hum, x: 1, y: 7, z: 1, t: 1, sol: 1, ok: true, vitre: true, score: 0, sc: 0 };
    for (let i = 0; i < 120; i++) pas(jeu, PAS, () => VIDE);
    expect(Math.hypot(hum.x - 8, hum.y - 2)).toBeLessThan(0.01);
  });

  it('le joueur reste à distance du filet', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 8);
    const hum = jeu.joueurs[0]!;
    for (let i = 0; i < 240; i++) pas(jeu, PAS, () => ({ ...VIDE, dx: -1 }));
    expect(Math.abs(hum.x - 10)).toBeGreaterThanOrEqual(0.79);
  });

  it('la vitre relance la balle à hauteur de jeu', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 5);
    const b = jeu.balle;
    Object.assign(b, { x: 19.99, y: 5, z: 0.5, vx: 8, vy: 0, vz: -2, spin: 'plat' });
    physique(b, 1 / 240);
    physique(b, 1 / 240);
    expect(b.vz).toBeGreaterThan(1.5);
  });

  it('sans l’option, le joueur n’est jamais conduit vers la balle', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 8);
    const hum = jeu.joueurs[0]!;
    expect(jeu.aide).toBe(false);
    jeu.phase = 'jeu';
    jeu.tPred = 100;
    Object.assign(jeu.balle, { x: 4, y: 7, z: 1, vx: -2, vy: 0, vz: 0, camp: 0, sol: 1 });
    hum.x = 8;
    hum.y = 2;
    jeu.plan[0] = { s: hum, x: 4, y: 7, z: 1, t: 1, sol: 1, ok: true, vitre: false, score: 0, sc: 0 };
    for (let i = 0; i < 120; i++) pas(jeu, PAS, () => VIDE);
    expect(Math.hypot(hum.x - 8, hum.y - 2)).toBeLessThan(0.01);
  });

  it('la balle accélère au fil de l’échange, avec un plafond', () => {
    expect(accelerationEchange(0)).toBe(1);
    expect(accelerationEchange(2)).toBe(1);
    expect(accelerationEchange(10)).toBeGreaterThan(accelerationEchange(5));
    expect(accelerationEchange(500)).toBeCloseTo(1 + ACCEL_MAX);
  });
});

describe('on ne rate pas une balle armée', () => {
  it('un appui trop en avance est oublié : il faut se placer d’abord, puis déclencher au bon moment', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    const s = jeu.joueurs[0]!;
    s.x = 2;
    s.y = 5;
    jeu.phase = 'jeu';
    Object.assign(jeu.balle, { x: 8, y: 5, z: 2, vx: 0, vy: 0, vz: 0, camp: 0, sol: 0, coup: 'lobe' });
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['plat'] }, PAS);
    // un appui récent attend la balle
    for (let i = 0; i < 60; i++) appliqueCommande(jeu, s, VIDE, PAS);
    expect(s.intent).not.toBeNull();
    // mais pas plus d'une seconde
    for (let i = 0; i < 120; i++) appliqueCommande(jeu, s, VIDE, PAS);
    expect(s.intent).toBeNull();
    // la balle arrive ensuite : rien ne part tout seul
    Object.assign(jeu.balle, { x: 2.5, y: 5, z: 1 });
    appliqueCommande(jeu, s, VIDE, PAS);
    expect(jeu.balle.camp).toBe(0);
    // en appuyant au bon moment, le coup part
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['plat'] }, PAS);
    expect(jeu.balle.camp).toBe(1);
  });

  it('armer son coup fige presque le joueur : on dirige le coup au lieu de courir', () => {
    const cours = (arme: boolean) => {
      const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
      const s = jeu.joueurs[0]!;
      s.x = 3;
      s.y = 5;
      jeu.phase = 'jeu';
      Object.assign(jeu.balle, { x: 9, y: 5, z: 2, vx: 0, vy: 0, vz: 0, camp: 1, sol: 0, coup: 'lobe' });
      if (arme) s.intent = { type: 'plat', t: 0.1 };
      for (let i = 0; i < 30; i++) {
        appliqueCommande(jeu, s, { dx: 1, dy: 0, appuis: [] }, PAS);
        bouge(jeu, s, PAS);
      }
      return Math.abs(s.x - 3);
    };
    // armé, le joueur ne bouge presque plus : on dirige le coup, on ne court plus
    expect(cours(false)).toBeGreaterThan(cours(true) * 4);
  });

  it('la raquette ne rattrape pas tout : une balle à plus d’un mètre quinze n’est pas jouée', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    const s = jeu.joueurs[0]!;
    s.x = 2;
    s.y = 5;
    jeu.phase = 'jeu';
    Object.assign(jeu.balle, { x: 3.4, y: 5, z: 1, vx: 0, vy: 0, vz: 0, camp: 0, sol: 0, coup: 'plat' });
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['plat'] }, PAS);
    expect(jeu.balle.camp).toBe(0);
  });

  it('jauge pleine mais balle sur le point de rebondir une deuxième fois : le coup part quand même', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    const s = jeu.joueurs[0]!;
    s.x = 2;
    s.y = 5;
    jeu.phase = 'jeu';
    Object.assign(jeu.balle, { x: 2.6, y: 5, z: 0.3, vx: -1, vy: 0, vz: -3, camp: 0, sol: 1, coup: 'plat' });
    s.intent = { type: 'plat', t: 0 };
    s.charge = 1;
    appliqueCommande(jeu, s, VIDE, PAS);
    expect(jeu.balle.camp).toBe(1);
  });
});
