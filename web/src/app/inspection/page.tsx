'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  Envelope,
  FloppyDisk,
  MagnifyingGlass,
  Plus,
  Sparkle,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { apiUrl } from '@/lib/apiClient';
import { compressImageToDataUrl, consumeAuditCredit, getPlanSummary, type PlanSummary } from '@/lib/pro-plan';

interface InspectionItem {
  id: string;
  room: string;
  status: 'good' | 'minor_wear' | 'defect';
  notes: string;
  captured_at: string;
  photo_data: string;
}

const ROOM_PRESETS = [
  'Kitchen',
  'Living Area',
  'Bedroom',
  'Bathroom',
  'Balcony / Exterior',
  'Windows & Locks',
  'Meters & Keys',
];

export default function IngoingInspectionPage() {
  const { user, profile } = useAuth();
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [propertyAddress, setPropertyAddress] = useState('');
  const [landlordOrAgent, setLandlordOrAgent] = useState('');
  const [leaseStartDate, setLeaseStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [waterMeter, setWaterMeter] = useState('');
  const [electricityMeter, setElectricityMeter] = useState('');
  const [keysNotes, setKeysNotes] = useState('');
  const [items, setItems] = useState<InspectionItem[]>([]);

  const [selectedRoom, setSelectedRoom] = useState('Kitchen');
  const [customRoom, setCustomRoom] = useState('');
  const [propertyInput, setPropertyInput] = useState('');
  const [isGeneratingCriteria, setIsGeneratingCriteria] = useState(false);
  const [tailoredCriteria, setTailoredCriteria] = useState<{
    property_summary?: string;
    rooms: Array<{ room: string; checks: string[] }>;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<'good' | 'minor_wear' | 'defect'>('defect');
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [describingId, setDescribingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [plan, setPlan] = useState<PlanSummary | null>(null);

  useEffect(() => {
    setPlan(getPlanSummary());
    const sync = () => setPlan(getPlanSummary());
    window.addEventListener('homeseek-plan-updated', sync);
    return () => window.removeEventListener('homeseek-plan-updated', sync);
  }, []);

  useEffect(() => {
    const effectiveUid = user?.uid || 'guest_inspector';
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/inspections?user_id=${encodeURIComponent(effectiveUid)}`));
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const latest = Array.isArray(data?.inspections) && data.inspections.length > 0 ? data.inspections[0] : null;
        if (latest && !cancelled) {
          setInspectionId(latest.id);
          setPropertyAddress(latest.property_address || '');
          setLandlordOrAgent(latest.landlord_or_agent || '');
          setLeaseStartDate(latest.lease_start_date || new Date().toISOString().slice(0, 10));
          setWaterMeter(latest.water_meter || '');
          setElectricityMeter(latest.electricity_meter || '');
          setKeysNotes(latest.keys_notes || '');
          setItems(Array.isArray(latest.items) ? latest.items : []);
        }
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const activeRoomName = customRoom.trim() || selectedRoom;

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setStatusMsg(null);
    const added: InspectionItem[] = [];
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        const compressed = await compressImageToDataUrl(file, 960, 0.78);
        const ts = file.lastModified ? new Date(file.lastModified) : new Date();
        const stamp = ts.toLocaleString('en-ZA', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        added.push({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          room: activeRoomName,
          status: newStatus,
          notes: '',
          captured_at: stamp,
          photo_data: compressed,
        });
      } catch {
        // skip unreadable image
      }
    }
    if (added.length > 0) {
      setItems((prev) => [...added, ...prev]);
    }
  };

  const handleAddTextOnlyItem = () => {
    const stamp = new Date().toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    setItems((prev) => [
      {
        id: `item-${Date.now()}`,
        room: activeRoomName,
        status: newStatus,
        notes: '',
        captured_at: stamp,
        photo_data: '',
      },
      ...prev,
    ]);
  };

  const handleSave = async () => {
    const effectiveUid = user?.uid || 'guest_inspector';
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl('/api/inspections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inspectionId,
          user_id: effectiveUid,
          property_address: propertyAddress,
          landlord_or_agent: landlordOrAgent,
          lease_start_date: leaseStartDate,
          water_meter: waterMeter,
          electricity_meter: electricityMeter,
          keys_notes: keysNotes,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Save failed');
      setInspectionId(data.id);
      setStatusMsg({ type: 'ok', text: `Saved ${items.length} inspection record(s) to HomeSeek.` });
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Could not save inspection.' });
    } finally {
      setIsSaving(false);
    }
  };

  const buildPayload = () => ({
    property_address: propertyAddress,
    landlord_or_agent: landlordOrAgent,
    lease_start_date: leaseStartDate,
    water_meter: waterMeter,
    electricity_meter: electricityMeter,
    keys_notes: keysNotes,
    tenant_name: profile?.nickname ? `${user?.displayName || 'Tenant'} (u/${profile.nickname})` : (user?.displayName || user?.email || 'Tenant'),
    generated_at: new Date().toLocaleString('en-ZA'),
    items,
  });

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl('/api/inspections/pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ingoing-inspection-${leaseStartDate || 'record'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatusMsg({ type: 'ok', text: 'Downloaded timestamped Ingoing Inspection PDF.' });
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'PDF download failed.' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleEmailPdf = async () => {
    const target = emailTarget.trim();
    if (!target.includes('@')) {
      setStatusMsg({ type: 'err', text: 'Please enter a valid recipient email address.' });
      return;
    }
    setIsSendingEmail(true);
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl('/api/inspections/email-pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: target, inspection: buildPayload() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Email failed');
      setStatusMsg({ type: 'ok', text: `Emailed timestamped PDF record to ${target}.` });
      setIsEmailOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Could not send email.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleAiDescribe = async (item: InspectionItem) => {
    if (!item.photo_data || describingId) return;
    if ((plan?.remainingAudits ?? 0) <= 0) {
      setStatusMsg({ type: 'err', text: 'No AI credits left for auto-describe. Enter notes manually or top up.' });
      return;
    }
    setDescribingId(item.id);
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl('/api/inspections/ai-describe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: item.room, photo_data: item.photo_data, existing_notes: item.notes }),
      });
      const data = await res.json();
      if (data?.description) {
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, notes: data.description } : x)));
      }
      if (data?.status === 'success' && !data?.is_fallback) {
        consumeAuditCredit();
      }
    } catch {
      setStatusMsg({ type: 'err', text: 'AI description failed. No credit charged.' });
    } finally {
      setDescribingId(null);
    }
  };

  const handleGenerateCriteria = async () => {
    const q = propertyInput.trim() || propertyAddress.trim();
    if (!q || isGeneratingCriteria) return;
    if ((plan?.remainingAudits ?? 0) <= 0) {
      setStatusMsg({ type: 'err', text: 'No AI credits left to analyze property criteria. Top up or add rooms manually.' });
      return;
    }
    setIsGeneratingCriteria(true);
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl('/api/inspections/generate-criteria'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_input: q, property_address: propertyAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Could not generate criteria');
      const crit = data?.criteria;
      if (crit && Array.isArray(crit.rooms) && crit.rooms.length > 0) {
        setTailoredCriteria(crit);
        setSelectedRoom(crit.rooms[0].room);
        setCustomRoom('');
        if (!propertyAddress.trim() && crit.detected_address) {
          setPropertyAddress(crit.detected_address);
        }
      }
      if (data?.status === 'success' && !data?.is_fallback) {
        consumeAuditCredit();
        setStatusMsg({ type: 'ok', text: 'Generated tailored AI inspection criteria for this property (1 AI credit used).' });
      } else {
        setStatusMsg({ type: 'ok', text: 'Generated tailored inspection criteria (no credit charged).' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Could not analyze property details.' });
    } finally {
      setIsGeneratingCriteria(false);
    }
  };

  const handleLogCheckNote = (roomName: string, checkText: string) => {
    const stamp = new Date().toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    setItems((prev) => [
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        room: roomName,
        status: newStatus,
        notes: checkText,
        captured_at: stamp,
        photo_data: '',
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Ingoing Move-In Inspection</h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Document pre-existing defects, meter readings, and keys with timestamped photo evidence &amp; SHA-256 hashes,
            then download or email a dispute-proof PDF to your agent/landlord on Day 1.
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} weight="bold" />}
            <span>{isSaving ? 'Saving...' : 'Save Record'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <DownloadSimple size={14} weight="bold" />
            <span>{isExportingPdf ? 'Building PDF...' : 'Save PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEmailOpen(!isEmailOpen)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Envelope size={14} weight="bold" />
            <span>Email PDF</span>
          </button>
          <Link
            href="/search"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-1"
          >
            <MagnifyingGlass size={13} />
            <span>Search</span>
          </Link>
        </div>
      </div>

      {isEmailOpen && (
        <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-emerald-200">Email Timestamped PDF to Agent / Landlord:</span>
          <input
            type="email"
            value={emailTarget}
            onChange={(e) => setEmailTarget(e.target.value)}
            placeholder="agent@agency.co.za"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
          />
          <button
            type="button"
            disabled={isSendingEmail}
            onClick={handleEmailPdf}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
          >
            {isSendingEmail ? 'Sending...' : 'Send PDF'}
          </button>
        </div>
      )}

      {statusMsg && (
        <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${statusMsg.type === 'ok'
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}>
          {statusMsg.type === 'ok' ? <CheckCircle size={15} weight="fill" /> : <WarningCircle size={15} weight="fill" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Property, Meters & Keys */}
      <div className="rounded-3xl bg-zinc-900/90 border border-white/10 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Property Address</label>
          <input
            type="text"
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
            placeholder="e.g. Apt 4, 14 Derwent Rd, Gardens"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Landlord / Managing Agent</label>
          <input
            type="text"
            value={landlordOrAgent}
            onChange={(e) => setLandlordOrAgent(e.target.value)}
            placeholder="e.g. Jane Doe · Seeff"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Move-In / Occupation Date</label>
          <input
            type="date"
            value={leaseStartDate}
            onChange={(e) => setLeaseStartDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Water Meter Reading</label>
          <input
            type="text"
            value={waterMeter}
            onChange={(e) => setWaterMeter(e.target.value)}
            placeholder="e.g. 00412.6 kL"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Prepaid / Electricity Meter</label>
          <input
            type="text"
            value={electricityMeter}
            onChange={(e) => setElectricityMeter(e.target.value)}
            placeholder="e.g. 142.8 kWh (Meter #...)"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Keys, Remotes &amp; Access Tags</label>
          <input
            type="text"
            value={keysNotes}
            onChange={(e) => setKeysNotes(e.target.value)}
            placeholder="e.g. 2x front keys, 1x gate remote, 1x tag"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Add Photo / Snag Controls */}
      <div className="rounded-3xl bg-zinc-900/90 border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-extrabold">Add Room Photo &amp; Condition Note</h2>
          <span className="text-[11px] text-zinc-400">
            {items.length} item(s) documented · AI Credits: <strong className="text-indigo-300">{plan?.remainingAudits ?? 0}</strong>
          </span>
        </div>

        {/* AI Property-Tailored Inspection Criteria */}
        <div className="p-3.5 rounded-2xl bg-indigo-950/35 border border-indigo-500/25 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-extrabold text-indigo-200 flex items-center gap-1.5">
              <Sparkle size={13} weight="fill" className="text-amber-300" />
              <span>AI Property Criteria Generator</span>
            </span>
            <span className="text-[10px] text-zinc-400">
              Paste a Property24 link, listing ID, or features to tailor rooms &amp; checks
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={propertyInput}
              onChange={(e) => setPropertyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerateCriteria();
              }}
              placeholder="Paste Property24 URL, ID, or details (e.g. gas hob, parquet floors, patio, pet-friendly)..."
              className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              disabled={isGeneratingCriteria || (!propertyInput.trim() && !propertyAddress.trim())}
              onClick={handleGenerateCriteria}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {isGeneratingCriteria ? <CircleNotch size={13} className="animate-spin" /> : <Sparkle size={13} weight="fill" className="text-amber-300" />}
              <span>{isGeneratingCriteria ? 'Analyzing...' : 'Tailor Criteria (1 Credit)'}</span>
            </button>
          </div>
          {tailoredCriteria?.property_summary && (
            <p className="text-[11px] text-indigo-200/90 font-medium">{tailoredCriteria.property_summary}</p>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-1.5">
          {(tailoredCriteria?.rooms?.length
            ? Array.from(new Set([...tailoredCriteria.rooms.map((r) => r.room), ...ROOM_PRESETS]))
            : ROOM_PRESETS
          ).map((room) => (
            <button
              key={room}
              type="button"
              onClick={() => {
                setSelectedRoom(room);
                setCustomRoom('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${!customRoom && selectedRoom === room
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-black/40 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
            >
              {room}
            </button>
          ))}
          <input
            type="text"
            value={customRoom}
            onChange={(e) => setCustomRoom(e.target.value)}
            placeholder="+ Custom room..."
            className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white w-36 focus:outline-none focus:border-indigo-400"
          />
        </div>

        {(() => {
          const activeChecks = tailoredCriteria?.rooms?.find((r) => r.room === activeRoomName)?.checks;
          if (!activeChecks || activeChecks.length === 0) return null;
          return (
            <div className="p-3 rounded-2xl bg-black/35 border border-white/10 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                What to check &amp; photograph in {activeRoomName}:
              </div>
              <div className="space-y-1">
                {activeChecks.map((chk, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-xs text-zinc-200">
                    <span>• {chk}</span>
                    <button
                      type="button"
                      onClick={() => handleLogCheckNote(activeRoomName, chk)}
                      className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-indigo-600 text-[10px] font-bold shrink-0 cursor-pointer transition-colors"
                    >
                      + Log Check
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
            {[
              { id: 'defect', label: 'Defect / Snag' },
              { id: 'minor_wear', label: 'Minor Wear' },
              { id: 'good', label: 'Clean / Good' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setNewStatus(st.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${newStatus === st.id ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
                  }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold cursor-pointer flex items-center gap-1.5">
            <Camera size={15} weight="bold" />
            <span>Upload Photos ({activeRoomName})</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleUploadPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={handleAddTextOnlyItem}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} weight="bold" />
            <span>Add Note Only</span>
          </button>
        </div>
      </div>

      {/* Documented Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-3xl bg-zinc-900/90 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[11px] font-extrabold">
                  {item.room}
                </span>
                <select
                  value={item.status}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: e.target.value as any } : x)))
                  }
                  className="px-2 py-0.5 rounded-lg bg-black/50 border border-white/15 text-[11px] font-bold text-white"
                >
                  <option value="defect">Defect / Snag</option>
                  <option value="minor_wear">Minor Wear</option>
                  <option value="good">Clean / Good</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                title="Remove entry"
              >
                <Trash size={15} weight="bold" />
              </button>
            </div>

            {item.photo_data && (
              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black">
                <img src={item.photo_data} alt={item.room} className="w-full h-48 object-cover" />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-bold text-zinc-200">
                  🕒 {item.captured_at}
                </span>
              </div>
            )}

            {!item.photo_data && (
              <div className="text-[11px] text-zinc-400 font-semibold">🕒 {item.captured_at}</div>
            )}

            <textarea
              rows={2}
              value={item.notes}
              onChange={(e) =>
                setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, notes: e.target.value } : x)))
              }
              placeholder="Describe exact condition or pre-existing defect..."
              className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 resize-none"
            />

            {item.photo_data && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={describingId === item.id}
                  onClick={() => handleAiDescribe(item)}
                  className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/30 text-[11px] font-bold text-purple-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {describingId === item.id ? (
                    <CircleNotch size={12} className="animate-spin" />
                  ) : (
                    <Sparkle size={12} weight="fill" className="text-amber-300" />
                  )}
                  <span>{describingId === item.id ? 'Describing...' : 'Auto-Describe with AI (1 Credit)'}</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      </main>
    </div>
  );
}
