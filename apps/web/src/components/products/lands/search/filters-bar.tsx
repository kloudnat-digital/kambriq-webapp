'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLandsSearchStore } from '@/store/lands-search.store';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const REGIONS = [
  'Adamaoua',
  'Centre',
  'Est',
  'Extrême-Nord',
  'Littoral',
  'Nord',
  'Nord-Ouest',
  'Ouest',
  'Sud',
  'Sud-Ouest',
];

const LABEL_CODES = [
  { code: 'TDT', label: 'TDT' },
  { code: 'VEFL', label: 'VEFL' },
  { code: 'VEFIL', label: 'VEFIL' },
];

export default function FiltersBar() {
  const t = useTranslations('landSearch.filters');
  const { filters, setFilter, resetFilters } = useLandsSearchStore();

  const hasActiveFilters =
    filters.search ||
    filters.region ||
    filters.city ||
    filters.labelCode ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.verifiedOnly;

  return (
    <div className="border-b border-border bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <InputGroup className="h-9 min-w-44 flex-1">
          <InputGroupInput
            placeholder={t('searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>

        {/* Region */}
        <Select
          onValueChange={(value: string) => setFilter('region', value)}
          value={filters.region}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('regionPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all-regions">{t('allRegions')}</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Label type */}
        <Select
          onValueChange={(value: string) => setFilter('labelCode', value)}
          value={filters.labelCode}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('labelPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all-types">{t('allTypes')}</SelectItem>
              {LABEL_CODES.map(({ code, label }) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Price range */}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder={t('minPrice')}
            value={filters.minPrice}
            onChange={(e) => setFilter('minPrice', e.target.value)}
            className="h-9 w-28"
          />
          <span className="text-xs text-gray-400">–</span>
          <Input
            type="number"
            placeholder={t('maxPrice')}
            value={filters.maxPrice}
            onChange={(e) => setFilter('maxPrice', e.target.value)}
            className="h-9 w-28"
          />
        </div>

        {/* Verified only */}
        <div className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 select-none hover:bg-gray-50">
          <Checkbox
            id="verified-only"
            checked={filters.verifiedOnly}
            onCheckedChange={(checked) => setFilter('verifiedOnly', Boolean(checked))}
          />
          <Label htmlFor="verified-only" className="cursor-pointer text-sm font-normal">
            {t('verifiedOnly')}
          </Label>
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-9 gap-1.5 text-xs text-gray-500"
          >
            <X className="size-3.5" />
            {t('reset')}
          </Button>
        )}
      </div>
    </div>
  );
}
