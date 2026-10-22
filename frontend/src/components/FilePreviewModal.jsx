import React from 'react';
import { useERP } from '../context/ERPContext.jsx';
import { X, ExternalLink, Download, FileText, Loader2 } from 'lucide-react';

export default function FilePreviewModal() {
  const { previewFile, closeFilePreview } = useERP();

  if (!previewFile) return null;

  const { name, url, loading } = previewFile;
  const isImage = url && (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('image'));

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
      style={{ zIndex: 100100 }}
      onClick={closeFilePreview}
    >
      <div
        className="flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate m-0">
                {name || 'Attachment Preview'}
              </h3>
              <span className="text-[11px] text-slate-500">
                Secure ImageKit signed asset
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-xs flex items-center gap-1.5"
                title="Open in new window"
              >
                <ExternalLink size={13} />
                <span>Open Raw</span>
              </a>
            )}
            <button
              onClick={closeFilePreview}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px] bg-slate-100/60">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 size={28} className="animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Generating secure signed preview...</span>
            </div>
          ) : isImage ? (
            <img
              src={url}
              alt={name}
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-xs"
            />
          ) : url ? (
            <iframe
              src={url}
              title={name}
              className="w-full h-[70vh] rounded-xl border border-slate-200 bg-white"
            />
          ) : (
            <div className="text-xs text-rose-500 font-semibold">
              Failed to load preview for this file.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
