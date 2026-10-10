import { NextResponse } from 'next/server';
import { event, findRace } from '../../../lib/eventData';
import { formatRegNo, registrationSchema } from '../../../lib/registrationSchema';
import { isRegistrationOpen, serverConfig } from '../../../lib/server/config';
import { recordOrder, savePending } from '../../../lib/server/db';
import { createOrder } from '../../../lib/server/razorpay';

// Step 1 of checkout: validate, save (or refresh) the runner's pending row and open a Razorpay order for it.
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
    // The amount always comes from the server, never from the browser.
    const amount = event.fee * 100;
    const registration = await savePending(input, amount);
    if (registration.status === 'cancelled') {
      return NextResponse.json(
        { error: 'cancelled', message: `This registration for the ${findRace(input.category)?.distance} run was cancelled by the organisers. Please contact them if you'd like to rejoin.` },
        { status: 409 },
      );
    }
    if (registration.status === 'paid') {
      return NextResponse.json(
        {
          error: 'duplicate',
          ticketId: registration.id,
          message: `${input.firstName} is already registered for the ${findRace(input.category)?.distance} run (${formatRegNo(registration.regNo!)}). There's no need to pay again.`,
        },
        { status: 409 },
      );
    }

    const order = await createOrder(amount, `reg_${registration.id.slice(0, 8)}_${Date.now().toString(36)}`, {
      registration_id: registration.id,
      category: input.category,
      mobile: input.mobile,
    });
    await recordOrder(registration.id, order.id, amount);

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
