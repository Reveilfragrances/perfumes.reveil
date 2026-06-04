# RÉVEIL FRAGRANCE — COMPLETE PRODUCTION SYSTEM AUDIT, DEBUGGING & REPAIR SPECIFICATION
## Version 3.0 — Full Root Cause Analysis + Detailed Solutions Reference

---

## ROLE DEFINITION

You are acting simultaneously as:

- **Principal Full Stack Engineer** — Next.js 14+ App Router, TypeScript, Server Components, API Routes, Server Actions
- **Production Architect** — Database schema design, query optimization, relational integrity (Prisma / Drizzle)
- **Ecommerce Systems Specialist** — Payment gateways, shipping APIs, full order lifecycle management
- **SEO & Structured Data Engineer** — Schema.org JSON-LD, Google Merchant Listings, Open Graph, Google Search Console integration, sitemap automation

---

## PRIME DIRECTIVE

**This application already works. Do not rebuild it.**

Your task is to:

1. **Read existing implementation first** before touching any file
2. **Trace every broken flow** end-to-end from UI → API → DB → Third Party
3. **Identify root causes** with precision — know exactly why each bug exists
4. **Repair only broken logic** — do not rewrite working code
5. **Fix missing connections**, field mismatches, and integration gaps
6. **Verify all third-party integrations** (Razorpay, Shiprocket, Resend)
7. **Fix all SEO issues** without touching visual UI
8. **Ensure production stability** after every fix

---

## ABSOLUTE RULES — MANDATORY BEFORE CODING

### STRICTLY FORBIDDEN:
- Redesigning or altering any UI layout or visual appearance
- Changing colors, fonts, spacing, or component styling
- Rewriting components that are functioning correctly
- Renaming routes, files, or functions unless broken
- Removing existing functionality
- Refactoring unrelated modules
- Adding unnecessary dependencies

### PERMITTED:
- Fixing broken logic and incorrect data flow
- Fixing wrong API connections and endpoint mismatches
- Fixing missing or incorrect database field mappings
- Fixing validation errors at frontend and backend layers
- Fixing third-party integration issues
- Fixing SEO metadata, JSON-LD, Open Graph, sitemap
- Fixing build, lint, TypeScript, and runtime errors

**Always match existing code style — indentation, naming conventions, and file structure of surrounding code.**

---

## PRE-WORK: ARCHITECTURE MAP (Read Before Touching Anything)

Before fixing any issue, map the complete project structure:

```
app/
├── (auth)/
│   └── login/, register/, profile/
├── (shop)/
│   ├── products/[slug]/      ← Product detail page
│   ├── cart/
│   ├── checkout/
│   └── orders/[orderId]/
├── admin/
│   ├── orders/               ← Admin order list + detail
│   ├── users/                ← Admin user registry
│   ├── products/             ← Admin product management
│   └── reviews/              ← Admin review moderation
├── api/
│   ├── orders/               ← Order CRUD
│   ├── checkout/             ← Checkout logic
│   ├── addresses/            ← Address management
│   ├── razorpay/             ← Payment order + verify
│   ├── shiprocket/           ← Shipment creation
│   ├── resend/               ← Email sending
│   ├── admin/orders/[id]/
│   │   ├── confirm/          ← Admin confirm endpoint
│   │   └── cancel/           ← Admin cancel endpoint
│   └── webhooks/
│       ├── razorpay/         ← Payment webhook
│       └── shiprocket/       ← Shipment status webhook
├── lib/
│   ├── db.ts                 ← Prisma client
│   ├── razorpay.ts
│   ├── shiprocket.ts
│   ├── resend.ts
│   ├── invoice.ts
│   └── seo.ts                ← Schema generators
└── components/
```

**Identify and document before starting:**
- Auth provider (NextAuth / Clerk / custom JWT)
- ORM in use (Prisma schema path / Drizzle schema path)
- State management (Zustand / Context / Redux / none)
- Image storage provider (Vercel Blob / Cloudinary / S3 / Uploadthing)
- Storage location for invoices (same as above)
- Deployment platform (Vercel / Railway / other)

---

# ISSUE 1 — CUSTOMER DETAILS SHOWING AS "GUEST" IN ADMIN

## Symptom

Admin pages (`/admin/orders` and `/admin/orders/[orderId]`) always display:

```
Customer: Guest
```

Even for orders placed by fully registered, logged-in users who have a complete profile (name, email, phone, order history) in the User Registry.

## Complete Flow to Trace

```
User is logged in via Auth Provider (session exists)
             ↓
Checkout page loads → reads session? → extracts userId?
             ↓
Checkout form submitted → payload includes userId?
             ↓
POST /api/orders → destructures and saves userId?
             ↓
Database Order record → userId foreign key = value or NULL?
             ↓
GET /api/admin/orders → JOIN users table in query?
             ↓
Admin page → reads order.user.name or falls back to "Guest"?
```

## All Possible Root Causes (Check Every One)

1. `userId` is never extracted from the auth session in the checkout API handler
2. Order creation payload is assembled without `userId` or `customerId`
3. `Order` database model lacks a `userId` foreign key, or it is defined as optional and defaults to null
4. The checkout code uses a generic "guest order" path even for authenticated users due to missing session guard
5. Admin orders query uses `db.order.findMany()` without `include: { user: true }` — joins are missing
6. Admin frontend component has hardcoded `"Guest"` fallback without checking `order.user` first
7. Order snapshot fields (`customerName`, `customerEmail`, `customerPhone`) are never written even when user is authenticated

## Exact Fix

### Checkout API — Always Save User Identity

```typescript
// /api/orders/route.ts  OR  server action equivalent

import { getServerSession } from 'next-auth';  // adjust for your auth provider
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const body = await request.json();

  // Extract user identity: authenticated user takes priority over form input
  const userId      = session?.user?.id   ?? null;
  const customerName  = session?.user?.name  ?? body.guestName  ?? null;
  const customerEmail = session?.user?.email ?? body.email      ?? null;
  const customerPhone = session?.user?.phone ?? body.phone      ?? null;

  const order = await db.order.create({
    data: {
      ...orderData,
      userId,           // FK to User table — null for genuine guests
      customerName,     // Snapshot — preserved even if user deletes account
      customerEmail,
      customerPhone,
      status: 'PENDING_APPROVAL',
    },
  });
}
```

### Admin Orders Query — Add User Join

```typescript
// /api/admin/orders/route.ts

const orders = await db.order.findMany({
  include: {
    user: {
      select: {
        id:    true,
        name:  true,
        email: true,
        phone: true,
      },
    },
    items:   { include: { product: true } },
    address: true,
  },
  orderBy: { createdAt: 'desc' },
});
```

