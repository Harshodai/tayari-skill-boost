/**
 * SearchInput — Production-grade search input with debounce, clear, and loading
 *
 * Props/API:
 *  value        — Controlled value
 *  onChange     — (value: string) => void
 *  onSearch     — Called after debounce with the current query
 *  debounceMs   — Debounce delay in ms (default: 300)
 *  placeholder  — Input placeholder (default: "Search…")
 *  isLoading    — Show loading spinner instead of search icon
 *  clearable    — Show clear button when value is non-empty (default: true)
 *  size         — "sm" | "md" | "lg"
 *  className    — Extra Tailwind overrides
 *  suggestions  — Array of string suggestions to show as dropdown
 *  onSuggestionSelect — Called when user picks a suggestion
 *
 * Usage:
 *  <SearchInput
 *    value={query}
 *    onChange={setQuery}
 *    onSearch={handleSearch}
 *    placeholder="Search jobs, companies…"
 *    isLoading={searching}
 *    suggestions={recentSearches}
 *  />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "./loading-spinner";

const sizeMap = {
  sm: { input: "h-8 pl-8 pr-3 text-xs", icon: "left-2.5 h-3.5 w-3.5", clear: "right-2 h-5 w-5" },
  md: { input: "h-10 pl-10 pr-4 text-sm", icon: "left-3 h-4 w-4", clear: "right-2.5 h-6 w-6" },
  lg: { input: "h-12 pl-12 pr-5 text-base", icon: "left-3.5 h-5 w-5", clear: "right-3 h-7 w-7" },
};

export interface SearchInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  isLoading?: boolean;
  clearable?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
  id?: string;
  name?: string;
  autoFocus?: boolean;
}

function SearchInput({
  value: controlledValue,
  defaultValue = "",
  onChange,
  onSearch,
  debounceMs = 300,
  placeholder = "Search…",
  isLoading = false,
  clearable = true,
  size = "md",
  className,
  suggestions = [],
  onSuggestionSelect,
  id,
  name,
  autoFocus,
}: SearchInputProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;

  const [isFocused, setIsFocused] = React.useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = React.useId();

  const filteredSuggestions = React.useMemo(
    () =>
      value.trim()
        ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
        : suggestions.slice(0, 5),
    [suggestions, value]
  );

  const showSuggestions = isFocused && filteredSuggestions.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    if (!isControlled) setInternalValue(newVal);
    onChange?.(newVal);
    setActiveSuggestionIdx(-1);

    if (onSearch) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onSearch(newVal), debounceMs);
    }
  };

  const handleClear = () => {
    if (!isControlled) setInternalValue("");
    onChange?.("");
    onSearch?.("");
    inputRef.current?.focus();
  };

  const handleSelectSuggestion = (suggestion: string) => {
    if (!isControlled) setInternalValue(suggestion);
    onChange?.(suggestion);
    onSearch?.(suggestion);
    onSuggestionSelect?.(suggestion);
    setIsFocused(false);
    setActiveSuggestionIdx(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIdx((i) => Math.min(i + 1, filteredSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeSuggestionIdx >= 0) {
      e.preventDefault();
      handleSelectSuggestion(filteredSuggestions[activeSuggestionIdx]);
    } else if (e.key === "Escape") {
      setIsFocused(false);
      setActiveSuggestionIdx(-1);
    }
  };

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const sz = sizeMap[size];

  return (
    <div className={cn("relative", className)}>
      {/* Search / Loading icon */}
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          sz.icon
        )}
        aria-hidden="true"
      >
        {isLoading ? (
          <LoadingSpinner size="sm" className="h-full w-full" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-full w-full">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        )}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="search"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-activedescendant={
          activeSuggestionIdx >= 0
            ? `${listboxId}-option-${activeSuggestionIdx}`
            : undefined
        }
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-input bg-background",
          "text-foreground placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "transition-all duration-200",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Remove native search cancel button
          "[&::-webkit-search-cancel-button]:hidden",
          sz.input,
          clearable && value && "pr-9"
        )}
      />

      {/* Clear button */}
      {clearable && value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded flex items-center justify-center",
            "text-muted-foreground hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            sz.clear
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className={cn(
            "absolute z-50 mt-1 w-full rounded-lg border border-border/60 bg-popover py-1 shadow-lg",
            "max-h-60 overflow-y-auto"
          )}
        >
          {filteredSuggestions.map((suggestion, idx) => (
            <li
              key={suggestion}
              id={`${listboxId}-option-${idx}`}
              role="option"
              aria-selected={idx === activeSuggestionIdx}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                idx === activeSuggestionIdx
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/60"
              )}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <span className="truncate">{suggestion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { SearchInput };
