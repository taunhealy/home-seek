'use client';

import React from 'react';
import { X } from '@phosphor-icons/react';
import type { PropertyMapItem } from '@/constants/capeTownGeo';

export interface ListingComment {
  id: string;
  listing_id: string;
  user_id: string;
  nickname: string;
  body: string;
  created_at: number;
  updated_at: number;
}

interface CommentsModalProps {
  prop: PropertyMapItem | null;
  comments: ListingComment[];
  isLoading: boolean;
  newCommentText: string;
  isPosting: boolean;
  editingCommentId: string | null;
  editingCommentText: string;
  commentError: string | null;
  activeCommentUid: string;
  activeCommentNickname: string;
  isSignedIn: boolean;
  onClose: () => void;
  onChangeNewComment: (val: string) => void;
  onCreateComment: () => void;
  onStartEdit: (id: string, body: string) => void;
  onCancelEdit: () => void;
  onChangeEditText: (val: string) => void;
  onSaveEdit: (id: string) => void;
  onDeleteComment: (id: string) => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  prop,
  comments,
  isLoading,
  newCommentText,
  isPosting,
  editingCommentId,
  editingCommentText,
  commentError,
  activeCommentUid,
  activeCommentNickname,
  isSignedIn,
  onClose,
  onChangeNewComment,
  onCreateComment,
  onStartEdit,
  onCancelEdit,
  onChangeEditText,
  onSaveEdit,
  onDeleteComment,
}) => {
  if (!prop) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-3 bg-zinc-50/80">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-zinc-950 truncate">
                💬 {prop.title}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 truncate">{prop.address}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 cursor-pointer"
            aria-label="Close comments"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="p-4 border-b border-zinc-100 space-y-2 bg-white">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">
              Posting as{' '}
              <span className="font-extrabold text-indigo-700">
                u/{activeCommentNickname || 'Generating...'}
              </span>
            </span>
            {isSignedIn ? (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Signed In
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-zinc-500">
                Guest Seeker
              </span>
            )}
          </div>
          <textarea
            rows={2}
            value={newCommentText}
            onChange={(e) => onChangeNewComment(e.target.value)}
            placeholder="Share viewing notes, noise observations, landlord/agency feedback..."
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
          />
          {commentError && (
            <p className="text-[11px] text-rose-600 font-semibold">{commentError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isPosting || !newCommentText.trim()}
              onClick={onCreateComment}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-indigo-600 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {isPosting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/40">
          {isLoading ? (
            <p className="text-xs text-zinc-400 text-center py-6">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-6">
              No comments yet. Be the first to share notes on this listing!
            </p>
          ) : (
            comments.map((c) => {
              const isOwner = c.user_id === activeCommentUid;
              const isEditing = editingCommentId === c.id;
              const isEdited = c.updated_at - c.created_at > 2;
              return (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-white border border-zinc-200/80 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-black text-indigo-700 truncate">
                        u/{c.nickname}
                      </span>
                      {isOwner && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600">
                          You
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400">
                        · {new Date(c.created_at * 1000).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                        {isEdited ? ' (edited)' : ''}
                      </span>
                    </div>
                    {isOwner && !isEditing && (
                      <div className="flex items-center flex-wrap gap-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onStartEdit(c.id, c.body)}
                          className="text-[10.5px] font-bold text-zinc-500 hover:text-indigo-700 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteComment(c.id)}
                          className="text-[10.5px] font-bold text-zinc-400 hover:text-rose-600 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5 pt-1">
                      <textarea
                        rows={2}
                        value={editingCommentText}
                        onChange={(e) => onChangeEditText(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-300 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10.5px] font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => onSaveEdit(c.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-800 whitespace-pre-wrap leading-relaxed">
                      {c.body}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
