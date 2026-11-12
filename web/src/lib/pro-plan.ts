import type { PropertyMapItem } from '@/components/PropertyMap';

export type ProPlanTier = 'free' | 'hunter_pass' | 'pro_monthly';

export interface PlanSummary {
  tier: ProPlanTier;
  label: string;
  priceLabel: string;
  baseQuota: number;
  topupCredits: number;
  auditsUsed: number;
  remainingAudits: number;
  canUploadPhotos: boolean;
  canExportSnagReport: boolean;
  canUseAiCompare: boolean;
}

const PLAN_TIER_KEY = 'homeseek_pro_plan_tier';
const PLAN_USED_KEY = 'homeseek_pro_audits_used';
const PLAN_TOPUP_KEY = 'homeseek_pro_topup_credits';
const COMPARE_LIST_KEY = 'homeseek_compare_list';

export const PLAN_CATALOG = {
  free: {
    tier: 'free' as ProPlanTier,
    label: 'Free Scout',
    priceLabel: 'R0',
    baseQuota: 2,
    canUploadPhotos: false,
    canExportSnagReport: false,
    canUseAiCompare: false,
  },
  hunter_pass: {
    tier: 'hunter_pass' as ProPlanTier,
    label: '30-Day Hunter Pass',
    priceLabel: 'R149 once-off',
    baseQuota: 40,
    canUploadPhotos: true,
    canExportSnagReport: true,
    canUseAiCompare: true,
  },
  pro_monthly: {
    tier: 'pro_monthly' as ProPlanTier,
    label: 'Pro Monthly',
    priceLabel: 'R229 / mo',
    baseQuota: 150,
    canUploadPhotos: true,
    canExportSnagReport: true,
    canUseAiCompare: true,
  },
};

export function getPlanSummary(): PlanSummary {
  if (typeof window === 'undefined') {
    return { ...PLAN_CATALOG.free, topupCredits: 0, auditsUsed: 0, remainingAudits: 2 };
  }
  const rawTier = (localStorage.getItem(PLAN_TIER_KEY) as ProPlanTier) || 'free';
  const cfg = PLAN_CATALOG[rawTier] || PLAN_CATALOG.free;
  const auditsUsed = Math.max(0, parseInt(localStorage.getItem(PLAN_USED_KEY) || '0', 10) || 0);
  const topupCredits = Math.max(0, parseInt(localStorage.getItem(PLAN_TOPUP_KEY) || '0', 10) || 0);
  const totalQuota = cfg.baseQuota + topupCredits;
  return {
    ...cfg,
    topupCredits,
    auditsUsed,
    remainingAudits: Math.max(0, totalQuota - auditsUsed),
  };
}

export function setProPlanTier(tier: ProPlanTier): PlanSummary {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PLAN_TIER_KEY, tier);
    window.dispatchEvent(new Event('homeseek-plan-updated'));
  }
  return getPlanSummary();
}

export function addTopupCredits(credits = 15): PlanSummary {
  if (typeof window !== 'undefined') {
    const cur = Math.max(0, parseInt(localStorage.getItem(PLAN_TOPUP_KEY) || '0', 10) || 0);
    localStorage.setItem(PLAN_TOPUP_KEY, String(cur + credits));
    window.dispatchEvent(new Event('homeseek-plan-updated'));
  }
  return getPlanSummary();
}

export function consumeAuditCredit(): PlanSummary {
  if (typeof window !== 'undefined') {
    const cur = Math.max(0, parseInt(localStorage.getItem(PLAN_USED_KEY) || '0', 10) || 0);
    localStorage.setItem(PLAN_USED_KEY, String(cur + 1));
    window.dispatchEvent(new Event('homeseek-plan-updated'));
  }
  return getPlanSummary();
}

export function compressImageToDataUrl(file: File, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================
// Compare Shortlist Persistence (Max 4)
// ==========================================

export function getCompareList(): PropertyMapItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPARE_LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isInCompare(propId: string): boolean {
  return getCompareList().some((p) => String(p.id) === String(propId));
}

export function toggleCompareProperty(prop: PropertyMapItem): { list: PropertyMapItem[]; added: boolean; limitReached?: boolean } {
  const current = getCompareList();
  const exists = current.some((p) => String(p.id) === String(prop.id));
  let next: PropertyMapItem[];
  let added = false;
  let limitReached = false;

  if (exists) {
    next = current.filter((p) => String(p.id) !== String(prop.id));
  } else if (current.length >= 4) {
    next = current;
    limitReached = true;
  } else {
    next = [...current, prop];
    added = true;
  }

  if (typeof window !== 'undefined' && !limitReached) {
    localStorage.setItem(COMPARE_LIST_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('homeseek-compare-updated'));
  }
  return { list: next, added, limitReached };
}

export function removeFromCompare(propId: string): PropertyMapItem[] {
  const next = getCompareList().filter((p) => String(p.id) !== String(propId));
  if (typeof window !== 'undefined') {
    localStorage.setItem(COMPARE_LIST_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('homeseek-compare-updated'));
  }
  return next;
}

export function clearCompareList(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(COMPARE_LIST_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event('homeseek-compare-updated'));
  }
}

