import React, { useState } from 'react';
import {
  Check,
  CheckCircle,
  Code2,
  Copy,
  Cpu,
  FileText,
  Key,
  Layers,
  PlayCircle,
  Sliders,
  Terminal,
} from 'lucide-react';

export const SetupGuide: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const steps = [
    {
      title: '1. Pembuatan Virtual Environment Python',
      desc: 'Isolasi dependensi Python ke dalam virtual environment lokal agar tidak bertabrakan dengan sistem.',
      commands: [
        { label: 'Linux / macOS', code: 'python3 -m venv venv\nsource venv/bin/activate', id: 'venv-unix' },
        { label: 'Windows (PowerShell)', code: 'python -m venv venv\n.\\venv\\Scripts\\Activate.ps1', id: 'venv-win' },
      ],
    },
    {
      title: '2. Instalasi Dependensi Aplikasi',
      desc: 'Install FastAPI, Uvicorn, SQLAlchemy, dan Pydantic yang terdaftar pada requirements.txt.',
      commands: [
        { label: 'Terminal', code: 'pip install --upgrade pip\npip install -r requirements.txt', id: 'pip-install' },
      ],
    },
    {
      title: '3. Instalasi Agen JENNIFER APM Python',
      desc: 'Pasang library agen JENNIFER Python yang disediakan oleh vendor / JENNIFER Data Server.',
      commands: [
        { label: 'Terminal', code: 'pip install jennifer\n# Atau install dari file wheel lokal:\n# pip install jennifer_agent-*.whl', id: 'jennifer-install' },
      ],
    },
    {
      title: '4. Menjalankan Aplikasi Bersama Agen JENNIFER',
      desc: 'Jalankan FastAPI (Uvicorn) melalui wrapper agen JENNIFER dengan menyertakan jennifer.conf.',
      commands: [
        {
          label: 'Perintah Utama (JENNIFER CLI Wrapper)',
          code: 'jennifer run -c ./jennifer.conf uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1',
          id: 'run-jennifer',
        },
        {
          label: 'Alternatif Python Module Execution',
          code: 'python -m jennifer.run -c ./jennifer.conf uvicorn main:app --host 0.0.0.0 --port 8000',
          id: 'run-module',
        },
      ],
    },
    {
      title: '5. Pengujian Transaksi Kontinu (Traffic Generator load_tester.py)',
      desc: 'Kirim transaksi secara otomatis dan terus-menerus ke server FastAPI untuk memantau grafik X-View JENNIFER APM secara real-time.',
      commands: [
        {
          label: 'Mode Campur (70% Cepat, 20% Lambat, 10% Error) - 60 Detik',
          code: 'python load_tester.py --mode mixed --duration 60 --rate 2',
          id: 'load-mixed',
        },
        {
          label: 'Mode Cepat Saja (<100ms) - 30 Detik',
          code: 'python load_tester.py --mode fast --duration 30 --rate 3',
          id: 'load-fast',
        },
        {
          label: 'Mode Lambat Saja (>3000ms Slow Transaction) - 30 Detik',
          code: 'python load_tester.py --mode slow --duration 30 --rate 1',
          id: 'load-slow',
        },
        {
          label: 'Berjalan Terus Tanpa Batas Waktu (Stop dengan Ctrl+C)',
          code: 'python load_tester.py --mode mixed --duration 0 --rate 1.5',
          id: 'load-unlimited',
        },
      ],
    },
  ];

  const configParams = [
    {
      key: 'server_address',
      example: '127.0.0.1',
      desc: 'Alamat IP atau hostname Data Server JENNIFER yang menerima data profiling.',
    },
    {
      key: 'server_port',
      example: '5000',
      desc: 'Port komunikasi data server JENNIFER (biasanya port 5000 atau 5001).',
    },
    {
      key: 'domain_id',
      example: '1001',
      desc: 'ID Domain JENNIFER yang telah didaftarkan untuk mengelompokkan aplikasi.',
    },
    {
      key: 'inst_id',
      example: '10011',
      desc: 'ID unik instance agen (integer). Setiap proses worker/instance memiliki ID tersendiri.',
    },
    {
      key: 'slow_threshold',
      example: '3000',
      desc: 'Batas respon waktu lambat (dalam milidetik). Transaksi di atas 3000ms ditandai di X-View.',
    },
    {
      key: 'profile_sql',
      example: 'true',
      desc: 'Mengaktifkan pencatatan detail query SQL SQLAlchemy & SQLite ke Call Tree profiler.',
    },
    {
      key: 'trace_unhandled_exception',
      example: 'true',
      desc: 'Menangkap unhandled error (misal ValueError) dan mengirimkan notifikasi ke Exception Alert.',
    },
  ];

  return (
    <div id="setup-guide-root" className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-start gap-3">
          <Cpu className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-900 text-sm">ASGI / FastAPI Hook</div>
            <div className="text-xs text-slate-700 mt-1 leading-relaxed">
              Agen JENNIFER mem-wrap siklus event loop Uvicorn & SQLAlchemy untuk mengukur request latency dan query SQL secara non-intrusif.
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-start gap-3">
          <Layers className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-900 text-sm">X-View Scatter Plot</div>
            <div className="text-xs text-slate-700 mt-1 leading-relaxed">
              Setiap request endpoint dipetakan menjadi sebuah titik pada grafik waktu. Slow transaction (&gt;3000ms) langsung terlihat jelas sebagai outlier.
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-start gap-3">
          <Sliders className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-900 text-sm">Konfigurasi jennifer.conf</div>
            <div className="text-xs text-slate-700 mt-1 leading-relaxed">
              Parameter server_address, server_port, domain_id, dan inst_id menentukan rute data telemetry ke JENNIFER Data Server Anda.
            </div>
          </div>
        </div>
      </div>

      {/* Step by Step Execution Guide */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-slate-700" />
          <h3 className="font-bold text-slate-900 text-base">
            Panduan Langkah Instalasi & Eksekusi di Terminal
          </h3>
        </div>

        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">{step.title}</h4>
                  <p className="text-xs text-slate-700 mt-0.5">{step.desc}</p>
                </div>
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
              </div>

              <div className="space-y-2 mt-1">
                {step.commands.map((cmd) => {
                  const isCopied = copiedId === cmd.id;
                  return (
                    <div
                      key={cmd.id}
                      className="bg-slate-900 rounded-lg p-3 text-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase font-mono text-cyan-400 font-semibold mb-1">
                          {cmd.label}
                        </div>
                        <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap select-all">
                          {cmd.code}
                        </pre>
                      </div>

                      <button
                        onClick={() => copyToClipboard(cmd.code, cmd.id)}
                        className="self-end sm:self-center shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
                        title="Salin perintah"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Disalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JENNIFER Configuration Reference */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-amber-600" />
          <h3 className="font-bold text-slate-900 text-sm">
            Rincian Parameter Kunci jennifer.conf
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px]">
                <th className="py-2.5 px-3 w-48 font-mono">Parameter</th>
                <th className="py-2.5 px-3 w-32 font-mono">Contoh Nilai</th>
                <th className="py-2.5 px-3">Penjelasan & Pengaruh di JENNIFER APM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configParams.map((param) => (
                <tr key={param.key} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-mono font-semibold text-blue-700">
                    {param.key}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700 bg-slate-50/80">
                    {param.example}
                  </td>
                  <td className="py-3 px-3 text-slate-700 leading-relaxed">
                    {param.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