### Admin Frontend — Display With Fallback Chain

```tsx
// /admin/orders/[orderId]/page.tsx — customer section

const displayName  = order.user?.name  ?? order.customerName  ?? 'Guest';
const displayEmail = order.user?.email ?? order.customerEmail ?? '—';
const displayPhone = order.user?.phone ?? order.customerPhone ?? '—';

<div className="customer-details">
  <p>Customer: {displayName}</p>
  <p>Email:    {displayEmail}</p>
  <p>Phone:    {displayPhone}</p>
  {order.userId && (
    <a href={`/admin/users/${order.userId}`}>View Profile →</a>
  )}
</div>
```

**Rule:** "Guest" appears ONLY when `order.userId` is null AND all snapshot fields are also null.

---

# ISSUE 2 — SHIPPING ADDRESS DATA LOSS

## Symptom

Across the entire system (admin panel, Shiprocket shipment, invoice, emails), orders only display:

```
City: Mumbai  |  State: Maharashtra  |  Pincode: 400001
```

All other address fields (house number, street, area, landmark, district, country) are missing everywhere.

## Complete Flow to Trace

```
Address Form UI (all fields visible to user?)
             ↓
Form submit → all field values in POST body?
             ↓
POST /api/addresses → destructures all fields?
             ↓
Database Address table → all columns exist in schema?
             ↓
Order creation → full address snapshotted into order?
             ↓
Admin order detail → renders all address fields?
             ↓
Shiprocket payload builder → uses all fields?
             ↓
Invoice generator → includes full address?
             ↓
Email templates → renders full address block?
```

## All Possible Root Causes

1. Address form HTML inputs are missing `name` attributes for most fields, so they never reach the server
2. API handler destructures only `{ city, state, pincode }` and silently drops remaining fields
3. `Address` database model only has columns for `city`, `state`, `pincode` — all other fields are absent from schema
4. Order creation snapshots only partial address instead of spreading the complete address object
5. Shiprocket payload builder only reads `order.address.city`, `state`, `pincode`
6. Admin display component only renders three fields
7. Invoice template has hardcoded partial address format

## Required Complete Address Schema

```prisma
// schema.prisma

model Address {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])

  // Recipient
  recipientName String
  phone         String

  // Full address breakdown
  houseNumber   String           // e.g. "42", "Shop No. 3"
  buildingName  String?          // e.g. "Sunrise Apartments"
  streetLine1   String           // Primary street
  streetLine2   String?          // Secondary street (optional)
  area          String           // Colony / Locality / Area
  landmark      String?          // Near landmark (optional)

  // Geographic
  city          String
  district      String
  state         String
  country       String   @default("India")
  pincode       String           // 6-digit

  isDefault     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  orders        Order[]
}
```

## Shiprocket Full Address Payload

```typescript
// lib/shiprocket.ts — buildShiprocketPayload()

const addressLine1 = [
  order.address.houseNumber,
  order.address.buildingName,
  order.address.streetLine1,
].filter(Boolean).join(', ');

const addressLine2 = [
  order.address.area,
  order.address.landmark,
].filter(Boolean).join(', ');

const payload = {
  order_id:               order.id,
  order_date:             formatDate(order.createdAt),
  pickup_location:        'Primary',
  billing_customer_name:  order.customerName,
  billing_address:        addressLine1,
  billing_address_2:      addressLine2,
  billing_city:           order.address.city,
  billing_state:          order.address.state,
  billing_country:        order.address.country,
  billing_pincode:        order.address.pincode,
  billing_email:          order.customerEmail,
  billing_phone:          order.customerPhone,
  shipping_is_billing:    true,
  // ... rest of payload
};
```

**Fix all these locations:**
- `app/api/addresses/route.ts` — accept and save all fields
- `app/api/orders/route.ts` — snapshot full address on order creation
- `lib/shiprocket.ts` — build complete Shiprocket payload
- `app/admin/orders/[orderId]/page.tsx` — display full address
- All three email templates — render complete address block
- Invoice generator — include full billing + shipping address

---

# ISSUE 3 — ADDRESS PAGE DOES NOT RETURN TO CHECKOUT

## Symptom

```
Checkout page
     ↓  (user clicks "Add New Address")
/addresses/new page
     ↓  (user fills form, clicks Save)
Address saved ✓
     ↓
User stranded on /addresses page  ← WRONG
User must manually navigate back  ← WRONG
Cart / Buy Now state may be lost  ← WRONG
```

## Root Cause

The address creation page does not know it was launched from checkout context. After saving, it redirects to a default route. No context or `returnTo` parameter is passed through the navigation chain.

## Complete Fix

### Step 1 — Checkout passes context via query param

```typescript
// /checkout/page.tsx

const handleAddAddress = () => {
  const params = new URLSearchParams({ returnTo: 'checkout' });

  // For Buy Now flow, preserve product and quantity
  if (buyNowProductId) {
    params.set('buyNow', buyNowProductId);
    params.set('qty', String(quantity));
  }

  router.push(`/addresses/new?${params.toString()}`);
};
```

### Step 2 — Address form reads and stores context

```typescript
// /addresses/new/page.tsx

const searchParams = useSearchParams();
const returnTo   = searchParams.get('returnTo');  // 'checkout' or null
const buyNow     = searchParams.get('buyNow');    // productId or null
const qty        = searchParams.get('qty');       // quantity or null
```

### Step 3 — After save, redirect back to checkout

```typescript
// /addresses/new/page.tsx — handleSubmit

const handleSubmit = async (formData: AddressFormData) => {
  const savedAddress = await saveAddress(formData);

  if (returnTo === 'checkout') {
    const checkoutParams = new URLSearchParams();
    if (buyNow) checkoutParams.set('buyNow', buyNow);
    if (qty)    checkoutParams.set('qty', qty);
    // Pass the new address ID so checkout auto-selects it
    checkoutParams.set('newAddressId', savedAddress.id);

    router.push(`/checkout?${checkoutParams.toString()}`);
  } else {
    router.push('/profile/addresses'); // default behavior unchanged
  }
};
```

### Step 4 — Checkout auto-selects new address on return

```typescript
// /checkout/page.tsx

const searchParams = useSearchParams();
const newAddressId = searchParams.get('newAddressId');

useEffect(() => {
  if (newAddressId) {
    setSelectedAddressId(newAddressId); // Auto-select the just-created address
  }
}, [newAddressId]);
```

