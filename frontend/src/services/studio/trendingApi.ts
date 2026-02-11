export type TrendingItem = {
  name: string;
  viewCount: number;
  videoId?: string;
  channel?: string;
};

export type TrendingItemWithCategory = TrendingItem & { categoryId?: string };

export type TrendingResponse = {
  weekly: TrendingItem[];
  monthly: TrendingItem[];
  error?: string;
};

export type TrendingAllResponse = {
  items: TrendingItemWithCategory[];
  error?: string;
};

function formatViewCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 10_000) {
    return `${(n / 10_000).toFixed(1)}만`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

export type TrendTemplate = 'all' | 'mainstream' | 'niche';

const TREND_CATEGORY_MAINSTREAM = ['22', '24', '26', '23', '10'];
const TREND_CATEGORY_NICHE = ['27', '28', '20'];

export function filterTrendItemsByTemplate(
  items: TrendingItemWithCategory[],
  template: TrendTemplate
): TrendingItemWithCategory[] {
  if (template === 'all') return [...items];
  const allowed = template === 'mainstream' ? TREND_CATEGORY_MAINSTREAM : TREND_CATEGORY_NICHE;
  return items.filter((i) => i.categoryId && allowed.includes(i.categoryId));
}

export async function fetchTrendingAll(): Promise<TrendingAllResponse> {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  const path = '/api/v1/studio/trending/?template=all';
  const url = base ? `${base}${path}` : path;
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const data = (await res.json().catch(() => ({}))) as TrendingAllResponse & { weekly?: unknown; monthly?: unknown };
    if (!res.ok) {
      return { items: [], error: (data as { error?: string }).error || res.statusText };
    }
    if (Array.isArray(data.items)) {
      return { items: data.items };
    }
    return { items: [] };
  } catch {
    return { items: [] };
  }
}

/**
 * 선택한 시장 카테고리 칩의 categoryId로 트렌드 조회.
 * API 계약: GET ?template=all&category_id=25 또는 category_id=25,26 (YouTube video categoryId 문자열, 콤마 구분)
 */
export async function fetchTrendingByCategory(categoryIds: string[]): Promise<TrendingAllResponse> {
  if (!categoryIds.length) return { items: [] };
  const ids = categoryIds.map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) return { items: [] };
  const base = import.meta.env.VITE_API_BASE_URL || '';
  const qs = new URLSearchParams({ template: 'all', category_id: ids.join(',') });
  const path = `/api/v1/studio/trending/?${qs.toString()}`;
  const url = base ? `${base}${path}` : path;
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const data = (await res.json().catch(() => ({}))) as TrendingAllResponse & { weekly?: unknown; monthly?: unknown };
    if (!res.ok) {
      return { items: [], error: (data as { error?: string }).error || res.statusText };
    }
    if (Array.isArray(data.items)) {
      return { items: data.items };
    }
    return { items: [] };
  } catch {
    return { items: [] };
  }
}

export async function fetchTrending(template: TrendTemplate = 'mainstream'): Promise<TrendingResponse> {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  const path = `/api/v1/studio/trending/?template=${encodeURIComponent(template)}`;
  const url = base ? `${base}${path}` : path;
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const data = (await res.json().catch(() => ({}))) as TrendingResponse;
    if (!res.ok) {
      return { weekly: [], monthly: [], error: data?.error || res.statusText };
    }
    return {
      weekly: data.weekly ?? [],
      monthly: data.monthly ?? [],
      error: data.error,
    };
  } catch {
    return { weekly: [], monthly: [] };
  }
}

export function formatTrendingGrowth(item: TrendingItem): string {
  return formatViewCount(item.viewCount);
}
