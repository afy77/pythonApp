# 📘 Panduan Lengkap Instalasi & Integrasi FastAPI dengan JENNIFER APM di WSL

Dokumentasi ini menjelaskan secara komprehensif seluruh alur kerja mulai dari persiapan lingkungan di WSL (Windows Subsystem for Linux), instalasi backend FastAPI, konfigurasi agen JENNIFER APM Python, hingga pengujian transaksi di dashboard monitoring JENNIFER.

---

## 🏛️ Arsitektur Aplikasi

```text
[ Windows Host ]
   ├── Browser Client ──────────> Frontend UI (Port 3000) [React + Vite]
   │                                      │
   │                                      ▼ (HTTP Fetch)
[ WSL2 Ubuntu ]                           │
   ├── FastAPI Backend (Port 8000) <──────┘
   │   ├── SQLite Database (app.db)
   │   └── JENNIFER Python Agent (jennifer-admin wrapper)
   │               │
   │               ▼ (TCP Socket 5000)
[ JENNIFER APM ]
   ├── JENNIFER Data Server (Port 5000)
   └── JENNIFER Web Console / Dashboard (X-View & Metrics)
```

---

## 📋 Daftar Isi
1. [Persiapan Lingkungan di WSL](#1-persiapan-lingkungan-di-wsl)
2. [Setup Virtual Environment & Dependensi](#2-setup-virtual-environment--dependensi)
3. [Instalasi JENNIFER APM Python Agent](#3-instalasi-jennifer-apm-python-agent)
4. [Konfigurasi Agen JENNIFER (`jennifer.ini`)](#4-konfigurasi-agen-jennifer-jenniferini)
5. [Menjalankan Aplikasi dengan Wrapper Agen JENNIFER](#5-menjalankan-aplikasi-dengan-wrapper-agen-jennifer)
6. [Menjalankan Frontend UI Dashboard (Opsional)](#6-menjalankan-frontend-ui-dashboard-opsional)
7. [Panduan Pengujian & Membaca Dashboard JENNIFER](#7-panduan-pengujian--membaca-dashboard-jennifer)
8. [Troubleshooting & Solusi Error Umum](#8-troubleshooting--solusi-error-umum)

---

## 1. Persiapan Lingkungan di WSL

### A. Masuk ke Terminal WSL
Buka Windows Terminal atau PowerShell, lalu ketik:
```bash
wsl
```

### B. Salin Proyek ke Filesystem Native Linux
Menyimpan file di filesystem native Linux (`~/pythonApp`) memaksimalkan kecepatan I/O:
```bash
cd ~
cp -r /mnt/d/rafi/apps/pythonApp ~/pythonApp
cd ~/pythonApp
```

### C. Install Paket Sistem yang Dibutuhkan
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nodejs npm
```

---

## 2. Setup Virtual Environment & Dependensi

### A. Buat dan Aktifkan Virtual Environment
```bash
cd ~/pythonApp
python3 -m venv venv
source venv/bin/activate
```
*(Pastikan prompt terminal diawali dengan tanda `(venv)`)*.

### B. Install Dependensi Backend FastAPI
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Instalasi JENNIFER APM Python Agent

Pasang paket resmi agen JENNIFER Python dari PyPI:
```bash
pip install jennifer-python
```

### Verifikasi Instalasi:
Periksa apakah perintah CLI `jennifer-admin` sudah terpasang:
```bash
which jennifer-admin
```
*Output yang diharapkan:* `/home/rafi/pythonApp/venv/bin/jennifer-admin` (atau `/home/rafi/venv/bin/jennifer-admin`).

---

## 4. Konfigurasi Agen JENNIFER (`jennifer.ini`)

Buat atau edit file konfigurasi `jennifer.ini` di dalam direktori proyek:

```bash
nano ~/pythonApp/jennifer.ini
```

Isi dengan konfigurasi berikut:

```ini
[JENNIFER]
# 1. Alamat IP & Port JENNIFER Data Server
# Gunakan 127.0.0.1 jika server di host yang sama, atau IP host Windows Anda
server_address = 127.0.0.1
server_port = 5000

# 2. Identitas Domain & Instance
# Sesuaikan domain_id dengan Domain yang ada di dashboard JENNIFER Anda (contoh: 1000 atau 1001)
domain_id = 1000

# Gunakan -1 agar nomor ID instance di-assign otomatis oleh Data Server
inst_id = -1

# 3. Pengaturan Logging & Profiling
log_path = /tmp/jennifer-python-agent.log
profile_sql = true
profile_sql_param = true
profile_method = true
trace_unhandled_exception = true
error_http_status = 500,502,503,504
```
*(Simpan: `Ctrl + O` -> `Enter`, Keluar: `Ctrl + X`)*.

---

## 5. Menjalankan Aplikasi dengan Wrapper Agen JENNIFER

Karena FastAPI menggunakan arsitektur asynchronous (ASGI) di atas Uvicorn, gunakan perintah **`runasync`** dengan mereferensikan file konfigurasi:

```bash
cd ~/pythonApp
source venv/bin/activate

JENNIFER_CONFIG_FILE=/home/rafi/pythonApp/jennifer.ini jennifer-admin runasync uvicorn --loop asyncio main:app --host 0.0.0.0 --port 8000
```

### ✅ Indikator Berhasil:
Pada log terminal saat startup, Anda akan melihat output berikut:
```text
[jennifer] ('proxy address: /tmp/jennifer-xxxx.sock',)
[jennifer] ('connected',)
---------------- [App Initialized] ----------------------
MachineName =  DESKTOP-xxxx
Python Version =  3.12.3 CPython
Jennifer Server Address =  127.0.0.1:5000
Jennifer Python Agent Domain ID =  1000
Jennifer Python Agent Inst ID =  100xx
---------------------------------------------------------
INFO:     Started server process [xxxxx]
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 6. Menjalankan Frontend UI Dashboard (Opsional)

Jika ingin menggunakan antarmuka grafis web (React/Vite):

1. Buka tab terminal WSL baru.
2. Masuk ke direktori proyek dan jalankan:
   ```bash
   cd ~/pythonApp
   npm install --legacy-peer-deps
   npm run dev
   ```
3. Akses antarmuka web di browser Windows:
   * 🌐 **Dashboard UI**: [http://localhost:3000](http://localhost:3000)
   * ⚙️ **Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 7. Panduan Pengujian & Membaca Dashboard JENNIFER

### A. Pengujian Transaksi Normal (CRUD Items)
* Lakukan tambah, edit, atau lihat data item via UI di `http://localhost:3000` (Tab CRUD Playground) atau via Swagger Docs.
* **Hasil di JENNIFER**: Muncul titik biru/hijau di bagian bawah grafik X-View (< 100 ms).

### B. Pengujian Slow Transaction & SQL Profiling
Akses endpoint simulasi lambat di browser:
👉 `http://localhost:8000/api/test/slow?delay=3.0&queries=5`

* **Hasil di JENNIFER**:
  1. Pada grafik **X-View**, muncul titik di zona atas (**> 3.000 ms**).
  2. Klik atau *drag-select* titik tersebut untuk membuka **Transaction Profile**.
  3. Anda dapat melihat detail **Call Tree**, durasi fungsi `time.sleep()`, serta query SQL `SELECT count(*) FROM items` dan parameter bind-nya.

### C. Pengujian Exception & Error Alert
Akses endpoint simulasi error:
👉 `http://localhost:8000/api/test/error?error_type=unhandled`

* **Hasil di JENNIFER**:
  1. Pada grafik **X-View**, transaksi ditandai dengan **titik merah (Exception Dot)**.
  2. Muncul alert di panel **Exception Analysis** dengan pesan error `ValueError` dan baris kode `main.py`.

### D. Pengujian Traffic Otomatis Terus-Menerus (Load Tester)
Buka terminal WSL terpisah, lalu jalankan:
```bash
cd ~/pythonApp
source venv/bin/activate

# Jalankan generator traffic campuran (70% normal, 20% slow, 10% error) selama 60 detik
python load_tester.py --mode mixed --duration 60 --rate 2
```

---

## 8. Troubleshooting & Solusi Error Umum

| Gejala Error | Penyebab | Solusi |
|---|---|---|
| `jennifer: command not found` | Perintah CLI dari paket `jennifer-python` bernama `jennifer-admin`. | Gunakan perintah `jennifer-admin`. |
| `JENNIFER_CONFIG_FILE is not set` | Variabel lingkungan lokasi config belum disertakan. | Sertakan `JENNIFER_CONFIG_FILE=/path/to/jennifer.ini` di depan perintah `jennifer-admin`. |
| `Jennifer Server Address = :0` & `Domain ID = 0` | File config tidak memiliki section header `[JENNIFER]`. | Tambahkan baris `[JENNIFER]` di baris pertama file `jennifer.ini`. |
| `PydanticUserError: "Config" and "model_config"` | Pydantic V2 tidak mengizinkan `class Config:` bersamaan dengan `model_config`. | Hapus `class Config:` di `schemas.py`, cukup gunakan `model_config = ConfigDict(from_attributes=True)`. |
| `npm error ERESOLVE could not resolve` | Konflik versi peer dependency antara Vite dan esbuild. | Jalankan `npm install --legacy-peer-deps`. |
