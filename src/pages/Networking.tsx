import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Loader2,
  Mail,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
  Linkedin,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Contact {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship: string;
  source: string | null;
  notes: string | null;
}

interface OutreachMessage {
  id: string;
  contact_id: string | null;
  channel: string;
  kind: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

const KINDS = [
  { value: "intro", label: "Intro" },
  { value: "referral", label: "Referral ask" },
  { value: "followup", label: "Follow-up" },
  { value: "thanks", label: "Thank you" },
];

export function Networking() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kind, setKind] = useState("intro");
  const [targetRole, setTargetRole] = useState("");
  const [proofPoints, setProofPoints] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    title: "",
    company: "",
    email: "",
    linkedin_url: "",
    relationship: "cold",
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Contact[];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["outreach-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as OutreachMessage[];
    },
  });

  const selected = useMemo(() => contacts.find((c) => c.id === selectedId) ?? null, [contacts, selectedId]);
  const selectedMessages = useMemo(
    () => (selected ? messages.filter((m) => m.contact_id === selected.id) : []),
    [messages, selected],
  );

  const addContact = async () => {
    if (!newContact.name.trim()) return toast.error("Name is required");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return toast.error("Sign in first");
    const { error } = await supabase.from("contacts").insert({ ...newContact, user_id: auth.user.id });
    if (error) return toast.error(error.message);
    setNewContact({ name: "", title: "", company: "", email: "", linkedin_url: "", relationship: "cold" });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    toast.success("Contact added");
  };

  const removeContact = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selectedId === id) setSelectedId(null);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["outreach-messages"] });
  };

  const draft = async () => {
    if (!selected) return;
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-outreach", {
        body: {
          contactName: selected.name,
          contactTitle: selected.title ?? "",
          company: selected.company ?? "",
          relationship: selected.relationship,
          kind,
          targetRole,
          proofPoints,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sign in first");

      const rows = [
        data.email
          ? {
              user_id: auth.user.id,
              contact_id: selected.id,
              channel: "email",
              kind,
              subject: data.subject ?? null,
              body: data.email as string,
            }
          : null,
        data.linkedin
          ? {
              user_id: auth.user.id,
              contact_id: selected.id,
              channel: "linkedin",
              kind,
              subject: null,
              body: data.linkedin as string,
            }
          : null,
      ].filter(Boolean) as Record<string, unknown>[];

      if (rows.length) {
        const { error: insErr } = await supabase.from("outreach_messages").insert(rows as never);
        if (insErr) throw new Error(insErr.message);
      }
      queryClient.invalidateQueries({ queryKey: ["outreach-messages"] });
      toast.success("Drafts ready — review before sending");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft");
    } finally {
      setDrafting(false);
    }
  };

  const markSent = async (id: string) => {
    const { error } = await supabase
      .from("outreach_messages")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["outreach-messages"] });
  };

  const markReplied = async (id: string) => {
    const { error } = await supabase.from("outreach_messages").update({ status: "replied" }).eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["outreach-messages"] });
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const openMail = (m: OutreachMessage) => {
    const to = selected?.email ?? "";
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(
        m.subject ?? "",
      )}&body=${encodeURIComponent(m.body)}`,
      "_blank",
      "noopener",
    );
  };

  const sentCount = messages.filter((m) => m.status !== "draft").length;
  const repliedCount = messages.filter((m) => m.status === "replied").length;

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-2 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Networking &amp; referrals</h1>
            <Badge variant="outline">
              <Users className="mr-1 h-3.5 w-3.5" /> {contacts.length} contacts
            </Badge>
            <Badge variant="outline">{sentCount} sent</Badge>
            <Badge variant="outline">{repliedCount} replied</Badge>
          </div>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Drafts only. Tayari never scrapes LinkedIn and never sends a message for you — you copy,
            review, and send from your own account.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add a contact</CardTitle>
                <CardDescription>Recruiter, hiring manager, or an alum you can ask.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input placeholder="Name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                <Input placeholder="Title" value={newContact.title} onChange={(e) => setNewContact({ ...newContact, title: e.target.value })} />
                <Input placeholder="Company" value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} />
                <Input placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                <Input placeholder="LinkedIn URL" value={newContact.linkedin_url} onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })} />
                <Select value={newContact.relationship} onValueChange={(v) => setNewContact({ ...newContact, relationship: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="warm">Warm intro possible</SelectItem>
                    <SelectItem value="alum">Alum / shared background</SelectItem>
                    <SelectItem value="known">Already know them</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addContact} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add contact
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Contacts</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                ) : (
                  contacts.map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selectedId === c.id ? "border-primary/40 bg-primary/5" : "hover:bg-muted/60"
                      }`}
                    >
                      <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(c.id)}>
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[c.title, c.company].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => removeContact(c.id)} aria-label={`Remove ${c.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {!selected ? (
              <Card>
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  Select a contact to draft outreach.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{selected.name}</CardTitle>
                    <CardDescription>
                      {[selected.title, selected.company].filter(Boolean).join(" · ")} · {selected.relationship}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="kind">Message type</Label>
                        <Select value={kind} onValueChange={setKind}>
                          <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {KINDS.map((k) => (
                              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="target-role">Role you're targeting</Label>
                        <Input id="target-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Senior Backend Engineer" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="proof">Evidence you can honestly claim</Label>
                      <Textarea
                        id="proof"
                        rows={3}
                        value={proofPoints}
                        onChange={(e) => setProofPoints(e.target.value)}
                        placeholder="Shipped a payments service handling 10M events/day, cut p99 latency 45%…"
                      />
                    </div>
                    <Button onClick={draft} disabled={drafting} className="w-full sm:w-auto">
                      {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Draft outreach
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Drafts &amp; history</CardTitle></CardHeader>
                  <CardContent>
                    {selectedMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nothing drafted for this contact yet.</p>
                    ) : (
                      <Tabs defaultValue="drafts">
                        <TabsList>
                          <TabsTrigger value="drafts">Drafts</TabsTrigger>
                          <TabsTrigger value="sent">Sent</TabsTrigger>
                        </TabsList>
                        {(["drafts", "sent"] as const).map((tab) => (
                          <TabsContent key={tab} value={tab} className="space-y-3 pt-4">
                            {selectedMessages
                              .filter((m) => (tab === "drafts" ? m.status === "draft" : m.status !== "draft"))
                              .map((m) => (
                                <div key={m.id} className="space-y-2 rounded-lg border p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {m.channel === "linkedin" ? <Linkedin className="mr-1 h-3 w-3" /> : <Mail className="mr-1 h-3 w-3" />}
                                      {m.kind}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                                  </div>
                                  {m.subject ? <div className="text-sm font-medium">{m.subject}</div> : null}
                                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{m.body}</p>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={() => copy(m.subject ? `${m.subject}\n\n${m.body}` : m.body)}>
                                      <Copy className="mr-2 h-3.5 w-3.5" /> Copy
                                    </Button>
                                    {m.channel === "email" ? (
                                      <Button size="sm" variant="outline" onClick={() => openMail(m)}>
                                        <Send className="mr-2 h-3.5 w-3.5" /> Open in Gmail
                                      </Button>
                                    ) : null}
                                    {m.status === "draft" ? (
                                      <Button size="sm" onClick={() => markSent(m.id)}>I sent this</Button>
                                    ) : m.status === "sent" ? (
                                      <Button size="sm" variant="secondary" onClick={() => markReplied(m.id)}>They replied</Button>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                          </TabsContent>
                        ))}
                      </Tabs>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default Networking;
