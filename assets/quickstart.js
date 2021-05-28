$(function() {
  var speakerDevices = document.getElementById("speaker-devices");
  var ringtoneDevices = document.getElementById("ringtone-devices");
  var outputVolumeBar = document.getElementById("output-volume");
  var inputVolumeBar = document.getElementById("input-volume");
  var volumeIndicators = document.getElementById("volume-indicators");
  
  var device;
  let connection;

  log("Requesting Access Token...");
  // Using a relative link to access the Voice Token function
  $.getJSON("./voice-token")
    .then(function(data) {
      log("Got a token.");
      console.log("Token: " + data.token);

      let acceptIncomingCall = "pending";

      // Setup Twilio.Device
      device = new Twilio.Device(data.token, {
        // Set Opus as our preferred codec. Opus generally performs better, requiring less bandwidth and
        // providing better audio quality in restrained network conditions. Opus will be default in 2.0.
        codecPreferences: ["opus", "pcmu"],
        // Use fake DTMF tones client-side. Real tones are still sent to the other end of the call,
        // but the client-side DTMF tones are fake. This prevents the local mic capturing the DTMF tone
        // a second time and sending the tone twice. This will be default in 2.0.
        fakeLocalDTMF: true,
        // Use `enableRingingState` to enable the device to emit the `ringing`
        // state. The TwiML backend also needs to have the attribute
        // `answerOnBridge` also set to true in the `Dial` verb. This option
        // changes the behavior of the SDK to consider a call `ringing` starting
        // from the connection to the TwiML backend to when the recipient of
        // the `Dial` verb answers.
        enableRingingState: true,
        edge: 'sao-paulo',
      });

      device.on("ready", function(device) {
        log("Twilio.Device Ready!");
        document.getElementById("call-controls").style.display = "block";
      });

      device.on("error", function(error) {
        log("Twilio.Device Error: " + error.message);
      });

      device.on("connect", function(conn) {
        log("Successfully established call!");
        document.getElementById("button-call").style.display = "none";
        document.getElementById("button-hangup").style.display = "inline";
        document.getElementById("button-accept").style.display = "none";
        document.getElementById("button-reject").style.display = "none";
        volumeIndicators.style.display = "block";
        bindVolumeIndicators(conn);
      });

      device.on("disconnect", function(conn) {
        log("Call ended.");
        document.getElementById("button-call").style.display = "inline";
        document.getElementById("button-hangup").style.display = "none";
        volumeIndicators.style.display = "none";
      });

      device.on("incoming", function(conn) {
        connection = conn;
        log("Incoming connection from " + conn.parameters.From);
        document.getElementById("button-accept").style.display = "inline";
        document.getElementById("button-reject").style.display = "inline";
      });

      setClientNameUI(data.identity);

      device.audio.on("deviceChange", updateAllDevices.bind(device));

      // Show audio selection UI if it is supported by the browser.
      if (device.audio.isOutputSelectionSupported) {
        document.getElementById("output-selection").style.display = "block";
      }
    })
    .catch(function(err) {
      console.log(err);
      log("Could not get a token from server!");
    });

  // update connection choice to accept incoming call
  function acceptCall() {
    connection.accept();
  }

  // update connection choice to reject incoming call
  function rejectCall() {
    connection.reject();
  }

  // Bind button to make call
  document.getElementById("button-call").onclick = function() {
    // get the phone number to connect the call to
    var params = {
      To: document.getElementById("phone-number").value
    };

    console.log("Calling " + params.To + "...");
    if (device) {
      var outgoingConnection = device.connect(params);
      outgoingConnection.on("ringing", function() {
        log("Ringing...");
      });
    }
  };

  // Bind button to accept incoming call
  document.getElementById("button-accept").onclick = function() {
    log("Accepting incoming call...");
    acceptCall();
  }

  // Bind button to reject incoming call
  document.getElementById("button-reject").onclick = function() {
    log("Rejecting incoming call...");
    rejectCall();
  }

  // Bind button to hangup call
  document.getElementById("button-hangup").onclick = function() {
    log("Hanging up...");
    if (device) {
      device.disconnectAll();
    }
  };

  document.getElementById("get-devices").onclick = function() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(updateAllDevices.bind(device));
  };

  speakerDevices.addEventListener("change", function() {
    var selectedDevices = [].slice
      .call(speakerDevices.children)
      .filter(function(node) {
        return node.selected;
      })
      .map(function(node) {
        return node.getAttribute("data-id");
      });

    device.audio.speakerDevices.set(selectedDevices);
  });

  ringtoneDevices.addEventListener("change", function() {
    var selectedDevices = [].slice
      .call(ringtoneDevices.children)
      .filter(function(node) {
        return node.selected;
      })
      .map(function(node) {
        return node.getAttribute("data-id");
      });

    device.audio.ringtoneDevices.set(selectedDevices);
  });

  function bindVolumeIndicators(connection) {
    connection.on("volume", function(inputVolume, outputVolume) {
      var inputColor = "red";
      if (inputVolume < 0.5) {
        inputColor = "green";
      } else if (inputVolume < 0.75) {
        inputColor = "yellow";
      }

      inputVolumeBar.style.width = Math.floor(inputVolume * 300) + "px";
      inputVolumeBar.style.background = inputColor;

      var outputColor = "red";
      if (outputVolume < 0.5) {
        outputColor = "green";
      } else if (outputVolume < 0.75) {
        outputColor = "yellow";
      }

      outputVolumeBar.style.width = Math.floor(outputVolume * 300) + "px";
      outputVolumeBar.style.background = outputColor;
    });
  }

  function updateAllDevices() {
    updateDevices(speakerDevices, device.audio.speakerDevices.get());
    updateDevices(ringtoneDevices, device.audio.ringtoneDevices.get());

    // updateDevices(speakerDevices, );
    // updateDevices(ringtoneDevices, device);
  }

  // Update the available ringtone and speaker devices
  function updateDevices(selectEl, selectedDevices) {
    selectEl.innerHTML = "";

    device.audio.availableOutputDevices.forEach(function(device, id) {
      var isActive = selectedDevices.size === 0 && id === "default";
      selectedDevices.forEach(function(device) {
        if (device.deviceId === id) {
          isActive = true;
        }
      });

      var option = document.createElement("option");
      option.label = device.label;
      option.setAttribute("data-id", id);
      if (isActive) {
        option.setAttribute("selected", "selected");
      }
      selectEl.appendChild(option);
    });
  }

  // Activity log
  function log(message) {
    var logDiv = document.getElementById("log");
    logDiv.innerHTML += "<p>&gt;&nbsp;" + message + "</p>";
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  // Set the client name in the UI
  function setClientNameUI(clientName) {
    var div = document.getElementById("client-name");
    div.innerHTML = "Your client name: <strong>" + clientName + "</strong>";
  }

  

});