| State | How It Is Preserved |
|---|---|
| Cart items | Persisted in DB or localStorage — survives navigation |
| Buy Now product | Passed as `buyNow` URL param through redirect chain |
| Quantity | Passed as `qty` URL param through redirect chain |
| New address | Returned as `newAddressId` on redirect back, auto-selected |

---

# ISSUE 4 — "VIEW ORDERS" IN USER REGISTRY SHOWS ALL ORDERS

## Symptom

In `/admin/users`, each user row has a "View Orders" button. Clicking it for User A opens `/admin/orders` but shows ALL orders for ALL users instead of only User A's orders.

## Complete Flow to Trace

```
/admin/users page → "View Orders" button for User A
             ↓
onClick navigates to → /admin/orders  (missing userId param?)
             ↓
/admin/orders page → reads searchParams.userId?
             ↓
Fetch call → includes userId filter in query string?
             ↓
/api/admin/orders → reads userId from query params?
             ↓
DB query → WHERE userId = 'X' applied?
             ↓
Response → only User A's orders returned?
```

## All Possible Root Causes

1. `onClick` navigates to `/admin/orders` without `?userId=X`
2. `/admin/orders` page never reads `searchParams.get('userId')`
3. Fetch call to orders API does not pass userId as query param
4. API handler ignores `userId` from query params
5. Prisma `where` clause does not conditionally filter by `userId`

## Complete Fix

### Admin Users Page — Fix Navigation

```tsx
// /admin/users/page.tsx

<Button
  onClick={() => router.push(`/admin/orders?userId=${user.id}`)}
>
  View Orders
</Button>
```

### Admin Orders Page — Read and Apply Filter

```typescript
// /admin/orders/page.tsx

// For Next.js 14 App Router server component:
type Props = { searchParams: { userId?: string } };

export default async function AdminOrdersPage({ searchParams }: Props) {
  const userId = searchParams.userId ?? null;

  const orders = await fetch(
    `/api/admin/orders${userId ? `?userId=${userId}` : ''}`,
    { cache: 'no-store' }
  ).then(r => r.json());

  return (
    <>
      {userId && (
        <div className="filter-banner">
          {/* Use existing banner/chip styling */}
          Filtered by User: {userId}
          <a href="/admin/orders">Clear Filter</a>
        </div>
      )}
      {/* existing orders table — unchanged */}
    </>
  );
}
```

### Admin Orders API — Apply Conditional DB Filter

```typescript
// /api/admin/orders/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  const where = userId ? { userId } : {};  // No filter = all orders

  const orders = await db.order.findMany({
    where,
    include: { user: true, items: { include: { product: true } }, address: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}
```

**Do NOT break the normal orders page** — when no `userId` param is present, all orders must still be returned.

---

# ISSUE 5 — EMAIL NOT REQUIRED BEFORE ORDER PLACEMENT

## Symptom

Orders can be placed successfully without providing an email address. This breaks order confirmation delivery, invoice sending, and the complete notification pipeline.

## Validation Required at Every Layer

### Layer 1 — Checkout UI

```tsx
<input
  type="email"
  name="email"
  required
  placeholder="your@email.com"
  aria-describedby="email-hint"
/>
<p id="email-hint">Required — your order confirmation will be sent here</p>
{errors.email && <span className="field-error">{errors.email}</span>}
```

### Layer 2 — Client-Side Validation

```typescript
const validateEmail = (email: string): string | null => {
  if (!email || !email.trim()) {
    return 'Email address is required to receive your order confirmation';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Please enter a valid email address';
  }
  return null;
};
```

### Layer 3 — API Server Validation (Block at Source)

```typescript
// /api/orders/route.ts

const body = await request.json();

if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
  return NextResponse.json(
    { error: 'Email address is required' },
    { status: 400 }
  );
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(body.email.trim())) {
  return NextResponse.json(
    { error: 'Invalid email address format' },
    { status: 400 }
  );
}
```

### Layer 4 — Database Schema (Make Non-Nullable)

```prisma
model Order {
  customerEmail  String   // Remove the "?" — must NOT be nullable
}
```

**Run migration after schema change:**
```bash
npx prisma migrate dev --name make_customer_email_required
```

**Email must propagate to ALL destinations:**
- `Order.customerEmail` field (DB)
- `User.email` if user is authenticated (sync if changed)
- Invoice generation (billing info)
- Shiprocket payload (`billing_email`)
- All three Resend email triggers

---

# ISSUE 6 — ORDER APPROVAL WORKFLOW COMPLETELY WRONG

## Current Broken Flow

```
Customer places order
       ↓
Status: AUTO-APPROVED  ← MUST BE REMOVED
       ↓
Shiprocket shipment created immediately  ← MUST BE REMOVED
```

## Required Correct Flow

```
Customer places order (payment captured via Razorpay or COD)
             ↓
  Order Status: PENDING_APPROVAL
  Payment Status: CAPTURED (or PENDING for COD)
  → Email 1 sent: "Order Received — Under Review"
             ↓
        Admin reviews in /admin/orders
             ↓
    ┌────────────────────────────────┐
    │                                │
Admin clicks "Confirm"         Admin clicks "Cancel"
    │                                │
    ↓                                ↓
Status: APPROVED               Status: CANCELLED
    ↓                                ↓
Create Shiprocket shipment     Email 3 sent: "Order Cancelled"
    ↓                          Refund initiated (if payment captured)
Generate AWB + tracking URL
    ↓
Generate invoice PDF
    ↓
Email 2 sent: "Order Confirmed + Tracking"
```

## Database — Order Status Enum

```prisma
enum OrderStatus {
  PENDING_APPROVAL   // Default on creation
  APPROVED           // Admin confirmed
  CANCELLED          // Admin cancelled
  SHIPPED            // Shiprocket webhook update
  DELIVERED          // Shiprocket webhook update
  REFUNDED           // After refund processed
}

model Order {
  status  OrderStatus @default(PENDING_APPROVAL)
}
```

## Order Creation API — Remove All Auto-Approval Logic

```typescript
// /api/orders/route.ts — find and DELETE any of these patterns:
// await createShiprocketShipment(...)   ← DELETE
// status: 'APPROVED'                    ← CHANGE TO 'PENDING_APPROVAL'
// status: OrderStatus.APPROVED          ← CHANGE TO PENDING_APPROVAL

const order = await db.order.create({
  data: {
    ...orderData,
    status: 'PENDING_APPROVAL',   // Always — no exceptions
    // Shiprocket is NEVER called here
  },
});

// Only "Order Received" email — not confirmation
await sendOrderReceivedEmail(order);

return NextResponse.json({ success: true, orderId: order.id });
```

