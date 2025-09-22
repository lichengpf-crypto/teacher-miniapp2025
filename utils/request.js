// utils/request.js
const BASE_URL = "https://1374188029-brba51y21c.ap-beijing.tencentscf.com"; // ← 可改为 stable

function requestPromise(opts) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...opts,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
}

function postJson(path, data) {
  return requestPromise({
    url: path.startsWith('http') ? path : (BASE_URL + path),
    method: 'POST',
    header: {"Content-Type":"application/json"},
    data: JSON.stringify(data || {})
  });
}

function getJson(path) {
  return requestPromise({
    url: path.startsWith('http') ? path : (BASE_URL + path),
    method: 'GET'
  });
}

module.exports = {
  BASE_URL,
  requestPromise,
  postJson,
  getJson,
};