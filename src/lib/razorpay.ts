import Razorpay from 'razorpay';

if (!process.env.RAZORPAY_KEY_ID) {
    console.warn("RAZORPAY_KEY_ID is not defined. Payments will fail.");
}

export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});
