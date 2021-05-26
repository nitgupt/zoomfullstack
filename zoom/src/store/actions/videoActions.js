import IO from 'socket.io-client';
import Peer from 'react-native-peerjs';
import {MY_STREAM ,ADD_STREAM, ADD_REMOTE_STREAM} from '../actions/types'

import AsyncStorage from '@react-native-async-storage/async-storage';

import {ID} from './authActions';

/** Web RTC */
import {mediaDevices} from 'react-native-webrtc';

//** API_URI */
export const API_URI = `http://192.168.43.35:5000`;

const peerServer = new Peer(undefined, {
  secure: false,
  config: {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ],
  },
});

peerServer.on('error', console.log);

//** Socket Config */
export const socket = IO(`${API_URI}`, {
  forceNew: true,
});

socket.on('connection', () => console.log('Connection'));

export const joinGeneralRoom = () => async (dispatch) => {
  socket.emit('join-general-room', 'ajsdflajslkdfuaisfjwioerwqiheriyqw87ery');
};

export const userJoin = () => async (dispatch, getState) => {
  const allUserRoomID = 'anllkrnfkljnlkadsfjg';
   const roomID = 'active_room_id';
   const {user, allUsers} =  getState().auth;

  // user exits
  socket.emit("user-exists", {user, socketID: socket.id});


//user is found
socket.on('user-found', (currentUser) => {
  if(currentUser){
    socket.emit('update-user', {
      user,
      socketID: socket.id,
      allUserRoomID,
    });
  }else{
    socket.emit('user-join', {allUserRoomID,user, socketID: socket.id});
  }
});

//**get other users */
socket.on('activeUsers', (users) => {
  const eUsers = allUsers.map(({email}) => email);

  const fUsers = users.map(({email, name, socketID, uid, _id}) => {
    if(!eUsers.includes(email)){
      return {
        email,
        name, 
        socketID,
        uid,
        _id,
      };
    }
  })
  .filter((data) => data !== undefined);

    // get all users
    dispatch({ type: ALL_USERS, payload: fUsers});
});
    // get new user joined
    socket.on('new-user-join', (user) => {
      dispatch({type: 'ADD_NEW_USER', payload: user});
    });
};

// Stream Actions
export const joinStream = (stream) => async (dispatch, getState) => {
    const {user} = getState().auth;
    const roomID = 'stream_general_room';

    dispatch({type: MY_STREAM, payload: stream});

    dispatch({
      type: ADD_STREAM,
      payload: {
        stream,
        ...user,
      },
    });

    //*** starts peerjs connection here */
    peerServer.on('open', (peerID) => {
      socket.emit("join-stream-room",
      {
        roomID,
        peerID,
        socketID: socket.id,
        user,
      });
    });

    socket.on('user-connected', ({peerID, user, roomID, socketID}) => {
      connectToNewUser({peerID, user, roomID, socketID, stream})
    });

    // last user recieves a call
    peerServer.on('call', (call) => {
      // answer back to all remote streams
      call.answer(stream);

      // answer the remote call back from the last device
      call.on('stream', (remoteStreams) => {
        // add other streams to  stream array

        dispatch({
          type: ADD_STREAM,
          payload: {
            stream: remoteStreams,
            name: `user_${ID()}`,
            uid: `id_${ID()}`,
            email: `john@gmail.com`,
          },
        });
      });
    });
};

function connectToNewUser({peerID, user, roomID, socketID, stream}){
  // call the last user from other devices
  const call = peerServer.call(peerID, stream);

  // remote users answers the last connected device
  call.on('stream',(lastuserstream) => {
    if(lastuserstream){
      dispatch({
        type: ADD_REMOTE_STREAM,
        payload: {
          stream,
          lastuserstream,
          ...user,
        }
      })
    }
  })
}

export const disconnect = () => async () => {
  // peerServer.disconnect();
};

export const stream = () => async (dispatch) => {
  let isFront = true;
  mediaDevices.enumerateDevices().then((sourceInfos) => {
    let videoSourceId;
    for (let i = 0; i < sourceInfos.length; i++) {
      const sourceInfo = sourceInfos[i];
      if (
        sourceInfo.kind == 'videoinput' &&
        sourceInfo.facing == (isFront ? 'front' : 'environment')
      ) {
        videoSourceId = sourceInfo.deviceId;
      }
    }

    mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          mandatory: {
            minWidth: 500,
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: isFront ? 'user' : 'environment',
          optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
        },
      })
      .then((stream) => {
        dispatch(joinStream(stream));
      })
      .catch((error) => {
        console.log(error);
      });
  });
};
