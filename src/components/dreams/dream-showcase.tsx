import { Link } from "wouter";
import { ChevronRight, Star } from "lucide-react";
import type { Dream } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";

const GOLD = "#FFD666";

/**
 * Dashboard "Your dreams": a picture card per dream with its progress ring.
 * Phones get a swipeable row, wider screens a grid. The image is shown whole
 * (object-contain) over a blurred copy of itself, so any aspect ratio fills
 * the square card without cropping.
 */
export function DreamShowcase({ dreams, isLoading }: { dreams?: Dream[]; isLoading: boolean }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Star className="h-5 w-5 fill-gold text-gold" />
          Your dreams
        </h2>
        {!!dreams?.length && (
          <Link href="/dreams">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              All dreams <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <Row>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square w-[72%] shrink-0 snap-start rounded-2xl sm:w-auto" />
          ))}
        </Row>
      ) : dreams?.length ? (
        <Row>
          {dreams.map((dream) => (
            <DreamTile key={dream.id} dream={dream} />
          ))}
        </Row>
      ) : (
        <div className="rounded-2xl border border-dashed py-10 text-center">
          <h3 className="mb-1 font-medium">No dreams yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">Start with the big picture — what do you want?</p>
          <Link href="/dreams">
            <Button>Add your first dream</Button>
          </Link>
        </div>
      )}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
      {children}
    </div>
  );
}

/**
 * One dream as a picture tile. Without `onClick` it links to the Dreams page
 * (dashboard); with it, it's a button (Dreams page opens the editor).
 */
type TileDream = Pick<Dream, "name" | "image" | "positive_motivation" | "progress">;

export function DreamTile({ dream, onClick, className }: { dream: TileDream; onClick?: () => void; className?: string }) {
  const progress = Math.max(0, Math.min(100, dream.progress || 0));
  const done = progress >= 100;
  const tileClass = cn(
    "group relative block aspect-square w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl bg-primary text-left shadow-card ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto",
    className
  );
  const content = (
    <>
        {dream.image && (
          <>
            <img src={dream.image} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
            <img src={dream.image} alt={dream.name} className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]" />
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-3 text-white">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-lg font-semibold leading-tight drop-shadow">{dream.name}</h3>
            {dream.positive_motivation && (
              <p className="mt-0.5 line-clamp-1 text-xs text-white/75">{dream.positive_motivation}</p>
            )}
          </div>
          <ProgressRing value={progress / 100} color={GOLD} trackColor="rgba(255,255,255,0.25)" size={52} stroke={5}>
            <span className="text-[11px] text-white">{done ? "✓" : `${Math.round(progress)}%`}</span>
          </ProgressRing>
        </div>
        {done && (
          <span className="absolute left-3 top-3 rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-gold-foreground">
            Achieved
          </span>
        )}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={tileClass}>{content}</button>
  ) : (
    <Link href="/dreams" className={tileClass}>{content}</Link>
  );
}
