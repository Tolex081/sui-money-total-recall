'use client';
import { forwardRef } from 'react';

// One box for "what was this for", with the common categories as choices beneath it. Tapping a choice puts it in
// the box; typing your own words clears the choice and files the label as "Other". The text and the category can
// therefore never disagree.
export const LABEL_CHOICES = ['Food', 'Groceries', 'Transport', 'Home', 'Internet', 'Learning', 'Family', 'Work'];
export const categoryFor = (text: string) => LABEL_CHOICES.find(c => c.toLowerCase() === text.trim().toLowerCase()) ?? 'Other';

type Props = { id: string; note: string; category: string; onChange: (note: string, category: string) => void; describedBy?: string; required?: boolean; label?: string };
export const LabelPicker = forwardRef<HTMLInputElement, Props>(function LabelPicker({ id, note, category, onChange, describedBy, required, label = 'What was this for?' }, ref) {
  const chosen = LABEL_CHOICES.includes(category) && categoryFor(note) === category ? category : null;
  return <div className="label-picker">
    <label htmlFor={id}>{label}</label>
    <input id={id} ref={ref} value={note} maxLength={160} placeholder="Pick one below or type your own" required={required} aria-describedby={describedBy}
      onChange={event => onChange(event.target.value, categoryFor(event.target.value))}/>
    <div className="label-choices" role="group" aria-label="Common labels">
      {LABEL_CHOICES.map(c => <button key={c} type="button" className={'read-filter' + (chosen === c ? ' active' : '')} aria-pressed={chosen === c} onClick={() => onChange(c, c)}>{c}</button>)}
    </div>
    {/* An older label keeps its saved category until its text is edited. */}
    <p className="micro">{!note.trim() ? 'Choose one, or type your own words.' : category === 'Other' ? 'Your own words, filed as Other.' : `Filed as ${category}.`}</p>
  </div>;
});
