const express = require("express");
const { default: Stripe } = require("stripe");
const cors = require("cors");
// const stripe = new Stripe("stripe")(
//   "sk_test_51NoAhsFAIyhheUEaazNwkvhkrjqAhJTK8CFut5YU1VaQsvzsxPKznZ2yl0aWRUc6csNh7rG0kHGvt9hed0mXolG000s6IGflGg"
// );

const stripe = new Stripe(process.env.STRIPE_KEY, {});

const app = express();
app.use(cors());

const endpointSecret = process.env.STRIPE_ENDPOINT;

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];
    console.log(sig);
    console.log(JSON.stringify(request.body));

    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      console.log(`Webhook Error: ${err.message}`);
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log("Wbhook avviato", event.type);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        console.log("Sessione completata");
        const checkoutSessionCompleted = event.data.object;
        const fattura = await stripe.invoices.retrieve(
          checkoutSessionCompleted.invoice
        );
        if (fattura.collection_method == "charge_automatically") break;
        const resp = await stripe.invoices.sendInvoice(fattura.id);
        console.log("Risp: ", resp);
        // Then define and call a function to handle the event checkout.session.completed
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();
  }
);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

const port = 3000;

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!!!!!!");
});

app.post("/create-payment", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "paypal"],
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: "Descrizione di test",
          footer: "Prova footer",
        },
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "TestProduct",
            },
            unit_amount: 10 * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      cancel_url: `${"http://localhost:3001/error"}`,
      success_url: `${"http://localhost:3001/success"}`,
    });
    res.status(200).send(session.id);
  } catch (error) {
    res.status(500).send("error");
  }
});

app.get("/create-intent", async (req, res) => {
  const intent = await stripe.paymentIntents.create({
    amount: 10 * 100,
    currency: "eur",
    automatic_payment_methods: { enabled: true },
  });
  res.send(intent.client_secret);
});

app.post("/create-invoice", async (req, res) => {
  try {
    const email = "tiziano.nicosia01@gmail.com";
    const clientID = "cus_PM7jLLhuaOy6GM";
    const customer = await stripe.customers.retrieve(clientID);
    const fattura = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 5,
    });
    const fattura_item = await stripe.invoiceItems.create({
      customer: customer.id,
      unit_amount: 10 * 300,
      quantity: 1,
      invoice: fattura.id,
    });
    console.log("Invio fattura...");
    await stripe.invoices.sendInvoice(fattura.id);
    console.log("Fattura mandata.");
  } catch (error) {
    console.log(error);
  }
});

app.post("/create-sub", async (req, res) => {
  // const sub = await stripe.subscriptionSchedules.create({
  //   customer: "cus_PM7iHQXAeGm0R3",
  //   start_date: Math.floor(Date.now() / 1000),
  //   phases: [
  //     {
  //       items: [{ price: "price_1OYnJ5FAIyhheUEaGi285npc", quantity: 1 }],
  //       iterations: 5,
  //     },
  //   ],
  // });
  // res.send(sub.id);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "paypal"],
    customer: "cus_PNeknQjCtTZIfU",
    line_items: [
      {
        price: "price_1OYnJ5FAIyhheUEaGi285npc",
        quantity: 1,
      },
    ],
    mode: "subscription",
    cancel_url: `${"http://localhost:3001/error"}`,
    success_url: `${"http://localhost:3001/success"}`,
  });
  console.log(session);
  res.status(200).send(session.id);
});

app.post("/create-product", async (req, res) => {
  // console.log(req.body);
  // const { token } = req.body;
  // if (token == null || token == undefined) {
  //   res.status(500).send("No token");
  //   return;
  // }
  const CENTS = 100;
  const product = await stripe.products.create(
    { name: "Pacchetto votanti" },
    { idempotencyKey: token }
  );
  const price = await stripe.prices.create(
    {
      currency: "eur",
      product: product.id,
      recurring: { interval: "month", interval_count: 3 },
      unit_amount: 20 * CENTS,
    },
    { idempotencyKey: token + "i" }
  );
  res.send(product);
});

app.post("/create-customer", async (req, res) => {
  const customer = await stripe.customers.create({
    email: "tiziano.nicosia@gmail.com",
    phone: "+393425288454",
    name: "Tiziano Nicosia",
    address: {
      city: "Gela",
      country: "IT",
      postal_code: "93012",
      state: "Sicilia",
      line1: "Via Prova 123",
    },
  });
  res.send(customer);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
