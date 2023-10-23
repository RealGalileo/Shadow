import './App.css';
import styles from './flip.module.css';
import {nearestInterpolation} from './changeSize';
import {useEffect, useRef, useState} from "react";
import {ProcessControl} from "./ProcessControl";
import {DrawingUtils, FilesetResolver, ImageSegmenter, PoseLandmarker} from "@mediapipe/tasks-vision";
import {useSound} from 'use-sound';

const shadow1 = new Image();
const label_person = 15;
let shadowMtx;
let shadowColor = [0, 0, 0];
let windowWidth = window.innerWidth, windowHeight = window.innerHeight;
let hintSrc = "/assets/background.png";
let shadowWidth = 640, shadowHeight = 480;
let hintX, hintY, hintM;
const shadowPicNames = [
    {path: "/assets/SYCHRONOCITY_v2.mp4", type: "video"},
    {path: "/assets/shadow1.png", type: "pic"},{path: "/assets/1to2_v2.mp4", type: "video"},
    {path: "/assets/shadow2.png", type: "pic"},{path: "/assets/arch2seesaw_v2.mp4", type: "video"},
    {path: "/assets/shadow3.png", type: "pic"}];
const gameOverVideoPath = "/assets/lose_v2.mp4";
const gameSuccessVideoPath = "/assets/2colony_v2.mp4";
let timeID;


