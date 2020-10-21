import React, { useState, useEffect, useRef } from "react";
import $ from "jquery";
import { Container, Row, Col, Button, Alert } from "reactstrap";

const ROOM_NAME = "somerandomroomname";
const DISPLAY_NAME = "Participant - " + Math.floor(Date.now() / 1000);

// Lib-jitsi-meet requires jquery as global object
window.$ = $;

function OldApp() {
  const [msgs, setMsgs] = useState([]);
  const [localTracks, setLocalTracks] = useState([]);
  const [
    jitsiServerConnectionSuccess,
    setJitsiServerConnectionSuccess,
  ] = useState(false);
  const [
    jitsiServerConnectionFailure,
    setJitsiServerConnectionFailure,
  ] = useState(false);
  const [jitsiServerDisconnected, setJitsiServerDisconnected] = useState(false);
  const [joinConferenceRoom, setJoinConferenceRoom] = useState(false);
  const [leaveConferenceRoom, setLeaveConferenceRoom] = useState(false);
  const [deviceList, setDeviceList] = useState([]);
  const [error, setError] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState({});
  const [remoteVideoTracks, setRemoteVideoTracks] = useState([]);
  const [remoteAudioTracks, setRemoteAudioTracks] = useState([]);
  const [showDesktop, setShowDesktop] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(null);
  const connection = useRef(null);
  const conferenceRoom = useRef(null);
  const videoElement = useRef(null);
  const initialJoin = useRef(true);

  useEffect(() => {
    if (!window.JitsiMeetJS) {
      setError(
        "JitsiMeetJS is not available. Please check if lib-jitsi-meet is included in index.html file"
      );
    } else if (!window.config) {
      setError(
        "Video conference config is not available. Please check if config.js is included in index.html file"
      );
    } else {
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
      connection.current = new JitsiMeetJS.JitsiConnection(null, null, config);
      console.log("[LOG]Connection", connection);
      connection.current.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        () => setJitsiServerConnectionSuccess(true)
      );
      connection.current.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_FAILED,
        () => setJitsiServerConnectionFailure(true)
      );
      connection.current.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
        () => setJitsiServerDisconnected(true)
      );
      JitsiMeetJS.mediaDevices.addEventListener(
        JitsiMeetJS.events.mediaDevices.DEVICE_LIST_CHANGED,
        (devices) => setDeviceList(devices)
      );
      addMsg("Connecting to video conference server...");
      connection.current.connect();
      setShowDesktop(false);
    }
  }, []);

  useEffect(() => {
    if (showDesktop !== null) {
      const { JitsiMeetJS } = window;
      setPermissionDenied(null);
      if (showDesktop) {
        JitsiMeetJS.createLocalTracks({ devices: ["desktop"] })
          .then((tracks) => {
            JitsiMeetJS.mediaDevices.enumerateDevices((devices) =>
              console.log("[LOG]Desktop Devices: ", devices)
            );
            console.log("[LOG]Desktop Tracks: ", tracks);
            setPermissionDenied(false);
            setLocalTracks(tracks);
          })
          .catch((error) => {
            console.log("[ERROR]Desktop Tracks: ", error);
            setPermissionDenied(true);
            if (conferenceRoom.current) {
              let temp = conferenceRoom.current.getLocalVideoTrack();
              if (temp) {
                conferenceRoom.current.removeTrack(temp);
                temp.dispose();
              }
              temp = conferenceRoom.current.getLocalAudioTrack();
              if (temp) {
                conferenceRoom.current.removeTrack(temp);
                temp.dispose();
              }
            }
            setError("Permission was denied for accessing desktop screen");
          });
      } else {
        JitsiMeetJS.createLocalTracks({ devices: ["audio", "video"] })
          .then((tracks) => {
            JitsiMeetJS.mediaDevices.enumerateDevices((devices) =>
              console.log("[LOG]Devices: ", devices)
            );
            console.log("[LOG]Tracks: ", tracks);
            setPermissionDenied(false);
            setLocalTracks(tracks);
          })
          .catch((error) => {
            console.log("[ERROR]Tracks: ", error);
            JitsiMeetJS.mediaDevices.enumerateDevices((devices) =>
              console.log("[ERROR]Devices: ", devices)
            );
            setPermissionDenied(true);
            if (conferenceRoom.current) {
              let temp = conferenceRoom.current.getLocalVideoTrack();
              if (temp) {
                conferenceRoom.current.removeTrack(temp);
                temp.dispose();
              }
              temp = conferenceRoom.current.getLocalAudioTrack();
              if (temp) {
                conferenceRoom.current.removeTrack(temp);
                temp.dispose();
              }
            }
            setError(
              "Permission was either denied for accessing audio/video devices or devices were not detected"
            );
          });
      }
    }
  }, [showDesktop]);

  useEffect(() => {
    if (jitsiServerConnectionSuccess) {
      setMsgs(["Connection successful"]);
      console.log("[INIT]Jitsi Conference Success");
      initConferenceRoom();
    }
  }, [jitsiServerConnectionSuccess]);

  useEffect(() => {
    if (jitsiServerConnectionFailure) {
      setMsgs(["Connection failure"]);
      console.log("[INIT]Jitsi Conference Failure");
      initConferenceRoom();
    }
  }, [jitsiServerConnectionFailure]);

  useEffect(() => {
    if (jitsiServerDisconnected) {
      addMsg("Disconnected");
      console.log("[INIT]Jitsi Conference Disconnected");
    }
  }, [jitsiServerDisconnected]);

  useEffect(() => {
    if (localTracks.length !== 0) {
      const { JitsiMeetJS } = window;
      for (let i = 0; i < localTracks.length; i++) {
        localTracks[i].addEventListener(
          JitsiMeetJS.events.track.TRACK_AUDIO_LEVEL_CHANGED,
          (audioLevel) => console.log(`Audio Level local: ${audioLevel}`)
        );
        localTracks[i].addEventListener(
          JitsiMeetJS.events.track.TRACK_MUTE_CHANGED,
          () => console.log("Local track muted")
        );
        localTracks[i].addEventListener(
          JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED,
          () => console.log("Local track stopped")
        );
        localTracks[i].addEventListener(
          JitsiMeetJS.events.track.TRACK_AUDIO_OUTPUT_CHANGED,
          (deviceId) =>
            console.log(`Track audio output device was changed to ${deviceId}`)
        );
        if (localTracks[i].getType() !== "audio") {
          localTracks[i].attach(videoElement.current);
        }
      }
    }
  }, [localTracks]);

  useEffect(() => {
    if (
      joinConferenceRoom &&
      conferenceRoom.current &&
      conferenceRoom.current.isJoined
    ) {
      if (initialJoin.current) {
        // This is the first time setting up tracks hence add all tracks to remote
        setMsgs([`Joined conference room ${ROOM_NAME}`]);
        initialJoin.current = false;
      }
      for (let i = 0; i < localTracks.length; i++) {
        let oldTrack = null;
        if (localTracks[i].getType() === "video") {
          if (localTracks[i].isMuted()) {
            localTracks[i].unmute();
          }
          oldTrack = conferenceRoom.current.getLocalVideoTrack();
        } else {
          oldTrack = conferenceRoom.current.getLocalAudioTrack();
        }
        if (oldTrack) {
          // Replace old track with new track in the conference room and dispose old track
          conferenceRoom.current
            .replaceTrack(oldTrack, localTracks[i])
            .then(() => oldTrack.dispose());
        } else {
          conferenceRoom.current.addTrack(localTracks[i]);
        }
      }
    }
  }, [joinConferenceRoom, localTracks]);

  useEffect(() => {
    if (leaveConferenceRoom && conferenceRoom.current) {
      conferenceRoom.current.leave();
    }
  }, [leaveConferenceRoom]);

  useEffect(() => {
    if (deviceList.length !== 0) {
      console.log(`Device list changed. Detected ${deviceList.length} devices`);
    }
  }, [deviceList]);

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

  function addMsg(msg) {
    setMsgs((prevMsgs) => [...prevMsgs, msg]);
  }

  function initConferenceRoom() {
    const confOptions = {
      openBridgeChannel: true,
    };
    const { JitsiMeetJS } = window;
    conferenceRoom.current = connection.current.initJitsiConference(
      ROOM_NAME,
      confOptions
    );
    console.log("[LOG]Conference Room: ", conferenceRoom);
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_ADDED,
      (track) => {
        console.log(`Track added - ${track}`);
        if (!track.isLocal()) {
          if (track.getType() === "video") {
            setRemoteVideoTracks((prevRemoteVideoTracks) => [
              ...prevRemoteVideoTracks,
              track,
            ]);
          }
          if (track.getType() === "audio") {
            setRemoteAudioTracks((prevRemoteAudioTracks) => [
              ...prevRemoteAudioTracks,
              track,
            ]);
          }
        }
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_REMOVED,
      (track) => {
        console.log(`Track removed - ${track}`);
        if (!track.isLocal()) {
          if (track.getType() === "video") {
            setRemoteVideoTracks((prevRemoteVideoTracks) => {
              const temp = prevRemoteVideoTracks.filter(
                (_track) => _track.getId() !== track.getId()
              );
              return temp;
            });
          }
          if (track.getType() === "audio") {
            setRemoteAudioTracks((prevRemoteAudioTracks) => {
              const temp = prevRemoteAudioTracks.filter(
                (_track) => _track.getId() !== track.getId()
              );
              return temp;
            });
          }
        }
      }
    );
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
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.CONFERENCE_JOINED,
      () => {
        setJoinConferenceRoom(true);
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.USER_JOINED,
      (participantId) => {
        console.log(`User joined ${participantId}`);
        setRemoteTracks((prevRemoteTracks) => {
          return {
            ...prevRemoteTracks,
            [participantId]: {
              audio: null,
              video: null,
              displayName: conferenceRoom.current.getParticipantById(
                participantId
              )._displayName,
            },
          };
        });
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.USER_LEFT,
      (participantId) => {
        setRemoteTracks((prevRemoteTracks) => {
          delete prevRemoteTracks[participantId];
          return { ...prevRemoteTracks };
        });
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_MUTE_CHANGED,
      (track) => {
        console.log(`${track.getType()} - ${track.isMuted()}`);
      }
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED,
      (userID, displayName) => console.log(`${userID} - ${displayName}`)
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED,
      (userID, audioLevel) => console.log(`${userID} - ${audioLevel}`)
    );
    conferenceRoom.current.on(
      JitsiMeetJS.events.conference.PHONE_NUMBER_CHANGED,
      () =>
        console.log(
          `${conferenceRoom.current.getPhoneNumber()} - ${conferenceRoom.current.getPhonePin()}`
        )
    );
    setMsgs([`Joining conference room ${ROOM_NAME}`]);
    conferenceRoom.current.setDisplayName(DISPLAY_NAME);
    conferenceRoom.current.join();
  }

  function toggleDesktopSharing() {
    setShowDesktop((prevShowDesktop) => !prevShowDesktop);
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

export default OldApp;
