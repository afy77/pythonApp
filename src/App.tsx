import React, { useState } from 'react';
import {
  Activity,
  Code2,
  Download,
  FileCode2,
  FolderGit2,
  Layers,
  Package,
  Terminal,
} from 'lucide-react';
import JSZip from 'jszip';
import { FileExplorer } from './components/FileExplorer';
import { ApmSimulator } from './components/ApmSimulator';
import { CrudPlayground } from './components/CrudPlayground';
import { SetupGuide } from './components/SetupGuide';
import { PROJECT_FILES } from './data/projectFiles';

type TabType = 'files' | 'apm' | 'crud' | 'guide';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

  const handleDownloadAllZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      PROJECT_FILES.forEach((f) => {
        zip.file(f.name, f.content);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fastapi-jennifer-apm-suite.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download ZIP', err);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-200">
      {/* Top Application Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  FastAPI CRUD & JENNIFER APM Test Suite
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">
                  Python 3.10 + SQLite
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Aplikasi CRUD lokal dengan endpoint Slow Transaction & Exception Alert untuk JENNIFER APM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="header-btn-download-zip"
              onClick={handleDownloadAllZip}
              disabled={downloadingZip}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingZip ? 'Mengompres...' : 'Download Project (.ZIP)'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto border-t border-slate-100">
          <button
            id="tab-btn-files"
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'files'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>Source Code & File Proyek ({PROJECT_FILES.length})</span>
          </button>

          <button
            id="tab-btn-apm"
            onClick={() => setActiveTab('apm')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'apm'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-600" />
            <span>JENNIFER APM Simulator (X-View)</span>
          </button>

          <button
            id="tab-btn-crud"
            onClick={() => setActiveTab('crud')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'crud'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>FastAPI CRUD Sandbox</span>
          </button>

          <button
            id="tab-btn-guide"
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Terminal className="w-4 h-4 text-amber-600" />
            <span>Panduan Instalasi & Eksekusi CLI</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'files' && <FileExplorer />}
        {activeTab === 'apm' && <ApmSimulator />}
        {activeTab === 'crud' && <CrudPlayground />}
        {activeTab === 'guide' && <SetupGuide />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-xs text-slate-700 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>FastAPI + SQLite + JENNIFER APM Integration Suite</span>
          <span className="font-mono text-slate-700">
            Endpoint: <code className="text-blue-700 font-semibold">/items</code> •{' '}
            <code className="text-amber-700 font-semibold">/api/test/slow</code> •{' '}
            <code className="text-rose-700 font-semibold">/api/test/error</code>
          </span>
        </div>
      </footer>
    </div>
  );
}
