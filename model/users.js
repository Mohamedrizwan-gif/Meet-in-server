const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    usermail: {
        type: String,
        required: true
    },
    userimg: {
        type: String,
        required: true
    },
    peerId: {
        type: String,
        required: true
    },
    meet_id: {
        type: String,
        required: true
    },
    stream_id: {
        type: String, 
        required: true
    }
});

module.exports = mongoose.model('User', userSchema);