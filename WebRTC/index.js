const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;
let peerConnection;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // Public STUN server
    ]
};

// Connect to the signaling server
const socket = new WebSocket('ws://your-signaling-server-ip:8080');

socket.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendToServer({ type: 'answer', answer: answer });
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};

function sendToServer(message) {
    socket.send(JSON.stringify(message));
}

document.getElementById('startButton').addEventListener('click', async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
});

document.getElementById('callButton').addEventListener('click', () => {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(configuration);

        // Add local stream tracks to the peer connection
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        // Handle remote stream
        peerConnection.ontrack = event => {
            remoteVideo.srcObject = event.streams[0];
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                sendToServer({ type: 'candidate', candidate: event.candidate });
            }
        };

        // Create and send an offer
        peerConnection.createOffer().then(offer => {
            peerConnection.setLocalDescription(offer);
            sendToServer({ type: 'offer', offer: offer });
        });

        console.log('Call initiated.');
    } else {
        console.log('Call already in progress.');
    }
});

document.getElementById('hangupButton').addEventListener('click', () => {
    if (peerConnection) {
        // Close all tracks associated with the peer connection
        const senders = peerConnection.getSenders();
        senders.forEach(sender => peerConnection.removeTrack(sender));
        
        // Close the peer connection
        peerConnection.close();
        peerConnection = null;

        // Optionally stop the local video stream to release the camera
        localStream.getTracks().forEach(track => track.stop());

        // Clear the video elements
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;

        console.log('Call ended.');
    }
});

peerConnection.ontrack = event => {
    if (remoteVideo.srcObject !== event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
        console.log('Remote stream received and added.');
    }
};

socket.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    console.log('Received message:', data);

    if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendToServer({ type: 'answer', answer: answer });
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};
