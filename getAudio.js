// Polyfill ( Old browser version compatibility )
navigator.getUserMedia = navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia ||
                         navigator.msGetUserMedia;
navigator.getMediaDevices = navigator.getMediaDevices ||
                            navigator.webkitGetMediaDevices ||
                            navigator.mozGetMediaDevices ||
                            navigator.msGetMediaDevices;
window.AudioContext = window.AudioContext ||
                      window.webkitAudioContext ||
                      window.mozAudioContext ||
                      window.msAudioContext;
window.requestAnimationFrame = window.requestAnimationFrame || 
                               window.webkitRequestAnimationFrame ||
                               window.mozRequestAnimationFrame ||
                               window.msRequestAnimationFrame;
window.RTCPeerConnection = window.RTCPeerConnection || 
                           window.mozRTCPeerConnection || 
                           window.webkitRTCPeerConnection ||
                           window.msRTCPeerConnection;
window.RTCSessionDescription = window.RTCSessionDescription || 
                               window.mozRTCSessionDescription || 
                               window.webkitRTCSessionDescription ||
                               window.msRTCSessionDescription;

// Establish variables
var context = new AudioContext(),
    liveStream = null,
    input = null,
    lpInputFilter = null,
    delay = null,
    gainNode = null,
    analyser = null,
    canvasElement = null,
    canvas = null,
    fbc_array = null,
    max = null,
    bars = null,
    bar_x = null,
    bar_width = null,
    bar_height = null,
    broadcast_id = null;
    

window.addEventListener('load', initAudio);

function initAudio() {

    // Check for HTML5 audio compatibility
    if (!navigator.getUserMedia) {
        return(alert("Your browser does not support HTML5 audio.\nTry using the latest version of Google Chrome."));
    }

    // Get user audio stream
    navigator.getUserMedia({audio:true}, gotStream, function(e) {
        alert('Error getting user audio.\nTry refreshing this page.');
        console.log(e);
    });
}

function gotStream(stream) {
    // Get user audio sources
    if (typeof MediaStreamTrack.getSources === 'undefined') {
        console.log("Your browser does not support selection of audio sources. Browse with Google Chrome to use this feature.");
        // navigator.getMediaDevices(gotSources); // < - Will become standard soon
    } else {
        MediaStreamTrack.getSources(gotSources); // < - Chrome only
    }

    useStream(stream);
}

function useStream(stream) {

    // CAUTION: Removing reference to stream will cause it to die after a few seconds
    liveStream = stream;
    input = context.createMediaStreamSource(stream);
    // Activate input toggle switch (switch0)
    document.getElementById('switch0').onclick = toggleStream;

    // Initialize low-pass filter
    lpInputFilter = context.createBiquadFilter();
    lpInputFilter.frequency.value = 100000;
    // Activate low-pass filter toggle switch (switch1)
    document.getElementById('switch1').onclick = toggleFilter;

    // Initialize delay filter
    delay = context.createDelay();
    delay.delayTime.value = 0;
    // Activate delay inputs (switch2, delay)
    document.getElementById('switch2').onclick = toggleDelay;
    document.getElementById('delay').onchange = toggleDelay;

    // Initialize gain node
    gainNode = context.createGain();
    gainNode.gain.value = 10;

    // Connect input -> filter -> delay -> gain -> analyser -> output
    analyser = context.createAnalyser();
    toggleStream();
    lpInputFilter.connect(delay);
    delay.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(context.destination);

    // Prepare drawing canvas for analyser
    canvasElement = document.getElementById('analyser');
    canvas = canvasElement.getContext('2d');

    frameLoop();

    // frameLoop() animates graphics to the audio frequency
    // Automatically loops at the default frame rate that the browser provides (approx. 60 FPS)
    function frameLoop() {
        window.requestAnimationFrame(frameLoop);
        fbc_array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(fbc_array);
        canvas.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvas.fillStyle = '#00CCFF'; // Color of the bars
        bars = 100;
        max = 0;
        for (var i = 0; i < bars; i++) {
            bar_x = i * 3;
            bar_width = 2;
            bar_height = -(Math.pow(fbc_array[i]/170, 2.5)*60);
            canvas.fillRect(bar_x, canvasElement.height, bar_width, bar_height);
            max = Math.max(fbc_array[i], max);
        }
        // Automatic volume control (gain between 0 and 10)
        if (max > 250) {
            --gainNode.gain.value || gainNode.gain.value++;
            console.log(gainNode.gain.value);
        } else if (max > 100 && max < 185) {
            ++gainNode.gain.value-11 || gainNode.gain.value--;
            console.log(gainNode.gain.value);
        }
    }
}

function gotSources(sourceInfos) {

    // Clear list
    var sourceMenu = document.getElementById("sourceinput");
    while (sourceMenu.firstChild) sourceMenu.removeChild(sourceMenu.firstChild);

    console.log(sourceInfos);
    // Populate list with source options
    var preferred = null;
    for (var i = 0; i != sourceInfos.length; ++i) {
        var sourceInfo = sourceInfos[i];
        if (sourceInfo.kind === 'audio') {
            if (sourceInfo.label.toLowerCase() === 'default') continue;
            var option = document.createElement("option");
            option.value = sourceInfo.id;
            option.text = sourceInfo.label || 'Input ' + (sourceMenu.length + 1);
            sourceMenu.appendChild(option);
            if (isPreferred(sourceInfo)) preferred = option.value;
        }
    }
    sourceMenu.onchange = changeSource;
    if (preferred) {
        sourceMenu.value = preferred;
        changeSource();
    } else {
        // If no preferred source, default lpfilter to 'on'
        document.getElementById('switch1').checked = true;
        toggleFilter();
    }
}

// Checks to see if a source is preferred (plays back speaker audio)
function isPreferred(source) {
    return (~source.label.toLowerCase().indexOf('playback') || 
            ~source.label.toLowerCase().indexOf('wave') ||
            ~source.label.toLowerCase().indexOf('stereo') ||
            ~source.label.toLowerCase().indexOf('hear'));
}

// Kill input stream and recreate using selected source
function changeSource() {
    if (!!liveStream) liveStream.stop();
    var sourceMenu = document.getElementById("sourceinput");
    var source = sourceMenu.value;
    var constraints = {
        audio: {
            optional: [{sourceId: source}]
        }
    };
    navigator.getUserMedia(constraints, useStream, function(e) {
        alert('Error getting user audio');
        console.log(e);
    });
}

function toggleStream() {
    (document.getElementById('switch0').checked) ? input.connect(lpInputFilter) : input.disconnect(0);
}

function toggleFilter() {
    lpInputFilter.frequency.value = (document.getElementById('switch1').checked) ? 2048 : 100000;
}

function toggleDelay() {
    var x = document.getElementById('delay').value;
    delay.delayTime.value = (document.getElementById('switch2').checked) ? x/1000 : 0;
    document.getElementById('delay-value').value = x+'ms';
}