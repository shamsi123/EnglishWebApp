import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { getItem } from '@/content/course';
import { ArabicText } from '@/ui/ArabicText';
import { Feedback } from '../Feedback';
import type { ActivityProps } from '../types';
import { useAnswer } from '../useAnswer';

function Tile({ id, glyph, label, shaking, disabled }: { id: string; glyph: string; label: string; shaking: boolean; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-testid={`tile-${id}`}
      aria-label={label}
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, touchAction: 'none' }}
      className={`flex h-24 w-24 items-center justify-center rounded-blob bg-white shadow-[0_6px_0_#ddd6fe] ${isDragging ? 'z-10 scale-110 shadow-xl' : ''} ${shaking ? 'animate-shake' : ''}`}
    >
      <ArabicText className="text-6xl leading-none">{glyph}</ArabicText>
    </button>
  );
}

function Basket({ emoji, word, filled }: { emoji: string; word: string; filled: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'basket' });
  return (
    <div
      ref={setNodeRef}
      data-testid="basket"
      className={`flex w-full flex-col items-center gap-2 rounded-blob border-4 border-dashed p-4 transition-colors ${
        isOver ? 'border-grape-500 bg-grape-100' : 'border-sun-400 bg-sun-100'
      }`}
    >
      <span className="text-7xl">{emoji}</span>
      <ArabicText className="text-3xl font-bold text-ink/70">{word}</ArabicText>
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/70 text-5xl">
        {filled ? <ArabicText className="text-6xl text-leaf-500 animate-pop-in">{filled}</ArabicText> : '🧺'}
      </div>
    </div>
  );
}

/** A4 Drag & Drop: drag the letter that starts the pictured word into the basket. */
export default function DragDrop({ activity, onDone }: ActivityProps<'drag_drop'>) {
  const target = getItem(activity.itemId);
  const { feedback, answer, finished } = useAnswer(activity, onDone);
  const [filled, setFilled] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over?.id !== 'basket') return;
    const id = String(e.active.id);
    const ok = id === activity.itemId;
    if (ok) setFilled(getItem(id).glyph);
    else {
      setShake(id);
      window.setTimeout(() => setShake(null), 400);
    }
    answer(ok);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col items-center gap-6 pt-2">
        <Basket emoji={target.example.emoji} word={target.example.word} filled={filled} />
        <div dir="rtl" className="flex justify-center gap-4">
          {activity.options
            .filter((id) => !(filled && id === activity.itemId))
            .map((id) => (
              <Tile key={id} id={id} glyph={getItem(id).glyph} label={getItem(id).name.en} shaking={shake === id} disabled={finished} />
            ))}
        </div>
        <Feedback state={feedback} />
      </div>
    </DndContext>
  );
}
