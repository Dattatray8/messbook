# MessBook

Digital mess management and billing for Indian mess owners: customers, menu, daily meals, bills and payments in one mobile app.

- `mobile/` — Expo + React Native + TypeScript, Expo Router, NativeWind, Better Auth (Expo client)
- `server/` — NestJS, MongoDB Atlas via Mongoose, Better Auth, class-validator

The app only talks to the server over REST. It never touches MongoDB.

## 1. Run the server

```bash
cd server
cp .env.example .env      # then fill in MONGODB_URI and BETTER_AUTH_SECRET
npm install
npm run start:dev         # http://localhost:3000  (API under /api, auth under /api/auth)
npm test                  # billing unit tests
```

Health check: `GET /api/health`.

## 2. Run the mobile app

```bash
cd mobile
cp .env.example .env      # set EXPO_PUBLIC_API_URL
npm install
npx expo start
```

`EXPO_PUBLIC_API_URL` must be reachable **from the phone**:

| Where the app runs | URL |
| --- | --- |
| Physical phone (same Wi-Fi) | `http://<your-computer-LAN-IP>:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator | `http://localhost:3000` |

Set `BETTER_AUTH_URL` in `server/.env` to the same address.

## Billing rules (server/src/bills)

| Customer type | Bill contains |
| --- | --- |
| Pay per meal | All **unbilled** meals in the range, grouped by item and price |
| Weekly (Mon–Sun, IST) | Plan amount + any EXTRA-category items |
| Monthly (calendar month, IST) | Plan amount + any EXTRA-category items |

- Meal records store the item name and price at the moment they are recorded, so changing menu prices never changes old bills.
- When a bill is generated every included meal gets that bill's id. Billed meals are excluded from future bills and cannot be deleted, so nothing is charged twice.
- A weekly or monthly bill can only be generated once per period.
- Prices are always read from the menu on the server; the client cannot send a price.

## API summary

| Method | Path | Purpose |
| --- | --- | --- |
| POST / PATCH / GET | `/api/mess`, `/api/mess/me` | Onboarding, edit, fetch |
| GET / POST | `/api/customers` (`?search=&active=`) | List, search, add |
| GET / PATCH | `/api/customers/:id` | Details (meals, bills, balances), edit |
| GET / POST / PATCH | `/api/menu-items` | Menu management |
| GET / POST / DELETE | `/api/meal-records` | Record meals (`?date=&customerId=`) |
| POST | `/api/bills/generate` | Generate bill (`preview: true` to preview) |
| GET | `/api/bills`, `/api/bills/:id` | History and details |
| PATCH | `/api/bills/:id/pay`, `/unpay` | Payment status |
| GET | `/api/dashboard` | Daily overview and pending payments |

## Not included (by design)

WhatsApp or automated bill sending, reminders, admin app, AI features.
