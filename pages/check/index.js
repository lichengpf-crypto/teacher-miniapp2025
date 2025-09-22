// pages/check/index.js
const { postJson } = require("../../utils/request.js");
const unwrap = (obj) => (obj && obj.data && typeof obj.data === "object") ? obj.data : (obj || {});

Page({
  data: {
    incoming: null,
    finalSnapshot: null,
    suggest: null,
    loadingCheck: false,
    tip: ""
  },

  onLoad() {
    const ec = this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (ec && ec.on) {
      ec.on("snapshot", (snap) => {
        const copy = {
          title: snap?.title || "",
          note: snap?.note || "",
          words: Array.isArray(snap?.words) ? snap.words.slice(0) : [],
          dialogue: Array.isArray(snap?.dialogue) ? snap.dialogue.slice(0) : [],
          tts: snap?.tts || { language:"en-GB", voice:"en-GB-LibbyNeural", rate:"+0%", pitch:"+0st", format:"mp3-16k" }
        };
        this.setData({ incoming: snap, finalSnapshot: copy }, () => this.runCheck(copy));
      });
    }
  },

  onUnload() {
    try { if (this.data.finalSnapshot) wx.setStorageSync("checkedSnapshot", this.data.finalSnapshot); } catch(e){}
  },

  async runCheck(snap) {
    const s = snap || this.data.finalSnapshot || this.data.incoming;
    if (!s) return;
    this.setData({ loadingCheck: true, tip: "" });

    try {
      const words = Array.isArray(s.words) ? s.words : [];
      const dialogue = Array.isArray(s.dialogue) ? s.dialogue : [];

      // 拉取后端
      const ckRaw = unwrap(await postJson("/text/check_words", { words }));
      const vd    = unwrap(await postJson("/text/validate", { dialogue }));

      // 预计算“建议”文本，避免 WXML 表达式导致空白
      const ck = ckRaw || {};
      ck.results = (ck.results || []).map(r => {
        const sugText = (Array.isArray(r.suggestions) && r.suggestions.length) ? r.suggestions.join(" / ") : "";
        return { ...r, sugText };
      });

      const suggest = { checkWords: ck, validate: vd || {} };

      let tip = "检查完成后，如需改动请点击下面的“接受建议/应用规范”。确认无误请点“确认并返回”。";
      const noWord   = !(ck.results && ck.results.length);
      const noIssues = !(suggest.validate?.issues && suggest.validate.issues.length);
      if (noWord && noIssues) tip = "未发现需要修改的项。可直接点击“确认并返回”。";

      // 日志辅助定位
      console.log("[check] words:", words);
      console.log("[check] suggest.checkWords:", ck);
      console.log("[check] suggest.validate:", suggest.validate);

      this.setData({ suggest, tip });
    } catch (e) {
      console.error("runCheck error", e);
      this.setData({ tip: "检查失败，请稍后重试。" });
      wx.showToast({ title: "检查失败", icon: "none" });
    } finally {
      this.setData({ loadingCheck: false });
    }
  },

  onRecheck(){ this.runCheck(); },

  // ===== 单词：全部接受 / 单条接受 =====
  onAcceptAllWords(){
    const res = this.data.suggest?.checkWords?.results;
    const current = this.data.finalSnapshot?.words || [];
    if (!Array.isArray(res) || res.length === 0 || current.length === 0) {
      wx.showToast({ title:"没有可接受的单词建议", icon:"none" }); return;
    }
    const out = current.slice(0);
    const n = Math.min(current.length, res.length);
    for (let i=0;i<n;i++){
      const r = res[i] || {};
      if (r.ok === false && Array.isArray(r.suggestions) && r.suggestions.length) {
        const to = String(r.suggestions[0]);
        out[i] = to;
      }
    }
    this.setData({ finalSnapshot: { ...this.data.finalSnapshot, words: out }});
    wx.showToast({ title:"已接受全部单词建议", icon:"success" });
  },

  onAcceptOneWord(e){
    const idx = Number(e.currentTarget.dataset.idx);
    const res = this.data.suggest?.checkWords?.results || [];
    const r = res[idx];
    const words = (this.data.finalSnapshot?.words || []).slice(0);

    if (!r || !Array.isArray(r.suggestions) || r.suggestions.length === 0) {
      wx.showToast({ title:"该条无建议", icon:"none" }); return;
    }
    if (idx < 0 || idx >= words.length) {
      wx.showToast({ title:"索引越界", icon:"none" }); return;
    }

    const from = String(words[idx] ?? "");
    const to   = String(r.suggestions[0]);
    words[idx] = to;

    this.setData({ finalSnapshot: { ...this.data.finalSnapshot, words } });
    wx.showToast({ title:`已替换：${from} → ${to}`, icon:"success" });
  },

  // ===== 句式规范：应用 normalized =====
  onApplyNormalization(){
    const norm = this.data.suggest?.validate?.normalized;
    if (!norm) { wx.showToast({ title:"没有可应用的规范", icon:"none" }); return; }
    const fs = { ...this.data.finalSnapshot };
    if (Array.isArray(norm.words))    fs.words    = norm.words;
    if (Array.isArray(norm.dialogue)) fs.dialogue = norm.dialogue;
    this.setData({ finalSnapshot: fs });
    wx.showToast({ title:"已应用句式规范", icon:"success" });
  },

  // ===== 确认并返回 =====
  onConfirmAndBack(){
    const snap = this.data.finalSnapshot;
    if (!snap) { wx.showToast({ title:"空数据", icon:"none" }); return; }
    try{
      wx.setStorageSync("checkedSnapshot", snap);
      const ec = this.getOpenerEventChannel && this.getOpenerEventChannel();
      if (ec && ec.emit) ec.emit("checkedSnapshot", snap);
      wx.showToast({ title:"已确认", icon:"success" });
      setTimeout(()=>wx.navigateBack(), 120);
    }catch(e){
      wx.showToast({ title:"确认失败", icon:"none" });
    }
  }
});
