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
const SuhuRuanganSchema = new mongoose.Schema({
  deviceID: String,
  suhu: Number,
  ruangan: String,
  apiKey: String,
  waktu: String
});

const SuhuRuangan = mongoose.model("SuhuRuangan", SuhuRuanganSchema);

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

function hitungRataRataSuhu(data) {
  const suhuValid = data
    .map(d => d.suhu)
    .filter(s => typeof s === "number" && !isNaN(s));

  if (suhuValid.length === 0) return null;

  return Number(
    (suhuValid.reduce((a, b) => a + b, 0) / suhuValid.length).toFixed(1)
  );
}

function olahDataSuhu(data, tanggal, ruangan) {
  const sorted = [...data].sort(
    (a, b) =>
      new Date(a.waktu.replace(" ", "T")) -
      new Date(b.waktu.replace(" ", "T"))
  );

  const labels = [];
  const suhuData = [];

  sorted.forEach(d => {
    const jam = d.waktu.split(" ")[1].slice(0, 5);
    labels.push(jam);
    suhuData.push(d.suhu);
  });

  const suhuValid = suhuData.filter(
    s => typeof s === "number" && !isNaN(s)
  );

  return {
    min: Math.min(...suhuValid),
    max: Math.max(...suhuValid),
    avg: Number(
      (suhuValid.reduce((a, b) => a + b, 0) / suhuValid.length).toFixed(1)
    ),
    labels,
    data: suhuData,
    tanggal,
    ruangan
  };
}

/* ======================================================
   ROUTES
====================================================== */

/* ===== DASHBOARD UTAMA (LIST TANGGAL) ===== */
app.get("/", async (req, res) => {
  const data_col = await SuhuRuangan.find();

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
        stabilitas_data: cekStabilitasData(dataHari)
      };
    });

  res.render("main", { data: hasil });
});

/* ===== LIST RUANGAN PER TANGGAL ===== */
app.get("/tanggal/:tanggal", async (req, res) => {
  const tanggal = req.params.tanggal;

  const data = await SuhuRuangan.find({
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
      rata_rata: hitungRataRataSuhu(dataRuangan),
      stabilitas_suhu: cekStabilitasSuhu(dataRuangan),
      stabilitas_data: cekStabilitasData(dataRuangan)
    };
  });

  res.render("sub_section", { data: hasil });
});

/* ===== DETAIL GRAFIK PER RUANGAN ===== */
app.get("/tanggal/:date/ruangan/:nama", async (req, res) => {
  const tanggal = req.params.date;
  const ruangan = req.params.nama;

  const data = await SuhuRuangan.find({
    waktu: { $regex: tanggal },
    ruangan: ruangan
  });

  const hasil = olahDataSuhu(data, tanggal, ruangan);
  res.render("grafik", { data: hasil });
});


app.get("/health", (req, res) => {
  res.status(200).send("OK");
});


/* ===== API ESP32 ===== */
app.post("/api/iot/suhu", async (req, res) => {
  try {
    await SuhuRuangan.create(req.body);
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
