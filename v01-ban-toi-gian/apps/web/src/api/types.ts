export interface Category {
  id: number;
  code: string;
  name: string;
}

export interface LocationItem {
  id: number;
  code: string;
  name: string;
  title: string;
  summary: string | null;
  language: string | null;
  category: Category;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  triggerRadiusM: number;
  priority: number;
  openingHours: string | null;
  ticketPrice: number | null;
  imageUrl: string | null;
  distanceM?: number;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  contentDegraded?: boolean;
}

export interface Narration {
  id: number;
  locationCode: string;
  locationId: number;
  language: string;
  title: string;
  summary: string | null;
  content: string;
  audio: { url: string; durationSeconds: number | null } | null;
  status: 'DRAFT' | 'PUBLISHED';
  updatedAt: string;
}


export interface ApiErrorBody {
  error: { code: string; message: string; details?: { field: string; issue: string }[]; requestId?: string };
}
