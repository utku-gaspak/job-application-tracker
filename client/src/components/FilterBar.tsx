import {
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  Download,
  Filter,
  Search,
  X,
} from "lucide-react";
import {
  JobApplicationStatus,
  jobApplicationStatusLabels,
  jobApplicationStatusOrder,
} from "../types";
import { InterestRangeSlider } from "./InterestRangeSlider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface FilterBarProps {
  sortOrder: "newest" | "oldest";
  onSortToggle: () => void;
  isFilterOpen: boolean;
  onToggleFilter: () => void;
  showStatusSankey: boolean;
  onToggleDiagram: () => void;
  onOpenExport: () => void;
  themeButtonVariant: "default" | "outline";
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: JobApplicationStatus | "all";
  onStatusChange: (value: JobApplicationStatus | "all") => void;
  interestRange: { lower: number; upper: number };
  onInterestLowerChange: (value: number) => void;
  onInterestUpperChange: (value: number) => void;
  selectedSkills: string[];
  availableSkills: string[];
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  onClearAll: () => void;
}

const INTEREST_MIN = 1;
const INTEREST_MAX = 5;

export const FilterBar = ({
  sortOrder,
  onSortToggle,
  isFilterOpen,
  onToggleFilter,
  showStatusSankey,
  onToggleDiagram,
  onOpenExport,
  themeButtonVariant,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  interestRange,
  onInterestLowerChange,
  onInterestUpperChange,
  selectedSkills,
  availableSkills,
  onAddSkill,
  onRemoveSkill,
  onClearAll,
}: FilterBarProps) => (
  <section
    className="deco-frame w-full border-border-gold bg-deco-surface-soft p-4 shadow-deco-panel"
    data-tour-id="tracker-filters"
  >
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-stretch gap-2">
        <Button
          className="h-10 px-4 text-xs uppercase tracking-[0.2em]"
          onClick={onSortToggle}
          type="button"
          variant={themeButtonVariant}
        >
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {sortOrder === "newest" ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      <div className="flex flex-wrap items-stretch gap-2">
        <Button
          aria-expanded={isFilterOpen}
          aria-controls="tracker-filter-accordion"
          className="h-10 px-4 text-xs uppercase tracking-[0.2em]"
          onClick={onToggleFilter}
          type="button"
          variant={themeButtonVariant}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
          <ChevronDown
            className={`ml-2 h-4 w-4 transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
          />
        </Button>
        <Button
          aria-pressed={showStatusSankey}
          className="h-10 px-4 text-xs uppercase tracking-[0.2em]"
          onClick={onToggleDiagram}
          type="button"
          variant={themeButtonVariant}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          {showStatusSankey ? "Board" : "Diagram"}
        </Button>
        <Button
          className="h-10 px-4 text-xs uppercase tracking-[0.2em]"
          onClick={onOpenExport}
          type="button"
          variant={themeButtonVariant}
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>

    {isFilterOpen ? (
      <div
        className="mt-4 grid gap-4 border-t border-border-gold-muted pt-4"
        id="tracker-filter-accordion"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-deco-muted">
              Filters
            </span>
            <span className="text-xs uppercase tracking-[0.12em] text-deco-muted">
              Search, status, interest, and skill transfer
            </span>
          </div>
          <Button
            className="h-9 px-4 text-xs uppercase tracking-[0.2em]"
            onClick={onClearAll}
            type="button"
            variant={themeButtonVariant}
          >
            Clear All
          </Button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_repeat(2,minmax(0,1fr))]">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-deco-muted">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-deco-muted" />
              <Input
                aria-label="Search applications"
                className="h-10 border-border-gold-muted bg-deco-surface pl-9"
                placeholder="Company or position"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-deco-muted">
              Status
            </span>
            <select
              aria-label="Filter status"
              className="deco-frame h-10 border-border-gold-muted bg-deco-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary-gold focus:ring-2 focus:ring-primary-gold-muted"
              value={statusFilter}
              onChange={(event) =>
                onStatusChange(
                  event.target.value === "all"
                    ? "all"
                    : (Number(event.target.value) as JobApplicationStatus),
                )
              }
            >
              <option value="all">All statuses</option>
              {jobApplicationStatusOrder.map((status) => (
                <option key={status} value={status}>
                  {jobApplicationStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <InterestRangeSlider
            lower={interestRange.lower}
            upper={interestRange.upper}
            min={INTEREST_MIN}
            max={INTEREST_MAX}
            onLowerChange={onInterestLowerChange}
            onUpperChange={onInterestUpperChange}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="deco-frame border-border-gold-muted bg-deco-surface-soft p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
              Selected
            </p>
            {selectedSkills.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedSkills.map((skill) => (
                  <button
                    className="deco-frame inline-flex items-center gap-2 border-border-gold-muted bg-deco-card px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-deco-foreground"
                    aria-label={`Remove ${skill}`}
                    key={skill}
                    onClick={() => onRemoveSkill(skill)}
                    type="button"
                  >
                    {skill}
                    <X className="h-3 w-3 text-deco-muted" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-deco-muted">
                No active skills.
              </p>
            )}
          </div>

          <div className="deco-frame border-border-gold-muted bg-deco-surface-soft p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-gold">
              Available
            </p>
            {availableSkills.length > 0 ? (
              <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                {availableSkills.map((skill) => (
                  <button
                    className="deco-frame inline-flex items-center border-border-gold-muted bg-deco-card px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-deco-foreground transition-colors hover:bg-primary-gold-muted"
                    aria-label={`Add ${skill}`}
                    key={skill}
                    onClick={() => onAddSkill(skill)}
                    type="button"
                  >
                    {skill}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-deco-muted">
                No more skills available.
              </p>
            )}
          </div>
        </div>
      </div>
    ) : null}
  </section>
);