## Admin Confirm Endpoint

```typescript
// /api/admin/orders/[orderId]/confirm/route.ts

export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  const { orderId } = params;

  // Guard: prevent double-confirmation
  const existing = await db.order.findUnique({ where: { id: orderId } });
  if (!existing || existing.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Order cannot be confirmed' }, { status: 400 });
  }
  if (existing.shiprocketOrderId) {
    return NextResponse.json({ error: 'Shipment already created' }, { status: 409 });
  }

  // Step 1 — Update status
  const order = await db.order.update({
    where: { id: orderId },
    data: { status: 'APPROVED' },
    include: { user: true, items: { include: { product: true } }, address: true },
  });

  // Step 2 — Create Shiprocket shipment (ONLY here, NEVER elsewhere)
  const shipment = await createShiprocketShipment(order);

  // Step 3 — Save shipment details back to order
  await db.order.update({
    where: { id: orderId },
    data: {
      awbNumber:         shipment.awb_code,
      trackingUrl:       `https://shiprocket.co/tracking/${shipment.awb_code}`,
      courierName:       shipment.courier_name,
      shiprocketOrderId: String(shipment.order_id),
      estimatedDelivery: shipment.expected_delivery_date ?? null,
    },
  });

  // Step 4 — Generate invoice
  const invoiceUrl = await generateInvoice(order);
  await db.order.update({ where: { id: orderId }, data: { invoiceUrl } });

  // Step 5 — Send confirmation email with tracking
  await sendOrderConfirmedEmail({ ...order, shipment, invoiceUrl });

  return NextResponse.json({ success: true });
}
```

## Admin Cancel Endpoint

```typescript
// /api/admin/orders/[orderId]/cancel/route.ts

export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  const { orderId } = params;

  const order = await db.order.update({
    where: { id: orderId },
    data: { status: 'CANCELLED' },
    include: { user: true },
  });

  // Send cancellation email
  await sendOrderCancelledEmail(order);

  // Initiate refund if payment was already captured
  if (order.paymentStatus === 'CAPTURED' && order.razorpayPaymentId) {
    await initiateRazorpayRefund(order.razorpayPaymentId, order.grandTotal);
    await db.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'REFUND_INITIATED' },
    });
  }

  return NextResponse.json({ success: true });
}
```

**MANDATORY SEARCH:** Run a global codebase search for `createShiprocketShipment`, `shiprocket`, and `APPROVED` — confirm the shipment creation call exists ONLY inside `/api/admin/orders/[orderId]/confirm/route.ts` and nowhere else.

---

# ISSUE 7 — ADMIN CONFIRM BUTTON TEXT OVERFLOW

## Symptom

The confirm order button displays the text "Review and Confirm Order" which causes layout overflow and overlaps with adjacent UI elements.

## Fix — Text Only, Nothing Else

```tsx
// BEFORE:
<Button onClick={handleConfirm} className={existingClasses}>
  Review and Confirm Order
</Button>

// AFTER:
<Button onClick={handleConfirm} className={existingClasses}>
  Confirm
</Button>
```

**Do NOT change:**
- The Button component itself
- The `onClick` / `handleConfirm` handler
- Any CSS classes on the button
- Any surrounding layout
- Any other button on the page

If a spacing issue persists, fix ONLY the specific margin or padding property causing the overlap.

---

# ISSUE 8 — SHIPROCKET INTEGRATION COMPLETE AUDIT

## Required Environment Variables

```env
SHIPROCKET_EMAIL=your@email.com
SHIPROCKET_PASSWORD=yourpassword
SHIPROCKET_CHANNEL_ID=your_channel_id
```

## Authentication — Token Caching with Refresh

```typescript
// lib/shiprocket.ts

interface TokenCache {
  token:     string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getShiprocketToken(): Promise<string> {
  const refreshBuffer = 30 * 60 * 1000; // Refresh 30 minutes before expiry

  if (tokenCache && Date.now() < tokenCache.expiresAt - refreshBuffer) {
    return tokenCache.token;
  }

  const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:    process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error('Shiprocket authentication failed');

  const data = await res.json();
  tokenCache = {
    token:     data.token,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24-hour expiry
  };

  return data.token;
}
```

## Shipment Creation — Complete Function

```typescript
export async function createShiprocketShipment(order: OrderWithDetails) {
  // Guard: never create duplicate shipments
  if (order.shiprocketOrderId) {
    throw new Error(`Shipment already exists for order ${order.id}`);
  }

  const token = await getShiprocketToken();

  const addressLine1 = [
    order.address.houseNumber,
    order.address.buildingName,
    order.address.streetLine1,
  ].filter(Boolean).join(', ');

  const addressLine2 = [
    order.address.area,
    order.address.landmark,
  ].filter(Boolean).join(', ');

  const payload = {
    order_id:              order.id,
    order_date:            new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location:       'Primary',
    channel_id:            process.env.SHIPROCKET_CHANNEL_ID,
    billing_customer_name: order.customerName,
    billing_address:       addressLine1,
    billing_address_2:     addressLine2,
    billing_city:          order.address.city,
    billing_state:         order.address.state,
    billing_country:       order.address.country,
    billing_pincode:       order.address.pincode,
    billing_email:         order.customerEmail,
    billing_phone:         order.customerPhone,
    shipping_is_billing:   true,
    order_items:           order.items.map(item => ({
      name:          item.product.name,
      sku:           item.product.sku,
      units:         item.quantity,
      selling_price: item.price,
    })),
    payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
    sub_total:      order.subtotal,
    length: 10, breadth: 10, height: 10, weight: 0.5,
  };

  const res = await fetch(
    'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Shiprocket shipment creation failed: ${JSON.stringify(err)}`);
  }

  return res.json();
}
```

## Shiprocket Webhook — Status Sync

```typescript
// /api/webhooks/shiprocket/route.ts

export async function POST(request: Request) {
  const body = await request.json();

  const statusMap: Record<string, string> = {
    'Shipped':   'SHIPPED',
    'Delivered': 'DELIVERED',
    'Cancelled': 'CANCELLED',
  };

  const newStatus = statusMap[body.current_status];
  if (!newStatus || !body.awb_code) {
    return NextResponse.json({ received: true });
  }

  await db.order.updateMany({
    where: { awbNumber: body.awb_code },
    data:  { status: newStatus as OrderStatus },
  });

  return NextResponse.json({ received: true });
}
```

---

# ISSUE 9 — RAZORPAY INTEGRATION COMPLETE AUDIT

## Required Environment Variables

```env
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX
```

## Payment Webhook — Verification + Idempotency

```typescript
// /api/webhooks/razorpay/route.ts

import crypto from 'crypto';

export async function POST(request: Request) {
  const rawBody  = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';

  // Step 1 — Verify signature
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event   = JSON.parse(rawBody);
  const payment = event.payload?.payment?.entity;
  const orderId = payment?.notes?.orderId;

  if (!orderId) return NextResponse.json({ received: true });

  // Step 2 — Idempotency check
  const alreadyProcessed = await db.order.findFirst({
    where: { razorpayPaymentId: payment.id },
  });
  if (alreadyProcessed) return NextResponse.json({ received: true });

  if (event.event === 'payment.captured') {
    // Update payment status ONLY — order status stays PENDING_APPROVAL
    // Admin must manually confirm before shipment is created
    await db.order.update({
      where: { id: orderId },
      data: {
        paymentStatus:   'CAPTURED',
        razorpayPaymentId: payment.id,
        razorpayOrderId:   payment.order_id,
        // status remains 'PENDING_APPROVAL' — do NOT change it here
      },
    });
  }

  if (event.event === 'payment.failed') {
    await db.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED' },
    });
  }

  return NextResponse.json({ received: true });
}
```

**CRITICAL SEPARATION — This must always be true:**

```
Payment Status: CAPTURED  ≠  Order Status: APPROVED
These are completely independent states.
A paid order remains PENDING_APPROVAL until admin confirms it.
```

---

# ISSUE 10 — RESEND EMAIL SYSTEM COMPLETE FIX

## Required Environment Variables

```env
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXX
EMAIL_FROM=orders@revelifragrance.com
EMAIL_FROM_NAME=Réveil Fragrance
SUPPORT_EMAIL=support@revelifragrance.com
SUPPORT_PHONE=+91-XXXXXXXXXX
NEXT_PUBLIC_SITE_URL=https://revelifragrance.com
```

## Shared Email Variables Interface

```typescript
// lib/emails/types.ts

