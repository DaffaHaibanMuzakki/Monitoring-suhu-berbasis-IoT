const { default: axios } = require("axios");


const TARGET_URL =
  "https://monitoring-suhu-berbasis-iot-1.onrender.com/health";

const INTERVAL = 5 * 60 * 1000; // 5 menit

console.log("🤖 Keep Alive Bot started...");

setInterval(async () => {
  try {
    const res = await axios.get(TARGET_URL);
    console.log(
      `✅ Ping success [${new Date().toLocaleTimeString()}]`,
      res.status
    );
  } catch (err) {
    console.error(
      `❌ Ping failed [${new Date().toLocaleTimeString()}]`,
      err.message
    );
  }
}, INTERVAL);
