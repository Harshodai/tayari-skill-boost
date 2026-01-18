import { useState } from "react";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface BlogFiltersState {
  search: string;
  category: string | null;
  tag: string | null;
}

interface BlogFiltersProps {
  filters: BlogFiltersState;
  onFiltersChange: (filters: BlogFiltersState) => void;
  availableTags: string[];
  className?: string;
}

const categories = [
  { id: "all", label: "All Posts", icon: "📚" },
  { id: "resume-tips", label: "Resume Tips", icon: "📝" },
  { id: "interview-prep", label: "Interview Prep", icon: "🎤" },
  { id: "career-tips", label: "Career Tips", icon: "🚀" },
  { id: "success-stories", label: "Success Stories", icon: "⭐" },
];

export function BlogFilters({ 
  filters, 
  onFiltersChange, 
  availableTags,
  className 
}: BlogFiltersProps) {
  const [showAllTags, setShowAllTags] = useState(false);

  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const handleCategoryChange = (category: string | null) => {
    onFiltersChange({ 
      ...filters, 
      category: category === "all" ? null : category 
    });
  };

  const handleTagChange = (tag: string | null) => {
    onFiltersChange({ ...filters, tag });
  };

  const clearFilters = () => {
    onFiltersChange({ search: "", category: null, tag: null });
  };

  const hasActiveFilters = filters.search || filters.category || filters.tag;
  const displayedTags = showAllTags ? availableTags : availableTags.slice(0, 8);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search articles, topics, or keywords..."
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 pr-10 h-12 bg-card/50 border-border/50 focus:border-primary"
        />
        {filters.search && (
          <button
            onClick={() => handleSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={
              (cat.id === "all" && !filters.category) || filters.category === cat.id
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() => handleCategoryChange(cat.id)}
            className={cn(
              "rounded-full transition-all",
              (cat.id === "all" && !filters.category) || filters.category === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-card/50 hover:bg-card"
            )}
          >
            <span className="mr-1.5">{cat.icon}</span>
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Tag Filters */}
      {availableTags.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter by tag:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {displayedTags.map((tag) => (
              <Badge
                key={tag}
                variant={filters.tag === tag ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all hover:scale-105",
                  filters.tag === tag 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent"
                )}
                onClick={() => handleTagChange(filters.tag === tag ? null : tag)}
              >
                #{tag}
              </Badge>
            ))}
            {availableTags.length > 8 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllTags(!showAllTags)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showAllTags ? "Show less" : `+${availableTags.length - 8} more`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <Badge variant="secondary" className="gap-1">
                Search: "{filters.search}"
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => handleSearchChange("")}
                />
              </Badge>
            )}
            {filters.category && (
              <Badge variant="secondary" className="gap-1">
                {categories.find(c => c.id === filters.category)?.label}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => handleCategoryChange(null)}
                />
              </Badge>
            )}
            {filters.tag && (
              <Badge variant="secondary" className="gap-1">
                #{filters.tag}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => handleTagChange(null)}
                />
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
