/* eslint-disable react-hooks/exhaustive-deps */
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
  const [localTracks, setLocalTracks] = useState([]);
  const [remoteTracks, setRemoteTracks] = useState([]);
  const [members, setMembers] = useState([]);

  // eslint-disable-next-line no-unused-vars
  const [showDesktop, setShowDesktop] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(null);
  const [muteAudio, setMuteAudio] = useState(false);
  const [muteVideo, setMuteVideo] = useState(false);
  const videoElement = useRef(null);

  const connection = useRef(null);
  const conferenceRoom = useRef(null);

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
  }
  function handleConnectionEstablished() {
    setMsgs(["Connection successful"]);
    initConferenceRoom();
  }
  function initConferenceRoom() {
    const { JitsiMeetJS } = window;
    setupJitsiConference();
    setupConferenceHandlers(JitsiMeetJS);
    setupErrorHandlers(JitsiMeetJS);
    setMsgs([`Joining conference room ${ROOM_NAME}`]);
    conferenceRoom.current.setDisplayName(DISPLAY_NAME);
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
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_ADDED,
      handleTrackAdded
    );
  }
  function handleConferenceJoined() {
    setMsgs([`Joined conference room ${ROOM_NAME}`]);
    const { JitsiMeetJS } = window;
    JitsiMeetJS.createLocalTracks({ devices: ["audio", "video"] })
      .then((tracks) => {
        setPermissionDenied(false);
        setLocalTracks(tracks);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  useEffect(() => {
    if (localTracks.length === 0) return;
    for (let i = 0; i < localTracks.length; i++) {
      if (localTracks[i].getType() !== "audio") {
        localTracks[i].attach(videoElement.current);
      }
      conferenceRoom.current.addTrack(localTracks[i]);
    }
  }, [localTracks]);
  function handleUserJoined(memberId) {
    console.log(memberId);
    const member = {
      id: memberId,
      audio: null,
      video: null,
      displayName: conferenceRoom.current.getParticipantById(memberId)
        ._displayName,
    };
    setMembers((prev) => [...prev, member]);
  }
  function handleUserLeft(memberId) {
    const updatedMembers = members.filter((member) => member.id !== memberId);
    setMembers(updatedMembers);
  }

  function handleTrackAdded(track) {
    console.log(track);
    if (track.isLocal()) return;
    setRemoteTracks((prev) => [...prev, track]);
  }
  useEffect(() => {
    const updatedMembers = [...members];
    console.log("[EFFECT]", updatedMembers);
    for (let i = 0; i < updatedMembers.length; i++) {
      for (let j = 0; j < remoteTracks.length; j++) {
        if (updatedMembers[i].id === remoteTracks[j].getParticipantId()) {
          if (remoteTracks[j].getType() === "audio")
            updatedMembers[i].audio = remoteTracks[j];
          else updatedMembers[i].video = remoteTracks[j];
        }
      }
    }
    setMembers(updatedMembers);
  }, [remoteTracks]);

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

  function addMsg(msg) {
    setMsgs((prevMsgs) => [...prevMsgs, msg]);
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
          <Button onClick={() => {}}>
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
        {members.map((member, id) => {
          return (
            <Col sm={3} xs={12} key={`col-${id + 1}`}>
              <b>{member.displayName}</b>
              <br />
              {member.video ? (
                <video
                  style={{ paddingLeft: 0, paddingRight: 0 }}
                  className="col-sm-12"
                  ref={(ref) => ref && member.video.attach(ref)}
                  autoPlay="1"
                  key={`video-track-${id}`}
                />
              ) : (
                "No video track received"
              )}
              {member.audio && (
                <audio
                  ref={(ref) => ref && member.audio.attach(ref)}
                  autoPlay="1"
                  key={`audio-track-${id}`}
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
