const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const app = express();
const port = 3000;

/* ======================================================
   MIDDLEWARE
====================================================== */
app.use(express.json());
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* ======================================================
   DATABASE
====================================================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Database connected"))
  .catch(err => console.error("❌ Database connection error:", err));



/* ======================================================
   SCHEMA & MODEL
====================================================== */
const KondisiLingkunganSchema = new mongoose.Schema({
  deviceID: String,
  suhu: Number,
  kelembapan: Number,
  ruangan: String,
  apiKey: String,
  waktu: String
});

const KondisiLingkungan = mongoose.model("KondisiLingkungan", KondisiLingkunganSchema

);

/* ======================================================
   HELPER FUNCTIONS (GLOBAL)
====================================================== */
function getTanggal(waktu) {
  const dateObj = new Date(waktu.replace(" ", "T"));
  return dateObj.toISOString().slice(0, 10);
}

function cekStabilitasData(dataHari) {
  const ADA_ERROR = dataHari.some(d =>
    d.suhu === null ||
    typeof d.suhu !== "number" ||
    isNaN(d.suhu) ||
    d.suhu === -127
  );
  return ADA_ERROR ? "anomali" : "secure";
}

function cekStabilitasSuhu(dataHari) {
  const ADA_BAHAYA = dataHari.some(d => d.suhu > 30);
  return ADA_BAHAYA ? "anomali" : "aman";
}

function cekStabilitasKelembapan(dataHari) {
  const ADA_BAHAYA = dataHari.some(d => d.kelembapan > 70);
  return ADA_BAHAYA ? "anomali" : "aman";
}

function hitungRataRataSuhu(data) {
  const suhuValid = data
    .map(d => d.suhu)
    .filter(s => typeof s === "number" && !isNaN(s));
  if (suhuValid.length === 0) return null;
  return Number(
    (suhuValid.reduce((a, b) => a + b, 0) / suhuValid.length).toFixed(1)
  );
}

function hitungRataRataKelembapan(data) {
  const kelembapanValid = data
    .map(d => d.kelembapan)
    .filter(k => typeof k === "number" && !isNaN(k));
  if (kelembapanValid.length === 0) return null;
  return Number(
    (kelembapanValid.reduce((a, b) => a + b, 0) / kelembapanValid.length).toFixed(1)
  );
}

function olahDataLingkungan(data, tanggal, ruangan) {
  const sorted = [...data].sort(
    (a, b) =>
      new Date(a.waktu.replace(" ", "T")) -
      new Date(b.waktu.replace(" ", "T"))
  );

  const labels = [];
  const suhuData = [];
  const kelembapanData = [];
  

  sorted.forEach(d => {
    const jam = d.waktu.split(" ")[1].slice(0, 5);
    labels.push(jam);
    suhuData.push(d.suhu);
    kelembapanData.push(d.kelembapan);
  });

  const suhuValid = suhuData.filter(
    s => typeof s === "number" && !isNaN(s)
  );
  const kelembapanValid = kelembapanData.filter(
    k => typeof k === "number" && !isNaN(k)
  );

  return {
    min_suhu: Math.min(...suhuValid),
    max_suhu: Math.max(...suhuValid),
    avg_suhu: Number(
      (suhuValid.reduce((a, b) => a + b, 0) / suhuValid.length).toFixed(1)
    ),
    min_kelembapan: Math.min(...kelembapanValid),
    max_kelembapan: Math.max(...kelembapanValid),
    avg_kelembapan: Number(
      (kelembapanValid.reduce((a, b) => a + b, 0) / kelembapanValid.length).toFixed(1)
    ),
    labels,
    data_suhu: suhuData,
    data_kelembapan: kelembapanData,
    tanggal,
    ruangan
  };
}


/* ======================================================
   ROUTES
====================================================== */



/* ===== UJI COBA ROUTE MENAMBAH DATA ===== */
app.get("/ujicoba", async (req, res) => {

  const contohData = { 
    deviceID: "ESP32-001",
    suhu: Math.floor(Math.random() * 15) + 20, // Suhu acak antara 20-34
    kelembapan: Math.floor(Math.random() * 50) + 30, // Kelembapan acak antara 30-79
    ruangan: "A2",
    apiKey: "RAHASIA123",
    waktu: "2026-01-15 10:30:00"
  }
  await KondisiLingkungan.create(contohData);
  res.send("Menambahkan data uji coba...");
});




/* ===== DASHBOARD UTAMA (LIST TANGGAL) ===== */
app.get("/", async (req, res) => {
  const data_col = await KondisiLingkungan.find();

  const groupedByDate = {};
  data_col.forEach(d => {
    const tanggal = getTanggal(d.waktu);
    if (!groupedByDate[tanggal]) groupedByDate[tanggal] = [];
    groupedByDate[tanggal].push(d);
  });

  const hasil = Object.keys(groupedByDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .map(tanggal => {
      const dataHari = groupedByDate[tanggal];
      return {
        waktu: tanggal,
        stabilitas_suhu: cekStabilitasSuhu(dataHari),
        stabilitas_kelembapan: cekStabilitasKelembapan(dataHari),
        stabilitas_data: cekStabilitasData(dataHari),
      };
    });

  res.render("main", { data: hasil });
});

/* ===== LIST RUANGAN PER TANGGAL ===== */
app.get("/tanggal/:tanggal", async (req, res) => {
  const tanggal = req.params.tanggal;

  const data = await KondisiLingkungan.find({
    waktu: { $regex: tanggal }
  });

  const groupedByRuangan = {};
  data.forEach(d => {
    if (!groupedByRuangan[d.ruangan]) {
      groupedByRuangan[d.ruangan] = [];
    }
    groupedByRuangan[d.ruangan].push(d);
  });

  const hasil = Object.keys(groupedByRuangan).map(ruangan => {
    const dataRuangan = groupedByRuangan[ruangan];
    return {
      ruangan,
      tanggal,
      rata_rata_suhu: hitungRataRataSuhu(dataRuangan),
      rata_rata_kelembapan: hitungRataRataKelembapan(dataRuangan),
      stabilitas_suhu: cekStabilitasSuhu(dataRuangan),
      stabilitas_kelembapan: cekStabilitasKelembapan(dataRuangan),
      stabilitas_data: cekStabilitasData(dataRuangan)
    };
  });

  res.render("sub_section", { data: hasil });
});

/* ===== DETAIL GRAFIK PER RUANGAN ===== */
app.get("/tanggal/:date/ruangan/:nama", async (req, res) => {
  const tanggal = req.params.date;
  const ruangan = req.params.nama;

  const data = await KondisiLingkungan.find({
    waktu: { $regex: tanggal },
    ruangan: ruangan
  });

  const hasil = olahDataLingkungan(data, tanggal, ruangan);
  res.render("grafik", { data: hasil });
});


app.get("/health", (req, res) => {
  res.status(200).send("OK");
});


/* ===== API ESP32 ===== */
app.post("/api/iot/suhu", async (req, res) => {
  try {
    await KondisiLingkungan.create(req.body);
    console.log("Ini data Suhu baru");
    console.log(req.body);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   SERVER
====================================================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
