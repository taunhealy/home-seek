'use client';

import React from 'react';
import { Heart, Sparkle, X } from '@phosphor-icons/react';

interface FavouritesImportModalProps {
  isOpen: boolean;
  importInputText: string;
  importedCount: number;
  isImporting: boolean;
  importStatusMsg: { type: 'success' | 'error'; text: string } | null;
  onClose: () => void;
  onChangeInput: (val: string) => void;
  onClearAll: () => void;
  onImport: () => void;
}

export const FavouritesImportModal: React.FC<FavouritesImportModalProps> = ({
  isOpen,
  importInputText,
  importedCount,
  isImporting,
  importStatusMsg,
  onClose,
  onChangeInput,
  onClearAll,
  onImport,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <Heart size={20} weight="fill" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-zinc-950">Import Property24 Favourites</h3>
              <p className="text-xs text-zinc-500">Paste your saved Property24 links or page HTML</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Input area */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-zinc-700">
            Paste Property24 Links, Listing IDs, or copied HTML from favourites:
          </label>
          <textarea
            value={importInputText}
            onChange={(e) => onChangeInput(e.target.value)}
            placeholder={`Paste one or more Property24 links, e.g.:
https://www.property24.com/to-rent/tamboerskloof/cape-town/western-cape/9151/117183204
https://www.property24.com/to-rent/gardens/cape-town/western-cape/9143/116982405

Tip: You can also copy all text (Ctrl+A, Ctrl+C) from your Property24 Favourites page and paste it here!`}
            className="w-full h-36 p-3 rounded-2xl border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 resize-none font-mono"
          />
        </div>

        {/* Quick Load Sample Links */}
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              onChangeInput(
                'https://www.property24.com/to-rent/tamboerskloof/cape-town/western-cape/9151/117183204\nhttps://www.property24.com/to-rent/gardens/cape-town/western-cape/9143/116982405\nhttps://www.property24.com/to-rent/sea-point/cape-town/western-cape/11013/116849201'
              );
            }}
            className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
          >
            + Load Sample Property24 Links
          </button>
          {importedCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-zinc-400 hover:text-rose-600 font-semibold cursor-pointer"
            >
              Clear {importedCount} imported favourites
            </button>
          )}
        </div>

        {/* Status Feedback */}
        {importStatusMsg && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${importStatusMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
            <Sparkle size={14} weight="fill" className={importStatusMsg.type === 'success' ? 'text-emerald-500 shrink-0' : 'text-rose-500 shrink-0'} />
            <span>{importStatusMsg.text}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={isImporting || !importInputText.trim()}
            className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer ${isImporting || !importInputText.trim()
              ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 active:scale-95'
              }`}
          >
            {isImporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Importing &amp; Geocoding...</span>
              </>
            ) : (
              <>
                <Heart size={14} weight="fill" />
                <span>Import Favourites</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
