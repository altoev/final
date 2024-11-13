// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cors = require('cors');
const { fetchAndSaveReservations, Reservation } = require('./reservationService');
const stripeService = require('./stripeService');
const User = require('./userModel');

// Initialize the app
const app = express();

// Enable Mongoose debug mode to see detailed MongoDB operations
mongoose.set('debug', true);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
    fetchAndSaveReservations(); // Fetch reservations immediately after successful MongoDB connection
}).catch((err) => {
    console.error('Error connecting to MongoDB:', err);
});

// Middleware setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware with inactivity timeout
app.use(session({
    secret: process.env.SESSION_SECRET || 'defaultSecret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Should be true in production with HTTPS
        maxAge: 15 * 60 * 1000 // 15 minutes session timeout
    }
}));

// Middleware to reset session timer on activity
app.use((req, res, next) => {
    if (req.session) {
        req.session._garbage = Date();
        req.session.touch();
    }
    next();
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login form submission
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).send('Invalid username or password');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).send('Invalid username or password');
        }

        req.session.userId = user._id; // Save user ID in the session
        req.session.customerName = user.name; // Save customer name to use in the dashboard
        req.session.customerId = user.customerId; // Save customerId to filter reservations

        res.redirect('/customer/dashboard');
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).send('Internal server error');
    }
});

// Middleware to protect routes
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

// Serve dashboard page (protected)
app.get('/customer/dashboard', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/customer', 'dashboard.html'));
});

// Serve custom payments page (protected)
app.get('/customer/customer-payments', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/customer', 'customer-payments.html'));
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Could not log out, please try again');
        }
        res.redirect('/login');
    });
});

// API endpoint to get reservations for the logged-in customer (protected)
app.get('/api/reservations', requireLogin, async (req, res) => {
    try {
        const { customerId, customerName } = req.session;

        // Fetch reservations for the specific customer "Anthony Cooks"
        const reservations = await Reservation.find({
            customerId: 'cus_RCTJTIHutNkgxh',
            customerName: 'Anthony Cooks'
        });

        res.json(reservations); // Send reservations as JSON response
    } catch (err) {
        console.error('Error fetching reservations:', err);
        res.status(500).send('Internal server error');
    }
});

// Serve Stripe publishable key to the frontend (protected)
app.get('/api/stripe-key', requireLogin, (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// API endpoint to get customer cards from Stripe (protected)
app.get('/api/cards', requireLogin, async (req, res) => {
    try {
        const cards = await stripeService.getCustomerCards('cus_RCTJTIHutNkgxh');
        res.json(cards);
    } catch (error) {
        console.error('Error fetching customer cards:', error);
        res.status(500).send('Error fetching customer cards');
    }
});

// API endpoint to add a new card to a customer (protected)
app.post('/api/add-card', requireLogin, async (req, res) => {
    const { token } = req.body;

    try {
        if (!token) {
            return res.status(400).send('Token is required');
        }

        // Add new card to the customer in Stripe
        await stripeService.addCardToCustomer('cus_RCTJTIHutNkgxh', token);

        // Refetch cards after adding a new one to update the system
        const cards = await stripeService.getCustomerCards('cus_RCTJTIHutNkgxh');
        res.json(cards);
    } catch (error) {
        console.error('Error adding card to customer:', error);
        res.status(500).send('Error adding card to customer');
    }
});

// API endpoint to make a payment (protected)
app.post('/api/pay', requireLogin, async (req, res) => {
    const { amount, paymentMethodId, reservationId } = req.body;

    try {
        if (!amount || !paymentMethodId) {
            return res.status(400).send('Amount and Payment Method ID are required');
        }

        // Make payment with Stripe
        const paymentIntent = await stripeService.createPaymentIntent(amount, paymentMethodId);

        // Refetch reservations to update outstanding balance
        await fetchAndSaveReservations();

        res.json(paymentIntent);
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).send('Error processing payment');
    }
});

// 404 Fallback route
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Set interval to fetch reservations every 5 minutes
setInterval(() => {
    console.log('Fetching reservations on 5-minute interval...');
    fetchAndSaveReservations();
}, 5 * 60 * 1000);

// Export the app for use in the server.js file
module.exports = app;
