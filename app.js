const express = require('express');
const http = require('http');
const socket = require('socket.io');
const mongoose = require('mongoose');
const compression = require('compression');
const helmet = require('helmet');

const Meeting = require('./model/meeting');
const Users = require('./model/users');

const app = express();
const server = http.createServer(app);
const io = socket(server, {
    cors: { origin: process.env.CLIENT_URL }
});

app.use(compression());
app.use(helmet());

const controls = [];

io.on('connection', socket => {
    let Id;
    /* stream id */
    socket.on('userstreamid', id => {
        Id = id;
    });
    socket.on('login', async(usermail) => {
        const userMeetings = await Meeting.find({creator_mail: usermail});
        const recentmeetings = [];
        userMeetings.forEach(user => {
            recentmeetings.push({meet_id: user.meet_id, createdAt: user.createdAt})
        });
        socket.emit('login-credential', recentmeetings);
    });
    socket.on('create-meeting-id', async({ID, username, usermail}) => {
        const meeting = await Meeting.create({
            meet_id: ID,
            creator_name: username,
            creator_mail: usermail
        });
        if(meeting.meet_id) {
            socket.emit('created-meeting-id', meeting.meet_id);
        }
    });
    socket.on('create-instant-meeting', async({ID, username, usermail}) => {
        const meeting = await Meeting.create({
            meet_id: ID,
            creator_name: username,
            creator_mail: usermail
        });
        if(meeting.meet_id) {
            socket.emit('created-instant-meeting', meeting.meet_id);
        }
    });
    socket.on('onjoin', async({meetid, username, usermail, userimg}) => {
        const findcreator = await Meeting.findOne({meet_id: meetid});
        const findmeetcreator = await Meeting.findOne({meet_id: meetid, creator_name: username, creator_mail: usermail});
        if(findmeetcreator) {
            io.emit('join', {
                username: findmeetcreator.creator_name, 
                usermail: findmeetcreator.creator_mail,
                allow: true
            });
        }
        if(findmeetcreator === null && findcreator !== null) {
            io.to(meetid).emit('verify-user', {
                username: findcreator.creator_name,
                usermail: findcreator.creator_mail,
                newusername: username,
                newusermail: usermail,
                newuserimg: userimg
            });
        }
        if(findcreator === null) {
            socket.emit('invalid-id', true);
        }
    });
    socket.on('allow-user', ({newusername, newusermail, allow}) => {
        if(allow) {
            io.emit('join', {username: newusername, usermail: newusermail, allow});
        }
        else {
            io.emit('join', {username: newusername, usermail: newusermail, allow});
        }
    });
    socket.on('join-room', async({roomId, peerId, username, usermail, userimg}) => {
        // roomId ---> meeting id in the current room
        // peerId ---> peer id 
        const findmeetcreator = await Meeting.findOne({meet_id: roomId, creator_name: username, creator_mail: usermail});
        socket.emit('meet-creator', findmeetcreator ? true : false);
        const findcreator = await Meeting.findOne({meet_id: roomId});
        if(findcreator === null) {
            socket.emit('invalid-id', true);
        }
        if(findcreator) { 
            socket.join(roomId);
            const user = await Users.create({
                username: username,
                usermail: usermail,
                userimg: userimg,
                peerId: peerId,
                meet_id: roomId,
                stream_id: Id
            });
            if(user.peerId) {
                const users = await Users.find({meet_id: roomId});
                socket.to(roomId).emit('user-connected', { peerId, username });
                io.to(roomId).emit('people', users);
            }
            /* after joined */
            socket.emit('joined', true);
            /* remove user */
            socket.on('removeuser', id => {
                socket.to(roomId).emit('remove-user', id);
            });
            /* screen presenting */
            socket.on('sharing-screen', ({username, usermail}) => {
                socket.to(roomId).emit('presenting-screen', {username, usermail});
            });
            /* screen unpresented */
            socket.on('stop-sharing-screen', ({username, usermail}) => {
                socket.to(roomId).emit('unpresented-screen', {username, usermail});
            });
            /* emitting controls locally */
            socket.on('control', ctrl => {
                const users = controls.find(user => user.id === ctrl.id);
                // finding control and change it
                if(users) {
                    users.id = ctrl.id;
                    users.audio = ctrl.audio;
                    users.video = ctrl.video;
                    if(ctrl.screen === true || ctrl.screen === false) {
                        users.screen = ctrl.screen;
                    }
                }
                // if not then add to controls
                else {
                    controls.push(ctrl);
                }
                // emit controls to all the user in the same room
                io.to(roomId).emit('ctrl', controls);
            });
            socket.on('message', ({chatMsg, username, time}) => {
                socket.emit('message-me', {chatMsg, username, time});
                socket.to(roomId).emit('message-users', {chatMsg, username, time});
            });
            socket.on('disconnect', async() => {
                const userDeleted = await Users.deleteOne({meet_id: roomId, peerId: peerId});
                const users = await Users.find({meet_id: roomId});
                /* disconnect --> delete user controls */
                const controlindex = controls.findIndex(user => user.id === Id);
                if(controlindex !== -1) {
                    controls.splice(controlindex, 1);
                }
                // 
                io.to(roomId).emit('people', users); // People in current room   
                io.to(roomId).emit('user-disconnected', { peerId, Id, username });
            });
        }
    });
});

mongoose.connect(process.env.MONGOURL, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useCreateIndex: true
})
.then(res => {
    server.listen(process.env.PORT || 5000);
})
.catch(err => {
    console.log(err);
});