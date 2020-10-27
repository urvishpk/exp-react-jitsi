/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import $ from "jquery";
import { Container, Row, Col, Button, Alert } from "reactstrap";

const ROOM_NAME = "somerandomroomname404";
const DISPLAY_NAME = "Participant - " + Math.floor(Date.now() / 1000);

// Lib-jitsi-meet requires jquery as global object
window.$ = $;

function App() {
  const [error, setError] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [members, setMembers] = useState({});
  const [remoteTracks, setRemoteTracks] = useState([]);

  const [permissionDenied, setPermissionDenied] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
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
  async function handleConferenceJoined() {
    setMsgs([`Joined conference room ${ROOM_NAME}`]);
    const { JitsiMeetJS } = window;
    try {
      const tracks = await JitsiMeetJS.createLocalTracks({
        devices: ["audio", "video"],
        resolution: "vga",
      });
      setPermissionDenied(false);
      if (tracks.length === 0) return;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].getType() === "video")
          tracks[i].attach(videoElement.current);
        conferenceRoom.current.addTrack(tracks[i]);
      }
    } catch (err) {
      console.log(err);
    }
  }
  function handleUserJoined(memberId) {
    if (members[memberId]) return;
    const displayName = conferenceRoom.current.getParticipantById(memberId)
      ._displayName;
    createAndAddMember(memberId, displayName);
  }
  function handleUserLeft(memberId) {
    removeMember(memberId);
  }
  function removeMember(id) {
    setMembers((prev) => {
      delete prev[id];
      return { ...prev };
    });
  }
  function handleTrackAdded(track) {
    if (track.isLocal()) return;
    setRemoteTracks((prev) => [...prev, track]);
  }
  useEffect(() => {
    for (let i = 0; i < remoteTracks.length; i++) {
      const track = remoteTracks[i];
      const id = track.getParticipantId();
      if (members[id]) {
        if (track.getType() === "audio") updateMember(id, track);
        else updateMember(id, null, track);
      }
    }
  }, [remoteTracks]);
  function createAndAddMember(id, displayName) {
    const member = { displayName };
    setMembers((prev) => ({ ...prev, [id]: member }));
  }
  function updateMember(id, audio = null, video = null) {
    const updatedMembers = members;
    if (audio) updatedMembers[id].audio = audio;
    if (video) updatedMembers[id].video = video;
    setMembers(updatedMembers);
  }
  useEffect(() => {
    const updatedMembers = members;
    Object.keys(updatedMembers).forEach((id) => {
      if (
        updatedMembers[id].audio &&
        updatedMembers[id].audio.containers.length === 0 &&
        document.getElementById(`audio-${id}`)
      )
        updatedMembers[id].audio.attach(document.getElementById(`audio-${id}`));
      if (
        updatedMembers[id].video &&
        updatedMembers[id].video.containers.length === 0 &&
        document.getElementById(`video-${id}`)
      )
        updatedMembers[id].video.attach(document.getElementById(`video-${id}`));
    });
    setMembers(updatedMembers);
  });

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

  // UI interactions and updates
  function addMsg(msg) {
    setMsgs((prevMsgs) => [...prevMsgs, msg]);
  }
  function toggleAudio() {
    const tracks = conferenceRoom.current.getLocalTracks();
    tracks.forEach((track) => {
      if (track.getType() === "audio") {
        track.isMuted() ? track.unmute() : track.mute();
        setIsAudioMuted(track.isMuted());
      }
    });
  }
  function toggleVideo() {
    const tracks = conferenceRoom.current.getLocalTracks();
    tracks.forEach((track) => {
      if (track.getType() === "video") {
        setIsVideoMuted(!track.isMuted());
        track.isMuted() ? track.unmute() : track.mute();
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
          <b>My Cam</b>
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
          <br />
          <br />
          <Button onClick={toggleAudio}>
            {isAudioMuted ? "Unmute" : "Mute"} Audio
          </Button>
          <br />
          <br />
          <Button onClick={toggleVideo}>
            {isVideoMuted ? "Unmute" : "Mute"} Video
          </Button>
        </Col>
        {Object.keys(members).map((id) => {
          console.log("[RENDER]", members[id]);
          return (
            <Col sm={3} xs={12} key={`col-${id}`}>
              <b>{members[id].displayName}</b>
              <br />
              <audio
                id={`audio-${id}`}
                autoPlay="1"
                key={`audio-track-${id}`}
              />
              <video
                id={`video-${id}`}
                style={{ paddingLeft: 0, paddingRight: 0 }}
                className="col-sm-12"
                autoPlay="1"
                key={`video-track-${id}`}
              />
            </Col>
          );
        })}
      </Row>
    </Container>
  );
}

export default App;
