import { Bookmark, Share2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function IconActionTooltips() {
  return (
    <TooltipProvider>
      <div style={{ display: 'flex', gap: 24, paddingTop: 24 }}>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Save job">
              <Bookmark />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save job</TooltipContent>
        </Tooltip>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Share job">
              <Share2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share job</TooltipContent>
        </Tooltip>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Remove job">
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove from list</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export function AtsScoreTooltip() {
  return (
    <TooltipProvider>
      <div style={{ paddingTop: 24 }}>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <span tabIndex={0} style={{ cursor: 'help' }}>
              <Badge variant="success">91% match</Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent>Calculated from keyword match, formatting, and quantified impact</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
