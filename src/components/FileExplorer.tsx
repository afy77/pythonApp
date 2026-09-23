import React, { useState } from 'react';
import { Check, Copy, Download, FileCode, Folder, Terminal } from 'lucide-react';
import JSZip from 'jszip';
import { PROJECT_FILES } from '../data/projectFiles';
import { ProjectFile } from '../types';

export const FileExplorer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(PROJECT_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = (file: ProjectFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
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
      console.error('Failed to generate ZIP', err);
    } finally {
      setDownloadingZip(false);
    }
  };

  const lines = selectedFile.content.split('\n');

  return (
    <div id="file-explorer-container" className="flex flex-col lg:flex-row gap-6 w-full">
      {/* File List Navigation */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Folder className="w-4 h-4 text-amber-500" />
            <span>Struktur File Proyek</span>
          </div>
          <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {PROJECT_FILES.length} file
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.name === file.name;
              return (
                <button
                  key={file.name}
                  id={`file-btn-${file.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 ${
                    isSelected
                      ? 'bg-blue-50/80 border-l-4 border-blue-600 pl-2.5'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <FileCode
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      isSelected ? 'text-blue-600' : 'text-slate-600'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`text-sm font-mono truncate font-medium ${
                          isSelected ? 'text-blue-900 font-semibold' : 'text-slate-800'
                        }`}
                      >
                        {file.name}
                      </span>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {file.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-1">
                      {file.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Download All ZIP Action */}
        <button
          id="btn-download-all-zip"
          onClick={handleDownloadZip}
          disabled={downloadingZip}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-medium text-sm transition-all shadow-xs disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{downloadingZip ? 'Mengompres File...' : 'Download Seluruh File (.ZIP)'}</span>
        </button>
      </div>

      {/* Code Viewer Panel */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        {/* Code Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="font-mono text-xs text-slate-300 font-medium ml-2 truncate">
              {selectedFile.path}
            </span>
            <span className="text-[11px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-mono">
              {lines.length} baris
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-copy-code"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors"
              title="Salin isi file ke clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Kode</span>
                </>
              )}
            </button>

            <button
              id="btn-download-single"
              onClick={() => handleDownloadSingle(selectedFile)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors"
              title="Download file ini"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* File Description Header */}
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{selectedFile.description}</span>
        </div>

        {/* Code Content View */}
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[640px] p-4 text-xs font-mono leading-relaxed text-slate-100 bg-slate-900 select-text">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50">
                  <td className="text-right pr-4 text-slate-400 select-none w-10 align-top">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre align-top text-slate-100">
                    {line.startsWith('#') || line.startsWith('//') ? (
                      <span className="text-slate-400 italic">{line}</span>
                    ) : line.includes('def ') || line.includes('class ') ? (
                      <span className="text-cyan-300">{line}</span>
                    ) : line.includes('import ') || line.includes('from ') ? (
                      <span className="text-purple-300">{line}</span>
                    ) : line.includes('raise ') || line.includes('HTTPException') ? (
                      <span className="text-amber-300 font-semibold">{line}</span>
                    ) : (
                      line
                    )}
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