function App() {
  const [video, setVideo] = useState(null);
  const canvasRef = useRef(null);
  const shadowRef = useRef(null);
  const fitWindowRef = useRef(null);
  const [similarity, setSimilarity] = useState(0);
  const [playProcess, setPlayProcess] = useState(new ProcessControl());
  const [isPicLoaded, setIsPicLoaded] = useState(false);
  const [videoSrc, setVideoSrc] = useState(null);
  const [playHint1] = useSound("/assets/hint1.mp3");
  const [playHint2] = useSound("/assets/hint2.mp3");
  const [playHint3] = useSound("/assets/hint3.mp3");
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
                newProcess = 5;
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
                            imageData[j] = 56;
                            imageData[j + 1] = 118;
                            imageData[j + 2] = 191;
                            imageData[j + 3] = 255;
                            samePixel++;
                        }
                        else if (mask[i] !== label_person && isShadow) {
                            imageData[j] = 0;
                            imageData[j + 1] = 0;
                            imageData[j + 2] = 0;
                            imageData[j + 3] = 255;
                            diffPixel++;
                        }
                        else if (mask[i] === label_person && !isShadow) {
                            imageData[j] = 238;
                            imageData[j + 1] = 147;
                            imageData[j + 2] = 34;
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


                    let imgData = nearestInterpolation(imageData, shadowWidth, shadowHeight, windowWidth, windowHeight);
                    // hintM = Math.min(windowWidth / shadowWidth, windowHeight / shadowHeight);
                    // hintX = (windowWidth - hintM * shadowWidth) / 2;
                    // hintY = (windowHeight - hintM * shadowHeight) / 2;
                    const uint8Array1 = new Uint8ClampedArray(imgData.buffer);
                    // //console.log(imgData.buffer);
                    const dataNew1 = new ImageData(
                        uint8Array1,
                        windowWidth,
                        windowHeight
                    );
                    tmpCtx.putImageData(dataNew1, 0, 0);
                    // for (const lm of faceLandmark) {
                    //     console.log("lm", lm, lm[0].x, lm[0].y);
                    //     //let mul = lm[3][0] - lm[4][0];
                    //     tmpCtx.putImageData(dataNew1, 0, 0);
                    //     let eye1 = new Image();
                    //     eye1.onload = () => {
                    //         tmpCtx.drawImage(eye1, lm[0].x, lm[0].y, eye1.width, eye1.height);
                    //     };
                    //     eye1.src = "/assets/eye.png";
                    // }

                    //console.log("similarity",similarity, "diff", diffPixel, "same", samePixel);
                    // const uint8Array = new Uint8ClampedArray(imageData.buffer);
                    // const dataNew = new ImageData(
                    //     uint8Array,
                    //     video.videoWidth,
                    //     video.videoHeight
                    // );
                    // canvasCtx.putImageData(dataNew, 0, 0);
                    //console.log("facelandmark", faceLandmark);
                    // for (const lm of faceLandmark) {
                    //     drawingUtils.drawLandmarks(lm, {
                    //         color: '#ffffff',
                    //         radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1)
                    //     });
                    // }
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
        if (playProcess.isSuccess) {
            hintSrc = "/assets/background.png";
            setVideoSrc(gameSuccessVideoPath);
            setIsPicLoaded(false);
        }
        else if (playProcess.isGameOver) {
            hintSrc = "/assets/background.png";
            setVideoSrc(gameOverVideoPath);
            setIsPicLoaded(false);
        }
        else if (curObj.type === "video") {
            //console.log("video", curObj);
            hintSrc = "/assets/background.png";
            setVideoSrc(curObj.path);
            setIsPicLoaded(false);
        }
        else if (curObj.type === "pic") {
            setVideoSrc(null);
            hintSrc = "/assets/nohint.png";
            const shadowElement = shadowRef.current;
            shadow1.onload = () => {
                const shadowCtx = shadowElement.getContext("2d");
                shadowCtx.drawImage(shadow1, 0, 0);
                shadowMtx = shadowCtx.getImageData(0, 0, shadowWidth, shadowHeight).data;
                //console.log(shadowMtx);
                setIsPicLoaded(true);
                timeID = startTimer();
            }
            shadow1.src = curObj.path;
            console.log("shadow1.naturalWidth", shadow1.naturalWidth);
        }
        if (playProcess.hint1 === 1) {
            playHint1();
        }
        else if (playProcess.hint1 === 2) {
            hintSrc = "/assets/hint1-2.png";
            console.log("hint1=2");
        }
        else if (playProcess.hint2 === 1) {
            playHint2();
            //console.log("hint2=1");
        }
        else if (playProcess.hint2 === 2) {
            hintSrc = "/assets/hint2-2.png";
            console.log("hint2=2");
        }
        else if (playProcess.hint3 === 1) {
            playHint3();
            //console.log("hint3=1");
        }
        else if (playProcess.hint3 === 2) {
            hintSrc = "/assets/hint3-2.png";
            console.log("hint3=2");
        }
    }, [playProcess]);

    useEffect(() => {
        if (playProcess.mainProcess === 1 && similarity >= 0.3 && isPicLoaded === true) {
            clearTimeout(timeID);
            setIsPicLoaded(false);
            setPlayProcess(new ProcessControl(playProcess.mainProcess + 1, 0, 0, 0));
        }
        else if (playProcess.mainProcess === 3 && similarity >= 0.2 && isPicLoaded === true) {
            clearTimeout(timeID);
            setIsPicLoaded(false);
            setPlayProcess(new ProcessControl(playProcess.mainProcess + 1, 0, 0, 0));
        }
        else if (playProcess.mainProcess === 5 && similarity >= 0.15 && isPicLoaded === true) {
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
      <img src={hintSrc} width={hintM * shadowWidth} height={hintM * shadowHeight} style={{display: (hintSrc === "/assets/nohint.png") ? "none" : "block", position: "absolute", left: hintX, top: hintY}}/>
      <div style={{fontSize:"50px", position: "absolute", left: 0, top: 500}}>similarity: {similarity}</div>
      <video src={videoSrc} controls style={{width: windowWidth, height: windowHeight, position: "absolute", left: 0, top: 0, display: videoSrc ? "block" : "none"}} autoPlay
               playsInline onEnded={() => {
                   if (playProcess.isGameOver || playProcess.isSuccess) {
                       window.location.reload();
                   }
                   if (videoSrc) {
                       setPlayProcess(new ProcessControl(playProcess.mainProcess + 1, playProcess.hint1, playProcess.hint2, playProcess.hint3));
                   }
      }}/>
    </div>
  );
}

export default App;
