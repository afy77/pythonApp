"""
load_tester.py
Skrip generator transaksi otomatis (Traffic / Load Generator) untuk menguji
performa aplikasi FastAPI dan monitoring JENNIFER APM.

Dibuat menggunakan modul bawaan Python (urllib) sehingga tidak memerlukan
pustaka tambahan (zero-dependency).

Contoh penggunaan:
    python load_tester.py --mode mixed --duration 30 --rate 2
    python load_tester.py --mode fast --duration 60
    python load_tester.py --mode slow --duration 20
"""

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "http://localhost:8000"


def send_request(url: str, method: str = "GET", data: dict = None) -> dict:
    """Mengirim request HTTP dan mengukur waktu respon (latency)."""
    start = time.perf_counter()
    headers = {"User-Agent": "Jennifer-LoadTester/1.0"}
    encoded_data = None

    if data:
        encoded_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        url, data=encoded_data, headers=headers, method=method
    )

    status_code = 0
    error_msg = None

    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            status_code = resp.status
    except urllib.error.HTTPError as http_err:
        status_code = http_err.code
        error_msg = f"HTTP {http_err.code}"
    except urllib.error.URLError as url_err:
        status_code = 0
        error_msg = f"Connection failed: {url_err.reason}"
    except Exception as exc:
        status_code = 0
        error_msg = str(exc)

    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    return {
        "status_code": status_code,
        "latency_ms": latency_ms,
        "error": error_msg,
    }


def main():
    parser = argparse.ArgumentParser(
        description="JENNIFER APM Traffic Generator for FastAPI Test Suite"
    )
    parser.add_argument(
        "--url",
        type=str,
        default=DEFAULT_BASE_URL,
        help="Base URL server FastAPI (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--mode",
        choices=["fast", "slow", "mixed"],
        default="mixed",
        help="Profil transaksi: 'fast' (cepat), 'slow' (lambat), 'mixed' (campuran realistis)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=30,
        help="Durasi generator berjalan dalam detik (default: 30 detik; 0 untuk tanpa batas)",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=1.5,
        help="Target pengiriman request per detik (default: 1.5 req/s)",
    )
    parser.add_argument(
        "--slow-delay",
        type=float,
        default=3.0,
        help="Durasi latensi transaksi lambat dalam detik (default: 3.0 detik)",
    )
    parser.add_argument(
        "--fast-delay",
        type=float,
        default=0.05,
        help="Durasi delay transaksi cepat dalam detik (default: 0.05 detik)",
    )
    parser.add_argument(
        "--queries",
        type=int,
        default=4,
        help="Jumlah query database yang dieksekusi pada slow transaction (default: 4)",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("🚀 JENNIFER APM Traffic Generator")
    print(f"Target Server : {args.url}")
    print(f"Mode          : {args.mode.upper()}")
    print(f"Fast Delay    : {args.fast_delay} detik ({int(args.fast_delay * 1000)} ms)")
    print(f"Slow Delay    : {args.slow_delay} detik ({int(args.slow_delay * 1000)} ms)")
    print(f"DB Queries    : {args.queries} queries")
    print(
        f"Durasi        : {args.duration} detik"
        if args.duration > 0
        else "Durasi        : Berjalan terus (Tekan Ctrl+C untuk stop)"
    )
    print(f"Target Rate   : {args.rate} request/detik")
    print("=" * 70)

    start_time = time.time()
    total_sent = 0
    normal_count = 0
    slow_count = 0
    error_count = 0

    endpoints_fast = [
        ("GET", "/items?skip=0&limit=10"),
        ("GET", "/health"),
        ("GET", f"/api/test/slow?delay={args.fast_delay}&queries=1"),
        (
            "POST",
            "/items",
            {"name": "Random Item", "price": 150000.0, "stock": 10},
        ),
    ]

    try:
        while True:
            elapsed = time.time() - start_time
            if args.duration > 0 and elapsed >= args.duration:
                print("\n⏱️ Durasi yang ditentukan telah selesai.")
                break

            # Tentukan tipe endpoint berdasarkan mode
            if args.mode == "fast":
                choice = "fast"
            elif args.mode == "slow":
                choice = "slow"
            else:
                # Mode mixed: 70% fast, 20% slow, 10% error
                rnd = random.random()
                if rnd < 0.70:
                    choice = "fast"
                elif rnd < 0.90:
                    choice = "slow"
                else:
                    choice = "error"

            # Eksekusi request sesuai pilihan
            if choice == "fast":
                method, path, *extra = random.choice(endpoints_fast)
                payload = extra[0] if extra else None
                url = f"{args.url}{path}"
            elif choice == "slow":
                method = "GET"
                delay = round(random.uniform(args.slow_delay, args.slow_delay + 0.8), 2)
                url = f"{args.url}/api/test/slow?delay={delay}&queries={args.queries}"
                payload = None
            else:  # error
                method = "GET"
                err_type = random.choice(["unhandled", "http_500"])
                url = f"{args.url}/api/test/error?error_type={err_type}"
                payload = None

            total_sent += 1
            res = send_request(url, method=method, data=payload)

            # Klasifikasi status untuk statistik
            if res["status_code"] in [200, 201]:
                if res["latency_ms"] >= (args.slow_delay * 1000):
                    slow_count += 1
                    status_tag = "🟡 [SLOW]"
                else:
                    normal_count += 1
                    status_tag = "🟢 [NORMAL]"
            else:
                error_count += 1
                status_tag = "🔴 [ERROR]"

            timestamp = time.strftime("%H:%M:%S")
            print(
                f"[{timestamp}] #{total_sent:03d} {status_tag} {method:<4} {url:<45} "
                f"-> Status: {res['status_code']} | Latency: {res['latency_ms']} ms"
            )

            # Interval delay berdasarkan target rate
            interval = 1.0 / max(args.rate, 0.1)
            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n\n🛑 Dihentikan oleh pengguna (Ctrl+C).")

    total_time = round(time.time() - start_time, 2)
    tps = round(total_sent / total_time, 2) if total_time > 0 else 0

    print("=" * 70)
    print("📊 Ringkasan Hasil Pengujian:")
    print(f"Total Request Terkirim : {total_sent}")
    print(f"Total Waktu Berjalan   : {total_time} detik ({tps} req/detik)")
    print(f"Transaksi Normal (<3s) : {normal_count}")
    print(
        f"Slow Transaction (>3s) : {slow_count}  -> Terbaca di zona lambat X-View"
    )
    print(
        f"Exception / Error      : {error_count}  -> Terbaca di panel alert JENNIFER"
    )
    print("=" * 70)


if __name__ == "__main__":
    main()
