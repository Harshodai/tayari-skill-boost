import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export interface AddInterviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { title: string; company: string; location: string; url: string }) => void;
  isPending: boolean;
}

export const AddInterviewModal: React.FC<AddInterviewModalProps> = ({
  open,
  onOpenChange,
  onAdd,
  isPending,
}) => {
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");

  const handleSubmit = () => {
    if (!jobTitle.trim() || !company.trim()) return;
    onAdd({
      title: jobTitle,
      company,
      location,
      url,
    });
    setJobTitle("");
    setCompany("");
    setLocation("");
    setUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Application</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Job Title</label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Software Engineer"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Company</label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Google"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Location</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Remote"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Apply URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !jobTitle.trim() || !company.trim()}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
