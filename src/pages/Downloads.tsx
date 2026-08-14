import { useMemo } from "react";
import { Apple, Download, ExternalLink, Monitor, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { FadeIn } from "@/components/ui/motion";
import { CHROME_EXTENSION_DOWNLOAD_URL, DESKTOP_DOWNLOADS, DESKTOP_RELEASE_URL, desktopDownloadUrl } from "@/config/desktopDownloads";

const icons = { macos: Apple, windows: Monitor, linux: Package } as const;

export default function Downloads() {
  const recommended = useMemo(() => {
    if (typeof navigator === "undefined") return null;
    const agent = navigator.userAgent.toLowerCase();
    if (agent.includes("mac")) return "macos";
    if (agent.includes("win")) return "windows";
    if (agent.includes("linux")) return "linux";
    return null;
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><Logo /><div className="flex items-center gap-2"><Button variant="ghost" asChild><Link to="/">Home</Link></Button><Button asChild><Link to="/auth">Sign in</Link></Button></div></div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <FadeIn className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Download className="h-7 w-7" /></div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Job Tayari Desktop</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Your career workspace, installed.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Use the same Job Tayari account on the web and desktop app. Sign in once, keep your session, and continue your work from the native client.</p>
        </FadeIn>
        <section className="mt-12 grid gap-6 md:grid-cols-3" aria-label="Desktop downloads">
          {DESKTOP_DOWNLOADS.map((download) => {
            const Icon = icons[download.id];
            const isRecommended = recommended === download.id;
            return <Card key={download.id} className={isRecommended ? "border-primary shadow-lg shadow-primary/10" : ""}>
              <CardHeader><div className="mb-4 flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-primary"><Icon className="h-5 w-5" /></div>{isRecommended && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Recommended</span>}</div><CardTitle>{download.platform}</CardTitle><CardDescription>{download.title}</CardDescription></CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground"><p>{download.description}</p><div className="rounded-lg bg-muted/60 p-3 font-mono text-xs">{download.architecture} · {download.requirements}</div></CardContent>
              <CardFooter><Button asChild className="w-full"><a href={desktopDownloadUrl(download.filename)} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" /> Download {download.platform}</a></Button></CardFooter>
            </Card>;
          })}
        </section>
        <FadeIn className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/30 bg-primary/5 p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Chrome side panel</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Open Job Tayari beside job pages for context, fit analysis, review queues, and approval-gated autofill.</p></div><Button asChild><a href={CHROME_EXTENSION_DOWNLOAD_URL} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" /> Install extension</a></Button></div></FadeIn>
        <FadeIn className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border/60 bg-muted/20 p-6"><h2 className="font-semibold">Release channel</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Downloads are served from the signed release channel. View release status and checksums on GitHub.</p><Button variant="outline" asChild className="mt-4"><a href={DESKTOP_RELEASE_URL} target="_blank" rel="noreferrer">View release notes <ExternalLink className="ml-2 h-4 w-4" /></a></Button></FadeIn>
      </main>
    </div>
  );
}
