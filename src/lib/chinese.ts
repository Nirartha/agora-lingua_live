import { Converter } from "opencc-js/cn2t";

// Presentation conversion only. Keep the documented Agora language codes unchanged.
// `tw` uses Taiwan traditional character forms without rewriting English text.
const convert = Converter({ from: "cn", to: "tw" });
export function traditionalChinese(text: string) { return convert(text); }
