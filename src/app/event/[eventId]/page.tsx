import { Viewer } from "@/components/viewer";
export default async function EventPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view;
  return <Viewer eventId={(await params).eventId} mode={view === "display" || view === "subtitle" ? view : "standard"}/>;
}
