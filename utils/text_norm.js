
// utils/text_norm.js
function toHalfPunct(s) {
  return (s || "")
    .replace(/，/g, ",")
    .replace(/。/g, ".")
    .replace(/！/g, "!")
    .replace(/？/g, "?")
    .replace(/：/g, ":")
    .replace(/；/g, ";")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/【/g, "[")
    .replace(/】/g, "]");
}

function sentenceCase(s) {
  s = s || "";
  s = s.trim().replace(/\s+/g, " ");
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function punctSpace(s) {
  return (s || "").replace(/([.,!?:;])(?=\S)/g, "$1 ");
}

function compressDupPunct(s) {
  return (s || "").replace(/!{2,}/g, "!").replace(/\?{2,}/g, "?");
}

function normalizeDialogueLocal(lines) {
  const out = [];
  const issues = [];
  if (!lines) return { items: out, issues };

  const arr = Array.isArray(lines) ? lines : String(lines).split(/\r?\n/);
  for (let raw of arr) {
    let speaker = "";
    let text = "";
    if (typeof raw === "string") {
      const m = raw.match(/^\s*([A-Za-z])\s*:\s*(.*)$/);
      if (m) {
        speaker = m[1].toUpperCase();
        text = m[2];
      } else {
        text = raw;
      }
    } else if (raw && typeof raw === "object") {
      speaker = (raw.speaker || "").toString().trim().slice(0, 1).toUpperCase();
      text = raw.text || "";
    }

    let t = text;
    const before = t;

    t = toHalfPunct(t);
    t = compressDupPunct(t);
    t = punctSpace(t);
    t = sentenceCase(t);
    t = t.trim().replace(/\s+/g, " ");

    if (/\b[Ii](?:am|m)[A-Z]/.test(before) || /[a-z][A-Z]/.test(before)) {
      issues.push({ type: "concat_suspect", text: before });
    }

    out.push({
      speaker: speaker || undefined,
      text: t
    });
  }
  return { items: out, issues };
}

function normalizeWordsLocal(text) {
  const raw = String(text || "")
    .replace(/[、，；；]/g, " ")
    .replace(/[,\n\r\t]+/g, " ")
    .trim();
  const tokens = raw ? raw.split(/\s+/) : [];
  const cleaned = tokens.map((w) =>
    String(w || "").trim().replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, "").toLowerCase()
  ).filter(Boolean);
  return Array.from(new Set(cleaned));
}

module.exports = {
  normalizeDialogueLocal,
  normalizeWordsLocal,
};
