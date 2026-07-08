import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogContentNoClose } from "@/components/ui/dialog-no-close";
import { Button } from "@/components/ui/button";
import { Habit, Reward } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { getChance, getQuantity, parseHabitChances } from "@/lib/habit-chances";

/**
 * Reward "case opening" roulette. Shared between the Habits page and the
 * Dashboard so that filling a habit to its target anywhere triggers the exact
 * same animation and reward-claim logic.
 */
export function RewardRoulette({
  show,
  onClose,
  habit,
  rewards,
}: {
  show: boolean;
  onClose: () => void;
  habit: Habit;
  rewards: Reward[];
}) {
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [animationPhase, setAnimationPhase] = useState<'initial' | 'spinning' | 'finished'>('initial');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [rewardCards, setRewardCards] = useState<Reward[]>([]);
  const rewardClaimedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const winningCardRef = useRef<HTMLDivElement>(null);
  const [targetTranslate, setTargetTranslate] = useState(-5730);

  const fixedWinningIndex = 50;

  // Measure real card/container sizes so the winning card lands exactly under
  // the orange line on any screen width (previously a hardcoded -5730px that
  // only matched desktop, so mobile pointed at the wrong card).
  useLayoutEffect(() => {
    if (!show) return;
    const measure = () => {
      const container = containerRef.current;
      const card = winningCardRef.current;
      if (!container || !card) return;
      const containerWidth = container.clientWidth;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      setTargetTranslate(Math.round(containerWidth / 2 - cardCenter));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [show, rewardCards]);

  useEffect(() => {
    if (show) {
      setIsAnimating(true);
      setIsFinished(false);
      rewardClaimedRef.current = false;
      setAnimationPhase('initial');

      const emptySlot = {
        id: 0,
        name: "Progress is also a reward!",
        available: 0,
        image: "",
        user_id: "",
        habit_chances: "{}"
      } as Reward;

      const habitRewards = rewards.filter(
        r => parseHabitChances(r.habit_chances)[habit.id] !== undefined
      );

      let totalChance = 0;
      const rewardChances: Record<number, number> = {};

      habitRewards.forEach(reward => {
        const chance = getChance(parseHabitChances(reward.habit_chances)[habit.id]);
        rewardChances[reward.id] = chance;
        totalChance += chance;
      });

      let chosenReward = emptySlot;
      const roll = Math.random() * 100;
      let cumulativeChance = 0;

      for (const reward of habitRewards) {
        cumulativeChance += rewardChances[reward.id] || 0;
        if (roll <= cumulativeChance) {
          chosenReward = reward;
          break;
        }
      }

      setSelectedReward(chosenReward);

      const cards: Reward[] = [];
      const emptyProportion = Math.max(0.2, 1 - (totalChance / 100) * 0.8);

      for (let i = 0; i < 100; i++) {
        if (i === fixedWinningIndex) {
          cards.push(chosenReward);
        } else {
          if (Math.random() < emptyProportion || habitRewards.length === 0) {
            cards.push(emptySlot);
          } else {
            let rewardRoll = Math.random() * totalChance;
            let cumulative = 0;
            let randomReward = habitRewards[0];

            for (const reward of habitRewards) {
              cumulative += rewardChances[reward.id] || 0;
              if (rewardRoll <= cumulative) {
                randomReward = reward;
                break;
              }
            }
            cards.push(randomReward);
          }
        }
      }

      setRewardCards(cards);

      setTimeout(() => {
        setAnimationPhase('spinning');
        setTimeout(() => {
          setAnimationPhase('finished');
          setIsFinished(true);
          setIsAnimating(false);

          if (!rewardClaimedRef.current && chosenReward.id > 0) {
            rewardClaimedRef.current = true;
            // A harder habit can grant several pieces of the same reward at once.
            const wonQuantity = getQuantity(
              parseHabitChances(chosenReward.habit_chances)[habit.id]
            );
            supabase
              .from("rewards")
              .update({ available: chosenReward.available + wonQuantity })
              .eq("id", chosenReward.id)
              .then(({ error }) => {
                if (error) {
                  console.error('Error claiming reward:', error);
                } else {
                  queryClient.invalidateQueries({ queryKey: ["rewards"] });
                }
              });
          }
        }, 4400);
      }, 300);
    } else {
      setIsAnimating(false);
      setIsFinished(false);
      setAnimationPhase('initial');
    }
  }, [show, habit.id]);

  const getRewardStyles = () => {
    if (animationPhase === 'initial') {
      return { transform: 'translateX(0px)', transition: 'none' };
    }
    if (animationPhase === 'spinning') {
      return {
        transform: `translateX(${targetTranslate}px)`,
        transition: 'transform 4.2s cubic-bezier(0.18, 0.89, 0.32, 1)'
      };
    }
    return { transform: `translateX(${targetTranslate}px)`, transition: 'none' };
  };

  if (!show || !selectedReward) {
    return null;
  }

  return (
    <Dialog
      open={show}
      onOpenChange={(open) => {
        if (!open && !isAnimating) {
          onClose();
        }
      }}
    >
      <DialogContentNoClose className="max-w-3xl bg-gray-900 text-white border-2 border-blue-500">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              {isAnimating
                ? "Opening Reward Case..."
                : (selectedReward.id > 0 ? "Congratulations!" : "Progress is also a reward!")}
            </DialogTitle>
          </DialogHeader>

          <div ref={containerRef} className="relative mx-auto overflow-hidden h-44 bg-gray-800 rounded-lg border-2 border-gray-700 my-4">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="h-full w-[4px] bg-orange-500 animate-pulse relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[20px] h-[5px] bg-orange-500"></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[20px] h-[5px] bg-orange-500"></div>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center">
              <div
                className="flex absolute left-0 items-center"
                style={isAnimating ? getRewardStyles() : { transform: `translateX(${targetTranslate}px)` }}
              >
                {rewardCards.map((card, index) => {
                  const isWinningCard = index === 50;
                  const cardQuantity =
                    card.id > 0 ? getQuantity(parseHabitChances(card.habit_chances)[habit.id]) : 1;

                  return (
                    <div
                      key={`card-${index}`}
                      ref={isWinningCard ? winningCardRef : undefined}
                      className={`relative flex-shrink-0 w-28 h-32 mx-1 p-2 rounded-lg flex flex-col items-center justify-center
                        ${card.id === 0
                          ? 'bg-gray-800/80 border-2 border-gray-600'
                          : (() => {
                              const chance = getChance(parseHabitChances(card.habit_chances)[habit.id]);
                              if (chance < 10) return 'bg-amber-900/80 border-2 border-amber-600';
                              if (chance < 20) return 'bg-red-900/80 border-2 border-red-600';
                              if (chance < 30) return 'bg-purple-900/80 border-2 border-purple-600';
                              if (chance < 50) return 'bg-blue-900/80 border-2 border-blue-600';
                              return 'bg-green-900/80 border-2 border-green-600';
                            })()
                        }`
                      }
                      style={!isAnimating && isWinningCard ? {
                        opacity: 0.9,
                        transform: "scale(1.1)",
                        boxShadow: '0 0 15px rgba(255, 165, 0, 0.8)',
                        zIndex: 10
                      } : !isAnimating ? {
                        opacity: 0.4,
                        zIndex: 1
                      } : {}}
                    >
                      {cardQuantity > 1 && (
                        <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-bold leading-none">
                          ×{cardQuantity}
                        </div>
                      )}
                      <div className="w-22 h-22 rounded-md overflow-hidden bg-gray-700 flex items-center justify-center mb-1">
                        {card.id > 0 ? (
                          <img
                            src={card.image || ''}
                            alt={card.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiMzMzMiIHJ4PSI4IiByeT0iOCIgLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjNDQ0IiByeD0iNCIgcnk9IjQiIHN0cm9rZT0iIzU1NSIgc3Ryb2tlLXdpZHRoPSIxIiAvPjxnIGZpbGw9IiM2NjYiPjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjEwIiByeD0iMiIgcnk9IjIiIC8+PHJlY3QgeD0iMjAiIHk9IjQwIiB3aWR0aD0iODAiIGhlaWdodD0iOCIgcng9IjIiIHJ5PSIyIiAvPjxyZWN0IHg9IjIwIiB5PSI2MCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjgiIHJ4PSIyIiByeT0iMiIgLz48cmVjdCB4PSIyMCIgeT0iODAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI4IiByeD0iMiIgcnk9IjIiIC8+PC9nPjwvc3ZnPg=="
                            }}
                          />
                        ) : (
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="24" height="24" rx="12" fill="#047857" opacity="0.1"/>
                            <path d="M4 4V18H20" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="6" y="14" width="2" height="2" rx="0.5" fill="#10B981"/>
                            <rect x="10" y="12" width="2" height="4" rx="0.5" fill="#10B981"/>
                            <rect x="14" y="9" width="2" height="7" rx="0.5" fill="#10B981"/>
                            <rect x="18" y="5" width="2" height="11" rx="0.5" fill="#10B981"/>
                            <path d="M5 15C6.5 13.5 8 12.5 10 11C12 9.5 14 7 18 4.5"
                                  stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M18 4.5L16 8" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M18 4.5L14.5 5.5" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className={`text-xs font-bold text-center text-white w-full ${card.id === 0 ? 'whitespace-normal h-10 flex items-center justify-center' : 'truncate'}`}>
                        {card.id === 0
                          ? "Progress is also a reward!"
                          : (card.name.length > 15 ? `${card.name.substring(0, 15)}...` : card.name)
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {!isAnimating && (
            <>
              <div className="my-4 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {selectedReward.id > 0 ? (
                    <>
                      <p className="text-green-400 font-medium text-lg">
                        {(() => {
                          const q = getQuantity(
                            parseHabitChances(selectedReward.habit_chances)[habit.id]
                          );
                          return (
                            <>
                              You won {q > 1 ? `${q}× ` : "a "}
                              <span className="font-bold">{selectedReward.name}</span>!
                            </>
                          );
                        })()}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        You'll find your reward in Rewards.
                      </p>
                    </>
                  ) : (
                    <p className="text-amber-400 font-medium text-lg">
                      Keep building habits - progress itself is a valuable reward!
                    </p>
                  )}
                </motion.div>
              </div>

              <div className="flex justify-center gap-2 pt-4">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="mx-auto"
                >
                  <Button
                    onClick={onClose}
                    className={`rounded-md font-bold ${
                      selectedReward.id > 0
                        ? "bg-green-600 hover:bg-green-700 text-white px-8 py-2"
                        : "bg-amber-600 hover:bg-amber-700 text-white"
                    }`}
                  >
                    Continue
                  </Button>
                </motion.div>
              </div>
            </>
          )}
        </motion.div>
      </DialogContentNoClose>
    </Dialog>
  );
}
