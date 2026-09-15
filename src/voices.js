/**
 * Głosy ElevenLabs (źródło: „<imię> Trasti 2026-09-15”).
 * W UI pokazujemy wyłącznie imię — bez „Trasti” i bez daty.
 * `gender` decyduje o personie: female → Bianca, male → Bianek.
 */
export const VOICES = [
  { id: "I89qYOZ2Wep6YhFVkwDx", label: "Ania", gender: "female" },
  { id: "heZ5n2s8ysFXpqiZrUiF", label: "Artur", gender: "male" },
  { id: "gGgd7kxAnYrtrFUgBTJA", label: "Gosia", gender: "female" },
  { id: "2epC4oaPBqbC9Ion1xKd", label: "Kasia", gender: "female" },
  { id: "HAW9EddN24flXD7hDiS4", label: "Kinga", gender: "female" },
  { id: "ZmwbxDz5WMBvDbpN4RMi", label: "Klaudia", gender: "female" },
  { id: "oq3bSqUHtKMaPGHsOCm5", label: "Paulina", gender: "female" },
  { id: "YBZYXuIYVCHV0LzCSgV3", label: "Tomasz", gender: "male" },
  { id: "E2Ygo2GaIBD9BJsdWA9s", label: "Wiktoria", gender: "female" },
  { id: "Id4M2httdQ7gpRtutidJ", label: "WiktoriaB", gender: "female" },
];

export function findVoice(voiceId) {
  return VOICES.find((v) => v.id === voiceId);
}
