# FastAPI CRUD & JENNIFER APM Test Suite

Aplikasi REST API CRUD sederhana berbasis **Python FastAPI** dan **SQLite (`app.db`)** yang dirancang khusus untuk diuji dan dimonitoring secara lokal menggunakan **JENNIFER APM (Application Performance Monitoring)**.

Aplikasi ini dilengkapi dengan endpoint transaksi standar dan endpoint pengujian khusus untuk menguji grafik **X-View**, **Slow Transaction**, **SQL Trace Profiling**, serta **Exception Alert**.

---

## 📁 Struktur Direktori

```text
.
├── requirements.txt   # Dependensi: FastAPI, Uvicorn, SQLAlchemy, Pydantic
├── database.py        # Konfigurasi koneksi SQLite lokal (app.db) & session generator
├── models.py          # Model SQLAlchemy tabel 'items' (id, name, description, price, stock, created_at)
├── schemas.py         # Skema Pydantic validasi request & response
├── crud.py            # Operasi query database (get, create, update, delete)
├── main.py            # Routing FastAPI CRUD & endpoint pengujian APM (/api/test/slow, /api/test/error)
├── jennifer.conf      # File konfigurasi agen JENNIFER APM Python
└── README.md          # Panduan instalasi dan pengujian lengkap
```

---

## ⚙️ Persyaratan Sistem

- Python 3.8, 3.9, 3.10, atau 3.11+
- Virtual Environment (`venv` atau `conda`)
- Paket agen JENNIFER APM untuk Python (disediakan oleh JENNIFER Soft / vendor)

---

## 🚀 Panduan Instalasi & Persiapan Lingkungan

### 1. Buat dan Aktifkan Virtual Environment

Buka terminal di root direktori proyek, lalu jalankan:

**Di Linux / macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Di Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Di Windows (Command Prompt):**
```cmd
python -m venv venv
.\venv\Scripts\activate.bat
```

### 2. Install Dependensi Aplikasi

Pastikan virtual environment telah aktif, lalu pasang paket yang dibutuhkan:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Install Agen JENNIFER APM untuk Python

Instalasi agen JENNIFER Python dapat dilakukan melalui paket wheel/tar.gz yang disediakan oleh administrator JENNIFER:

```bash
# Contoh pemasangan dari package lokal jennifer-agent
pip install jennifer
# atau jika menggunakan file wheel installer dari paket vendor:
# pip install jennifer_agent-*.whl
```

---

## 🔧 Konfigurasi Agen JENNIFER (`jennifer.conf`)

Edit file `jennifer.conf` dan sesuaikan dengan identitas server JENNIFER Anda:

```ini
# Alamat IP Data Server JENNIFER
server_address = 127.0.0.1

# Port Data Server JENNIFER (default: 5000)
server_port = 5000

# ID Domain JENNIFER
domain_id = 1001

# ID Instance Agen (angka integer unik untuk instance ini)
inst_id = 10011

# Nama display instance di dashboard JENNIFER
inst_name = fastapi_sqlite_app

# Batas waktu respon Slow Transaction (milidetik)
slow_threshold = 3000

# Pengaktifan profiling SQL & Method
profile_sql = true
profile_sql_param = true
profile_method = true

# Alert exception status HTTP 500
trace_unhandled_exception = true
error_http_status = 500,502,503,504
```

---

## ▶️ Cara Menjalankan Aplikasi

### Opsi A: Menjalankan Tanpa Agen APM (Pengujian Lokal Biasa)

Untuk memastikan kode berjalan normal:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Akses dokumentasi interaktif Swagger UI di: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Opsi B: Menjalankan Menggunakan Wrapper Agen JENNIFER (Rekomendasi)

Jalankan perintah wrapper `jennifer run` dengan mereferensikan file konfigurasi:

```bash
jennifer run -c ./jennifer.conf uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

> **Catatan:**
> - Gunakan `--workers 1` pada pengujian awal agar ID instance agen tetap konsisten pada satu proses worker.
> - Jika perintah `jennifer` tidak langsung dikenali di PATH, gunakan pemanggilan modul Python:
>   ```bash
>   python -m jennifer.run -c ./jennifer.conf uvicorn main:app --host 0.0.0.0 --port 8000
>   ```

---

## 🧪 Panduan Pengujian API & Monitoring JENNIFER APM

### 1. Pengujian CRUD Standar

#### Tambah Item Baru (POST /items)
```bash
curl -X POST "http://localhost:8000/items" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Mechanical Keyboard RGB",
       "description": "Switch Brown hot-swappable dengan keycaps PBT",
       "price": 850000.0,
       "stock": 25
     }'
