/** How a character looks. Chosen in onboarding (R3); presets for now. */
export interface CharacterLook {
  skin: number;
  hair: number;
  hairStyle: 'short' | 'long' | 'bun' | 'curly';
  top: number;
  bottom: number;
}

export const LOOKS: Record<string, CharacterLook> = {
  maya: { skin: 0xf1c7a5, hair: 0x2b1d16, hairStyle: 'long', top: 0x2f6f62, bottom: 0x2d3340 },
  sam: { skin: 0xc68a63, hair: 0x1c1c1c, hairStyle: 'short', top: 0xe07a5f, bottom: 0x3a4250 },
  noor: { skin: 0x8d5a3b, hair: 0x15110f, hairStyle: 'curly', top: 0xf2cc8f, bottom: 0x2b2f38 },
  lea: { skin: 0xf6d5bd, hair: 0xb5763c, hairStyle: 'bun', top: 0x3d5a80, bottom: 0x22262e },
  omar: { skin: 0xd9a27b, hair: 0x3b2a20, hairStyle: 'short', top: 0x81b29a, bottom: 0x2f3a46 },
};

export const DEFAULT_LOOK = LOOKS.maya;
