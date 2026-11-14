# Add features, screens and API calls

`pnpm gen` writes the code for a new feature, screen or API call, already following the project's rules
(folders, imports, translations, accessibility, tests) and wired into the app. You start from something that
runs and passes `pnpm check`, then fill in what's specific to your app.

There are three commands:

| You want to | Run |
| --- | --- |
| Add a section of the app that lists things (orders, messages, products) | `pnpm gen feature orders` |
| Add a screen to a feature (a detail view, a form) | `pnpm gen screen orders order-detail` |
| Call another API endpoint | `pnpm gen endpoint orders cancel-order --method post --path /orders/:id/cancel` |

Names are kebab-case: `orders`, `order-history`. Run the commands from the project root. Each one prints the
files it changed and what to do next.

## Add a feature

```bash
pnpm gen feature orders
```

Reload the app (press **r** in Metro) and open the new screen with its deep link, for example on Android:

```bash
adb shell am start -W -a android.intent.action.VIEW -d "acme-shop-dev://orders"
```

Use your own scheme in place of `acme-shop-dev` (it's `APP_SCHEME` in `.env.dev`). On iOS:
`xcrun simctl openurl booted "acme-shop-dev://orders"`.

You get a list of five sample orders, with a loading state, an empty state, an error state with **Try again**,
and pull to refresh. The sample data comes from the mock backend, so it works before your API exists.

What it adds:

| Where | What |
| --- | --- |
| `src/features/orders/schema.ts` | The shape the server sends and the `Order` type the app uses |
| `src/features/orders/api.ts` | The `GET /orders` request (`ordersQueryOptions`) |
| `src/features/orders/screens/OrdersScreen.tsx` | The list screen, and a test next to it |
| `src/features/orders/index.ts` | What the rest of the app may import from the feature |
| `src/mocks/orders.ts` | Five sample orders and a fake `GET /orders` |
| `en.json`, `hi.json` | The screen title and the empty and error messages |
| `RootNavigator.tsx` | An `Orders` screen with the deep link `orders` |

The item name comes from the feature name without its last "s" (`orders` → `Order`). When that's wrong,
name it yourself:

```bash
pnpm gen feature people --item person
```

### Then make it yours

1. **Fields.** The sample has `id`, `title` and `created_at`. Change them in `schema.ts` (both the server
   shape and the app type) and in `src/mocks/orders.ts`. Only `schema.ts` uses the server's field names;
   the rest of the app uses the app type.
2. **Hindi.** The new keys in `hi.json` (and any other non-English locale file) are in English. Translate
   them.
3. **A way in.** Nothing links to the screen yet. Add a button, a Settings row or a tab that calls
   `navigation.navigate('Orders')`. For a tab, move the `Orders` entry into `Tabs` in `RootNavigator.tsx`.
4. Run `pnpm check`.

## Add a screen

```bash
pnpm gen screen orders order-detail --param id
```

The feature must exist first. This adds `OrderDetailScreen` (and a test) to `src/features/orders/screens/`, a
translated title, and an `OrderDetail` screen in the navigator with the deep link `orders/order-detail/:id`.
Open it from code with:

```ts
navigation.navigate('OrderDetail', { id: order.id });
```

`--param` is optional; leave it out for a screen without one. The screen checks the param when it opens,
because a deep link can send anything, and shows an error state when it's missing.

The screen starts as a title on a page. Build it with the components in `src/shared/ui/primitives/`, and put
all text in `en.json` and `hi.json`.

## Call an API endpoint

To read data (GET):

```bash
pnpm gen endpoint orders order-detail --path /orders/:id
```

To change data (POST, PUT, PATCH or DELETE):

```bash
pnpm gen endpoint orders cancel-order --method post --path /orders/:id/cancel
```

Each `:param` in the path becomes an argument. `--path` defaults to `/<feature>`, and `--method` to `get`.

For a GET you get `orderDetailQueryOptions(id)`, which you use in a screen with
`useQuery(orderDetailQueryOptions(id))`. For a change you get a hook, `useCancelOrder()`, which reloads the
feature's data when it succeeds:

```ts
const cancel = useCancelOrder();
cancel.mutate({ id: order.id });
```

Both come with the response shape in `schema.ts`, a fake handler in `src/mocks/orders.ts` and a test.

### Then make it yours

1. **Response fields.** The sample response is just `{ id }`. Add the real fields in `schema.ts` and the
   mock.
2. **Request body.** Replace `body?: Record<string, unknown>` with the fields you send.
3. **Offline behaviour.** A generated change fails straight away when the phone is offline. That's right for
   payments and sign-in. For likes, edits and other small changes, switch it to a queued write that applies
   at once and syncs later: see the offline patterns in [AGENTS.md](../AGENTS.md#offline) and the example in
   [architecture.md](architecture.md#writing-data).
4. Run `pnpm check`.

## With an AI agent

Ask for the outcome, for example "add an orders feature with a cancel button". Claude Code uses the project's
`add-feature`, `add-screen` and `add-endpoint` skills: it runs these commands, then does the "make it yours"
steps. Cursor and Copilot are pointed at the same instructions. Check its work with `pnpm check` and by
opening the screen.

## When a command stops

The generator checks before writing, so when it stops, nothing has changed.

| Message | What to do |
| --- | --- |
| `"Orders" isn't kebab-case` | Use lowercase words joined by hyphens: `orders`, `order-history` |
| `src/features/orders already exists.` | Pick another name, or use `pnpm gen screen` / `pnpm gen endpoint` to add to it |
| `src/features/orders doesn't exist.` | Create the feature first: `pnpm gen feature orders` |
| `The navigator already has a "OrderDetail" route.` | Route names are shared across the app. Pick another screen name |
| `… schema.ts already has OrderSchema. Pick another endpoint name.` | The feature already uses that name, usually for its list item. A GET for one order in `orders` is `order-detail` |
| `… has no "// gen:screens" line` (or `// gen:handlers`) | Someone removed a marker comment. Put `// gen:screens` back at the end of the signed-in screens in `RootNavigator.tsx`, or `// gen:handlers` at the end of the list in `src/mocks/handlers.ts` |
| `already has "orders.title"` | That translation key exists. Remove the old key or pick another name |

## What it doesn't do

- It never replaces or deletes a file; it creates new ones and adds to existing ones. To undo a run,
  discard the changes with git.
- It doesn't add a tab, a button or a menu entry that leads to the new screen. You choose where it goes.
- It doesn't translate. Strings in the other languages start as English copies.
- It doesn't know your API. Fields, request bodies and error cases come from you; the generated mock is a
  starting point to change to match your server.

## Keeping the generators working

`scripts/ci/check-generators.sh` runs `feature`, `screen` and `endpoint` on a scratch copy of the repository
and then the full checks, so the generated code keeps up with the project's rules. Run it after changing
`scripts/generate.ts` or a rule the generated code has to follow.
