//Here we have to define the User Collection Schema
const mongoose = require('mongoose'); //Import mongoose library
const Schema = mongoose.Schema;  // This is reference to Schema Class ~ can create new Schema instances.
const bcrypt = require('bcrypt'); //Import bcrypt Library into our app - Helps hash passwords


//based on g2. test page - we will save the information the user input
const carInformationSchema = new Schema({
    make: {
        type: String,
        required: true,
        default: 'First Name'
    },
    model: {
        type: String,
        required: true,
        default: 'Last Name'
    },
    carYear: {
        type: Number,
        required: true,
        default: 0
    },
    plateNumber: {
        type: String, //Converted into string for flexibility.
        required: true,
        default: 'Unknown'
    }

});

const userCollection = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    userType: {
        type: String,
        required: true,
        enum: ['Driver', 'Examiner', 'Admin'] // Predefined set of values that can be chosen for the fields value!
    },
    firstName: {
        type: String,
        required: true,
        default: 'Default'
    },
    lastName: {
        type: String,
        required: true,
        default: 'Default'
    },
    licenseNumber: {
        type: String, //When it comes to HASHING - we need it to be string because hash function output is STRING.
        required: true,
        default: 'Default'
    },
    age: {
        type: Number,
        required: true,
        default: 0
    },
    dob: {
        type: Date,
        required: true
    },
    //to nest the other cars section we have to do as below :       
    carDetails: carInformationSchema,
    //adding field is added here because we need to store the appointment ID based on the user
    appointment: {
        type: Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    testType: {
        type: String,
        enum: ['G2', 'G'],
        required: true,
        default: 'G2' // Or 'G' depending on your default preference
    },
    comment:
        { type: String, default: '' }, // Added Comment
    pass:
        { type: Boolean, default: null } // Added Pass/Fail

});
//TESTING
//To improve security - we will ENCRYPT the license number before saving it into the system.
//middleware refers to functions that run during the lifecycle of a request to a server, but before the final request handler.
//Below will be treated as a pre-save middlewear for userCollection 
userCollection.pre('save', async function (callback) { //async makes the function asynchronous

    try {
        if (this.isModified('licenseNumber')) { // We need to check if licenseNumber has been modified and AVOID re-hashing it.
            const salt = await bcrypt.genSalt(10); //genSalt adds randomness to the encryption making it harder to hack. - await is used here to make sure to wait for async hash to complete.
            this.licenseNumber = await bcrypt.hash(this.licenseNumber, salt);
        }
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        callback(); //callback is needed here to make sure the middleware stack continues and saves the data in the database.
    } catch (error) {
        callback(error);
    }
});

//This will create a model names 'User' while using the schema defined above 'userCollection'
const User = mongoose.model('User', userCollection);
module.exports = User;