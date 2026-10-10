import { NextResponse } from 'next/server';
import { event, findRace } from '../../../lib/eventData';
import { formatRegNo, registrationSchema } from '../../../lib/registrationSchema';
import { isRegistrationOpen, serverConfig } from '../../../lib/server/config';
import { attachOrder, findPaid, savePending } from '../../../lib/server/db';
import { createOrder } from '../../../lib/server/razorpay';

// Step 1 of checkout: validate, save a pending registration and open a Razorpay order for it.
export async function POST(request: Request) {
  if (!isRegistrationOpen()) {
    return NextResponse.json({ error: 'not_open' }, { status: 503 });
  }

  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const alreadyPaid = await findPaid(input.mobile, input.category);
    if (alreadyPaid) {
      return NextResponse.json(
        { error: 'duplicate', message: `This mobile number is already registered for the ${findRace(input.category)?.distance} run (${formatRegNo(alreadyPaid.reg_no)}).` },
        { status: 409 },
      );
    }

    // The amount always comes from the server, never from the browser.
    const amount = event.fee * 100;
    const registration = await savePending(input, amount);
    const order = await createOrder(amount, formatRegNo(registration.reg_no), {
      registration_id: registration.id,
      category: input.category,
      mobile: input.mobile,
    });
    await attachOrder(registration.id, order.id);

    return NextResponse.json({
      keyId: serverConfig.razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Registration failed', error);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
