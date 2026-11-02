import { Inbox, LayoutGrid, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/app-shell";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToastDemo } from "./toast-demo";

const nav: NavItem[] = [
  { href: "/", label: "Home", icon: <LayoutGrid /> },
  { href: "/dev/components", label: "Components", icon: <Users /> },
];

type DemoLead = { name: string; stage: string; value: number };

const leads: DemoLead[] = [
  { name: "Harbour Offices", stage: "Quoted", value: 18450 },
  { name: "Greenfield Clinic", stage: "Won", value: 7200 },
  { name: "Oak Street Hotel", stage: "Lost", value: 31000 },
];

const stageTones = { Quoted: "info", Won: "good", Lost: "bad" } as const;

const columns: DataTableColumn<DemoLead>[] = [
  { key: "name", header: "Lead", cell: (lead) => lead.name },
  {
    key: "stage",
    header: "Stage",
    cell: (lead) => (
      <StatusBadge
        tone={stageTones[lead.stage as keyof typeof stageTones] ?? "neutral"}
      >
        {lead.stage}
      </StatusBadge>
    ),
  },
  {
    key: "value",
    header: "Value",
    numeric: true,
    cell: (lead) => lead.value.toLocaleString("en-US"),
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-3">
        {children}
      </CardContent>
    </Card>
  );
}

export default function ComponentCatalogPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <AppShell nav={nav}>
      <PageHeader
        title="Component catalog"
        description="Every shared component with example states. Dev and preview only."
        actions={<Button>Primary action</Button>}
      />

      <Section title="PageHeader and buttons">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="StatusBadge and Badge">
        <StatusBadge tone="good">Delivered</StatusBadge>
        <StatusBadge tone="info">Scheduled</StatusBadge>
        <StatusBadge tone="warn">Awaiting stock</StatusBadge>
        <StatusBadge tone="bad">Overdue</StatusBadge>
        <StatusBadge>Draft</StatusBadge>
        <Badge variant="outline">Outline</Badge>
      </Section>

      <section className="grid gap-2">
        <h2 className="font-heading text-base font-medium">DataTable</h2>
        <DataTable
          columns={columns}
          rows={leads}
          getRowKey={(lead) => lead.name}
        />
        <DataTable
          columns={columns}
          rows={[]}
          getRowKey={(lead) => lead.name}
          empty={
            <EmptyState
              icon={Inbox}
              title="No leads yet"
              description="Leads you add will show up here."
              action={<Button size="sm">Add lead</Button>}
            />
          }
        />
      </section>

      <Section title="Form controls">
        <FieldGroup className="w-full max-w-md">
          <Field>
            <FieldLabel htmlFor="demo-name">Name</FieldLabel>
            <Input id="demo-name" placeholder="Customer name" />
          </Field>
          <Field>
            <FieldLabel htmlFor="demo-stage">Stage</FieldLabel>
            <Select defaultValue="quoted">
              <SelectTrigger id="demo-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="won">Won</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="demo-notes">Notes</FieldLabel>
            <Textarea id="demo-notes" placeholder="Site notes" />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="demo-follow-up" />
            <FieldLabel htmlFor="demo-follow-up">Needs follow-up</FieldLabel>
          </Field>
        </FieldGroup>
      </Section>

      <Section title="Overlays and feedback">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this lead?</DialogTitle>
              <DialogDescription>This cannot be undone.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToastDemo />
        <div className="grid w-full max-w-xs gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Section>

      <Card>
        <CardHeader>
          <CardTitle>Card</CardTitle>
          <CardDescription>
            Panels are cards on the grey ground.
          </CardDescription>
        </CardHeader>
      </Card>
    </AppShell>
  );
}
