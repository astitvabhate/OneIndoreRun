import { NextResponse } from 'next/server';
import { event, findRace } from '../../../lib/eventData';
import { formatRegNo, registrationSchema } from '../../../lib/registrationSchema';
import { isPaymentConfigured, isRegistrationClosed, serverConfig } from '../../../lib/server/config';
import { recordOrder, savePending } from '../../../lib/server/db';
import { createOrder } from '../../../lib/server/razorpay';
import { clientIp, withinLimits } from '../../../lib/server/rateLimit';

const busy = () =>
  NextResponse.json(
    { error: 'unavailable', message: 'We are getting a lot of registrations right now. Please try again in a minute; you have not been charged.' },
    { status: 503, headers: { 'Retry-After': '30' } },
  );

// Step 1 of checkout: validate, save (or refresh) the runner's pending row and open a Razorpay order for it.
export async function POST(request: Request) {
  if (!isPaymentConfigured()) {
    return NextResponse.json({ error: 'not_open' }, { status: 503 });
  }
  if (isRegistrationClosed()) {
    return NextResponse.json({ error: 'closed', message: 'Online registration has closed. Thank you for your interest!' }, { status: 410 });
  }

  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', message: 'Some of your details look incomplete. Please go back, check them and try again.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const race = findRace(input.category)?.distance;

  // Slows down bots without getting in the way of families registering together.
  const allowed = await withinLimits([
    { key: `register:ip:${clientIp(request.headers)}`, max: 30, windowSeconds: 600 },
    { key: `register:mobile:${input.mobile}`, max: 10, windowSeconds: 3600 },
  ]);
  if (!allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many attempts from this connection. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': '300' } },
    );
  }

  // The amount always comes from the server, never from the browser.
  const amount = event.fee * 100;
  let registration;
  try {
    registration = await savePending(input);
  } catch (error) {
    console.error('Registration failed: could not save the runner', error);
    return busy();
  }

  if (registration.status === 'full') {
    return NextResponse.json({ error: 'full', message: `Sorry, the ${race} run is sold out. Please choose another run.` }, { status: 409 });
  }
  if (registration.status === 'cancelled') {
    return NextResponse.json(
      { error: 'cancelled', message: `This registration for the ${race} run was cancelled by the organisers. Please contact them on ${event.contact.phone} or ${event.contact.email} if you'd like to rejoin.` },
      { status: 409 },
    );
  }
  if (registration.status === 'paid') {
    return NextResponse.json(
      {
        error: 'duplicate',
        ticketId: registration.id,
        message: `${input.firstName} is already registered for the ${race} run (${formatRegNo(registration.regNo!)}). There's no need to pay again.`,
      },
      { status: 409 },
    );
  }

  try {
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
    console.error('Registration failed: could not open a payment order', registration.id, error);
    return busy();
  }
}