export interface EmailVariables {
  customerName:  string;
  customerEmail: string;
  phone:         string;

  orderId:       string;
  orderDate:     string;   // e.g. "3 June 2026"
  invoiceNumber: string;
  invoiceURL?:   string;

  products: Array<{
    name:     string;
    imageUrl: string;
    quantity: number;
    price:    number;
    size?:    string;
    volume?:  string;
  }>;

  subtotal:    number;
  discount:    number;
  tax:         number;
  shipping:    number;
  grandTotal:  number;

  paymentMethod: string;  // "Razorpay" | "COD"
  paymentStatus: string;  // "Paid" | "Pending"

  shippingAddress: string;  // Full formatted multi-line address
  billingAddress:  string;

  // Tracking — confirmation email only
  awbNumber?:        string;
  trackingURL?:      string;
  courierName?:      string;
  estimatedDelivery?: string;

  supportEmail: string;
  supportPhone: string;
}
```

## EMAIL 1 — ORDER RECEIVED (Trigger: Order Created)

```typescript
// lib/emails/order-received.ts

export async function sendOrderReceivedEmail(order: OrderWithDetails) {
  const vars = buildEmailVariables(order);

  const { error } = await resend.emails.send({
    from:    `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to:      order.customerEmail,
    subject: `We Have Received Your Réveil Order #${order.id}`,
    html:    renderOrderReceivedTemplate(vars),
  });

  if (error) {
    console.error('Failed to send order received email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}
```

**Template includes:**
- ✅ Order ID and date
- ✅ Status badge: "Under Review — We'll notify you once confirmed"
- ✅ Customer name and contact details
- ✅ Full product list with images, quantities, prices
- ✅ Complete shipping address (all fields)
- ✅ Pricing breakdown: subtotal, discount, tax, shipping, total
- ✅ Payment method and captured status
- ❌ NO tracking information (not yet created)
- ❌ NO invoice (not yet generated)

## EMAIL 2 — ORDER CONFIRMED (Trigger: Admin Confirm)

**Template includes:**
- ✅ Confirmation message with order ID
- ✅ Complete product list with images
- ✅ Invoice download link (PDF)
- ✅ Full shipping address
- ✅ AWB number (prominent, copyable)
- ✅ Tracking URL (large CTA button: "Track Your Order")
- ✅ Courier name
- ✅ Estimated delivery date

## EMAIL 3 — ORDER CANCELLED (Trigger: Admin Cancel)

**Template includes:**
- ✅ Message: *"Due to unforeseen circumstances we are unable to fulfill your order."*
- ✅ Original order ID and date
- ✅ Product summary
- ✅ Refund status:
  - If payment captured: "A refund of ₹{amount} has been initiated and will reach your account within 5–7 business days."
  - If COD / not captured: "No payment was charged for this order."
- ✅ Support email and phone

**CRITICAL: No duplicate emails.** Before sending any email, check if it has already been sent for this order. Add `emailSent` flags to the Order model if needed:

```prisma
model Order {
  receivedEmailSent:     Boolean @default(false)
  confirmedEmailSent:    Boolean @default(false)
  cancelledEmailSent:    Boolean @default(false)
}
```

---

# ISSUE 11 — INVOICE GENERATION SYSTEM

## Trigger: Admin Confirmation (Step 4 of Confirm Flow)

```typescript
// lib/invoice.ts

export async function generateInvoice(order: OrderWithDetails): Promise<string> {
  const year          = new Date().getFullYear();
  const invoiceNumber = `RVL-${year}-${order.id.slice(-5).toUpperCase()}`;

  const invoiceData: InvoiceData = {
    invoiceNumber,
    orderId:   order.id,
    date:      new Date(),
    customer: {
      name:  order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    billingAddress:  order.address,
    shippingAddress: order.address,
    items:           order.items,
    subtotal:        order.subtotal,
    discount:        order.discount ?? 0,
    taxRate:         0.18,  // 18% GST — update as required
    taxAmount:       order.tax,
    shippingCharge:  order.shippingCharge,
    grandTotal:      order.grandTotal,
    paymentMethod:   order.paymentMethod,
    company: {
      name:    'Réveil Fragrance',
      address: 'Your registered business address',
      gstin:   'YOUR_GSTIN_NUMBER',
      email:   process.env.SUPPORT_EMAIL!,
      phone:   process.env.SUPPORT_PHONE!,
    },
  };

  const pdfBuffer = await buildInvoicePDF(invoiceData);
  const url       = await uploadToStorage(pdfBuffer, `invoices/${invoiceNumber}.pdf`);

  // Save to DB
  await db.order.update({
    where: { id: order.id },
    data:  { invoiceUrl: url, invoiceNumber },
  });

  return url;
}
```

**Add to Order schema:**

```prisma
model Order {
  invoiceNumber  String?
  invoiceUrl     String?
}
```

---

# ISSUE 12 — GOOGLE SEARCH CONSOLE: MISSING `hasMerchantReturnPolicy`

## Current Warning in Google Search Console

```
⚠️ Improve item appearance
Missing field "hasMerchantReturnPolicy" (in "offers")
Items affected: 7
Validation: Not Started
```

## Root Cause

Product pages output `Product` + `Offer` JSON-LD structured data but the `offers` object does not include `hasMerchantReturnPolicy`. Google requires this field for merchant listing eligibility in Google Shopping.

## Fix — Add Return Policy to Every Product Page's JSON-LD

```typescript
// lib/seo.ts — generateProductSchema()

export function generateProductSchema(product: ProductWithReviews, siteUrl: string) {
  const approvedReviews = product.reviews.filter(r => r.status === 'APPROVED');
  const reviewCount     = approvedReviews.length;
  const averageRating   = reviewCount > 0
    ? approvedReviews.reduce((s, r) => s + r.rating, 0) / reviewCount
    : null;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type':    'Product',
    name:        product.name,
    description: product.description,
    sku:         product.sku,
    image:       product.images,  // Array of image URLs
    brand: {
      '@type': 'Brand',
      name:    'Réveil Fragrance',
    },
    offers: {
      '@type':         'Offer',
      url:             `${siteUrl}/products/${product.slug}`,
      priceCurrency:   'INR',
      price:           product.price,
      priceValidUntil: getOneYearFromNow(),
      availability:    product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',

      // ✅ FIX 1: Return policy — resolves the Search Console warning
      hasMerchantReturnPolicy: {
        '@type':              'MerchantReturnPolicy',
        applicableCountry:    'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays:   7,
        returnMethod:         'https://schema.org/ReturnByMail',
        returnFees:           'https://schema.org/FreeReturn',
      },

      // ✅ FIX 2: Shipping details — improves merchant listing eligibility
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type':   'MonetaryAmount',
          value:     '0',
          currency:  'INR',
        },
        shippingDestination: {
          '@type':        'DefinedRegion',
          addressCountry: 'IN',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type':    'QuantitativeValue',
            minValue:   1,
            maxValue:   2,
            unitCode:   'DAY',
          },
          transitTime: {
            '@type':    'QuantitativeValue',
            minValue:   3,
            maxValue:   7,
            unitCode:   'DAY',
          },
        },
      },
    },
  };

  // ✅ Only add aggregateRating if REAL approved reviews exist — NEVER fake data
  if (reviewCount > 0 && averageRating !== null) {
    schema.aggregateRating = {
      '@type':      'AggregateRating',
      ratingValue:  parseFloat(averageRating.toFixed(1)),
      reviewCount,
      bestRating:   5,
      worstRating:  1,
    };

    schema.review = approvedReviews.slice(0, 5).map(review => ({
      '@type': 'Review',
      reviewRating: {
        '@type':      'Rating',
        ratingValue:  review.rating,
        bestRating:   5,
      },
      author: {
        '@type': 'Person',
        name:    review.authorName,  // Real reviewer name — never "Anonymous"
      },
      reviewBody:      review.body,
      datePublished:   new Date(review.createdAt).toISOString().split('T')[0],
    }));
  }
  // If no reviews: omit aggregateRating and review entirely — no placeholders

  return schema;
}
```

**Render in product page:**

```tsx
// app/products/[slug]/page.tsx

