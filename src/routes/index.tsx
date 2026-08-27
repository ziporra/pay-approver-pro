import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, Lock, ShieldCheck, Workflow } from "lucide-react";

import { Brand } from "@/components/Brand";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ledgerline — Vendor payment requests & approvals" },
      {
        name: "description",
        content:
          "Submit vendor payment requests, route them for approval, track payments and chase missing invoices in one controlled internal workflow.",
      },
      { property: "og:title", content: "Ledgerline — Vendor payment requests & approvals" },
      {
        property: "og:description",
        content:
          "One secure workflow for vendor payment requests, approvals, payment execution and invoice follow-up.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Brand />
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">{t("nav.staffSignIn")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-14 sm:pt-24">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Internal finance operations
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
            Vendor payments, requested and approved on the record.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("app.tagline")} Every request carries a frozen snapshot of the vendor's banking
            details, a full status history and an audit trail.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link to="/request">
                {t("nav.newRequest")} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">{t("nav.staffSignIn")}</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border/70 bg-surface">
          <div className="mx-auto grid max-w-6xl gap-px overflow-hidden px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Workflow,
                title: "Guided vendor form",
                body: "Six calm steps: identify, contact, payment method, request, documents, review.",
              },
              {
                icon: ShieldCheck,
                title: "Approval on the record",
                body: "Approve or reject with a reason. Who, when and why is stored permanently.",
              },
              {
                icon: FileCheck2,
                title: "Invoice follow-up",
                body: "Paid without an invoice? The request stays open until the document arrives.",
              },
              {
                icon: Lock,
                title: "Banking stays private",
                body: "Account details are masked everywhere and never leave the private backend.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl bg-card p-6 shadow-panel sm:mx-1.5">
                <item.icon className="size-5 text-accent" />
                <h2 className="mt-4 text-sm font-semibold tracking-tight">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-8">
        <p className="mx-auto max-w-6xl px-5 text-xs text-muted-foreground">
          Ledgerline · internal system. Vendor submissions are rate limited and every action is
          audited.
        </p>
      </footer>
    </div>
  );
}
