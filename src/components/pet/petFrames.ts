/**
 * ASCII frame sets for the Tayari companion pet.
 *
 * Modelled on the frame-driven ASCII animation used by the Codex CLI TUI
 * (`codex-rs/tui/src/ascii_animation.rs` + `frames.rs`): a state owns an
 * ordered list of fixed-width frames, and a single ticker advances the index.
 * Every frame in a state MUST have the same number of lines and the same line
 * width so the pet never jitters between ticks.
 */

export type PetState =
  | "idle"
  | "blink"
  | "wave"
  | "thinking"
  | "celebrate"
  | "sleep";

/** Default milliseconds between frames (Codex uses a shared FRAME_TICK). */
export const FRAME_TICK_DEFAULT = 220;

const f = (s: string) => s.replace(/^\n/, "").replace(/\n$/, "");

export const PET_FRAMES: Record<PetState, string[]> = {
  idle: [
    f(`
     .   
   .-+-.  
  | o o | 
  |  ~  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
      .  
   .-+-.  
  | o o | 
  |  ~  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
    .    
   .-+-.  
  | o o | 
  |  ~  | 
   '-+-'  
  /[___]\\ 
`),
  ],
  blink: [
    f(`
     .   
   .-+-.  
  | - - | 
  |  ~  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
     .   
   .-+-.  
  | o o | 
  |  ~  | 
   '-+-'  
  /[___]\\ 
`),
  ],
  wave: [
    f(`
     .   
   .-+-.  
  | ^ ^ |/
  |  u  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
     .   
   .-+-.  
  | ^ ^ |_
  |  u  | 
   '-+-'  
  /[___]\\ 
`),
  ],
  thinking: [
    f(`
   . o   
   .-+-.  
  | o o | 
  |  o  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
   .  o  
   .-+-.  
  | o - | 
  |  o  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
   .   o 
   .-+-.  
  | - o | 
  |  o  | 
   '-+-'  
  /[___]\\ 
`),
  ],
  celebrate: [
    f(`
   \\ . / 
   .-+-.  
  | ^ ^ | 
  |  U  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
   * . * 
   .-+-.  
  | ^ ^ | 
  |  U  | 
   '-+-'  
  /[___]\\ 
`),
  ],
  sleep: [
    f(`
     z   
   .-+-.  
  | - - | 
  |  o  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
      z  
   .-+-.  
  | - - | 
  |  _  | 
   '-+-'  
  /[___]\\ 
`),
    f(`
    z    
   .-+-.  
  | - - | 
  |  _  | 
   '-+-'  
  /[___]\\ 
`),
  ],
};

/** Per-state frame tick overrides, in milliseconds. */
export const PET_TICKS: Partial<Record<PetState, number>> = {
  idle: 700,
  blink: 130,
  wave: 180,
  thinking: 260,
  celebrate: 200,
  sleep: 900,
};