const schema = generateProductSchema(product, process.env.NEXT_PUBLIC_SITE_URL!);

return (
  <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
    {/* rest of product page — unchanged */}
  </>
);
```

---

# ISSUE 13 — GOOGLE SHOPPING: PRODUCT IMAGE/NAME MISMATCH + 404 ON CLICK

## Symptom (Confirmed via Screenshot)

In Google Shopping search results for Réveil Fragrance products:

1. **Image mismatch:** The product image shown (Sandalwood Roll-On photo) does not match the product name listed ("Snow Wood 10ml Roll-On")
2. **404 on click:** Clicking the Google Shopping listing navigates to a URL that returns "404 Page Not Found"

This means Google has indexed stale or incorrect data for these products and the URLs it has cached no longer exist.

## Root Cause Analysis — Must Investigate Both Causes

### Cause A — Image/Name Mismatch

Trace this:

```
Product in DB → product.name = "Snow Wood 10ml"
                product.images[0] = "sandalwood-image.jpg"  ← WRONG
                                  OR
Product slug changed from "sandalwood" to "snow-wood"
but old schema.org JSON-LD still references old image URL
                                  OR
Google cached the structured data when name and image
were mismatched in the DB during a product edit
```

**Check every product record in the admin panel:**
- Open `/admin/products`
- For each product: verify that `name`, `slug`, `images[0]`, and `sku` are internally consistent
- A product named "Snow Wood" must NOT have an image URL containing "sandalwood" or referencing another product

**Fix in DB if data is wrong:**

```typescript
// If the image is assigned to the wrong product, reassign it:
// Admin UI: navigate to the affected product → edit → upload correct image

// After DB fix: force Googlebot to recrawl by submitting URL in Search Console
// URL: https://search.google.com/search-console/index?resource_id=...
```

**Fix in JSON-LD if image URL is wrong:**

```typescript
// lib/seo.ts — ensure images array is product-specific
image: product.images.map(img => img.url),
// NOT: image: product.images[0]?.url  // risky if images got mixed up
```

### Cause B — 404 on Click (Broken Product URLs)

This happens when:
1. Product `slug` was changed in the DB but old Google-indexed URL was not redirected
2. Dynamic route `[slug]` changed naming convention (e.g., `[id]` → `[slug]`)
3. Products were deleted and recreated with different slugs
4. Route path changed (e.g., `/product/X` → `/products/X`)

**Step 1 — Audit all product slugs:**

```typescript
// Check current slugs in DB:
const products = await db.product.findMany({
  select: { id: true, name: true, slug: true },
});

// Verify each slug produces a valid page:
// https://yourdomain.com/products/{slug}  → must return 200
```

**Step 2 — Add 301 redirects for ALL changed URLs:**

```typescript
// next.config.ts — add permanent redirects for changed slugs

