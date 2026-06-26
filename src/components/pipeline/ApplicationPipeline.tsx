import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  type PipelineJob,
  type PipelineStage,
  loadStageMap,
  saveStageMap,
} from "./types";
import { PipelineCard } from "./PipelineCard";

interface Props {
  jobs: PipelineJob[];
  /** Compact = used inside Dashboard. Full = standalone /pipeline page. */
  variant?: "compact" | "full";
  onStageChange?: (jobId: string, stage: PipelineStage) => void;
}

function StageColumn({
  stage,
  label,
  tint,
  jobs,
  variant,
}: {
  stage: PipelineStage;
  label: string;
  tint: string;
  jobs: PipelineJob[];
  variant: "compact" | "full";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage}`, data: { stage } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-muted/20 p-3 flex flex-col gap-2 transition-colors",
        variant === "compact" ? "min-h-[160px]" : "min-h-[420px]",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-center justify-between mb-1 sticky top-0">
        <span className={cn("text-xs font-semibold uppercase tracking-wider", tint)}>{label}</span>
        <Badge variant="secondary" className="text-xs">{jobs.length}</Badge>
      </div>
      <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {jobs.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-6 text-center">
              Drop jobs here
            </div>
          ) : (
            jobs.slice(0, variant === "compact" ? 3 : undefined).map((j) => (
              <PipelineCard key={j.id} job={j} />
            ))
          )}
          {variant === "compact" && jobs.length > 3 && (
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              +{jobs.length - 3} more
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function ApplicationPipeline({ jobs, variant = "full", onStageChange }: Props) {
  const [stageMap, setStageMap] = useState<Record<string, PipelineStage>>(() => loadStageMap());
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    saveStageMap(stageMap);
  }, [stageMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const decorated: PipelineJob[] = useMemo(
    () => jobs.map((j) => ({ ...j, stage: stageMap[j.id] ?? j.stage ?? "saved" })),
    [jobs, stageMap]
  );

  const byStage = useMemo(() => {
    const map: Record<PipelineStage, PipelineJob[]> = {
      saved: [], applied: [], interview: [], offer: [], rejected: [],
    };
    decorated.forEach((j) => map[j.stage].push(j));
    return map;
  }, [decorated]);

  const activeJob = activeId ? decorated.find((j) => j.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const jobId = String(active.id);
    let nextStage: PipelineStage | null = null;
    const overId = String(over.id);
    if (overId.startsWith("col:")) {
      nextStage = overId.slice(4) as PipelineStage;
    } else {
      const overJob = decorated.find((j) => j.id === overId);
      if (overJob) nextStage = overJob.stage;
    }
    if (!nextStage) return;
    const current = decorated.find((j) => j.id === jobId)?.stage;
    if (current === nextStage) return;
    setStageMap((prev) => ({ ...prev, [jobId]: nextStage! }));
    onStageChange?.(jobId, nextStage);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "grid gap-3",
          variant === "compact"
            ? "grid-cols-2 md:grid-cols-5"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
        )}
      >
        {PIPELINE_STAGES.map((s) => (
          <StageColumn
            key={s.key}
            stage={s.key}
            label={s.label}
            tint={s.tint}
            jobs={byStage[s.key]}
            variant={variant}
          />
        ))}
      </div>
      <DragOverlay>
        {activeJob ? <PipelineCard job={activeJob} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
