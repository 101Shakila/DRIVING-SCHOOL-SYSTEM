const User = require('../models/User');//Import User Model - can interact with user collection made in mongoDB
const Appointment = require('../models/Appointment');//Import Appointment Model - can interact with appointment collection made in mongoDB
const bcrypt = require('bcrypt');//Import bcrypt Library into our app - Helps hash passwords
//Here we will update car info & user details

// This will render the dashboard page.
exports.dashboard = (req, res) => {
    //We need to store the username to MATCH to the database & userType for authentication access to g and g2 page
    const username = req.session.user.username;
    const userType = req.session.user.userType;

    if (username) {
        res.render('dashboard', { title: 'Dashboard Page', username, userType, loggedIn: true });
    }
    else {
        res.render('dashboard', { title: 'Dashboard Page', username, userType, loggedIn: false });
    }
};



//display user info based on user LICENSE NUMBER
//First it will validate license Number
//using bcrpty - We will compare and try to match the user
//After matching we will render G page.
exports.gPage = async (req, res) => {
    const username = req.session.user.username;
    const userType = req.session.user.userType;

    if (!username) {
        return res.redirect('/login'); // Redirect to login if no user is logged in
    }

    try {
        const user = await User.findOne({ username }).populate('appointment');
        const selectedDate = req.query.appointmentDate || new Date().toISOString().split('T')[0]; // Default to today's date

        // Check appointment availability only if user has failed or doesn't have an appointment
        const appointments = user.pass === false || !user.appointment
            ? await Appointment.find({ date: selectedDate, isTimeAvailable: true })
            : []; // If the user has passed or already has an appointment, no need to fetch slots
        const slots = appointments.map(appointment => appointment.time);

        const isNewUser = user.firstName == 'First Name' && user.lastName == 'Last Name';

        res.render('g', {
            title: 'G Page',
            user,
            message: null,
            isNewUser,
            userType,
            loggedIn: true,
            appointment: user.appointment || {},
            slots,
            selectedDate
        });
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
};



//If updating car details - we will match use user based on LICENSE NUMBER and then update it if MATCHED.
//G page will be rendered after sucessfully updating user information.
//if Error the error message will appear
exports.updateCarInfo = (req, res) => {
    const username = req.session.user.username;
    const userType = req.session.user.userType;


    if (!username) {
        return res.redirect('/login'); // Redirect to login if no user is logged in
    }

    const { make, model, carYear, plateNumber } = req.body;

    if (!make.match(/^[A-Za-z\s]{1,50}$/) || !model.match(/^[A-Za-z\s]{1,50}$/) || !carYear.match(/^\d{4}$/) || !plateNumber.match(/^[a-zA-Z0-9]+$/)) {
        return res.render('g', { title: 'G Page', message: 'Invalid input', goToG2: false, userType, user: null, loggedIn: true, isNewUser: true });
    }

    User.findOne({ username })
        .populate('appointment') // Populate the appointment field
        .then(user => {
            if (user) {
                user.carDetails.make = make;
                user.carDetails.model = model;
                user.carDetails.carYear = carYear;
                user.carDetails.plateNumber = plateNumber;
                return user.save();
            } else {
                res.render('g', { title: 'G Page', message: 'User not found', goToG2: false, userType, loggedIn: true });
            }
        })
        .then(savedUser => {
            if (savedUser) {
                res.render('g', { title: 'G Page', user: savedUser, message: 'Updated successfully', goToG2: false, userType, loggedIn: true, isNewUser: false, appointment: savedUser.appointment || {} });
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
};

// userController.js
// userController.js
exports.g2Page = async (req, res) => {
    const username = req.session.user.username;
    const userType = req.session.user.userType;
    const selectedDate = req.query.appointmentDate;

    try {
        const user = await User.findOne({ username });
        let slots = [];

        if (selectedDate) {
            const appointments = await Appointment.find({ date: selectedDate, isTimeAvailable: true });
            slots = appointments.map(appointment => appointment.time);


        }

        if (user) {
            res.render('g2', { title: 'G2 Page', user, message: null, userType, loggedIn: true, slots, selectedDate });
        } else {
            res.render('g2', { title: 'G2 Page', message: 'User not found', user: null, userType, loggedIn: true, slots, selectedDate });
        }
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
};




//Form submissions chekced and done here.
//Create a new user based on values provided OR the values provided
//Save new user deatils and renders g2 page
// userController.js
exports.g2Post = async (req, res) => {
    const username = req.session.user.username;
    const userType = req.session.user.userType;
    const defaultDob = new Date('2000-01-01');
    const saltRounds = 10;
    const selectedDate = req.body.appointmentDate;
    const selectedTime = req.body.appointmentTime;

    try {
        // Find the user
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Update user details
        user.firstName = req.body.firstName || 'First Name';
        user.lastName = req.body.lastName || 'Last Name';
        user.licenseNumber = req.body.licenseNumber ? await bcrypt.hash(req.body.licenseNumber, saltRounds) : 'Unknown';
        user.age = req.body.age || 18;
        user.dob = req.body.dob || defaultDob;
        user.carDetails.make = req.body.make || 'Make';
        user.carDetails.model = req.body.model || 'Model';
        user.carDetails.carYear = req.body.carYear || new Date().getFullYear();
        user.carDetails.plateNumber = req.body.plateNumber || 'Plate Number';

        if (req.body.appointmentId) {
            user.appointment = req.body.appointmentId;
        }

        const updatedUser = await user.save();

        if (req.body.appointmentId) {
            const updatedAppointment = await Appointment.findOneAndUpdate(
                { date: selectedDate, time: selectedTime },
                { $set: { isTimeAvailable: false } },
                { new: true }
            );

            if (!updatedAppointment) {
                return res.render('g2', {
                    title: 'G2 Page',
                    user: updatedUser,
                    message: 'Updated successfully! Please choose an appointment date.',
                    userType,
                    loggedIn: true,
                    selectedDate,
                    slots: [],
                    showAlert: true,
                    isNewUser: false
                });
            }
        }

        res.render('g2', {
            title: 'G2 Page',
            user: updatedUser,
            message: 'User updated successfully!',
            userType,
            loggedIn: true,
            selectedDate,
            slots: [],
            showAlert: false
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
};





// This will render the Appointment page with Pass/Fail candidates
exports.appointmentPage = async (req, res) => {
    const username = req.session.user.username;
    const userType = req.session.user.userType;

    try {
        if (username) {
            const appointments = await Appointment.find()
                .populate({
                    path: 'driver',
                    select: 'firstName lastName testType'
                })
                .exec();

            const candidates = await User.find({ 'pass': { $ne: null } })
                .select('firstName lastName testType pass comment')
                .exec();

            res.render('appointment', {
                title: 'Appointment Page',
                username,
                userType,
                message: req.query.message || null,
                loggedIn: true,
                appointments,
                candidates: candidates || [] // Ensure candidates is always defined
            });
        } else {
            res.render('dashboard', {
                title: 'Dashboard Page',
                username,
                userType,
                loggedIn: false
            });
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        res.render('appointment', {
            title: 'Appointment Page',
            username,
            userType,
            message: 'Error fetching data.',
            loggedIn: true,
            appointments: [],
            candidates: [] // Ensure candidates is always defined
        });
    }
};


//Form submissions to post the appointment availability - DONE by the admin
// userController.js
exports.appointmentPost = async (req, res) => {
    const userType = req.session.user.userType;
    const { date, slots } = req.body;

    if (!date || !slots) {
        return res.status(400).render('appointment', {
            title: 'Appointment',
            message: 'Date and slots are required.',
            loggedIn: true,
            userType,
            appointments: [],
            candidates: [] // Pass an empty array if no candidates
        });
    }

    const slotsArray = slots.split(',');

    try {
        // Collect all existing appointments for the given date
        const existingAppointments = await Appointment.find({ date }).exec();
        const existingTimes = existingAppointments.map(appointment => appointment.time);

        let newSlots = [];
        let errorMessages = [];

        for (const time of slotsArray) {
            if (existingTimes.includes(time)) {
                errorMessages.push(`Slot ${time} is already taken.`);
            } else {
                newSlots.push(time);
            }
        }

        // Save new slots if there are any
        if (newSlots.length > 0) {
            const newAppointments = newSlots.map(time => ({ date, time }));
            await Appointment.insertMany(newAppointments);
        }

        let successMessage = '';
        if (newSlots.length > 0) {
            successMessage = `Slot${newSlots.length > 1 ? 's' : ''} ${newSlots.join(', ')} have been saved!`;
        }
        if (errorMessages.length > 0) {
            successMessage += (successMessage ? ' ' : '') + errorMessages.join(' ');
        }

        // Fetch candidates with Pass/Fail status and comments
        const candidates = await User.find({ 'pass': { $ne: null } })
            .select('firstName lastName testType pass comment')
            .exec();

        return res.render('appointment', {
            title: 'Appointment',
            message: successMessage || 'No slots were added.',
            loggedIn: true,
            userType,
            appointments: [], // Pass appointment data if needed
            candidates // Pass candidates data
        });
    } catch (error) {
        console.error('Error saving appointments:', error);
        return res.status(500).render('appointment', {
            title: 'Appointment',
            message: 'An error occurred while saving appointments.',
            loggedIn: true,
            userType,
            appointments: [],
            candidates: [] // Pass an empty array if there's an error
        });
    }
};



// Add this function to handle booking an appointment - USER
exports.bookAppointment = async (req, res) => {
    const username = req.session.user.username;
    const selectedSlot = req.body.selectedSlot;
    const source = req.body.source;

    if (!selectedSlot) {
        return res.render(source === 'G' ? 'g' : 'g2', {
            title: `${source} Page`,
            message: 'No slot selected',
            user: req.session.user,
            userType: req.session.user.userType,
            loggedIn: true,
            slots: [],
            selectedDate: req.query.appointmentDate,
            showAlert: true,
            isNewUser: false
        });
    }

    try {
        const user = await User.findOne({ username }).populate('appointment');
        if (!user) {
            return res.status(404).send('User not found');
        }

        const hasAppointment = user.appointment;
        const hasFailed = user.pass === false;
        const hasPassed = user.pass === true;
        const isPassNull = user.pass === null;

        if (hasPassed) {
            return res.render(source === 'G' ? 'g' : 'g2', {
                title: `${source} Page`,
                message: 'You have passed the test. No further appointments can be booked.',
                user,
                userType: req.session.user.userType,
                loggedIn: true,
                selectedDate: req.query.appointmentDate,
                slots: [],
                showAlert: true,
                isNewUser: false
            });
        }

        if (hasAppointment && !hasFailed) {
            return res.render(source === 'G' ? 'g' : 'g2', {
                title: `${source} Page`,
                message: 'You already have an appointment booked. You cannot book another one.',
                user,
                userType: req.session.user.userType,
                loggedIn: true,
                selectedDate: req.query.appointmentDate,
                slots: [],
                showAlert: true,
                isNewUser: false
            });
        }

        if (isPassNull || hasFailed) {
            const appointment = await Appointment.findOne({ time: selectedSlot });
            if (!appointment) {
                return res.status(404).send('Appointment slot not found');
            }

            // Update user with new appointment
            user.appointment = appointment._id;
            user.testType = source === 'G' ? 'G' : 'G2';
            user.pass = null;
            await user.save();

            // Update the new appointment slot
            appointment.driver = user._id;
            appointment.isTimeAvailable = false;
            await appointment.save();

            return res.render(source === 'G' ? 'g' : 'g2', {
                title: `${source} Page`,
                user,
                message: 'Appointment booked successfully!',
                userType: req.session.user.userType,
                loggedIn: true,
                selectedDate: req.query.appointmentDate,
                slots: [],
                showAlert: true,
                isNewUser: false
            });
        }
    } catch (err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
};








// This will render the Examiner page with appointments.
exports.examinerPage = async (req, res) => {
    const username = req.session.user.username;
    const userType = req.session.user.userType;
    const testType = req.query.testType || ''; // Add this line to get the testType filter from query parameters

    if (username) {
        try {
            // Fetch all appointments from the database and populate the driver field - VIEW DRIVER
            const appointments = await Appointment.find()
                .populate({
                    path: 'driver', // The field to populate
                    select: 'firstName lastName carDetails testType' // Include testType and carDetails
                })
                .exec();

            // Filter appointments based on testType if specified
            const filteredAppointments = testType
                ? appointments.filter(appointment => appointment.driver && appointment.driver.testType === testType)
                : appointments;

            // Render the examiner page with the fetched appointments and testType
            res.render('examiner', {
                title: 'Examiner Page',
                username,
                userType,
                message: req.query.message || null,
                loggedIn: true,
                appointments: filteredAppointments,
                testType // Pass testType to the template
            });
        } catch (error) {
            console.error("Error fetching appointments:", error);
            res.render('examiner', {
                title: 'Examiner Page',
                username,
                userType,
                message: 'Error fetching appointments.',
                loggedIn: true,
                appointments: [],
                testType // Ensure testType is still passed
            });
        }
    } else {
        res.render('dashboard', {
            title: 'Dashboard Page',
            username,
            userType,
            loggedIn: false
        });
    }
};

// UPDATE DRIVER STATUS FROM EXAMINER PAGE
exports.updateDriverStatus = async (req, res) => {
    const userId = req.body.userId;
    const appointmentId = req.body.appointmentId;
    const comment = req.body.comment;
    const pass = req.body.pass === 'true'; // Convert to boolean

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Update the user's status and comment
        user.comment = comment;
        user.pass = pass;

        // If the user fails, reset the appointment slot
        if (!pass && user.appointment) {
            const appointment = await Appointment.findById(user.appointment);

            if (appointment) {
                appointment.driver = null;
                appointment.isTimeAvailable = true;
                await appointment.save();
            }

            user.appointment = null; // Reset the user's appointment
        }

        await user.save();

        res.redirect('/examiner');
    } catch (error) {
        console.error("Error updating driver status:", error);
        res.status(500).send('Internal Server Error');
    }
};


