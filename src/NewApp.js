import React, { useState, useEffect, useRef } from "react";
import $ from "jquery";
import { Container, Row, Col, Button, Alert } from "reactstrap";

const ROOM_NAME = "somerandomroomname";
const DISPLAY_NAME = "Participant - " + Math.floor(Date.now() / 1000);

// Lib-jitsi-meet requires jquery as global object
window.$ = $;

function App() {
  const [error, setError] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [showDesktop, setShowDesktop] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState({});
  const [muteAudio, setMuteAudio] = useState(false);
  const [muteVideo, setMuteVideo] = useState(false);
  const videoElement = useRef(null);

  const [localTracks, setLocalTracks] = useState([]);
  const [deviceList, setDeviceList] = useState([]);
  const [remoteVideoTracks, setRemoteVideoTracks] = useState([]);
  const [remoteAudioTracks, setRemoteAudioTracks] = useState([]);
  const connection = useRef(null);
  const conferenceRoom = useRef(null);
  const initialJoin = useRef(true);

  useEffect(() => {
    if (!window.JitsiMeetJS) {
      setError(
        "JitsiMeetJS is not available. Please check if lib-jitsi-meet is included in index.html file"
      );
      return;
    }
    if (!window.config) {
      setError(
        "Video conference config is not available. Please check if config.js is included in index.html file"
      );
      return;
    }
    const { JitsiMeetJS, config } = initializeJitsiMeetJS();
    initializeConnection(JitsiMeetJS, config);
    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function initializeJitsiMeetJS() {
    const { JitsiMeetJS, config } = window;
    let serviceUrl = config.websocket || config.bosh;
    serviceUrl += `?room=${ROOM_NAME}`;
    config.serviceUrl = config.bosh = serviceUrl;
    const initOptions = {
      disableAudioLevels: true,
    };
    // Jitsi will show logs as errors
    JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.ERROR);
    JitsiMeetJS.init(initOptions);
    return { JitsiMeetJS, config };
  }
  function initializeConnection(JitsiMeetJS, config) {
    connection.current = new JitsiMeetJS.JitsiConnection(null, null, config);
    setupConnectionListeners(JitsiMeetJS);
    addMsg("Connecting to video conference server...");
    connection.current.connect();
  }
  function setupConnectionListeners(JitsiMeetJS) {
    connection.current.addEventListener(
      JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
      handleConnectionEstablished
    );
    connection.current.addEventListener(
      JitsiMeetJS.events.connection.CONNECTION_FAILED,
      handleConnectionFailure
    );
    connection.current.addEventListener(
      JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
      handleConnectionDisconnected
    );
    JitsiMeetJS.mediaDevices.addEventListener(
      JitsiMeetJS.events.mediaDevices.DEVICE_LIST_CHANGED,
      handleDeviceListChanged
    );
  }
  function handleConnectionEstablished() {
    setMsgs(["Connection successful"]);
    initConferenceRoom();
  }
  function initConferenceRoom() {
    const { JitsiMeetJS } = window;
    setupJitsiConference();
    setupConferenceHandlers(JitsiMeetJS);
    setupUserAndTrackHandlers(JitsiMeetJS);
    setupErrorHandlers(JitsiMeetJS);
    setMsgs([`Joining conference room ${ROOM_NAME}`]);
    conferenceRoom.current.setDisplayName(DISPLAY_NAME);
    conferenceRoom.current.setStartMutedPolicy({ audio: true, video: false });
    conferenceRoom.current.join();
  }
  function setupJitsiConference() {
    const confOptions = {
      openBridgeChannel: true,
    };
    conferenceRoom.current = connection.current.initJitsiConference(
      ROOM_NAME,
      confOptions
    );
  }
  function setupConferenceHandlers(JitsiMeetJS) {
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.CONFERENCE_JOINED,
      handleConferenceJoined
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.USER_JOINED,
      handleUserJoined
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.USER_LEFT,
      handleUserLeft
    );
  }
  function handleConferenceJoined() {
    if (!conferenceRoom.current || !conferenceRoom.current.isJoined) return;
    if (initialJoin.current) {
      // This is the first time setting up tracks hence add all tracks to remote
      setMsgs([`Joined conference room ${ROOM_NAME}`]);
      initialJoin.current = false;
    }
    setShowDesktop(false);
  }
  function handleUserJoined(participantId) {
    console.log(`User joined ${participantId}`);
    setRemoteTracks((prevRemoteTracks) => {
      return {
        ...prevRemoteTracks,
        [participantId]: {
          audio: null,
          video: null,
          displayName: conferenceRoom.current.getParticipantById(participantId)
            ._displayName,
        },
      };
    });
  }
  function handleUserLeft(participantId) {
    setRemoteTracks((prevRemoteTracks) => {
      delete prevRemoteTracks[participantId];
      return { ...prevRemoteTracks };
    });
  }
  function setupUserAndTrackHandlers(JitsiMeetJS) {
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_ADDED,
      handleTrackAdded
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_REMOVED,
      handleTrackRemoved
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED,
      (track) => {
        console.log(`${track.getType()} - ${track.isMuted()}`);
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED,
      (userID, audioLevel) => console.log(`${userID} - ${audioLevel}`)
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED,
      (userID, displayName) => console.log(`${userID} - ${displayName}`)
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.PHONE_NUMBER_CHANGED,
      () =>
        console.log(
          `${conferenceRoom.current.getPhoneNumber()} - ${conferenceRoom.current.getPhonePin()}`
        )
    );
  }
  function handleTrackAdded(track) {
    console.log(`Track added - ${track}`);
    console.log("[TRACK ADDED]", track);
    if (track.isLocal()) return;
    if (track.getType() === "video") addVideoTrack(track);
    if (track.getType() === "audio") addAudioTrack(track);
  }
  function addVideoTrack(track) {
    setRemoteVideoTracks((prev) => [...prev, track]);
  }
  function addAudioTrack(track) {
    setRemoteAudioTracks((prev) => [...prev, track]);
  }
  function handleTrackRemoved(track) {
    console.log(`Track removed - ${track}`);
    if (track.isLocal()) return;
    if (track.getType() === "video") removeVideoTrack(track);
    if (track.getType() === "audio") removeAudioTrack(track);
  }
  function removeVideoTrack(track) {
    setRemoteVideoTracks((prev) => {
      const tracks = prev.filter((t) => t.getId() !== track.getId());
      return tracks;
    });
  }
  function removeAudioTrack(track) {
    setRemoteAudioTracks((prev) => {
      const tracks = prev.filter((t) => t.getId() !== track.getId());
      return tracks;
    });
  }
  function setupErrorHandlers(JitsiMeetJS) {
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.CONNECTION_ERROR,
      () => {
        setMsgs([]);
        setError("Conference room connection error");
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.SETUP_FAILED,
      () => {
        setMsgs([]);
        setError("Conference room set up failed");
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.VIDEOBRIDGE_NOT_AVAILABLE,
      () => {
        setMsgs([]);
        setError("Conference room video bridge not available");
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.RESERVATION_ERROR,
      () => {
        setMsgs([]);
        setError("Conference room reservation error");
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.AUTHENTICATION_REQUIRED,
      () => {
        setError(
          "Conference room creation failed as authentication is required"
        );
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.JINGLE_FATAL_ERROR,
      (err) => {
        setMsgs([]);
        setError("Conference room creation failed due to jingle error");
        console.log(err);
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.PASSWORD_REQUIRED,
      () => {
        setMsgs([]);
        setError("Conference room join failed as password was required");
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.FOCUS_DISCONNECTED,
      () => {
        setMsgs([]);
        setError("Conference room focus disconnected");
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.CONFERENCE_ERROR,
      () => {
        setMsgs([]);
        setError("Conference room error");
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.CONFERENCE_FAILED,
      () => {
        setMsgs([]);
        setError("Conference room create/join failed");
      }
    );
  }
  function handleConnectionFailure() {
    setMsgs(["Connection failure"]);
  }
  function handleConnectionDisconnected() {
    addMsg("Disconnected");
  }
  function handleDeviceListChanged(devices) {
    setDeviceList(devices);
  }

  useEffect(() => {
    if (!conferenceRoom.current) return;
    if (localTracks.length === 0) return;
    const oldVideoTrack = conferenceRoom.current.getLocalVideoTrack();
    for (let i = 0; i < localTracks.length; i++) {
      console.log("[TYPE]", localTracks[i].getType());
      if (localTracks[i].getType() === "video") {
        localTracks[i].attach(videoElement.current);
        if (oldVideoTrack) {
          conferenceRoom.current
            .replaceTrack(oldVideoTrack, localTracks[i])
            .then(() => {
              oldVideoTrack.dispose();
              setShowDesktop(localTracks[i].videoType === "desktop");
            });
        } else {
          conferenceRoom.current.addTrack(localTracks[i]);
        }
      } else {
        if (!conferenceRoom.current.getLocalAudioTrack())
          conferenceRoom.current.addTrack(localTracks[i]);
      }
    }
  }, [localTracks]);

  useEffect(() => {
    let remoteTracks = {};
    for (let i = 0; i < remoteVideoTracks.length; i++) {
      if (
        !conferenceRoom.current.getParticipantById(
          remoteVideoTracks[i].getParticipantId()
        )
      ) {
        continue;
      }
      if (!remoteTracks[remoteVideoTracks[i].getParticipantId()]) {
        remoteTracks[remoteVideoTracks[i].getParticipantId()] = {
          audio: null,
          video: null,
          displayName: conferenceRoom.current.getParticipantById(
            remoteVideoTracks[i].getParticipantId()
          )._displayName,
        };
      }
      remoteTracks[remoteVideoTracks[i].getParticipantId()][
        remoteVideoTracks[i].getType()
      ] = remoteVideoTracks[i];
    }
    for (let i = 0; i < remoteAudioTracks.length; i++) {
      if (
        !conferenceRoom.current.getParticipantById(
          remoteAudioTracks[i].getParticipantId()
        )
      ) {
        continue;
      }
      if (!remoteTracks[remoteAudioTracks[i].getParticipantId()]) {
        remoteTracks[remoteAudioTracks[i].getParticipantId()] = {
          audio: null,
          video: null,
          displayName: conferenceRoom.current.getParticipantById(
            remoteAudioTracks[i].getParticipantId()
          )._displayName,
        };
      }
      remoteTracks[remoteAudioTracks[i].getParticipantId()][
        remoteAudioTracks[i].getType()
      ] = remoteAudioTracks[i];
    }
    setRemoteTracks(remoteTracks);
  }, [remoteVideoTracks, remoteAudioTracks]);

  useEffect(() => {
    async function presentScreen() {
      const { JitsiMeetJS } = window;
      setPermissionDenied(null);
      const devices = showDesktop ? ["audio", "desktop"] : ["audio", "video"];
      try {
        const tracks = await JitsiMeetJS.createLocalTracks({ devices });
        setPermissionDenied(false);
        setLocalTracks(tracks);
      } catch (error) {
        setPermissionDenied(true);
        setError(
          "Permission was either denied for accessing audio/video devices or devices were not detected"
        );
        if (!conferenceRoom.current) return;
        const videoTrack = conferenceRoom.current.getLocalVideoTrack();
        removeTrack(videoTrack);
        const audioTrack = conferenceRoom.current.getLocalAudioTrack();
        removeTrack(audioTrack);
      }
    }
    function removeTrack(track) {
      if (!track) return;
      conferenceRoom.current.removeTrack(track);
      track.dispose();
    }
    if (showDesktop === null) return;
    presentScreen();
  }, [showDesktop]);

  useEffect(() => {
    if (deviceList.length !== 0) {
      console.log(`Device list changed. Detected ${deviceList.length} devices`);
    }
  }, [deviceList]);

  // User interactions
  function toggleDesktopSharing() {
    setShowDesktop((prevShowDesktop) => !prevShowDesktop);
  }
  function toggleAudio() {
    const tracks = localTracks;
    tracks.forEach((track) => {
      if (track.getType() === "audio") {
        muteAudio ? track.unmute() : track.mute();
        setMuteAudio((prev) => !prev);
      }
    });
    setLocalTracks(tracks);
  }
  function toggleVideo() {
    const tracks = localTracks;
    tracks.forEach((track) => {
      if (track.getType() === "video") {
        muteVideo ? track.unmute() : track.mute();
        setMuteVideo((prev) => !prev);
      }
    });
  }
  function addMsg(msg) {
    setMsgs((prevMsgs) => [...prevMsgs, msg]);
  }
  return (
    <Container>
      <h2>Jitsi Custom UI with React and lib-jitsi-meet</h2>
      {error && <Alert color="danger">{error}</Alert>}
      {msgs.map((msg) => {
        return <Alert color="info">{msg}</Alert>;
      })}
      <Row>
        <Col sm={3} xs={12}>
          <b>My {showDesktop ? "Screen Share" : "Cam"}</b>
          <br />
          {permissionDenied === null && (
            <small>
              <b>
                Waiting for device access permission...
                <br />
              </b>
            </small>
          )}
          {permissionDenied && (
            <small>
              <b>
                Preview cannot be displayed as permission is denied
                <br />
              </b>
            </small>
          )}
          {permissionDenied !== null && !permissionDenied ? (
            <video
              style={{ paddingLeft: 0, paddingRight: 0 }}
              className="col-sm-12"
              ref={videoElement}
              autoPlay="1"
            />
          ) : null}
          <br />
          <Button onClick={toggleDesktopSharing}>
            {showDesktop ? "Stop Sharing Desktop" : "Share Desktop"}
          </Button>
          <br />
          <br />
          <Button onClick={toggleAudio}>
            {muteAudio ? "Unmute" : "Mute"} Audio
          </Button>
          <br />
          <br />
          <Button onClick={toggleVideo}>
            {muteVideo ? "Unmute" : "Mute"} Video
          </Button>
        </Col>
        {Object.keys(remoteTracks).map((key) => {
          return (
            <Col sm={3} xs={12} key={`col-${key}`}>
              <b>{remoteTracks[key].displayName}</b>
              <br />
              {remoteTracks[key].video ? (
                <video
                  style={{ paddingLeft: 0, paddingRight: 0 }}
                  className="col-sm-12"
                  ref={(ref) => ref && remoteTracks[key].video.attach(ref)}
                  autoPlay="1"
                  key={`video-track-${key}`}
                />
              ) : (
                "No video track received"
              )}
              {remoteTracks[key].audio && (
                <audio
                  ref={(ref) => ref && remoteTracks[key].audio.attach(ref)}
                  autoPlay="1"
                  key={`audio-track-${key}`}
                />
              )}
            </Col>
          );
        })}
      </Row>
    </Container>
  );
}

export default App;
