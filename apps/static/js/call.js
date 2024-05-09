const baseURL = "/"

let localVideo = document.querySelector('#localVideo');
let remoteVideo = document.querySelector('#remoteVideo');

let userToCall;
let otherUser;
let remoteRTCMessage;

let iceCandidatesFromCaller = [];
let peerConnection;
let remoteStream;
let localStream;

let callInProgress = false;

//event from html
function call() {
    otherUser = userToCall;

    beReady()
        .then(bool => {
            processCall(userToCall)
        })
}

function answer() {
    //do the event firing

    beReady()
        .then(bool => {
            processAccept();
        })

    document.getElementById("answer").style.display = "none";
}

let pcConfig = {
    "iceServers":
        [
            { "url": "stun:stun.jap.bloggernepal.com:5349" },
            {
                "url": "turn:turn.jap.bloggernepal.com:5349",
                "username": "guest",
                "credential": "somepassword"
            },
            { "url": "stun:stun.l.google.com:19302" }
        ]
};

let sdpConstraints = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
};

/////////////////////////////////////////////

let socket;
let callSocket;
function connectSocket() {
    let ws_scheme = window.location.protocol == "https:" ? "wss://" : "ws://";

    callSocket = new WebSocket(
        ws_scheme
        + window.location.host
        + '/ws/call/'
    );
    // console.log(id_user)
    callSocket.onopen = event => {
        callSocket.send(JSON.stringify({
            type: 'login',
            data: {
                name: id_user + "name"
            }
        }));
    }

    callSocket.onmessage = (e) => {
        let response = JSON.parse(e.data);
        let type = response.type;

        if (type == 'connection') {
            console.log(response.data.message)
        }

        if (type == 'call_received') {
            onNewCall(response.data)
        }

        if (type == 'call_answered') {
            onCallAnswered(response.data);
        }

        if (type == 'ICEcandidate') {
            onICECandidate(response.data);
        }
    }

    const onNewCall = (data) => {

        otherUser = data.caller;
        remoteRTCMessage = data.rtcMessage
        // Sử dụng regular expression để tìm các số trong chuỗi
        var numbers = otherUser.match(/\d+/);
        var extractedNumber = numbers ? parseInt(numbers[0]) : null;
        document.getElementById("callerName").innerHTML = extractedNumber;
        document.getElementById("call").style.display = "none";
        document.getElementById("answer").style.display = "block";
    }

    const onCallAnswered = (data) => {
        //when other accept our call
        remoteRTCMessage = data.rtcMessage
        peerConnection.setRemoteDescription(new RTCSessionDescription(remoteRTCMessage));

        document.getElementById("calling").style.display = "none";

        console.log("Call Started. They Answered");
        // console.log(pc);

        callProgress()
    }

    const onICECandidate = (data) => {
        // console.log(data);
        console.log("GOT ICE candidate");

        let message = data.rtcMessage

        let candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });

        if (peerConnection) {
            console.log("ICE candidate Added");
            peerConnection.addIceCandidate(candidate);
        } else {
            console.log("ICE candidate Pushed");
            iceCandidatesFromCaller.push(candidate);
        }

    }

}
function sendCall(data) {
    callSocket.send(JSON.stringify({
        type: 'call',
        data
    }));

    document.getElementById("call").style.display = "none";
    // document.getElementById("otherUserNameCA").innerHTML = otherUser;
    document.getElementById("calling").style.display = "block";
}
function answerCall(data) {
    callSocket.send(JSON.stringify({
        type: 'answer_call',
        data
    }));
    callProgress();
}

function sendICEcandidate(data) {
    console.log("Send ICE candidate");
    callSocket.send(JSON.stringify({
        type: 'ICEcandidate',
        data
    }));

}

function beReady() {
    return navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    })
        .then(stream => {
            localStream = stream;
            localVideo.srcObject = stream;

            return createConnectionAndAddStream()
        })
        .catch(function (e) {
            alert('getUserMedia() error: ' + e.name);
        });
}

function createConnectionAndAddStream() {
    createPeerConnection();
    peerConnection.addStream(localStream);
    return true;
}

function processCall(userName) {
    peerConnection.createOffer((sessionDescription) => {
        peerConnection.setLocalDescription(sessionDescription);
        sendCall({
            name: userName,
            rtcMessage: sessionDescription
        })
    }, (error) => {
        console.log("Error");
    });
}

