import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';

// ============================================
// GENERIC FILTER PANEL COMPONENT
// ============================================

export interface FilterOption {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange';
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface FilterPanelProps {
  filters: FilterOption[];
  values: Record<string, any>;
  onFilterChange: (key: string, value: any) => void;
  onReset: () => void;
  className?: string;
}

export default function FilterPanel({
  filters,
  values,
  onFilterChange,
  onReset,
  className = '',
}: FilterPanelProps) {
  const hasActiveFilters = Object.values(values).some((v) => v !== '' && v !== null);

  return (
    <div className={`bg-muted/30 border rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold">Filtres</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filters.map((filter) => (
          <div key={filter.id} className="space-y-2">
            <Label htmlFor={filter.id} className="text-sm">
              {filter.label}
            </Label>

            {filter.type === 'text' && (
              <Input
                id={filter.id}
                type="text"
                placeholder={filter.placeholder}
                value={values[filter.id] || ''}
                onChange={(e) => onFilterChange(filter.id, e.target.value)}
                className="h-9"
              />
            )}

            {filter.type === 'date' && (
              <Input
                id={filter.id}
                type="date"
                value={values[filter.id] || ''}
                onChange={(e) => onFilterChange(filter.id, e.target.value)}
                className="h-9"
              />
            )}

            {filter.type === 'daterange' && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  placeholder="De"
                  value={values[`${filter.id}_from`] || ''}
                  onChange={(e) => onFilterChange(`${filter.id}_from`, e.target.value)}
                  className="h-9"
                />
                <Input
                  type="date"
                  placeholder="À"
                  value={values[`${filter.id}_to`] || ''}
                  onChange={(e) => onFilterChange(`${filter.id}_to`, e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {filter.type === 'select' && (
              <Select value={values[filter.id] || ''} onValueChange={(v) => onFilterChange(filter.id, v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={filter.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {filter.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>

      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Réinitialiser filtres
          </Button>
        </div>
      )}
    </div>
  );
}
