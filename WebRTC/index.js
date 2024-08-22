// capturing media
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;

document.getElementById('startButton').addEventListener('click', async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
});

// setting up peer connection
let peerConnection;
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // Public STUN server
    ]
};

document.getElementById('callButton').addEventListener('click', () => {
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks to the peer connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Handle remote stream
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Exchange ICE candidates (peer-to-peer connection info)
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            // Send the candidate to the remote peer
            sendToServer({
                type: 'candidate',
                candidate: event.candidate
            });
        }
    };
    
    // Create and send an offer to the remote peer
    peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer);
        sendToServer({
            type: 'offer',
            offer: offer
        });
    });
});

// signalling

const socket = new WebSocket('wss://your-signaling-server');

socket.onmessage = async (message) => {
    const data = JSON.parse(message.data);

    if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendToServer({
            type: 'answer',
            answer: answer
        });
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === 'candidate') {
        peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};

function sendToServer(message) {
    socket.send(JSON.stringify(message));
}

// Hangup call
document.getElementById('hangupButton').addEventListener('click', () => {
    peerConnection.close();
    peerConnection = null;
});

// Testing
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // Broadcast the message to all other clients
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});
