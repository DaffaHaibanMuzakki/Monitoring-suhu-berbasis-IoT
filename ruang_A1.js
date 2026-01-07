

const axios = require("axios");

const jadwal = [
  "00:00","00:30","01:00","01:30",
  "02:00","02:30","03:00","03:30",
  "04:00","04:30","05:00","05:30",
  "06:00","06:30","07:00","07:30",
  "08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30",
  "16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30",
  "20:00","20:30","21:00","21:30",
  "22:00","22:30","23:00","23:30"
];

function formatWaktuDB(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}


function bacaSuhuSimulasi() {
  const rand = Math.random();

  if (rand < 0.05) return -127;               // error sensor
  if (rand < 0.15) return +(30 + Math.random() * 5).toFixed(1); // panas

  return +(24 + Math.random() * 5).toFixed(1); // normal
}



let terakhirKirim = "";

function kirimData() {
  const suhu = bacaSuhuSimulasi();

  const payload = {
    deviceID: "ESP001",
    ruangan: "Dapur A1",
    suhu: suhu,
    apiKey: "12345ABCDE",
    waktu: formatWaktuDB()
  };

  console.log("📤 KIRIM:", payload);

  axios.post("http://localhost:3000/api/iot/suhu", payload);
}

setInterval(() => {
  const now = new Date();
  const jam = now.toTimeString().slice(0,5); // HH:MM

  if (jadwal.includes(jam) && jam !== terakhirKirim) {
    kirimData();
    terakhirKirim = jam;
  }

  
}, 1000);
