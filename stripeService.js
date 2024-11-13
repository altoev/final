// Load environment variables from .env file
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SEC_KEY);

/**
 * Function to get the saved cards of a customer
 * @returns {Promise<Object>} - List of cards on file
 */
async function getCustomerCards() {
    try {
        const customerId = process.env.STRIPE_CUSTOMER_ID;
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });

        const cards = paymentMethods.data.map(card => ({
            id: card.id,
            brand: card.card.brand,
            last4: card.card.last4,
            exp_month: card.card.exp_month,
            exp_year: card.card.exp_year,
        }));

        return cards; // Return the list of saved cards in a simplified format
    } catch (error) {
        console.error('Error fetching customer cards:', error);
        throw error;
    }
}

/**
 * Function to create a payment intent for the customer
 * @param {number} amount - The amount in cents to charge the customer
 * @param {string} paymentMethodId - The Stripe payment method ID
 * @returns {Promise<Object>} - PaymentIntent result
 */
async function createPaymentIntent(amount, paymentMethodId) {
    try {
        const customerId = process.env.STRIPE_CUSTOMER_ID;
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            customer: customerId,
            payment_method: paymentMethodId,
            confirm: true,
            off_session: true,
            description: 'Payment to Altoev'  // Adding payment description here
        });

        return paymentIntent;
    } catch (error) {
        console.error('Error creating payment intent:', error);
        throw error;
    }
}

module.exports = {
    getCustomerCards,
    createPaymentIntent
};