function processAccept() {
    peerConnection.setRemoteDescription(new RTCSessionDescription(remoteRTCMessage));
    peerConnection.createAnswer((sessionDescription) => {
        peerConnection.setLocalDescription(sessionDescription);

        if (iceCandidatesFromCaller.length > 0) {
            for (let i = 0; i < iceCandidatesFromCaller.length; i++) {
                let candidate = iceCandidatesFromCaller[i];
                console.log("ICE candidate Added From queue");
                try {
                    peerConnection.addIceCandidate(candidate).then(done => {
                        console.log(done);
                    }).catch(error => {
                        console.log(error);
                    })
                } catch (error) {
                    console.log(error);
                }
            }
            iceCandidatesFromCaller = [];
            console.log("ICE candidate queue cleared");
        } else {
            console.log("NO Ice candidate in queue");
        }

        answerCall({
            caller: otherUser,
            rtcMessage: sessionDescription
        })

    }, (error) => {
        console.log("Error");
    })
}

/////////////////////////////////////////////////////////

function createPeerConnection() {
    try {
        peerConnection = new RTCPeerConnection(pcConfig);
        // peerConnection = new RTCPeerConnection();
        peerConnection.onicecandidate = handleIceCandidate;
        peerConnection.onaddstream = handleRemoteStreamAdded;
        peerConnection.onremovestream = handleRemoteStreamRemoved;
        console.log('Created RTCPeerConnnection');
        return;
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

function handleIceCandidate(event) {
    // console.log('icecandidate event: ', event);
    if (event.candidate) {
        console.log("Local ICE candidate");
        // console.log(event.candidate.candidate);

        sendICEcandidate({
            user: otherUser,
            rtcMessage: {
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            }
        })

    } else {
        console.log('End of candidates.');
    }
}

function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
}

window.onbeforeunload = function () {
    if (callInProgress) {
        stop();
    }
};


function stop() {
    localStream.getTracks().forEach(track => track.stop());
    callInProgress = false;
    peerConnection.close();
    peerConnection = null;
    document.getElementById("call").style.display = "block";
    document.getElementById("answer").style.display = "none";
    document.getElementById("inCall").style.display = "none";
    document.getElementById("calling").style.display = "none";
    document.getElementById("videos").style.display = "none";
    document.getElementById("controls").style.display = "none";
    document.getElementById("calloff").style.display = "none"
    document.getElementById("userInfo").style.display = "block";
    otherUser = null;
}

function callProgress() {
    document.getElementById("videos").style.display = "block";
    document.getElementById("userInfo").style.display = "none";
    document.getElementById("controls").style.display = "block";
    document.getElementById("calloff").style.display = "block";
    // document.getElementById("otherUserNameC").innerHTML = otherUser;
    document.getElementById("inCall").style.display = "block";
    callInProgress = true;
}
let mutene = document.getElementById('mutene');
let videone = document.getElementById('videone');

mutene.addEventListener('click', toggleMute);
videone.addEventListener('click', toggleVideo);

// function toggleMute() {
//     let tracks = localStream.getAudioTracks();
//     tracks.forEach(track => {
//         track.enabled = !track.enabled; // Bật hoặc tắt âm thanh
//     });
// }

// function toggleVideo() {
//     let tracks = localStream.getVideoTracks();
//     tracks.forEach(track => {
//         track.enabled = !track.enabled; // Bật hoặc tắt video
//     });
// }
function toggleMute() {
    let tracks = localStream.getAudioTracks();
    tracks.forEach(track => {
        track.enabled = !track.enabled; // Bật hoặc tắt âm thanh
    });

    // Cập nhật giao diện người dùng
    if (tracks[0].enabled) {
        document.getElementById('mutene').src = "/static/assets/images/unmute.jpg";
    } else {
        document.getElementById('mutene').src = "/static/assets/images/mute.jpg";
    }
}

function toggleVideo() {
    let tracks = localStream.getVideoTracks();
    tracks.forEach(track => {
        track.enabled = !track.enabled; // Bật hoặc tắt video
    });

    // Cập nhật giao diện người dùng
    if (tracks[0].enabled) {
        document.getElementById('videone').src = "/static/assets/images/unvideo.jpg";
    } else {
        document.getElementById('videone').src = "/static/assets/images/video.jpg";
    }
}
//phần chạy khởi tạo ban đầu

document.getElementById("call").style.display = "none";
document.getElementById("answer").style.display = "none";
document.getElementById("inCall").style.display = "none";
document.getElementById("calling").style.display = "none";
document.getElementById("videos").style.display = "none";
document.getElementById("controls").style.display = "none";
document.getElementById("calloff").style.display = "none";
document.getElementById("userInfo").style.display = "block";
connectSocket();