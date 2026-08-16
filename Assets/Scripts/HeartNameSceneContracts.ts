/** Stable authored names and spatial intent for the P.S. heart welcome experience. */
export const HEART_NAME_SCENE = {
  root: "Heart Name Experience",
  heart: "Glowing Heart",
  tapPrompt: "Tap Heart Prompt",
  welcomeNote: "Welcome Note",
  placement: "P.S. Heart Placement Controller",
} as const

/** Fixed states for the two-person hackathon handoff demo. */
export enum HeartNameSessionState {
  PERSON_A_CREATE = "PERSON_A_CREATE",
  PERSON_B_REPLY = "PERSON_B_REPLY",
  PERSON_A_FINAL_READ = "PERSON_A_FINAL_READ",
}
