# DESIGN.md: MIABI Boutique Management App

## 1. Core Aesthetic

- **Theme:** Strictly Dark Mode by default.
- **Palette:** Monochromatic (Black, White, and shades of Gray).
- **Style:** Minimalistic, flat design. High contrast for readability.
- **Prohibited Elements:** NO gradients, NO drop shadows, NO rounded corners larger than `rounded-sm` (keep edges sharp), NO unnecessary borders. Use spacing and typography for separation.

## 2. Layout & Responsiveness

- **Philosophy:** Mobile-First. The UI must be optimized for tablet/phone usage at pop-up stalls before desktop scaling.
- **Navigation:** Use a bottom navigation bar or a simple, collapsable top hamburger menu for mobile. On desktop, this can expand to a minimal sidebar or top bar.
- **Density:** Keep touch targets large (minimum 44x44px for buttons) for the POS screen to prevent misclicks during busy events.

## 3. Tailwind CSS Strategy (Theming)

Configure `tailwind.config.ts` to enforce the strict monochromatic palette:

- **Backgrounds:**
- App Background: `bg-black` (`#000000`)
- Card/Container Background: `bg-zinc-950` or `bg-zinc-900`

- **Text:**
- Primary Text: `text-white`
- Muted Text: `text-zinc-400`

- **Accents:**
- Primary Action/Border: `border-white` or `bg-white text-black`
- Destructive/Alert (if absolutely necessary): Keep it grayscale (e.g., `text-zinc-300` with an icon) or a very muted, dark red strictly for destructive actions (e.g., deleting an order).

## 4. UI Component Guidelines

Use small local React components and native controls with Tailwind classes. The app should remain dependency-light; add a component library only when the local primitives can no longer meet accessibility or interaction requirements.

- **Buttons:**
- Use `variant="outline"` (white border on black) or `variant="default"` (white background, black text) for primary actions.
- No rounded edges (override to `rounded-none` or `rounded-sm`).

- **Cards:**
- Use for the POS product grid items and Dashboard metric containers.
- Remove shadows. Use a subtle `border-zinc-800` outline on a `bg-black` or `bg-zinc-950` background.

- **Tables:**
- Use for the Inventory List and Recent Orders on the dashboard.
- Keep styling flat. Minimal borders between rows (`border-zinc-800`).

- **Forms:**
- Use for adding/editing inventory.
- Flat design: Black background, white border on focus. No inner shadows.

- **Toggles / segmented controls:**
- CRITICAL: Use for switching between "Online" and "Pop-up Stall" during POS checkout.
- Style as a segmented control with sharp borders. Active state should be inverted (white bg, black text).

- **Badges:**
- Use to indicate Brand (Lolark/Mundhanai) or Low Stock status.
- Use `variant="outline"` or simple grayscale backgrounds.

## 5. Screen-by-Screen Visual Guide

### A. Point of Sale (/pos) - The "Cash Register"

- **Top / Side:** A prominent cart total and quantity controls. On desktop, keep the cart panel sticky beside the catalog.
- **Catalog:** 2-column (mobile), 3-column (tablet), or 4-column (wide desktop) product grid. Each product shows name, price, brand, category, and remaining stock.
- **Checkout controls:**

1. The "Online / Pop-up" `ToggleGroup` (spanning full width).
2. A large, full-width "Checkout" `Button` (White background, Black text, bold).

### B. Dashboard (/)

- **Top:** Four large number callouts (Total Revenue, Total Orders, Lolark Revenue, Mundhanai Revenue) using large, stark typography (e.g., `text-4xl font-bold tracking-tighter`).
- **Middle:** Compact Online and Pop-up Stall revenue splits.
- **Bottom:** A simple `Table` of recent transactions.

### C. Inventory (/inventory)

- A straightforward `Table` component.
- "Add Product" `Button` at the top right.
- Use standard text inputs with sharp borders for quick editing.
