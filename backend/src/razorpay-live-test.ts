import dotenv from 'dotenv';
dotenv.config();

import Razorpay from 'razorpay';
import { getRazorpayConfig } from './config/razorpay';

async function testRealRazorpaySandbox() {
  console.log('🔍 Testing Real Razorpay Sandbox API Connectivity...\n');

  try {
    const config = getRazorpayConfig();
    console.log(`Config loaded successfully:`);
    console.log(`  - Mode: ${config.mode}`);
    console.log(`  - Key ID: ${config.keyId.substring(0, 10)}...`);
    console.log(`  - Webhook Secret configured: ${Boolean(config.webhookSecret)}`);

    const rzp = new (Razorpay as any)({
      key_id: config.keyId,
      key_secret: config.keySecret,
    });

    console.log('\n📡 Creating a real Test Order on Razorpay Sandbox...');
    const testReceipt = `rcpt_${Date.now()}`;
    const order = await rzp.orders.create({
      amount: 100000, // ₹1,000.00
      currency: 'INR',
      receipt: testReceipt,
      notes: {
        env: 'test_hardening',
        doctor: 'Dr. Vijai',
      },
    });

    console.log('✅ Real Razorpay Sandbox Order Created Successfully!');
    console.log(`  - Razorpay Order ID: ${order.id}`);
    console.log(`  - Amount: ₹${order.amount / 100}`);
    console.log(`  - Currency: ${order.currency}`);
    console.log(`  - Status: ${order.status}`);
    console.log(`  - Receipt: ${order.receipt}`);

    // Fetch the order back from Razorpay to verify retrieval
    console.log('\n📡 Fetching order details back from Razorpay Sandbox...');
    const fetchedOrder = await rzp.orders.fetch(order.id);
    console.log(`✅ Order verified on Razorpay API: status=${fetchedOrder.status}, id=${fetchedOrder.id}`);

    console.log('\n🎉 ALL REAL RAZORPAY TEST MODE CHECKS PASSED!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Razorpay Sandbox API Test Failed:');
    console.error(error.message || error);
    process.exit(1);
  }
}

testRealRazorpaySandbox();
