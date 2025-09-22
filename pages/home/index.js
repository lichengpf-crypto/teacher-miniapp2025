// pages/home/index.js
const { postJson, getJson } = require("../../utils/request.js");

// 生成默认学生列表 S001..S020
function makeDefaultStudents(n = 20) {
  const arr = [];
  for (let i = 1; i <= n; i++) {
    const id = "S" + String(i).padStart(3, "0");
    arr.push({ id, name: id, selected: false });
  }
  return arr;
}

// 将多行文本 => 去空行后的数组
function linesToArray(s) {
  if (!s || typeof s !== "string") return [];
  return s
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(x => x.length > 0);
}

// 将多行（可带 A: hello）=> 对话数组
function linesToDialogue(s) {
  if (!s || typeof s !== "string") return [];
  return s
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(row => {
      const m = row.match(/^([A-Za-z]):\s*(.*)$/);
      if (m) return { speaker: m[1].toUpperCase(), text: m[2] };
      return { speaker: "", text: row };
    });
}

Page({
  data: {
    // 基本信息
    title: "",
    note: "",
    // 文本编辑框原始字符串（便于双向绑定）
    wordsInput: "",
    dialogueInput: "",
    // 结构化数据（提供给检查/预览/发布）
    words: [],
    dialogue: [],
    // 学生
    studentsUi: makeDefaultStudents(20),
    students: [], // 已选 id 列表
    // TTS
    tts: { language:"en-GB", voice:"en-GB-LibbyNeural", rate:"+0%", pitch:"+0st", format:"mp3-16k" },
  },

  // ---------------- 生命周期 ----------------
  onShow() {
    // 兜底：检查页 onUnload 会写 storage；这里接一次
    try {
      const snap = wx.getStorageSync("checkedSnapshot");
      if (snap && typeof snap === "object") {
        this.applySnapshotFromCheck(snap, "storage");
        wx.removeStorageSync("checkedSnapshot");
      }
    } catch (_) {}
  },

  // ---------------- 输入框绑定（配合 WXML） ----------------
  onTitleInput(e) {
    this.setData({ title: e.detail.value || "" });
  },
  onNoteInput(e) {
    this.setData({ note: e.detail.value || "" });
  },
  onWordsInput(e) {
    const raw = e.detail.value || "";
    const arr = linesToArray(raw);
    this.setData({ wordsInput: raw, words: arr });
  },
  onDialogueInput(e) {
    const raw = e.detail.value || "";
    const arr = linesToDialogue(raw);
    this.setData({ dialogueInput: raw, dialogue: arr });
  },

  // ---------------- 学生选择 ----------------
  onStudentToggle(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const ui = (this.data.studentsUi || []).map(s =>
      s.id === id ? { ...s, selected: !s.selected } : s
    );
    const chosen = ui.filter(s => s.selected).map(s => s.id);
    this.setData({ studentsUi: ui, students: chosen });
  },
  onStudentClear() {
    const ui = (this.data.studentsUi || []).map(s => ({ ...s, selected: false }));
    this.setData({ studentsUi: ui, students: [] });
  },

  // ---------------- 跳到检查页（WXML 里一般绑 goCheckPage） ----------------
  goCheckPage() {
    const snapshot = this.buildCurrentSnapshotForCheck();
    wx.navigateTo({
      url: "/pages/check/index",
      events: {
        checkedSnapshot: (snap) => {
          if (snap && typeof snap === "object") {
            this.applySnapshotFromCheck(snap, "event");
          }
        }
      },
      success: (res) => {
        try { res.eventChannel.emit("snapshot", snapshot); } catch (_) {}
      }
    });
  },

  // 预览音频（WXML 里一般绑 onPreviewAudio）
  onPreviewAudio() {
    const words = Array.isArray(this.data.words) ? this.data.words : [];
    const dialogue = Array.isArray(this.data.dialogue) ? this.data.dialogue : [];
    if (words.length === 0 && dialogue.length === 0) {
      wx.showToast({ title: "没有可预览的内容", icon: "none" }); return;
    }
    wx.navigateTo({
      url: "/pages/preview/index",
      success: (res) => {
        try {
          res.eventChannel.emit("payload", {
            title: this.data.title || "",
            items: [
              ...words.map(w => ({ type:"word", text:w })),
              ...dialogue.map(d => ({ type:"dialogue", text:d.text, speaker:d.speaker || "" }))
            ],
            tts: this.data.tts
          });
        } catch (e) {
          console.warn("emit preview payload fail:", e);
        }
      }
    });
  },

  // 发布作业（WXML 里一般绑 onPublish）
  async onPublish() {
    const { title, note } = this.data;
    const words = this.data.words || [];
    const dialogue = this.data.dialogue || [];
    const tts = this.data.tts || {};
    const target_students = this.data.students || [];
    if (!title) { wx.showToast({ title:"请填写作业标题", icon:"none" }); return; }
    if (words.length === 0 && dialogue.length === 0) {
      wx.showToast({ title:"请填写单词或对话", icon:"none" }); return;
    }
    try {
      wx.showLoading({ title:"正在发布…" });
      const r = await postJson("/assignments/publish_tts", {
        teacher_id: "T001",
        title, note, words, dialogue, tts, target_students
      });
      wx.hideLoading();
      if (r && r.ok) {
        wx.showToast({ title:"已发布", icon:"success" });
      } else {
        wx.showToast({ title:"发布失败", icon:"none" });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title:"发布失败", icon:"none" });
      console.error("publish error", e);
    }
  },

  // ---------------- 与检查页的数据对接 ----------------
  buildCurrentSnapshotForCheck() {
    return {
      title: this.data.title || "",
      note: this.data.note || "",
      words: Array.isArray(this.data.words) ? this.data.words.slice(0) : [],
      dialogue: Array.isArray(this.data.dialogue) ? this.data.dialogue.slice(0) : [],
      tts: this.data.tts || { language:"en-GB", voice:"en-GB-LibbyNeural", rate:"+0%", pitch:"+0st", format:"mp3-16k" }
    };
  },

  applySnapshotFromCheck(snap, via) {
    const patch = {};
    if (typeof snap.title === "string")   patch.title = snap.title;
    if (typeof snap.note === "string")    patch.note  = snap.note;
    if (Array.isArray(snap.words)) {
      patch.words = snap.words;
      patch.wordsInput = (snap.words || []).join("\n");
    }
    if (Array.isArray(snap.dialogue)) {
      patch.dialogue = snap.dialogue;
      patch.dialogueInput = (snap.dialogue || [])
        .map(d => (d.speaker ? `${d.speaker}: ` : "") + (d.text || ""))
        .join("\n");
    }
    if (snap.tts && typeof snap.tts === "object") patch.tts = snap.tts;

    this.setData(patch, () => {
      console.log(`[home] applied snapshot via ${via}:`, patch);
      wx.showToast({ title:"检查结果已应用", icon:"success" });
    });
  }
});



