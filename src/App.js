import './App.css';
import styles from './flip.module.css';
import {nearestInterpolation} from './changeSize';
import {useEffect, useRef, useState} from "react";
import {ProcessControl} from "./ProcessControl";
import {DrawingUtils, FilesetResolver, ImageSegmenter, PoseLandmarker} from "@mediapipe/tasks-vision";
import { ReactP5Wrapper } from "@p5-wrapper/react";
import {sketch} from "./sketch";
import {useSound} from 'use-sound';
const label_person = 15;

const shadow1 = new Image();
let shadowMtx;
let shadowColor = [0, 0, 0];
let windowWidth = window.innerWidth, windowHeight = window.innerHeight;
let hintSrc = "nohint.png";
const shadowPicNames = [
    {path: "/assets/IMG_8051.mov", type: "video"},
    {path: "/assets/shadow1.png", type: "pic"},{path: "/assets/IMG_8051.mov", type: "video"},
    {path: "/assets/shadow2.png", type: "pic"},{path: "/assets/IMG_8051.mov", type: "video"},
    {path: "/assets/shadow3.png", type: "pic"}];
let timeID;
const hint1 = [];
const hint2 = [];
const hint3 = [];


function App() {
  const [video, setVideo] = useState(null);
  const canvasRef = useRef(null);
  const shadowRef = useRef(null);
  const fitWindowRef = useRef(null);
  const [similarity, setSimilarity] = useState(0);
  const [playProcess, setPlayProcess] = useState(new ProcessControl());
  const [isPicLoaded, setIsPicLoaded] = useState(false);
  const [videoSrc, setVideoSrc] = useState(null);
  const [playHint1] = useSound("/assets/hint1.m4a");
  //console.log("usestate playprocess", playProcess);

    function startTimer() {
        console.log("timer start");
        return setTimeout(() => {
            console.log("timer callback", playProcess);
            let isGameOver = false;
            let newProcess, newhint1, newhint2, newhint3;
            if (playProcess.mainProcess === 1) {
                newProcess = 1;
                newhint1 = playProcess.hint1 + 1;
                newhint2 = 0;
                newhint3 = 0;
            }
            else if (playProcess.mainProcess === 3) {
                newProcess = 3;
                newhint1 = 0;
                newhint2 = playProcess.hint2 + 1;
                newhint3 = 0;
            }
            else if (playProcess.mainProcess === 5) {
                newProcess = 1;
                newhint1 = 0;
                newhint2 = 0;
                newhint3 = playProcess.hint3 + 1;
                }
            isGameOver = playProcess.hint1 > 2 || playProcess.hint2 > 2 || playProcess.hint3 > 2;
            setPlayProcess(new ProcessControl(newProcess, newhint1, newhint2, newhint3, isGameOver));
        }, 15000);
    }
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
                    //console.log(result.landmarks);
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
                    //console.log("facelandmark", faceLandmark);
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
        let curObj = shadowPicNames[playProcess.mainProcess];
        console.log("playprocess", playProcess);
        if (curObj.type === "video") {
            //console.log("video", curObj);
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
                timeID = startTimer();
            }
            shadow1.src = curObj.path;
        }
        if (playProcess.hint1 === 1) {
            playHint1();
            console.log("hint1=1");
        }
        else if (playProcess.hint1 === 2) {
            hintSrc = "hint1-2.png";
            console.log("hint1=2");
        }
        else if (playProcess.hint2 === 1) {
            console.log("hint2=1");
        }
        else if (playProcess.hint2 === 2) {
            hintSrc = "/assets/hint2-2.png";
            console.log("hint2=2");
        }
        else if (playProcess.hint3 === 1) {
            console.log("hint3=1");
        }
        else if (playProcess.hint3 === 2) {
            hintSrc = "hint3-2.png";
            console.log("hint3=2");
        }
        else if (playProcess.isGameOver) {
            console.log("gameover");
        }
        else if (playProcess.isSuccess) {
            console.log("success");
        }
    }, [playProcess]);

    useEffect(() => {
        if (similarity >= 0.2 && isPicLoaded === true) {
            clearTimeout(timeID);
            setIsPicLoaded(false);
            setPlayProcess(new ProcessControl(playProcess.mainProcess + 1, 0, 0, 0));
        }
    });
  return (
    <div>
      <video ref={(ref) => setVideo(ref)} style={{opacity: "0.0", width: "640px", height: "480px", position: "absolute", left: 0, top: 0}} autoPlay
             playsInline />
      <canvas ref={shadowRef} width="640" height="480" style={{opacity: "0.0", position: "absolute", left: 0, top: 0}}/>
      <canvas ref={canvasRef} className={styles.flip} style={{position: "absolute", left: 0, top: 0}} />
      <canvas ref={fitWindowRef} className={styles.flip} width={windowWidth} height={windowHeight} style={{position: "absolute", left: 0, top: 0}} />
      <img src={hintSrc} width={windowWidth} height={windowHeight} style={{display: !(hintSrc === "nohint.png"), position: "absolute", left: 0, top: 0}}/>
      <ReactP5Wrapper sketch={sketch} style={{position: "absolute", left: 0, top: 0}} />
      <div style={{fontSize:"50px", position: "absolute", left: 0, top: 500}}>similarity: {similarity}</div>
      <video src={videoSrc} controls style={{width: windowWidth, height: windowHeight, position: "absolute", left: 0, top: 0, display: videoSrc ? "block" : "none"}} autoPlay
               playsInline onEnded={() => {
            //console.log("???", videoSrc);
            if (videoSrc) {
                setPlayProcess(new ProcessControl(playProcess.mainProcess + 1, playProcess.hint1, playProcess.hint2, playProcess.hint3));
            }
      }}/>
    </div>
  );
}

export default App;
