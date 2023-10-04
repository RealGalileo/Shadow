import './App.css';
import {useEffect, useRef, useState} from "react";
import {DrawingUtils, FilesetResolver, ImageSegmenter, PoseLandmarker} from "@mediapipe/tasks-vision";
const label_person = 15;


function App() {
  const [video, setVideo] = useState(null);
  const canvasRef = useRef(null);

    useEffect(() => {(async function () {
        if (!video || !canvasRef.current) {
            return;
        }
        let runningMode = "VIDEO";
        const videoHeight = "480px";
        const videoWidth = "640px";
        let webcamRunning = true;
        let poseLandmarker = undefined;
        let imageSegmenter;
        let poseLandmark;

        const createImageSegmenter = async () => {
            const audio = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
            );
            imageSegmenter = await ImageSegmenter.createFromOptions(audio, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite",
                    delegate: "GPU"
                },
                runningMode: runningMode,
                outputCategoryMask: true,
                outputConfidenceMasks: false
            });
        };
        await createImageSegmenter();

        const createPoseLandmarker = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: './app/shared/models/pose_landmarker_full.task',
                    delegate: "GPU"
                },
                runningMode: runningMode,
                numPoses: 2
            });
        };
        await createPoseLandmarker();

        const canvasElement = canvasRef.current;
        const canvasCtx = canvasElement.getContext("2d");
        const drawingUtils = new DrawingUtils(canvasCtx);

        const constraints = {
            video: true
        };

        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            video.srcObject = stream;
            video.addEventListener("loadeddata", predictWebcam);
        })

        let lastVideoTime = -1;
        async function predictWebcam() {
            canvasElement.style.height = videoHeight;
            video.style.height = videoHeight;
            canvasElement.style.width = videoWidth;
            video.style.width = videoWidth;
            let startTimeMs = performance.now();
            if (lastVideoTime !== video.currentTime) {
                lastVideoTime = video.currentTime;
                poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
                    canvasCtx.save();
                    //console.log(result);
                    poseLandmark = result.landmarks;
                    // canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                    // for (const landmark of result.landmarks) {
                    //     drawingUtils.drawLandmarks(landmark, {
                    //         radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
                    //     });
                    //     drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
                    // }
                    // canvasCtx.restore();
                });
                imageSegmenter.segmentForVideo(video, startTimeMs, (result) => {
                    let imageData = canvasCtx.getImageData(0, 0, video.videoWidth, video.videoHeight).data;
                    const mask = result.categoryMask.getAsUint8Array();
                    let j = 0;
                    //console.log(imageData);
                    for (let i = 0; i < mask.length; ++i) {
                        if (mask[i] === label_person) {
                            imageData[j] = 0;
                            imageData[j + 1] = 0;
                            imageData[j + 2] = 0;
                            imageData[j + 3] = 255;
                        }
                        else {
                            imageData[j] = 255;
                            imageData[j + 1] = 255;
                            imageData[j + 2] = 255;
                            imageData[j + 3] = 0;
                        }
                        j += 4;
                    }
                    const uint8Array = new Uint8ClampedArray(imageData.buffer);
                    const dataNew = new ImageData(
                        uint8Array,
                        video.videoWidth,
                        video.videoHeight
                    );
                    canvasCtx.putImageData(dataNew, 0, 0);
                    for (const lm of poseLandmark) {
                        drawingUtils.drawLandmarks(lm, {
                            color: '#ffffff',
                            radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
                        });
                    }
                });
            }
            //console.log("webcamrunning:",webcamRunning);
            if (webcamRunning === true) {
                window.requestAnimationFrame(predictWebcam);
            }
        }
    })();}, [video]);
  return (
    <div>
      <video ref={(ref) => setVideo(ref)} style={{opacity: "0.0", width: "640px", height: "480px", position: "absolute", left: 0, top: 0}} autoPlay
             playsInline />
      <canvas ref={canvasRef} className="output_canvas" width="640" height="480"
            style={{position: "absolute", left: 0, top: 0}} />
    </div>
  );
}

export default App;