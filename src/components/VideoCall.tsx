import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { PhoneOff, Video, VideoOff, Mic, MicOff, Maximize, Minimize, Monitor, MonitorOff } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  collectionGroup
} from 'firebase/firestore';

interface VideoCallProps {
  remoteUserId?: string;
  remoteUserName?: string;
  isIncoming?: boolean;
  onEnd: () => void;
  callId?: string;
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export const VideoCall: React.FC<VideoCallProps> = ({ 
  remoteUserId, 
  remoteUserName, 
  isIncoming = false, 
  onEnd,
  callId: initialCallId
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection>(new RTCPeerConnection(servers));
  const callIdRef = useRef<string | null>(initialCallId || null);

  const toggleScreenShare = async () => {
    if (!pc.current || !localStream) return;

    try {
      if (!isScreenSharing) {
        // Start screen share
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace the video track in the peer connection
        const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Handle native "stop sharing" button
        screenTrack.onended = () => {
          stopScreenShare(screenTrack);
        };

        setIsScreenSharing(true);
      } else {
        // Stop screen share will be handled by our helper
        const videoTrack = localStream.getVideoTracks()[0];
        const screenTrack = (localVideoRef.current?.srcObject as MediaStream)?.getVideoTracks()[0];
        if (screenTrack) {
          stopScreenShare(screenTrack);
        }
      }
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = (screenTrack: MediaStreamTrack) => {
    screenTrack.stop();
    
    // Switch back to camera track
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack && pc.current) {
      const sender = pc.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }
    setIsScreenSharing(false);
  };

  useEffect(() => {
    const startCall = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach((track) => {
        pc.current.addTrack(track, stream);
      });

      pc.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          if (!remoteStream) {
             const newRemoteStream = new MediaStream();
             newRemoteStream.addTrack(track);
             setRemoteStream(newRemoteStream);
             if (remoteVideoRef.current) remoteVideoRef.current.srcObject = newRemoteStream;
          } else {
             remoteStream.addTrack(track);
          }
        });
      };

      if (!isIncoming) {
        // Create call
        const callDoc = doc(collection(db, 'calls'));
        callIdRef.current = callDoc.id;

        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        pc.current.onicecandidate = (event) => {
          event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
        };

        const offerDescription = await pc.current.createOffer();
        await pc.current.setLocalDescription(offerDescription);

        const offer = {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        };

        await setDoc(callDoc, { 
          offer, 
          callerId: auth.currentUser?.uid, 
          receiverId: remoteUserId,
          status: 'incoming'
        });

        onSnapshot(callDoc, (snapshot) => {
          const data = snapshot.data();
          if (!pc.current.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.current.setRemoteDescription(answerDescription);
            setCallStatus('active');
          }
          if (data?.status === 'ended') {
            handleEndCall();
          }
        });

        onSnapshot(answerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              pc.current.addIceCandidate(new RTCIceCandidate(data));
            }
          });
        });
      } else if (initialCallId) {
        // Answer call
        const callDoc = doc(db, 'calls', initialCallId);
        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        pc.current.onicecandidate = (event) => {
          event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
        };

        const callData = (await getDoc(callDoc)).data();

        const offerDescription = callData?.offer;
        await pc.current.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answerDescription);

        const answer = {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        };

        await updateDoc(callDoc, { answer, status: 'active' });
        setCallStatus('active');

        onSnapshot(offerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              pc.current.addIceCandidate(new RTCIceCandidate(data));
            }
          });
        });

        onSnapshot(callDoc, (snapshot) => {
          const data = snapshot.data();
          if (data?.status === 'ended') {
            handleEndCall();
          }
        });
      }
    };

    startCall().catch(console.error);

    return () => {
      handleEndCall();
    };
  }, []);

  const handleEndCall = async () => {
    localStream?.getTracks().forEach(track => track.stop());
    pc.current.close();
    if (callIdRef.current) {
      await updateDoc(doc(db, 'calls', callIdRef.current), { status: 'ended' });
    }
    onEnd();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks()[0].enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
      <div className="max-w-6xl w-full aspect-video bg-gray-900 rounded-3xl overflow-hidden relative shadow-2xl flex border border-gray-800">
        
        {/* Remote Video */}
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        {/* Local Video Overlay */}
        <div className="absolute top-6 right-6 w-1/4 aspect-video bg-gray-800 rounded-2xl overflow-hidden shadow-lg border border-gray-700">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoOff className="text-gray-500" size={32} />
            </div>
          )}
        </div>

        {/* Remote Info Overlay */}
        <div className="absolute top-6 left-6 p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
          <h3 className="text-white font-bold">{remoteUserName || 'User'}</h3>
          <p className="text-white/60 text-xs flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${callStatus === 'active' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
            {callStatus === 'active' ? 'Call Active' : 'Connecting...'}
          </p>
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
          <button 
            onClick={toggleMute}
            className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <button 
            onClick={handleEndCall}
            className="p-5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-lg hover:scale-105 active:scale-95"
          >
            <PhoneOff size={28} />
          </button>

          <button 
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
          
          <button 
            onClick={toggleScreenShare}
            className={`p-4 rounded-full transition-all ${isScreenSharing ? 'bg-blue-500 text-white animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'}`}
            title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
          >
            {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
          </button>
        </div>
      </div>
    </div>
  );
};
