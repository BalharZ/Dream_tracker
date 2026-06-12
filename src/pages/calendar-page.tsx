import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarEvent } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { googleCalendarUrl, downloadIcs } from "@/lib/ics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Download,
  ExternalLink,
  Loader2,
  Clock,
} from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "HH:MM:SS" → "HH:MM" for display and <input type="time"> */
function shortTime(time: string | null) {
  return time ? time.slice(0, 5) : "";
}

function formatEventTime(ev: CalendarEvent) {
  if (!ev.start_time) return "All day";
  return ev.end_time
    ? `${shortTime(ev.start_time)} – ${shortTime(ev.end_time)}`
    : shortTime(ev.start_time);
}

type DayCell = { date: string; day: number; inMonth: boolean };

/** Six-row month grid starting on Monday, padded with adjacent months. */
function buildMonthGrid(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-start
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, i - offset + 1);
    cells.push({
      date: toDateStr(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

type EventFormState = {
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  description: string;
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const todayStr = toDateStr(new Date());

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventFormState>({
    title: "",
    date: todayStr,
    allDay: false,
    startTime: "",
    endTime: "",
    description: "",
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!user,
  });

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events ?? []) {
      (map[ev.date] ??= []).push(ev);
    }
    return map;
  }, [events]);

  const saveEvent = useMutation({
    mutationFn: async () => {
      const title = form.title.trim();
      if (!title) throw new Error("Title is required");
      if (!form.date) throw new Error("Date is required");
      if (!form.allDay && !form.startTime)
        throw new Error("Start time is required (or mark the event as all-day)");
      const row = {
        user_id: user!.id,
        title,
        description: form.description.trim() || null,
        date: form.date,
        start_time: form.allDay ? null : form.startTime,
        end_time: form.allDay || !form.endTime ? null : form.endTime,
      };
      if (editingEvent) {
        const { error } = await supabase
          .from("events")
          .update(row)
          .eq("id", editingEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setDialogOpen(false);
      setSelectedDate(form.date);
      toast({ title: editingEvent ? "Event updated" : "Event created" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not save event", description: error.message, variant: "destructive" });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Event deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not delete event", description: error.message, variant: "destructive" });
    },
  });

  const openCreate = (date: string) => {
    setEditingEvent(null);
    setForm({ title: "", date, allDay: false, startTime: "", endTime: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      date: ev.date,
      allDay: !ev.start_time,
      startTime: shortTime(ev.start_time),
      endTime: shortTime(ev.end_time),
      description: ev.description ?? "",
    });
    setDialogOpen(true);
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(todayStr);
  };

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const selectedEvents = eventsByDate[selectedDate] ?? [];

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-2">Calendar</h1>
          <p className="text-muted-foreground">
            Plan your events and export them to Google or Apple Calendar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => downloadIcs("dream-tracker-events.ics", events ?? [])}
            disabled={!events || events.length === 0}
            title="Download all events as an .ics file (Apple Calendar, Outlook…)"
          >
            <Download className="h-4 w-4 mr-2" />
            Export all
          </Button>
          <Button onClick={() => openCreate(selectedDate)}>
            <Plus className="h-4 w-4 mr-2" />
            New event
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold ml-2">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      {/* Month grid */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {cells.map((cell) => {
              const dayEvents = eventsByDate[cell.date] ?? [];
              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === todayStr;
              return (
                <button
                  key={cell.date}
                  onClick={() => setSelectedDate(cell.date)}
                  className={cn(
                    "min-h-[3.5rem] sm:min-h-[5.5rem] p-1 sm:p-1.5 text-left align-top transition-colors flex flex-col gap-0.5",
                    cell.inMonth ? "bg-card" : "bg-muted/50",
                    isSelected ? "ring-2 ring-primary ring-inset" : "hover:bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs sm:text-sm shrink-0",
                      isToday && "bg-primary text-primary-foreground font-semibold",
                      !cell.inMonth && !isToday && "text-muted-foreground"
                    )}
                  >
                    {cell.day}
                  </span>
                  {/* Event chips on larger screens, dots on mobile */}
                  <span className="hidden sm:flex flex-col gap-0.5 w-full min-w-0">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <span
                        key={ev.id}
                        className="truncate rounded bg-primary/15 text-primary px-1 py-px text-[11px] leading-4"
                        title={ev.title}
                      >
                        {ev.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[11px] text-muted-foreground px-1">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </span>
                  <span className="flex sm:hidden gap-0.5 px-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span key={ev.id} className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h3>
          <Button variant="outline" size="sm" onClick={() => openCreate(selectedDate)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            No events on this day
          </p>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((ev) => (
              <Card key={ev.id}>
                <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{ev.title}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatEventTime(ev)}
                    </div>
                    {ev.description && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">
                        {ev.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Add to Google Calendar"
                      onClick={() => window.open(googleCalendarUrl(ev), "_blank", "noopener")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Download .ics (Apple Calendar, Outlook…)"
                      onClick={() =>
                        downloadIcs(`${ev.title.replace(/[^\w-]+/g, "-").toLowerCase() || "event"}.ics`, [ev])
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(ev)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => deleteEvent.mutate(ev.id)}
                      disabled={deleteEvent.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveEvent.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Gym session"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="event-all-day">All-day event</Label>
              <Switch
                id="event-all-day"
                checked={form.allDay}
                onCheckedChange={(allDay) => setForm((f) => ({ ...f, allDay }))}
              />
            </div>
            {!form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="event-start">Start time</Label>
                  <Input
                    id="event-start"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-end">End time (optional)</Label>
                  <Input
                    id="event-end"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="event-description">Description (optional)</Label>
              <Textarea
                id="event-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saveEvent.isPending}>
              {saveEvent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEvent ? "Update Event" : "Create Event"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