```

#### Ambil Semua Item (GET /items)
```bash
curl -X GET "http://localhost:8000/items?skip=0&limit=10"
```

#### Ambil Detail Item (GET /items/{id})
```bash
curl -X GET "http://localhost:8000/items/1"
```

#### Perbarui Data Item (PUT /items/{id})
```bash
curl -X PUT "http://localhost:8000/items/1" \
     -H "Content-Type: application/json" \
     -d '{
       "price": 799000.0,
       "stock": 30
     }'
```

#### Hapus Item (DELETE /items/{id})
```bash
curl -X DELETE "http://localhost:8000/items/1"
```

---

### 2. Pengujian Khusus APM: Slow Transaction (`/api/test/slow`)

Endpoint ini sengaja mengeksekusi `time.sleep(3)` dan query database SQLite berulang:

```bash
curl -X GET "http://localhost:8000/api/test/slow?delay=3.0&queries=5"
```

**Hasil yang Diharapkan di JENNIFER APM:**
1. **X-View Graph**: Muncul titik transaksi pada posisi sumbu Y di atas threshold **3000 ms (3 detik)**.
2. **Profile & SQL Trace**: Saat titik transaksi di X-View di-drag atau diklik:
   - Terlihat method trace `simulate_slow_transaction`.
   - Terlihat durasi sleep `time.sleep`.
   - Terlihat deretan query SQL `SELECT count(*) FROM items` dan `SELECT items.* FROM items LIMIT 5`.

---

### 3. Pengujian Khusus APM: Exception Alert (`/api/test/error`)

#### Uji 3A: Melempar Unhandled Exception (`ValueError`)
```bash
curl -X GET "http://localhost:8000/api/test/error?error_type=unhandled"
```
**Hasil di JENNIFER APM:**
- Pada **X-View**, transaksi akan ditandai dengan **titik merah (Exception Dot)**.
- Pada panel **Exception Alert**, muncul notifikasi error berupa `ValueError` lengkap dengan call stack baris kode `main.py`.

#### Uji 3B: Melempar HTTP 500 Internal Server Error
```bash
curl -X GET "http://localhost:8000/api/test/error?error_type=http_500"
```
**Hasil di JENNIFER APM:**
- Muncul status HTTP 500 pada log transaksi dan alert error HTTP status.

---

### 4. Pengujian Otomatis Transaksi Kontinu (Load / Traffic Generator)

Untuk menguji grafik X-View JENNIFER APM secara dinamis dengan aliran transaksi terus-menerus, gunakan skrip `load_tester.py` yang telah disediakan:

#### A. Mode Campuran Realistis (70% Cepat, 20% Lambat, 10% Error) selama 60 detik:
```bash
python load_tester.py --mode mixed --duration 60 --rate 2
```

#### B. Mode Cepat Saja (<100ms) selama 30 detik:
```bash
python load_tester.py --mode fast --duration 30 --rate 3
```

#### C. Mode Lambat Saja (Menguji Antrian Slow Transaction):
```bash
python load_tester.py --mode slow --duration 30 --rate 1
```

#### D. Berjalan Terus-Menerus Tanpa Batas Waktu:
```bash
python load_tester.py --mode mixed --duration 0 --rate 1.5
# Tekan Ctrl+C di terminal untuk menghentikan
```

---

## 📊 Ringkasan Cara Membaca Dashboard JENNIFER APM

| Fitur Dashboard | Fungsi & Cara Validasi |
|-----------------|------------------------|
| **Real-Time Active Service** | Menampilkan transaksi yang sedang aktif diproses (terlihat saat endpoint `/api/test/slow` sedang dieksekusi selama 3 detik). |
| **X-View (Scatter Plot)** | Setiap titik mewakili 1 request. Titik normal berada di bawah 1 detik; titik dari `/api/test/slow` berada di zona atas (> 3s); titik error (`/api/test/error`) berwarna merah. |
| **Transaction Profile** | Drag area titik pada X-View untuk membuka popup Call Tree, rincian SQL Query, waktu eksekusi per layer, dan query parameter. |
| **Exception Analysis** | Membuka daftar error yang tertangkap agen, frekuensi kejadian, dan traceback kode sumber. |
