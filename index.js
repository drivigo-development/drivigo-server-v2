import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';

dotenv.config();
const app = express();

// Enable CORS for your frontend origin only
const corsOptions = {
  origin: [
    'http://localhost:5173',
    "https://drivigo.in",
    "https://drivigo-web-v2.vercel.app"
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Razorpay credentials using environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,  // Correct environment variable name
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Nodemailer transporter (Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.get('/', (req, res) => {
  res.send('Welcome to the drivigo server');
});
// Route to create an order
app.post('/create-order', async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const options = {
      amount: amount * 100, // Convert to paise
      currency: currency,
      receipt: 'order_rcptid_11',
      notes: {
        course: 'Master Gen-AI Development',
      },
    };

    const order = await razorpay.orders.create(options);
    console.log(order)

    res.json({
      order_id: order.id,
      currency: order.currency,
      amount: order.amount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating Razorpay order');
  }
});

// Route to verify payment
app.post('/verify-payment', (req, res) => {
  const { payment_id, order_id, signature } = req.body;

  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(order_id + '|' + payment_id)
    .digest('hex');

  if (generated_signature === signature) {
    res.send('Payment verification successful');
    console.log('Payment verification successful');
  } else {
    res.status(400).send('Payment verification failed');
  }
});



// Route: subscribe
app.post('/subscribe', async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    await transporter.sendMail({
      from: `"Drivigo" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Thanks for subscribing to Drivigo!',
      html: `
        <html lang="en">
              <head>
                <meta charset="UTF-8" />
                <title>Your Updates from Drivigo</title>
              </head>
              <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: Arial, sans-serif; color: #111827;">
                <div style="max-width: 600px; margin: auto; padding: 20px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb;">
                  
                  <!-- Logo -->
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="display: inline-flex; align-items: center; font-size: 2rem; font-weight: 800; color: #111827; margin: 0;">
                      Drivi
                      <span style="
                        background: linear-gradient(135deg, #ffbd40 0%, #e6a22a 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                        font-family: inherit;
                      ">
                        go
                      </span>
                    </h1>
                  </div>
            
                  <!-- Title -->
                  <h2 style="margin-bottom: 10px; color: #111827;">Hello ${name},</h2>
            
                  <!-- Introduction -->
                  <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 15px 0;">
                    Thank you for subscribing to Drivigo! We're excited to keep you updated on driving lessons, instructor availability, and special offers to help you become a confident driver.
                  </p>
                 
                  <!-- CTA -->
                  <p style="text-align: center; margin: 30px 0;">
                    <a href="https://drivigo.com/lessons"
                        style="
                          display: inline-block;
                          background-color: #ffbd40;
                          color: #111827;
                          font-weight: bold;
                          text-decoration: none;
                          padding: 12px 24px;
                          border-radius: 6px;
                          font-size: 16px;
                        ">
                      Explore Driving Lessons
                    </a>
                  </p>
                  
                  <p style="color: #374151; font-size: 14px; margin-top: 40px;">
                    Thanks for being part of the Drivigo community!<br />
                    – The Drivigo Team
                  </p>

                  <!-- Footer -->
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.4; margin: 0 0 8px 0;">
                    You're receiving this email because you subscribed to Drivigo updates.<br />
                    Want to manage your preferences? <a href="https://drivigo.com/settings" style="color: #2563eb; text-decoration: none;">Click here</a>.
                  </p>
                  <p style="color: #9ca3af; font-size: 14px; margin-top: 20px;">
                    Drivigo • 123 Driving Street, Bengaluru, India
                  </p>
                </div>
              </body>
            </html>
      `,
    });
    res.json({ ok: true, message: 'Subscription confirmation email sent.' });
  } catch (err) {
    console.error('SMTP error:', err);
    res.status(500).json({ error: 'Failed to send confirmation email.' });
  }
});

// Route: payment success email
app.post('/payment-success-email', async (req, res) => {
  const {
    email,
    name,
    booking_details
  } = req.body;

  if (!email || !booking_details) {
    return res.status(400).json({ error: 'Missing required email or booking details' });
  }

  const { instructor_name, session_plan, start_date, time_slots, pickup_location } = booking_details;

  const html = `
    <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Drivigo Payment & Booking Confirmation</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f9fafb; font-family:Arial,sans-serif; color:#111827;">
    <div style="max-width:600px; margin:auto; padding:20px; background-color:#ffffff; border-radius:8px; border:1px solid #e5e7eb;">
      
      <!-- Logo -->
      <div style="text-align:center; margin-bottom:30px;">
        <h1 style="display: inline-flex; align-items: center; font-size: 2rem; font-weight: 800; color: #111827; margin: 0;">
          Drivi
          <span style="
            background: linear-gradient(135deg, #ffbd40 0%, #e6a22a 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-family: inherit;
          ">
            go
          </span>
        </h1>
      </div>

      <!-- Greeting -->
      <h2 style="margin-bottom:10px; color:#111827;">Hello ${name},</h2>
      <p style="color:#374151; font-size:16px; line-height:1.5; margin: 0 0 15px 0;">
        Thank you for your payment! 🎉  
        Your booking with <strong>Drivigo</strong> is confirmed.  
        Here are your booking details:
      </p>

      <!-- Details Table -->
      <div style="background-color:#f3f4f6; border-radius:8px; padding:20px; margin-top:20px;">
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse; color:#111827; font-size:15px;">
          <tr>
            <th align="left" style="border-bottom:1px solid #d1d5db; padding-bottom:5px;">Instructor Name</th>
            <td style="border-bottom:1px solid #d1d5db; padding-bottom:5px;">${instructor_name}</td>
          </tr>
          <tr>
            <th align="left" style="border-bottom:1px solid #d1d5db; padding-bottom:5px;">Session Plan</th>
            <td style="border-bottom:1px solid #d1d5db; padding-bottom:5px;">${session_plan}</td>
          </tr>
          <tr>
            <th align="left" style="border-bottom:1px solid #d1d5db; padding-bottom:5px;">Start Date</th>
            <td style="border-bottom:1px solid #d1d5db; padding-bottom:5px;">${new Date(start_date).toLocaleDateString()}</td>
          </tr>
          <tr>
            <th align="left" style="border-bottom:1px solid #d1d5db; padding-bottom:5px;">Time Slots</th>
            <td style="border-bottom:1px solid #d1d5db; padding-bottom:5px;">${Array.isArray(time_slots) ? time_slots.join(', ') : time_slots}</td>
          </tr>
          <tr>
            <th align="left">Pickup Location</th>
            <td>${pickup_location}</td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <p style="text-align:center; margin:30px 0;">
        <a
          href="https://drivigo.com/learnerDashboard"
          style="
            display:inline-block;
            background-color:#ffbd40;
            color:#111827;
            font-weight: bold;
            text-decoration:none;
            padding:12px 24px;
            border-radius:6px;
            font-size:16px;
          "
        >
          View Your Dashboard
        </a>
      </p>

      <!-- Footer -->
      <p style="color:#6b7280; font-size:14px; line-height:1.4; margin:0 0 8px 0;">
        If you have any questions, reply to this email or visit our
        <a href="https://drivigo.com/support" style="color:#2563eb; text-decoration:none;">support page</a>.
      </p>
      <p style="color:#9ca3af; font-size:14px; margin-top:20px;">
        Drivigo • 123 Driving Street, Bengaluru, India
      </p>
    </div>
  </body>
</html>

  `;

  try {
    await transporter.sendMail({
      from: `"Drivigo" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Drivigo Payment & Booking Details',
      html
    });
    res.json({ ok: true, message: 'Payment & booking email sent.' });
  } catch (err) {
    console.error('SMTP error:', err);
    res.status(500).json({ error: 'Failed to send payment receipt email.' });
  }
});



// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
