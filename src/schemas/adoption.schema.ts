import { Schema, text, optional, email } from "./validation.js";
 
export const adoptionSchema: Schema = {
  adopterName: text(1, 50),
  adopterEmail: email(),
  message: optional(text(0, 500)),
};
