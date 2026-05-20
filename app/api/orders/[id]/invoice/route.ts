import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Params = Promise<{ id: string }>

function escape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Convert a paise-precise rupee amount to Indian-English number words.
 * "1,549 → Indian Rupees One Thousand Five Hundred Forty Nine Only"
 * Used at the bottom of the invoice — legally expected on Indian invoices.
 */
function rupeesInWords(n: number): string {
  const num = Math.round(Number(n) || 0)
  if (num === 0) return 'Indian Rupees Zero Only'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n]
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  }
  const threeDigits = (n: number): string => {
    const h = Math.floor(n / 100)
    const r = n % 100
    return (h ? ones[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? twoDigits(r) : '')
  }
  let str = ''
  const crore = Math.floor(num / 10000000)
  const lakh = Math.floor((num % 10000000) / 100000)
  const thousand = Math.floor((num % 100000) / 1000)
  const rest = num % 1000
  if (crore) str += threeDigits(crore) + ' Crore '
  if (lakh) str += threeDigits(lakh) + ' Lakh '
  if (thousand) str += threeDigits(thousand) + ' Thousand '
  if (rest) str += threeDigits(rest)
  return 'Indian Rupees ' + str.trim() + ' Only'
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      profiles ( full_name, phone, email ),
      order_items (
        quantity, price,
        products ( name, slug )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data: viewerProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (viewerProfile?.role !== 'admin' && order.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const items: any[] = order.order_items || []
  const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
  const shipping = Number(order.shipping_cost || 0)
  const cod = Number(order.cod_charge || 0)
  const grandTotal = Number(order.total || itemsSubtotal + shipping + cod)

  // Reveil prices are MRP-inclusive of 18% GST (standard for perfume HSN 3303).
  // Reverse-calculate the tax breakdown so the invoice is GST-compliant.
  const GST_RATE = 0.18
  const taxableValue = grandTotal / (1 + GST_RATE)
  const totalGst = grandTotal - taxableValue
  // Whether to split CGST/SGST (intra-state) or IGST (inter-state).
  // Pickup is Odisha — anything else is inter-state.
  const addr = (order.shipping_address as any) || {}
  const isOdisha = String(addr.state || '').toLowerCase().includes('odisha') || String(addr.state || '').toLowerCase().includes('orissa')
  const cgst = isOdisha ? totalGst / 2 : 0
  const sgst = isOdisha ? totalGst / 2 : 0
  const igst = isOdisha ? 0 : totalGst

  const orderNo = String(order.id).slice(0, 8).toUpperCase()
  const placedOn = new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const customer = (order.profiles as any)?.full_name || addr.full_name || addr.name || 'Customer'
  const phone = addr.phone || (order.profiles as any)?.phone || ''
  const email = (order.profiles as any)?.email || ''
  const paymentMethod = (order.payment_method || '').toString().toUpperCase()
  const paymentStatus = (order.payment_status || 'pending').toString().toUpperCase()
  const orderStatus = (order.status || 'pending').toString().toUpperCase()
  const awb = order.awb_code || ''
  const courier = order.courier_name || ''
  const trackUrl = awb ? `https://www.reveilfragrance.in/track/${awb}` : `https://www.reveilfragrance.in/orders`

  // Compose a one-line address from any of the schema variants we've shipped.
  const addressLine1 = addr.address_line1 || addr.line1 || addr.address || ''
  const addressLine2 = addr.address_line2 || addr.line2 || ''
  const cityStatePin = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${escape(orderNo)} — Reveil Fragrance</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #ecebe6; color: #1a1a1a; font-family: 'Helvetica Neue', Arial, sans-serif; }

  .actions { max-width: 820px; margin: 24px auto 0; display: flex; gap: 10px; justify-content: flex-end; padding: 0 20px; }
  .btn { padding: 11px 22px; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; border: 1px solid #1a1a1a; background: #1a1a1a; color: #fff; cursor: pointer; font-weight: 700; border-radius: 2px; transition: all .2s; }
  .btn:hover { background: #d4af37; border-color: #d4af37; }
  .btn.ghost { background: transparent; color: #1a1a1a; }
  .btn.ghost:hover { background: #1a1a1a; color: #fff; }

  .sheet { max-width: 820px; margin: 24px auto; background: #ffffff; border: 1px solid #d8d6cd; position: relative; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
  .sheet::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #d4af37 0%, #f4d77a 50%, #d4af37 100%); }

  .head { padding: 44px 52px 0; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .brand-block { display: flex; flex-direction: column; }
  .brand { font-family: 'Baskerville','Georgia',serif; font-size: 32px; letter-spacing: 0.32em; font-weight: 300; color: #1a1a1a; line-height: 1; }
  .brand small { display: block; font-size: 9px; letter-spacing: 0.45em; color: #d4af37; margin-top: 6px; text-transform: uppercase; font-weight: 700; }
  .brand-meta { font-size: 11px; color: #6a6a6a; margin-top: 14px; line-height: 1.7; }
  .brand-meta strong { color: #1a1a1a; }

  .meta-block { text-align: right; }
  .meta-pill { display: inline-block; padding: 5px 14px; background: linear-gradient(135deg,#1a1a1a,#2a2a2a); color: #d4af37; font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 700; border-radius: 999px; margin-bottom: 14px; }
  .meta-grid { font-size: 11px; color: #555; line-height: 1.9; }
  .meta-grid .k { color: #8a8a8a; letter-spacing: 0.12em; text-transform: uppercase; font-size: 9px; font-weight: 600; }
  .meta-grid .v { color: #1a1a1a; font-weight: 600; font-size: 12px; }
  .status-paid { color: #16a34a; font-weight: 700; }
  .status-pending { color: #d4a40a; font-weight: 700; }
  .status-cod { color: #d4a40a; font-weight: 700; }

  .divider-gold { height: 1px; background: linear-gradient(90deg, transparent, #d4af37, transparent); margin: 36px 0 0; }

  .body { padding: 0 52px 36px; }

  .section-h { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #d4af37; margin: 32px 0 14px; font-weight: 800; display: flex; align-items: center; gap: 12px; }
  .section-h::after { content: ''; flex: 1; height: 1px; background: rgba(212,175,55,0.18); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .addr-card { font-size: 13px; line-height: 1.7; color: #2a2a2a; padding: 18px 20px; background: #fafaf7; border: 1px solid #ece9df; border-left: 3px solid #d4af37; border-radius: 2px; }
  .addr-card strong { font-size: 14px; color: #1a1a1a; }
  .addr-card .label { font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 8px; font-weight: 700; }

  table.items { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  table.items thead th { text-align: left; font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: #fff; background: #1a1a1a; padding: 14px 12px; font-weight: 700; }
  table.items thead th.r { text-align: right; }
  table.items tbody td { padding: 16px 12px; border-bottom: 1px solid #eee9da; vertical-align: top; color: #2a2a2a; }
  table.items tbody td.r { text-align: right; white-space: nowrap; }
  table.items tbody tr:nth-child(even) td { background: #fdfcf7; }
  .item-name { font-weight: 600; color: #1a1a1a; font-size: 13.5px; }
  .item-sku { font-size: 10px; color: #8a8a8a; margin-top: 4px; letter-spacing: 0.08em; }

  .totals-wrap { margin-top: 22px; display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: flex-start; }
  .words { font-size: 11px; line-height: 1.7; color: #555; padding: 16px 18px; background: #fafaf7; border: 1px dashed #d4af37; border-radius: 2px; align-self: flex-start; }
  .words .label { font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a8a8a; margin-bottom: 6px; font-weight: 700; }
  .words .amount-words { color: #1a1a1a; font-weight: 600; font-style: italic; }

  .totals { font-size: 13px; }
  .totals .line { display: flex; justify-content: space-between; padding: 9px 0; color: #444; }
  .totals .line .k { color: #6a6a6a; }
  .totals .sub { border-top: 1px solid #ece9df; margin-top: 4px; padding-top: 12px; }
  .totals .grand { background: linear-gradient(135deg,#1a1a1a,#2a2a2a); color: #fff; padding: 18px 20px; margin-top: 14px; border-radius: 2px; }
  .totals .grand .k { color: #d4af37; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; }
  .totals .grand .v { font-size: 22px; font-weight: 700; color: #d4af37; }

  .tracking { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .track-card { padding: 16px 20px; background: rgba(212,175,55,0.06); border: 1px solid rgba(212,175,55,0.3); border-radius: 2px; font-size: 12px; }
  .track-card .k { font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a8a8a; font-weight: 700; margin-bottom: 6px; }
  .track-card .v { color: #1a1a1a; font-weight: 600; }
  .track-card a { color: #d4af37; text-decoration: none; font-weight: 700; }

  .terms { margin-top: 36px; padding: 22px 24px; background: #fafaf7; border: 1px solid #ece9df; border-radius: 2px; font-size: 11px; line-height: 1.7; color: #555; }
  .terms strong { color: #1a1a1a; }
  .terms ul { padding-left: 18px; margin: 8px 0 0; }
  .terms li { margin-bottom: 4px; }

  .signature-row { margin-top: 36px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sig-block { text-align: center; min-width: 200px; }
  .sig-line { border-top: 1px solid #1a1a1a; padding-top: 8px; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: #8a8a8a; font-weight: 600; }
  .sig-stamp { display: inline-block; padding: 14px 28px; border: 2px dashed #d4af37; border-radius: 50%; transform: rotate(-8deg); color: #d4af37; font-weight: 800; letter-spacing: 0.3em; font-size: 14px; text-transform: uppercase; }

  .foot { margin-top: 36px; padding: 28px 52px; background: linear-gradient(135deg,#1a1a1a,#2a2a2a); color: #aaa; font-size: 11px; line-height: 1.8; text-align: center; }
  .foot .brand-foot { color: #d4af37; letter-spacing: 0.35em; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; font-size: 12px; }
  .foot a { color: #d4af37; text-decoration: none; }
  .foot strong { color: #fff; }

  @media print {
    body { background: #fff; }
    .actions { display: none; }
    .sheet { box-shadow: none; border: none; margin: 0; max-width: none; }
    .head { padding: 32px 36px 0; }
    .body { padding: 0 36px 24px; }
    .foot { padding: 20px 36px; }
  }

  @media (max-width: 700px) {
    .head, .body { padding-left: 24px; padding-right: 24px; }
    .head { flex-direction: column; gap: 18px; }
    .meta-block { text-align: left; }
    .two-col, .totals-wrap, .tracking { grid-template-columns: 1fr; }
    .totals-wrap { gap: 12px; }
    .signature-row { flex-direction: column; gap: 28px; align-items: flex-start; }
    .foot { padding: 22px 24px; }
    .brand { font-size: 26px; letter-spacing: 0.24em; }
  }
</style>
</head>
<body>

<div class="actions">
  <button class="btn ghost" onclick="window.close()">Close</button>
  <button class="btn" onclick="window.print()">Download PDF</button>
</div>

<div class="sheet">

  <!-- HEAD -->
  <div class="head">
    <div class="brand-block">
      <div class="brand">REVEIL<small>Fragrance House</small></div>
      <div class="brand-meta">
        <strong>Trimurty Enterprises</strong><br/>
        Brahmapur, Ganjam, Odisha 760009<br/>
        India<br/>
        <strong>Email:</strong> reveilfragrances@gmail.com<br/>
        <strong>Web:</strong> www.reveilfragrance.in
      </div>
    </div>
    <div class="meta-block">
      <div class="meta-pill">Tax Invoice</div>
      <div class="meta-grid">
        <div class="k">Invoice No.</div>
        <div class="v">REV-${escape(orderNo)}</div>
        <div class="k">Invoice Date</div>
        <div class="v">${escape(placedOn)}</div>
        <div class="k">Payment Method</div>
        <div class="v">${escape(paymentMethod === 'COD' ? 'Cash on Delivery' : paymentMethod === 'RAZORPAY' ? 'Online (Razorpay)' : paymentMethod || '—')}</div>
        <div class="k">Payment Status</div>
        <div class="v ${paymentStatus === 'PAID' ? 'status-paid' : paymentMethod === 'COD' ? 'status-cod' : 'status-pending'}">${paymentStatus === 'PAID' ? '✓ PAID' : paymentMethod === 'COD' ? 'COD — Pay on Delivery' : escape(paymentStatus)}</div>
        <div class="k">Order Status</div>
        <div class="v">${escape(orderStatus)}</div>
      </div>
    </div>
  </div>

  <div class="divider-gold"></div>

  <div class="body">

    <!-- ADDRESSES -->
    <div class="two-col">
      <div>
        <h3 class="section-h">Billed To</h3>
        <div class="addr-card">
          <div class="label">Customer</div>
          <strong>${escape(customer)}</strong><br/>
          ${addressLine1 ? escape(addressLine1) + '<br/>' : ''}
          ${addressLine2 ? escape(addressLine2) + '<br/>' : ''}
          ${escape(cityStatePin)}<br/>
          India<br/>
          ${phone ? '<strong>Phone:</strong> ' + escape(phone) + '<br/>' : ''}
          ${email ? '<strong>Email:</strong> ' + escape(email) : ''}
        </div>
      </div>
      <div>
        <h3 class="section-h">Shipped From</h3>
        <div class="addr-card">
          <div class="label">Pickup Location</div>
          <strong>Reveil Fragrance House</strong><br/>
          Trimurty Enterprises<br/>
          Brahmapur, Ganjam<br/>
          Odisha 760009, India<br/>
          <strong>State Code:</strong> 21 (Odisha)
        </div>
      </div>
    </div>

    <!-- ITEMS -->
    <h3 class="section-h">Order Particulars</h3>
    <table class="items">
      <thead>
        <tr>
          <th style="width:7%">#</th>
          <th style="width:43%">Description</th>
          <th style="width:12%">HSN</th>
          <th style="width:8%" class="r">Qty</th>
          <th style="width:15%" class="r">Unit Price</th>
          <th style="width:15%" class="r">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>
              <div class="item-name">${escape(it.products?.name || 'Reveil Fragrance')}</div>
              ${it.products?.slug ? `<div class="item-sku">SKU: ${escape(it.products.slug.toUpperCase())}</div>` : ''}
            </td>
            <td>3303</td>
            <td class="r">${escape(it.quantity)}</td>
            <td class="r">${inr(it.price)}</td>
            <td class="r">${inr((it.price || 0) * (it.quantity || 0))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- TOTALS + AMOUNT IN WORDS -->
    <div class="totals-wrap">
      <div class="words">
        <div class="label">Amount in Words</div>
        <div class="amount-words">${escape(rupeesInWords(grandTotal))}</div>
      </div>
      <div class="totals">
        <div class="line"><span class="k">Subtotal (Taxable)</span><span>${inr(taxableValue)}</span></div>
        ${isOdisha ? `
          <div class="line"><span class="k">CGST @ 9%</span><span>${inr(cgst)}</span></div>
          <div class="line"><span class="k">SGST @ 9%</span><span>${inr(sgst)}</span></div>
        ` : `
          <div class="line"><span class="k">IGST @ 18%</span><span>${inr(igst)}</span></div>
        `}
        <div class="line sub"><span class="k">Shipping</span><span>${shipping > 0 ? inr(shipping) : 'Free'}</span></div>
        ${cod > 0 ? `<div class="line"><span class="k">COD Charge</span><span>${inr(cod)}</span></div>` : ''}
        <div class="grand" style="display:flex; justify-content:space-between; align-items:center;">
          <span class="k">${paymentStatus === 'PAID' ? 'Total Paid' : 'Total Due'}</span>
          <span class="v">${inr(grandTotal)}</span>
        </div>
      </div>
    </div>

    <!-- TRACKING -->
    ${awb ? `
    <h3 class="section-h">Shipment Details</h3>
    <div class="tracking">
      <div class="track-card">
        <div class="k">Courier Partner</div>
        <div class="v">${escape(courier || 'Assigned')}</div>
      </div>
      <div class="track-card">
        <div class="k">AWB / Tracking Number</div>
        <div class="v">${escape(awb)}</div>
      </div>
    </div>
    <div class="track-card" style="margin-top:12px; text-align:center;">
      <div class="k">Track your order live</div>
      <a href="${trackUrl}">${escape(trackUrl)}</a>
    </div>
    ` : ''}

    <!-- TERMS -->
    <h3 class="section-h">Terms &amp; Conditions</h3>
    <div class="terms">
      <ul>
        <li><strong>Returns:</strong> Eligible within 7 days of delivery for sealed, unopened products only. See our refund policy at www.reveilfragrance.in/refund.</li>
        <li><strong>Warranty:</strong> Every Reveil product is 100% original, factory-sealed, and quality-checked before dispatch.</li>
        <li><strong>Damaged in transit?</strong> Reach us within 48 hours of delivery with a photo &amp; unboxing video at reveilfragrances@gmail.com.</li>
        <li><strong>Jurisdiction:</strong> All disputes are subject to courts in Brahmapur, Odisha.</li>
        <li><strong>E-invoice:</strong> This invoice is digitally generated and valid without a physical signature.</li>
      </ul>
    </div>

    <!-- SIGNATURE -->
    <div class="signature-row">
      <div>
        <p style="font-size:11px; color:#555; line-height:1.7; max-width:340px; margin:0;">
          <strong style="color:#1a1a1a;">Need help?</strong><br/>
          Email <a href="mailto:reveilfragrances@gmail.com" style="color:#d4af37; text-decoration:none;">reveilfragrances@gmail.com</a><br/>
          Visit <a href="https://www.reveilfragrance.in" style="color:#d4af37; text-decoration:none;">www.reveilfragrance.in</a>
        </p>
      </div>
      <div class="sig-block">
        <div class="sig-stamp">Reveil ✓</div>
        <div class="sig-line" style="margin-top:8px;">Authorised Signatory<br/>For Trimurty Enterprises</div>
      </div>
    </div>

  </div>

  <!-- FOOTER -->
  <div class="foot">
    <div class="brand-foot">Reveil Fragrance</div>
    Thank you for choosing Reveil. May your presence be unforgettable.<br/>
    <strong>www.reveilfragrance.in</strong> · reveilfragrances@gmail.com · Brahmapur, Odisha<br/>
    <span style="font-size:10px; opacity:0.7;">This is a computer-generated tax invoice. Hash: ${escape(orderNo)}-${escape(String(order.created_at).slice(0, 10))}</span>
  </div>
</div>

<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 400);
  });
</script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
