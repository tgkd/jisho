import { parseKanjidicLine } from '../scripts/import/utils/parsers';

describe('parseKanjidicLine', () => {
  it('extracts on and kun readings from kanjidic line', () => {
    const line = '亜 3021 U4e9c Yya4 Wa ア つ.ぐ T1 や つぎ つぐ {Asia} {rank next} {come after} {-ous}';

    const result = parseKanjidicLine(line);

    expect(result).not.toBeNull();
    expect(result!.character).toBe('亜');
    expect(result!.onReadings).toEqual(['ア']);
    expect(result!.kunReadings).toEqual(['つ.ぐ']);
    expect(result!.nanoriReadings).toEqual(['や', 'つぎ', 'つぐ']);
    expect(result!.meanings).toEqual(['Asia', 'rank next', 'come after', '-ous']);
  });

  it('captures multiple readings and metadata', () => {
    const line = '圧 3035 U5727 B27 C32 G5 S5 F718 J2 N818 V970 アツ エン オウ お.す へ.す おさ.える お.さえる {-press} {overwhelm} {oppress} {dominate}';

    const result = parseKanjidicLine(line);

    expect(result).not.toBeNull();
    expect(result!.unicode).toBe('U5727');
    expect(result!.jisCode).toBe('3035');
    expect(result!.onReadings).toEqual(['アツ', 'エン', 'オウ']);
    expect(result!.kunReadings).toEqual(['お.す', 'へ.す', 'おさ.える', 'お.さえる']);
    expect(result!.meanings).toEqual(['-press', 'overwhelm', 'oppress', 'dominate']);
  });
});
