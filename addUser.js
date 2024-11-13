// Load environment variables from .env file
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./userModel'); // Import User model

mongoose.connect(process.env.MONGO_DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to MongoDB');

    const username = 'damian'; // Set desired username
    const password = 'Nana1523!'; // Set desired password

    try {
        const user = new User({ username, password });
        await user.save();
        console.log('User added successfully');
    } catch (err) {
        console.error('Error adding user:', err);
    } finally {
        mongoose.disconnect();
    }
}).catch((err) => {
    console.error('Error connecting to MongoDB:', err);
});
