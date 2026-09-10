import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export interface InterviewFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount?: number;
  filteredCount?: number;
}

export const InterviewFilters: React.FC<InterviewFiltersProps> = ({
  searchQuery,
  onSearchChange,
  totalCount,
  filteredCount,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by role, company, or location..."
          className="pl-9 pr-8 text-xs bg-background/50 h-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSearchChange("")}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {searchQuery && typeof filteredCount === "number" && typeof totalCount === "number" && (
        <span className="text-xs text-muted-foreground self-center">
          Showing {filteredCount} of {totalCount} applications
        </span>
      )}
    </div>
  );
};
