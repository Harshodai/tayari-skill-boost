---
name: taste
description: Apply cultivated taste to interfaces and to prose. Covers UI, layout, typography, product flows, visual polish, and writing — UI copy, docs, messaging, names. Use when designing or critiquing interfaces, writing front-end/CSS, building artifacts, drafting or editing any user-facing text, or when the user mentions taste, polish, jank, design, typography, layout, writing, copy, clarity, or "make it feel good". On invocation, read the taste library for the user's saved examples (see below).
---

# Taste

Taste is noticing what makes something feel great, then reproducing it on purpose.
You learn it by exposure, not birth. It works the same in two domains: **interfaces**
and **prose**. Fix the floor before you reach for meaning.

**Read the taste library first: `~/.claude/taste/references.md`.** It holds the
user's examples and the *why* behind each. Let it set the specifics. If that file
does not exist yet, seed it once by copying `references.template.md` from this
skill's directory to `~/.claude/taste/references.md` (create the `~/.claude/taste/`
directory if needed), then read it.

## Interfaces

### Layer 1 — Kill the jank
Most bad design is just sloppiness no one cleaned up.
- **Align everything.** Share edges; use a grid. Scattered reads as careless.
- **One typeface, vary the weight.** Many fonts read amateur.
- **Body text is most of typography.** Order that matters: body look → size →
  line spacing → line length → font. Web body **15–25px**, `line-height`
  **1.3–1.45 unitless**, **45–90 characters** a line. Font choice comes last.
- **Audit for drift.** Taste erodes by small inconsistencies. Clean them up.

### Layer 2 — Affordances
Every element should show how it works. Software affordances are conventions
(radio picks one, checkbox picks many, the default button is the safe path).
Honor them, or break them on purpose — never by accident.

### Layer 3 — Story and emotion
Design is narrative, and the user finishes it (Lupton).
- **Flows have an arc:** setup, tension, resolution. Onboarding, empty states,
  errors, and success are beats, not screens.
- **Work all three registers** — gut, use, memory (Norman: visceral, behavioral, reflective).
- **Show, don't tell.** Restraint and the right gaps let people infer meaning.
- **Lead with the user's real question.** Put the answer in the biggest type.

## Prose (Zinsser, *On Writing Well*)
Clear writing is clear thinking. Same taste, different medium.
- **Cut clutter.** Strip every sentence to its cleanest parts. Drop the words
  that earn nothing — "in order to", "the fact that", qualifiers like "very",
  "quite", "sort of", adverbs that just repeat the verb.
- **Plain words.** Short, common ones over fancy ones. No jargon.
- **Active voice, strong verbs.** The subject acts. Verbs carry the sentence.
- **One thought per sentence.** Let the reader keep up.
- **Warm and human.** Write like one person talking to another, in your own voice.
- **Rewriting is the work.** First drafts are clutter. The polish is the cutting.
- **Read it aloud.** If it stumbles, fix the rhythm.

## Practice
1. **Subtract first.** Removing the second font, the flourish, the extra step, the
   spare word is usually the higher-taste move. Same instinct in both domains.
2. **Prototype throwaway** before the design or draft hardens — early is cheap.
3. **Name the why** when something works or fails. That sentence is the skill.
