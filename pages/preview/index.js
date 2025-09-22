// pages/preview/index.js
// 说明：仅做“重签 + 播放”，不在预览页合成音频。
// 主页会先调用 /assignments/publish_tts（不带 target_students），把 items[] 传递到本页。
const { getJson, BASE_URL } = require("../../utils/request.js");

Page({
  data: {
    items: []     // [{ id,type,text,speaker,fileUrl,realUrl }]
  },

  async onLoad(options) {
    try {
      const payload = options && options.payload ? JSON.parse(decodeURIComponent(options.payload)) : {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      const resolved = [];

      for (const it of items) {
        const rel = it.fileUrl || ""; // e.g. /cos/resign/tts/...
        let real = "";
        try {
          const url = rel.startsWith("http") ? rel : (BASE_URL + rel);
          const r = await getJson(url);
          // 兼容：utils/request.js 返回 { statusCode, data }
          const direct = r && (r.fileUrl || (r.data && r.data.fileUrl));
          if (direct) real = direct;
        } catch (e) {
          console.warn("[preview] resign fail:", e);
        }
        resolved.push({ ...it, realUrl: real || "" });
      }

      this.setData({ items: resolved });
    } catch (e) {
      console.error("[preview] payload parse error:", e);
      wx.showToast({ title: "预览载入失败", icon: "none" });
    }
  }
});
