#!/usr/bin/env python3
"""Route-registration audit.

Fails if a `func (s *Server) handleXxx(...)` method exists but is never
referenced by an `r.Get/Post/Put/Delete/Patch(...)` (or `.HandleFunc`)
registration anywhere in backend/go/internal/api/. Source: lessons.md
2026-09-10 — fully-implemented handlers never wired to any route
("defined but never wired"), found 2+ times, e.g. the AutoPilot
resume-docx handler that sat unused.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API_DIR = ROOT / "backend/go/internal/api"

HANDLER_DEF_RE = re.compile(r'func \(s \*Server\) (handle\w+)\s*\(')
# registrations: r.Get("/x", s.handleFoo)  or  mux.Post(path, s.handleFoo)  or  .HandleFunc(path, s.handleFoo)
REGISTRATION_RE = re.compile(
    r'\.(?:Get|Post|Put|Delete|Patch|HandleFunc|Head|Options)\s*\([^)]*?(handle\w+)\s*\)'
)
# also catch handlers passed as bare references (middleware wrapping, var assignment)
REFERENCE_RE = re.compile(r's\.(handle\w+)\b')

# Handlers that are legitimately not routed directly (called by other handlers,
# used as shared helpers, or wired via reflection/table-driven registration
# that this static check can't see).
#
# The 4 below are a documented, deliberate exception: routes_applications_extra.go
# lines 33-42 explain these Kanban-style handlers are intentionally left
# unregistered because routesApplications already owns their v1 routes with
# different handlers, and registering both would panic chi on a duplicate
# route. Do not add more entries here without the same kind of paper trail —
# this list exists to suppress ONE known, explained case, not to become a
# general escape hatch for the exact bug class this script exists to catch.
IGNORE = {
    "handleListApplicationsKanban",
    "handleCreateApplicationKanban",
    "handleUpdateApplicationKanban",
    "handleDeleteApplicationKanban",
}


def main() -> int:
    definitions = {}   # name -> file
    all_references = {}  # name -> count of s.handleXxx occurrences (incl. definition)

    for f in API_DIR.glob("*.go"):
        if f.name.endswith("_test.go"):
            continue
        text = f.read_text(errors="ignore")
        for m in HANDLER_DEF_RE.finditer(text):
            definitions[m.group(1)] = str(f.relative_to(ROOT))
        for m in REFERENCE_RE.finditer(text):
            all_references[m.group(1)] = all_references.get(m.group(1), 0) + 1

    unregistered = []
    for name, defined_in in sorted(definitions.items()):
        if name in IGNORE:
            continue
        # a handler is "wired" if `s.handleXxx` (the call-site form, distinct
        # from its `func (s *Server) handleXxx(` definition) appears anywhere
        # — a route registration or a call from another handler.
        if all_references.get(name, 0) == 0:
            unregistered.append((name, defined_in))

    if unregistered:
        print("Handlers defined but never referenced again (not registered on any route, "
              "not called by anything else):")
        for name, defined_in in unregistered:
            print(f"  - {name}  ({defined_in})")
        print(f"\n{len(unregistered)} orphaned handler(s). Register the route, or delete the "
              f"handler if it's genuinely dead code. If it's intentionally invoked only via "
              f"reflection/table-driven dispatch this check can't see, add it to IGNORE in "
              f"scripts/check_route_registration.py.")
        return 1

    print(f"OK: all {len(definitions)} Server handler methods are referenced beyond their definition.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
