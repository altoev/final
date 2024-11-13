// Load environment variables from .env file
require('dotenv').config();

const mongoose = require('mongoose');
const axios = require('axios');

// Define the Reservation schema and model
const reservationSchema = new mongoose.Schema({
    reservationId: { type: String, unique: true },
    customerName: String,
    customerEmail: String,
    customerPhoneNumber: String,
    vehicleId: String,
    vehiclePlate: String,
    vehicleClassId: String,
    vehicleClassLabel: String,
    vehicleVin: String,
    pickUpLocation: String,
    pickUpLocationId: String,
    pickUpLatitude: Number,
    pickUpLongitude: Number,
    pickUpDate: Date,
    returnLocation: String,
    returnLocationId: String,
    returnLatitude: Number,
    returnLongitude: Number,
    returnDate: Date,
    totalPrice: Number,
    outstandingBalance: Number,
    securityDepositPaid: Boolean,
    reservationStatus: String,
    fuelLevelPickUp: Number,
    fuelLevelReturn: Number,
    odometerPickUp: Number,
    odometerReturn: Number,
    createdAt: Date,
    updatedAt: Date,
    additionalCharges: [
        {
            chargeId: String,
            name: String,
            price: Number,
            isMandatory: Boolean
        }
    ]
});

const Reservation = mongoose.model('Reservation', reservationSchema);

// Fetch reservations from the rental API and save to the database
async function fetchAndSaveReservations() {
    console.log('Starting fetchAndSaveReservations...');

    try {
        console.log('Making request to CAAG CRM API for reservations...');
        const response = await axios.get('https://api.caagcrm.com/api/car-rental/reservations', {
            headers: {
                'Authorization': `Basic ${process.env.RENTAL_API_KEY}`,
                'Accept': 'application/json'
            }
        });

        console.log('Successfully received response from CAAG CRM API:', response.status, response.statusText);
        let reservations = response.data.data || response.data.reservations || [];

        if (!Array.isArray(reservations) || reservations.length === 0) {
            console.error('Unexpected response format: could not find iterable reservations data.');
            return;
        }

        console.log(`Fetched ${reservations.length} reservations from API.`);

        for (const reservationData of reservations) {
            try {
                // Parse the detailed fields from reservation data
                const reservation = {
                    reservationId: reservationData.reservation_id || reservationData.id || null,
                    customerName: `${reservationData.customer?.first_name || ''} ${reservationData.customer?.last_name || ''}`.trim(),
                    customerEmail: reservationData.customer?.email || null,
                    customerPhoneNumber: reservationData.customer?.phone_number || null,
                    vehicleId: reservationData.active_vehicle_information?.vehicle_id || null,
                    vehiclePlate: reservationData.active_vehicle_information?.plate || null,
                    vehicleClassId: reservationData.vehicle_class?.id || null,
                    vehicleClassLabel: reservationData.vehicle_class?.name || null,
                    vehicleVin: reservationData.active_vehicle_information?.vin || null,
                    pickUpLocation: reservationData.pick_up_location_custom || reservationData.pick_up_location_label || null,
                    pickUpLocationId: reservationData.pick_up_location_id || null,
                    pickUpLatitude: reservationData.pick_up_location_custom_latitude || null,
                    pickUpLongitude: reservationData.pick_up_location_custom_longitude || null,
                    pickUpDate: reservationData.pick_up_date ? new Date(reservationData.pick_up_date) : null,
                    returnLocation: reservationData.return_location_custom || reservationData.return_location_label || null,
                    returnLocationId: reservationData.return_location_id || null,
                    returnLatitude: reservationData.return_location_custom_latitude || null,
                    returnLongitude: reservationData.return_location_custom_longitude || null,
                    returnDate: reservationData.return_date ? new Date(reservationData.return_date) : null,
                    totalPrice: parseFloat(reservationData.total_price) || null,
                    outstandingBalance: parseFloat(reservationData.outstanding_balance) || null,
                    securityDepositPaid: reservationData.security_deposit_paid || false,
                    reservationStatus: reservationData.status || 'unknown',
                    fuelLevelPickUp: reservationData.active_vehicle_information?.fuel_level_pick_up || null,
                    fuelLevelReturn: reservationData.active_vehicle_information?.fuel_level_return || null,
                    odometerPickUp: reservationData.active_vehicle_information?.odometer_pick_up || null,
                    odometerReturn: reservationData.active_vehicle_information?.odometer_return || null,
                    createdAt: reservationData.created_at ? new Date(reservationData.created_at) : null,
                    updatedAt: reservationData.updated_at ? new Date(reservationData.updated_at) : null,
                    additionalCharges: reservationData.all_additional_charges?.map(charge => ({
                        chargeId: charge.id,
                        name: charge.name,
                        price: parseFloat(charge.percent_amount?.['1']?.amount || 0),
                        isMandatory: charge.is_cancellation_fee || false
                    })) || []
                };

                if (!reservation.reservationId) {
                    console.warn('Skipping reservation without a valid reservationId.');
                    continue;
                }

                // Update or insert reservation into the database
                await Reservation.updateOne(
                    { reservationId: reservation.reservationId },
                    { $set: reservation },
                    { upsert: true }
                );
                console.log(`Reservation ${reservation.reservationId} successfully saved to database.`);
            } catch (dbErr) {
                console.error(`Error saving reservation ${reservationData.reservation_id || reservationData.id} to the database:`, dbErr);
            }
        }
        console.log('All reservations successfully processed.');
    } catch (err) {
        console.error('Error fetching reservations:', err);
    }
}

module.exports = {
    fetchAndSaveReservations,
    Reservation // Export Reservation model for reservation-details.html usage
};
