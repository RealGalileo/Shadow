import './App.css';
import styles from './flip.module.css';
import {nearestInterpolation} from './changeSize';
import {useEffect, useRef, useState} from "react";
import {DrawingUtils, FilesetResolver, ImageSegmenter, PoseLandmarker} from "@mediapipe/tasks-vision";
import { ReactP5Wrapper } from "@p5-wrapper/react";
import {sketch} from "./sketch";
const label_person = 15;

const shadow1 = new Image();
let shadowMtx;
let shadowColor = [0, 0, 0];
let windowWidth = window.innerWidth, windowHeight = window.innerHeight;
const shadowPicNames = [
    {path: "/assets/IMG_8051.mov", type: "video"},
    {path: "/assets/shadow1.png", type: "pic"},{path: "/assets/IMG_8051.mov", type: "video"},
    {path: "/assets/shadow2.png", type: "pic"},{path: "/assets/IMG_8051.mov", type: "video"},
    {path: "/assets/shadow3.png", type: "pic"}];


function App() {
  const [video, setVideo] = useState(null);
  const canvasRef = useRef(null);
  const shadowRef = useRef(null);
  const fitWindowRef = useRef(null);
  const [similarity, setSimilarity] = useState(0);
  const [playProcess, setPlayProcess] = useState(0);
  const [isPicLoaded, setIsPicLoaded] = useState(false);
  const [videoSrc, setVideoSrc] = useState(null);
    useEffect(() => {(async function () {
        if (!video || !canvasRef.current || !shadowRef.current) {
            return;
        }
        let runningMode = "VIDEO";
        const videoHeight = "480px";
        const videoWidth = "640px";
        let webcamRunning = true;
        let poseLandmarker = undefined;
        let imageSegmenter;
        let poseLandmark = [];
        let faceLandmark = [];

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

        const shadowElement = shadowRef.current;
        const shadowCtx = shadowElement.getContext("2d");
        shadowMtx = shadowCtx.getImageData(0, 0, 640, 480).data;
        // shadow1.onload = () => {
        //     const shadowCtx = shadowElement.getContext("2d");
        //     shadowCtx.drawImage(shadow1, 0, 0);
        //     shadowMtx = shadowCtx.getImageData(0, 0, 640, 480).data;
        //     console.log(shadowMtx);
        // }
        //shadow1.src = shadowPicNames[playProcess];

        const canvasElement = canvasRef.current;
        const canvasCtx = canvasElement.getContext("2d");
        const tmpCtx = fitWindowRef.current.getContext("2d");
        const drawingUtils = new DrawingUtils(tmpCtx);

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
                    console.log(result.landmarks);
                    poseLandmark = result.landmarks;
                    // 0-nose, 2-left eye, 5-right eye, 9-mouth left, 10-mouth right
                    faceLandmark = [];
                    if (result.landmarks.length !== 0) {
                        for (const p of poseLandmark) {
                            faceLandmark.push([p[0], p[2], p[5], p[9], p[10]]);
                        }
                    }
                });
                imageSegmenter.segmentForVideo(video, startTimeMs, (result) => {
                    let imageData = canvasCtx.getImageData(0, 0, video.videoWidth, video.videoHeight).data;
                    const mask = result.categoryMask.getAsUint8Array();
                    let j = 0;
                    let samePixel = 0, diffPixel = 0;
                    //console.log(imageData);
                    for (let i = 0; i < mask.length; ++i) {
                        let isShadow = (shadowMtx[j] === shadowColor[0] && shadowMtx[j + 1] === shadowColor[1]
                            && shadowMtx[j + 2] === shadowColor[2])
                        if (mask[i] === label_person && isShadow) {
                            imageData[j] = 255;
                            imageData[j + 1] = 208;
                            imageData[j + 2] = 208;
                            imageData[j + 3] = 255;
                            samePixel++;
                        }
                        else if (mask[i] !== label_person && isShadow) {
                            imageData[j] = 58;
                            imageData[j + 1] = 166;
                            imageData[j + 2] = 185;
                            imageData[j + 3] = 255;
                            diffPixel++;
                        }
                        else if (mask[i] === label_person && !isShadow) {
                            imageData[j] = 255;
                            imageData[j + 1] = 158;
                            imageData[j + 2] = 170;
                            imageData[j + 3] = 255;
                            diffPixel++;
                        }
                        else{
                            imageData[j] = shadowMtx[j];
                            imageData[j + 1] = shadowMtx[j + 1];
                            imageData[j + 2] = shadowMtx[j + 2];
                            imageData[j + 3] = shadowMtx[j + 3];
                        }
                        j += 4;
                    }
                    setSimilarity(samePixel / (samePixel + diffPixel));


                    let imgData = nearestInterpolation(imageData, 640, 480, windowWidth, windowHeight);
                    const uint8Array1 = new Uint8ClampedArray(imgData.buffer);
                    // //console.log(imgData.buffer);
                    const dataNew1 = new ImageData(
                        uint8Array1,
                        windowWidth,
                        windowHeight
                    );
                    tmpCtx.putImageData(dataNew1, 0, 0);


                    //console.log("similarity",similarity, "diff", diffPixel, "same", samePixel);
                    // const uint8Array = new Uint8ClampedArray(imageData.buffer);
                    // const dataNew = new ImageData(
                    //     uint8Array,
                    //     video.videoWidth,
                    //     video.videoHeight
                    // );
                    // canvasCtx.putImageData(dataNew, 0, 0);
                    console.log("facelandmark", faceLandmark);
                    for (const lm of faceLandmark) {
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

    useEffect(() => {
        let curObj = shadowPicNames[playProcess];
        if (curObj.type === "video") {
            console.log("video", curObj);
            setVideoSrc(curObj.path);
            setIsPicLoaded(false);
        }
        else if (curObj.type === "pic") {
            setVideoSrc(null);
            const shadowElement = shadowRef.current;
            shadow1.onload = () => {
                const shadowCtx = shadowElement.getContext("2d");
                shadowCtx.drawImage(shadow1, 0, 0);
                shadowMtx = shadowCtx.getImageData(0, 0, 640, 480).data;
                //console.log(shadowMtx);
                setIsPicLoaded(true);
            }
            shadow1.src = curObj.path;
        }

    }, [playProcess]);

    useEffect(() => {
        if (similarity >= 0.2 && isPicLoaded === true) {
            setIsPicLoaded(false);
            setPlayProcess((playProcess + 1) % 6);
        }
    });
  return (
    <div>
      <video ref={(ref) => setVideo(ref)} style={{opacity: "0.0", width: "640px", height: "480px", position: "absolute", left: 0, top: 0}} autoPlay
             playsInline />
      <canvas ref={shadowRef} width="640" height="480" style={{opacity: "0.0", position: "absolute", left: 0, top: 0}}/>
      <canvas ref={canvasRef} className={styles.flip} style={{position: "absolute", left: 0, top: 0}} />
      <canvas ref={fitWindowRef} className={styles.flip} width={windowWidth} height={windowHeight} style={{position: "absolute", left: 0, top: 0}} />
      <ReactP5Wrapper sketch={sketch} style={{position: "absolute", left: 0, top: 0}} />
      <div style={{fontSize:"50px", position: "absolute", left: 0, top: 500}}>similarity: {similarity}</div>
      <video src={videoSrc} controls style={{width: windowWidth, height: windowHeight, position: "absolute", left: 0, top: 0, display: videoSrc ? "block" : "none"}} autoPlay
               playsInline onEnded={() => {
            //console.log("???", videoSrc);
            if (videoSrc) {
                setPlayProcess(playProcess + 1);
            }
      }}/>
    </div>
  );
}

export default App;
