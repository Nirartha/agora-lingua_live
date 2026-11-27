import { traditionalChinese } from "./chinese";

export interface Caption {
  id: string;
  speaker: string;
  original: string;
  translation: string;
  originalLanguage: string;
  language: string;
  final: boolean;
  receivedAt: number;
  sequence?: number;
}
type Fragment = { count: number; parts: Map<number, string>; created: number; size: number };
const SENTENCE_END = /(?:[。！？!?；;]|\.{1,3}|…+)["'”’」』】》）)]*$/u;
function sentenceComplete(value: string) { return SENTENCE_END.test(value.trim()); }
interface Segment {
  asr: string;
  // The transcript attached to a translation is authoritative for this segment.
  translatedSource?: string;
  translation: string;
  translationFinal: boolean;
  originalLanguage: string;
  language: string;
}
function joinSegments(values: string[]) {
  return values.filter(Boolean).reduce((previous, incoming) => {
    if (!previous) return incoming;
    const noSpace = /\p{Script=Han}$/u.test(previous) || /^\p{Script=Han}/u.test(incoming) || /^[，。！？、；：,.!?;:]/u.test(incoming);
    return previous + (noSpace ? "" : " ") + incoming;
  }, "");
}
export class TranscriptBuffer {
  private fragments = new Map<string, Fragment>();
  private captions = new Map<string, Caption>();
  private completed = new Map<string, number>();
  private activeBySpeaker = new Map<string, string>();
  private turnToCaption = new Map<string, string>();
  private segments = new Map<string, Map<string, Segment>>();
  private nextSequence = 1;
  private diagnostics = { messages: 0, incomplete: 0, invalid: 0, duplicates: 0 };
  constructor(private now: () => number = Date.now) {}
  reset() { this.fragments.clear(); this.captions.clear(); this.completed.clear(); this.activeBySpeaker.clear(); this.turnToCaption.clear(); this.segments.clear(); this.nextSequence = 1; }
  stats() { return { ...this.diagnostics, pending: this.fragments.size }; }
  items() { return [...this.captions.values()].slice(-100); }

  accept(publisher: string, raw: string | Uint8Array): Caption[] | null {
    try {
      const time = this.now();
      for (const [key, fragment] of this.fragments) {
        if (time - fragment.created > 15000) { this.fragments.delete(key); this.diagnostics.incomplete++; }
      }
      for (const [key, expires] of this.completed) if (time > expires) this.completed.delete(key);
      const message = typeof raw === "string" ? raw : new TextDecoder("utf-8", { fatal: true }).decode(raw);
      if (message.length > 1024 * 1024) throw new Error("large");
      let json: string;
      if (message.startsWith("{")) {
        json = message;
      } else {
        const parts = message.split("|");
        if (parts.length !== 4 || !parts[0] || parts[0].length > 200) throw new Error("frame");
        const [messageId, indexText, countText, payload] = parts;
        const index = Number(indexText), count = Number(countText);
        if (!/^\d+$/.test(indexText) || !/^\d+$/.test(countText) || count < 1 || count > 128 || index < 1 || index > count) throw new Error("indices");
        const key = `${publisher}:${messageId}`;
        if (this.completed.has(key)) { this.diagnostics.duplicates++; return null; }
        let fragment = this.fragments.get(key);
        if (!fragment) {
          if (this.fragments.size >= 256) { this.fragments.delete(this.fragments.keys().next().value!); this.diagnostics.incomplete++; }
          fragment = { count, parts: new Map(), created: time, size: 0 }; this.fragments.set(key, fragment);
        }
        if (fragment.count !== count) { this.fragments.delete(key); throw new Error("count changed"); }
        if (fragment.parts.has(index)) { this.diagnostics.duplicates++; return null; }
        fragment.parts.set(index, payload); fragment.size += payload.length;
        if (fragment.size > 1024 * 1024) { this.fragments.delete(key); throw new Error("large"); }
        if (fragment.parts.size !== count) return null;
        const encoded = Array.from({ length: count }, (_, i) => fragment!.parts.get(i + 1)!).join("");
        this.fragments.delete(key);
        const bytes = Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0));
        json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        this.completed.set(key, time + 60000);
        if (this.completed.size > 1024) this.completed.delete(this.completed.keys().next().value!);
      }
      const data = JSON.parse(json);
      this.diagnostics.messages++;
      if (!["user.transcription", "user.translation"].includes(data.object)) return null;
      if ((typeof data.stream_id !== "number" && typeof data.stream_id !== "string") || (typeof data.turn_id !== "number" && typeof data.turn_id !== "string") || typeof data.text !== "string" || data.text.length > 20000 || typeof data.final !== "boolean") throw new Error("schema");
      // Buffer is scoped to one connection/Agent generation. ASR may omit metadata
      // that is present on translation, so optional metadata cannot be the pair key.
      const speakerKey = `${publisher}:${data.stream_id}`;
      const turnKey = `${speakerKey}:${data.turn_id}`;
      const mappedId = this.turnToCaption.get(turnKey);
      const activeId = this.activeBySpeaker.get(speakerKey);
      const id = mappedId || (activeId && !this.captions.get(activeId)?.final ? activeId : turnKey);
      this.turnToCaption.set(turnKey, id);
      const parts = this.segments.get(id) ?? new Map<string, Segment>();
      const segment: Segment = parts.get(turnKey) ?? {
        asr: "", translation: "", translationFinal: false, originalLanguage: "", language: "",
      };
      if (data.object === "user.translation") {
        if (!segment.translationFinal || data.final) {
          // Each event is a revised snapshot for its turn, not an append-only delta.
          segment.translation = traditionalChinese(data.text.trim());
          if (typeof data.transcript_text === "string" && data.transcript_text.trim()) {
            segment.translatedSource = traditionalChinese(data.transcript_text.slice(0, 20000).trim());
          }
          segment.language = typeof data.language === "string" ? data.language : segment.language;
          segment.originalLanguage = typeof data.transcript_language === "string" ? data.transcript_language : segment.originalLanguage;
          segment.translationFinal = data.final;
        }
      } else if (!segment.translationFinal) {
        segment.asr = traditionalChinese(data.text.trim());
        segment.originalLanguage = typeof data.language === "string" ? data.language : segment.originalLanguage;
      }
      parts.set(turnKey, segment);
      this.segments.set(id, parts);
      const ordered = [...parts.values()];
      const last = ordered.at(-1)!;
      const previous = this.captions.get(id);
      const item: Caption = {
        id, speaker: String(data.stream_id),
        original: joinSegments(ordered.map((part) => part.translatedSource ?? part.asr)),
        translation: joinSegments(ordered.map((part) => part.translation)),
        originalLanguage: last.originalLanguage, language: last.language,
        // ASR final is not translation final. A completed row stays closed when
        // late corrections arrive, and cannot clear a newer active sentence.
        final: previous?.final || ordered.every((part) => part.translationFinal) && sentenceComplete(last.translatedSource || last.asr || last.translation),
        receivedAt: previous?.receivedAt ?? time,
        sequence: previous?.sequence ?? this.nextSequence++,
      };
      this.captions.set(id, item);
      if (item.final) {
        if (this.activeBySpeaker.get(speakerKey) === id) this.activeBySpeaker.delete(speakerKey);
      } else if (!mappedId || !activeId || activeId === id) this.activeBySpeaker.set(speakerKey, id);
      if (this.captions.size > 100) {
        const oldest = this.captions.keys().next().value!;
        this.captions.delete(oldest);
        for (const key of this.segments.get(oldest)?.keys() ?? []) this.turnToCaption.delete(key);
        this.segments.delete(oldest);
        for (const [speaker, caption] of this.activeBySpeaker) if (caption === oldest) this.activeBySpeaker.delete(speaker);
      }
      return this.items();
    } catch { this.diagnostics.invalid++; return null; }
  }
}

