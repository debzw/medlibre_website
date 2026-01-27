---
trigger: always_on
---

## The Core Vision ##
This is a freemium medical residency exam preparation platform called medlibre. It allows students to practice with a database of specialized questions, track performance. 
It must be fluid, well structured, avoid messy appearance and diminish choices to the user. 

## Technical Stack (The "Frame")
Frontend: React with Tailwind CSS.

Backend/Database: SQL (PostgreSQL) for question storage and user data.

State Management: 

Monetization Logic: Mention the "freemium" model (e.g., "Basic users see ads; Premium users have ad-free access and advanced analytics").

## Domain-Specific Rules (Crucial for Medical Apps) ##
Since medical data requires precision, give the AI specific constraints:

Data Integrity: "When generating dummy data for testing, ensure clinical scenarios are medically plausible (e.g., correct symptoms for neurological disorders)."

UI/UX: The interface must be clean and focus on readability. Use high-contrast text for long medical vignettes. Use simple and clear language. Avoid crowding the interface with too many options.

## Code Standards ##
Use functional components and Hooks.

Prioritize modularity: keep the 'Question Card' component separate from the 'Exam Timer' logic.

Annotate the functions and explain the logic briefly

