# ITC Match

Build a clean, professional single-page web app called "TaxSure-AI" for Indian businesses to reconcile purchase invoices against GSTR-2B.

Layout:

1. Header with app name and a one-line tagline: "Find the input tax credit you're about to lose."

2. Two upload areas side by side: "Purchase invoices" (multiple images or PDFs, max 10 files, 5 MB each) and "GSTR-2B file" (CSV). Add a "Load demo data" button that fills both with sample data.

3. A primary "Reconcile" button with a loading state that shows the current step: Extracting, Validating, Matching, Classifying.

4. Results section:

   - Three summary cards: "ITC at risk (₹)", "Invoices checked", "Issues found".

   - A table with one row per invoice: supplier, invoice number, date, taxable value, tax, status badge (Clean = green, Fixable = amber, ITC at risk = red, Needs review = grey), and a confidence percentage.

   - Clicking a row opens a side panel listing each failed check with a short explanation, plus a ready-to-copy supplier follow-up message.

5. A small "Performance" strip showing seconds per invoice, and a note: "Files are processed in memory and not stored."

Use mock data in a local JSON for now. Do not call any API yet. Make it responsive, use a calm blue and white palette with rounded cards, and keep the code in simple, readable components.
Accessibility requirements: use semantic HTML, label every input, make all controls keyboard-operable with visible focus rings, never convey status by colour alone (include text and an icon in each status badge), meet WCAG 2.1 AA contrast, announce loading and result updates with aria-live, use a real table with header scope attributes, and respect prefers-reduced-motion.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/90a1ce2f-75a3-46d1-b42f-e377599d39ee).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
