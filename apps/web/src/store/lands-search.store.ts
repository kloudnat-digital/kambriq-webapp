import { create } from 'zustand';

export type LandSearchFilters = {
  search: string;
  region: string;
  city: string;
  labelCode: string;
  minPrice: string;
  maxPrice: string;
  verifiedOnly: boolean;
};

const DEFAULT_FILTERS: LandSearchFilters = {
  search: '',
  region: '',
  city: '',
  labelCode: '',
  minPrice: '',
  maxPrice: '',
  verifiedOnly: false,
};

type LandsSearchStore = {
  filters: LandSearchFilters;
  setFilter: <K extends keyof LandSearchFilters>(key: K, value: LandSearchFilters[K]) => void;
  resetFilters: () => void;
  compareIds: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  activeMarkerId: string | null;
  setActiveMarkerId: (id: string | null) => void;
};

export const useLandsSearchStore = create<LandsSearchStore>((set, get) => ({
  filters: DEFAULT_FILTERS,
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  compareIds: [],
  toggleCompare: (id) => {
    const { compareIds } = get();
    if (compareIds.includes(id)) {
      set({ compareIds: compareIds.filter((c) => c !== id) });
    } else if (compareIds.length < 3) {
      set({ compareIds: [...compareIds, id] });
    }
  },
  clearCompare: () => set({ compareIds: [] }),

  activeMarkerId: null,
  setActiveMarkerId: (id) => set({ activeMarkerId: id }),
}));
