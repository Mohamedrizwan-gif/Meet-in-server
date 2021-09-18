const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    meet_id: {
        type: String,
        required: true
    },
    creator_name: {
        type: String,
        required: true
    },
    creator_mail: {
        type: String, 
        required: true
    }
}, {timestamps: true});

meetingSchema.index({createdAt: 1},{expireAfterSeconds: 86400});

module.exports = mongoose.model('Meeting', meetingSchema);