const nextConfig = {
  async redirects() {
    return [
      // Old slug → New slug (permanent 301)
      {
        source:      '/products/sandalwood-roll-on',
        destination: '/products/snow-wood-roll-on',
        permanent:   true,
      },
      // Add all other changed slugs here
      // Fetch all changed slugs from DB and generate dynamically if many
    ];
  },
};
```

**Step 3 — Implement dynamic slug redirect handler:**

```typescript
// app/products/[slug]/page.tsx — handle old slugs gracefully

export default async function ProductPage({ params }: { params: { slug: string } }) {
  let product = await db.product.findUnique({ where: { slug: params.slug } });

  // If not found by slug, check legacy slug field
  if (!product) {
    product = await db.product.findFirst({
      where: { legacySlug: params.slug },  // Add legacySlug column to schema
    });

    if (product) {
      redirect(`/products/${product.slug}`, RedirectType.permanent);
    }

    notFound(); // Only returns 404 if truly no match
  }

  return <ProductPageContent product={product} />;
}
```

**Add to schema if not present:**

```prisma
model Product {
  slug        String   @unique
  legacySlug  String?  @unique  // Stores old slug after rename
}
```

**Step 4 — After fixing URLs, request Google re-indexing:**

In Google Search Console:
1. Go to URL Inspection Tool
2. Enter each corrected product URL
3. Click "Request Indexing"

Also submit updated sitemap (see Issue 16).

---

# ISSUE 14 — PRODUCT SEO: OPEN GRAPH METADATA

## Current Problem

Product pages are missing or incorrectly implementing Open Graph tags. This means:
- Sharing a product link on WhatsApp / Twitter / Facebook shows broken preview
- Google Search may not correctly associate the product image with the page
- Social sharing shows generic site title instead of product name

## Required Open Graph Tags Per Product Page

```typescript
// app/products/[slug]/page.tsx

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const product = await db.product.findUnique({
    where: { slug: params.slug },
    include: { reviews: { where: { status: 'APPROVED' } } },
  });

  if (!product) return { title: 'Product Not Found' };

  const canonicalUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/products/${product.slug}`;
  const primaryImage = product.images?.[0]?.url ?? `${process.env.NEXT_PUBLIC_SITE_URL}/og-default.jpg`;

  return {
    title:       `${product.name} | Réveil Fragrance`,
    description: product.description?.slice(0, 160) ?? `Buy ${product.name} by Réveil Fragrance`,

    // Canonical URL — prevents duplicate content issues
    alternates: { canonical: canonicalUrl },

    // Open Graph — for Facebook, WhatsApp, LinkedIn
    openGraph: {
      type:        'website',
      url:         canonicalUrl,
      title:       `${product.name} | Réveil Fragrance`,
      description: product.description?.slice(0, 200) ?? '',
      siteName:    'Réveil Fragrance',
      images: [
        {
          url:    primaryImage,    // Must be THIS product's image — not shared/wrong image
          width:  1200,
          height: 630,
          alt:    product.name,   // Must match product name exactly
        },
      ],
    },

    // Twitter Card
    twitter: {
      card:        'summary_large_image',
      title:       `${product.name} | Réveil Fragrance`,
      description: product.description?.slice(0, 200) ?? '',
      images:      [primaryImage],
    },

    // Additional meta for Google
    other: {
      'product:price:amount':   String(product.price),
      'product:price:currency': 'INR',
    },
  };
}
```

**CRITICAL:** The `primaryImage` in Open Graph must be the same image that is mapped in `Product` JSON-LD structured data. Any mismatch between `og:image` and the JSON-LD `image` field is what causes the Google Shopping image/name mismatch. Fix both together.

---

# ISSUE 15 — SITEMAP: ALL PRODUCTS NOT LISTED + AUTO-UPDATE ON NEW PRODUCT

## Current Problem

1. Not all product URLs are present in `sitemap.xml`
2. When a new product is added in the admin panel, the sitemap is NOT automatically updated
3. Google Search Console does not discover new products until manually re-submitted

## Fix — Dynamic Sitemap with All Products

```typescript
// app/sitemap.ts  (Next.js 14 App Router — auto-served at /sitemap.xml)

import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  // Fetch ALL active products — this runs on every request or at revalidation
  const products = await db.product.findMany({
    where:   { isActive: true },           // Only published products
    select:  { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const productUrls: MetadataRoute.Sitemap = products.map(product => ({
    url:             `${siteUrl}/products/${product.slug}`,
    lastModified:    product.updatedAt,
    changeFrequency: 'weekly',
    priority:        0.8,
  }));

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl,                       lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${siteUrl}/products`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${siteUrl}/about`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/contact`,          lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  return [...staticPages, ...productUrls];
}
```

**Force revalidation so sitemap always reflects latest products:**

```typescript
// app/sitemap.ts — add at top

export const revalidate = 3600; // Regenerate every hour
// OR use: export const dynamic = 'force-dynamic'; // Always fresh
```

## Auto-Notify Google Search Console on New Product

When an admin publishes a new product, immediately ping Google's Indexing API:

```typescript
// lib/seo.ts — pingGoogleIndexing()

import { google } from 'googleapis';

export async function pingGoogleIndexing(productUrl: string) {
  try {
    // Requires Google Search Console API credentials in environment
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    const indexing = google.indexing({ version: 'v3', auth });

    await indexing.urlNotifications.publish({
      requestBody: {
        url:  productUrl,
        type: 'URL_UPDATED',
      },
    });

    console.log(`Pinged Google Indexing API for: ${productUrl}`);
  } catch (err) {
    // Non-fatal — log but don't throw. Sitemap submission handles eventual crawl.
    console.warn('Google Indexing API ping failed (non-fatal):', err);
  }
}
```

**Call it in the admin product publish/update API:**

```typescript
// /api/admin/products/route.ts (POST) or /api/admin/products/[id]/route.ts (PUT)

const product = await db.product.create({ data: productData });

// Ping Google immediately — non-blocking
pingGoogleIndexing(`${process.env.NEXT_PUBLIC_SITE_URL}/products/${product.slug}`)
  .catch(console.warn);

return NextResponse.json({ success: true, product });
```

**Required environment variable:**

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

**Setup steps:**
1. Create a Google Cloud Project
2. Enable the "Indexing API" in the API Library
3. Create a Service Account → download JSON credentials
4. Add the service account email as an Owner in Google Search Console
5. Paste the full JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`

---

# ISSUE 16 — ROBOTS.TXT AUDIT

```typescript
// public/robots.txt  (static file — update if currently wrong)

User-agent: *
Allow: /

# Block admin and API routes from indexing
Disallow: /admin/
Disallow: /api/
Disallow: /checkout
Disallow: /cart
Disallow: /profile/
Disallow: /login
Disallow: /register

# Googlebot-specific: allow product images
User-agent: Googlebot-Image
Allow: /

Sitemap: https://revelifragrance.com/sitemap.xml
```

