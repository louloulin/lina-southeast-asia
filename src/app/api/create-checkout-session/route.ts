import { NextResponse } from "next/server";

// POST /api/create-checkout-session
export async function POST() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local" },
      { status: 503 }
    );
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey);

    // In production, read cart items from body or session
    // This is a placeholder that creates a test session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "sgd",
            product_data: { name: "LINA Store Order" },
            unit_amount: 2990,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/en?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/en/cart?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