**Verify Googlebot can access:**
- `/products/[slug]` — the page itself (must return 200)
- Product image URLs — must not be behind auth or blocked CDN
- JSON-LD structured data — must be in the initial HTML, not JavaScript-rendered-only

---

# FINAL TESTING CHECKLIST

Run every item after all fixes are applied:

## Customer Flow
- [ ] Logged-in user places order → admin shows real name, email, phone (not "Guest")
- [ ] Guest user places order → admin correctly shows "Guest"
- [ ] All address fields saved: houseNumber, buildingName, street, area, landmark, city, district, state, country, pincode
- [ ] Full address appears in: admin panel, Shiprocket, invoice, email
- [ ] Add address from checkout → save → auto-return to checkout → correct address auto-selected → cart preserved
- [ ] Attempting to place order without email → blocked with clear validation message
- [ ] After order placement → status = `PENDING_APPROVAL` (NOT auto-approved)

## Admin Flow
- [ ] "Confirm" button shows text "Confirm" only (no overflow)
- [ ] Admin confirms order → status → APPROVED → Shiprocket shipment created → AWB generated → tracking URL saved → confirmation email sent
- [ ] Admin cancels order → status → CANCELLED → cancellation email sent → refund initiated if payment was captured
- [ ] View Orders for User A → shows ONLY User A's orders
- [ ] Orders page with no filter → shows all orders (normal behavior preserved)
- [ ] Invoice generated and URL saved after confirmation

## Payment & Shipping
- [ ] Razorpay payment captured → `paymentStatus = CAPTURED` → `status` remains `PENDING_APPROVAL`
- [ ] Razorpay webhook signature verified before any DB write
- [ ] Duplicate Razorpay events ignored (idempotency check works)
- [ ] Shiprocket called ONLY inside admin confirm endpoint — confirmed by codebase search
- [ ] No duplicate shipments — guard against `shiprocketOrderId` already set
- [ ] AWB and tracking URL saved to order after confirmation

## Email Flow
- [ ] Order received email sent immediately after checkout (not after approval)
- [ ] Order confirmation email sent after admin confirms (includes tracking + invoice link)
- [ ] Order cancellation email sent after admin cancels (includes refund status)
- [ ] No duplicate emails — `emailSent` flags checked before send
- [ ] All dynamic variables populated — no `{{placeholder}}` visible in rendered email

## SEO & Structured Data
- [ ] Every product page has JSON-LD with: name, description, images, sku, brand, price, availability, offers
- [ ] `hasMerchantReturnPolicy` present in offers on ALL product pages (7 affected pages fixed)
- [ ] `aggregateRating` and `review` present only on products with ≥1 approved reviews — absent on products with zero reviews
- [ ] No fake/hardcoded rating values anywhere
- [ ] Open Graph tags correct on every product page: `og:title` = product name, `og:image` = that product's image (not another product's image)
- [ ] Twitter Card metadata present on every product page
- [ ] Canonical URL set on every product page (`link rel="canonical"`)
- [ ] `og:image` URL matches `image` field in JSON-LD structured data for same product
- [ ] All active product slugs produce HTTP 200 responses (no 404s)
- [ ] Old/changed slugs redirect 301 to current slug
- [ ] Sitemap at `/sitemap.xml` lists ALL active product URLs
- [ ] Google Indexing API ping fires when new product is published
- [ ] `robots.txt` allows Googlebot on `/products/*` and blocks `/admin/*`
- [ ] Validate at: https://search.google.com/test/rich-results
- [ ] Validate Open Graph at: https://developers.facebook.com/tools/debug/

## Build
- [ ] `npm run build` → zero errors
- [ ] `npm run lint` → zero errors
- [ ] `npx tsc --noEmit` → zero TypeScript errors
- [ ] No console errors in browser on product pages
- [ ] No console errors in browser on checkout flow

---

# FINAL REPORT FORMAT

After completing all fixes, deliver a report in this exact structure:

```markdown
## Fix Report — Réveil Fragrance Production Audit v3.0

### Issue 1 — Customer Showing as Guest
Root Cause: [exact cause found in codebase]
Files Changed: [list every file path]
Database Changes: [migration name, fields added/changed]

### Issue 2 — Shipping Address Data Loss
Root Cause: [exact cause]
Files Changed: [list]
Database Changes: [migration, new columns]

### Issue 3 — Address Checkout Redirect
...

### Issue 4 — View Orders Filter
...

### Issue 5 — Email Required
...

### Issue 6 — Order Approval Workflow
...

### Issue 7 — Confirm Button Text
...

### Issue 8 — Shiprocket Audit
...

### Issue 9 — Razorpay Audit
...

### Issue 10 — Resend Email System
...

### Issue 11 — Invoice Generation
...

### Issue 12 — hasMerchantReturnPolicy
Root Cause: [missing from JSON-LD offers object]
Files Changed: [list]
Pages Fixed: [count]

### Issue 13 — Google Shopping Image/Name Mismatch + 404
Root Cause (Image Mismatch): [wrong image assigned in DB OR JSON-LD referencing wrong URL]
Root Cause (404): [slug changed without redirect OR route path changed]
Files Changed: [list]
Redirects Added: [list old → new slug pairs]
Database Changes: [legacySlug field added?]

### Issue 14 — Open Graph Metadata
Root Cause: [missing/incorrect generateMetadata() implementation]
Files Changed: [list]

### Issue 15 — Sitemap Auto-Update
Root Cause: [static sitemap OR missing revalidation OR no Indexing API ping]
Files Changed: [list]
Environment Variables Added: [list]
Google Cloud Setup Required: [yes/no + steps if yes]

### Issue 16 — Robots.txt
Root Cause: [if any issues found]
Changes Made: [if any]

### Build Results
npm build:  ✅ PASSED / ❌ FAILED
Lint:       ✅ PASSED / ❌ FAILED
TypeScript: ✅ PASSED / ❌ FAILED

### Deployment Notes
Migrations to run: [list]
New environment variables needed: [list with descriptions]
Google Search Console actions: [request re-indexing for X URLs, submit sitemap]
Estimated time for Google to reflect changes: 3–7 days after sitemap submission
```

---

*End of Réveil Fragrance Production Audit Specification — Version 3.0*
*Total Issues: 16 | Categories: Backend Logic, Email, Payments, Shipping, SEO, Structured Data, Open Graph, Sitemap*
